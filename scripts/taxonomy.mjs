/**
 * Shared anatomical taxonomy rules.
 *
 * The generated BodyParts3D / HRA catalogs shipped with `system: "skeletal"` as
 * a catch-all, which put lungs, eyeballs and cranial nerves in the skeleton
 * bucket. These rules reclassify every row from its own name so that the system
 * filters, the per-system GLB packs and the colour coding all agree.
 *
 * Patterns are given as two lists per rule:
 *   words    - matched whole (`\bword\b`), so "rib" does not match "ribosome"
 *   prefixes - matched from a word start (`\bpre`), so "cerebell" matches
 *              "cerebellum". Writing these as whole words was the original bug.
 */

/**
 * FMA upper-ontology classes. They are not structures a student looks up, they
 * each aggregate hundreds-to-thousands of meshes, and they dominate search.
 */
export const ONTOLOGY_ROOTS = new Set([
  "physical-anatomical-entity",
  "anatomical-entity",
  "material-anatomical-entity",
  "immaterial-anatomical-entity",
  "anatomical-structure",
  "anatomical-set",
  "anatomical-cluster",
  "anatomical-junction",
  "anatomical-surface",
  "anatomical-line",
  "anatomical-point",
  "anatomical-space",
  "physical-anatomical-space",
  "cardinal-organ-part",
  "organ-region",
  "organ-segment",
  "organ-zone",
  "organ-component",
  "organ-part",
  "organ",
  "organ-subdivision",
  "organ-with-organ-cavity",
  "organ-with-cavitated-organ-parts",
  "cavitated-organ",
  "solid-organ",
  "parenchymatous-organ",
  "nonparenchymatous-organ",
  "body-proper",
  "body-compartment",
  "body-cavity",
  "body-cavity-content",
  "body-substance",
  "human-body",
  "subdivision-of-body-proper",
  "material-physical-anatomical-entity",
  "region-of-vascular-tree-organ",
  "segment-of-arterial-tree-organ",
  "segment-of-venous-tree-organ",
  "vascular-tree-organ",
  "tree-organ",
  "structure",
]);

function rule(words, prefixes = []) {
  const parts = [];
  if (words.length) parts.push(`\\b(?:${words.join("|")})\\b`);
  if (prefixes.length) parts.push(`\\b(?:${prefixes.join("|")})`);
  return new RegExp(parts.join("|"), "i");
}

// --------------------------------------------------------------------------
// Decisive rules, tested against the whole name.
// A "renal artery" is cardiovascular and a "nerve to obturator internus" is
// nervous, regardless of the organ they are named after.
// --------------------------------------------------------------------------

const NERVOUS = rule(
  [
    "nerve", "nerves", "nervous", "neural", "ganglion", "ganglia",
    "brain", "pons", "midbrain", "insula", "uncus", "precuneus", "cuneus",
    "operculum", "claustrum", "putamen", "pallidum", "globus pallidus",
    "substantia nigra", "locus coeruleus", "inferior olive", "obex",
    "area postrema", "corpus callosum", "septum pellucidum",
    "internal capsule", "external capsule", "corona radiata",
    "cerebral peduncle", "crus cerebri", "medulla oblongata",
    "red nucleus", "caudate nucleus", "dentate nucleus", "lentiform nucleus",
    "nucleus ambiguus", "nucleus cuneatus", "nucleus gracilis",
    "spinal cord", "cauda equina", "filum terminale", "conus medullaris",
    "dorsal root", "ventral root", "rootlet", "ramus communicans",
    "dura mater", "pia mater", "arachnoid", "falx cerebri", "falx cerebelli",
    "tentorium", "diaphragma sellae",
    "choroid plexus", "brachial plexus", "lumbar plexus", "sacral plexus",
    "cervical plexus", "coeliac plexus", "celiac plexus", "hypogastric plexus",
    "myenteric plexus", "submucosal plexus", "cardiac plexus",
    "nerve plexus", "plexus of nerves",
    "lateral ventricle", "third ventricle", "fourth ventricle",
    "ventricle of brain", "cerebral aqueduct", "central canal",
    "subarachnoid", "epidural space", "cerebrospinal",
    "optic chiasm", "optic tract", "optic radiation", "olfactory bulb",
    "olfactory tract", "solitary tract", "pyramidal tract",
    "corticospinal", "spinothalamic", "spinocerebellar",
    "white matter", "grey matter", "gray matter",
    "vermis", "culmen", "declive", "flocculus", "nodulus",
    "mammillary body", "habenula", "pituitary stalk",
  ],
  [
    "cerebr", "cerebell", "neuro", "thalam", "hypothalam", "subthalam",
    "epithalam", "diencephal", "telencephal", "mesencephal", "metencephal",
    "myelencephal", "rhombencephal", "prosencephal",
    "hippocamp", "amygdal", "meninge", "meninx", "meningeal",
    "colliculus", "geniculate", "tegmentum", "tectum",
    "lemniscus", "fasciculus", "gyrus", "gyri", "sulcus of brain",
    "olivary", "myelin", "axon", "dendrit", "astrocyt", "oligodendro",
  ],
);

