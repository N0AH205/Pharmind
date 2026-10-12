# Pharmer: founder project status and product direction

**Prepared:** 11 October 2026  
**Audience:** Nontechnical co-founder  
**Scope:** Review of the current repository and its checked-in evaluation artifacts. This reflects the working tree, including substantial uncommitted changes; it is not a production audit or a claim that those changes have been released.

## Executive summary

Pharmer is a promising **local pharmacology research prototype**, not yet a complete research product and not yet a web SaaS. Its current product idea is clear: identify a compound, retrieve supporting material from a local index, and produce a structured drug profile with citations. The repository includes a Next.js interface, a Python API, local vector search, Ollama model support, follow-up chat, PDF upload, and a Windows quick-start launcher.

The main product risk is the one already identified by the founders: **the evidence base and its evaluation are too limited to support dependable, complete research answers**. The code now has broader ingestion paths for PubMed abstracts, multiple DailyMed labels, and ClinicalTrials.gov records, but the current database has not been shown to contain the refreshed corpus, and the new ingestion has not been validated against real outputs. A historical evaluation file shows weak keyword coverage and middling model-judged correctness; citation presence alone did not guarantee that the cited evidence supported each claim.

**Recommendation:** Keep the open-source, self-hosted edition as the strongest privacy differentiator, and build a separate hosted product only after evidence quality, security boundaries, and repeatable evaluations are in place. A hosted SaaS cannot honestly promise that all user data remains on the user's own computer. Make the privacy choice explicit: local self-hosting, or hosted service with transparent data handling.

## 1. Current state against the intended result

| Goal | What exists in the project | Current assessment |
|---|---|---|
| Open source and local | MIT license; local Docker Compose; Ollama default; local ChromaDB, embeddings, reranking, and PDF parsing. | **Good prototype foundation.** A normal lookup can be local against a prepared database. Setup and source/model downloads need internet. Optional cloud model providers send prompts and retrieved evidence to those providers. |
| User can use their own AI models | The backend routes to Ollama and includes optional OpenAI, Anthropic, and Gemini adapters. Ollama model is configurable. | **Partially met.** Ollama permits local model choice, but compatibility and quality across user-selected models are not shown by a model evaluation matrix. Cloud adapters are not private/local inference. |
| Network and privacy | Online source access is always enabled; a cloud LLM provider can receive prompts and retrieved evidence. Frontend assets use system fonts. | **Local Ollama inference is available, but source searches use the network.** Cloud provider settings determine whether prompts and retrieved evidence leave the machine. |
| For student researchers | Structured compound profiles, citations, follow-up chat, PDF ingestion, and a comparison UI are present in the interface/code. | **Useful early workflow.** The product needs stronger source discovery, study-level evidence inspection, export/reference workflows, and quality signals to support real research practice. |
| Back-and-forth conversation | `/chat` endpoint, UI chat flow, both user/assistant turns, and active-drug context exist in the working tree. | **Implemented in code, not yet verified end-to-end here.** The monograph path is streamed; the current chat API call is a regular request. |
| Complete, useful research output | Structured schema, field-level retrieval categories, source citations, and an evaluation script/artifact exist. | **Not achieved yet.** Output can mark gaps, but the index is bounded and the evaluation is small. Do not market it as complete or research-grade. |

### Evidence behind the quality assessment

The repository contains a historical evaluation artifact dated **11 August 2026** using `gemini-flash-lite-latest` as its evaluator. It reports average keyword coverage of **33.9/100**, model-judged correctness of **59.1/100**, and a hallucination/unsupported-claim score of **29.7/100**, alongside **100/100 citation presence**. Example field notes flag missing content and unsupported details. This is a five-drug benchmark and a model-assisted judgment, not an independent expert study; treat it as a warning signal, not a reliable product score. The evaluation script and dataset have since changed, so rerun a versioned benchmark before comparing improvements.

The expanded ingestion currently in the working tree raises the configured collection limits and adds trial records, but **the source database is not shipped as a populated product corpus and no fresh ingestion run or new evaluation result is available in this review**. Also, the visible working tree has broad uncommitted changes, so the implementation should be reviewed and committed before calling this the released project state.

