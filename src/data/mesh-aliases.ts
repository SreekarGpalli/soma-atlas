/**
 * Bridges the hand-written high-yield notes to real meshes.
 *
 * The notes were written against friendly names ("Cervical vertebrae",
 * "Quadriceps femoris"). BodyParts3D names the same things differently
 * ("Cervical vertebral column", "Right vastus lateralis"), so without this map
 * the best-annotated structures in the atlas selected nothing in the 3D view.
 *
 * Each entry is a list of matchers against catalog rows:
 *   - a plain string matches a catalog id exactly
 *   - a RegExp matches the structure name
 * Every matching row contributes its meshes.
 */
export const MESH_ALIASES: Record<string, (string | RegExp)[]> = {
  cranium: ["neurocranium", "viscerocranium"],
  "cervical-spine": ["cervical-vertebral-column"],
  "thoracic-cage": ["rib-cage"],
  "lumbar-spine": [/^(first|second|third|fourth|fifth) lumbar vertebra$/i],
  "male-pelvis-bone": ["bony-pelvis"],
  "female-pelvis-bone": ["bony-pelvis"],
  "pectoralis-major": [/^(left|right) pectoralis major$/i],
  quadriceps: [
    /^(left|right) rectus femoris$/i,
    /^(left|right) vastus (lateralis|medialis|intermedius)$/i,
  ],
  gastrocnemius: [/head of (left|right) gastrocnemius$/i],
  "biceps-brachii": [/head of (left|right) biceps brachii$/i],
  "triceps-brachii": [/head of (left|right) triceps brachii$/i],
  "gluteus-maximus": [/^(left|right) gluteus maximus$/i],
  intestines: ["small-intestine", "large-intestine"],
  "female-bladder": [/^urinary bladder$/i],
  bladder: [/^urinary bladder$/i],
  "uterine-tube": [/uterine tube$/i],
  adrenal: ["adrenal-gland", /^(left|right) adrenal gland$/i],
  eye: [/^(left|right) eye$/i],
  ear: ["external-ear"],
  brain: ["brain"],
  heart: ["heart"],
  liver: ["liver"],
  stomach: ["stomach"],
  spleen: [/^spleen$/i],
  pancreas: [/^pancreas$/i],
  lungs: [/^(left|right) lung$/i],
  kidneys: [/^(left|right) kidney$/i],
  trachea: [/^trachea$/i],
  diaphragm: [/^(thoracic )?diaphragm$/i],
  aorta: [/^(ascending |descending )?aorta$/i, /^(aortic arch|arch of aorta)$/i],
  ivc: [/^inferior vena cava$/i],
  "spinal-cord": ["spinal-cord"],
  femur: [/^(left|right) femur$/i],
  tibia: [/^(left|right) tibia$/i],
  humerus: [/^(left|right) humerus$/i],
  "radius-ulna": [/^(left|right) (radius|ulna)$/i],
  "clavicle-scapula": [/^(left|right) (clavicle|scapula)$/i],
  prostate: [/^prostate$/i],
  testis: [/^(left|right) testis$/i],
  uterus: [/^uterus$/i],
  cervix: [/^(uterine )?cervix$/i],
  vagina: [/^vagina$/i],
  "ovary-left": [/^left ovary$/i],
  "ovary-right": [/^right ovary$/i],

  breast: [/^(left|right) breast$/i],
  mandible: [/^mandible$/i],
  deltoid: [/^(left|right) deltoid$/i],
  "femoral-artery": [/^(left|right) femoral artery$/i],
  "brachial-artery": [/^(left|right) brachial artery$/i],
  "broad-ligament": [/^broad ligament of uterus$/i],
  ureters: [/^(left|right) ureter$/i],
};

/**
 * High-yield notes whose structure genuinely has no mesh in either open
 * dataset. BodyParts3D 4.0 ships brain and cranial nerves but no peripheral
 * nerves, and no muscles of facial expression or mastication. Rather than
 * silently selecting nothing, the card says so.
 */
export const NO_MESH_REASON: Record<string, string> = {
  "sciatic-nerve": "peripheral nerves",
  "femoral-nerve": "peripheral nerves",
  "median-nerve": "peripheral nerves",
  "ulnar-nerve": "peripheral nerves",
  "radial-nerve": "peripheral nerves",
  "phrenic-nerve": "peripheral nerves",
  "pudendal-nerve": "peripheral nerves",
  "obturator-nerve": "peripheral nerves",
  "brachial-plexus": "peripheral nerves",
  temporalis: "muscles of mastication",
  masseter: "muscles of mastication",
  "rectus-abdominis": "anterior abdominal wall muscles",
  "perineal-body": "perineal soft tissue",
  thyroid: "the thyroid gland (BodyParts3D ships only the thyroid cartilage)",
  deltoid: "the deltoid muscle",
};