const CARDIOVASCULAR = rule(
  [
    "vein", "veins", "vena", "aorta", "heart", "auricle of", "trabecula carnea",
    "left ventricle", "right ventricle", "ventricle of heart",
    "cardiac ventricle", "ventricular septum", "papillary muscle",
    "chorda tendinea", "chordae tendineae", "semilunar valve",
    "mitral valve", "tricuspid valve", "aortic valve", "pulmonary valve",
    "sinoatrial node", "atrioventricular node", "bundle of his",
    "purkinje", "conus arteriosus", "circle of willis",
    "cavernous sinus", "sigmoid sinus", "transverse sinus",
    "straight sinus", "sagittal sinus", "petrosal sinus", "occipital sinus",
    "confluence of sinuses", "coronary sinus", "carotid sinus", "carotid body",
    "brachiocephalic trunk", "coeliac trunk", "celiac trunk",
    "pulmonary trunk", "thyrocervical trunk", "costocervical trunk",
    "truncus arteriosus", "portal system", "vasculature",
  ],
  [
    "arter", "venul", "venous", "aortic", "capillar", "sinusoid",
    "myocardi", "endocardi", "epicardi", "pericardi",
    "atrium", "atrial", "atria", "interatrial", "interventricular",
    "atrioventricular", "sinoatrial", "coronary", "cardiac",
  ],
);

// --------------------------------------------------------------------------
// Organ rules, tested against the anatomical head noun first, then the whole
// name. Order matters: the first match wins.
// --------------------------------------------------------------------------

