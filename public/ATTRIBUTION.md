# Attribution

G.L.S.C Atlas redistributes or will redistribute third-party anatomy data. Keep this file in the deployed site.

## 3D meshes

- BodyParts3D, © The Database Center for Life Science, licensed under CC BY 4.0.
  https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
  Source geometry: `isa_BP3D_4.0_obj_99.zip` (99% polygon-reduced IS-A tree).
  Adaptations: millimetres/Z-up converted to metres/Y-up; origin shifted so the feet rest on the stage; meshes named to catalog ids; Draco compression.
  English concept names and element membership follow the official IS-A tables (3,432 FMA concepts over 2,234 meshes).
- Z-Anatomy — the libre 3D atlas of anatomy, licensed under CC BY-SA 4.0.
  https://www.z-anatomy.com/ — source `Z-Anatomy.zip` from https://github.com/Z-Anatomy/The-blend
  1,957 anatomical meshes in the male module come from Z-Anatomy: the peripheral nerves and
  named ligaments, plus muscle, vessel and lymphoid detail BodyParts3D does not
  model. Z-Anatomy is itself derived from BodyParts3D.
  Adaptations: objects selected where BodyParts3D had no equivalent structure;
  nerve and vessel curves converted to tube meshes at reduced tessellation;
  world transforms baked; materials dropped; renamed to catalog ids; Draco compression.

  **Because Z-Anatomy is share-alike, the combined 3D mesh dataset in this
  application is distributed under CC BY-SA 4.0.** Attribute it as
  "Z-Anatomy — the libre 3D atlas of anatomy — CC BY-SA 4.0" and license any
  derivative of the meshes under the same terms.
- Human Reference Atlas / HuBMAP 3D Reference Organ Set for Female v1.5 (Kristen Browne and Heidi Schlehlein), CC BY 4.0.
  DOI: 10.48539/HBM352.BTSQ.586
  Source: `3d-vh-f-united.glb`. Female module uses these real female meshes only. It is not a complete female whole-body cadaver.
- Oklahoma State University bony pelvis and pelvic organs (Audrey Byrd et al.), CC BY 4.0, published on Sketchfab.
  Direct download requires a Sketchfab account; HRA female pelvis is shipped as the open female bony pelvis until that file can be fetched.

## Additional female geometry

Human Reference Atlas / HuBMAP 3D Reference Organ Set, United Female v1.10,
CC BY 4.0. Seventy-eight additional mesh objects.
Source: https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb
Record: https://lod.humanatlas.io/ref-organ/united-female/v1.10
Adaptations: shared-landmark registration, world transforms baked,
simplification, uniform materials, renamed identifiers and Draco compression.
Provenance: data/hra-supplement.json.

## Cross-sections

- Visible Human Project images courtesy of the U.S. National Library of Medicine.
  https://www.nlm.nih.gov/research/visible/visible_human.html

## Text

- Structure summaries in this repo are original study notes for education.
- OpenStax Anatomy and Physiology 2e may be quoted with attribution, CC BY 4.0.

This application is an educational tool, not a medical device. It is not for diagnosis or treatment.

## HRA male lung reference

Human Reference Atlas / HuBMAP United Male v1.10, CC BY 4.0.
https://lod.humanatlas.io/ref-organ/united-male/v1.10
Source: https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.10/assets/3d-vh-m-united.glb
Twenty bronchopulmonary segment surfaces, extracted with world transforms,
uniformly scaled/translated for isolated display, renamed and Draco compressed.
Separate donor reference, not validated registration to the BodyParts3D body.
Provenance and exact transform: data/hra-male-lungs.json.
