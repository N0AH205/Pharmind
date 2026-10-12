"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "./homepage.module.css";

const FEATURES = [
  {
    title: "Best Coverage",
    iconClass: styles.iconPurple,
    desc: "Comprehensive indexing of millions of biomedical papers, PubMed articles, and chemical registries.",
    sampleQuery: "What is the mechanism of action of Aspirin?",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    title: "Full-Text Search",
    iconClass: styles.iconBlue,
    desc: "Search deeply within full-text scholarly PDFs, drug monographs, and clinical literature.",
    sampleQuery: "Paracetamol pharmacokinetics and hepatic metabolism pathways",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    title: "Smart Citations",
    iconClass: styles.iconOrange,
    desc: "Context-grounded citations showing supporting, contrasting, and mentioning evidence.",
    sampleQuery: "Contraindications and drug interactions for Ibuprofen",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    title: "Verifiable Evidence",
    iconClass: styles.iconTeal,
    desc: "Every answer and chemical claim is tied back to transparent source citations and PubChem data.",
    sampleQuery: "CC(=O)Oc1ccccc1C(=O)O",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    title: "Trusted by Millions",
    iconClass: styles.iconAmber,
    desc: "Accelerating discovery for researchers, pharmacologists, and academics worldwide.",
    sampleQuery: "What are the common adverse effects of Caffeine?",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const QUICK_SUGGESTIONS = [
  "Paracetamol",
  "Aspirin",
  "Ibuprofen",
  "Caffeine",
];

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/chat?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/chat");
    }
  };

  const handleSuggestion = (text: string) => {
    router.push(`/chat?q=${encodeURIComponent(text)}`);
  };

  return (
    <div className={styles.page}>
      {/* ── Top Navigation Bar ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <Link href="/" className={styles.brand} aria-label="Pharmind home">
              <Image
                src="/pharmind-logo.png"
                alt="Pharmind logo"
                width={32}
                height={32}
                className={styles.brandLogoImg}
                priority
              />
              <span className={styles.brandName}>Pharmind</span>
            </Link>

            <nav className={styles.nav} aria-label="Main Navigation">
              <span className={styles.navLink}>
                Features
                <svg className={styles.chevron} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                </svg>
              </span>
              <span className={styles.navLink}>
                Integrations
                <svg className={styles.chevron} viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                </svg>
              </span>
              <span className={styles.navLink}>Data</span>
              <span className={styles.navLink}>Rankings</span>
              <span className={styles.navLink}>Pricing</span>
            </nav>
          </div>

          <div className={styles.headerRight}>
            <Link href="/chat" className={styles.loginLink}>
              Log In
            </Link>
            <Link href="/chat" className={styles.startTrialBtn}>
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <main>
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />

          <div className={styles.heroContent}>
            {/* Top Pill Badge */}
            <Link href="/chat" className={styles.badgePill} aria-label="Try our MCP">
              <span className={styles.mcpIcon}>
                <span className={styles.mcpIconInner}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1v14M1 8h14M3 3l10 10M13 3L3 13" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
              </span>
              <span>Try our MCP</span>
              <span className={styles.badgeArrow}>→</span>
            </Link>

            {/* Headline */}
            <h1 className={styles.heroTitle}>AI for Research</h1>

            {/* Subtitle */}
            <p className={styles.heroSubtitle}>
              Ask a question, get answers grounded in the scientific literature
            </p>

            {/* Large Pill Search Bar */}
            <div className={styles.searchContainer}>
              <form onSubmit={handleSearch} className={styles.searchForm}>
                <input
                  type="text"
                  className={styles.searchInput}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What does the literature"
                  aria-label="Research query"
                />
                <button type="submit" className={styles.searchSubmitBtn} aria-label="Search literature and open chatbot">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>
            </div>

            {/* Scholarly Articles Pill Badge */}
            <div className={styles.readsPill}>
              <svg className={styles.readsIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span>Reads across 322M+ full-text scholarly articles</span>
            </div>

            {/* Suggestions */}
            <div className={styles.suggestionsRow}>
              {QUICK_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  className={styles.suggestionChip}
                  onClick={() => handleSuggestion(sug)}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── "More coverage. More confidence." Section ── */}
        <section className={styles.coverageSection}>
          <h2 className={styles.sectionHeading}>More coverage. More confidence.</h2>

          <div className={styles.cardsGrid}>
            {FEATURES.map((item) => (
              <div
                key={item.title}
                className={styles.featureCard}
                onClick={() => handleSuggestion(item.sampleQuery)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleSuggestion(item.sampleQuery);
                }}
              >
                <div className={`${styles.cardIconWrap} ${item.iconClass}`}>
                  {item.icon}
                </div>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardDesc}>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>© 2026 Pharmind · Grounded scientific intelligence platform</span>
          <div className={styles.footerLinks}>
            <Link href="/chat" className={styles.footerLink}>AI Chatbot</Link>
            <Link href="/" className={styles.footerLink}>Features</Link>
            <Link href="/" className={styles.footerLink}>API</Link>
            <Link href="/" className={styles.footerLink}>Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