const SYSTEM_RULES = [
  [
    "lymphatic",
    rule(
      ["thoracic duct", "cisterna chyli", "spleen", "thymus", "peyer"],
      ["lymph", "lymphat", "lymphoid", "lymphonod", "splenic", "splenor",
       "tonsil", "thymic"],
    ),
  ],
  [
    "respiratory",
    rule(
      [
        "lung", "lungs", "carina", "epiglottis", "glottis", "vocal fold",
        "vocal ligament", "vestibular fold", "cricoid", "thyroid cartilage",
        "cricothyroid", "arytenoid", "corniculate", "cuneiform cartilage",
        "nasal cavity", "nasal concha", "nasal septum", "choana",
        "frontal sinus", "maxillary sinus", "sphenoidal sinus",
        "ethmoidal sinus", "ethmoidal air cell", "laryngeal ventricle",
        "nasopharynx",
      ],
      ["pulmon", "bronch", "alveol", "trache", "laryn", "pleura", "pleural",
       "paranasal", "respirat"],
    ),
  ],
  [
    "digestive",
    rule(
      [
        "tooth", "teeth", "gingiva", "gum", "tongue", "uvula", "palate",
        "pharynx", "oropharynx", "laryngopharynx", "stomach", "bowel",
        "caecum", "cecum", "colon", "rectum", "anal canal", "anus",
        "appendix", "mesoappendix", "liver", "gallbladder", "gall bladder",
        "bile duct", "cystic duct", "greater sac", "lesser sac", "rugae",
        "haustra", "taenia coli", "villus", "parotid", "salivary",
        "submandibular gland", "sublingual gland",
      ],
      [
        "dentin", "dental", "enamel", "cementum", "lingual", "palatin",
        "oesophag", "esophag", "gastri", "gastro", "pylor", "duoden",
        "jejun", "ileum", "ileal", "ileo", "colic", "sigmoid colon",
        "rectal", "intestin", "hepat", "biliar", "pancrea", "omentum",
        "omental", "mesenter", "mesocolon", "peritone", "plica circulari",
      ],
    ),
  ],
  [
    "urinary",
    rule(
      [
        "kidney", "kidneys", "nephron", "bowman", "loop of henle",
        "calyx", "calix", "calice", "renal pelvis", "ureter", "trigone",
        "urinary bladder", "detrusor",
      ],
      ["renal", "glomerul", "urethra", "urin", "urothel", "urogenit"],
    ),
  ],
  [
    "femaleReproductive",
    rule(
      [
        "cervix", "cervical canal", "ectocervix", "endocervix", "oviduct",
        "vulva", "labium majus", "labium minus", "labia", "hymen",
        "bartholin", "greater vestibular gland", "broad ligament",
        "round ligament of uterus", "suspensory ligament of ovary",
        "rectouterine", "vesicouterine", "pouch of douglas", "placenta",
        "nipple", "areola", "breast",
      ],
      [
        "uter", "myometri", "endometri", "perimetri", "ovary", "ovarian",
        "ovarium", "fallopian", "salping(?!opharyng)", "vagina", "clitor", "mammary",
        "lactifer", "mesovarium", "mesosalpinx", "mesometrium",
      ],
    ),
  ],
  [
    "maleReproductive",
    rule(
      [
        "vas deferens", "ductus deferens", "deferent duct", "seminal vesicle",
        "ejaculatory duct", "glans", "prepuce", "foreskin",
        "corpus cavernosum", "corpus spongiosum", "bulbourethral", "cowper",
        "tunica vaginalis", "gubernaculum", "pampiniform",
      ],
      [
        "prostat", "testis", "testes", "testicul", "epididym", "spermat",
        "scrotum", "scrotal", "penis", "penile", "cremaster", "seminifer",
      ],
    ),
  ],
  [
    "endocrine",
    rule(
      ["pituitary", "pineal", "thyroid gland", "islet", "langerhans"],
      ["hypophys", "parathyroid", "adrenal", "suprarenal", "endocrin"],
    ),
  ],
  [
    "sensory",
    rule(
      [
        "eye", "eyeball", "eyelid", "orbit", "cornea", "sclera", "iris",
        "pupil", "lens", "vitreous", "aqueous humour", "aqueous humor",
        "retina", "macula", "fovea", "conjunctiva", "caruncle",
        "tarsal plate", "levator palpebrae", "common tendinous ring",
        "superior rectus", "inferior rectus", "medial rectus",
        "lateral rectus", "superior oblique", "inferior oblique",
        "ear", "pinna", "auricle", "malleus", "incus", "stapes", "ossicle",
        "semicircular canal", "semicircular duct", "utricle", "saccule",
        "eustachian tube", "auditory tube", "pharyngotympanic",
        "organ of corti", "spiral organ", "taste bud", "olfactory epithelium",
      ],
      [
        "ocular", "ophthalm", "choroid(?! plexus)", "cilia", "retinal",
        "lacrimal", "nasolacrimal", "tympan", "cochlea", "vestibul(?!ar fold)",
        "labyrinth", "perilymph", "endolymph", "auditor",
      ],
    ),
  ],
  [
    "muscular",
    rule(
      [
        "muscle", "muscular", "musculus", "tendon", "diaphragm", "belly of",
        "rotator cuff", "raphe", "hamstring", "dartos",
      ],
      [
        "tendin", "aponeuros", "fascia", "sphincter", "levator", "levatores",
        "depressor", "flexor", "extensor", "abductor", "adductor",
        "pronator", "supinator", "rectus abdominis", "obliquus", "transversus",
        "latissimus", "trapezius", "deltoid", "pectoral", "serratus",
        "rhomboid", "sternocleidomastoid", "scalen", "masseter", "temporalis",
        "pterygoid", "buccinator", "orbicular", "zygomaticus", "risorius",
        "platysma", "mylohyoid", "digastric", "omohyoid", "sternohyoid",
        "sternothyroid", "thyrohyoid", "geniohyoid", "stylohyoid", "psoas",
        "iliacus", "iliococcygeus", "pubococcygeus", "coccygeus", "gluteus",
        "gluteal muscle", "piriformis", "obturator internus",
        "obturator externus", "gemellus", "quadratus", "sartorius",
        "gracilis", "pectineus", "quadriceps", "vastus", "biceps", "triceps",
        "brachialis", "brachioradialis", "coracobrachialis", "anconeus",
        "semitendinosus", "semimembranosus", "gastrocnemius", "soleus",
        "plantaris", "popliteus", "tibialis", "peroneus", "fibularis",
        "lumbrical", "interosseous muscle", "thenar", "hypothenar",
        "erector spinae", "multifidus", "rotatores", "rotator",
        "intercostal", "transversospinalis", "splenius", "longissimus",
        "iliocostalis", "spinalis", "semispinalis", "interspinal",
        "intertransvers", "longus colli", "longus capitis", "rectus capitis",
        "teres major", "teres minor", "subscapularis", "supraspinatus",
        "infraspinatus", "subclavius", "palmaris", "opponens", "articularis",
        "stylopharyngeus", "salpingopharyngeus", "palatopharyngeus",
        "palatoglossus", "genioglossus", "hyoglossus", "styloglossus",
        "constrictor", "cricoarytenoid", "thyroarytenoid", "vocalis",
        "tensor ", "stapedius", "auricularis", "corrugator", "procerus",
        "nasalis", "mentalis", "epicranius", "occipitofrontalis",
        "bulbospongiosus", "ischiocavernosus", "perinei", "costarum",
      ],
    ),
  ],
  [
    "integumentary",
    rule(
      ["skin", "hair", "nail", "sweat gland", "cutaneous tissue", "fat pad"],
      ["epiderm", "dermis", "dermal", "subcutane", "hypoderm", "sebaceous",
       "adipos", "panniculus"],
    ),
  ],
  [
    "skeletal",
    rule(
      [
        "bone", "bony", "osseous", "skeleton", "rib", "ribs", "sternum",
        "manubrium", "xiphoid", "clavicle", "scapula", "acromion", "coracoid",
        "humerus", "radius", "ulna", "scaphoid", "lunate", "triquetrum",
        "pisiform", "trapezium", "trapezoid", "capitate", "hamate",
        "pelvis", "pelvic girdle", "ilium", "ischium", "pubis", "acetabulum",
        "femur", "patella", "tibia", "fibula", "talus", "calcaneus",
        "navicular", "cuboid", "skull", "cranium", "calvaria", "sphenoid",
        "ethmoid", "vomer", "hyoid", "maxilla", "mandible", "occipital bone",
        "foramen", "fossa", "condyle", "epicondyle", "tubercle", "tuberosity",
        "trochanter", "trochlea", "malleolus", "styloid process",
        "mastoid", "suture", "joint", "meniscus", "labrum", "symphysis",
        "periosteum", "marrow", "nucleus pulposus", "annulus fibrosus",
        "notch", "groove", "crest", "spine of", "spinous process",
        "transverse process", "articular process",
      ],
      [
        "vertebra", "vertebral", "intervertebral", "sacrum", "sacral(?! plexus)",
        "coccyx", "coccyge", "costal", "carpal", "metacarp", "metatars",
        "tarsal", "phalanx", "phalange", "iliac(?! artery| vein)",
        "ischial", "pubic", "cranial(?! nerve)", "zygomatic", "palatine bone",
        "lacrimal bone", "nasal bone", "parietal bone", "frontal bone",
        "temporal bone", "articular", "articulat", "synovial", "ligament",
        "cartilag", "chondr", "epiphys", "diaphys", "metaphys", "physis",
        "osteo", "sesamoid",
      ],
    ),
  ],
];

