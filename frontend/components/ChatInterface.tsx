"use client";

import { useRef, useEffect } from "react";
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
              <div className={styles.assistantAvatar} aria-label="Pharmer">
                💬
              </div>
              <div className={styles.assistantContent}>
                <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: "0.92rem", lineHeight: "1.6" }}>
                  {msg.text}
                </p>
              </div>
            </div>
          )}

          {msg.role === "assistant" && msg.drugInfo && (
            <div className={styles.assistantBubble}>
              <div className={styles.assistantAvatar} aria-label="Pharmer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="avatarPillTop" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                    <linearGradient id="avatarPillBottom" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#0284c7" />
                    </linearGradient>
                  </defs>
                  <g transform="rotate(-35 12 12)">
                    <path d="M7 11.5V7A5 5 0 0 1 17 7V11.5H7Z" fill="url(#avatarPillTop)" />
                    <path d="M7 12.5V17A5 5 0 0 0 17 17V12.5H7Z" fill="url(#avatarPillBottom)" />
                    <rect x="6.5" y="11.25" width="11" height="1.5" fill="#0f131a" rx="0.75" />
                  </g>
                </svg>
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="var(--accent-primary)" />
              <circle cx="2" cy="4" r="1.5" fill="var(--accent-primary)" fillOpacity="0.5" />
              <circle cx="14" cy="4" r="1.5" fill="var(--accent-primary)" fillOpacity="0.5" />
            </svg>
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
