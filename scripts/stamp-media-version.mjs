/**
 * Stamp the service worker's MEDIA_VERSION from the contents of the media it
 * caches.
 *
 *   node scripts/stamp-media-version.mjs            # write if it changed
 *   node scripts/stamp-media-version.mjs --check    # exit 1 if stale
 *
 * public/sw.js serves /models, /slices and /draco cache-first and never
 * revalidates them, and a rebuild writes the same paths, so the only thing that
 * ever drops a stale mesh from a returning browser is the cache name changing
 * on activation. Bumping that by hand is a step nobody remembers — the
 * Z-Anatomy merge shipped invisible for exactly that reason — so the version is
 * a hash of the bytes instead. It moves when the media moves, and only then, so
 * rebuilding unchanged files does not force everyone to re-download 65 MB.
 *
 * Runs automatically from `npm run data:split` and `npm run build`, and
 * `npm run data:verify` fails when it is stale.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SW = path.join(ROOT, "public/sw.js");
const MEDIA_DIRS = ["public/models", "public/slices", "public/draco"];
const STAMP = /^const MEDIA_VERSION = "([^"]*)";$/m;

/** Every media file, sorted, so the hash does not depend on directory order. */
function mediaFiles() {
  const found = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else found.push(full);
    }
  };
  for (const dir of MEDIA_DIRS) walk(path.join(ROOT, dir));
  return found;
}

function mediaHash() {
  const hash = createHash("sha256");
  let bytes = 0;
  const files = mediaFiles();
  for (const file of files) {
    // Path and size go in too, so a rename or truncation moves the hash even if
    // no single file's contents changed.
    hash.update(path.relative(ROOT, file).split(path.sep).join("/"));
    const size = statSync(file).size;
    hash.update(String(size));
    hash.update(readFileSync(file));
    bytes += size;
  }
  return { version: `m-${hash.digest("hex").slice(0, 16)}`, files: files.length, bytes };
}

const check = process.argv.includes("--check");
const source = readFileSync(SW, "utf8");
const current = source.match(STAMP)?.[1];
if (current === undefined) {
  console.error("public/sw.js has no MEDIA_VERSION line to stamp");
  process.exit(2);
}

const { version, files, bytes } = mediaHash();
const mb = (bytes / 1024 / 1024).toFixed(1);

if (current === version) {
  console.log(`media version ${version} is current (${files} files, ${mb} MB)`);
  process.exit(0);
}

if (check) {
  console.error(`media version is stale: sw.js says ${current}, media hashes to ${version}`);
  console.error("run `npm run media:stamp` and commit public/sw.js");
  process.exit(1);
}

writeFileSync(SW, source.replace(STAMP, `const MEDIA_VERSION = "${version}";`));
console.log(`media version ${current} -> ${version}  (${files} files, ${mb} MB)`);
console.log("returning browsers will drop their cached media on next activation");
