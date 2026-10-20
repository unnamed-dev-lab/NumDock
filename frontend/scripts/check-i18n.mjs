import { readFileSync } from "node:fs";

const resource = (locale) =>
  JSON.parse(
    readFileSync(
      new URL(`../app/lib/i18n/locales/${locale}.json`, import.meta.url),
      "utf8",
    ),
  );
const en = resource("en");
const zh = resource("zh-CN");
const placeholders = (value) =>
  [...value.matchAll(/{{\s*([\w]+)\s*}}/g)]
    .map((match) => match[1])
    .sort()
    .join(",");
const failures = [];
for (const key of new Set([...Object.keys(en), ...Object.keys(zh)])) {
  if (
    typeof en[key] !== "string" ||
    !en[key].trim() ||
    typeof zh[key] !== "string" ||
    !zh[key].trim()
  ) {
    failures.push(`${key}: missing or empty translation`);
  } else if (placeholders(en[key]) !== placeholders(zh[key])) {
    failures.push(`${key}: interpolation parameters differ`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`i18n: ${Object.keys(en).length} keys match across en and zh-CN.`);
