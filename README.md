# Pharmer — Local AI Pharmacology Workbench

Pharmer is an open-source, 100% local AI assistant built for medicinal chemists, pharmacology students, and researchers. It allows you to search chemical compounds using SMILES strings, common drug names, or PubChem CIDs, and get back structured pharmacological monographs grounded in verified medical literature.

---

## Key Features

- **Grounded Drug Monographs**: Generates structured reports covering Mechanism of Action, ADME (Absorption, Distribution, Metabolism, Excretion), Toxicology, Indications, and History.
- **Interactive Citation Viewer**: Every statement includes citation badges. Clicking a citation opens a modal showing the exact passage retrieved from local database sources.
- **100% Offline Chemical Intelligence**: Uses local RDKit to render 2D molecular structures, compute formulas, and calculate molecular weights. Includes an interactive visual molecule drawer.
- **Local Reranking**: Integrates a local cross-encoder model (`FlashRank`) to re-order retrieved medical passages by semantic relevance before generating answers.
- **PDF Literature Ingestion**: Drag and drop custom lab notes or journal PDFs in the sidebar to index them into your local search database.
- **Side-by-Side Candidate Comparison**: Compare Mechanism of Action, ADME, and Safety profiles between two compounds side by side.
- **Markdown Export**: Download formatted `.md` monographs for lab notes or publication prep.
- **Conversational Follow-Up Q&A**: Ask follow-up questions in natural language grounded in your local literature index.

---

## Project Layout

```
pharma-rag/
├── frontend/         # Next.js user interface (React & TypeScript)
├── backend/          # FastAPI server (Python RAG pipeline)
├── data/             # Local ChromaDB vector database
├── docker-compose.yml# Docker single-command setup
├── Dockerfile        # Single container setup
└── README.md
```

---

## Quick Start

### Option A: One-Command Docker Setup (Recommended)

Run the entire application (frontend + backend) with Docker:

```bash
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Option B: Manual Local Setup

#### 1. Backend Setup

```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

#### 2. Frontend Setup

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How Retrieval & Safety Work

1. **Drug Identity Filtering**: When you query a compound (e.g. Aspirin / CID 2244), retrieval is filtered to chunks tagged with that PubChem CID. This prevents mixing information from different drugs.
2. **Local Embeddings & Reranking**: Text snippets are embedded locally using FastEmbed and reranked using FlashRank.
3. **Structured Verification**: The local LLM generates responses mapped strictly to a Pydantic schema. Missing fields are explicitly marked as "Data unavailable" rather than guessed.
4. **Safety Refusal**: Queries requesting direct patient-specific clinical advice or dosages are automatically flagged and refused.

---

## Data Sources

- **PubChem**: Chemical structure, molecular properties, and baseline pharmacology.
- **DailyMed (FDA)**: Package insert sections (indications, warnings, ADME).
- **PubMed**: Research abstracts for targeted pharmacology questions.
- **Custom PDFs**: User-uploaded literature files.

---

## Disclaimer

Pharmer is built for **educational, academic, and scientific research purposes only**. It does not provide medical or clinical advice.
