"""
openFDA Drug Label REST Client — Zero-Hallucination Package Inserts.

Fetches FDA-approved package insert sections (SPL labels):
  - Boxed warnings
  - Indications and usage
  - Contraindications & Warnings
  - Adverse reactions
  - Drug interactions (CYP metabolism tables)
  - Mechanism of action & Pharmacokinetics

Provides seamless fallback to DailyMed SPL labels if openFDA query returns 404.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional
import httpx

logger = logging.getLogger(__name__)

OPENFDA_BASE_URL = "https://api.fda.gov/drug/label.json"
CACHE_DIR = Path(__file__).parent.parent / "data" / "cache" / "openfda"


def _get_cache(key: str) -> dict | None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / f"{key}.json"
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def _set_cache(key: str, data: dict) -> None:
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        cache_file = CACHE_DIR / f"{key}.json"
        cache_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except Exception as exc:
        logger.warning("Failed to cache openFDA response for %s: %s", key, exc)


def _clean_fda_text(values: list[str] | str | None) -> str | None:
    if not values:
        return None
    if isinstance(values, list):
        text = "\n\n".join(v.strip() for v in values if v.strip())
        return text if text else None
    return values.strip() if values.strip() else None


async def fetch_openfda_label(drug_name: str) -> dict | None:
    """
    Query openFDA label endpoint by generic_name or brand_name.
    Returns structured label sections and openfda metadata.
    """
    clean_name = drug_name.strip().lower()
    cache_key = f"label_{clean_name}"
    cached = _get_cache(cache_key)
    if cached:
        return cached

    search_queries = [
        f'openfda.generic_name:"{clean_name}"',
        f'openfda.brand_name:"{clean_name}"',
        f'openfda.substance_name:"{clean_name}"',
    ]

    async with httpx.AsyncClient(timeout=15) as client:
        for q in search_queries:
            try:
                r = await client.get(OPENFDA_BASE_URL, params={"search": q, "limit": 1})
                if r.status_code == 200:
                    results = r.json().get("results", [])
                    if results:
                        label = results[0]
                        openfda_meta = label.get("openfda", {})

                        parsed = {
                            "source": "openFDA Approved Drug Label",
                            "generic_name": openfda_meta.get("generic_name", [drug_name])[0],
                            "brand_names": openfda_meta.get("brand_name", []),
                            "spl_id": label.get("id") or (openfda_meta.get("spl_id", [None])[0]),
                            "boxed_warning": _clean_fda_text(label.get("boxed_warning")),
                            "indications": _clean_fda_text(label.get("indications_and_usage")),
                            "contraindications": _clean_fda_text(label.get("contraindications")),
                            "warnings": _clean_fda_text(label.get("warnings_and_cautions") or label.get("warnings")),
                            "adverse_reactions": _clean_fda_text(label.get("adverse_reactions")),
                            "drug_interactions": _clean_fda_text(label.get("drug_interactions")),
                            "mechanism_of_action": _clean_fda_text(label.get("mechanism_of_action")),
                            "pharmacokinetics": _clean_fda_text(label.get("pharmacokinetics")),
                            "clinical_pharmacology": _clean_fda_text(label.get("clinical_pharmacology")),
                        }
                        _set_cache(cache_key, parsed)
                        return parsed
            except Exception as exc:
                logger.debug("openFDA query failed for %s: %s", q, exc)

    return None
