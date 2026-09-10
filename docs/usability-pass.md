# Usability pass — student report

A first-year MBBS student used the app and reported that coverage felt thin,
that navigation was hard, and that choosing something often showed something
else. Auditing against those three complaints found causes that were mostly not
about coverage at all.

## Choosing a region could empty the canvas

A sweep over every study view crossed with every body region found 33 male and
27 female combinations that rendered nothing. Two unrelated causes looked
identical on screen:

- **Hidden by the current layers.** Male pelvis is entirely reproductive and
  cardiovascular geometry, and neither layer is on by default, so choosing it
  from the Overview showed an empty canvas while 30 meshes sat loaded.
- **Genuinely absent from the view.** There are no lungs in an upper limb.

`src/lib/regions.ts` now separates the two. A region with nothing to show in the
current view is offered as unavailable and cannot be chosen; a region that is
merely hidden switches its own layers on when it is chosen. A test asserts that
no region a student can pick leads to an empty canvas.

The region index is built from the per-module catalogs rather than from the
merged `STRUCTURES` list, because the merge unions rows sharing an id and widens
`sex` to "both" — which made the female module offer a Male pelvis whose
geometry ships only in the male packs.

## The male module claimed a female pelvis

Three pharyngeal `salpingopharyngeus` rows were filed under `femalePelvis`: the
region rule matched a bare `salping` (as in salpinx). Fixed in the shipped
catalog and in `scripts/taxonomy.mjs`, which had already special-cased the same
word elsewhere.

## Search could not find what the app has

- "gall bladder" returned nothing; the mesh is "Gallbladder".
- "oesophagus" reached three rows and "esophagus" six — BodyParts3D spells it
  both ways, and an Indian MBBS course teaches the British spelling, so half the
  oesophagus was invisible to the spelling the student was taught.
- "uterus" in the male module answered "Urinary bladder", because that row's
  clinical note mentions the uterus. A prose mention was being presented as the
  answer.

Search now levels spacing, punctuation, accents and the ae/oe digraphs on both
query and index, carries a short list of everyday names (windpipe, kneecap,
collarbone…), and distinguishes a name match from a prose match: when nothing
matches by name here but does in the other module, it says so and offers to
switch.

## Interface

The lettermark tile beside the wordmark was redundant and has been removed; the
name carries the header. The app icons were a stick figure assembled from
rounded rectangles and are now a serif lettermark, with a separate maskable
variant so Android does not crop it. The tab rail is one row of equal cells at
every width — a lone "Setup" wrapping onto its own line read as breakage. The
empty-canvas message is in plain language and offers Back, Start again and Turn
on every layer instead of a single jargon button.

## Coverage

Not addressed, and not addressable here. Coverage is 35.7% of Terminologia
Anatomica and is bounded by what the open datasets model; raising it needs new
source geometry, not code. Much of what the student read as missing was present
but unreachable — the fixes above. See `docs/coverage-snapshot.md` for the real
figures.

## Verified

Lint, typecheck, 48 tests and a production build pass. In the browser: the
region controls in both the header and the explorer, Male pelvis revealing its
30 meshes, the three search cases above, the tab rail at 375px and at desktop
width, and the tutorial. The preview browser does not run requestAnimationFrame,
so camera framing was checked by computing the framing goal rather than watching
it animate.
