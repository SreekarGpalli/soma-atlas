import {
  CATALOG_STATS,
  STRUCTURE_BY_ID,
  meshesFor,
  searchStructures,
} from "@/data/structures";
import { SLICES } from "@/data/slices";
import { REGION_META, SYSTEM_IDS, SYSTEM_META } from "./systems";
import { useAtlasStore } from "@/store/useAtlasStore";
import { speak } from "./tts";
import type { ClipAxis, SexModule, Structure, SystemId } from "./types";

export interface GroqTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const str = (description: string) => ({ type: "string", description });
const bool = (description: string) => ({ type: "boolean", description });

function fn(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
): GroqTool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    },
  };
}

export const GROQ_TOOLS: GroqTool[] = [
  fn(
    "search_structures",
    "Find structures in the atlas by name, alias, clinical note or nerve. Always search before referring to a structure id — ids are not guessable.",
    {
      query: str("Search text, e.g. 'left lung', 'pudendal', 'portal vein'."),
      system: {
        type: "string",
        enum: SYSTEM_IDS,
        description: "Optional system filter.",
      },
      limit: { type: "number", description: "Max results, default 10." },
    },
    ["query"],
  ),
  fn(
    "get_structure",
    "Read everything the atlas knows about one structure: summary, relations, clinical note, and muscle attachments where present. Use this before explaining a structure.",
    { id: str("Structure id from search_structures.") },
    ["id"],
  ),
  fn(
    "get_view_state",
    "Read what the student is currently looking at: module, active systems, current selection, isolation and clip plane. Call this when the question refers to 'this' or 'what I'm seeing'.",
  ),
  fn(
    "list_systems",
    "List the anatomical systems, how many structures each holds, and whether it is currently switched on.",
  ),
  fn(
    "show_structure",
    "Select a structure in the 3D view and open its card. This is the main way to point at something.",
    {
      id: str("Structure id."),
      isolate: bool("Hide everything else. Default false."),
      zoom: bool("Fly the camera to it. Default true."),
    },
    ["id"],
  ),
  fn(
    "set_systems",
    "Switch anatomical systems on or off. Pass only the systems you want to change.",
    {
      systems: {
        type: "object",
        description: "Map of system id to true/false.",
        additionalProperties: { type: "boolean" },
      },
    },
    ["systems"],
  ),
  fn(
    "hide_structures",
    "Hide structures so the student can see past them.",
    { ids: { type: "array", items: { type: "string" }, description: "Structure ids." } },
    ["ids"],
  ),
  fn("reset_view", "Undo all hiding and isolation and re-frame the camera."),
  fn(
    "set_transparency",
    "Fade the surrounding context so a selection reads through it. 0 is solid, 1 is nearly invisible.",
    { value: { type: "number", description: "0 to 1." } },
    ["value"],
  ),
  fn(
    "set_clip_plane",
    "Cut the model with a plane to expose deep relations. Axis x is sagittal, y is axial, z is coronal.",
    {
      enabled: bool("Turn the cut on or off."),
      axis: { type: "string", enum: ["x", "y", "z"], description: "Plane axis." },
      value: { type: "number", description: "Position, roughly -1.5 to 1.5." },
    },
    ["enabled"],
  ),
  fn(
    "set_module",
    "Switch between the male whole-body atlas and the female organ module.",
    { sex: { type: "string", enum: ["male", "female"], description: "Module." } },
    ["sex"],
  ),
  fn("list_slices", "List the available cross-section images for the current module."),
  fn(
    "open_cross_section",
    "Open the cross-section viewer, optionally at a specific slice id from list_slices.",
    { sliceId: str("Slice id. Omit for the first slice.") },
  ),
  fn(
    "start_quiz",
    "Start an 8-question quiz, optionally limited to one system.",
    { system: { type: "string", enum: SYSTEM_IDS, description: "Optional system." } },
  ),
  fn(
    "compare",
    "Open side-by-side comparison of two structures.",
    { leftId: str("First structure id."), rightId: str("Second structure id.") },
    ["leftId", "rightId"],
  ),
  fn(
    "speak",
    "Pronounce a term aloud with the device voice.",
    { text: str("Text to pronounce.") },
    ["text"],
  ),
  fn(
    "save_view",
    "Bookmark the current camera, selection and filters so the student can return to it.",
    { title: str("Short label for the bookmark.") },
  ),
];

