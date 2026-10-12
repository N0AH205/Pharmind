"""Retrieve exact-structure quantitative bioactivity records from ChEMBL."""

from __future__ import annotations

import httpx

from rag.config import require_network_allowed

BASE_URL = "https://www.ebi.ac.uk/chembl/api/data"
_ACTIVITY_FIELDS = {
    "Kd": "binding_affinity",
    "Ki": "binding_affinity",
    "IC50": "potency",
    "EC50": "potency",
    "ED50": "potency",
    "Emax": "efficacy",
}


async def get_chembl_activity_evidence(inchi_key: str | None) -> list[dict]:
    """Fetch measured activities only after an exact InChIKey structure match."""
    require_network_allowed("ChEMBL bioactivity lookup")
    if not inchi_key:
        return []

    fields = (
        "activity_id", "molecule_chembl_id", "molecule_pref_name", "assay_type",
        "assay_description", "assay_chembl_id", "target_chembl_id", "target_pref_name",
        "target_organism", "document_chembl_id", "document_journal", "document_year",
        "standard_type", "standard_relation", "standard_value", "standard_units",
        "pchembl_value", "activity_comment", "data_validity_comment",
    )
    async with httpx.AsyncClient(timeout=40) as client:
        try:
            molecule_response = await client.get(
                f"{BASE_URL}/molecule.json",
                params={"molecule_structures__standard_inchi_key": inchi_key, "limit": 5},
            )
            molecule_response.raise_for_status()
            molecules = molecule_response.json().get("molecules", [])
            exact_molecules = [
                molecule for molecule in molecules
                if (molecule.get("molecule_structures") or {}).get("standard_inchi_key") == inchi_key
                and molecule.get("molecule_chembl_id")
            ]
            if not exact_molecules:
                return []
            molecule_id = exact_molecules[0]["molecule_chembl_id"]

            response = await client.get(
                f"{BASE_URL}/activity.json",
                params={
                    "molecule_chembl_id": molecule_id,
                    "standard_type__in": ",".join(_ACTIVITY_FIELDS),
                    "limit": 500,
                },
            )
            response.raise_for_status()
            activities = response.json().get("activities", [])
        except Exception:
            return []

    # Preserve assay, target, species, relation, units, and validity notes.
    # Values from different targets or assay formats must never be averaged.
    accepted: list[dict] = []
    seen: set[tuple] = set()
    field_counts: dict[str, int] = {}
    for activity in activities:
        standard_type = activity.get("standard_type")
        field = _ACTIVITY_FIELDS.get(standard_type)
        value = activity.get("standard_value")
        units = activity.get("standard_units")
        if not field or value is None or not units:
            continue
        if activity.get("activity_comment") == "Not Determined":
            continue

        key = (
            field, activity.get("target_chembl_id"), activity.get("assay_chembl_id"),
            standard_type, activity.get("standard_relation"), value, units,
        )
        if key in seen or field_counts.get(field, 0) >= 80:
            continue
        seen.add(key)
        field_counts[field] = field_counts.get(field, 0) + 1

        activity_id = activity.get("activity_id")
        relation = activity.get("standard_relation") or "="
        target = activity.get("target_pref_name") or activity.get("target_chembl_id") or "unspecified target"
        organism = activity.get("target_organism") or "organism not reported"
        assay_type = activity.get("assay_type") or "assay type not reported"
        assay_description = activity.get("assay_description") or "Assay details not provided"
        pchembl = activity.get("pchembl_value")
        year = activity.get("document_year")
        journal = activity.get("document_journal")
        validity = activity.get("data_validity_comment")

        text = (
            f"ChEMBL measured activity for {activity.get('molecule_pref_name') or molecule_id}. "
            f"Endpoint: {standard_type} {relation} {value} {units}. Target: {target} "
            f"(target ID {activity.get('target_chembl_id') or 'not provided'}); organism: {organism}. "
            f"Assay type: {assay_type}; assay: {assay_description}. "
            f"pChEMBL: {pchembl or 'not reported'}. "
            f"Source document: {activity.get('document_chembl_id') or 'not provided'}"
            f"{f', {journal}' if journal else ''}{f', {year}' if year else ''}."
        )
        if validity:
            text += f" Data validity note: {validity}."
        if activity.get("activity_comment"):
            text += f" Activity comment: {activity['activity_comment']}."

        accepted.append({
            "text": text,
            "source": f"ChEMBL {molecule_id} activity {activity_id or ''}".strip(),
            "url": f"{BASE_URL}/activity/{activity_id}.json" if activity_id else f"{BASE_URL}/molecule/{molecule_id}.json",
            "field": field,
            "drug": activity.get("molecule_pref_name") or molecule_id,
            "pubchem_cid": "",
            "document_id": activity.get("document_chembl_id") or str(activity_id or ""),
            "target_chembl_id": activity.get("target_chembl_id") or "",
            "assay_chembl_id": activity.get("assay_chembl_id") or "",
            "publication_date": str(year or ""),
            "journal": journal or "",
        })
    return accepted
