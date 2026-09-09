#!/usr/bin/env python3
"""Ingest BodyParts3D 4.0 99% OBJ meshes into per-system GLBs + catalog JSON."""

from __future__ import annotations

import json
import re
import struct
import zipfile
from array import array
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
WORK = ROOT / "data" / "work"
OBJ_DIR = WORK / "bp3d"
GLB_DIR = WORK / "glb" / "male"
CATALOG = ROOT / "src" / "data" / "catalog-male.json"
MAP_PATH = ROOT / "src" / "data" / "mesh-map.json"

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942

SYSTEM_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("femaleReproductive", ("uterus", "ovary", "ovari", "vagina", "cervix", "uterine tube", "fallopian", "mammary", "breast", "clitoris", "vulva", "labium", "endometrium", "myometrium")),
    ("maleReproductive", ("prostate", "testis", "testicle", "epididymis", "penis", "vas deferens", "ductus deferens", "seminal", "scrotum", "spermatic", "glans")),
    ("sensory", ("eye", "retina", "cornea", "lens of", "cochlea", "ear", "tympanic", "ossicle", "malleus", "incus", "stapes", "sclera", "iris", "eyelid", "optic nerve", "vestibul")),
    ("nervous", ("nerve", "brain", "spinal cord", "ganglion", "plexus", "cortex", "cerebr", "cerebell", "thalamus", "hypothalamus", "hippocamp", "meninges", "dura mater", "arachnoid", "pia mater", "white matter", "grey matter", "gray matter", "lemniscus", "fasciculus", "cranial", "neuron", "synapse")),
    ("cardiovascular", ("artery", "vein", "aorta", "heart", "atrium", "ventricle of heart", "vena cava", "coronary", "vascular", "capillary", "blood")),
    ("lymphatic", ("lymph", "spleen", "thymus", "tonsil", "thoracic duct")),
    ("muscular", (
        "muscle", "tendon", "muscul", "diaphragm", "platysma",
        "biceps", "triceps", "gluteus", "vastus", "gastrocnemius", "soleus",
        "latissimus", "trapezius", "rhomboid", "serratus", "flexor", "extensor",
        "adductor", "abductor", "levator", "depressor", "sphincter", "masseter",
        "temporalis", "pterygoid", "deltoid", "pectoralis", "supinator", "pronator",
        "iliacus", "psoas", "piriformis", "obturator internus", "gemellus",
        "popliteus", "tibialis", "peroneus", "fibularis", "lumbrical",
        "orbicularis", "zygomaticus", "buccinator", "sternocleidomastoid",
        "scalene", "splenius", "erector", "transversus", "obliquus", "pyramidalis",
        "cremaster", "ischiocavernosus", "bulbospongiosus", "anconeus",
        "brachialis", "coracobrachialis", "thenar", "hypothenar",
    )),
    ("respiratory", ("lung", "trachea", "bronchus", "bronchi", "larynx", "alveol", "pleura")),
    ("urinary", ("kidney", "ureter", "bladder", "urethra", "renal", "nephron")),
    ("digestive", ("liver", "stomach", "intestin", "colon", "ileum", "jejunum", "duodenum", "pancreas", "esophag", "oesophag", "gallbladder", "bile", "rectum", "anal", "pharynx", "tongue", "tooth", "teeth", "parotid", "submandibular", "salivary", "omentum", "mesenter", "appendix", "cecum", "caecum")),
    ("endocrine", ("thyroid", "adrenal", "suprarenal", "pituitary", "hypophysis", "pineal", "parathyroid")),
    ("skeletal", ("bone", "vertebra", "rib", "skull", "cranium", "femur", "tibia", "fibula", "humerus", "radius", "ulna", "clavicle", "scapula", "sternum", "pelvis", "ilium", "ischium", "pubis", "sacrum", "coccyx", "patella", "carpal", "tarsal", "metacarpal", "metatarsal", "phalanx", "mandible", "maxilla", "hyoid", "cartilage", "ligament", "joint", "disc", "disk", "meniscus", "acetabulum", "condyle", "calcaneus", "talus")),
    ("integumentary", ("skin", "dermis", "epidermis", "fascia", "hypodermis", "hair", "nail", "subcutaneous")),
]

