// Kiem tra dan chung code trong wiki con dung file va khoang dong.
// Chay truoc buoc mirror trong publish-wiki.yml de wiki khong tro sai code.
// Khong dung thu vien ngoai: chi doc file va doi chieu so dong.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wikiDir = join(root, "wiki");

// Dang dan chung: server/... hoac client/... kem ":dong" hoac ":dong-dong".
const REF = /(?:^|[^\w/])((?:server|client)\/[A-Za-z0-9_./-]+\.(?:ts|vue|tsx|css|json|sql|ya?ml|conf)):(\d+)(?:-(\d+))?/g;
const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

const errors = [];
const pages = readdirSync(wikiDir).filter((f) => f.endsWith(".md"));
let refCount = 0;
let linkCount = 0;

for (const page of pages) {
  const text = readFileSync(join(wikiDir, page), "utf8");
  const pageLines = text.split("\n");

  for (const [index, line] of pageLines.entries()) {
    for (const match of line.matchAll(REF)) {
      refCount += 1;
      const [, path, rawStart, rawEnd] = match;
      const start = Number(rawStart);
      const end = rawEnd ? Number(rawEnd) : start;
      const target = join(root, path);
      const at = `${page}:${index + 1}`;

      if (!existsSync(target) || !statSync(target).isFile()) {
        errors.push(`${at} khong thay file ${path}`);
        continue;
      }
      const total = readFileSync(target, "utf8").split("\n").length;
      if (start < 1 || end < start) {
        errors.push(`${at} ${path}:${start}-${end} khoang dong sai`);
      } else if (end > total) {
        errors.push(`${at} ${path}:${start}-${end} vuot qua ${total} dong`);
      }
    }
  }

  for (const match of text.matchAll(LINK)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const name = target.split("#")[0];
    if (!name || name.startsWith(".")) continue;
    // Link toi ma nguon trong repo da duoc kiem o tren.
    if (/^(server|client|scripts)\//.test(name)) continue;
    linkCount += 1;
    if (!existsSync(join(wikiDir, `${name}.md`)) && !existsSync(join(wikiDir, name))) {
      errors.push(`${page} link chet: ${name}`);
    }
  }

  if (/\u2014|\u2013/.test(text)) errors.push(`${page} co em dash hoac en dash`);
  if (/[\u4e00-\u9fff]/.test(text)) errors.push(`${page} co chu Han`);
}

console.log(`Da kiem ${refCount} dan chung code va ${linkCount} link noi bo trong ${pages.length} trang.`);
if (errors.length > 0) {
  console.error(`\n${errors.length} loi:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log("Tat ca dan chung va link deu hop le.");
