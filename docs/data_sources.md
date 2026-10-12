# Data sources and network behavior

Pharmer stores indexed passages and their source metadata in the local ChromaDB database. Online ingestion is an explicit action; the database is not bundled with the source repository. Content use and redistribution remain subject to the original source's terms and copyright.

## Integrated sources

| Source | How Pharmer uses it | Stored evidence and limits |
|---|---|---|
| [PubChem](https://pubchem.ncbi.nlm.nih.gov/) | Resolves compound properties and synonyms during ingestion | Compound records and identifiers; the runtime monograph structure resolver is local RDKit plus a small built-in drug dictionary |
| [DailyMed](https://dailymed.nlm.nih.gov/) | Searches and downloads FDA Structured Product Label documents during ingestion or just-in-time ingestion | Clinical label sections are split into overlapping local passages; the selected label is the one with the most recognized sections |
| [PubMed](https://pubmed.ncbi.nlm.nih.gov/) | Searches NCBI E-utilities for topic-specific literature during ingestion | Stores titles and abstracts, plus available authors, journal, publication date, DOI, and PMID; full article text is not downloaded |
| [ClinicalTrials.gov](https://clinicaltrials.gov/) | Searches API v2 for studies with the drug listed as an intervention | Stores bounded study summaries, phase/status, interventions, planned outcomes, eligibility text, posted outcome analyses when present, update dates, NCT IDs, and record links. Registry records are not equivalent to peer-reviewed publications; study status and results must be checked at the cited record |
| User PDFs | Extracts text from uploaded, text-based PDFs | Locally chunked passages; scanned pages require OCR first. Associate an upload with the exact compound name to retrieve it for name-filtered queries when there is no indexed CID |

The current starter benchmark indexes a small, hardcoded drug set. Full ingestion retrieves up to three useful DailyMed labels per drug, several topic-focused batches of PubMed abstracts (deduplicated by PMID), and up to 15 ClinicalTrials.gov records. The quick-start Aspirin demo intentionally uses much smaller limits. These bounds make initial setup feasible, but this remains a discovery seed, not a comprehensive evidence corpus: PubMed full text is not downloaded, trial retrieval is capped, and source ranking may miss relevant records. The ingestion summary reports stored chunks by drug and field. Re-run ingestion to build or refresh the local index. Ingestion uses the local FastEmbed model; it does not require a cloud embedding API key.

## Network behavior

Online source access is always enabled; `PHARMER_OFFLINE` is ignored. PubChem, DailyMed, PubMed, and ClinicalTrials.gov are contacted for lookups and source searches. Ollama inference can remain local; cloud LLM providers send prompts and retrieved evidence to the selected provider. If the FlashRank cache is missing, retrieval falls back to vector ranking.

When `LLM_PROVIDER` is `openai`, `anthropic`, or `gemini`, user prompts, follow-up history, and retrieved passages are sent to that provider. Use Ollama with a local endpoint for local inference. The frontend has no externally hosted font dependency. Citation URLs are links; opening one in a browser is a user-initiated network action.

## Ingestion metadata

Each indexed passage carries compound identity, topic, source label, URL, and where available bibliographic metadata (authors, journal, publication date, DOI/PMID, or source record ID). The monograph citation resolver uses the trusted metadata stored in ChromaDB rather than accepting model-created URLs. Older local databases may lack the new metadata fields; rebuild the index to populate them.
