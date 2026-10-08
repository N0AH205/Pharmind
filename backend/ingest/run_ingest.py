"""
Knowledge base ingestion script — Phase 2.

Populates ChromaDB with pharmaceutical text from PubChem, DailyMed, and PubMed
for a benchmark set of drugs.

Embeddings are generated via Google text-embedding-004 (Gemini API).
Requires GEMINI_API_KEY to be set in backend/.env.
No local Ollama required.

Run once (from the backend/ directory):
    python -m ingest.run_ingest

Re-running is safe: existing entries are overwritten (upsert by ID).

Metadata stored per chunk:
    drug        : common drug name (e.g. "Aspirin")
    pubchem_cid : str(CID) — used for metadata filtering in retriever
    field       : section type (e.g. "indications", "pharmacology", "research")
    source      : human-readable source label
    url         : source URL
"""

from __future__ import annotations

import asyncio
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import chromadb
import httpx

from ingest.pubchem import get_compound_by_smiles, get_pharmacology_text, get_synonyms
from ingest.dailymed import search_drug_labels, get_label_sections
from ingest.pubmed import search_pubmed, fetch_abstracts

CHROMA_PATH = os.getenv("CHROMA_PATH", "../data/chroma")
COLLECTION_NAME = "pharma_docs"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
EMBED_MODEL = "gemini-embedding-001"

# Benchmark drug set — expand for Phase 4 evaluation
# cid field is an optional override: use it when SMILES-based PubChem lookup
# returns a wrong or ambiguous compound (e.g. isotope-labelled forms).
BENCHMARK_DRUGS: list[dict] = [
    {"name": "Aspirin",      "smiles": "CC(=O)Oc1ccccc1C(=O)O", "dailymed_query": "Durlaza"},
    {"name": "Ibuprofen",    "smiles": "CC(C)Cc1ccc(cc1)C(C)C(=O)O"},
    # Metformin: SMILES-based lookup keeps resolving to the [14C] isotope;
    # hardcode CID 4091 (canonical Metformin entry on PubChem) as override.
    {"name": "Metformin",    "smiles": "CN(C)C(=N)NC(N)=N", "cid": 4091},
    {"name": "Atorvastatin", "smiles": "CC(C)c1c(C(=O)Nc2ccccc2F)c(-c2ccccc2)c(-c2ccc(F)cc2)n1CCC(O)CC(O)CC(=O)O"},
    # Caffeine: override DailyMed query to avoid the neonatal IV caffeine citrate label
    # which lacks the general pharmacology info (adenosine antagonism, CNS effects).
    {"name": "Caffeine",     "smiles": "Cn1cnc2c1c(=O)n(c(=O)n2C)C", "dailymed_query": "caffeine ergotamine"},
]


from rag.embeddings import embed_text_local


def embed_text(text: str) -> list[float]:
    """
    Embed text locally using FastEmbed (BAAI/bge-small-en-v1.5).
    100% offline.
    """
    return embed_text_local(text)



# -- PubChem CID resolution ----------------------------------------------------

async def resolve_cid(
    name: str,
    smiles: str,
    cid_override: int | None = None,
) -> tuple[int | None, str]:
    """
    Resolve a drug to its PubChem CID.

    If cid_override is provided it takes priority (use for drugs where
    SMILES-based lookup returns an ambiguous or wrong compound).

    Returns (cid, canonical_name).
    """
    if cid_override:
        syns = await get_synonyms(cid_override, max_synonyms=5)
        common = syns[0] if syns else name
        return cid_override, common

    props = await get_compound_by_smiles(smiles)
    if props:
        cid = props.get("CID")
        if cid:
            syns = await get_synonyms(cid, max_synonyms=5)
            common = syns[0] if syns else name
            return cid, common
    # SMILES lookup failed
    return None, name


# -- Per-drug ingestion --------------------------------------------------------