## 2. Readiness for a web-based SaaS

The project has a browser interface and HTTP APIs, but that alone does not make it a multi-user SaaS. Docker Compose deliberately binds the UI and API to `127.0.0.1`, which is appropriate for local use. The repository does not show implemented accounts, authentication, tenant isolation, server-side user data ownership, billing/subscriptions, quotas, or managed conversation/library storage. The local Chroma database and local model arrangement are designed around one machine.

There are also deployment details to resolve before relying on a hosted build: the root `Dockerfile` references a `docker-start.sh` file that is not present in the repository listing, while the Compose file describes a local two-container setup. Treat public deployment as **not established** until a clean production build and deployment path are verified.

The fundamental product decision is a trade-off:

- **Self-hosted/local edition:** best fit for the original privacy promise; users provide hardware and model storage; no central SaaS account required.
- **Hosted SaaS edition:** easier for students to try and update; Pharmer/operator must host models or call model providers, store user data, secure accounts, and communicate retention/access policies. User prompts and research files leave the user's computer.

These can share the research engine, but they need clearly distinct privacy promises and deployment designs. Do not describe the hosted edition as “100% local.”

## 3. Recommended route to a chemistry research SaaS

Build in this order, using gates to avoid scaling an unreliable answer engine:

1. **Prove evidence quality locally.** Fix ingestion/retrieval issues, run the expanded source collection, inspect retrieved passages, and score field coverage, claim-to-source support, factual errors, and recall on expert-reviewed cases across different drug types. Keep the test questions and expected evidence versioned.
2. **Make research discovery the core workflow.** Let a student specify compound/identity, research question, field, date range, and evidence type. Show which databases were searched, search limits, date searched, excluded/unsupported information, and the source passages. Add a paper/study library and exportable citations only after these are reliable.
3. **Separate research runs from chat.** A run should have a query plan, search/retrieval steps, a source set, and a cited synthesis that can be reopened. Follow-up chat should retain that run's compound and sources, while allowing the student to change scope intentionally.
4. **Make hosted foundations before public launch.** Add authentication, tenant-scoped data access, user deletion/export, secure file storage, encryption, secrets management, quotas/rate limits, abuse protection, backups, monitoring, and an incident response process. Move from a single local Chroma database to a managed, tenant-aware data design. Add background jobs for ingestion and long research runs.
5. **Offer privacy as a product setting.** Local/self-hosted mode uses the user's Ollama or compatible local provider. Hosted mode clearly identifies model and search providers, what leaves the service, retention controls, and whether uploaded documents are sent to a model provider. Do not silently fall back to cloud inference.
6. **Launch narrowly.** Start with a student/researcher beta focused on drug and chemistry evidence synthesis, not a general “ChatGPT for everything” claim. Publish limitations, source coverage, and measured quality. Expand supported compounds and sources as the benchmark improves.

The best near-term product is therefore **a chemistry/pharmacology research workspace with verifiable evidence**, not a general-purpose chatbot. The durable value should be source coverage, evidence traceability, compound-aware retrieval, and research workflow—not merely access to an LLM.

## 4. Data expansion: grow coverage without indiscriminate scraping

“More internet data” is not automatically better. Unfiltered crawling can add duplicates, irrelevant pages, outdated claims, low-quality content, and material Pharmer does not have the right to store or redistribute. It can also expose the retrieval system to malicious instructions embedded in pages or documents.

Use a controlled evidence pipeline:

