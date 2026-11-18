// Post-processes the Expo web export (dist-web) so salespeople can "Add to Home Screen":
// links the web manifest and Apple home-screen tags, and fixes the viewport for phones.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const indexPath = fileURLToPath(new URL("../dist-web/index.html", import.meta.url));
if (!existsSync(indexPath)) {
  console.error("finalize-web: dist-web/index.html not found; run the web export first.");
  process.exit(1);
}

let html = readFileSync(indexPath, "utf8");
const tags = [
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="FieldOps">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
].filter((tag) => !html.includes(tag));

// viewport-fit=cover lets the app use the full screen on notched iPhones.
html = html.replace(
  /<meta name="viewport" content="[^"]*"\s*\/?>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
);
html = html.replace("</head>", `${tags.join("\n")}\n</head>`);
writeFileSync(indexPath, html);
console.log(`finalize-web: added ${tags.length} home-screen tags`);
