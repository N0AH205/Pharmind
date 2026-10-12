"use client";

import { useState, useCallback, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ChatMessage, ChatSession, DrugInfo } from "@/lib/types";
import { queryDrugStream } from "@/lib/api";
import ChatInterface from "@/components/ChatInterface";
import PDFDropzone from "@/components/PDFDropzone";
import DrugComparisonModal from "@/components/DrugComparisonModal";
import MoleculeDrawerModal from "@/components/MoleculeDrawerModal";
import styles from "./chat.module.css";

interface Props {
  initialQuery?: string;
}

export default function ChatWorkspace({ initialQuery = "" }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string>("");
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Load saved sessions on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pharmind_chat_sessions_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSessions(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to load chat sessions:", e);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  // Sync sessions to localStorage whenever sessions change (after hydration)
  useEffect(() => {
    if (!hasHydrated) return;
    try {
      localStorage.setItem("pharmind_chat_sessions_v1", JSON.stringify(sessions));
    } catch (e) {
      console.warn("Failed to save chat sessions:", e);
    }
  }, [sessions, hasHydrated]);

  const drugInfos = messages.filter((m) => m.drugInfo).map((m) => m.drugInfo as DrugInfo);
  const hasStarted = messages.length > 0 || loading;

  const handleQuery = useCallback(async (queryStr: string) => {
    if (loading) return;
    const trimmed = queryStr.trim();
    if (!trimmed) return;

    let currentSessionId = activeSessionIdRef.current;
    const isNewSession = !currentSessionId;
    if (isNewSession) {
      currentSessionId = `sess-${Date.now()}`;
      setActiveSessionId(currentSessionId);
      activeSessionIdRef.current = currentSessionId;
    }

    const titleCandidate = trimmed.length > 30 ? trimmed.slice(0, 28).trim() + "…" : trimmed;

    // Check if query is a SMILES or common chemical query vs a conversational question
    const isSmilesOrDrug =
      trimmed.length < 80 &&
      !trimmed.includes("?") &&
      !trimmed.toLowerCase().startsWith("what") &&
      !trimmed.toLowerCase().startsWith("how") &&
      !trimmed.toLowerCase().startsWith("why") &&
      !trimmed.toLowerCase().startsWith("can") &&
      !trimmed.toLowerCase().startsWith("is");

    if (isSmilesOrDrug) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        smiles: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setSessions((prev) => {
        if (isNewSession) {
          const newSession: ChatSession = {
            id: currentSessionId!,
            title: titleCandidate,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [userMsg],
          };
          return [newSession, ...prev.filter((s) => s.id !== currentSessionId)];
        } else {
          return prev.map((s) =>
            s.id === currentSessionId
              ? { ...s, updatedAt: Date.now(), messages: [...s.messages, userMsg] }
              : s
          );
        }
      });

      setLoading(true);
      setStreamStatus("Initializing local query...");

      let finalData: any = null;
      let errorMessage: string | null = null;
      let generatedCharacters = 0;

      await queryDrugStream(trimmed, {
        onStatus: (status) => {
          setStreamStatus(status.message);
        },
        onToken: (fragment) => {
          generatedCharacters += fragment.length;
          if (generatedCharacters % 200 < fragment.length) {
            setStreamStatus(
              `Generating structured profile locally… ${generatedCharacters.toLocaleString()} characters received`
            );
          }
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
        timestamp: new Date().toISOString(),
      };

      if (activeSessionIdRef.current === currentSessionId) {
        setMessages((prev) => [...prev, assistantMsg]);
      }
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== currentSessionId) return s;
          const refinedTitle = finalData?.drug_name?.generic || s.title || titleCandidate;
          return {
            ...s,
            title: refinedTitle,
            updatedAt: Date.now(),
            messages: [...s.messages, assistantMsg],
          };
        })
      );
    } else {
      // Conversational Q&A mode
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setSessions((prev) => {
        if (isNewSession) {
          const newSession: ChatSession = {
            id: currentSessionId!,
            title: titleCandidate,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [userMsg],
          };
          return [newSession, ...prev.filter((s) => s.id !== currentSessionId)];
        } else {
          return prev.map((s) =>
            s.id === currentSessionId
              ? { ...s, updatedAt: Date.now(), messages: [...s.messages, userMsg] }
              : s
          );
        }
      });

      setLoading(true);
      setStreamStatus("Searching knowledge base & generating answer...");

      const history = messages
        .filter((m) => m.text || m.smiles || m.drugInfo)
        .map((m) => ({
          role: m.role,
          content:
            m.text ||
            (m.smiles
              ? `Drug query: ${m.smiles}`
              : m.drugInfo
              ? `Retrieved profile for ${m.drugInfo.drug_name.generic}; CID ${m.drugInfo.chemical_structure.pubchem_cid ?? "unknown"}.`
              : ""),
        }))
        .filter((m) => m.content)
        .slice(-20) as { role: "user" | "assistant"; content: string }[];

      const lastDrugInfo = [...messages].reverse().find((m) => m.drugInfo)?.drugInfo;
      const activeDrug = lastDrugInfo
        ? {
            name: lastDrugInfo.drug_name.generic,
            cid: lastDrugInfo.chemical_structure.pubchem_cid?.toString(),
          }
        : { name: "" };

      const { sendChatMessage } = await import("@/lib/api");
      const res = await sendChatMessage(trimmed, history, activeDrug);

      setLoading(false);
      setStreamStatus("");

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: res.success ? res.answer : undefined,
        error: res.success ? undefined : res.error || "Could not generate answer.",
        timestamp: new Date().toISOString(),
      };

      if (activeSessionIdRef.current === currentSessionId) {
        setMessages((prev) => [...prev, assistantMsg]);
      }
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? {
                ...s,
                updatedAt: Date.now(),
                messages: [...s.messages, assistantMsg],
              }
            : s
        )
      );
    }
  }, [loading, messages]);

  const handleQueryRef = useRef(handleQuery);
  useEffect(() => {
    handleQueryRef.current = handleQuery;
  }, [handleQuery]);

  // Run initial query from searchParams if provided
  const ranInitialRef = useRef(false);
  useEffect(() => {
    if (ranInitialRef.current) return;
    const q = (initialQuery || "").trim();
    if (!q) return;
    ranInitialRef.current = true;
    handleQueryRef.current(q);
  }, [initialQuery]);

  const handleSelectSession = useCallback((sessionId: string) => {
    if (loading) return;
    const target = sessions.find((s) => s.id === sessionId);
    if (target) {
      setActiveSessionId(target.id);
      setMessages(target.messages || []);
      setStreamStatus("");
      setInputText("");
    }
  }, [loading, sessions]);

  const handleDeleteSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionIdRef.current === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
      setStreamStatus("");
    }
  }, []);

  const handleNewChat = useCallback(() => {
    if (loading) return;
    setActiveSessionId(null);
    setMessages([]);
    setStreamStatus("");
    setInputText("");
  }, [loading]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !loading) {
      handleQuery(inputText);
      setInputText("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() && !loading) {
        handleQuery(inputText);
        setInputText("");
      }
    }
  };

  return (
    <div className={styles.layout}>
      {/* ── Left Sidebar (SciSpace style) ── */}
      <aside className={`${styles.sidebar} ${!sidebarOpen ? styles.sidebarCollapsed : ""}`}>
        {/* Sidebar Header */}
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.sidebarBrand} aria-label="Go to Homepage">
            <div className={styles.scispaceLogo} aria-hidden="true">
              <Image
                src="/pharmind-logo.png"
                alt="Pharmind Logo"
                width={26}
                height={26}
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
            <span className={styles.brandName}>Pharmind</span>
          </Link>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setSidebarOpen(false)}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className={styles.newChatWrap}>
          <button
            type="button"
            className={styles.newChatBtn}
            onClick={handleNewChat}
            aria-label="Start new chat"
          >
            <span className={styles.newChatBtnLeft}>
              <span style={{ fontSize: "1.1rem" }}>+</span>
              <span>New Chat</span>
            </span>
            <svg className={styles.newChatSearchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <div className={styles.sidebarScroll}>
          <div className={styles.navSection}>
            {/* Critical requirement: Home navigates back to homescreen */}
            <Link href="/" className={styles.navItem} aria-label="Go to Homepage">
              <span className={styles.navItemIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </span>
              <span>Home</span>
            </Link>

            {/* Chat with PDF triggers PDFDropzone modal */}
            <button
              type="button"
              className={styles.navItem}
              onClick={() => setPdfModalOpen(true)}
              aria-label="Chat with PDF literature"
            >
              <span className={styles.navItemIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <span>Chat with PDF</span>
            </button>
          </div>

          {/* Section: Recent Chats */}
          <div>
            <div className={styles.sectionHeader}>
              <span>Recent Chats</span>
            </div>
            <div className={styles.recentChatList}>
              {sessions.length === 0 ? (
                <div className={styles.emptyRecent}>No recent chats yet</div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    role="button"
                    tabIndex={0}
                    className={`${styles.recentSessionRow} ${activeSessionId === session.id ? styles.activeRecentSession : ""}`}
                    onClick={() => handleSelectSession(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectSession(session.id);
                      }
                    }}
                    title={session.title}
                  >
                    <span className={styles.recentSessionIcon} aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </span>
                    <span className={styles.recentSessionTitle}>{session.title}</span>
                    <button
                      type="button"
                      className={styles.deleteSessionBtn}
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      title="Delete chat"
                      aria-label={`Delete chat ${session.title}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom User Profile */}
        <div className={styles.userProfile}>
          <div className={styles.avatar}>JW</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>Jerome Woodling</span>
            <span className={styles.userEmail}>jeromewoodling645@gm...</span>
          </div>
          <button type="button" className={styles.settingsBtn} title="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Main Workspace ── */}
      <main className={styles.main}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            {!sidebarOpen && (
              <button
                type="button"
                className={styles.expandSidebarBtn}
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </button>
            )}
            <Link href="/" className={styles.homeBackLink} aria-label="Return to Homepage">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Back to Home</span>
            </Link>
          </div>

          <div className={styles.topbarRight}>
            {drugInfos.length >= 2 && (
              <button
                type="button"
                style={{
                  padding: "5px 12px",
                  background: "rgba(2, 132, 199, 0.1)",
                  border: "1px solid rgba(2, 132, 199, 0.3)",
                  borderRadius: "6px",
                  color: "#0284c7",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setCompareModalOpen(true)}
              >
                ⚖️ Compare Candidates ({drugInfos.length})
              </button>
            )}

            <span className={styles.topbarLink}>API</span>
            <span className={styles.topbarLink}>Enterprise</span>
            <span className={styles.topbarLink}>Pricing</span>
            <div className={styles.creditsBadge}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              <span>100 Credits</span>
            </div>
          </div>
        </header>

        {/* ── Center Content: Empty Hero vs Active Chat ── */}
        {!hasStarted ? (
          /* Empty / Initial State (matching Image 2) */
          <div className={styles.emptyStateScroll}>
            <div className={styles.emptyHero}>
              {/* Pharmind logo & title */}
              <div className={styles.heroLogoWrap}>
                <Image
                  src="/pharmind-logo.png"
                  alt="Pharmind Logo"
                  width={34}
                  height={34}
                  style={{ objectFit: "contain" }}
                  priority
                />
                <span className={styles.heroLogoText}>Pharmind</span>
              </div>

              <h1 className={styles.heroHeading}>How can I help with your research?</h1>

              {/* Big Prompt Box */}
              <form onSubmit={handleSubmit} className={styles.promptBox}>
                <textarea
                  className={styles.promptTextarea}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Give me any task to work on..."
                  rows={2}
                  disabled={loading}
                  aria-label="Research task or drug query input"
                />

                <div className={styles.promptToolbar}>
                  <div className={styles.toolsMenuWrap}>
                    <button
                      type="button"
                      className={styles.toolsBtn}
                      disabled
                      aria-disabled="true"
                      style={{ cursor: "default", opacity: 0.8 }}
                    >
                      <span>+</span>
                      <span>Tools</span>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className={styles.toolbarRight}>
                    <button type="button" className={styles.modelBadge}>
                      <span>Lite</span>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button type="button" className={styles.micBtn} title="Voice input">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>
                    <button
                      type="submit"
                      className={`${styles.sendBtn} ${inputText.trim() ? styles.sendBtnActive : ""}`}
                      disabled={!inputText.trim() || loading}
                      aria-label="Send message"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="19" x2="12" y2="5" />
                        <polyline points="5 12 12 5 19 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* Active Chat Workspace */
          <div className={styles.chatWorkspace}>
            <div className={styles.chatMessagesArea}>
              <ChatInterface messages={messages} loading={loading} streamStatus={streamStatus} />
            </div>

            {/* Bottom prompt bar inside chat */}
            <div className={styles.chatInputBottomBar}>
              <div className={styles.chatInputWrapper}>
                <form onSubmit={handleSubmit} className={styles.promptBox}>
                  <textarea
                    className={styles.promptTextarea}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a follow-up question, give SMILES, or request comparison..."
                    rows={1}
                    disabled={loading}
                  />
                  <div className={styles.promptToolbar}>
                    <div className={styles.toolsMenuWrap}>
                      <button
                        type="button"
                        className={styles.toolsBtn}
                        disabled
                        aria-disabled="true"
                        style={{ cursor: "default", opacity: 0.8 }}
                      >
                        <span>+</span>
                        <span>Tools</span>
                      </button>
                    </div>
                    <div className={styles.toolbarRight}>
                      <button
                        type="submit"
                        className={`${styles.sendBtn} ${inputText.trim() ? styles.sendBtnActive : ""}`}
                        disabled={!inputText.trim() || loading}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="19" x2="12" y2="5" />
                          <polyline points="5 12 12 5 19 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── Modals ── */}
        {/* PDF Ingestion Modal */}
        {pdfModalOpen && (
          <div className={styles.modalBackdrop} onClick={() => setPdfModalOpen(false)}>
            <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Index Research PDF</h3>
                <button
                  type="button"
                  className={styles.closeModalBtn}
                  onClick={() => setPdfModalOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.modalBody}>
                <PDFDropzone />
              </div>
            </div>
          </div>
        )}

        {/* Molecule Drawer Modal */}
        <MoleculeDrawerModal
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onApply={(smiles) => {
            setInputText(smiles);
            handleQuery(smiles);
          }}
        />

        {/* Drug Comparison Modal */}
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
