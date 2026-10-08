"use client";

import { useState, useCallback } from "react";
import type { ChatMessage, DrugInfo } from "@/lib/types";
import { queryDrugStream } from "@/lib/api";
import SMILESInput from "@/components/SMILESInput";
import ChatInterface from "@/components/ChatInterface";
import PDFDropzone from "@/components/PDFDropzone";
import DrugComparisonModal from "@/components/DrugComparisonModal";
import styles from "./page.module.css";


export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string>("");
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const drugInfos = messages.filter((m) => m.drugInfo).map((m) => m.drugInfo as DrugInfo);

  const handleQuery = useCallback(async (queryStr: string) => {
    if (loading) return;

    // Check if query is a SMILES or common chemical query vs a conversational question
    const isSmilesOrDrug = queryStr.length < 80 && !queryStr.includes("?") && !queryStr.toLowerCase().startsWith("what") && !queryStr.toLowerCase().startsWith("how") && !queryStr.toLowerCase().startsWith("why") && !queryStr.toLowerCase().startsWith("can") && !queryStr.toLowerCase().startsWith("is");

    if (isSmilesOrDrug) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        smiles: queryStr,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setStreamStatus("Initializing local query...");

      let finalData: any = null;
      let errorMessage: string | null = null;

      await queryDrugStream(queryStr, {
        onStatus: (status) => {
          setStreamStatus(status.message);
        },
        onToken: () => {
          setStreamStatus("Streaming tokens from local LLM...");
        },
        onResult: (data) => {
          finalData = data;
        },
        onError: (err) => {
          errorMessage = err;
        },
      });

      setLoading(false);
      setStreamStatus("");

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        drugInfo: finalData || undefined,
        error: errorMessage || (finalData ? undefined : "Network error — could not connect to local backend."),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } else {
      // Conversational Q&A mode
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: queryStr,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setStreamStatus("Searching knowledge base & generating answer...");

      const history = messages
        .filter((m) => m.text || m.smiles)
        .map((m) => ({ role: m.role, content: m.text || `Drug query: ${m.smiles}` }));

      const { sendChatMessage } = await import("@/lib/api");
      const res = await sendChatMessage(queryStr, history);

      setLoading(false);
      setStreamStatus("");

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: res.success ? res.answer : undefined,
        error: res.success ? undefined : res.error || "Could not generate answer.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    }
  }, [loading, messages]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setStreamStatus("");
  }, []);

  return (
    <div className={styles.layout}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="pharmerPillTop" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="pharmerPillBottom" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
              </defs>
              
              <g transform="rotate(-35 12 12)">
                <path d="M7 11.5V7A5 5 0 0 1 17 7V11.5H7Z" fill="url(#pharmerPillTop)" />
                <path d="M7 12.5V17A5 5 0 0 0 17 17V12.5H7Z" fill="url(#pharmerPillBottom)" />
                <rect x="6.5" y="11.25" width="11" height="1.5" fill="#0f131a" rx="0.75" />
              </g>
            </svg>
          </div>
          <div>
            <h1 className={styles.logoTitle}>Pharmer</h1>
            <p className={styles.logoSub}>Local AI Drug Workbench</p>
          </div>
        </div>

        <nav className={styles.nav}>
          <div className={styles.newChatWrap}>
            <button
              type="button"
              className={styles.newChatBtn}
              onClick={handleNewChat}
              aria-label="Start new query thread"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>New Query</span>
            </button>
          </div>

          <PDFDropzone />
        </nav>

        <div className={styles.sidebarFooter}>
          <p>100% Offline Local Engine</p>
          <p>Educational use only — Not clinical advice</p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className={styles.main} id="main-content">
        {/* Top bar */}
        <div className={styles.topbar}>
          <h2 className={styles.topbarTitle}>Pharmacology Intelligence Assistant</h2>
          {drugInfos.length >= 2 && (
            <button
              type="button"
              style={{
                padding: "6px 14px",
                background: "rgba(56, 189, 248, 0.15)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "6px",
                color: "#38bdf8",
                fontSize: "0.82rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
              onClick={() => setCompareModalOpen(true)}
            >
              ⚖️ Compare Drug Candidates ({drugInfos.length})
            </button>
          )}
        </div>

        {/* Input area */}
        <div className={styles.inputArea}>
          <SMILESInput onSubmit={handleQuery} loading={loading} />
        </div>

        {/* Chat thread */}
        <div className={styles.chatArea}>
          <ChatInterface messages={messages} loading={loading} streamStatus={streamStatus} />
        </div>

        {/* Comparison Modal */}
        {compareModalOpen && drugInfos.length >= 2 && (
          <DrugComparisonModal
            leftDrug={drugInfos[0]}
            rightDrug={drugInfos[1]}
            onClose={() => setCompareModalOpen(false)}
          />
        )}
      </main>
    </div>
  );
}
