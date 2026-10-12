# Pharmind — AI Drug Research & Pharmacology Intelligence Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_Store-orange)](https://www.trychroma.com/)

**Pharmind** is an open-source pharmacology research platform and AI copilot designed for students, researchers, and healthcare professionals. 

It searches biomedical databases, visualizes 2D and 3D molecular structures, indexes research literature (PDFs), and generates comprehensive, citation-backed drug monographs spanning Pharmacodynamics, ADME, Toxicology, and Clinical Profiles.

> [!NOTE]
> **Research and Educational Use Only**: Pharmind is designed as a pharmacology research aid and learning tool. It does **not** provide medical advice, diagnosis, or treatment plans. Always consult licensed clinicians for patient care.

---

## Features

* **Interactive Research Workspace (`/chat`)**: A research environment featuring multi-turn conversational reasoning, follow-up queries, and structured data views.
* **Molecular Structure Visualizer**: Automatic chemical resolution via PubChem with interactive 2D structure diagrams, 3D molecular rendering, IUPAC nomenclature, SMILES, InChI, and PubChem CIDs.
* **Comprehensive Pharmacology Monographs**:
  * **Pharmacodynamics**: Mechanism of action, physiologic effects, binding affinity ($K_d$ / $K_i$), and selectivity.
  * **Pharmacokinetics (ADME)**: Absorption, distribution, metabolism (CYP450 enzymes), and excretion half-lives.
  * **Toxicology**: Acute toxicity, cytotoxicity, genetic risks, and hazard classifications.
  * **Therapeutic Profile**: Indications, contraindications, adverse reactions, and drug interactions.
* **Grounded & Cited Evidence**: Every claim links directly to primary sources across PubMed abstracts, DailyMed SPL labels, ClinicalTrials.gov records, and PubChem.
* **Chat with PDF**: Upload and index your own scientific papers, clinical trials, or monographs directly into your local vector database with one click.

---

## 🚀 Easy Setup Guide 

### Step 1: Download the Files
1. Visit **[https://github.com/N0AH205/Pharmer](https://github.com/N0AH205/Pharmer)** in your browser.
2. Click the green **`<> Code`** button at the top right, then click **Download ZIP**.
3. Right-click the downloaded `.zip` file on your computer and choose **Extract All...**.

---

### Step 2: Install Docker Desktop 
1. Download and install **[Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)**.
2. Open Docker Desktop from your Start menu and wait 15–30 seconds until the status icon in the bottom-left turns **green** (indicating Docker is running).

---

### Step 3: Get Your Free Google Gemini API Key
Pharmind uses Google Gemini to generate answers quickly with zero GPU hardware requirements:
1. Visit **[Google AI Studio API Keys](https://aistudio.google.com/app/apikey)** (log in with any standard Google account).
2. Click **Create API Key** and copy it to your clipboard.

---

### Step 4: Double-Click `start-pharmer.bat`!
1. Open the extracted folder and double-click **`start-pharmer.bat`**.
2. If you haven't configured a key yet, the launcher will prompt:
   ```text
   Paste your Google Gemini API key:
   ```
   Simply right-click or paste your key and press **Enter**.
3. The launcher will automatically build and start the containers, and launch your browser at:
   👉 **[http://localhost:3000](http://localhost:3000)**

#### How to Stop:
When you are done researching, simply double-click **`stop-pharmer.bat`** to stop the application. Your research history and settings stay saved.

---

## How to Use Pharmind

1. **Search a Drug**:
   * Type common drug names (e.g., *Metformin, Aspirin, Ibuprofen, Atorvastatin*) or paste a SMILES chemical formula into the search bar.
   * Press **Enter** or click **Search**.
2. **Review the Profile**:
   * Inspect the mechanism of action, CYP metabolic enzymes, clearance rates, and contraindications.
   * View the 2D chemical structure or rotate the interactive 3D model.
3. **Ask Follow-Up Questions**:
   * Type conversational questions in the bottom chat bar (e.g., *"Can this be taken with alcohol?"* or *"What are common off-target bindings?"*).
4. **Compare Compounds**:
   * Click the **Compare** button on any profile to view side-by-side pharmacological comparisons between multiple drugs.
5. **Manage Your Sessions**:
   * All queries appear in the **Recent Chats** sidebar.
   * Click any previous chat to restore its full conversation history and drug monograph.
   * Hover over any session and click **✕** to delete it.
   * Click **+ New Chat** anytime to start a fresh exploration.

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><b>1. Docker says "Docker is not running" or fails to start. What do I do?</b></summary>
Open the Docker Desktop application from your Windows/Mac application menu and wait 15–30 seconds until the status light in the bottom corner shows solid green. Once Docker Desktop is running, try running the start script again.
</details>

<details>
<summary><b>2. How much disk space does Pharmind take?</b></summary>
The initial Docker images take roughly 2–3 GB. If you use Ollama with `qwen2.5:7b`, it requires an additional ~4.5 GB for the model weights. If disk space is limited, using the Gemini free API key requires virtually no disk space.
</details>

<details>
<summary><b>3. Where are my saved chats stored? Can other people see them?</b></summary>
Your saved chats and research queries are stored strictly in your browser's local storage (`localStorage`). They never leave your computer and cannot be viewed by other users.
</details>

<details>
<summary><b>4. Can I upload my own PDF research papers?</b></summary>
Yes! In the research workspace (`/chat`), click **Chat with PDF** in the sidebar. Select your paper, associate it with a drug name, and Pharmind will extract, chunk, and index the text into your local ChromaDB store.
</details>

---

## License & Attribution

* **Software License**: [MIT License](LICENSE).
* **Data Sources**: Pharmacological and chemical data is sourced from PubChem (NCBI), DailyMed (NLM), PubMed (NCBI), and ClinicalTrials.gov subject to their respective terms of use.