REGION_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("head", ("head", "skull", "cranium", "brain", "eye", "ear", "mandible", "maxilla", "nasal", "orbit", "face", "temporal", "frontal bone", "occipital", "parietal", "sphenoid", "ethmoid", "tooth", "tongue", "parotid", "cerebral", "cerebell")),
    ("neck", ("neck", "cervical", "hyoid", "thyroid", "pharynx", "larynx")),
    ("thorax", ("thorax", "thoracic", "heart", "lung", "rib", "sternum", "breast", "mammary", "trachea", "esophag", "oesophag", "mediastin")),
    ("abdomen", ("abdom", "liver", "stomach", "intestin", "colon", "kidney", "spleen", "pancreas", "lumbar", "omentum", "ileum", "jejunum", "duodenum")),
    ("malePelvis", ("prostate", "penis", "testis", "scrotum", "epididymis")),
    ("femalePelvis", ("uterus", "ovary", "vagina", "cervix", "fallopian")),
    ("perineum", ("perine", "anal canal", "pudendal")),
    ("upperLimb", ("humerus", "radius", "ulna", "carpal", "metacarpal", "hand", "thumb", "finger", "scapula", "clavicle", "brachial", "axillar", "shoulder", "elbow", "wrist", "forearm", "arm ")),
    ("lowerLimb", ("femur", "tibia", "fibula", "patella", "tarsal", "metatarsal", "foot", "toe", "femoral", "sciatic", "glute", "thigh", "knee", "ankle", "hip", "calcaneus")),
    ("back", ("spinal cord", "vertebra", "sacrum", "coccyx")),
]

HIGH_YIELD_IDS = {
    "cranium": ("skull", "cranium", "neurocranium"),
    "mandible": ("mandible",),
    "cervical-spine": ("cervical vertebra",),
    "thoracic-cage": ("rib cage", "thoracic skeleton", "set of ribs"),
    "lumbar-spine": ("lumbar vertebra",),
    "male-pelvis-bone": ("bony pelvis", "pelvis", "hip bone"),
    "femur": ("right femur", "femur"),
    "tibia": ("right tibia", "tibia"),
    "humerus": ("right humerus", "humerus"),
    "radius-ulna": ("right radius", "radius"),
    "clavicle-scapula": ("right clavicle", "clavicle"),
    "temporalis": ("temporalis", "temporal muscle"),
    "masseter": ("masseter",),
    "sternocleidomastoid": ("sternocleidomastoid",),
    "pectoralis-major": ("pectoralis major",),
    "rectus-abdominis": ("rectus abdominis",),
    "gluteus-maximus": ("gluteus maximus",),
    "quadriceps": ("rectus femoris", "quadriceps"),
    "gastrocnemius": ("gastrocnemius",),
    "biceps-brachii": ("biceps brachii",),
    "triceps-brachii": ("triceps brachii",),
    "deltoid": ("deltoid",),
    "heart": ("heart",),
    "aorta": ("aorta", "ascending aorta", "arch of aorta"),
    "ivc": ("inferior vena cava",),
    "femoral-artery": ("femoral artery", "right femoral artery"),
    "brachial-artery": ("brachial artery", "right brachial artery"),
    "brain": ("brain", "telencephalon"),
    "spinal-cord": ("spinal cord",),
    "brachial-plexus": ("brachial plexus",),
    "sciatic-nerve": ("sciatic nerve", "right sciatic nerve"),
    "femoral-nerve": ("femoral nerve", "right femoral nerve"),
    "median-nerve": ("median nerve", "right median nerve"),
    "ulnar-nerve": ("ulnar nerve", "right ulnar nerve"),
    "radial-nerve": ("radial nerve", "right radial nerve"),
    "phrenic-nerve": ("phrenic nerve",),
    "pudendal-nerve": ("pudendal nerve",),
    "obturator-nerve": ("obturator nerve",),
    "lungs": ("lung", "right lung"),
    "trachea": ("trachea",),
    "diaphragm": ("diaphragm",),
    "liver": ("liver",),
    "stomach": ("stomach",),
    "intestines": ("small intestine", "intestine"),
    "spleen": ("spleen",),
    "pancreas": ("pancreas",),
    "kidneys": ("right kidney", "kidney"),
    "ureters": ("right ureter", "ureter"),
    "bladder": ("urinary bladder",),
    "prostate": ("prostate",),
    "testis": ("right testis", "testis"),
    "thyroid": ("thyroid gland", "thyroid"),
    "adrenal": ("right suprarenal gland", "suprarenal gland", "adrenal"),
    "eye": ("right eyeball", "eyeball", "eye"),
    "ear": ("right ear", "external ear", "ear"),
}


