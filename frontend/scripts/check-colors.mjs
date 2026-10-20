import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const palette = /\b(?:bg|text|border|outline|ring|shadow|fill|stroke|from|via|to|divide|decoration|accent|caret|placeholder)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;
const literal = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\s*\(/i;
const failures = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { await visit(path); continue; }
    if (!/\.(?:tsx?|css)$/.test(path) || path.endsWith(".d.ts")) continue;
    const lines = (await readFile(path, "utf8")).split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (palette.test(line)) failures.push(`${path}:${index + 1}: use a semantic color token`);
      // Raw CSS colors are permitted only in the central variable declarations.
      if (literal.test(line) && !(path === join("app", "app.css") && /^\s*--[\w-]+:/.test(line))) failures.push(`${path}:${index + 1}: raw color outside theme variables`);
    }
  }
}

await visit("app");
if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
else { console.log("Color policy passed: components use semantic theme tokens."); }
