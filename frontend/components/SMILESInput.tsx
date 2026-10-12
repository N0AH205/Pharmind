"use client";

import { useState, type FormEvent } from "react";
import styles from "./SMILESInput.module.css";
import MoleculeDrawerModal from "./MoleculeDrawerModal";

interface Props {
  onSubmit: (smiles: string) => void;
  loading: boolean;
}

const EXAMPLE_SMILES = [
  { label: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
  { label: "Caffeine", smiles: "Cn1cnc2c1c(=O)n(c(=O)n2C)C" },
  { label: "Ibuprofen", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O" },
  { label: "Paracetamol", smiles: "CC(=O)Nc1ccc(O)cc1" },
];

export default function SMILESInput({ onSubmit, loading }: Props) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && !loading) onSubmit(trimmed);
  }

  function loadExample(smiles: string) {
    setValue(smiles);
  }

  const isValid = value.trim().length > 0;

  return (
    <div className={styles.wrapper}>
      <form onSubmit={handleSubmit} className={styles.form} id="smiles-query-form">
        <div className={`${styles.inputWrap} ${focused ? styles.focused : ""}`}>
          <div className={styles.inputRow}>
            <div className={styles.inputIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <circle cx="4" cy="6" r="2" />
                <circle cx="20" cy="6" r="2" />
                <circle cx="4" cy="18" r="2" />
                <circle cx="20" cy="18" r="2" />
                <line x1="9.5" y1="10.5" x2="6" y2="7.5" />
                <line x1="14.5" y1="10.5" x2="18" y2="7.5" />
                <line x1="9.5" y1="13.5" x2="6" y2="16.5" />
                <line x1="14.5" y1="13.5" x2="18" y2="16.5" />
              </svg>
            </div>
            <input
              id="smiles-input"
              type="text"
              className={styles.input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Give me a drug name, SMILES, or research question..."
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              aria-label="Drug query input"
              disabled={loading}
            />
            {value && !loading && (
              <button type="button" className={styles.clearBtn} onClick={() => setValue("")} aria-label="Clear input">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          <div className={styles.composerToolbar}>
            <span className={styles.inputHelper}>Drug name · SMILES · PubChem CID · research question</span>
            <div className={styles.composerActions}>
              <button
                type="button"
                className={styles.drawBtn}
                onClick={() => setIsDrawerOpen(true)}
                disabled={loading}
                title="Open visual molecule drawer"
                aria-label="Draw chemical structure visually"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span>Draw</span>
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={!isValid || loading}
                id="smiles-submit-btn"
                aria-label="Query drug"
              >
                {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Research
                </>}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Quick examples */}
      <div className={styles.examples}>
        <span className={styles.examplesLabel}>Try an example:</span>
        <div className={styles.exampleChips}>
          {EXAMPLE_SMILES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className={styles.chip}
              onClick={() => loadExample(ex.smiles)}
              disabled={loading}
              aria-label={`Load ${ex.label} example`}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Molecule Drawer Modal */}
      <MoleculeDrawerModal
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onApply={(smiles) => setValue(smiles)}
        initialSmiles={value}
      />
    </div>
  );
}