def slug(name: str) -> str:
    s = name.lower().replace("'", "")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:80] or "structure"


def classify(name: str, rules: list[tuple[str, tuple[str, ...]]], default: str) -> str:
    n = name.lower()
    for label, keys in rules:
        for k in keys:
            if re.search(rf"(^|[^a-z]){re.escape(k)}([^a-z]|$)", n):
                return label
    return default


def muscle_layer(name: str, system: str) -> int:
    if system != "muscular":
        return 1
    n = name.lower()
    if any(k in n for k in ("platysma", "subcutaneous", "dartos")):
        return 1
    if any(k in n for k in ("psoas", "quadratus lumborum", "iliacus", "piriformis", "obturator internus", "pelvic")):
        return 3
    return 2


def parse_table(path: Path) -> list[list[str]]:
    rows = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.strip() or line.lower().startswith("concept"):
            continue
        rows.append(line.split("\t"))
    return rows


def extract_zip() -> None:
    zpath = RAW / "isa_BP3D_4.0_obj_99.zip"
    if not zpath.exists():
        raise SystemExit(f"missing {zpath}")
    OBJ_DIR.mkdir(parents=True, exist_ok=True)
    marker = OBJ_DIR / ".extracted"
    if marker.exists() and any(OBJ_DIR.rglob("*.obj")):
        print("objs already extracted")
        return
    print("extracting", zpath)
    with zipfile.ZipFile(zpath) as zf:
        zf.extractall(OBJ_DIR)
    marker.write_text("ok", encoding="utf-8")


def index_objs() -> dict[str, Path]:
    out: dict[str, Path] = {}
    for p in OBJ_DIR.rglob("*.obj"):
        out[p.stem.upper()] = p
    print("obj files", len(out))
    return out


def parse_obj(path: Path) -> tuple[list[float], list[int]]:
    verts: list[tuple[float, float, float]] = []
    indices: list[int] = []
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if line.startswith("v "):
                parts = line.split()
                x, y, z = float(parts[1]), float(parts[2]), float(parts[3])
                # mm Z-up → meters Y-up
                verts.append((x / 1000.0, z / 1000.0, -y / 1000.0))
            elif line.startswith("f "):
                ids = []
                for tok in line.split()[1:]:
                    raw = tok.split("/")[0]
                    if not raw:
                        continue
                    i = int(raw)
                    ids.append(i - 1 if i > 0 else len(verts) + i)
                if len(ids) < 3:
                    continue
                for k in range(1, len(ids) - 1):
                    indices.extend((ids[0], ids[k], ids[k + 1]))
    pos: list[float] = []
    for x, y, z in verts:
        pos.extend((x, y, z))
    return pos, indices


def pad4(n: int) -> int:
    return (4 - (n % 4)) % 4


