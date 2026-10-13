/**
 * DrugInfo schema — TypeScript types matching the Python Pydantic backend schema.
 * Every field uses FieldValue, which carries the content, citations, and a
 * `missing` flag. When `missing` is true, the UI shows "Data not available"
 * rather than fabricated content.
 */

export interface Citation {
  source: string;       // e.g. "PubChem CID 2244", "DailyMed SPL 2023-04"
  url?: string;
  accessed_at?: string;
  text?: string;        // Full passage text retrieved from ChromaDB
  publication_date?: string;
  authors?: string;
  journal?: string;
  doi?: string;
  pmid?: string;
  document_id?: string;
}

export interface FieldValue {
  content: string | null;
  sources: Citation[];
  missing: boolean;
}

// ── Structured Bioactivities & Profiles ───────────────────────────────────────

export interface BioactivityRecord {
  target_name: string;
  target_organism?: string;
  action_type?: string;
  standard_type: string;
  value_nm?: number | null;
  relation?: string;
  pchembl_value?: number | null;
  assay_description?: string;
  chembl_assay_id?: string;
  doi?: string;
}

export interface CYPProfile {
  substrates: string[];
  inhibitors: string[];
  inducers: string[];
  evidence_source?: string;
}

export type DataConfidenceLevel =
  | "HIGH (FDA Approved with Full Label)"
  | "MODERATE (Clinical Candidate with Target Data)"
  | "PRECLINICAL (In Vitro / Assay Evidence Only)"
  | "UNSTUDIED (Sparse / Unknown Profile)";

// ── Overview ──────────────────────────────────────────────────────────────────

export interface ChemicalStructure {
  smiles?: string;
  drug_type?: string;
  biologic_class?: string;
  target?: string;
  chembl_id?: string;
  inchi?: string;
  iupac_name?: string;
  molecular_formula?: string;
  molecular_weight?: number;
  pubchem_cid?: number;
  image_url?: string;
  sources: Citation[];
}

// ── Pharmacodynamics ──────────────────────────────────────────────────────────

export interface PharmacodynamicsFields {
  mechanism_of_action: FieldValue;   // Step-by-step cascade
  physiologic_effect: FieldValue;    // Functional/systemic changes
  binding_affinity: FieldValue;      // Kd / Ki values
  selectivity: FieldValue;           // Primary vs off-target
  potency: FieldValue;               // EC50 / ED50
  efficacy: FieldValue;              // Emax
  bioactivities?: BioactivityRecord[];
}

// ── Pharmacokinetics (ADME) ───────────────────────────────────────────────────

export interface ADMEFields {
  absorption: FieldValue;    // Bioavailability, Tmax, absorption sites
  distribution: FieldValue;  // Vd, protein binding, BBB
  metabolism: FieldValue;    // CYP450, metabolites
  excretion: FieldValue;     // CL, t1/2, elimination
  cyp_profile?: CYPProfile;
}

// ── Toxicology ────────────────────────────────────────────────────────────────

export interface ToxicologyFields {
  acute_toxicity: FieldValue;
  cytotoxicity: FieldValue;
  genetic_toxicology: FieldValue;
  hazard_classifications: FieldValue;
}

// ── Therapeutic Profile ───────────────────────────────────────────────────────

export interface TherapeuticProfile {
  indications: FieldValue;
  contraindications: FieldValue;
  adverse_effects: FieldValue;
  drug_interactions: FieldValue;
}

// ── History ───────────────────────────────────────────────────────────────────

export interface HistoryFields {
  background: FieldValue;
  discovery: FieldValue;
  development: FieldValue;
  clinical_trials: FieldValue;
}

// ── Root ──────────────────────────────────────────────────────────────────────

export interface DrugInfo {
  drug_name: {
    generic: string;
    brand_names: string[];
    lab_codes: string[];
    sources: Citation[];
  };
  therapeutic_classes: FieldValue;
  chemical_structure: ChemicalStructure;
  pharmacodynamics: PharmacodynamicsFields;
  adme: ADMEFields;
  toxicology: ToxicologyFields;
  therapeutic_profile: TherapeuticProfile;
  history: HistoryFields;
  disclaimer: string;
  data_confidence?: string;
  query_smiles: string;
  generated_at: string;
}

export interface QueryRequest {
  smiles: string;
}

export interface QueryResponse {
  success: boolean;
  data?: DrugInfo;
  error?: string;
}

export interface ChatSource {
  id: string;
  num: number;
  name: string;
  url: string;
  title?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  smiles?: string;
  text?: string;
  sources?: ChatSource[];
  drugInfo?: DrugInfo;
  error?: string;
  timestamp: Date | string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}
