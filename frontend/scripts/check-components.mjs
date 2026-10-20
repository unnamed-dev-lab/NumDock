import { readdir, readFile } from "node:fs/promises";
import { posix } from "node:path";

const config = JSON.parse(await readFile("components.json", "utf8"));
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const provenance = JSON.parse(await readFile("component-sources.json", "utf8"));
const installedFiles = new Set(
  provenance.components.flatMap((component) => component.files),
);
const foundFiles = new Set();
const failures = [];

if (!config.style.startsWith("base-"))
  failures.push("components.json must select a Base UI style");
for (const name of Object.keys({
  ...manifest.dependencies,
  ...manifest.devDependencies,
})) {
  if (name === "radix-ui" || name.startsWith("@radix-ui/react-"))
    failures.push(`Remove Radix dependency: ${name}`);
}

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }
    if (!/\.tsx?$/.test(path) || path.endsWith(".d.ts")) continue;
    const source = await readFile(path, "utf8");
    if (/["'](?:radix-ui|@radix-ui\/react-[^"']+)["']/.test(source))
      failures.push(`${path}: Radix primitives are prohibited`);
    if (
      /["']@base-ui\/react(?:\/[^"']*)?["']/.test(source) &&
      !path.startsWith("app/components/ui/")
    ) {
      failures.push(
        `${path}: use CLI-installed shadcn components instead of raw Base UI primitives`,
      );
    }
    if (
      path.startsWith("app/components/ui/") ||
      path.startsWith("app/components/motion/")
    ) {
      foundFiles.add(path);
      if (!installedFiles.has(path))
        failures.push(`${path}: missing CLI installation provenance`);
    }
  }
}

await visit("app");
for (const path of installedFiles)
  if (!foundFiles.has(path))
    failures.push(`${path}: installation record points to a missing file`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Component policy passed: beUI sources recorded, shadcn uses Base UI, no Radix imports.",
  );
}