async def ingest_drug(drug: dict, collection) -> int:
    """
    Fetch data for one drug from PubChem, DailyMed, and PubMed,
    embed each chunk, and upsert into ChromaDB.

    Each chunk's metadata includes:
        - drug        : canonical drug name
        - pubchem_cid : str(CID) for metadata-filtered retrieval
        - field       : content category
        - source      : source label
        - url         : source URL

    Returns the number of chunks stored.
    """
    name: str = drug["name"]
    smiles: str = drug["smiles"]
    cid_override: int | None = drug.get("cid")
    print(f"\n-- Ingesting {name} --")
    chunks: list[dict] = []

    # 0. Resolve CID (used as stable drug identifier in metadata)
    cid, canonical_name = await resolve_cid(name, smiles, cid_override=cid_override)
    cid_str = str(cid) if cid else ""
    if cid_override and cid:
        print(f"  PubChem CID : {cid} (hardcoded override)")
    else:
        print(f"  PubChem CID : {cid or '(not resolved)'}")
    print(f"  Canonical   : {canonical_name}")

    # 1. PubChem — pharmacology description text
    if cid:
        pharm_text = await get_pharmacology_text(cid)
        if pharm_text:
            chunks.append({
                "text": pharm_text,
                "source": f"PubChem CID {cid}",
                "url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}",
                "drug": canonical_name,
                "pubchem_cid": cid_str,
                "field": "pharmacology",
            })
            print(f"  PubChem pharmacology: {len(pharm_text):,} chars")
        else:
            print(f"  PubChem: no pharmacology text for CID {cid}")
    else:
        print(f"  PubChem: CID not resolved for '{name}'")

    # 2. DailyMed — FDA label sections (XML parsing)
    # Build search candidates: override_query (if exists), original name, canonical name, and top synonyms
    override_query = drug.get("dailymed_query")
    search_candidates = [override_query] if override_query else [name]

    if name not in search_candidates:
        search_candidates.append(name)
    if canonical_name and canonical_name.lower() not in [c.lower() for c in search_candidates]:
        search_candidates.append(canonical_name)
    if cid:
        syns = await get_synonyms(cid, max_synonyms=15)
        for s in syns:
            if s.lower() not in [c.lower() for c in search_candidates]:
                search_candidates.append(s)

    # Search DailyMed concurrently for all search candidates
    search_tasks = [search_drug_labels(cand, pagesize=10) for cand in search_candidates]
    search_results = await asyncio.gather(*search_tasks)

    # Flatten search results and deduplicate by setid
    seen_setids = set()
    unique_labels = []
    for labels_list in search_results:
        for l in labels_list:
            sid = l.get("setid")
            if sid and sid not in seen_setids:
                seen_setids.add(sid)
                unique_labels.append(l)

    # Limit to top 20 unique labels total to keep requests fast
    unique_labels = unique_labels[:20]

    if unique_labels:
        # Fetch sections for all unique labels concurrently
        tasks = [get_label_sections(l.get("setid")) for l in unique_labels if l.get("setid")]
        all_sections = await asyncio.gather(*tasks)

        # Select the label containing the highest number of non-empty clinical sections
        best_idx = 0
        max_sections = 0
        for idx, secs in enumerate(all_sections):
            if len(secs) > max_sections:
                max_sections = len(secs)
                best_idx = idx

        sections = all_sections[best_idx] if all_sections else {}
        selected_label = unique_labels[best_idx]
        set_id = selected_label.get("setid")
        title = selected_label.get("title", "Unknown label")

        print(f"  DailyMed: analyzed {len(unique_labels)} unique label(s) from {len(search_candidates)} search terms. Selected: '{title[:60]}...' (setid: {set_id}, sections: {max_sections})")

        for field_key, text in sections.items():
            if text:
                chunks.append({
                    "text": text[:4000],
                    "source": f"DailyMed SPL – {canonical_name}",
                    "url": f"https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid={set_id}",
                    "drug": canonical_name,
                    "pubchem_cid": cid_str,
                    "field": field_key,
                })
    else:
        print(f"  DailyMed: no labels found for '{name}' (searched synonyms: {search_candidates})")

    # 3. PubMed — field-specific research abstracts
    # Fetch targeted queries for each schema section to maximise keyword coverage
    pubmed_queries = [
        (f"{name} mechanism of action pharmacology",                    "moa",            6),
        (f"{name} pharmacokinetics ADME absorption distribution metabolism excretion", "adme", 6),
        (f"{name} adverse effects side effects toxicity",               "adverse_effects", 5),
        (f"{name} clinical indications therapeutic use treatment",      "indications",    4),
        (f"{name} toxicology LD50 cytotoxicity genotoxicity",           "toxicology",     4),
        (f"{name} drug interactions contraindications",                 "interactions",   4),
        (f"{name} history discovery clinical trials approval",          "history",        4),
    ]

    pm_count = 0
    for query_str, field_label, max_res in pubmed_queries:
        pmids = await search_pubmed(query_str, max_results=max_res)
        abstracts = await fetch_abstracts(pmids)
        for ab in abstracts:
            if ab["abstract"]:
                chunks.append({
                    "text": f"{ab['title']}\n\n{ab['abstract']}",
                    "source": f"PubMed PMID {ab['pmid']}",
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{ab['pmid']}/",
                    "drug": canonical_name,
                    "pubchem_cid": cid_str,
                    "field": field_label,
                })
                pm_count += 1
    print(f"  PubMed: {pm_count} abstract(s) across {len(pubmed_queries)} field queries")

    if not chunks:
        print(f"  WARNING: No chunks collected for {name} — skipping")
        return 0

    # 4. Embed and upsert into ChromaDB
    ids, embeddings, documents, metadatas = [], [], [], []
    for i, chunk in enumerate(chunks):
        chunk_id = f"{name.lower().replace(' ', '_')}-{i}"
        print(f"  Embedding {i + 1}/{len(chunks)}: {chunk['field']} …", end="\r", flush=True)

        vec = embed_text(chunk["text"])
        ids.append(chunk_id)
        embeddings.append(vec)
        documents.append(chunk["text"])
        # Metadata must only contain str/int/float/bool values for ChromaDB
        metadatas.append({
            "drug":        chunk["drug"],
            "pubchem_cid": chunk["pubchem_cid"],
            "field":       chunk["field"],
            "source":      chunk["source"],
            "url":         chunk["url"],
        })

    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )
    print(f"  Stored {len(chunks)} chunk(s)                    ")
    return len(chunks)


