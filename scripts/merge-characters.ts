import Groq from "groq-sdk";
import { join } from "node:path";

const groq = new Groq();
const BOOK_DIR = import.meta.dir + "/../book";
const RAW_FILE = join(BOOK_DIR, "raw-extract.json");
const OUT_FILE = join(BOOK_DIR, "characters.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MERGE_PROMPT = `Вот описания одного и того же персонажа из разных частей "Хазарского словаря" Павича.
Объедини в одну запись: сохрани все детали, алиасы, убери повторы. Выбери наиболее точный type, gender, religion.

Верни JSON:
{ "name": "...", "aliases": ["..."], "type": "...", "epoch": "...", "gender": "...", "religion": "...", "description": "..." }

Отвечай ТОЛЬКО валидным JSON без markdown-обёртки.`;

async function callMerge(content: string): Promise<any> {
  for (let i = 0; i < 3; i++) {
    try {
      const response = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: MERGE_PROMPT },
          { role: "user", content },
        ],
        temperature: 0.1,
      });
      return JSON.parse(response.choices[0].message.content?.trim() || "{}");
    } catch (e: any) {
      if (e?.status === 429 && i < 2) {
        await sleep((i + 1) * 3000);
      } else if (e instanceof SyntaxError) {
        console.error("  JSON parse error, retrying...");
      } else {
        throw e;
      }
    }
  }
  return null;
}

// raw-extract.json: { "14-red/01-АТЕХ": [{ name, aliases, ... }], ... }
const raw: Record<string, any[]> = await Bun.file(RAW_FILE).json();

// Collect all characters with sources
type CharEntry = { data: any; article: string; quote: string };
const charMap = new Map<string, CharEntry[]>();

for (const [article, chars] of Object.entries(raw)) {
  for (const ch of chars) {
    const key = ch.name.toLowerCase().trim();
    if (!charMap.has(key)) charMap.set(key, []);
    charMap.get(key)!.push({ data: ch, article, quote: ch.quote || "" });
  }
}

const toMerge = [...charMap.entries()].filter(([, e]) => e.length > 1);
const singles = [...charMap.entries()].filter(([, e]) => e.length === 1);

console.log(`Уникальных имён: ${charMap.size} (одиночных: ${singles.length}, для мерджа: ${toMerge.length})`);

const merged: any[] = [];

// Singles
for (const [, entries] of singles) {
  const e = entries[0];
  merged.push({
    name: e.data.name,
    aliases: e.data.aliases || [],
    type: e.data.type,
    epoch: e.data.epoch || "",
    gender: e.data.gender || "unknown",
    religion: e.data.religion || "unknown",
    description: e.data.description,
    sources: [{ article: e.article, quote: e.quote }],
  });
}

// Merge duplicates via LLM
for (const [, entries] of toMerge) {
  process.stdout.write(`  ${entries[0].data.name} (${entries.length})...`);

  const input = entries
    .map((e) => `[${e.article}]: ${JSON.stringify(e.data)}`)
    .join("\n\n");

  const result = await callMerge(input);
  if (result) {
    merged.push({
      ...result,
      sources: entries.map((e) => ({ article: e.article, quote: e.quote })),
    });
    console.log(" ok");
  } else {
    const e = entries[0];
    merged.push({
      name: e.data.name,
      aliases: e.data.aliases || [],
      type: e.data.type,
      epoch: e.data.epoch || "",
      gender: e.data.gender || "unknown",
      religion: e.data.religion || "unknown",
      description: e.data.description,
      sources: entries.map((e) => ({ article: e.article, quote: e.quote })),
    });
    console.log(" fallback");
  }
  await sleep(500);
}

merged.sort((a, b) => a.name.localeCompare(b.name));
await Bun.write(OUT_FILE, JSON.stringify(merged, null, 2));

console.log(`\nГотово: ${merged.length} персонажей → book/characters.json`);
