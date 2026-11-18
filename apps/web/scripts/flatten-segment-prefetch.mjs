// Next.js static export writes segment prefetch data as `__next.<segment>/<file>.txt`,
// but the client requests the flat name `__next.<segment>.<file>.txt`. Static hosts
// (Firebase Hosting) then answer 404 and every client navigation falls back to a full
// page load. Copy each nested file to its flat name so both paths resolve.
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = fileURLToPath(new URL("../out", import.meta.url));
if (!existsSync(outDir)) process.exit(0);

let copied = 0;
function flatten(segmentDir, flatPrefix) {
  for (const entry of readdirSync(segmentDir)) {
    const source = join(segmentDir, entry);
    const flat = `${flatPrefix}.${entry}`;
    if (statSync(source).isDirectory()) flatten(source, flat);
    else {
      copyFileSync(source, flat);
      copied += 1;
    }
  }
}
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (!statSync(path).isDirectory() || entry === "_next") continue;
    if (entry.startsWith("__next.")) flatten(path, path);
    else walk(path);
  }
}

walk(outDir);
console.log(`flatten-segment-prefetch: wrote ${copied} flat prefetch files`);
