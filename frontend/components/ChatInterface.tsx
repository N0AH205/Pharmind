"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import type { ChatMessage } from "@/lib/types";
import DrugInfoCard from "./DrugInfoCard";
import styles from "./ChatInterface.module.css";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  streamStatus?: string;
}

export default function ChatInterface({ messages, loading, streamStatus }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon} aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="8" stroke="var(--accent-primary)" strokeWidth="1.5" />
            <circle cx="8" cy="16" r="4" stroke="var(--accent-primary)" strokeWidth="1.5" strokeOpacity="0.5" />
            <circle cx="40" cy="16" r="4" stroke="var(--accent-primary)" strokeWidth="1.5" strokeOpacity="0.5" />
            <circle cx="8" cy="32" r="4" stroke="var(--accent-primary)" strokeWidth="1.5" strokeOpacity="0.5" />
            <circle cx="40" cy="32" r="4" stroke="var(--accent-primary)" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="16" y1="20" x2="12" y2="18" stroke="var(--accent-primary)" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="32" y1="20" x2="36" y2="18" stroke="var(--accent-primary)" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="16" y1="28" x2="12" y2="30" stroke="var(--accent-primary)" strokeWidth="1.5" strokeOpacity="0.5" />
            <line x1="32" y1="28" x2="36" y2="30" stroke="var(--accent-primary)" strokeWidth="1.5" strokeOpacity="0.5" />
          </svg>
        </div>
        <h2 className={styles.emptyTitle}>Start a drug query</h2>
        <p className={styles.emptyDesc}>
          Enter a drug name, SMILES notation, or PubChem CID to retrieve available pharmacological information.
        </p>
        <div className={styles.emptyHints}>
          <span className={styles.hint}>
            <span className={styles.hintDot} />
            Responses are grounded in cited sources.
          </span>
          <span className={styles.hint}>
            <span className={styles.hintDot} />
            Missing information is explicitly flagged.
          </span>
          <span className={styles.hint}>
            <span className={styles.hintDot} />
            Educational use only — not clinical advice.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.thread}>
      {messages.map((msg) => (
        <div key={msg.id} className={styles.message}>
          {msg.role === "user" && (
            <div className={styles.userBubble}>
              <div className={styles.userAvatar} aria-label="You">You</div>
              <div className={styles.userContent}>
                <span className={styles.userLabel}>{msg.smiles ? "Drug query" : "Question"}</span>
                {msg.smiles ? (
                  <code className={styles.userSmiles}>{msg.smiles}</code>
                ) : (
                  <p className={styles.line}>{msg.text}</p>
                )}
              </div>
            </div>
          )}

          {msg.role === "assistant" && msg.text && (
            <div className={styles.assistantBubble}>
              <div className={styles.assistantAvatar} aria-label="Pharmind">
                <Image src="/pharmind-logo.png" alt="Pharmind" width={22} height={22} style={{ objectFit: "contain" }} />
              </div>
              <div className={styles.assistantContent}>
                <div className={styles.assistantTextCard}>
                  <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: "0.93rem", lineHeight: "1.65", color: "#1f2937" }}>
                    {msg.text}
                  </p>
                </div>
              </div>
            </div>
          )}

          {msg.role === "assistant" && msg.drugInfo && (
            <div className={styles.assistantBubble}>
              <div className={styles.assistantAvatar} aria-label="Pharmind">
                <Image src="/pharmind-logo.png" alt="Pharmind" width={22} height={22} style={{ objectFit: "contain" }} />
              </div>
              <div className={styles.assistantContent}>
                <DrugInfoCard data={msg.drugInfo} />
              </div>
            </div>
          )}

          {msg.role === "assistant" && msg.error && (
            <div className={styles.errorBubble}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="var(--color-error)" strokeWidth="1.2" />
                <path d="M8 4v5M8 11v1" stroke="var(--color-error)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              {msg.error}
            </div>
          )}
        </div>
      ))}

      {loading && (
        <div className={styles.loadingBubble}>
          <div className={styles.assistantAvatar} aria-hidden="true">
            <Image src="/pharmer-logo.png" alt="" width={28} height={11} />
          </div>
          <div className={styles.loadingContent}>
            <div className={styles.loadingDots}>
              <span /><span /><span />
            </div>
            <span className={styles.loadingText}>
              {streamStatus || "Retrieving drug information…"}
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