export const SYSTEM_PROMPT = `You are the G.L.S.C Atlas tutor, teaching anatomy to an MBBS student.

You control a real 3D anatomy viewer through tools. Move the view first, then explain what is now on screen.

Rules:
- Never invent structure ids. Call search_structures, then use the id it returns.
- Call get_structure before explaining a structure, and teach from what it returns.
- If a structure is not in the catalog, say so plainly instead of improvising.
- When the question is about what the student is currently seeing, call get_view_state first.
- Some structures have notes but no mesh in the open datasets (BodyParts3D ships no peripheral nerves, and no muscles of facial expression or mastication). get_structure reports this; say so rather than pretending to highlight it.
- The female module is a real open female organ set (Human Reference Atlas / Visible Human Female), not a complete female cadaver.

Style: English only. Exam-useful and concise — relations, nerve roots, blood supply, clinical pearls. Prefer 4-8 short sentences or a tight list. Never give diagnosis or treatment advice for a real patient.

Catalog: ${CATALOG_STATS.structures} structures over ${CATALOG_STATS.meshes} meshes, ${CATALOG_STATS.curated} with hand-written high-yield notes.`;

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

function brief(s: Structure) {
  return {
    id: s.id,
    name: s.name,
    system: s.system,
    region: s.region,
    hasNotes: Boolean(s.clinical || s.muscle || s.curated),
    meshes: meshesFor(s.id).length,
  };
}

function detail(s: Structure) {
  return {
    id: s.id,
    name: s.name,
    system: SYSTEM_META[s.system].label,
    region: REGION_META[s.region].label,
    sex: s.sex,
    summary: s.summary,
    relations: s.relations,
    clinical: s.clinical,
    muscle: s.muscle,
    fmaId: s.fmaId,
    source: s.source,
    meshes: meshesFor(s.id).length,
    viewable: meshesFor(s.id).length > 0,
    notViewableBecause: s.missingMeshReason
      ? `The open datasets ship no geometry for ${s.missingMeshReason}.`
      : undefined,
  };
}