- Prefer documented APIs and repositories with clear terms: PubMed/NCBI, DailyMed, PubChem, ClinicalTrials.gov, and open-access article repositories such as Europe PMC where the specific article's license permits the intended use.
- Store bibliographic metadata and permitted abstracts/passages; link to the publisher or record for full text when it cannot be retained. Do not bypass paywalls, login controls, or robots restrictions. API access is not automatically a license to redistribute content.
- Record source, stable ID, publication/update date, retrieval date, content/license status, drug identity mapping, and the exact passage used. Deduplicate by stable article/study IDs and preserve distinct formulations where they matter.
- Rank and retrieve by both relevance and evidence type. Distinguish labels, reviews, trials, observational studies, and mechanistic studies; do not let a preprint or registry listing silently carry the authority of an approved label or peer-reviewed result.
- Make each generated factual claim point to supporting text. Show source freshness and conflicts, and return “not enough evidence found” when retrieval is weak.
- For broad web discovery, search first and fetch only relevant pages under source terms. Treat retrieved pages as untrusted data, not instructions to the model. Keep the user's uploaded files and private notes out of public/shared indices.

Competitors already make broad paper corpora and literature review workflows a central capability. Pharmer is not going to catch up by raising a handful of per-query result limits alone. It needs a repeatable acquisition, deduplication, ranking, rights, update, and evaluation strategy.

## 5. Competitive position

| Product category | Publicly described strength | Pharmer's current relative position |
|---|---|---|
| ChatGPT research | Web search and multi-step Deep Research produce cited reports and synthesize many sources. | Pharmer is narrower and offers local model choice/self-hosting as a potential differentiator. It lacks demonstrated broad web search, multi-step source investigation, mature hosted operations, and comparable evaluations. |
| Gemini Deep Research | Real-time research using Google Search, with optional connected sources and editable research plans. | Pharmer can offer local, researcher-controlled evidence and drug-specific structure. It currently lacks the web-scale discovery and polished hosted workflow described by Gemini. |
| Elicit | Academic paper search, screening, structured extraction, systematic-review workflows, and claim-level supporting evidence. | Elicit is a direct research-workflow competitor and currently appears stronger in paper discovery, screening, extraction, and review methodology. Pharmer's opportunity is focused pharmacology/chemistry context plus local deployment. |
| SciSpace | Large paper discovery corpus, chat with papers, cross-paper tables, library and citation workflows. | SciSpace is stronger as a general paper reading/review workspace. Pharmer can differentiate with compound identity, local inference, and privacy, if those work reliably. |
| DrugBank | Structured drug knowledge, pharmacology, interaction, label, and related datasets/API. | DrugBank competes on depth and curated structure, not necessarily on the same local open-source experience. Pharmer cannot assume it can copy this data: commercial or academic licensing may be required. |

This is a product-level comparison based on public product descriptions, not a hands-on feature test. Competitors are better resourced and have far broader source collections today. Pharmer should avoid a feature-count race and prove a trusted niche: transparent, compound-aware research with a strong local/private option.

## Suggested founder decisions

1. Is Pharmer's primary promise **local/private software** or **easy hosted access**? Support both eventually if desired, but state that the privacy guarantees differ.
2. Who is the first user: undergraduate learning pharmacology, a lab researcher, or a literature-review team? Pick one workflow to optimize first.
3. What evidence types and licensed sources are in scope for the first release, and which content may be stored versus linked?
4. What quality thresholds must be met before describing answers as research-ready? Define them with a pharmacology expert and validate with blinded/manual review.

## Public references

- OpenAI, [ChatGPT for research](https://openai.com/academy/research/) and [Introducing Deep Research](https://openai.com/index/introducing-deep-research/).
- Google, [Use Deep Research in Gemini Apps](https://support.google.com/gemini/answer/15719111?hl=en).
- Elicit, [Paper Search](https://elicit.com/solutions/search) and [Systematic Reviews](https://elicit.com/solutions/systematic-review).
- SciSpace, [Literature Review](https://scispace.com/literature-review).
- DrugBank, [Clinical Drug Data API](https://go.drugbank.com/clinical/) and [data licensing information](https://portal.drugbank.com/data_packages/target).
- Privacy terms matter if a hosted product uses third-party inference. For example, [OpenAI business/API data commitments](https://openai.com/business-data/) differ from [Google's Gemini API terms](https://ai.google.dev/gemini-api/terms), which describe different data handling for unpaid and paid services. Recheck provider terms before integration; they can change.
