"""
Phase 2 Verification Script — Local LLM Schema Enforcement & SSE Streaming Test.

Verifies:
1. Pydantic DrugInfo JSON Schema generation for Ollama structured output
2. Asynchronous SSE event streaming generator (run_pipeline_stream) yielding:
   - status events (safety_check, resolving_structure, retrieving, generating)
   - final DrugInfo result object
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from rag.schema import DrugInfo
from rag.pipeline import run_pipeline_stream


async def verify_phase2_streaming():
    print("=" * 60)
    print("PHASE 2 VERIFICATION — Local LLM Schema Enforcement & SSE Stream Test")
    print("=" * 60)

    # 1. Pydantic JSON Schema verification
    print("\n[1/2] Verifying Pydantic DrugInfo JSON Schema for Ollama")
    schema_dict = DrugInfo.model_json_schema()
    title = schema_dict.get("title")
    properties = schema_dict.get("properties", {})

    print(f"  Schema Title      : {title}")
    print(f"  Root Property Keys: {list(properties.keys())}")
    assert title == "DrugInfo", "Schema title mismatch!"
    assert "pharmacodynamics" in properties and "adme" in properties, "Schema missing core fields!"
    print("  -> Pydantic JSON Schema Generation OK!")

    # 2. Pipeline SSE Stream Generator Test
    test_smiles = "CC(=O)Oc1ccccc1C(=O)O"  # Aspirin
    print(f"\n[2/2] Testing run_pipeline_stream async generator for SMILES: {test_smiles}")

    events_received = []
    async for event in run_pipeline_stream(test_smiles):
        event_type = event.get("type")
        events_received.append(event_type)

        if event_type == "status":
            print(f"  [Status Event] Stage: {event.get('stage')} | Message: {event.get('message')}")
        elif event_type == "token":
            # Print token sample
            pass
        elif event_type == "result":
            data = event.get("data", {})
            drug_name = data.get("drug_name", {}).get("generic")
            print(f"\n  [Result Event] Successfully generated structured dossier for: '{drug_name}'")
            print(f"  Formula   : {data.get('chemical_structure', {}).get('molecular_formula')}")
            print(f"  SMILES    : {data.get('query_smiles')}")
        elif event_type == "error":
            print(f"  [Error Event] {event.get('message')}")

    assert "status" in events_received, "Missing status events!"
    assert "result" in events_received, "Missing result event!"

    print("\n" + "=" * 60)
    print("PHASE 2 VERIFICATION COMPLETE: SCHEMA ENFORCEMENT & SSE STREAMING OK!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(verify_phase2_streaming())