def write_glb(path: Path, meshes: list[dict]) -> None:
    bin_buf = bytearray()
    accessors = []
    views = []
    gl_meshes = []
    nodes = []

    def add_view(data: bytes, target: int) -> int:
        nonlocal bin_buf
        pad = pad4(len(bin_buf))
        if pad:
            bin_buf.extend(b"\x00" * pad)
        offset = len(bin_buf)
        bin_buf.extend(data)
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data), "target": target})
        return len(views) - 1

    for i, mesh in enumerate(meshes):
        pos = array("f", mesh["positions"])
        idxs = mesh["indices"]
        max_i = max(idxs) if idxs else 0
        if max_i > 65534:
            idx_arr = array("I", idxs)
            idx_type = 5125
        else:
            idx_arr = array("H", idxs)
            idx_type = 5123
        pos_bytes = pos.tobytes()
        idx_bytes = idx_arr.tobytes()
        pos_view = add_view(pos_bytes, 34962)
        idx_view = add_view(idx_bytes, 34963)
        nvert = len(mesh["positions"]) // 3
        xs = mesh["positions"][0::3] or [0.0]
        ys = mesh["positions"][1::3] or [0.0]
        zs = mesh["positions"][2::3] or [0.0]
        accessors.append(
            {
                "bufferView": pos_view,
                "componentType": 5126,
                "count": nvert,
                "type": "VEC3",
                "min": [min(xs), min(ys), min(zs)],
                "max": [max(xs), max(ys), max(zs)],
            }
        )
        pos_acc = len(accessors) - 1
        accessors.append(
            {
                "bufferView": idx_view,
                "componentType": idx_type,
                "count": len(idxs),
                "type": "SCALAR",
            }
        )
        idx_acc = len(accessors) - 1
        gl_meshes.append(
            {
                "name": mesh["id"],
                "primitives": [
                    {
                        "attributes": {"POSITION": pos_acc},
                        "indices": idx_acc,
                        "mode": 4,
                    }
                ],
                "extras": {
                    "fmaId": mesh.get("fmaId"),
                    "system": mesh.get("system"),
                    "elementId": mesh.get("elementId"),
                },
            }
        )
        nodes.append({"mesh": i, "name": mesh["id"]})

    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "glsc-atlas BodyParts3D ingest",
        },
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": gl_meshes,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(bin_buf)}],
    }
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * pad4(len(json_bytes))
    bin_padded = bytes(bin_buf) + b"\x00" * pad4(len(bin_buf))
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_padded)
    header = struct.pack("<4sII", b"glTF", 2, total)
    json_header = struct.pack("<II", len(json_bytes), JSON_CHUNK)
    bin_header = struct.pack("<II", len(bin_padded), BIN_CHUNK)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + json_header + json_bytes + bin_header + bin_padded)


def apply_origin(meshes: list[dict], origin: tuple[float, float, float]) -> None:
    ox, oy, oz = origin
    for mesh in meshes:
        pos = mesh["positions"]
        for i in range(0, len(pos), 3):
            pos[i] -= ox
            pos[i + 1] -= oy
            pos[i + 2] -= oz


def bbox_of(meshes: list[dict]) -> tuple[float, float, float, float, float, float]:
    xs, ys, zs = [], [], []
    for mesh in meshes:
        pos = mesh["positions"]
        xs.extend(pos[0::3])
        ys.extend(pos[1::3])
        zs.extend(pos[2::3])
    return min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)


def build_catalog_and_plan(objs: dict[str, Path]) -> tuple[list[dict], dict[str, list[dict]]]:
    parts = parse_table(RAW / "isa_parts_list_e.txt")
    elements = parse_table(RAW / "isa_element_parts.txt")
    name_by_fma = {r[0]: r[2] if len(r) > 2 else r[0] for r in parts}

    by_element: dict[str, list[tuple[str, str]]] = defaultdict(list)
    concept_size: dict[str, int] = defaultdict(int)
    for r in elements:
        if len(r) < 3:
            continue
        fma, name, eid = r[0], r[1], r[2].upper()
        by_element[eid].append((fma, name))
        concept_size[fma] += 1

    used_ids: set[str] = set()
    high_assigned: set[str] = set()
    catalog: list[dict] = []
    plan: dict[str, list[dict]] = defaultdict(list)

    def unique_id(base: str) -> str:
        if base not in used_ids:
            used_ids.add(base)
            return base
        n = 2
        while f"{base}-{n}" in used_ids:
            n += 1
        uid = f"{base}-{n}"
        used_ids.add(uid)
        return uid

    def match_high_yield(name: str) -> str | None:
        n = name.lower()
        for hid, keys in HIGH_YIELD_IDS.items():
            if hid in high_assigned:
                continue
            if any(n == k or n.startswith(k) for k in keys):
                return hid
        return None

    missing = 0
    for eid, concepts in sorted(by_element.items()):
        obj = objs.get(eid)
        if obj is None:
            missing += 1
            continue
        GENERIC = {
            "organ",
            "organ component",
            "anatomical entity",
            "anatomical set",
            "organ region",
            "organ chamber",
            "cell",
            "tissue",
            "portion of tissue",
            "material anatomical entity",
            "physical anatomical entity",
        }
        named = [c for c in concepts if c[1].lower() not in GENERIC]
        pool = named or concepts
        # most specific concept: fewest member elements, then longer name
        pool.sort(key=lambda c: (concept_size.get(c[0], 9999), -len(c[1]), c[0]))
        fma, name = pool[0]
        system = classify(name, SYSTEM_RULES, "skeletal")
        region = classify(name, REGION_RULES, "thorax")
        sex = "male" if system == "maleReproductive" else "both"
        hid = match_high_yield(name)
        sid = hid if hid else unique_id(slug(name))
        if hid:
            high_assigned.add(hid)
            used_ids.add(hid)
        rec = {
            "id": sid,
            "name": name[0].upper() + name[1:] if name else sid,
            "system": system,
            "region": region,
            "sex": sex,
            "aliases": list({slug(n) for _, n in concepts[1:6] if slug(n) != sid})[:6],
            "summary": (
                f"BodyParts3D 4.0 structure: {name} ({fma}). "
                f"{system.replace('maleReproductive', 'male reproductive').replace('femaleReproductive', 'female reproductive')} "
                f"anatomy of the {region} region."
            ),
            "fmaId": fma,
            "elementId": eid,
            "source": "bodyparts3d",
            "layer": muscle_layer(name, system),
        }
        if hid and hid != sid:
            rec["aliases"] = list({*rec["aliases"], sid})
        catalog.append(rec)
        plan[system].append(
            {
                "id": sid,
                "path": str(obj),
                "fmaId": fma,
                "system": system,
                "elementId": eid,
            }
        )

    print("catalog", len(catalog), "missing objs", missing, "systems", {k: len(v) for k, v in plan.items()})
    return catalog, plan


