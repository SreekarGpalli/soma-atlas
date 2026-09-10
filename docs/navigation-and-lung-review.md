# Navigation, tutorial and lung reference review

The shipped BodyParts3D male lung surfaces have cutaway-shaped gaps. Both-sided
rendering did not restore an intact silhouette: this was a source geometry
problem. The earlier assertion that visibility alone fixed the lungs was too
strong. This pass adds 20 real HRA male bronchopulmonary surface segments as
an alternative lung reference. No invented geometry or hole filling was used.

Source and licence: public/ATTRIBUTION.md; official metadata snapshot:
data/hra-male-v1.10-metadata.json. Source checksum, object names and transform:
data/hra-male-lungs.json. The HRA geometry was uniformly fitted to the old
lung envelope for display; it is a different donor and is not a validated
body-aligned reconstruction. referenceOnly geometry stays out of default body
views and appears on explicit selection or the Lung shape preset. The original
anatomy and airway geometry are retained. Female surfaces use the existing HRA
segments. The male Lungs search now selects the 20 surfaces instead of a large
mixture of arteries and bronchi. Lung shape and Airways are separate presets.

Reproduce: download the recorded source to data/raw/hra-male-v1.10.glb, run
npm run ingest:reference-lungs, npm run data:split, npm run data:verify and
npm run data:coverage. Full ingestion includes this import. Catalog rows append
without changing existing indices.

Navigation adds bounded Back history, Home, Fit view, active preset indicators,
a Details tab and Back to explorer. Selecting a component inside an isolated
view no longer hides every sibling automatically. Region changes preserve
lung/airway view membership. Help / tour opens a four-step native modal with
keyboard focus containment, Escape dismissal, progress and a Try Lung shape
action. It opens once per browser and remains available from the header.

A stale local service-worker cache was observed serving old development JS.
Local requests now bypass worker caching; development unregisters this app's
worker. Only content-hashed production scripts are immutable. Geometry URLs
include content hashes, and the model manifest uses network-first caching.

Review carried out
------------------

The handover checklist above was worked through. Four defects were found and
fixed, all of them versions of the reported "I can only see a few parts".

The Lungs card acted on a different mesh set from the search that opened it.
select() rerouted the male Lungs row to the 20 HRA surfaces, but the card kept
reading meshesFor(), so its count said 310 meshes and pressing Isolate replaced
the intact lungs with 98 vessel and bronchus strands. Both now resolve through
selectionMeshes() in src/lib/lung-views.ts, and a test pins them together.

Female Lung shape showed 2 meshes and rendered as a single blob. The male
BodyParts3D grouping rows and the female HRA segment meshes share ids; the
catalog unions them and keeps the male row's isLeafMesh: false, so filtering
rows by that flag discarded 20 of the female segments. lungMeshIds() now walks
mesh ids rather than rows and returns a complete female lung pair. The
underlying union quirk is untouched and may affect other row-level filters.

The card credited male anatomy to the "Human Reference Atlas female organ set",
because a unioned row keeps the first pack's source tag. The disclaimer now
names the sources of the meshes actually on screen.

The "separate lung reference" note under the heading appeared in both modules.
It describes the male donor import only, and is now male-only.

Verified: tutorial steps, Previous, Close, the cancel/Escape path and reopening
from the header, at 1280x720 and at 375x812 where the dialog fits without
scrolling; Lung shape and Airways in both modules; Back across three steps of
history; Home clearing an enabled section plane; region changes preserving
lung view membership; searching Lungs; and the same lung views under a
production build with the service worker registered and content-hashed model
URLs served. Lint, typecheck, 44 tests and model integrity checks pass.

Not verified. The preview browser used for this review never runs
requestAnimationFrame and does not activate a focused control from a synthetic
key press, so camera framing was checked by computing the framing goal and
snapping to it rather than by watching the animation, and Enter/Space on
tutorial buttons and Escape on the dialog were checked through the event
handlers rather than through real key presses. The service worker no-ops on
localhost by design, so the returning-PWA cache refresh cannot be exercised
locally and needs a real deployment. Two-sided rendering doubles fragment work
and is still unmeasured on a phone. None of this establishes anatomical
completeness or correctness beyond the lungs examined here.