/**
 * BodyParts3D names read "<part> of <whole>". The system almost always follows
 * the whole, so "Renal impression of liver" is digestive and "Body of stomach"
 * is digestive — which is why organ rules try the head noun first.
 */
function headOf(name) {
  const m = name.match(/\bof\s+(?:the\s+)?(.+)$/i);
  return m ? m[1] : name;
}

export function classifySystem(name, fallback = "skeletal") {
  if (NERVOUS.test(name)) return "nervous";
  if (CARDIOVASCULAR.test(name)) return "cardiovascular";

  const head = headOf(name);
  for (const [system, re] of SYSTEM_RULES) if (re.test(head)) return system;
  for (const [system, re] of SYSTEM_RULES) if (re.test(name)) return system;
  return fallback;
}

const REGION_RULES = [
  [
    "head",
    rule(
      [
        "head", "skull", "cranium", "calvaria", "brain", "pons", "midbrain",
        "medulla oblongata", "eye", "eyeball", "eyelid", "orbit", "cornea",
        "sclera", "iris", "lens", "retina", "ear", "nose", "scalp", "face",
        "tooth", "teeth", "gingiva", "tongue", "palate", "parotid",
        "maxilla", "mandible", "vomer", "sphenoid", "ethmoid",
        "occipital bone", "frontal bone", "parietal bone", "temporal bone",
        "zygomatic bone", "optic chiasm", "optic nerve", "optic tract",
        "olfactory bulb", "olfactory tract", "cranial nerve", "trigeminal",
        "oculomotor", "trochlear nerve", "abducens", "facial nerve",
        "vestibulocochlear", "glossopharyngeal", "vagus", "hypoglossal",
        "accessory nerve", "choroid plexus", "lateral ventricle",
        "third ventricle", "fourth ventricle", "cavernous sinus",
        "sagittal sinus", "sigmoid sinus", "transverse sinus",
        "petrosal sinus", "straight sinus", "circle of willis",
        "dura mater", "pia mater", "arachnoid", "falx cerebri", "tentorium",
      ],
      [
        "cerebr", "cerebell", "thalam", "hypothalam", "hippocamp", "amygdal",
        "pituitary", "hypophys", "pineal", "colliculus", "geniculate",
        "ocular", "ophthalm", "lacrimal", "nasolacrimal", "tympan", "cochlea",
        "auditor", "cilia", "nasal", "paranasal", "maxillary sinus", "frontal sinus",
        "ethmoidal", "sphenoidal sinus", "masseter", "temporalis", "pterygoid",
        "gyrus", "gyri", "meninge",
        // added with the Z-Anatomy merge
        "sulcus", "sulci", "lobule", "vermis", "culmen", "declive", "uvula",
        "adenohypophys", "neurohypophys", "infundibul", "occipit", "temporal",
        "orbital", "zygomatic", "buccinator", "digastric", "mylohyoid",
        "geniohyoid", "stylohyoid", "angular arter", "angular vein", "facial arter",
        "facial vein", "auricul", "labyrinth", "vestibul(?!e of vagina)",
        "mandibul", "retromandibul", "temporomandibul", "premolar", "incisor",
        "canine tooth", "molar", "labial", "alveolar", "palatine", "lingual",
        "submandibul", "sublingual", "pterion", "nuchal",
      ],
    ),
  ],
  [
    "neck",
    rule(
      ["neck", "hyoid", "thyroid", "parathyroid", "pharynx", "atlas",
       "axis vertebra", "platysma", "omohyoid", "sternohyoid", "thyrohyoid",
       "sternocleidomastoid"],
      ["cervical(?! canal)", "laryn", "trache", "carotid", "jugular", "scalen",
       "cricoid", "cricothyroid", "arytenoid", "epiglott", "vocal"],
    ),
  ],
  [
    "thorax",
    rule(
      ["thorax", "heart", "lung", "lungs", "rib", "ribs", "sternum",
       "manubrium", "xiphoid", "breast", "nipple", "areola", "thymus",
       "diaphragm", "azygos", "aorta", "carina"],
      ["thoracic", "cardiac", "myocardi", "pericardi", "atrium", "atrial",
       "pulmon", "bronch", "alveol", "pleura", "mediastin", "aortic",
       "oesophag", "esophag", "mammary", "intercostal", "pectoral", "coronary"],
    ),
  ],
  [
    "abdomen",
    rule(
      ["abdomen", "liver", "stomach", "caecum", "cecum", "colon", "bowel",
       "pyloric nodes", "retropyloric nodes", "subpyloric nodes",
       "suprapyloric node",
       "spleen", "kidney", "kidneys", "ureter", "linea alba", "inguinal",
       "gallbladder", "portal vein", "inferior vena cava", "appendix",
       "mesoappendix"],
      ["abdomin", "hepat", "gastri", "duoden", "jejun", "ileum", "ileo",
       "intestin", "splenic", "pancrea", "renal", "suprarenal", "adrenal",
       "lumbar(?! vertebra| spine| disk| disc)", "omentum", "omental",
       "mesenter", "peritone", "coeliac",
       "celiac", "psoas"],
    ),
  ],
  [
    "malePelvis",
    rule(
      ["vas deferens", "ductus deferens", "deferent duct", "seminal vesicle",
       "ejaculatory duct", "glans", "prepuce", "bulbourethral"],
      ["prostat", "testis", "testes", "testicul", "epididym", "spermat",
       "scrotum", "scrotal", "penis", "penile", "cremaster", "pampiniform"],
    ),
  ],
  [
    "femalePelvis",
    rule(
      ["cervix", "oviduct", "broad ligament", "round ligament of uterus",
       "rectouterine", "vesicouterine"],
      ["uter", "myometri", "endometri", "ovary", "ovarian", "fallopian",
       "salping", "vagina", "mesovarium", "mesosalpinx"],
    ),
  ],
  [
    "perineum",
    rule(
      ["anal canal", "anus", "levator ani", "urogenital diaphragm", "vulva",
       "labium", "bulb of vestibule", "bartholin"],
      ["perine", "pudendal", "ischioanal", "ischiorectal", "clitor",
       "bulbospongiosus", "ischiocavernosus", "pubococcyge", "iliococcyge",
       "coccygeus", "puborectal", "pubovaginal", "puboprostatic"],
    ),
  ],
  [
    "upperLimb",
    rule(
      ["upper limb", "arm", "forearm", "shoulder", "axilla", "humerus",
       "radius", "ulna", "scaphoid", "lunate", "triquetrum", "pisiform",
       "trapezium", "capitate", "hamate", "hand", "thumb", "finger", "palm",
       "wrist", "elbow", "olecranon", "scapula", "clavicle", "acromion",
       "coracoid", "rotator cuff", "teres major", "teres minor"],
      ["axillar", "carpal", "metacarp", "brachi", "antebrach", "palmar",
       "deltoid", "thenar", "hypothenar", "supraspinat", "infraspinat",
       "subscapular", "latissimus", "subclavius", "opponens",
       // added with the Z-Anatomy merge
       "ulnar", "radial(?! fiber)", "acromioclavicular", "coracoclavicular",
       "coracohumeral", "glenohumeral", "glenoid", "cubital", "anconeus",
       "musculocutaneous", "median nerve", "pronator", "supinator",
       "flexor carpi", "extensor carpi", "brachioradialis", "lumbrical",
       "sternoclavicular", "interosseous membrane of forearm"],
    ),
  ],
  [
    "lowerLimb",
    rule(
      ["lower limb", "thigh", "leg", "hip", "femur", "patella", "knee",
       "tibia", "fibula", "calf", "ankle", "talus", "calcaneus", "navicular",
       "cuboid", "foot", "toe", "hallux", "sole", "hamstring"],
      ["gluteal", "gluteus", "femoral", "poplite", "tarsal", "metatars",
       "plantar", "sural", "saphenous", "sciatic", "quadriceps", "vastus",
       "sartorius", "gracilis", "adductor", "gastrocnemius", "soleus",
       "tibialis", "peroneus", "fibularis", "piriformis", "obturator",
       "iliac(?! artery)", "acetabul", "ischial", "pubic",
       // added with the Z-Anatomy merge
       "tibial", "fibular", "talocalcane", "talonavicular", "talofibular",
       "calcanea", "calcaneofibular", "patellar", "menisc", "anserine",
       "iliopectineal", "iliotibial", "cruciate", "collateral ligament of knee",
       "digitorum longus", "hallucis", "semitendinos", "semimembranos",
       "biceps femoris", "pectineus", "popliteus", "tibiofibular",
       "interosseous membrane of leg", "cuneiform", "lacunar node"],
    ),
  ],
  [
    "back",
    rule(
      ["back", "spinal cord", "spine", "cauda equina", "filum terminale",
       "lumbar vertebra", "lumbar spine",
       "erector spinae", "multifidus", "trapezius", "rhomboid", "nucleus pulposus"],
      ["vertebra", "vertebral", "intervertebral", "sacrum", "sacral",
       "coccyx", "coccyge", "paraspinal", "epidural", "semispinalis",
       "splenius", "longissimus", "iliocostalis",
       // added with the Z-Anatomy merge
       "corticospinal", "spinothalamic", "spinocerebellar", "thoracolumbar",
       "supraspinous", "interspinous", "ligamentum flavum"],
    ),
  ],
];

export function classifyRegion(name, fallback = "thorax") {
  const head = headOf(name);
  for (const [region, re] of REGION_RULES) if (re.test(head)) return region;
  for (const [region, re] of REGION_RULES) if (re.test(name)) return region;
  return fallback;
}

/** Rebuild the templated blurb the ingest scripts used to bake into every row. */
export function generatedSummary(name, system, fmaId, source) {
  const src =
    source === "hra" ? "Human Reference Atlas female v1.5" : "BodyParts3D 4.0";
  const sys = system
    .replace("maleReproductive", "male reproductive")
    .replace("femaleReproductive", "female reproductive");
  return `${src} structure: ${name}${fmaId ? ` (${fmaId})` : ""}. ${sys} anatomy.`;
}
