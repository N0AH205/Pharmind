"""
Hybrid Retriever — Dense Vector + BM25 Lexical Search via Reciprocal Rank Fusion (RRF).

Combines:
  1. Dense semantic embeddings (FastEmbed 384d BAAI/bge-small-en-v1.5)
  2. Sparse lexical matching (BM25Okapi) for exact alphanumeric keywords
     (e.g., CYP2C19, hERG, IC50, Kd, Ki, CHEMBL192, TNF-alpha)

Formula:
  RRF_score(d) = (1 / (60 + rank_dense(d))) + (1 / (60 + rank_bm25(d)))
"""

from __future__ import annotations

import re
from typing import Any
from rank_bm25 import BM25Okapi


def _tokenize(text: str) -> list[str]:
    """Tokenize scientific text into lowercased alphanumeric tokens, preserving hyphens in drug/gene names."""
    if not text:
        return []
    # Tokenize words, keeping alphanumeric and hyphens (e.g. 'cyp3a4', 'tnf-alpha')
    tokens = re.findall(r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?", text.lower())
    return tokens


def reciprocal_rank_fusion(
    dense_ranked: list[dict],
    bm25_ranked: list[dict],
    k: int = 60,
    top_k: int = 8,
) -> list[dict]:
    """
    Combine two ranked lists using Reciprocal Rank Fusion.
    k=60 is the standard constant from Cormack et al. (2009).
    """
    scores: dict[str, float] = {}
    chunk_map: dict[str, dict] = {}

    for rank, chunk in enumerate(dense_ranked, 1):
        text_key = chunk.get("text", "").strip()
        if not text_key:
            continue
        scores[text_key] = scores.get(text_key, 0.0) + (1.0 / (k + rank))
        chunk_map[text_key] = chunk

    for rank, chunk in enumerate(bm25_ranked, 1):
        text_key = chunk.get("text", "").strip()
        if not text_key:
            continue
        scores[text_key] = scores.get(text_key, 0.0) + (1.0 / (k + rank))
        if text_key not in chunk_map:
            chunk_map[text_key] = chunk

    sorted_keys = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    fused_chunks: list[dict] = []
    for key in sorted_keys[:top_k]:
        item = dict(chunk_map[key])
        item["rrf_score"] = round(scores[key], 6)
        fused_chunks.append(item)

    return fused_chunks


def rank_bm25(query: str, chunks: list[dict]) -> list[dict]:
    """Rank a list of chunk dicts using BM25 against the query."""
    if not chunks:
        return []
    if len(chunks) == 1:
        return chunks

    query_tokens = _tokenize(query)
    if not query_tokens:
        return chunks

    corpus = [_tokenize(c.get("text", "")) for c in chunks]
    bm25 = BM25Okapi(corpus)
    scores = bm25.get_scores(query_tokens)

    indexed_chunks = list(zip(chunks, scores))
    # Only assign lexical rank to chunks that actually matched at least one query token (score > 0)
    matching_chunks = [c for c, score in indexed_chunks if score > 0]
    matching_chunks.sort(key=lambda c: scores[chunks.index(c)], reverse=True)
    return matching_chunks


def hybrid_rerank(query: str, chunks: list[dict], top_k: int = 8) -> list[dict]:
    """
    Given a pool of candidate chunks retrieved semantically:
      - Treats original order as dense semantic rank.
      - Calculates BM25 lexical rank.
      - Returns RRF merged result.
    """
    if not chunks or len(chunks) <= 1:
        return chunks

    dense_ranked = chunks
    bm25_ranked = rank_bm25(query, chunks)
    return reciprocal_rank_fusion(dense_ranked, bm25_ranked, k=60, top_k=top_k)
