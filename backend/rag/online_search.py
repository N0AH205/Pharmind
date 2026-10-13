"""On-demand online source refresh for compounds identified by PubChem."""

from __future__ import annotations

import asyncio
import logging
import time

logger = logging.getLogger(__name__)
_REFRESH_INTERVAL_SECONDS = 12 * 60 * 60
_last_refresh: dict[str, float] = {}
_refresh_locks: dict[str, asyncio.Lock] = {}


async def refresh_compound_sources(structure_data: dict, collection) -> int:
    """Search supported source APIs and index results at most every 12 hours."""
    cid = str(structure_data.get("pubchem_cid") or "").strip()
    name = str(structure_data.get("common_name") or structure_data.get("iupac_name") or "").strip()
    smiles = str(structure_data.get("smiles") or "").strip()
    if not name:
        return 0

    key_id = cid if (cid and cid.isdigit()) else f"name-{name.lower()}"
    lock = _refresh_locks.setdefault(key_id, asyncio.Lock())
    async with lock:
        now = time.monotonic()
        last_refresh = _last_refresh.get(key_id)
        if last_refresh is not None and now - last_refresh < _REFRESH_INTERVAL_SECONDS:
            return 0
        _last_refresh[key_id] = now
        try:
            from ingest.run_ingest import ingest_drug

            brand_names = structure_data.get("brand_names") or []
            dailymed_candidate = brand_names[0] if brand_names else name

            count = await ingest_drug(
                {
                    "name": name,
                    "smiles": smiles,
                    "cid": int(cid) if (cid and cid.isdigit()) else None,
                    "inchi_key": structure_data.get("inchi_key"),
                    "dailymed_query": dailymed_candidate,
                },
                collection,
            )
            logger.info("Online source refresh for %s (%s): %s chunks", name, key_id, count)
            return count
        except Exception:
            logger.exception("Online source refresh failed for %s (%s)", name, key_id)
            return 0


async def search_live_pubmed(compound: str | dict) -> list[dict]:
    """Fetch a fresh, topic-balanced PubMed and ClinicalTrials evidence set for this monograph."""
    if isinstance(compound, dict):
        name = str(compound.get("common_name") or "").strip()
        brand_names = compound.get("brand_names") or []
        if isinstance(brand_names, str):
            brand_names = [brand_names]
        raw_aliases = compound.get("synonyms") or []
        if isinstance(raw_aliases, str):
            raw_aliases = [raw_aliases]
        aliases = [name, *brand_names, *(str(alias).strip() for alias in raw_aliases), str(compound.get("iupac_name") or "").strip()]
    else:
        name = compound.strip()
        aliases = [name]
    aliases = list(dict.fromkeys(alias for alias in aliases if alias))[:4]
    if not aliases:
        return []

    passages = []
    # 1. PubMed live topic search
    try:
        from ingest.pubmed import fetch_abstracts, search_pubmed

        topic_queries = [
            ("moa", "mechanism of action pharmacology molecular target"),
            ("binding_affinity", "binding affinity Ki Kd dissociation constant target assay"),
            ("potency", "potency IC50 EC50 dose response assay"),
            ("selectivity", "selectivity comparative inhibition off-target"),
            ("adme", "pharmacokinetics absorption distribution metabolism excretion half-life"),
            ("indications", "clinical indications therapeutic use efficacy"),
            ("adverse_effects", "adverse effects safety side effects warnings"),
            ("interactions", "drug interactions contraindications interaction"),
            ("toxicology", "toxicology acute toxicity genotoxicity carcinogenicity"),
            ("clinical_trials", "clinical trial randomized study outcomes results"),
            ("history", "discovery development history approval"),
        ]
        topic_pmids: dict[str, list[str]] = {}
        all_pmids: list[str] = []
        seen: set[str] = set()
        name_query = " OR ".join(f'"{alias}"[Title/Abstract]' for alias in aliases)
        for topic, suffix in topic_queries:
            matches = await search_pubmed(f'({name_query}) AND ({suffix})', max_results=3)
            topic_pmids[topic] = matches
            for pmid in matches:
                if pmid not in seen:
                    seen.add(pmid)
                    all_pmids.append(pmid)

        articles = await fetch_abstracts(all_pmids)
        for topic, pmids in topic_pmids.items():
            for article in articles:
                if article.get("pmid") not in pmids:
                    continue
                pmid = article.get("pmid", "")
                passages.append({
                    "text": f"{article.get('title', '')}\n\n{article.get('abstract', '')}",
                    "source": f"PubMed PMID {pmid}",
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                    "field": topic,
                    "retrieval_group": topic,
                    "distance": 1.0,
                    "drug": name or aliases[0],
                    "pubchem_cid": str(compound.get("pubchem_cid") or "") if isinstance(compound, dict) else "",
                    "authors": "; ".join(article.get("authors", [])),
                    "publication_date": article.get("publication_date", ""),
                    "journal": article.get("journal", ""),
                    "doi": article.get("doi", ""),
                    "pmid": pmid,
                    "document_id": pmid,
                })
    except Exception as exc:
        logger.warning("Live PubMed search failed: %s", exc)

    # 2. On-demand ClinicalTrials.gov search for active Phase 3/4 trials
    try:
        from ingest.clinicaltrials import search_drug_trials
        trials = await search_drug_trials(name or aliases[0], limit=4)
        for trial in trials:
            nct_id = trial.get("nct_id", "")
            passages.append({
                "text": trial.get("text", ""),
                "source": f"ClinicalTrials.gov {nct_id}",
                "url": trial.get("url", f"https://clinicaltrials.gov/study/{nct_id}"),
                "field": "clinical_trials",
                "retrieval_group": "clinical_trials",
                "distance": 1.0,
                "drug": name or aliases[0],
                "pubchem_cid": str(compound.get("pubchem_cid") or "") if isinstance(compound, dict) else "",
                "publication_date": trial.get("publication_date", ""),
                "document_id": nct_id,
            })
    except Exception as exc:
        logger.warning("ClinicalTrials.gov search failed: %s", exc)

    return passages