def scan_origin(plan: dict[str, list[dict]]) -> tuple[float, float, float]:
    mins = [1e9, 1e9, 1e9]
    maxs = [-1e9, -1e9, -1e9]
    scanned = 0
    for items in plan.values():
        for item in items:
            with Path(item["path"]).open("r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    if not line.startswith("v "):
                        continue
                    parts = line.split()
                    x, y, z = float(parts[1]) / 1000.0, float(parts[2]) / 1000.0, float(parts[3]) / 1000.0
                    px, py, pz = x, z, -y
                    mins[0] = min(mins[0], px)
                    mins[1] = min(mins[1], py)
                    mins[2] = min(mins[2], pz)
                    maxs[0] = max(maxs[0], px)
                    maxs[1] = max(maxs[1], py)
                    maxs[2] = max(maxs[2], pz)
            scanned += 1
            if scanned % 200 == 0:
                print("bbox scan", scanned)
    origin = ((mins[0] + maxs[0]) / 2.0, mins[1], (mins[2] + maxs[2]) / 2.0)
    print("origin", origin, "height", maxs[1] - mins[1])
    return origin[0], origin[1], origin[2]


def main() -> None:
    extract_zip()
    objs = index_objs()
    if not objs:
        raise SystemExit("no OBJ files")
    catalog, plan = build_catalog_and_plan(objs)
    CATALOG.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    origin = scan_origin(plan)

    combined: list[dict] = []
    mesh_map = []
    for system, items in plan.items():
        meshes = []
        for i, item in enumerate(items):
            pos, idx = parse_obj(Path(item["path"]))
            if len(idx) < 3 or len(pos) < 9:
                continue
            mesh = {
                "id": item["id"],
                "positions": pos,
                "indices": idx,
                "fmaId": item["fmaId"],
                "system": system,
                "elementId": item["elementId"],
            }
            meshes.append(mesh)
            if i % 50 == 0:
                print(system, i, "/", len(items))
        apply_origin(meshes, origin)
        write_glb(GLB_DIR / f"{system}.glb", meshes)
        print("wrote", system, "meshes", len(meshes))
        combined.extend(meshes)
        mesh_map.extend(
            {"id": m["id"], "system": system, "elementId": m["elementId"], "fmaId": m["fmaId"]}
            for m in meshes
        )

    write_glb(WORK / "glb" / "male-body.glb", combined)
    MAP_PATH.write_text(json.dumps(mesh_map, indent=2), encoding="utf-8")
    print("done male meshes", len(combined))


if __name__ == "__main__":
    main()
