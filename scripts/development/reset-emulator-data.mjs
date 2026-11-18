// Deletes locally exported emulator data so the next `npm run emulators` starts empty.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "..", "firebase", "emulator-data");
mkdirSync(dir, { recursive: true });
for (const entry of readdirSync(dir)) {
  if (entry !== ".gitkeep") rmSync(join(dir, entry), { recursive: true, force: true });
}
writeFileSync(join(dir, ".gitkeep"), "");
console.log(`Emulator data cleared: ${dir}`);
