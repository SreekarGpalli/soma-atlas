/**
 * Run a Blender script headlessly, finding Blender wherever it happens to live.
 *
 *   node scripts/run-blender.mjs <blend> <script.py> [-- args...]
 *
 * The Z-Anatomy steps need Blender, and it is usually not on PATH on Windows or
 * macOS — the installers drop it inside Program Files or an .app bundle. Set
 * BLENDER to point at the binary if it is somewhere else again.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** Every place a normal Blender install puts the binary, newest version first. */
function candidates() {
  const found = [];
  if (process.env.BLENDER) found.push(process.env.BLENDER);
  found.push("blender");                                   // already on PATH

  const roots = [
    "C:/Program Files/Blender Foundation",
    "C:/Program Files (x86)/Blender Foundation",
    "/Applications",
    "/usr/share",
  ];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    let entries;
    try {
      entries = readdirSync(root).filter((e) => /blender/i.test(e));
    } catch {
      continue;
    }
    entries.sort().reverse();                              // "Blender 5.1" before "Blender 4.2"
    for (const entry of entries) {
      found.push(
        path.join(root, entry, "blender.exe"),
        path.join(root, entry, "Contents/MacOS/Blender"),
        path.join(root, entry, "blender"),
      );
    }
  }
  return found;
}

function resolveBlender() {
  for (const candidate of candidates()) {
    if (candidate.includes(path.sep) || candidate.includes("/")) {
      if (existsSync(candidate)) return candidate;
      continue;
    }
    const probe = spawnSync(candidate, ["--version"], { stdio: "ignore", shell: false });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

const [blend, script, ...rest] = process.argv.slice(2);
if (!blend || !script) {
  console.error("usage: node scripts/run-blender.mjs <blend> <script.py> [-- args...]");
  process.exit(2);
}

if (!existsSync(blend)) {
  console.error(`missing ${blend}`);
  console.error("Unzip Z-Anatomy.zip from https://github.com/Z-Anatomy/The-blend into data/work/z-anatomy/");
  process.exit(1);
}

const blender = resolveBlender();
if (!blender) {
  console.error("Blender not found. Install it, or set BLENDER to the binary:");
  console.error('  BLENDER="/path/to/blender" npm run ingest:z-anatomy');
  process.exit(1);
}

const args = ["-b", blend, "--python", script, ...(rest.length ? rest : [])];
const run = spawnSync(blender, args, { stdio: "inherit" });
// Blender 5.x can throw while unregistering third-party addons on exit, long
// after the export has been written. Trust the script's own output, not that.
process.exit(run.status === null ? 1 : run.status);
