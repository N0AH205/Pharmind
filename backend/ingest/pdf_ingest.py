"""
Ingestion handler for user-uploaded custom PDFs / literature files.
Extracts text from PDF, chunks it, embeds with FastEmbed, and indexes in ChromaDB.
"""

from __future__ import annotations

import logging
import io
import pypdf
from rag.retriever import get_retriever
from rag.embeddings import embed_text_local

logger = logging.getLogger(__name__)


async def ingest_pdf_bytes(
    file_bytes: bytes,
    filename: str,
    drug_cid: str = "custom",
    drug_name: str = "",
) -> dict:
    """
    Extract text from a PDF file byte stream, chunk it into ~1000 character segments,
    generate local embeddings, and store them in ChromaDB.

    Returns dict with file summary and chunk count.
    """
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        full_text_pages = []
        for i, page in enumerate(reader.pages):
            txt = page.extract_text()
            if txt and txt.strip():
                full_text_pages.append((i + 1, txt.strip()))

        if not full_text_pages:
            raise ValueError(f"No extractable text found in '{filename}'. Ensure it is not a scanned image PDF.")

        # Chunk text by paragraphs / page segments (~1000 chars)
        chunks = []
        for page_num, text in full_text_pages:
            paragraphs = text.split("\n\n")
            curr_chunk = ""
            for p in paragraphs:
                if len(curr_chunk) + len(p) < 1000:
                    curr_chunk += "\n\n" + p if curr_chunk else p
                else:
                    if curr_chunk.strip():
                        chunks.append({"text": curr_chunk.strip(), "page": page_num})
                    curr_chunk = p
            if curr_chunk.strip():
                chunks.append({"text": curr_chunk.strip(), "page": page_num})

        if not chunks:
            raise ValueError(f"Could not construct chunks from '{filename}'.")

        retriever = get_retriever()
        collection = retriever.collection

        ids, embeddings, documents, metadatas = [], [], [], []
        clean_name = filename.replace(" ", "_").lower()
        associated_drug = drug_name.strip().casefold() or "custom literature"
        clean_drug = "_".join(associated_drug.split())

        for i, c in enumerate(chunks):
            chunk_id = f"custom_pdf_{clean_drug}_{clean_name}_{i}"
            vec = embed_text_local(c["text"])
            ids.append(chunk_id)
            embeddings.append(vec)
            documents.append(c["text"])
            metadatas.append({
                "drug": associated_drug,
                "pubchem_cid": drug_cid,
                "field": "research",
                "source": f"Uploaded PDF: {filename} (p.{c['page']})",
                "url": "",
            })

        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )

        logger.info(f"Successfully ingested uploaded PDF '{filename}': {len(chunks)} chunks stored.")
        return {
            "filename": filename,
            "pages": len(reader.pages),
            "chunks_stored": len(chunks),
            "status": "success",
        }
    except Exception as e:
        logger.error(f"Failed to process uploaded PDF '{filename}': {e}", exc_info=True)
        raise e
