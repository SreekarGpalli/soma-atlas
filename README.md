# G.L.S.C Atlas

A free, installable 3D anatomy atlas for MBBS study. Web only, English only.

- **Male whole body** — BodyParts3D 4.0, 2,234 meshes streamed as per-system Draco packs
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
- NLM Visible Human samples — https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Sample-Data/

## Known dataset limits

These are properties of the open data, not bugs. The app says so on the card
rather than silently highlighting nothing:

- BodyParts3D ships the brain and cranial nerves but **no peripheral nerves** —
  there is no sciatic, median, ulnar, radial, femoral, obturator, pudendal or
  phrenic nerve mesh, and no brachial plexus
- No muscles of facial expression or mastication (temporalis, masseter)
- No anterior abdominal wall muscles
- The mesh named `thyroid` is FMA55099, the thyroid **cartilage**; there is no
  thyroid gland mesh
- The female module is a real open organ set, not a complete female cadaver

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

G.L.S.C Atlas is a study aid. It is not a medical device and must not be used for
diagnosis or treatment.
