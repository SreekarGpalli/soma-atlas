# Viewer redesign and visibility review

## Fixed causes

- Empty-query browsing previously included only positively weighted teaching
  notes and grouped concepts. Most individual meshes never appeared in the
  initial list. Browsing now includes every compatible catalog row, with
  individual geometry ranked ahead of generic groups.
- Selecting a nerve used to clear the nerve filter and expose the opaque brain.
  Compatible tissue/region filters now persist when selecting a structure.
- Search could target something still hidden by isolation or clipping. Selection
  now reveals its geometry, updates isolation, removes conflicting hiding and
  enables the systems required by its mesh members.
- Restore previously left systems disabled. All systems now resets visibility,
  regions, clipping, fade and muscle depth, respecting the selected sex module.
- Camera framing now reacts when geometry arrives, rather than relying solely
  on an eight-second initial retry. The viewport reports visible mesh count,
  loading and empty views. Counts indicate objects, not anatomical completeness.

## Layout

The desktop explorer is a separate left column, with panel navigation above
it. Eight entry views cover lungs, organs, arteries, veins, peripheral nerves,
brain/cord, head/face and skeleton. Custom layers expand below those cards.
Display settings are inside the scrollable explorer. The viewer has its own
heading/region selector, unobstructed canvas, action bar and status row.
Hide explorer expands the canvas. Narrow screens stack the canvas and explorer;
short landscape screens scroll rather than placing controls over the model.
Region selection affects actual rendered meshes using existing catalog regions.
Region metadata still requires anatomical review; it is not a spatial clipping
or segmentation algorithm.

## Dataset correction

Six Z-Anatomy collection labels (.g objects) were text shaped as meshes,
including SKELETAL SYSTEM and JOINTS. They are removed from rendered packs and
the catalog, and excluded from future imports. The master correction preserves
compressed geometry buffers; compact catalog indices are explicitly remapped.
Reproduce with node scripts/remove-source-labels.mjs followed by npm run data:split.
The atlas now contains 5,157 anatomical mesh objects (4,191 male + 966 female).
This pass adds discoverability, not new anatomical coverage. The existing HRA
additions remain. The coverage matrix/history/snapshot were regenerated.

## Review handoff for Antigravity / Gemini

Passed: lint, typecheck, 40 tests including three new visibility regressions,
data verification (zero warnings), production build. Desktop explorer and lung
preset were visually inspected. Existing female-quiz tests were preserved.

Still review: phone widths 360/390/768; short landscape; light theme; all eight
presets in both modules; head-region nerves/veins; searching after isolation;
keyboard navigation; selection/hover colours; clipping, fade and orbit; reopening
a hidden explorer; loading failures and stale PWA refresh. Inspect anatomical
alignment and source segmentation separately from application tests. No claim
of complete anatomy or exhaustive device testing is made.

Commands: npm run check and npm run data:verify. Production preview: localhost:3000.
