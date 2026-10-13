import { useState, useMemo } from "react";
import type { DrugInfo, FieldValue, Citation } from "@/lib/types";
import StructureViewer from "./StructureViewer";
import CitationBadge from "./CitationBadge";
import CitationModal from "./CitationModal";
import styles from "./DrugInfoCard.module.css";

type Tab = "overview" | "pharmacodynamics" | "pharmacokinetics" | "safety" | "history" | "resources";

interface Props {
  data: DrugInfo;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",          label: "Overview" },
  { id: "pharmacodynamics",  label: "Pharmacology" },
  { id: "pharmacokinetics",  label: "Pharmacokinetics" },
  { id: "safety",            label: "Safety" },
  { id: "history",           label: "Evidence" },
  { id: "resources",         label: "Resources" },
];

const MISSING_MESSAGES: { [key: string]: string } = {
  indications: "No indication details retrieved from current indexed sources.",
  contraindications: "No contraindication details retrieved from current indexed sources.",
  adverse_effects: "No adverse-effect details retrieved from current indexed sources.",
  drug_interactions: "No interaction details retrieved from current indexed sources.",
  mechanism_of_action: "No mechanism details retrieved from current indexed sources.",
  physiologic_effect: "No physiologic-effect details retrieved from current indexed sources.",
  binding_affinity: "No binding-affinity data retrieved from current indexed sources.",
  selectivity: "No selectivity data retrieved from current indexed sources.",
  potency: "No potency data retrieved from current indexed sources.",
  efficacy: "No efficacy details retrieved from current indexed sources.",
  absorption: "No absorption details retrieved from current indexed sources.",
  distribution: "No distribution details retrieved from current indexed sources.",
  metabolism: "No metabolism details retrieved from current indexed sources.",
  excretion: "No excretion details retrieved from current indexed sources.",
  acute_toxicity: "No acute-toxicity data retrieved from current indexed sources.",
  cytotoxicity: "No cytotoxicity data retrieved from current indexed sources.",
  genetic_toxicology: "No genetic-toxicology data retrieved from current indexed sources.",
  hazard_classifications: "No hazard-classification data retrieved from current indexed sources.",
  background: "No background details retrieved from current indexed sources.",
  discovery: "No discovery details retrieved from current indexed sources.",
  development: "No development details retrieved from current indexed sources.",
  clinical_trials: "No clinical trial data retrieved from current indexed sources.",
  classification: "No classification details retrieved from current indexed sources."
};

function formatChemicalFormula(formula: string): string {
  const subscripts: { [key: string]: string } = {
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
    "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉"
  };
  return formula.split("").map(char => subscripts[char] || char).join("");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className={styles.sectionLabel}>{children}</h3>;
}

