import { useState } from "react";
import type { DrugInfo, FieldValue, Citation } from "@/lib/types";
import StructureViewer from "./StructureViewer";
import CitationBadge from "./CitationBadge";
import CitationModal from "./CitationModal";
import styles from "./DrugInfoCard.module.css";

type Tab = "overview" | "pharmacodynamics" | "pharmacokinetics" | "safety" | "history";

interface Props {
  data: DrugInfo;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",          label: "Overview" },
  { id: "pharmacodynamics",  label: "Pharmacology" },
  { id: "pharmacokinetics",  label: "Pharmacokinetics" },
  { id: "safety",            label: "Safety" },
  { id: "history",           label: "Evidence" },
];

const MISSING_MESSAGES: { [key: string]: string } = {
  indications: "No indication evidence was retrieved for this field.",
  contraindications: "No contraindication evidence was retrieved for this field.",
  adverse_effects: "No adverse-effect evidence was retrieved for this field.",
  drug_interactions: "No interaction evidence was retrieved for this field.",
  mechanism_of_action: "No mechanism evidence was retrieved for this field.",
  physiologic_effect: "No physiologic-effect evidence was retrieved for this field.",
  binding_affinity: "No binding-affinity evidence was retrieved. This does not mean no measurements exist in the literature.",
  selectivity: "No selectivity evidence was retrieved for this field.",
  potency: "No potency evidence was retrieved. This does not mean no measurements exist in the literature.",
  efficacy: "No efficacy evidence was retrieved for this field.",
  absorption: "No absorption evidence was retrieved for this field.",
  distribution: "No distribution evidence was retrieved for this field.",
  metabolism: "No metabolism evidence was retrieved for this field.",
  excretion: "No excretion evidence was retrieved for this field.",
  acute_toxicity: "No acute-toxicity evidence was retrieved for this field.",
  cytotoxicity: "No cytotoxicity evidence was retrieved for this field.",
  genetic_toxicology: "No genetic-toxicology evidence was retrieved for this field.",
  hazard_classifications: "No hazard-classification evidence was retrieved for this field.",
  background: "No background evidence was retrieved for this field.",
  discovery: "No discovery evidence was retrieved for this field.",
  development: "No development evidence was retrieved for this field.",
  clinical_trials: "No trial evidence was retrieved for this field.",
  classification: "No classification evidence was retrieved for this field."
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
  const sources = field?.sources || [];
  const missingText = MISSING_MESSAGES[slug] || "No clinical details found in current ingested sources.";

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
            <span className={`badge badge-amber ${styles.missingBadge}`}>
              Not retrieved
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
          {sources.length > 0 && <CitationBadge citations={sources} onSelectCitation={onSelectCitation} />}
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

// ── Main card ─────────────────────────────────────────────────────────────────

export default function DrugInfoCard({ data }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

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
          <div className={styles.smilesChip}>
            <span className={styles.smilesChipLabel}>SMILES</span>
            <code className={styles.smilesCode}>{data.query_smiles}</code>
          </div>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExportMonograph}
            title="Download structured Markdown monograph report"
          >
            📥 Export Monograph
          </button>
          <CitationBadge citations={data.drug_name.sources} onSelectCitation={setActiveCitation} />
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
            {tab.label}
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
              <SectionLabel>Molecular Structure</SectionLabel>
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
        <span className="badge badge-teal">Pharmer</span>
      </div>

      <CitationModal citation={activeCitation} onClose={() => setActiveCitation(null)} />
    </div>
  );
}
