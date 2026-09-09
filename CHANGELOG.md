# Changelog

## Renamed to G.L.S.C Atlas

Was "Soma Atlas". Updated everywhere it was user-visible or machine-readable:
window title and title template, OpenGraph, PWA manifest name and short name
(the home-screen label), Apple web-app title, the header wordmark and its badge
letter, the install prompt, the loading and offline screens, the disclaimer in
Setup, the tutor's system prompt, the service-worker banner, the attribution
file, `package.json`, the ingest script's GLB `generator` tag, and both docs.

Two things worth knowing:

- **Saved state survives.** Bookmarks, the Groq key, the theme and dismissed
  banners live in `localStorage` under a name-derived prefix. Changing that
  prefix would have looked exactly like data loss, so `src/lib/storage.ts` moves
  anything found under the old `soma-atlas:` prefix across on first load, and
  the pre-paint theme script reads both keys. The migration can be deleted once
  every device has opened the app once.
- **Service-worker caches were renamed and the version bumped** to `v6`, so
  returning users drop the old caches on activation rather than keeping them
  around forever.

The project directory is still `soma-atlas/` and `metadataBase` points at
`https://glsc-atlas.vercel.app` — see the notes at the end.

---

## Audit and rebuild

A full pass over the codebase: data correctness, 3D performance, the AI tutor,
the UI, and production hardening. Grouped by what was actually wrong.

---

### Anatomical data — the most serious problems

**`skeletal` was a catch-all bucket.** Of 833 meshes tagged skeletal in the male
body, only ~250 were skeletal. The lungs, bronchial tree, eyeballs, extraocular
muscles, lacrimal apparatus and parts of the brainstem were all filed under
"Skeletal". Because the GLB packs were split by that same field, the male
`respiratory.glb` contained 5 meshes — trachea and two bronchi — while the lungs
sat inside a 3.7 MB `skeletal.glb`. **Turning on the Respiratory filter
downloaded the wrong file and showed almost nothing.**

Fixed by writing an explicit classifier (`scripts/taxonomy.mjs`) with ordered
anatomical rules, reclassifying 1,019 rows, and re-splitting both master GLBs
into corrected per-system packs. Male `skeletal.glb` went 3.7 MB → 1.35 MB;
`respiratory.glb` went 5 meshes → 131.

**FMA upper-ontology rows polluted the catalog.** `Physical anatomical entity`,
`Anatomical structure`, `Cardinal organ part` and 26 similar classes each owned
1,000–2,234 meshes. Searching "structure" returned an entry that selected the
entire body. Dropped, with a regression test.

**Three hand-written notes were attached to entirely wrong meshes.** BodyParts3D
assigns some meshes short ids that collide with the note ids, and the merge
joined on id alone:

| Note | Was attached to | Actually |
|---|---|---|
| Thyroid gland (endocrine) | `thyroid` = FMA55099, thyroid **cartilage** | laryngeal, not endocrine |
| Tibia (bone) | `tibia` = "Right tibialis anterior" | a muscle |
| Deltoid (muscle) | `deltoid` = "Deltoid branch of thoraco-acromial artery" | an artery |

The merge now requires the names to agree once side and parentheticals are
ignored, so "Right femur" still hosts the "Femur" note but "Right tibialis
anterior" does not host "Tibia".

**29 of 66 high-yield notes pointed at meshes that did not exist**, so the
best-annotated structures in the atlas highlighted nothing. `mesh-aliases.ts`
now maps note names to real mesh groups (Cranium → neurocranium +
viscerocranium, Quadriceps → rectus femoris + three vastus heads, and so on).
Where the open data genuinely has no mesh — peripheral nerves, muscles of
mastication, the thyroid gland — the card says so instead of failing silently.

**Search ranked ids above names.** Because some ids do not describe their mesh,
searching "tibia" returned tibialis anterior. Ids now rank below names.

**Added `npm run data:verify`**, which fails the build if catalogs and GLBs
disagree: unknown mesh names, meshes in the wrong pack, dangling references,
ontology roots, broken manifest entries.

---

### Quiz

- **Wrong answers scored as correct.** The grader used
  `answer.includes(choice)`, so picking "Lung" when the answer was "Left lung"
  was marked right. Multiple choice is now an exact match; free text is graded
  on distinctive words, with laterality and structure-kind guards so "right
  phrenic nerve" fails for a left answer and "femoral nerve" fails for "femoral
  artery".
- **The viewer printed the answer.** For "which structure is highlighted?", the
  label under the model named the highlighted mesh. Suppressed until answered.
- Empty answers were graded; multiple choices could render green at once;
  distractors could duplicate the answer. All fixed and covered by tests.
- Questions are now drawn only from structures that actually have geometry, and
  span identify / describe / region / innervation / action.

---

### 3D viewer

- **Hovering re-traversed every mesh.** Each pointer move ran
  `scene.traverse()` across thousands of meshes and rewrote every material.
  Hover now touches only the two meshes involved.
- **One material per mesh.** The male cardiovascular pack alone created 981
  `MeshStandardMaterial` instances. Now one shared material per system.
- **`computeVertexNormals()` ran on every Draco mesh on load**, discarding the
  normals already in the file. Only computed when missing.
- **The canvas rendered continuously at 60 fps.** Now `frameloop="demand"`.
- `DoubleSide` on everything → `FrontSide`.
- `require("three")` inside a client component, which breaks under Turbopack.
- **Camera framing was hardcoded per module**, so the female model was framed at
  its knees. Framing is now measured from the scene bounds, and retries while
  packs are still downloading.
