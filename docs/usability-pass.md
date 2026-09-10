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

## Second pass — the student tried it again

Two more reports: "Head & face shows muscles that are not head or face", and
"click the lungs, then try to go somewhere else and it is stuck".

**The head region was matching the word "head".** In these datasets "head"
names the part of a muscle or bone that articulates far more often than it
names the region, so "Long head of biceps femoris" (thigh), "Lateral head of
flexor hallucis brevis" (foot), "Humeral head of pronator teres" (forearm) and
"ligament of fibular head" (knee) were all filed under the head — and shown in
Head & face. `classifyRegion` now treats a bare part-word as last-resort
evidence that any genuine regional term outranks. "Neck" had the same problem
and is handled the same way. 38 rows moved out of the head.

**A quarter of all meshes matched no region rule at all** and silently took the
`thorax` fallback. Many were accidentally right — segmental bronchi really are
thoracic — but every eye structure was not: the extraocular muscles, choroid,
macula, fovea, pupil and ora serrata. In the female module those 122 rows had
landed under *femalePelvis*. So Head & face was simultaneously showing feet and
missing eyes. Added eye and orbit terms, the deep brain structures the nervous
system rule already knew, the Allen brain-atlas prefix, the heart's interior,
and the thigh muscle names. 458 rows corrected across the two catalogs; only
rows that a rule now actually matches were moved, so nothing was reclassified
into the fallback on a guess. 56 Allen rows were also tagged `skeletal`, which
put brain nuclei in the Skeleton view; they are nervous, and the packs were
re-split accordingly.

**Isolation behaved like a mode instead of a view.** Entering Lung shape
isolates twenty meshes. Selecting anything afterwards re-isolated *that*, and
so did the next selection, so after visiting the lungs every structure appeared
alone with no body around it — which is what being stuck felt like. Changing
region kept the lung isolation too, so choosing Head from the lung view gave a
blank canvas. Now isolation survives only while you stay inside it: drilling
into something already isolated keeps the view, picking something outside it
brings the body back, and a region change drops an isolation that has nothing
in the new region. Donor reference geometry stays the exception, since it is
not aligned to this body.

Verified in the browser: Head & face confined to the head, Lung shape then
searching a femur now showing 1,046 meshes in context rather than two, and
Lung shape then choosing Head no longer blank. Lint, typecheck, 51 tests, a
production build and the model integrity check pass. Coverage is unchanged at
35.7% — this pass corrected where things are filed, not how much exists.

## Opening reveal

The app opened on a static grey body, which said nothing about the one idea it
is built on: that the body is stacked in layers you can take off. The first
visit now plays a short reveal — the skin envelope dissolving to muscle, muscle
thinning to bone, and on a good connection the arterial, venous and nerve trees
lighting up through it — with each layer named as it appears. It is the product
demo and the explanation in the same five seconds.

Cost was the deciding constraint. The skin is a single 231 KB mesh and the
first two layers are the ones the app downloads anyway, so the core reveal adds
one small request. The vessel and nerve packs are 7 MB together and are worth
downloading on a link that will not notice, so the last two beats play only
when `navigator.connection` reports 4g and Save Data is off; everything else
gets the three-layer version. Those packs stay resident afterwards, so opening
Arteries or Nerves is then instant.

It runs once per browser, any click, key or scroll skips it, it is off entirely
under prefers-reduced-motion, and Setup has a Replay control for showing
someone else. It waits for the first geometry — a reveal of an empty canvas is
not a reveal — and the quick-start dialog waits for it to finish rather than
opening on top of it.

Two implementation notes worth keeping. React's development double-mount
cancelled the timeline while a ref still said it had started, so the reveal set
its layers up and never played a beat; the guard is now cleared alongside the
timers. And giving each beat its own tween chain meant a slow frame let two
overlap, with the stale one writing its opacities over the newer beat — the
caption read "Nerves" while the body was already reassembling. The whole
timeline now runs off one clock and reads elapsed time, which is self-correcting.
