/**
 * Tissue class within a system, for colour and for filtering.
 *
 * The system filters were the only way to subdivide the body, and two systems
 * are far too coarse for what a student is actually looking at. Cardiovascular
 * is 1,872 structures — 1,052 arteries, 639 veins, 88 heart — all drawn in one
 * red, so the venous tree is invisible inside the arterial one. Nervous is 899,
 * with the brain as a solid mass and every peripheral nerve as a thread beside
 * it, all in one yellow.
 *
 * Splitting on tissue restores the convention every anatomy atlas and textbook
 * uses: arteries red, veins blue, nerves yellow. It is what the eye already
 * expects, so it reads as normal rather than as a visual effect.
 */
export type TissueId = "artery" | "vein" | "nerve" | "lymph" | "bone" | "muscle" | "other";

/**
 * Order matters. "Vein" is tested before "artery" so a vena comitans of an
 * artery lands with the veins, and nerve is tested after both so that the
 * artery *to* a nerve stays arterial.
 */
const RULES: [TissueId, RegExp][] = [
  ["vein", /\b(vein|veins|venous|venule|vena)\b/i],
  ["artery", /\b(artery|arteries|arterial|arteriole|aorta|aortic|arch of aorta|truncus)\b/i],
  ["lymph", /\b(lymph|lymphatic|lymphoid|node|nodes|thoracic duct|cisterna chyli)\b/i],
  ["nerve", /\b(nerve|nerves|plexus|ganglion|ganglia|ramus communicans|rootlet)\b/i],
  ["bone", /\b(bone|vertebra|rib|sternum|clavicle|scapula|humerus|radius|ulna|carpal|metacarpal|phalanx|femur|tibia|fibula|patella|tarsal|metatarsal|sacrum|coccyx|mandible|maxilla|skull|cartilage)\b/i],
  ["muscle", /\b(muscle|muscles|tendon|aponeurosis|fascia)\b/i],
];

/**
 * Brain and cord are nervous tissue but not nerves: they are bulk structures
 * that should keep the system colour rather than being drawn as a peripheral
 * nerve. Checked first so "nucleus of the facial nerve" is not a nerve.
 */
const CENTRAL = /\b(brain|cerebral|cerebellar|cerebellum|cortex|gyrus|gyri|sulcus|nucleus|nuclei|thalamus|hypothalamus|hippocampus|amygdala|medulla oblongata|pons|midbrain|colliculus|ventricle of|choroid plexus|spinal cord|tract|fasciculus|lemniscus|commissure|decussation|dura|arachnoid|pia|meninx|meninges|lobule|vermis)\b/i;

export function classifyTissue(name: string): TissueId {
  // Vessels can contain CNS adjectives (e.g. anterior cerebral artery).
  if (/\b(valve|sinoatrial node|atrioventricular node|choroid plexus)\b/i.test(name)) return "other";
  for (const [id, re] of RULES.slice(0, 2)) if (re.test(name)) return id;
  if (CENTRAL.test(name)) return "other";
  for (const [id, re] of RULES) if (re.test(name)) return id;
  return "other";
}

/**
 * Colours for the tissues that get their own. Anything absent keeps its
 * system colour, so this is an overlay on the existing palette rather than a
 * replacement for it.
 */
export const TISSUE_COLOR: Partial<Record<TissueId, string>> = {
  artery: "#d0453f",
  vein: "#4b7fc4",
  nerve: "#f2d24b",
  lymph: "#7fc4a8",
};

export const TISSUE_LABEL: Partial<Record<TissueId, string>> = {
  artery: "Arteries",
  vein: "Veins",
  nerve: "Nerves",
  lymph: "Lymphatics",
};
