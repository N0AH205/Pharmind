import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from rag.pipeline import resolve_query_structure, run_pipeline

async def test_aspirin():
    print("Testing small molecule regression with 'Aspirin'...")
    structure = await resolve_query_structure("Aspirin")
    print(f"  Common Name: {structure.get('common_name')}")
    print(f"  CID: {structure.get('pubchem_cid')}")
    print(f"  Formula: {structure.get('molecular_formula')}")
    print(f"  SMILES: {structure.get('smiles')}")
    print(f"  Drug Type: {structure.get('drug_type')}")
    assert structure.get("pubchem_cid") == 2244 or "2244" in str(structure.get("pubchem_cid")), "PubChem CID mismatch!"
    assert structure.get("smiles"), "Missing SMILES for Aspirin!"
    print("Aspirin small molecule resolution OK!")

if __name__ == "__main__":
    asyncio.run(test_aspirin())