- **Selecting an internal organ showed the chest wall.** Added a see-through
  selection pass (on by default, toggleable) so the highlighted structure reads
  through whatever occludes it.
- The error boundary had no reset, so one failed model download broke the viewer
  until a full reload.
- Removed the schematic fallback body: it drew boxes and spheres labelled with
  real anatomical names, which is worse than nothing in a study tool.

---

### State

- **Switching module left stale mesh ids** in `selectedIds` / `isolatedIds`.
  Isolating something, then switching to Female, rendered an empty scene.
- Clicking a structure in the Browse list forced the panel to the card, so the
  list vanished under the pointer.
- `crypto.randomUUID()` throws outside a secure context, breaking bookmarks and
  the tutor over plain-HTTP LAN testing. Now falls back.
- Keyboard shortcuts fired on `Ctrl+R`, `Cmd+I` and so on, shadowing browser
  shortcuts.

---

### AI tutor

The tutor was told "use ONLY the atlas catalog", but had **no tool to read a
structure's notes** — `search_structures` returned only id, name, system and
region. It could not access a single summary, relation or clinical pearl.

Rebuilt around 18 tools including `get_structure` (full record), and
`get_view_state` so it can answer "what am I looking at?". Tool schemas now
carry per-property descriptions and enums.

Also:

- **Replies now stream.** Previously the panel sat blank until the whole
  multi-round tool loop finished.
- Requests can be **stopped**, and are aborted if the panel unmounts.
- History is trimmed, so a long session cannot blow the context window.
- The API route had **no error handling** — a malformed body threw an unhandled
  500 — **no timeout**, and no validation. It now validates the key shape and
  message array, allowlists models, caps body size, times out at 60s, hangs up
  on Groq when the browser disconnects, and translates upstream errors into
  readable messages.
- Settings offered `qwen/qwen3.6-27b`, which is not a Groq model id and always
  failed. Model list is now shared between the route allowlist and the picker,
  so they cannot drift.
- Tutor replies render through a small Markdown builder that produces React
  elements — model output is never passed to `innerHTML`.

---

### Performance

- **The catalog shipped as a 3.3 MB JSON blob in the JS bundle.** Removed the
  templated summaries and duplicate aliases (rebuilt at runtime), and stored
  mesh references as integer indices rather than repeated id strings.
  Catalogs: 3.3 MB → 1.35 MB. Total client JS: **5.3 MB → 3.1 MB**.
- Search ran over ~4,900 rows on every keystroke with no memoisation. Now a
  precomputed index behind `useDeferredValue`.
- `useGLTF.preload` ran on every render because its input array was rebuilt each
  time.

---

### PWA and offline

The service worker was **cache-first for everything, including the HTML
document**, so a returning user could never receive an app update. Rewritten
with per-resource strategies: network-first for navigation, cache-first for
hashed build assets and model packs, stale-while-revalidate for the rest, plus
a bounded media cache, a real offline page, and no caching of range requests or
the tutor proxy.

`Cache-Control: immutable` on `/models/*` meant a re-ingest could never reach
existing users; now a week with revalidation.

---

### Security and production readiness

- Added CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and
  `Permissions-Policy`. There were none.
- Resolved 2 npm advisories (high + moderate) via a `postcss` override.
- **There was no ESLint config at all** — `npm run lint` could not run. Added
  one; the codebase is clean.
- **There were no tests.** Added 30 covering catalog integrity, the note merge,
  mesh resolution, search ranking, quiz generation and answer grading.
- `npm run check` runs typecheck + lint + tests + build.

---

### UI

Rebuilt around a design-token system with a real light theme.

- Display controls moved from a wrapping row of unlabelled buttons at the top of
  the page into a dock over the viewport, collapsed by default on phones
- Seven cramped text tabs → an icon rail, which becomes a bottom bar on mobile
- Browse gained system counts, region filters, pagination and "only this system"
- Compare's `<select>` reached only 15 of ~4,900 structures; replaced with search
- Cross-sections gained click-to-zoom and labelled features
- Search gained match highlighting, proper combobox ARIA and keyboard support
- **`maximum-scale=1` blocked pinch-zoom** — an accessibility failure, removed
- **The theme flashed on every load** because the document was hardcoded dark and
  React corrected it after mount. Now resolved before first paint
- Fonts moved from a render-blocking Google Fonts `@import` to self-hosted
  `next/font`, which also fixes typography offline
- Added metadata, OpenGraph, and a `theme-color` per colour scheme

---

## Things to check yourself

- **BodyParts3D licence.** `public/ATTRIBUTION.md` states CC BY 4.0. BodyParts3D
  4.0 is, as far as I can tell, distributed under CC BY-SA 2.1 Japan. Worth
  confirming before any public deploy, since share-alike would have real
  implications.
- **The `data/backup/` folder** holds the pre-rebuild catalogs and GLB packs
  (26 MB, gitignored). Delete it once you are happy with the new data.
- **The 44 MB of model packs in `public/models/`** are committed. That is fine
  for Vercel but will make the repo heavy in git; consider Git LFS or a CDN.
- **CSP still allows `'unsafe-inline'` for scripts**, because Next injects
  inline bootstrap scripts without a nonce in this setup. Tightening it needs
  nonce middleware.
- **The folder is still named `soma-atlas/`.** I did not rename the working
  directory, since that is your call and it changes local paths, any existing
  git remote and the Vercel project link. `git mv` or a plain rename is safe;
  nothing in the code refers to the folder name.
- **`metadataBase` in `src/app/layout.tsx`** is set to
  `https://glsc-atlas.vercel.app`. Point it at whatever origin you actually
  deploy to — it is what relative OpenGraph and icon URLs resolve against.
