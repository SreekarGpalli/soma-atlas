# Mesh sources: what exists, what we use, and why

Research log for the 3D mesh data behind the atlas. Update this file whenever a
source is evaluated, adopted or rejected — it is the record of *why* the atlas
contains what it contains.

Coverage numbers quoted here are measured against Terminologia Anatomica 2nd ed.
by `npm run data:coverage`; see [anatomy-coverage.md](anatomy-coverage.md) for the
method. Last reviewed: 2026-09-09.

## In use

### BodyParts3D 4.0 — adopted, male whole body

- **What** 2,234 separate OBJ meshes of an adult male, keyed to FMA concept ids.
- **Licence** CC BY 4.0, © The Database Center for Life Science. (Z-Anatomy's
  attribution file still calls this CC BY-SA 2.1 Japan; the official licence page
  at dbarchive.biosciencedbc.jp now states CC BY 4.0. No share-alike.)
- **Get it** `isa_BP3D_4.0_obj_99.zip` from
  https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- **Coverage on its own** 955 of 5,281 TA2 structures — 18.1%.
- **Ceiling** 2,234 parts is the whole dataset and all 2,234 already ship. There
  is nothing left in this source to extract; the release also has no peripheral
  nerves, no facial or masticatory muscles, and almost no named ligaments.

### Human Reference Atlas (HRA) — adopted, female organ module

- **What** `3d-vh-f-united.glb`, 888 female organ meshes derived from the Visible
  Human Female, with a UBERON crosswalk.
- **Licence** CC BY 4.0.
- **Note** The same crosswalk (`data/raw/hra-crosswalk.csv`) also lists **645
  `VH_M_` male nodes and 210 `Allen_` brain nodes we do not currently ingest**.
  Mostly organ-level and overlapping BodyParts3D, so the marginal gain is small,
  but the male united GLB is a cheap follow-up if the female module is ever
  mirrored.

### Z-Anatomy — adopted, male supplement

- **What** A libre 3D atlas built on BodyParts3D with several years of manual
  additions: peripheral nerves and vessels authored as beveled curves, named
  ligaments, joint capsules, muscle detail. `Startup.blend` holds 2,964 polygon
  meshes and 951 curves grouped into nine system collections.
- **Licence** **CC BY-SA 4.0** — copyleft. See the licence note below.
- **Get it** `Z-Anatomy.zip` from https://github.com/Z-Anatomy/The-blend
- **Why it fits** It is *derived from* BodyParts3D, so it shares the coordinate
  space — the two can be overlaid in one body without re-registration. Object
  names follow TA2 English, and the repo ships `TA2.csv` keyed by the same TA2
  ids this project extracts.
- **Ingested** 1,963 meshes — every structure it models that BodyParts3D does
  not. 928 duplicates and two non-anatomical collections (muscle attachment
  footprints, body-surface regions) were skipped.
- **Measured gain** 18.1% → 35.6% coverage; 924 TA2 structures gained.
  Peripheral nerves 3.5% → 27.9%, ligaments 9.8% → 56.7%, joints 4.4% → 48.4%.
- **Caveat** Z-Anatomy remodelled the BodyParts3D meshes rather than reusing them
  verbatim, so a Z-Anatomy structure can sit 1–2 cm from the BodyParts3D bone it
  attaches to. Measured on shared landmarks: mandible within millimetres, femur
  and sacrum within ~2 cm.

## Evaluated and not adopted

### Terminologia Anatomica 2nd ed. (FIPAT 2019)

Not a mesh source — it is the **reference inventory** the atlas is measured
against. 7,113 terms, of which 5,281 name something a 3D atlas could model.
CC BY-ND 4.0; the individual terms are public domain. Extracted by
`npm run data:ta2`.

### `ashemag/human-atlas` — rejected, circular

`ashemag-atlas.json` declares `"source": "BodyParts3D"` and contains the same
2,234 parts. The first version of the coverage script compared BodyParts3D
against this file and reported 100%, which measured the data against itself.
It lives in the gitignored `data/raw/`, so it is not in the repository; this
entry is the record. **Do not use it as a reference** — a reference has to come
from outside the data being measured.

### Open3DModel (AnatomyTOOL)

382 body parts, CC BY-SA. Far smaller than Z-Anatomy and overlapping it. Revisit
only if a specific structure is missing from both current sources.

### Commercial atlases (Anatomy 3D Atlas, Anatomy Learning, Visible Body)

Anatomy Learning advertises "over 6,000 labeled anatomical points". None publish
a machine-readable parts list, and all are proprietary — usable as a target to
compare against, never as a data source. This is why the coverage reference is
TA2 and not a competitor's catalog.

### CT/MRI segmentation models (TotalSegmentator and similar)

Produce voxel segmentations of ~100 structures from patient scans. Wrong shape
of data for a named-structure atlas, and far coarser than what is already here.

## Licence note — this matters

BodyParts3D and the HRA female organs are **CC BY 4.0**: attribution, no
share-alike. **Z-Anatomy is CC BY-SA 4.0**, and merging it changed the terms on
the combined dataset.

The male master GLB now mixes both sources, so **the mesh data in this repository
must be redistributed under CC BY-SA 4.0 with attribution**, and so must anything
derived from it. That obligation attaches to the anatomy data, not to the
application source code, which stays separately licensed.

If share-alike is ever unacceptable for this project, the way back is
`data/backup/models/male-body.bodyparts3d.glb` — the BodyParts3D-only master kept
by `scripts/merge-z-anatomy.mjs` — at the cost of returning to 18.1% coverage.

`public/ATTRIBUTION.md` must ship in every build and must name every source used.
Adding a mesh source means adding it there too.