# -- Database inspection -------------------------------------------------------

def print_db_summary(collection):
    """Print a summary of what is stored in the collection."""
    count = collection.count()
    if count == 0:
        print("Collection is empty.")
        return

    # Fetch all metadata (no embeddings — faster)
    all_items = collection.get(include=["metadatas"])
    metadatas = all_items["metadatas"]

    # Group by drug + field
    from collections import defaultdict
    summary: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for meta in metadatas:
        drug = meta.get("drug", "unknown")
        field = meta.get("field", "unknown")
        summary[drug][field] += 1

    print("\n" + "-" * 58)
    print(f"{'Drug':<20} {'Field':<30} {'Chunks':>6}")
    print("-" * 58)
    for drug in sorted(summary):
        for field in sorted(summary[drug]):
            print(f"{drug:<20} {field:<30} {summary[drug][field]:>6}")
    print("-" * 58)
    print(f"Total chunks: {count}")


# -- Entry point ---------------------------------------------------------------

async def main():
    print("=" * 60)
    print("PharmaRAG — Knowledge Base Ingestion (Local FastEmbed)")
    print(f"Embedding model : BAAI/bge-small-en-v1.5 (Local FastEmbed ONNX)")
    print(f"ChromaDB path   : {CHROMA_PATH}")
    print("=" * 60)

    # Quick connectivity/local test check
    try:
        test_vec = embed_text("test")
        print(f"\nLocal embedding OK — vector dimension: {len(test_vec)}")
    except Exception as e:
        print(f"\nERROR: Local embedding test failed: {e}")
        return

    db = chromadb.PersistentClient(path=CHROMA_PATH)
    try:
        db.delete_collection(name=COLLECTION_NAME)
        print("Reset existing ChromaDB collection for local 384d FastEmbed embeddings...")
    except Exception:
        pass

    collection = db.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    total = 0
    for drug in BENCHMARK_DRUGS:
        total += await ingest_drug(drug, collection)

    print("\n" + "=" * 60)
    print("Ingestion complete!")
    print_db_summary(collection)
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
