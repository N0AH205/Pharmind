"""
Conversational Chat RAG Pipeline — Phase 3.
Allows follow-up conversational questions about a retrieved drug or general pharmacology queries.
"""

from __future__ import annotations

import logging
from rag.retriever import get_retriever
from rag.reranker import rerank_passages
from rag.llm import generate_structured_output, get_llm
from rag.context_builder import build_context

logger = logging.getLogger(__name__)

CHAT_SYSTEM_PROMPT = """You are Pharmer, an expert AI Pharmacology & Medicinal Chemistry Assistant.
Answer the user's question accurately using ONLY the provided reference context passages.
If the answer is not mentioned in the reference passages, state clearly that the reference data does not contain this information.

Reference Context Passages:
{context}

Guidelines:
1. Be concise, precise, and professional.
2. Sourced references: cite [SOURCE_N] when referencing facts from the context.
3. Educational & Research purposes only — do NOT provide direct patient clinical advice.
"""

async def answer_chat_question(question: str, history: list[dict] | None = None) -> str:
    """
    Answer a freeform conversational query using local RAG retrieval & reranking.
    """
    retriever = get_retriever()
    if not retriever.is_ready():
        return "Knowledge base is empty. Please run ingestion to index medical documents."

    # Retrieve relevant passages
    chunks = await retriever.retrieve(query=question, n_results=12)
    if not chunks:
        return "No relevant medical context found in local database to answer this question."

    # Rerank passages
    reranked = rerank_passages(query=question, chunks=chunks, top_k=6)

    # Build context
    context, source_map = build_context(reranked)

    # Prepare prompt
    sys_prompt = CHAT_SYSTEM_PROMPT.format(context=context)

    # Call LLM
    try:
        from langchain_core.messages import SystemMessage, HumanMessage
        messages = [SystemMessage(content=sys_prompt)]
        
        # Append history if present
        if history:
            for msg in history:
                if msg.get("role") == "user":
                    messages.append(HumanMessage(content=msg.get("content", "")))

        messages.append(HumanMessage(content=question))

        llm = get_llm()
        response = await llm.ainvoke(messages)
        return response.content
    except Exception as e:
        logger.error(f"Chat execution failed: {e}", exc_info=True)
        return f"Error executing chat response: {e}"
