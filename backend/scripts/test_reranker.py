import asyncio
from rag.reranker import rerank_passages

def test_reranker():
    query = "mechanism of action of aspirin"
    chunks = [
        {"text": "Aspirin inhibits COX-1 and COX-2 enzymes.", "distance": 0.35, "source": "PubChem"},
        {"text": "Aspirin is also known as acetylsalicylic acid.", "distance": 0.15, "source": "DailyMed"},
        {"text": "The molecular weight is 180.16 g/mol.", "distance": 0.40, "source": "PubChem"}
    ]
    reranked = rerank_passages(query, chunks, top_k=3)
    print("Reranked results:")
    for c in reranked:
        print(f"- Score: {c.get('score', 'N/A')} | Text: {c['text']}")

if __name__ == "__main__":
    test_reranker()
