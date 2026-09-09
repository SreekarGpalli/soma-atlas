# Coverage expansion and review handoff — 2026-09-09

Added 78 real female mesh objects from HRA v1.10, retaining the existing 888.
Total: 5,163 meshes (4,197 male, 966 female). Additions include oral structures,
salivary glands, spinal discs and motor cortex detail. These are mesh additions,
not 78 newly validated TA2 concepts. Candidate matches increased from 1,879 to
1,890 of 5,281 selected TA2 terms (35.6% to 35.8%). This is a name-based
heuristic, not validated anatomical completeness. Substantial gaps remain.

## Sources and reproducibility

- [Official source GLB](https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb)
- [Official metadata](https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/metadata.json)
- [Official graph](https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/graph.jsonld)
- data/hra-supplement.json records the source SHA256, additions, anchors and transform.
- data/hra-v1.10-metadata.json preserves the official metadata snapshot.

Save the source GLB to data/raw/hra-female-v1.10.glb. Run:

    npm run ingest:hra-supplement
    npm run data:split
    npm run data:verify
    npm run data:coverage

The supplement appends only new aliases, preserving catalog indices. Full
ingestion includes it after baseline imports; download the source before a
clean rebuild. Do not rerun taxonomy rebuilding on an already merged catalog:
its compact mesh indices must be preserved.

Registration used 42 shared geometry anchors; maximum centre residual was
0.077 mm. This checks coordinate compatibility, not segmentation accuracy.
Incoming surfaces were simplified (ratio 0.65, error 0.001); the merged master
was re-encoded with Draco. No fictional anatomy was generated.

## Viewer and validation

Dedicated artery, vein and peripheral nerve presets filter real geometry and
the browse list. Cerebral vessels now survive tissue classification. Tissue
colours survive hover and selection. Normal extrusion is restricted to tissue
materials and can be disabled via Enhance fine structures; it is an illustrative
visibility aid, not a measurement of calibre. The studio adds study cards,
optional orbit, responsive spacing and closer selection framing. Development
and production builds use separate directories. Fixed 98 unbalanced labels
without changing identifiers.

Lint, production build including type validation, 36 tests and data verification
passed. No data warnings. Desktop anatomy and peripheral nerve views were
visually checked. Extended browser/device validation remains outstanding.

## Focused handoff for Gemini / Antigravity

Inspect desktop and narrow mobile layouts; exercise all four presets,
selection/hover colour restoration, clipping, x-ray, orbit, sex switching and
fine-structure enhancement on/off. Inspect the 78 additions in situ, especially
oral structures and disc alignment. Check returning-PWA cache refresh and
quiz/search regressions. Run npm run check and npm run data:verify after fixes.

For further coverage, prioritize unmatched nerves, vessels and organ detail
using the saved matrix. Review skipped Z-Anatomy objects against actual mesh
membership: catalog groups alone do not prove equivalent surfaces. Evaluate
additional reference-organ releases. New authored meshes require anatomical
references and review; arbitrary tubes would inflate counts without filling gaps.