/** Short human-readable line shown in the tutor's tool trace. */
export function traceLabel(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "search_structures":
      return `Searching “${String(args.query ?? "")}”`;
    case "get_structure":
      return `Reading ${STRUCTURE_BY_ID[String(args.id)]?.name ?? args.id}`;
    case "show_structure":
      return `Showing ${STRUCTURE_BY_ID[String(args.id)]?.name ?? args.id}`;
    case "set_systems":
      return `Adjusting system filters`;
    case "hide_structures":
      return `Hiding ${(args.ids as string[] | undefined)?.length ?? 0} structures`;
    case "reset_view":
      return "Resetting the view";
    case "set_transparency":
      return `Fading context to ${Math.round(Number(args.value ?? 0) * 100)}%`;
    case "set_clip_plane":
      return args.enabled ? "Cutting a section plane" : "Removing the cut";
    case "set_module":
      return `Switching to the ${args.sex} module`;
    case "open_cross_section":
      return "Opening cross-sections";
    case "start_quiz":
      return "Starting a quiz";
    case "compare":
      return "Opening comparison";
    case "speak":
      return "Pronouncing";
    case "save_view":
      return "Bookmarking this view";
    case "get_view_state":
      return "Checking the current view";
    case "list_systems":
      return "Listing systems";
    case "list_slices":
      return "Listing cross-sections";
    default:
      return name;
  }
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const store = useAtlasStore.getState();
  const json = (v: unknown) => JSON.stringify(v);

  switch (name) {
    case "search_structures": {
      const limit = Math.min(Number(args.limit ?? 10) || 10, 25);
      let hits = searchStructures(String(args.query ?? ""), {
        sex: store.sex,
        limit: limit * 3,
      });
      if (args.system) hits = hits.filter((s) => s.system === args.system);
      if (!hits.length) return json({ results: [], note: "No match in the catalog." });
      return json({ results: hits.slice(0, limit).map(brief) });
    }

    case "get_structure": {
      const s = STRUCTURE_BY_ID[String(args.id ?? "")];
      if (!s) {
        return json({
          error: `No structure with id "${args.id}". Use search_structures first.`,
        });
      }
      return json(detail(s));
    }

    case "get_view_state": {
      const active = SYSTEM_IDS.filter((id) => store.systems[id]);
      const focused = store.focusedId
        ? STRUCTURE_BY_ID[store.focusedId]
        : undefined;
      return json({
        module: store.sex,
        activeSystems: active,
        loadedSystems: store.loadedSystems,
        focused: focused ? brief(focused) : null,
        selectedMeshCount: store.selectedIds.length,
        isolated: store.isolatedIds.length > 0,
        hiddenCount: store.hiddenIds.length,
        transparency: store.transparency,
        clip: store.clipEnabled
          ? { axis: store.clipAxis, value: store.clipValue }
          : null,
        panel: store.panel,
      });
    }

    case "list_systems": {
      const counts: Record<string, number> = {};
      for (const s of Object.values(STRUCTURE_BY_ID)) {
        if (s.sex !== "both" && s.sex !== store.sex) continue;
        counts[s.system] = (counts[s.system] ?? 0) + 1;
      }
      return json({
        module: store.sex,
        systems: SYSTEM_IDS.map((id) => ({
          id,
          label: SYSTEM_META[id].label,
          structures: counts[id] ?? 0,
          on: store.systems[id],
        })).filter((x) => x.structures > 0),
      });
    }

    case "show_structure": {
      const id = String(args.id ?? "");
      const s = STRUCTURE_BY_ID[id];
      if (!s) return json({ error: `Unknown id "${id}".` });
      const meshes = meshesFor(id);
      store.select(id, { openCard: true });
      if (!meshes.length) {
        return json({
          shown: false,
          name: s.name,
          reason: s.missingMeshReason
            ? `No geometry: the open datasets ship no ${s.missingMeshReason}. The card is open with the notes.`
            : "No geometry for this structure. The card is open with the notes.",
        });
      }
      if (args.isolate === true) store.isolate(meshes);
      if (args.zoom !== false) store.focusSelection();
      return json({ shown: true, name: s.name, meshes: meshes.length });
    }

    case "set_systems": {
      const patch = (args.systems ?? {}) as Record<string, unknown>;
      const clean: Partial<Record<SystemId, boolean>> = {};
      for (const [k, v] of Object.entries(patch)) {
        if ((SYSTEM_IDS as string[]).includes(k)) {
          clean[k as SystemId] = Boolean(v);
        }
      }
      if (!Object.keys(clean).length) {
        return json({ error: `No valid system ids. Valid: ${SYSTEM_IDS.join(", ")}` });
      }
      store.patchSystems(clean);
      return json({ updated: clean });
    }

    case "hide_structures": {
      const ids = Array.isArray(args.ids) ? args.ids.map(String) : [];
      const meshes = ids.flatMap((id) => meshesFor(id));
      if (!meshes.length) return json({ error: "Nothing resolved to geometry." });
      store.hideMany(meshes);
      return json({ hidden: ids.length, meshes: meshes.length });
    }

    case "reset_view": {
      store.resetVisibility();
      store.triggerFit();
      return json({ ok: true });
    }

    case "set_transparency": {
      const v = Math.min(1, Math.max(0, Number(args.value ?? 0)));
      store.setTransparency(v);
      return json({ transparency: v });
    }

    case "set_clip_plane": {
      const enabled = Boolean(args.enabled);
      store.setClipEnabled(enabled);
      if (enabled) {
        if (typeof args.axis === "string" && "xyz".includes(args.axis)) {
          store.setClipAxis(args.axis as ClipAxis);
        }
        if (args.value !== undefined) store.setClipValue(Number(args.value));
      }
      return json({
        enabled,
        axis: useAtlasStore.getState().clipAxis,
        value: useAtlasStore.getState().clipValue,
      });
    }

    case "set_module": {
      const sex: SexModule = args.sex === "female" ? "female" : "male";
      store.setSex(sex);
      return json({
        module: sex,
        note:
          sex === "female"
            ? "Female module is a real open organ set, not a whole-body cadaver."
            : undefined,
      });
    }

    case "list_slices": {
      return json({
        slices: SLICES.filter((s) => s.sex === store.sex).map((s) => ({
          id: s.id,
          title: s.title,
          plane: s.plane,
          region: s.region,
          labels: s.labels,
        })),
      });
    }

    case "open_cross_section": {
      const list = SLICES.filter((s) => s.sex === store.sex);
      const id = args.sliceId ? String(args.sliceId) : list[0]?.id;
      if (!id) return json({ error: "No slices for this module." });
      if (!list.some((s) => s.id === id)) {
        return json({ error: `Unknown slice "${id}". Call list_slices.` });
      }
      store.setSliceId(id);
      store.setPanel("slices");
      return json({ opened: id });
    }

    case "start_quiz": {
      const system = (SYSTEM_IDS as string[]).includes(String(args.system))
        ? (args.system as SystemId)
        : undefined;
      store.startQuiz(system);
      const n = useAtlasStore.getState().quiz.length;
      return json(
        n ? { started: true, questions: n, system } : { error: "Not enough material for that quiz." },
      );
    }

    case "compare": {
      const l = STRUCTURE_BY_ID[String(args.leftId ?? "")];
      const r = STRUCTURE_BY_ID[String(args.rightId ?? "")];
      if (!l || !r) return json({ error: "Both ids must exist. Search first." });
      store.setCompare(l.id, r.id);
      store.setPanel("compare");
      return json({ comparing: [l.name, r.name] });
    }

    case "speak": {
      speak(String(args.text ?? ""));
      return json({ ok: true });
    }

    case "save_view": {
      store.saveBookmark(args.title ? String(args.title) : undefined);
      return json({ saved: true });
    }

    default:
      return json({ error: `Unknown tool "${name}".` });
  }
}
