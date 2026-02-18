import Groq from "groq-sdk";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const groq = new Groq();
const BOOK_DIR = import.meta.dir + "/../book";
const OUT_FILE = join(BOOK_DIR, "raw-extract.json");

const BOOKS = [
  { dir: "14-red" },
  { dir: "16-green" },
  { dir: "18-yellow" },
];

const SYSTEM_PROMPT = `Из статьи "Хазарского словаря" Павича извлеки персонажей. Верни JSON-массив:

[{ "name": "имя", "aliases": ["другие имена"], "type": "person|historical|mythical|concept", "epoch": "век/даты", "gender": "male|female|unknown", "religion": "христианство|ислам|иудаизм|хазарская вера|unknown", "description": "1 предложение", "quote": "цитата из текста 1 предложение" }]

Будь краток в description и quote. Отвечай ТОЛЬКО валидным JSON без обёртки.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callWithRetry(content: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        temperature: 0.1,
      });
      const choice = response.choices[0];
      if (choice.finish_reason !== "stop") {
        console.log(` [${choice.finish_reason}]`);
      }
      return choice.message.content?.trim() || "[]";
    } catch (e: any) {
      if (e?.status === 429 && i < retries - 1) {
        const wait = (i + 1) * 3000;
        console.log(` rate limit, ${wait}ms...`);
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
  return "[]";
}

// Load existing results for incremental processing
let results: Record<string, any> = {};
try {
  results = await Bun.file(OUT_FILE).json();
} catch {}

let processed = 0;
let skipped = 0;

for (const { dir } of BOOKS) {
  const dirPath = join(BOOK_DIR, dir);
  const files = (await readdir(dirPath)).filter((f) => f.endsWith(".txt")).sort();

  console.log(`\n${dir} (${files.length} статей)`);

  for (const file of files) {
    const key = `${dir}/${file.replace(/\.txt$/, "")}`;

    if (results[key]) {
      skipped++;
      console.log(`  ${key} — skip`);
      continue;
    }

    const content = await Bun.file(join(dirPath, file)).text();
    process.stdout.write(`  ${key}...`);

    const raw = await callWithRetry(content);
    try {
      const data = JSON.parse(raw);
      results[key] = data;
      processed++;
      console.log(` ${Array.isArray(data) ? data.length : "?"} персонажей`);
    } catch (e) {
      console.log(` JSON ERROR`);
      console.error(`  ${(e as Error).message}`);
      console.error(`  ${raw.slice(0, 200)}`);
    }

    // Save after each article (incremental)
    await Bun.write(OUT_FILE, JSON.stringify(results, null, 2));
    await sleep(500);
  }
}

console.log(`\nГотово: ${processed} обработано, ${skipped} пропущено → book/raw-extract.json`);
