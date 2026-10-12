"""Context-aware follow-up chat grounded in the local literature index."""

from __future__ import annotations

import re
import logging

from rag.context_builder import build_context
from rag.llm import generate_chat_response
from rag.reranker import rerank_passages
from rag.retriever import get_retriever

logger = logging.getLogger(__name__)

CHAT_SYSTEM_PROMPT = """You are Pharmer, an assistant for pharmacology students and researchers.
Use the reference passages below as the evidence for factual claims. Cite claims with
[SOURCE_N] markers. If the passages do not answer a point, say what is missing rather
than guessing. Treat conversation history as context for resolving references such as
'it' or 'that drug', not as a source of scientific facts. Do not give patient-specific
diagnosis, dosing, or treatment advice.

Active compound: {drug_name}
Reference passages:
{context}
"""


async def answer_chat_question(
    question: str,
    history: list[dict[str, str]] | None = None,
    active_drug: dict[str, str | None] | None = None,
) -> str:
    """Answer a follow-up, preserving both sides of history and drug identity."""
    retriever = get_retriever()
    active_drug = active_drug or {}
    drug_name = (active_drug.get("name") or "unspecified compound").strip()
    cid = (active_drug.get("cid") or "").strip() or None
    query = f"{drug_name}: {question}" if cid else question
    indexed_cid = cid if cid and retriever.get_drug_chunk_count(cid) else None
    chunks = await retriever.retrieve(
        query=query,
        n_results=16,
        pubchem_cid=indexed_cid,
        drug_name=drug_name if not indexed_cid and active_drug.get("name") else None,
    )
    online_chunks: list[dict] = []
    # Search live for the user's actual question; the local index may not
    # contain recent or narrowly scoped papers for this topic.
    try:
        from ingest.pubmed import fetch_abstracts, search_pubmed

        search_terms = f"{drug_name} {question}" if drug_name != "unspecified compound" else question
        pmids = await search_pubmed(search_terms, max_results=8)
        for article in await fetch_abstracts(pmids):
            if not article.get("abstract"):
                continue
            online_chunks.append({
                "text": f"{article.get('title', '')}\n\n{article['abstract']}",
                "source": f"PubMed PMID {article.get('pmid', '')}",
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{article.get('pmid', '')}/",
                "field": "live PubMed search",
                "distance": 1.0,
                "drug": drug_name,
                "pubchem_cid": cid or "",
                "authors": "; ".join(article.get("authors", [])),
                "publication_date": article.get("publication_date", ""),
                "journal": article.get("journal", ""),
                "doi": article.get("doi", ""),
                "pmid": article.get("pmid", ""),
                "document_id": article.get("pmid", ""),
            })
    except Exception as exc:
        logger.warning("Live PubMed search failed; using local evidence only: %s", exc)

    if not chunks and not online_chunks:
        return f"No relevant evidence was found in the local index or online search for {drug_name}. Try a more specific compound name or add a source document."

    # Reserve room for both live results and indexed evidence. If the local
    # reranker is unavailable, vector distances from the two sources are not
    # directly comparable, so rank each pool independently.
    ranked = (
        rerank_passages(query=query, chunks=chunks, top_k=5)
        + rerank_passages(query=query, chunks=online_chunks, top_k=5)
    )
    context, source_map = build_context(ranked)
    prompt = CHAT_SYSTEM_PROMPT.format(context=context, drug_name=drug_name)

    conversation: list[dict[str, str]] = []
    for item in (history or [])[-20:]:
        role = item.get("role")
        content = (item.get("content") or "").strip()
        if role in {"user", "assistant"} and content:
            conversation.append({"role": role, "content": content[:6000]})
    conversation.append({"role": "user", "content": question[:6000]})

    answer = await generate_chat_response(prompt, conversation)
    citations = []
    for sid, chunk in source_map.items():
        if re.search(rf"\b{re.escape(sid)}\b", answer, flags=re.IGNORECASE):
            citations.append(f"[{sid}] {chunk.get('source', 'Unknown source')} — {chunk.get('url') or 'local document'}")
    if citations:
        answer = f"{answer.strip()}\n\nSources\n" + "\n".join(citations)
    return answer.strip()
