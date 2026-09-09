#!/usr/bin/env python3
"""Rebuild catalogs from ashemag BodyParts3D names + HRA female grouping."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ATLAS = json.loads((ROOT / "data/raw/ashemag-atlas.json").read_text(encoding="utf-8"))
MESH_MAP = json.loads((ROOT / "src/data/mesh-map.json").read_text(encoding="utf-8"))
FEMALE = json.loads((ROOT / "src/data/catalog-female.json").read_text(encoding="utf-8"))

SYS_MAP = {
    "skeletal": "skeletal",
    "muscular": "muscular",
    "arterial": "cardiovascular",
    "venous": "cardiovascular",
    "cardiac": "cardiovascular",
    "nervous": "nervous",
    "digestive": "digestive",
    "respiratory": "respiratory",
    "urinary": "urinary",
    "reproductive": "maleReproductive",
    "lymphatic": "lymphatic",
    "endocrine": "endocrine",
    "integumentary": "integumentary",
    "sensory": "sensory",
    "connective": "skeletal",
}

REGION_RULES = [
    ("head", ("head", "skull", "cranium", "brain", "eye", "ear", "mandible", "maxilla", "nasal", "orbit", "face", "tooth", "tongue", "cerebral", "cerebell", "gingiva")),
    ("neck", ("neck", "cervical", "hyoid", "thyroid", "pharynx", "larynx")),
    ("thorax", ("thorax", "thoracic", "heart", "lung", "rib", "sternum", "trachea", "aorta", "cardiac", "breast", "mammary")),
    ("abdomen", ("abdom", "liver", "stomach", "intestin", "colon", "kidney", "spleen", "pancreas", "lumbar", "ileum", "jejunum", "duodenum")),
    ("malePelvis", ("prostate", "penis", "testis", "scrotum", "epididymis")),
    ("femalePelvis", ("uterus", "ovary", "vagina", "cervix", "fallopian")),
    ("perineum", ("perine", "anal canal", "pudendal")),
    ("upperLimb", ("humerus", "radius", "ulna", "carpal", "metacarpal", "hand", "thumb", "finger", "scapula", "clavicle", "brachial", "shoulder", "elbow", "wrist", "forearm")),
    ("lowerLimb", ("femur", "tibia", "fibula", "patella", "tarsal", "metatarsal", "foot", "toe", "femoral", "glute", "thigh", "knee", "ankle")),
    ("back", ("spinal cord", "vertebra", "sacrum", "coccyx")),
]


def slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:80] or "structure"


def region_of(name: str, default: str = "thorax") -> str:
    n = f" {name.lower()} "
    for label, keys in REGION_RULES:
        for k in keys:
            if re.search(rf"(^|[^a-z]){re.escape(k)}([^a-z]|$)", n):
                return label
    return default


def title(name: str) -> str:
    if not name:
        return name
    return name[0].upper() + name[1:]


def summary(name: str, system: str, fma: str | None, source: str) -> str:
    src = "BodyParts3D 4.0" if source == "bodyparts3d" else "Human Reference Atlas female v1.5"
    sys = system.replace("maleReproductive", "male reproductive").replace("femaleReproductive", "female reproductive")
    fid = f" ({fma})" if fma else ""
    return f"{src} structure: {name}{fid}. {sys} anatomy."


def rebuild_male() -> list[dict]:
    parts = {p["id"]: p for p in ATLAS["parts"]}
    el_to_mesh = {m["elementId"]: m for m in MESH_MAP}
    rows = []
    used = set()
    for m in MESH_MAP:
        p = parts.get(m["elementId"])
        name = p["name"] if p else m["id"].replace("-", " ")
        # Keep the system of the GLB file this mesh actually lives in.
        system = m["system"]
        sid = m["id"]
        used.add(sid)
        fma = p["conceptId"] if p else m.get("fmaId")
        rows.append(
            {
                "id": sid,
                "name": title(name),
                "system": system,
                "region": region_of(name),
                "sex": "male" if system == "maleReproductive" else "both",
                "aliases": [m["elementId"]] + ([fma] if fma else []),
                "summary": summary(name, system, fma, "bodyparts3d"),
                "fmaId": fma,
                "elementId": m["elementId"],
                "source": "bodyparts3d",
                "meshIds": [sid],
                "layer": 2 if system == "muscular" else 1,
            }
        )

    # Named FMA concepts that group several meshes — this is how Heart/Lungs appear.
    for concept in ATLAS["concepts"]:
        elements = [e for e in concept.get("elements", []) if e in el_to_mesh]
        if len(elements) < 1:
            continue
        cid = slug(concept["name"])
        if cid in used:
            continue
        mesh_ids = [el_to_mesh[e]["id"] for e in elements]
        systems = [SYS_MAP.get(parts[e]["system"], "skeletal") for e in elements if e in parts]
        system = max(set(systems), key=systems.count) if systems else "skeletal"
        n = concept["name"].lower()
        if any(k in n for k in ("lung", "trachea", "bronch", "larynx", "pleura")):
            system = "respiratory"
        elif any(k in n for k in ("heart", "ventricle", "atrium", "aorta", "artery", "vein")):
            if "lung" not in n:
                system = "cardiovascular"
        elif any(k in n for k in ("liver", "stomach", "intestin", "colon", "pancreas", "esophag")):
            system = "digestive"
        elif any(k in n for k in ("kidney", "ureter", "bladder", "urethra")):
            system = "urinary"
        elif any(k in n for k in ("brain", "nerve", "spinal cord", "cortex")):
            system = "nervous"
        elif "muscle" in n:
            system = "muscular"
        elif any(k in n for k in ("bone", "vertebra", "skull", "femur")):
            system = "skeletal"
        used.add(cid)
        rows.append(
            {
                "id": cid,
                "name": title(concept["name"]),
                "system": system,
                "region": region_of(concept["name"]),
                "sex": "male" if system == "maleReproductive" else "both",
                "aliases": [concept["id"]],
                "summary": summary(concept["name"], system, concept["id"], "bodyparts3d"),
                "fmaId": concept["id"],
                "source": "bodyparts3d",
                "meshIds": mesh_ids,
                "layer": 1,
            }
        )
    return rows


FEMALE_GROUPS = [
    ("uterus", "Uterus", "femaleReproductive", "femalePelvis", ("uterus", "cervix", "fundus of uterus", "body of uterus")),
    ("lungs", "Lungs", "respiratory", "thorax", ("lung", "bronchopulmonary")),
    ("heart", "Heart", "cardiovascular", "thorax", ("heart", "ventricle", "atrium", "cardiac")),
    ("liver", "Liver", "digestive", "abdomen", ("liver", "hepatic")),
    ("brain", "Brain", "nervous", "head", ("brain", "gyrus", "putamen", "cortex", "allen")),
    ("kidneys", "Kidneys", "urinary", "abdomen", ("kidney", "renal")),
    ("breast", "Breast", "femaleReproductive", "thorax", ("mammary", "breast", "nipple", "areola", "lactiferous")),
    ("female-pelvis-bone", "Bony pelvis (female)", "skeletal", "femalePelvis", ("ilium", "ischium", "pubis", "sacrum", "coccyx", "pelvis")),
]


def rebuild_female() -> list[dict]:
    rows = []
    for r in FEMALE:
        row = dict(r)
        row["meshIds"] = [r["id"]]
        if "summary" not in row:
            row["summary"] = summary(r["name"], r["system"], r.get("fmaId"), "hra")
        rows.append(row)
    by_id = {r["id"]: r for r in rows}
    for cid, name, system, region, keys in FEMALE_GROUPS:
        kids = [
            r["id"]
            for r in rows
            if any(k in r["name"].lower() or k in r["id"] for k in keys)
            and r.get("meshIds") == [r["id"]]
        ]
        if not kids:
            continue
        if cid in by_id:
            by_id[cid]["meshIds"] = kids
            continue
        rows.append(
            {
                "id": cid,
                "name": name,
                "system": system,
                "region": region,
                "sex": "female",
                "aliases": [],
                "summary": summary(name, system, None, "hra"),
                "source": "hra",
                "meshIds": kids,
                "layer": 1,
            }
        )
    return rows


def main() -> None:
    male = rebuild_male()
    female = rebuild_female()
    (ROOT / "src/data/catalog-male.json").write_text(json.dumps(male, indent=2), encoding="utf-8")
    (ROOT / "src/data/catalog-female.json").write_text(json.dumps(female, indent=2), encoding="utf-8")
    from collections import Counter

    print("male", len(male), Counter(r["system"] for r in male))
    print("female", len(female), Counter(r["system"] for r in female))
    print("heart", next((r for r in male if r["id"] == "heart"), None))
    print("lungs", next((r for r in male if r["id"] == "left-lung" or r["id"] == "lung"), None))
    print("has lungs concept", any(r["id"] == "lung" or r["name"] == "Lung" for r in male))
    for key in ("heart", "lung", "liver", "brain", "stomach"):
        hits = [r["id"] for r in male if r["name"].lower() == key or r["id"] == key]
        print(key, hits[:5], "n", len([r for r in male if key in r["name"].lower()]))


if __name__ == "__main__":
    main()
