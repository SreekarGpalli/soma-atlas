# G.L.S.C Atlas

A free, installable 3D anatomy atlas for MBBS study. Web only, English only.

🌐 **Live Site:** [https://glscatlas.vercel.app/](https://glscatlas.vercel.app/)

- **Male whole body** — 4,197 meshes streamed as per-system Draco packs: BodyParts3D 4.0,
  plus 1,963 from Z-Anatomy for the peripheral nerves, ligaments and joint detail it lacks
- **Female organ module** — Human Reference Atlas / Visible Human Female, 888 real female meshes. Not a fabricated whole-body female cadaver
- **Cross-sections** — Visible Human cryosection, MRI and CT plates, plus a live clip plane through the 3D model
- **Study tools** — structure cards with hand-written high-yield notes, quizzes, side-by-side comparison, bookmarks, pronunciation
- **AI tutor** — drives the viewer through 18 tools, then explains what it did. Runs on the student's own Groq key
- **Offline** — installable PWA; the atlas, notes, quizzes and slices work with no connection

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run check   # typecheck + lint + tests + production build
npm test        # data, search and quiz-grading tests
```

## Deploy

```bash
npx vercel
```

No server environment variables are needed. The tutor proxy forwards a key the
user pastes in Setup and never stores it.

## How it fits together

| Path | Role |
|---|---|
| `src/data/structures.ts` | Builds the catalog: merges generated rows with hand-written notes, resolves mesh groups, indexes search |
| `src/data/catalog-{male,female}.json` | Generated rows. Mesh references are stored as integer indices, not repeated id strings |
| `src/data/high-yield.ts` | Hand-written exam notes overlaid on generated rows |
| `src/data/mesh-aliases.ts` | Maps note names to real mesh groups, and records which structures have no mesh at all |
| `src/lib/taxonomy` (`scripts/taxonomy.mjs`) | System and region classification rules |
| `src/lib/quiz.ts` | Question generation and answer grading |
| `src/lib/tools.ts` | Tutor tool definitions and their execution against the live atlas |
| `src/lib/tutor-client.ts` | Streaming SSE client and the tool-calling loop |
| `src/app/api/tutor/route.ts` | Validating, timing-out proxy to Groq |
| `src/components/AnatomyScene.tsx` | Mesh packs, shared materials, selection and visibility |
| `src/components/Viewer.tsx` | Canvas, camera framing, HUD |
| `src/store/useAtlasStore.ts` | All UI state |
| `public/sw.js` | Offline caching |

### Model packs

Each anatomical system is one Draco-compressed GLB under
`public/models/{male,female}/<system>.glb`, listed in
`public/models/manifest.json`. Only the systems switched on are downloaded, and
on phones they are admitted one at a time. Every GLB node name is a catalog id,
which is how clicking a mesh resolves to a structure.

The masters — `public/models/male-body.glb` and `public/models/female-pelvis.glb`
— hold every mesh and are the source the packs are split from.

## Data pipeline

```bash
npm run ingest          # everything below, in order
```

```bash
npm run ingest:male     # BodyParts3D OBJ  -> masters + catalog-male.json
npm run ingest:female   # HRA female GLB   -> masters + catalog-female.json
npm run ingest:z-anatomy # Z-Anatomy .blend -> merged into the male master
npm run data:taxonomy   # reclassify system/region, drop ontology roots, compact
npm run data:split      # re-split the masters into per-system packs
npm run ingest:slices   # NLM Visible Human samples -> public/slices/*.jpg
npm run data:verify     # fail loudly if catalogs and GLBs disagree
```

`npm run data:verify` is the important one. It checks that every GLB node has a
catalog row, that each mesh sits in the pack its system names, that the manifest
resolves, and that no FMA upper-ontology rows have crept back in.

### Source data

Raw inputs live in `data/raw/` (gitignored):

- BodyParts3D 4.0 `isa_BP3D_4.0_obj_99.zip`
- HRA united-female v1.5 `3d-vh-f-united.glb`
- Z-Anatomy `Z-Anatomy.zip` from https://github.com/Z-Anatomy/The-blend, unzipped to
  `data/work/z-anatomy/`. Needs Blender on PATH; only `npm run ingest:z-anatomy` uses it
- NLM Visible Human samples — https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Sample-Data/
- `ta2.pdf` — Terminologia Anatomica 2nd ed., from FIPAT.library.dal.ca. Only
  `npm run data:ta2` needs it; the extracted `data/ta2-terms.json` is committed,
  so `npm run data:coverage` runs without it

## Coverage against Terminologia Anatomica

```bash
npm run data:ta2        # TA2 PDF -> data/ta2-terms.json (7,113 official terms)
npm run data:coverage   # TA2 x shipped GLB meshes -> matrix, snapshot, history row
```

`data:coverage` is the honest measure of how complete this atlas is. It takes
Terminologia Anatomica 2nd ed. (FIPAT 2019) — the international standard
inventory of gross anatomy — as the reference, and counts a structure as
present only when a GLB node carrying real triangles exists for it. A catalog
row is not coverage.

Of TA2's 7,113 terms, 5,281 name a structure a 3D atlas could model; the rest
are landmarks on other structures (margins, foramina, fossae), spaces, abstract
classes and section headings, and are excluded from the denominator.

| | |
|---|---|
| Shipped meshes | 5,085 (4,197 male + 888 female), 4,198 distinct names, 10.2 M triangles |
| TA2 structures covered | **1,879 of 5,281 — 35.6%** |
| TA2 structures missing | 3,402 |

Matching is by normalised English name, so it carries roughly a 5% false-negative
rate measured by sampling; the shape of the gap is not in doubt.

Method, denominator and error bar: [docs/anatomy-coverage.md](docs/anatomy-coverage.md).
Current numbers: [docs/coverage-snapshot.md](docs/coverage-snapshot.md).
Where the meshes come from: [docs/mesh-sources.md](docs/mesh-sources.md).

### Where the gaps are

| TA2 chapter | Covered | |
|---|---|---|
| Lymphoid system | 125 / 200 | 62.5% |
| Muscular system | 363 / 649 | 55.9% |
| Joints | 197 / 407 | 48.4% |
| Cardiovascular system | 507 / 1,203 | 42.1% |
| Respiratory system | 48 / 145 | 33.1% |
| Nervous system | 343 / 1,224 | 28.0% |
| Bones | 103 / 420 | 24.5% |
| Sense organs | 42 / 219 | 19.2% |
| Genital systems | 21 / 194 | 10.8% |
| Urinary system | 10 / 94 | 10.6% |

The full table, and one row per structure, are in
[docs/coverage-snapshot.md](docs/coverage-snapshot.md) and
`data/coverage-matrix.csv`.

## Known dataset limits

These are properties of the open data, not bugs. The app says so on the card
rather than silently highlighting nothing:

- No phrenic nerve, and no perineal body — the only two hand-written notes left
  without geometry
- No sinuatrial or atrioventricular node
- No thoracic duct or cisterna chyli
- Named lymph node groups are present, but most lymphatic *vessels* are not
- The mesh named `thyroid` is FMA55099, the thyroid **cartilage**. The thyroid
  gland is a separate structure, `thyroid-gland`, added with Z-Anatomy
- The female module is a real open organ set, not a complete female cadaver;
  the Z-Anatomy merge applies to the male module only
- Z-Anatomy is remodelled from BodyParts3D rather than identical to it, so a
  Z-Anatomy mesh can sit 1–2 cm from the BodyParts3D bone it attaches to

Raising coverage further means adding another mesh source; BodyParts3D 4.0 and
the Z-Anatomy additions are both fully ingested. See
[docs/mesh-sources.md](docs/mesh-sources.md) for what has been evaluated.

## Licence: the meshes are share-alike

Z-Anatomy is **CC BY-SA 4.0**, so the combined 3D mesh dataset shipped here is
CC BY-SA 4.0 too. Attribution and share-alike apply to anything derived from the
meshes. The application source code is separate. `public/ATTRIBUTION.md` carries
the required wording and must ship in every build.

## The tutor

Online only. Each user pastes their own Groq key in Setup; it is kept in that
browser's `localStorage` and sent per request to `/api/tutor`, which forwards it
to Groq and stores nothing. The proxy validates the key shape, allowlists the
model, caps the conversation size and times out at 60s.

The tutor has read tools (`search_structures`, `get_structure`,
`get_view_state`, `list_systems`, `list_slices`) and control tools
(`show_structure`, `set_systems`, `hide_structures`, `set_clip_plane`,
`set_transparency`, `set_module`, `open_cross_section`, `start_quiz`, `compare`,
`speak`, `save_view`, `reset_view`). Replies stream, tool calls are shown as
they run, and the request can be stopped mid-flight.

## Licences

Application code here is yours to use. Third-party anatomy data keeps its
original terms and `public/ATTRIBUTION.md` must ship in every build:

- BodyParts3D © Database Center for Life Science — see `public/ATTRIBUTION.md`
- Human Reference Atlas female organs — CC BY 4.0
- Visible Human cryosection / MRI / CT — courtesy of the U.S. National Library of Medicine
- Notes adapted in part from OpenStax Anatomy & Physiology 2e — CC BY 4.0
- Coverage reference: FIPAT. Terminologia Anatomica. 2nd ed. FIPAT.library.dal.ca,
  2019 — CC BY-ND 4.0; the individual terms are public domain. Build-time audit
  data only; nothing from it is served to the browser

G.L.S.C Atlas is a study aid. It is not a medical device and must not be used for
diagnosis or treatment.
