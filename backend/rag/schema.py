"""
Pydantic schema for the structured drug-information output.

Every content field uses FieldValue, which carries:
  - content: the actual text (None if missing)
  - sources: list of citations
  - missing: True if data was not found — the LLM must NOT fabricate

This schema is also serialised as a JSON Schema and injected into the
system prompt so the LLM knows the exact structure to output (Phase 3).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class Citation(BaseModel):
    source: str
    url: Optional[str] = None
    accessed_at: Optional[str] = None
    text: Optional[str] = None
    publication_date: Optional[str] = None
    authors: Optional[str] = None
    journal: Optional[str] = None
    doi: Optional[str] = None
    pmid: Optional[str] = None
    document_id: Optional[str] = None



class FieldValue(BaseModel):
    """
    A single output field. If data is unavailable, set missing=True
    and content=None. NEVER fabricate content.
    """
    content: Optional[str] = None
    sources: list[Citation] = Field(default_factory=list)
    missing: bool = False


# ── Structured Bioactivity & Confidence Models ───────────────────────────────

class BioactivityRecord(BaseModel):
    target_name: str
    target_organism: Optional[str] = "Homo sapiens"
    action_type: Optional[str] = None   # inhibitor, agonist, antagonist, etc.
    standard_type: str                  # Ki, Kd, IC50, EC50
    value_nm: Optional[float] = None
    relation: Optional[str] = "="       # =, <, >
    pchembl_value: Optional[float] = None
    assay_description: Optional[str] = None
    chembl_assay_id: Optional[str] = None
    doi: Optional[str] = None


class CYPProfile(BaseModel):
    substrates: list[str] = Field(default_factory=list)
    inhibitors: list[str] = Field(default_factory=list)
    inducers: list[str] = Field(default_factory=list)
    evidence_source: Optional[str] = None


class DataConfidenceLevel(str, Enum):
    HIGH = "HIGH (FDA Approved with Full Label)"
    MODERATE = "MODERATE (Clinical Candidate with Target Data)"
    PRECLINICAL = "PRECLINICAL (In Vitro / Assay Evidence Only)"
    UNSTUDIED = "UNSTUDIED (Sparse / Unknown Profile)"


# ── Overview section ──────────────────────────────────────────────────────────

class DrugName(BaseModel):
    generic: str
    brand_names: list[str] = Field(default_factory=list)
    lab_codes: list[str] = Field(default_factory=list)
    sources: list[Citation] = Field(default_factory=list)


class ChemicalStructure(BaseModel):
    smiles: Optional[str] = None
    drug_type: Optional[str] = "small_molecule"
    biologic_class: Optional[str] = None
    target: Optional[str] = None
    chembl_id: Optional[str] = None
    inchi: Optional[str] = None
    iupac_name: Optional[str] = None
    molecular_formula: Optional[str] = None
    molecular_weight: Optional[float] = None
    pubchem_cid: Optional[int] = None
    image_url: Optional[str] = None
    sources: list[Citation] = Field(default_factory=list)


# ── Pharmacodynamics section ──────────────────────────────────────────────────

class PharmacodynamicsFields(BaseModel):
    mechanism_of_action: FieldValue   # Step-by-step biological cascade
    physiologic_effect: FieldValue    # Direct functional/systemic changes
    binding_affinity: FieldValue      # Kd or Ki values
    selectivity: FieldValue           # Primary vs off-target affinity
    potency: FieldValue               # EC50 / ED50
    efficacy: FieldValue              # Emax — maximum achievable effect
    bioactivities: list[BioactivityRecord] = Field(default_factory=list)


# ── Pharmacokinetics section (ADME) ──────────────────────────────────────────

class ADMEFields(BaseModel):
    absorption: FieldValue    # Bioavailability, Tmax, absorption sites
    distribution: FieldValue  # Vd, protein binding, BBB
    metabolism: FieldValue    # CYP450, metabolites, hepatic involvement
    excretion: FieldValue     # CL, t1/2, elimination pathways
    cyp_profile: Optional[CYPProfile] = None


# ── Toxicology section ────────────────────────────────────────────────────────

class ToxicologyFields(BaseModel):
    acute_toxicity: FieldValue          # LD50, LC50 values with species and routes
    cytotoxicity: FieldValue            # IC50, EC50, Cell viability & integrity
    genetic_toxicology: FieldValue      # Carcinogenicity, genotoxicity, reproductive toxicity
    hazard_classifications: FieldValue  # GHS, IARC/NTP, EPA/ECHA classifications


# ── Therapeutic profile section ───────────────────────────────────────────────

class TherapeuticProfile(BaseModel):
    indications: FieldValue        # Approved + key off-label uses
    contraindications: FieldValue  # Absolute and relative
    adverse_effects: FieldValue    # Common and serious ADRs
    drug_interactions: FieldValue  # DDI, DFI, drug-disease interactions


# ── History section ───────────────────────────────────────────────────────────

class HistoryFields(BaseModel):
    background: FieldValue     # Medical context, unmet need, key figures
    discovery: FieldValue      # Origin of lead compound
    development: FieldValue    # Optimization, preclinical, patents
    clinical_trials: FieldValue  # Phase I–III, approvals


# ── Root output model ─────────────────────────────────────────────────────────

class DrugInfo(BaseModel):
    """
    Full structured drug-information output.
    Returned by the RAG pipeline for every SMILES query.
    """
    query_smiles: str
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    data_confidence: Optional[str] = Field(
        default=DataConfidenceLevel.HIGH.value,
        description="Deterministic confidence rating based on regulatory approval and assay depth",
    )
    disclaimer: str = (
        "This information is for educational and reference purposes only. "
        "It does not constitute clinical advice. Always consult a licensed "
        "clinician or pharmacist for patient-specific guidance."
    )

    # Overview
    drug_name: DrugName
    therapeutic_classes: FieldValue   # Broad clinical category + pharmacological class
    chemical_structure: ChemicalStructure

    # Sections
    pharmacodynamics: PharmacodynamicsFields
    adme: ADMEFields
    toxicology: ToxicologyFields
    therapeutic_profile: TherapeuticProfile
    history: HistoryFields


class QueryRequest(BaseModel):
    smiles: str = Field(..., min_length=1, description="A valid SMILES string")
