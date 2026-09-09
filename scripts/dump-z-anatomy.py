"""
List every drawable object in Z-Anatomy's Startup.blend, with the system
collection it belongs to.

  blender -b data/work/z-anatomy/Z-Anatomy/Startup.blend \
          --python scripts/dump-z-anatomy.py -- data/work/z-anatomy/za-objects.json

Meshes without polygons are label anchors, not geometry, so they are dropped
here. Curves are kept: Z-Anatomy authors nerves and vessels as beveled curves,
which become real tube geometry once converted.
"""
import bpy, json, sys

SYSTEM_PREFIXES = {f"{i}:" for i in range(1, 10)}

# An object can sit in a nested collection; walk down from the numbered roots.
system_of = {}


def walk(col, root):
    for o in col.objects:
        system_of.setdefault(o.name, root)
    for child in col.children:
        walk(child, root)


for col in bpy.data.collections:
    if col.name[:2] in SYSTEM_PREFIXES:
        walk(col, col.name)

rows = []
for o in bpy.data.objects:
    if o.type == "MESH":
        if len(o.data.polygons) == 0:
            continue
        rows.append({"name": o.name, "type": "MESH",
                     "polys": len(o.data.polygons), "system": system_of.get(o.name)})
    elif o.type == "CURVE":
        rows.append({"name": o.name, "type": "CURVE",
                     "splines": len(o.data.splines),
                     "bevel": round(getattr(o.data, "bevel_depth", 0.0), 6),
                     "system": system_of.get(o.name)})

out = sys.argv[-1]
json.dump(rows, open(out, "w", encoding="utf8"), ensure_ascii=False)
print(f"WROTE {len(rows)} objects to {out}")
