"""
Export the planned Z-Anatomy objects to one GLB, named by catalog id.

  blender -b data/work/z-anatomy/Z-Anatomy/Startup.blend \
          --python scripts/export-z-anatomy.py -- \
          data/work/z-anatomy/za-plan.json data/work/z-anatomy/z-male.glb

Geometry is rebuilt through the dependency graph rather than bpy.ops, which
keeps this working in background mode where the operator context is thin. That
also evaluates modifiers and turns Z-Anatomy's beveled nerve and vessel curves
into real tube meshes.

Transforms are baked into the vertices and the node transform left at identity,
so the output matches the flat, id-named node layout of the BodyParts3D master
that scripts/split-by-system.mjs expects.

Materials are dropped: the viewer assigns one shared material per system by mesh
name (src/components/AnatomyScene.tsx), so exported materials would be payload
for nothing.
"""
import bpy, json, sys
from mathutils import Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
plan_path, out_path = argv[0], argv[1]

plan = json.load(open(plan_path, encoding="utf8"))
print(f"plan: {len(plan)} objects")

scene = bpy.data.scenes.new("export")
holder = bpy.data.collections.new("export")
scene.collection.children.link(holder)

# Z-Anatomy authors every curve at resolution_u 12 with bevel_resolution 4 — 12
# samples per segment around a 20-sided tube. That is print-quality for a 1 mm
# vessel and costs 207k triangles on the central retinal artery alone. Four
# samples around an 8-sided tube is indistinguishable at atlas zoom and roughly
# ten times cheaper.
CURVE_RESOLUTION_U = 3
CURVE_BEVEL_RESOLUTION = 1

planned = {e["object"] for e in plan}
for obj in bpy.data.objects:
    if obj.type == "CURVE" and obj.name in planned:
        obj.data.resolution_u = min(obj.data.resolution_u, CURVE_RESOLUTION_U)
        obj.data.bevel_resolution = min(obj.data.bevel_resolution, CURVE_BEVEL_RESOLUTION)

deps = bpy.context.evaluated_depsgraph_get()

made, failed = 0, []
for entry in plan:
    src = bpy.data.objects.get(entry["object"])
    if src is None:
        failed.append((entry["object"], "not found"))
        continue
    try:
        evaluated = src.evaluated_get(deps)
        mesh = bpy.data.meshes.new_from_object(evaluated)
    except Exception as exc:                      # noqa: BLE001 - report and continue
        failed.append((entry["object"], f"{type(exc).__name__}: {exc}"))
        continue
    if mesh is None or len(mesh.polygons) == 0:
        failed.append((entry["object"], "no polygons after evaluation"))
        if mesh is not None:
            bpy.data.meshes.remove(mesh)
        continue

    mesh.transform(src.matrix_world)              # bake world transform
    mesh.materials.clear()
    mesh.name = entry["id"]

    obj = bpy.data.objects.new(entry["id"], mesh)
    obj.matrix_world = Matrix.Identity(4)
    holder.objects.link(obj)
    made += 1

print(f"built {made} mesh objects, {len(failed)} failed")
for name, why in failed[:20]:
    print("  FAIL", name, "-", why)

bpy.context.window.scene = scene
for obj in scene.collection.all_objects:
    obj.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    use_selection=True,
    export_apply=False,          # transforms are already baked
    export_materials="NONE",
    export_normals=True,
    export_texcoords=False,
    export_tangents=False,
    export_animations=False,
    export_skins=False,
    export_morph=False,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
)
print(f"WROTE {out_path} ({made} meshes)")
