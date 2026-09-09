export type SexModule = "male" | "female";

export type SystemId =
  | "skeletal"
  | "muscular"
  | "cardiovascular"
  | "nervous"
  | "respiratory"
  | "digestive"
  | "urinary"
  | "maleReproductive"
  | "femaleReproductive"
  | "endocrine"
  | "lymphatic"
  | "sensory"
  | "integumentary";

export type RegionId =
  | "head"
  | "neck"
  | "thorax"
  | "abdomen"
  | "malePelvis"
  | "femalePelvis"
  | "upperLimb"
  | "lowerLimb"
  | "back"
  | "perineum";

export type ClipAxis = "x" | "y" | "z";

export interface MuscleFacts {
  origin: string;
  insertion: string;
  innervation: string;
  action: string;
}

export interface Structure {
  id: string;
  name: string;
  system: SystemId;
  region: RegionId;
  sex: "both" | "male" | "female";
  aliases?: string[];
  summary: string;
  relations?: string;
  clinical?: string;
  muscle?: MuscleFacts;
  parentId?: string;
  fmaId?: string;
  source?: "bodyparts3d" | "hra" | "osu" | "schematic";
  layer?: number;
  meshIds?: string[];
  /** True when this row is itself a mesh in a GLB pack, not a grouping concept. */
  isLeafMesh?: boolean;
  /** True when a hand-written high-yield note contributed to this row. */
  curated?: boolean;
  /**
   * Set when the open datasets ship no mesh for this structure, e.g.
   * BodyParts3D has no peripheral nerves. The card explains it instead of
   * silently highlighting nothing.
   */
  missingMeshReason?: string;
}

export interface Slice {
  id: string;
  title: string;
  plane: "axial" | "coronal" | "sagittal";
  sex: SexModule;
  region: RegionId;
  src: string;
  credit: string;
  labels: string[];
}

export interface Bookmark {
  id: string;
  title: string;
  createdAt: number;
  sex: SexModule;
  focusedId: string | null;
  selectedIds: string[];
  hiddenIds: string[];
  isolatedIds: string[];
  systems: Record<SystemId, boolean>;
  transparency: number;
  clip: { enabled: boolean; axis: ClipAxis; value: number };
}

export interface TutorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Tool calls the assistant made while producing this turn, for the UI. */
  tools?: { name: string; summary: string }[];
  error?: boolean;
}

export interface AgentEvent {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: "running" | "done" | "error";
  detail?: string;
}

export type QuizKind = "identify" | "name" | "innervation" | "action" | "region";

export interface QuizQuestion {
  id: string;
  type: QuizKind;
  prompt: string;
  structureId: string;
  /** Absent for free-text questions. */
  choices?: string[];
  answer: string;
  /** Shown after answering. */
  explanation?: string;
}
