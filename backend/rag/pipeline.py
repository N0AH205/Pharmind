"""
RAG pipeline — Phase 3.

Orchestrates the full chain:
    PubChem → QueryBuilder → Retriever → ContextBuilder → LLM → CitationResolver → Pydantic

debug=True returns a separate debug object (retrieved chunks, source_map)
alongside the normal DrugInfo — without polluting the public API schema.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from rag.schema import (
    DrugInfo, DrugName, ChemicalStructure, Citation,
    FieldValue, ADMEFields, PharmacodynamicsFields,
    ToxicologyFields, TherapeuticProfile, HistoryFields,
)
from rag.retriever import get_retriever
from rag.context_builder import build_context
from rag.citation_resolver import resolve_field_citations
from rag.llm import generate_structured_output
from rag.query_builder import build_retrieval_query
from ingest.local_chem import enrich_structure_local as enrich_structure

PROMPT_TEMPLATE = Path(__file__).parent.parent / "prompts" / "drug_info.txt"

logger = logging.getLogger(__name__)

_MISSING = FieldValue(content=None, missing=True)


async def run_pipeline(
    smiles: str,
    debug: bool = False,
) -> DrugInfo | dict[str, Any]:
    """
    Full RAG pipeline: SMILES → structured DrugInfo.

    Args:
        smiles: A valid SMILES string or drug query.
        debug:  If True, returns a dict:
                    {
                        "result": DrugInfo.model_dump(),
                        "debug": {
                            "retrieved_chunks": [...],
                            "source_map_keys": [...],
                            "query": "...",
                        }
                    }
                If False (default), returns DrugInfo directly.

    Raises:
        ValueError: If the LLM returns malformed JSON.
        pydantic.ValidationError: If the LLM output doesn't match DrugInfo.
        ClinicalAdviceRefusal: If the query requests patient-specific clinical advice.
    """
    # ── 0. Safety Guardrail: check for clinical advice queries ────────────
    from rag.safety import check_query_safety, ClinicalAdviceRefusal
    is_safe, refusal = await check_query_safety(smiles)
    if not is_safe:
        raise ClinicalAdviceRefusal(refusal or "Query contains clinical advice and was refused.")

    retriever = get_retriever()

    # ── 1. PubChem: resolve SMILES → drug identity ────────────────────────
    structure_data = await enrich_structure(smiles)

    # ── 3. Retrieve relevant chunks from ChromaDB ─────────────────────────
    if not retriever.is_ready():
        # Knowledge base is empty — fall back to mock (development only)
        from rag.pipeline_mock import MOCK_ASPIRIN
        return MOCK_ASPIRIN.model_copy(update={"query_smiles": smiles})

    # Use the stable PubChem CID as the metadata filter for two-stage retrieval:
    # Stage 1 — only this drug's chunks; Stage 2 — rank by semantic similarity.
    pubchem_cid = str(structure_data.get("pubchem_cid") or "")

    # ── 1.5. Dynamic JIT Ingestion (OOD Drugs) ───────────────────────────
    if pubchem_cid and retriever.get_drug_chunk_count(pubchem_cid) == 0:
        common_name = structure_data.get("common_name") or structure_data.get("iupac_name") or "Unknown"
        logger.info(f"Dynamic JIT Ingestion triggered for '{common_name}' (CID: {pubchem_cid})")
        print(f"JIT Ingestion: '{common_name}' (CID: {pubchem_cid}) not found in DB. Ingesting dynamically...")

        drug_dict = {
            "name": common_name,
            "smiles": structure_data.get("smiles") or smiles,
            "cid": int(pubchem_cid) if pubchem_cid.isdigit() else None,
        }

        try:
            from ingest.run_ingest import ingest_drug
            # Ingest using the retriever's collection
            chunks_count = await ingest_drug(drug_dict, retriever.collection)
            if chunks_count > 0:
                logger.info(f"Dynamic JIT Ingestion successful: stored {chunks_count} chunk(s) for CID {pubchem_cid}")
                print(f"JIT Ingestion: successfully stored {chunks_count} chunk(s) for '{common_name}'")
            else:
                logger.warning(f"Dynamic JIT Ingestion yielded 0 chunks for CID {pubchem_cid}")
        except Exception as e:
            logger.error(f"Failed to dynamically ingest drug CID {pubchem_cid}: {e}", exc_info=True)
            print(f"JIT Ingestion Warning: failed to dynamically ingest drug CID {pubchem_cid} ({e}). Falling back...")

    # Define retrieval categories with their specific query parameters
    categories = [
        {"field": "moa",             "n": 6},
        {"field": "adme",            "n": 6},
        {"field": "adverse_effects", "n": 5},
        {"field": "indications",     "n": 4},
        {"field": "toxicology",      "n": 4},
        {"field": "interactions",    "n": 4},
        {"field": "history",         "n": 4},
    ]

    # Build queries and execute concurrently
    retrieval_tasks = []
    for cat in categories:
        cat_query = build_retrieval_query(structure_data, field=cat["field"])
        retrieval_tasks.append(
            retriever.retrieve(
                cat_query,
                n_results=cat["n"],
                pubchem_cid=pubchem_cid or None,
            )
        )

    # Await all retrieval tasks concurrently
    import asyncio
    results = await asyncio.gather(*retrieval_tasks)

    # Flatten and deduplicate by chunk text
    all_chunks = []
    for r in results:
        all_chunks.extend(r)

    seen = set()
    chunks = []
    for chunk in all_chunks:
        txt = chunk.get("text", "")
        if txt and txt not in seen:
            seen.add(txt)
            chunks.append(chunk)

    if not chunks:
        # Fallback: single generic query if category-specific retrieval returns nothing
        query = build_retrieval_query(structure_data, field=None)
        chunks = await retriever.retrieve(
            query,
            n_results=8,
            pubchem_cid=pubchem_cid or None,
        )

    if not chunks:
        raise ValueError(
            f"ChromaDB returned 0 chunks for drug CID {pubchem_cid}. "
            "Run python -m ingest.run_ingest to populate the knowledge base."
        )

    # Rerank retrieved passages using local FlashRank
    from rag.reranker import rerank_passages
    main_query = build_retrieval_query(structure_data, field=None)
    chunks = rerank_passages(query=main_query, chunks=chunks, top_k=10)

    # ── 4. Build labelled context + source_map ────────────────────────────
    context, source_map = build_context(chunks)

    # ── 5. Load and fill prompt template ──────────────────────────────────
    template = PROMPT_TEMPLATE.read_text(encoding="utf-8")
    drug_name = (
        structure_data.get("common_name")
        or structure_data.get("iupac_name")
        or smiles
    )
    system_prompt = (
        template
        .replace("{context}", context)
        .replace("{smiles}", smiles)
        .replace("{drug_name}", drug_name)
    )
    user_message = (
        f"Drug SMILES: {smiles}\n"
        f"Drug name: {drug_name}\n"
        f"IUPAC name: {structure_data.get('iupac_name', 'unknown')}"
    )

    # ── 6. Call LLM ───────────────────────────────────────────────────────
    raw_dict = await generate_structured_output(
        system_prompt=system_prompt,
        user_message=user_message,
        output_schema=DrugInfo,
    )

    # ── 7. Resolve source_ids → trusted Citations ─────────────────────────
    raw_dict = resolve_field_citations(raw_dict, source_map)

    # ── 8. Inject trusted PubChem structure (never from LLM) ─────────────
    raw_dict["chemical_structure"] = {
        **structure_data,
        "common_name": None,
        "synonyms": None,
    }
    chem_keys = ChemicalStructure.model_fields.keys()
    raw_dict["chemical_structure"] = {
        k: v for k, v in raw_dict["chemical_structure"].items()
        if k in chem_keys
    }
    raw_dict["query_smiles"] = smiles

    # ── 9. Pydantic validation — graceful degradation on LLM misformat ────
    try:
        drug_info = DrugInfo(**raw_dict)
    except (ValidationError, Exception) as exc:
        logger.error(
            "Pydantic validation failed for SMILES %r — returning safe fallback. Error: %s",
            smiles, exc,
        )
        # Build a structurally valid DrugInfo where all LLM fields are missing.
        # The user sees 'Data unavailable' rather than a 500 error.
        drug_info = DrugInfo(
            query_smiles=smiles,
            drug_name=DrugName(
                generic=structure_data.get("common_name") or structure_data.get("iupac_name") or smiles,
                brand_names=[],
                lab_codes=[],
                sources=[],
            ),
            chemical_structure=ChemicalStructure(
                **{k: v for k, v in {
                    **structure_data,
                    "common_name": None,
                    "synonyms": None,
                }.items() if k in ChemicalStructure.model_fields}
            ),
            therapeutic_classes=_MISSING,
            pharmacodynamics=PharmacodynamicsFields(
                mechanism_of_action=_MISSING,
                physiologic_effect=_MISSING,
                binding_affinity=_MISSING,
                selectivity=_MISSING,
                potency=_MISSING,
                efficacy=_MISSING,
            ),
            adme=ADMEFields(
                absorption=_MISSING,
                distribution=_MISSING,
                metabolism=_MISSING,
                excretion=_MISSING,
            ),
            toxicology=ToxicologyFields(
                acute_toxicity=_MISSING,
                cytotoxicity=_MISSING,
                genetic_toxicology=_MISSING,
                hazard_classifications=_MISSING,
            ),
            therapeutic_profile=TherapeuticProfile(
                indications=_MISSING,
                contraindications=_MISSING,
                adverse_effects=_MISSING,
                drug_interactions=_MISSING,
            ),
            history=HistoryFields(
                background=_MISSING,
                discovery=_MISSING,
                development=_MISSING,
                clinical_trials=_MISSING,
            ),
        )

    if debug:
        return {
            "result": drug_info.model_dump(),
            "debug": {
                "query": query,
                "retrieved_chunks": [
                    {k: v for k, v in c.items() if k != "text"}
                    for c in chunks
                ],
                "source_map_keys": list(source_map.keys()),
                "chunk_count": retriever.chunk_count(),
            },
        }

    return drug_info


async def run_pipeline_stream(smiles: str):
    """
    Stream real-time status events, generated LLM tokens, and final DrugInfo result
    for Server-Sent Events (SSE).
    """
    from rag.safety import check_query_safety
    from rag.llm import generate_structured_output_stream

    yield {"type": "status", "stage": "safety_check", "message": "Checking query safety & guardrails..."}
    is_safe, refusal = await check_query_safety(smiles)
    if not is_safe:
        yield {"type": "error", "message": refusal or "Query contains clinical advice and was refused."}
        return

    yield {"type": "status", "stage": "resolving_structure", "message": "Resolving chemical structure via local RDKit engine..."}
    structure_data = await enrich_structure(smiles)

    retriever = get_retriever()
    if not retriever.is_ready():
        from rag.pipeline_mock import MOCK_ASPIRIN
        mock_res = MOCK_ASPIRIN.model_copy(update={"query_smiles": smiles})
        yield {"type": "result", "data": mock_res.model_dump()}
        return

    pubchem_cid = str(structure_data.get("pubchem_cid") or "")
    yield {"type": "status", "stage": "retrieving", "message": f"Searching local ChromaDB vector database for CID {pubchem_cid or 'compound'}..."}

    categories = [
        {"field": "moa",             "n": 6},
        {"field": "adme",            "n": 6},
        {"field": "adverse_effects", "n": 5},
        {"field": "indications",     "n": 4},
        {"field": "toxicology",      "n": 4},
        {"field": "interactions",    "n": 4},
        {"field": "history",         "n": 4},
    ]

    import asyncio
    retrieval_tasks = []
    for cat in categories:
        cat_query = build_retrieval_query(structure_data, field=cat["field"])
        retrieval_tasks.append(
            retriever.retrieve(cat_query, n_results=cat["n"], pubchem_cid=pubchem_cid or None)
        )

    results = await asyncio.gather(*retrieval_tasks)
    all_chunks = []
    for r in results:
        all_chunks.extend(r)

    seen = set()
    chunks = []
    for chunk in all_chunks:
        txt = chunk.get("text", "")
        if txt and txt not in seen:
            seen.add(txt)
            chunks.append(chunk)

    if not chunks:
        query = build_retrieval_query(structure_data, field=None)
        chunks = await retriever.retrieve(query, n_results=8, pubchem_cid=pubchem_cid or None)

    from rag.reranker import rerank_passages
    main_query = build_retrieval_query(structure_data, field=None)
    chunks = rerank_passages(query=main_query, chunks=chunks, top_k=10)

    yield {"type": "status", "stage": "retrieved", "message": f"Retrieved and reranked {len(chunks)} top medical passages. Building context..."}
    context, source_map = build_context(chunks)

    template = PROMPT_TEMPLATE.read_text(encoding="utf-8")
    drug_name = (
        structure_data.get("common_name")
        or structure_data.get("iupac_name")
        or smiles
    )
    system_prompt = (
        template
        .replace("{context}", context)
        .replace("{smiles}", smiles)
        .replace("{drug_name}", drug_name)
    )
    user_message = (
        f"Drug SMILES: {smiles}\n"
        f"Drug name: {drug_name}\n"
        f"IUPAC name: {structure_data.get('iupac_name', 'unknown')}"
    )

    yield {"type": "status", "stage": "generating", "message": "Synthesizing structured drug monograph via local LLM..."}

    accumulated_json = []
    async for token in generate_structured_output_stream(
        system_prompt=system_prompt,
        user_message=user_message,
        output_schema=DrugInfo,
    ):
        accumulated_json.append(token)
        yield {"type": "token", "content": token}

    full_raw_str = "".join(accumulated_json)
    try:
        raw_dict = json.loads(full_raw_str)
    except json.JSONDecodeError:
        raw_dict = await generate_structured_output(
            system_prompt=system_prompt,
            user_message=user_message,
            output_schema=DrugInfo,
        )

    raw_dict = resolve_field_citations(raw_dict, source_map)
    raw_dict["chemical_structure"] = {
        **structure_data,
        "common_name": None,
        "synonyms": None,
    }
    chem_keys = ChemicalStructure.model_fields.keys()
    raw_dict["chemical_structure"] = {
        k: v for k, v in raw_dict["chemical_structure"].items()
        if k in chem_keys
    }
    raw_dict["query_smiles"] = smiles

    try:
        drug_info = DrugInfo(**raw_dict)
    except Exception:
        drug_info = DrugInfo(
            query_smiles=smiles,
            drug_name=DrugName(
                generic=structure_data.get("common_name") or structure_data.get("iupac_name") or smiles,
                brand_names=[],
                lab_codes=[],
                sources=[],
            ),
            chemical_structure=ChemicalStructure(
                **{k: v for k, v in {
                    **structure_data,
                    "common_name": None,
                    "synonyms": None,
                }.items() if k in ChemicalStructure.model_fields}
            ),
            therapeutic_classes=_MISSING,
            pharmacodynamics=PharmacodynamicsFields(
                mechanism_of_action=_MISSING,
                physiologic_effect=_MISSING,
                binding_affinity=_MISSING,
                selectivity=_MISSING,
                potency=_MISSING,
                efficacy=_MISSING,
            ),
            adme=ADMEFields(
                absorption=_MISSING,
                distribution=_MISSING,
                metabolism=_MISSING,
                excretion=_MISSING,
            ),
            toxicology=ToxicologyFields(
                acute_toxicity=_MISSING,
                cytotoxicity=_MISSING,
                genetic_toxicology=_MISSING,
                hazard_classifications=_MISSING,
            ),
            therapeutic_profile=TherapeuticProfile(
                indications=_MISSING,
                contraindications=_MISSING,
                adverse_effects=_MISSING,
                drug_interactions=_MISSING,
            ),
            history=HistoryFields(
                background=_MISSING,
                discovery=_MISSING,
                development=_MISSING,
                clinical_trials=_MISSING,
            ),
        )

    yield {"type": "result", "data": drug_info.model_dump()}

