"use client";

import { useState, useRef } from "react";
import { uploadPDF } from "@/lib/api";
import styles from "./PDFDropzone.module.css";

export default function PDFDropzone() {
  const [drugName, setDrugName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setStatus("Only PDF files are supported.");
      setIsError(true);
      return;
    }

    setUploading(true);
    setStatus(`Ingesting '${file.name}'...`);
    setIsError(false);

    try {
      const res = await uploadPDF(file, drugName);
      if (res.success) {
        setStatus(`Successfully indexed ${res.data.chunks_stored} passages from ${file.name}`);
        setIsError(false);
      } else {
        setStatus(res.error || "Failed to index PDF.");
        setIsError(true);
      }
    } catch (e: any) {
      setStatus(e.message || "Failed to upload file.");
      setIsError(true);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.dropzone}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
          }
        }}
      >
        <input
          type="file"
          accept=".pdf"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />
        <div className={styles.icon}>📄</div>
        <div className={styles.textGroup}>
          <span className={styles.title}>Ingest Literature PDF</span>
          <span className={styles.sub}>Drop lab reports or papers to index into ChromaDB</span>
        </div>
      </div>

      <label className={styles.sub}>
        Associate with compound name (optional)
        <input
          value={drugName}
          onChange={(event) => setDrugName(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          placeholder="Use the same name as your query"
          className={styles.drugNameInput}
          aria-label="Compound name for uploaded literature"
        />
      </label>

      {status && (
        <div className={`${styles.status} ${isError ? styles.statusError : styles.statusSuccess}`}>
          {uploading && <span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />}
          {status}
        </div>
      )}
    </div>
  );
}
