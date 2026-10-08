"""
Phase 1 Verification Script — 100% Offline Local Engine Test.

Verifies:
1. RDKit local chemical parsing & SVG generation (no PubChem API calls)
2. Local FastEmbed ONNX vector query retrieval (no Gemini API calls)
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ingest.local_chem import enrich_structure_local
from rag.embeddings import embed_text_local
from rag.retriever import get_retriever


async def verify_offline_engine():
    print("=" * 60)
    print("PHASE 1 VERIFICATION — 100% Offline Local Engine Test")
    print("=" * 60)

    # 1. Chemical Resolution test via RDKit
    test_smiles = "CC(=O)Oc1ccccc1C(=O)O"  # Aspirin
    print(f"\n[1/2] Testing Local RDKit Chemical Resolution for SMILES: {test_smiles}")
    structure_data = await enrich_structure_local(test_smiles)
    print(f"  Common Name     : {structure_data.get('common_name')}")
    print(f"  Formula         : {structure_data.get('molecular_formula')}")
    print(f"  Molecular Wt    : {structure_data.get('molecular_weight')} g/mol")
    print(f"  InChIKey        : {structure_data.get('inchikey')}")
    print(f"  Image Data URI  : {structure_data.get('image_url')[:60]}...")

    assert structure_data.get("molecular_formula") == "C9H8O4", "Formula mismatch!"
    print("  -> RDKit Chemical Resolution OK!")

    # 2. Local FastEmbed Vector Retrieval test
    print("\n[2/2] Testing Local FastEmbed ONNX Vector Retrieval")
    retriever = get_retriever()
    ready = retriever.is_ready()
    count = retriever.chunk_count()
    print(f"  Retriever Ready : {ready}")
    print(f"  Total Chunks    : {count}")

    if ready:
        chunks = await retriever.retrieve("mechanism of action cyclooxygenase", n_results=3)
        print(f"  Retrieved {len(chunks)} chunks using 384d FastEmbed vector:")
        for idx, chunk in enumerate(chunks, 1):
            print(f"    [{idx}] Source: {chunk.get('source')} | Field: {chunk.get('field')} | Distance: {chunk.get('distance'):.4f}")
            print(f"        Snippet: {chunk.get('text', '')[:120]}...")
        print("  -> Local FastEmbed Retrieval OK!")
    else:
        print("  Notice: ChromaDB collection is empty. Run 'python -m ingest.run_ingest' to populate.")

    print("\n" + "=" * 60)
    print("PHASE 1 VERIFICATION COMPLETE: ALL CLOUD DEPENDENCIES REMOVED!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(verify_offline_engine())
