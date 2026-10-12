"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import type { ChatMessage, ChatSource } from "@/lib/types";
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
                <AssistantTextCard msg={msg} />
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

function cleanUrl(url?: string): string {
  if (!url) return "";
  const m = url.match(/pug_view\/data\/compound\/(\d+)\/JSON(?:\?heading=([^&#]+))?/i);
  if (m) {
    const cid = m[1];
    const heading = m[2];
    if (heading) {
      return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=${heading}`;
    }
    return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;
  }
  return url;
}

function parseSourcesAndText(rawText: string, initialSources?: ChatSource[]) {
  let text = rawText || "";
  let sources: ChatSource[] = (initialSources || []).map((s) => ({
    ...s,
    url: cleanUrl(s.url),
  }));

  // Robust splitting on "Sources" or "References" header
  const sourcesHeaderRegex = /(?:\r?\n)+\s*(?:Sources|References):?\s*(?:\r?\n)+/i;
  const parts = text.split(sourcesHeaderRegex);

  if (parts.length > 1) {
    text = parts[0].trim();
    const blockText = parts.slice(1).join("\n");

    // If initialSources was not provided or empty, parse lines from the block
    if (sources.length === 0) {
      const lines = blockText.split(/\r?\n/);
      const sidMap: Record<string, number> = {};

      lines.forEach((line) => {
        const lineMatch = line.match(
          /\[(?:SOURCE_)?(\d+)\]\s*([^—–-]+?)\s*[—–-]\s*(https?:\/\/\S+)/i
        );
        if (lineMatch) {
          const rawNum = lineMatch[1];
          const rawName = lineMatch[2].trim();
          const rawUrl = lineMatch[3].trim();
          const sid = `SOURCE_${rawNum}`.toUpperCase();
          const num = sources.length + 1;
          sidMap[sid] = num;
          sources.push({
            id: sid,
            num,
            name: rawName.replace(/PUG View\s*/i, "").trim(),
            url: cleanUrl(rawUrl),
          });
        }
      });

      // Replace any [SOURCE_X] in the prose with the sequential [num]
      if (Object.keys(sidMap).length > 0) {
        text = text.replace(
          /\[\s*(SOURCE_\d+(?:\s*,\s*SOURCE_\d+)*)\s*\]/gi,
          (m, inner) => {
            const sids = inner.match(/SOURCE_\d+/gi) || [];
            const nums = sids
              .map((s: string) => sidMap[s.toUpperCase()])
              .filter(Boolean);
            return nums.length > 0 ? `[${nums.join(", ")}]` : "";
          }
        );
      }
    }
  }

  // Also replace any remaining [SOURCE_X] with [X]
  text = text.replace(/\[\s*SOURCE_(\d+)\s*\]/gi, "[$1]");

  return { text, sources };
}

function renderInlineWithFormatting(str: string, baseKey: string) {
  const chunks = str.split(/(\*\*[^*]+\*\*)/g);
  return chunks.map((chunk, cIdx) => {
    if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) {
      return (
        <strong key={`${baseKey}-b-${cIdx}`} style={{ fontWeight: 650, color: "#111827" }}>
          {chunk.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${baseKey}-t-${cIdx}`}>{chunk}</span>;
  });
}

function FormattedProse({
  text,
  sources,
}: {
  text: string;
  sources: ChatSource[];
}) {
  const normalizedText = text.replace(/([^\n])\s*([*•-])\s+(\*\*|[A-Z])/g, "$1\n\n$2 $3");
  const paragraphs = normalizedText.split(/\n\n+/).filter(Boolean);

  const renderSegment = (segText: string, pIdx: number) => {
    const parts = segText.split(/(\[\s*\d+(?:\s*,\s*\d+)*\s*\])/g);

    return parts.map((part, idx) => {
      const match = part.match(/^\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]$/);
      if (match) {
        const nums = match[1]
          .split(",")
          .map((n) => parseInt(n.trim(), 10))
          .filter((n) => !isNaN(n));

        return (
          <span key={`cite-grp-${pIdx}-${idx}`} className={styles.citationGroup}>
            {nums.map((num) => {
              const src = sources.find((s) => s.num === num);
              const targetUrl = src?.url || `#source-${num}`;
              return (
                <a
                  key={`cite-${num}`}
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.citationPill}
                  title={src ? `${src.name}\n${src.url}` : `Citation [${num}]`}
                  onClick={(e) => {
                    if (!src?.url) {
                      e.preventDefault();
                      document
                        .getElementById(`source-${num}`)
                        ?.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                >
                  {num}
                </a>
              );
            })}
          </span>
        );
      }
      return (
        <span key={`text-${pIdx}-${idx}`}>
          {renderInlineWithFormatting(part, `p-${pIdx}-${idx}`)}
        </span>
      );
    });
  };

  return (
    <div>
      {paragraphs.map((p, pIdx) => {
        const isBullet = /^[*•-]\s+/.test(p);
        const cleanP = isBullet ? p.replace(/^[*•-]\s+/, "") : p;
        if (isBullet) {
          return (
            <div key={pIdx} className={styles.proseBulletItem}>
              <span className={styles.bulletDot}>•</span>
              <div style={{ flex: 1 }}>{renderSegment(cleanP, pIdx)}</div>
            </div>
          );
        }
        return (
          <p key={pIdx} className={styles.proseParagraph}>
            {renderSegment(cleanP, pIdx)}
          </p>
        );
      })}
    </div>
  );
}

function AssistantTextCard({ msg }: { msg: ChatMessage }) {
  const { text, sources } = parseSourcesAndText(msg.text || "", msg.sources);

  return (
    <div className={styles.assistantTextCard}>
      <FormattedProse text={text} sources={sources} />

      {sources.length > 0 && (
        <div className={styles.sourcesContainer}>
          <div className={styles.sourcesHeader}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span className={styles.sourcesTitle}>Sources</span>
            <span className={styles.sourcesCount}>{sources.length}</span>
          </div>

          <div className={styles.sourcesGrid}>
            {sources.map((src) => {
              const isPubMed = src.url.toLowerCase().includes("pubmed.ncbi.nlm.nih.gov");
              const isPubChem = src.url.toLowerCase().includes("pubchem.ncbi.nlm.nih.gov");
              const badgeLabel = isPubMed ? "PubMed" : isPubChem ? "PubChem" : "Literature";

              return (
                <a
                  key={src.num}
                  id={`source-${src.num}`}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.sourceCard}
                  title={src.url}
                >
                  <span className={styles.sourceNum}>{src.num}</span>
                  <div className={styles.sourceInfo}>
                    <div className={styles.sourceMeta}>
                      <span
                        className={
                          isPubMed
                            ? styles.badgePubMed
                            : isPubChem
                            ? styles.badgePubChem
                            : styles.badgeDefault
                        }
                      >
                        {badgeLabel}
                      </span>
                      <span className={styles.sourceName}>{src.name}</span>
                    </div>
                    <span className={styles.sourceUrl}>{src.url}</span>
                  </div>
                  <svg
                    className={styles.sourceIcon}
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="7" y1="17" x2="17" y2="7" />
                    <polyline points="7 7 17 7 17 17" />
                  </svg>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
