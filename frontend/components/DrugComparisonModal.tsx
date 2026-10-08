"use client";

import styles from "./DrugComparisonModal.module.css";
import type { DrugInfo } from "@/lib/types";

interface Props {
  leftDrug: DrugInfo | null;
  rightDrug: DrugInfo | null;
  onClose: () => void;
}

export default function DrugComparisonModal({ leftDrug, rightDrug, onClose }: Props) {
  if (!leftDrug || !rightDrug) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.icon}>⚖️</span>
            <div>
              <h3 className={styles.title}>Comparative Pharmacology Analysis</h3>
              <p className={styles.subTitle}>
                Side-by-side evaluation of {leftDrug.drug_name.generic} vs. {rightDrug.drug_name.generic}
              </p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.grid}>
            {/* Left Column */}
            <div className={styles.col}>
              <div className={styles.colHeader}>
                <h4>{leftDrug.drug_name.generic}</h4>
                <code>{leftDrug.query_smiles}</code>
              </div>

              <div className={styles.section}>
                <h5>Mechanism of Action</h5>
                <p>{leftDrug.pharmacodynamics.mechanism_of_action.content || "Data unavailable"}</p>
              </div>

              <div className={styles.section}>
                <h5>ADME Profile</h5>
                <p><strong>Absorption:</strong> {leftDrug.adme.absorption.content || "N/A"}</p>
                <p><strong>Metabolism:</strong> {leftDrug.adme.metabolism.content || "N/A"}</p>
                <p><strong>Excretion:</strong> {leftDrug.adme.excretion.content || "N/A"}</p>
              </div>

              <div className={styles.section}>
                <h5>Safety & Toxicity</h5>
                <p>{leftDrug.toxicology.acute_toxicity.content || "No acute toxicity data"}</p>
              </div>
            </div>

            <div className={styles.divider} />

            {/* Right Column */}
            <div className={styles.col}>
              <div className={styles.colHeader}>
                <h4>{rightDrug.drug_name.generic}</h4>
                <code>{rightDrug.query_smiles}</code>
              </div>

              <div className={styles.section}>
                <h5>Mechanism of Action</h5>
                <p>{rightDrug.pharmacodynamics.mechanism_of_action.content || "Data unavailable"}</p>
              </div>

              <div className={styles.section}>
                <h5>ADME Profile</h5>
                <p><strong>Absorption:</strong> {rightDrug.adme.absorption.content || "N/A"}</p>
                <p><strong>Metabolism:</strong> {rightDrug.adme.metabolism.content || "N/A"}</p>
                <p><strong>Excretion:</strong> {rightDrug.adme.excretion.content || "N/A"}</p>
              </div>

              <div className={styles.section}>
                <h5>Safety & Toxicity</h5>
                <p>{rightDrug.toxicology.acute_toxicity.content || "No acute toxicity data"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.actionBtn} onClick={onClose}>
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
