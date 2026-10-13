import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./CitationModal.module.css";
import type { Citation } from "@/lib/types";

interface Props {
  citation: Citation | null;
  onClose: () => void;
}

export default function CitationModal({ citation, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!citation || !mounted) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.icon}>📜</span>
            <div>
              <h3 className={styles.title}>{citation.source}</h3>
              {citation.url && (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.urlLink}
                >
                  {citation.url} ↗
                </a>
              )}
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {(citation.authors || citation.journal || citation.publication_date || citation.doi || citation.pmid || citation.document_id) && (
            <div className={styles.metadata}>
              {[citation.authors, citation.journal, citation.publication_date, citation.pmid && `PMID ${citation.pmid}`, citation.doi && `DOI ${citation.doi}`, citation.document_id && `Record ${citation.document_id}`]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
          <h4 className={styles.subTitle}>Retrieved Source Passage</h4>
          <div className={styles.passageContainer}>
            {citation.text ? (
              <p className={styles.passageText}>{citation.text}</p>
            ) : (
              <p className={styles.noText}>Full text preview unavailable for this external source label.</p>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.actionBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
