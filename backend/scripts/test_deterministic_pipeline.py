import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from rag.pipeline import run_pipeline

async def test_deterministic_pipeline():
    print("=" * 60)
    print("TESTING DETERMINISTIC SCHEMA AGGREGATION & HONEST NULLS")
    print("=" * 60)

    # 1. Test Sildenafil
    print("\n[1] Running pipeline for 'Sildenafil'...")
    res = await run_pipeline("Sildenafil", debug=True)
    drug = res["result"]

    print(f"  Generic Name   : {drug['drug_name']['generic']}")
    print(f"  ChEMBL ID      : {drug['chemical_structure'].get('chembl_id')}")
    print(f"  Confidence     : {drug.get('data_confidence')}")

    bioacts = drug.get("pharmacodynamics", {}).get("bioactivities", [])
    print(f"  Bioactivities  : {len(bioacts)} measured assays")
    if bioacts:
        print(f"    Top Assay    : {bioacts[0].get('target_name')} | {bioacts[0].get('standard_type')} {bioacts[0].get('relation')} {bioacts[0].get('value_nm')} nM")

    cyp = drug.get("adme", {}).get("cyp_profile")
    print(f"  CYP Profile    : {cyp}")

    assert drug['chemical_structure'].get('chembl_id') == "CHEMBL192", "ChEMBL ID mismatch for Sildenafil!"
    assert len(bioacts) > 0, "Expected measured ChEMBL bioactivities for Sildenafil!"
    assert drug.get('data_confidence') == "HIGH (FDA Approved with Full Label)", "Confidence mismatch!"

    print("\n" + "=" * 60)
    print("DETERMINISTIC PIPELINE TEST PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_deterministic_pipeline())