function InfoBlock({
  label,
  field,
  slug,
  accentColor = "teal",
  onSelectCitation,
}: {
  label: string;
  field: FieldValue;
  slug: string;
  accentColor?: "teal" | "indigo" | "amber" | "rose" | "violet";
  onSelectCitation?: (citation: Citation) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isMissing = !field || field.missing || !field.content;
  const missingText = MISSING_MESSAGES[slug] || "No data retrieved from current indexed sources.";

  return (
    <div
      className={`${styles.infoBlock} ${isMissing ? styles.infoBlockMissing : ""} ${styles[`accent-${accentColor}`]}`}
    >
      <button
        type="button"
        className={styles.infoBlockHeader}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        id={`field-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <span className={styles.infoBlockLabel}>{label}</span>
        <span className={styles.infoBlockRight}>
          {isMissing && (
            <span
              className={`badge ${styles.missingBadge}`}
              style={{
                background: "#f8fafc",
                color: "#64748b",
                border: "1px solid #cbd5e1",
                fontSize: "0.72rem",
                fontWeight: 600,
              }}
            >
              ⚪ Not Found in Current Sources
            </span>
          )}
          <svg
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {expanded && (
        <div className={styles.infoBlockBody}>
          {isMissing ? (
            <p className={styles.missingText}>{missingText}</p>
          ) : (
            <div className={styles.infoBlockContent}>
              {field.content!.split("\n").map((line, i) =>
                line.trim() ? (
                  <p key={i} className={styles.contentLine}>
                    {line}
                  </p>
                ) : (
                  <br key={i} />
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a safe "data unavailable" FieldValue when data is missing/undefined. */
const MISSING: FieldValue = { content: null, sources: [], missing: true };

function safeField(f: FieldValue | undefined | null): FieldValue {
  return f ?? MISSING;
}

interface UnifiedCitationItem {
  id: string;
  num: number;
  citation: Citation;
  tag: string;
  title: string;
  url?: string;
  sections: string[];
}

function getUnifiedCitations(data: DrugInfo): UnifiedCitationItem[] {
  const map = new Map<string, { citation: Citation; sections: Set<string> }>();

  const register = (citations: Citation[] | undefined, sectionName: string) => {
    if (!citations || !Array.isArray(citations)) return;
    for (const c of citations) {
      if (!c) continue;
      const key = (c.url || c.source || "").trim();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, { citation: c, sections: new Set() });
      }
      if (sectionName) {
        map.get(key)!.sections.add(sectionName);
      }
    }
  };

  register(data.drug_name?.sources, "Drug Identity");

  if (data.pharmacodynamics) {
    register(data.pharmacodynamics.mechanism_of_action?.sources, "Mechanism of Action");
    register(data.pharmacodynamics.physiologic_effect?.sources, "Physiologic Effect");
    register(data.pharmacodynamics.binding_affinity?.sources, "Binding Affinity");
    register(data.pharmacodynamics.selectivity?.sources, "Selectivity");
    register(data.pharmacodynamics.potency?.sources, "Potency");
    register(data.pharmacodynamics.efficacy?.sources, "Efficacy");
  }

  if (data.adme) {
    register(data.adme.absorption?.sources, "Absorption");
    register(data.adme.distribution?.sources, "Distribution");
    register(data.adme.metabolism?.sources, "Metabolism");
    register(data.adme.excretion?.sources, "Excretion");
  }

  if (data.therapeutic_profile) {
    register(data.therapeutic_profile.indications?.sources, "Indications");
    register(data.therapeutic_profile.contraindications?.sources, "Contraindications");
    register(data.therapeutic_profile.adverse_effects?.sources, "Adverse Effects");
    register(data.therapeutic_profile.drug_interactions?.sources, "Interactions");
  }

  if (data.toxicology) {
    register(data.toxicology.acute_toxicity?.sources, "Acute Toxicity");
    register(data.toxicology.cytotoxicity?.sources, "Cytotoxicity");
    register(data.toxicology.genetic_toxicology?.sources, "Genetic Toxicology");
    register(data.toxicology.hazard_classifications?.sources, "Hazard Classifications");
  }

  if (data.history) {
    register(data.history.background?.sources, "Background");
    register(data.history.discovery?.sources, "Discovery");
    register(data.history.development?.sources, "Development");
    register(data.history.clinical_trials?.sources, "Clinical Trials");
  }

  let index = 1;
  const items: UnifiedCitationItem[] = [];
  for (const [key, { citation, sections }] of map.entries()) {
    const rawUrl = citation.url || "";
    const lower = (rawUrl + " " + (citation.source || "")).toLowerCase();
    let tag = "Literature";
    let computedUrl = citation.url;

    if (lower.includes("dailymed")) {
      tag = "DailyMed";
      if (!computedUrl && data.drug_name.generic) {
        computedUrl = `https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(data.drug_name.generic)}`;
      }
    } else if (lower.includes("fda.gov") || lower.includes("openfda")) {
      tag = "openFDA";
    } else if (lower.includes("pubmed") || citation.pmid || lower.includes("pmid")) {
      tag = "PubMed";
      const pmidMatch = citation.pmid
        ? String(citation.pmid)
        : (citation.source || "").match(/PMID\s*(\d+)/i)?.[1];
      if (!computedUrl && pmidMatch) {
        computedUrl = `https://pubmed.ncbi.nlm.nih.gov/${pmidMatch}/`;
      }
    } else if (lower.includes("pubchem")) {
      tag = "PubChem";
      if (!computedUrl && data.chemical_structure.pubchem_cid) {
        computedUrl = `https://pubchem.ncbi.nlm.nih.gov/compound/${data.chemical_structure.pubchem_cid}`;
      }
    } else if (lower.includes("clinicaltrials") || lower.includes("nct")) {
      tag = "ClinicalTrials";
      const nctMatch = (citation.source || "").match(/(NCT\d+)/i)?.[1];
      if (!computedUrl && nctMatch) {
        computedUrl = `https://clinicaltrials.gov/study/${nctMatch}`;
      }
    } else if (lower.includes("chembl")) {
      tag = "ChEMBL";
    }

    let title = (citation.source || key).trim();
    title = title.replace(/^PUG View\s*/i, "").trim();

    items.push({
      id: `cite-${index}`,
      num: index,
      citation,
      tag,
      title,
      url: computedUrl,
      sections: Array.from(sections),
    });
    index++;
  }

  return items;
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function DrugInfoCard({ data }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const unifiedSources = useMemo(() => getUnifiedCitations(data), [data]);

  const filteredSources = useMemo(() => {
    if (resourceFilter === "all") return unifiedSources;
    return unifiedSources.filter((s) => s.tag === resourceFilter);
  }, [unifiedSources, resourceFilter]);

  const brandList = (data.drug_name.brand_names ?? []).join(", ");
  const labCodes  = (data.drug_name.lab_codes ?? []).join(", ");

  // Defensive normalization — handles old API responses missing new nested objects
  const pd   = data.pharmacodynamics   ?? {} as typeof data.pharmacodynamics;
  const tox  = data.toxicology         ?? {} as typeof data.toxicology;
  const tp   = data.therapeutic_profile ?? {} as typeof data.therapeutic_profile;
  const hist = data.history            ?? {} as typeof data.history;

  function handleExportMonograph() {
    const mdContent = `# Pharmacological Monograph: ${data.drug_name.generic}
**SMILES**: \`${data.query_smiles}\`
**Formula**: ${data.chemical_structure.molecular_formula || "N/A"}
**Molecular Weight**: ${data.chemical_structure.molecular_weight || "N/A"} g/mol
**IUPAC**: ${data.chemical_structure.iupac_name || "N/A"}

---

## 1. Mechanism of Action
${data.pharmacodynamics.mechanism_of_action.content || "Data unavailable"}

## 2. Pharmacokinetics (ADME)
- **Absorption**: ${data.adme.absorption.content || "N/A"}
- **Distribution**: ${data.adme.distribution.content || "N/A"}
- **Metabolism**: ${data.adme.metabolism.content || "N/A"}
- **Excretion**: ${data.adme.excretion.content || "N/A"}

## 3. Toxicology & Safety
- **Acute Toxicity**: ${data.toxicology.acute_toxicity.content || "N/A"}
- **Indications**: ${data.therapeutic_profile.indications.content || "N/A"}

---
*Generated by Pharmer Local AI Workbench on ${new Date(data.generated_at).toLocaleString()}*
`;

    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.drug_name.generic.toLowerCase().replace(/\s+/g, "_")}_monograph.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`${styles.card} animate-fade-in-up`}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.drugIcon} aria-hidden="true">💊</div>
          <div>
            <h2 className={styles.genericName}>{data.drug_name.generic}</h2>
            {brandList && (
              <p className={styles.headerMeta}>
                <span className={styles.metaLabel}>Brand: </span>
                {brandList}
              </p>
            )}
            {labCodes && (
              <p className={styles.headerMeta}>
                <span className={styles.metaLabel}>Aliases: </span>
                {labCodes}
              </p>
            )}
          </div>
        </div>

        <div className={styles.headerRight}>
          {data.query_smiles ? (
            <div className={styles.smilesChip}>
              <span className={styles.smilesChipLabel}>SMILES</span>
              <code className={styles.smilesCode}>{data.query_smiles}</code>
            </div>
          ) : (
            <div className={styles.smilesChip}>
              <span className={styles.smilesChipLabel}>Modality</span>
              <code className={styles.smilesCode}>{(data.chemical_structure.drug_type || "Biologic").replace(/_/g, " ")}</code>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabs} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            id={`tab-${tab.id}`}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.id === "resources" && unifiedSources.length > 0 && (
              <span
                style={{
                  marginLeft: "6px",
                  fontSize: "0.7rem",
                  padding: "1px 6px",
                  borderRadius: "9999px",
                  background: activeTab === "resources" ? "rgba(0, 82, 255, 0.12)" : "#f1f5f9",
                  color: activeTab === "resources" ? "#0052ff" : "#64748b",
                  fontWeight: 700,
                  transition: "all 0.15s ease",
                }}
              >
                {unifiedSources.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className={styles.body}>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className={styles.tabPanel} role="tabpanel" aria-labelledby="tab-overview">

            <section className={styles.section}>
              <SectionLabel>Drug Identity</SectionLabel>
              <table className={styles.metaTable}>
                <tbody>
                  {data.chemical_structure.drug_type && (
                    <tr>
                      <td className={styles.metaTableLabel}>Modality</td>
                      <td className={styles.metaTableValue}>
                        <strong style={{ textTransform: "capitalize" }}>
                          {data.chemical_structure.drug_type.replace(/_/g, " ")}
                        </strong>
                      </td>
                    </tr>
                  )}
                  {data.chemical_structure.biologic_class && (
                    <tr>
                      <td className={styles.metaTableLabel}>Biologic Class</td>
                      <td className={styles.metaTableValue}>
                        <strong>{data.chemical_structure.biologic_class}</strong>
                      </td>
                    </tr>
                  )}
                  {data.chemical_structure.target && (
                    <tr>
                      <td className={styles.metaTableLabel}>Primary Target</td>
                      <td className={styles.metaTableValue}>
                        <strong>{data.chemical_structure.target}</strong>
                      </td>
                    </tr>
                  )}
                  {data.chemical_structure.molecular_formula && (
                    <tr>
                      <td className={styles.metaTableLabel}>Formula</td>
                      <td className={`${styles.metaTableValue} text-mono`}>
                        <strong>{formatChemicalFormula(data.chemical_structure.molecular_formula)}</strong>
                      </td>
                    </tr>
                  )}
                  {data.chemical_structure.molecular_weight && (
                    <tr>
                      <td className={styles.metaTableLabel}>Molecular weight</td>
                      <td className={styles.metaTableValue}>
                        <strong>{data.chemical_structure.molecular_weight} g/mol</strong>
                      </td>
                    </tr>
                  )}
                  {data.chemical_structure.iupac_name && (
                    <tr>
                      <td className={styles.metaTableLabel}>IUPAC name</td>
                      <td className={styles.metaTableValue}>{data.chemical_structure.iupac_name}</td>
                    </tr>
                  )}
                  {data.chemical_structure.pubchem_cid && (
                    <tr>
                      <td className={styles.metaTableLabel}>PubChem CID</td>
                      <td className={styles.metaTableValue}>
                        <a
                          href={`https://pubchem.ncbi.nlm.nih.gov/compound/${data.chemical_structure.pubchem_cid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.tableLink}
                        >
                          {data.chemical_structure.pubchem_cid}
                        </a>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <div className={styles.divider} />

            <section className={styles.section}>
              <SectionLabel>Therapeutic Classes</SectionLabel>
              <InfoBlock
                label="Clinical & Pharmacological Classification"
                field={safeField(data.therapeutic_classes)}
                slug="classification"
                accentColor="indigo"
                onSelectCitation={setActiveCitation}
              />
            </section>

            <div className={styles.divider} />

            <section className={styles.section}>
              <SectionLabel>
                {data.chemical_structure.drug_type === "biologic"
                  ? "Biologic & Molecular Profile"
                  : "Molecular Structure"}
              </SectionLabel>
              <StructureViewer structure={data.chemical_structure} />
            </section>

          </div>
        )}

        {/* ── PHARMACOLOGY ── */}
        {activeTab === "pharmacodynamics" && (
          <div className={styles.tabPanel} role="tabpanel" aria-labelledby="tab-pharmacodynamics">
            <p className={styles.tabDescription}>
              How the drug interacts with biological targets at the molecular and cellular level.
            </p>

            <section className={styles.section}>
              <SectionLabel>Mechanism of Action</SectionLabel>
              <InfoBlock
                label="Mechanism of Action (Step-by-step)"
                field={safeField(pd.mechanism_of_action)}
                slug="mechanism_of_action"
                accentColor="teal"
              />
            </section>

            <div className={styles.divider} />

            <section className={styles.section}>
              <SectionLabel>Physiologic Effects</SectionLabel>
              <InfoBlock
                label="Physiologic Effect"
                field={safeField(pd.physiologic_effect)}
                slug="physiologic_effect"
                accentColor="teal"
              />
            </section>

            <div className={styles.divider} />

            <section className={styles.section}>
              <SectionLabel>Quantitative Parameters</SectionLabel>
              <div className={styles.pdGrid}>
                <InfoBlock
                  label="Binding Affinity (Kd / Ki)"
                  field={safeField(pd.binding_affinity)}
                  slug="binding_affinity"
                  accentColor="violet"
                />
                <InfoBlock
                  label="Selectivity"
                  field={safeField(pd.selectivity)}
                  slug="selectivity"
                  accentColor="violet"
                />
                <InfoBlock
                  label="Potency (EC₅₀ / ED₅₀)"
                  field={safeField(pd.potency)}
                  slug="potency"
                  accentColor="violet"
                />
                <InfoBlock
                  label="Efficacy (Emax)"
                  field={safeField(pd.efficacy)}
                  slug="efficacy"
                  accentColor="violet"
                />
              </div>
            </section>


          </div>
        )}

        {/* ── PHARMACOKINETICS ── */}
        {activeTab === "pharmacokinetics" && (
          <div className={styles.tabPanel} role="tabpanel" aria-labelledby="tab-pharmacokinetics">
            <p className={styles.tabDescription}>
              Pharmacokinetic profile — how the body absorbs, distributes, metabolizes, and excretes the drug.
            </p>

            <div className={styles.admeGrid}>
              <InfoBlock
                label="Absorption"
                field={data.adme.absorption}
                slug="absorption"
                accentColor="teal"
              />
              <InfoBlock
                label="Distribution"
                field={data.adme.distribution}
                slug="distribution"
                accentColor="teal"
              />
              <InfoBlock
                label="Metabolism"
                field={data.adme.metabolism}
                slug="metabolism"
                accentColor="teal"
              />
              <InfoBlock
                label="Excretion"
                field={data.adme.excretion}
                slug="excretion"
                accentColor="teal"
              />
            </div>

            {data.adme.cyp_profile && (
              <>
                <div className={styles.divider} />
                <section className={styles.section}>
                  <SectionLabel>Cytochrome P450 (CYP) Metabolism Profile</SectionLabel>
                  <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", padding: "14px 18px", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    {data.adme.cyp_profile.substrates.length > 0 && (
                      <div style={{ minWidth: "140px" }}>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "6px", fontWeight: 700 }}>SUBSTRATE FOR</span>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {data.adme.cyp_profile.substrates.map((c, i) => (
                            <span key={i} className="badge badge-accent">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {data.adme.cyp_profile.inhibitors.length > 0 && (
                      <div style={{ minWidth: "140px" }}>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "6px", fontWeight: 700 }}>INHIBITS</span>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {data.adme.cyp_profile.inhibitors.map((c, i) => (
                            <span key={i} className="badge badge-rose">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {data.adme.cyp_profile.inducers.length > 0 && (
                      <div style={{ minWidth: "140px" }}>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "6px", fontWeight: 700 }}>INDUCES</span>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {data.adme.cyp_profile.inducers.map((c, i) => (
                            <span key={i} className="badge badge-amber">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

          </div>
        )}

        {/* ── SAFETY ── */}
        {activeTab === "safety" && (
          <div className={styles.tabPanel} role="tabpanel" aria-labelledby="tab-safety">

            <section className={styles.section}>
              <SectionLabel>Therapeutic Profile</SectionLabel>
              <InfoBlock
                label="Indications"
                field={safeField(tp.indications)}
                slug="indications"
                accentColor="teal"
              />
              <InfoBlock
                label="Contraindications"
                field={safeField(tp.contraindications)}
                slug="contraindications"
                accentColor="rose"
              />
            </section>

            <div className={styles.divider} />

            <section className={styles.section}>
              <SectionLabel>Adverse Effects & Interactions</SectionLabel>
              <InfoBlock
                label="Adverse Effects"
                field={safeField(tp.adverse_effects)}
                slug="adverse_effects"
                accentColor="amber"
              />
              <InfoBlock
                label="Drug Interactions"
                field={safeField(tp.drug_interactions)}
                slug="drug_interactions"
                accentColor="amber"
              />
            </section>

            <div className={styles.divider} />

            <section className={styles.section}>
              <SectionLabel>Toxicology</SectionLabel>
              <div className={styles.toxGrid}>
                <InfoBlock
                  label="Acute Toxicity (LD50, LC50)"
                  field={safeField(tox.acute_toxicity)}
                  slug="acute_toxicity"
                  accentColor="rose"
                />
                <InfoBlock
                  label="Cytotoxicity (IC50, EC50, Cell Viability)"
                  field={safeField(tox.cytotoxicity)}
                  slug="cytotoxicity"
                  accentColor="rose"
                />
                <InfoBlock
                  label="Genetic Toxicology"
                  field={safeField(tox.genetic_toxicology)}
                  slug="genetic_toxicology"
                  accentColor="rose"
                />
                <InfoBlock
                  label="Hazard Classifications (GHS, IARC/NTP, EPA/ECHA)"
                  field={safeField(tox.hazard_classifications)}
                  slug="hazard_classifications"
                  accentColor="indigo"
                />
              </div>
            </section>

          </div>
        )}

        {/* ── HISTORY ── */}
        {activeTab === "history" && (
          <div className={styles.tabPanel} role="tabpanel" aria-labelledby="tab-history">
            <p className={styles.tabDescription}>
              The scientific and clinical journey from discovery to modern use.
            </p>

            <div className={styles.historyTimeline}>
              <div className={styles.historyStep}>
                <div className={styles.historyStepMarker}>
                  <span className={styles.historyStepIcon}>🔬</span>
                  <div className={styles.historyStepLine} />
                </div>
                <div className={styles.historyStepContent}>
                  <SectionLabel>Background</SectionLabel>
                  <InfoBlock
                    label="Medical Context & Unmet Need"
                    field={safeField(hist.background)}
                    slug="background"
                    accentColor="indigo"
                  />
                </div>
              </div>

              <div className={styles.historyStep}>
                <div className={styles.historyStepMarker}>
                  <span className={styles.historyStepIcon}>💡</span>
                  <div className={styles.historyStepLine} />
                </div>
                <div className={styles.historyStepContent}>
                  <SectionLabel>Discovery</SectionLabel>
                  <InfoBlock
                    label="Lead Compound Origin"
                    field={safeField(hist.discovery)}
                    slug="discovery"
                    accentColor="indigo"
                  />
                </div>
              </div>

              <div className={styles.historyStep}>
                <div className={styles.historyStepMarker}>
                  <span className={styles.historyStepIcon}>⚗️</span>
                  <div className={styles.historyStepLine} />
                </div>
                <div className={styles.historyStepContent}>
                  <SectionLabel>Development</SectionLabel>
                  <InfoBlock
                    label="Optimization, Preclinical & Patents"
                    field={safeField(hist.development)}
                    slug="development"
                    accentColor="indigo"
                  />
                </div>
              </div>

              <div className={styles.historyStep}>
                <div className={styles.historyStepMarker}>
                  <span className={styles.historyStepIcon}>🏥</span>
                </div>
                <div className={styles.historyStepContent}>
                  <SectionLabel>Clinical Trials</SectionLabel>
                  <InfoBlock
                    label="Phase I–III & Regulatory Approvals"
                    field={safeField(hist.clinical_trials)}
                    slug="clinical_trials"
                    accentColor="indigo"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── RESOURCES (NEW DEDICATED TAB) ── */}
        {activeTab === "resources" && (
          <div className={styles.tabPanel} role="tabpanel" aria-labelledby="tab-resources">
            <p className={styles.tabDescription}>
              Verified external database portals, peer-reviewed biomedical literature, FDA package inserts, and clinical registries consulted for {data.drug_name.generic}.
            </p>

            {/* Authoritative Database Portals (Quick Links) */}
            <section className={styles.section}>
              <SectionLabel>Authoritative Database Portals</SectionLabel>
              <div className={styles.quickLinksGrid}>
                {data.chemical_structure.pubchem_cid && (
                  <a
                    href={`https://pubchem.ncbi.nlm.nih.gov/compound/${data.chemical_structure.pubchem_cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.quickLinkCard}
                  >
                    <div className={styles.quickLinkIconWrap}>
                      🧬
                    </div>
                    <div className={styles.quickLinkText}>
                      <span className={styles.quickLinkTitle}>PubChem Compound</span>
                      <span className={styles.quickLinkSub}>CID: {data.chemical_structure.pubchem_cid}</span>
                    </div>
                    <svg className={styles.quickLinkExtIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )}

                <a
                  href={`https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(data.drug_name.generic)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.quickLinkCard}
                >
                  <div className={styles.quickLinkIconWrap}>
                    📋
                  </div>
                  <div className={styles.quickLinkText}>
                    <span className={styles.quickLinkTitle}>NIH DailyMed (FDA SPL)</span>
                    <span className={styles.quickLinkSub}>Official prescribing monograph</span>
                  </div>
                  <svg className={styles.quickLinkExtIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>

                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(data.drug_name.generic)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.quickLinkCard}
                >
                  <div className={styles.quickLinkIconWrap}>
                    📚
                  </div>
                  <div className={styles.quickLinkText}>
                    <span className={styles.quickLinkTitle}>PubMed Central (NCBI)</span>
                    <span className={styles.quickLinkSub}>Biomedical journal articles</span>
                  </div>
                  <svg className={styles.quickLinkExtIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>

                <a
                  href={`https://clinicaltrials.gov/search?term=${encodeURIComponent(data.drug_name.generic)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.quickLinkCard}
                >
                  <div className={styles.quickLinkIconWrap}>
                    🏥
                  </div>
                  <div className={styles.quickLinkText}>
                    <span className={styles.quickLinkTitle}>ClinicalTrials.gov</span>
                    <span className={styles.quickLinkSub}>Study protocols & registry</span>
                  </div>
                  <svg className={styles.quickLinkExtIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>

                <a
                  href={`https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=BasicSearch.process&searchTerm=${encodeURIComponent(data.drug_name.generic)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.quickLinkCard}
                >
                  <div className={styles.quickLinkIconWrap}>
                    🏛️
                  </div>
                  <div className={styles.quickLinkText}>
                    <span className={styles.quickLinkTitle}>Drugs@FDA (CDER)</span>
                    <span className={styles.quickLinkSub}>Regulatory approval history</span>
                  </div>
                  <svg className={styles.quickLinkExtIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </section>

            <div className={styles.divider} />

            {/* Consulted Citations & Evidence List */}
            <section className={styles.section}>
              <div className={styles.resourcesSectionHeader}>
                <div>
                  <SectionLabel>Consulted Evidence &amp; Specific Citations</SectionLabel>
                  <p className={styles.resourcesSectionDesc}>
                    {unifiedSources.length} literature and database documents directly ingested for this profile.
                  </p>
                </div>

                {/* Filter Pills */}
                {unifiedSources.length > 0 && (
                  <div className={styles.filterPillsRow}>
                    {["all", "PubMed", "DailyMed", "PubChem", "ClinicalTrials"].map((f) => {
                      const count = f === "all"
                        ? unifiedSources.length
                        : unifiedSources.filter((s) => s.tag === f).length;
                      if (f !== "all" && count === 0) return null;
                      return (
                        <button
                          key={f}
                          type="button"
                          className={`${styles.filterPill} ${resourceFilter === f ? styles.filterPillActive : ""}`}
                          onClick={() => setResourceFilter(f)}
                        >
                          {f === "all" ? "All Sources" : f} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {filteredSources.length > 0 ? (
                <div className={styles.resourcesGrid}>
                  {filteredSources.map((item) => (
                    <div
                      key={item.id}
                      className={styles.resourceCard}
                      onClick={() => {
                        if (item.citation.text) {
                          setActiveCitation(item.citation);
                        } else if (item.url) {
                          window.open(item.url, "_blank", "noopener,noreferrer");
                        }
                      }}
                      title={item.citation.text ? "Click to view retrieved passage excerpt" : item.url || item.title}
                    >
                      <div className={styles.resourceCardHeader}>
                        <span className={styles.resourceIndex}>#{item.num}</span>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.resourceCardExtLink}
                            onClick={(e) => e.stopPropagation()}
                            title="Open external URL in new tab"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        )}
                      </div>

                      <h4 className={styles.resourceCardTitle} title={item.title}>
                        {item.title}
                      </h4>

                      {item.sections.length > 0 && (
                        <div className={styles.resourceCardSections}>
                          <span className={styles.resourceCardSectionsLabel}>Referenced in:</span>
                          <div className={styles.resourceCardSectionTags}>
                            {item.sections.map((sec, idx) => (
                              <span key={idx} className={styles.resourceSectionPill}>
                                {sec}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className={styles.resourceCardActions}>
                        {item.citation.text ? (
                          <button
                            type="button"
                            className={styles.resourceCardExcerptBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCitation(item.citation);
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                            </svg>
                            View Retrieved Excerpt
                          </button>
                        ) : (
                          <span className={styles.resourceCardNoExcerpt}>Database Record</span>
                        )}

                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.resourceCardVisitBtn}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Visit Database ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyResourcesBox}>
                  <p className={styles.emptyResourcesText}>
                    No specific literature or regulatory records match this filter.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}

      </div>

      {/* ── Disclaimer ── */}
      <div className={styles.disclaimer}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 4v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {data.disclaimer}
      </div>

      {/* ── Footer ── */}
      <div className={styles.footer}>
        <span className={styles.footerText}>
          Generated {new Date(data.generated_at).toLocaleString()}
        </span>
        <span
          role="button"
          tabIndex={0}
          className={styles.footerExportLink}
          onClick={handleExportMonograph}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleExportMonograph();
            }
          }}
          id="footer-export-monograph"
        >
          Export Monograph
        </span>
      </div>

      <CitationModal citation={activeCitation} onClose={() => setActiveCitation(null)} />
    </div>
  );
}
