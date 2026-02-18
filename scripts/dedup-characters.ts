import { join } from "node:path";

const BOOK_DIR = import.meta.dir + "/../book";
const CHARS_FILE = join(BOOK_DIR, "characters.json");

const chars: any[] = await Bun.file(CHARS_FILE).json();
console.log(`Всего: ${chars.length}`);

// Manual groups: arrays of indices to merge (first index = canonical name source)
const groups: number[][] = [
  [34, 144, 145, 170],   // Атех, Принцесса Атех, принцесса Атех u, Три принцессы Атех
  [14, 15, 101],          // Аврам Бранкович, Аврам Бранкович V, Кир Аврам Бранкович V
  [38, 50],               // БРАНКОВИЧ ГРГУР, Гргур Бранкович
  [59, 79, 81, 0],        // Даубманнус, Иоаннес Даубманнус, Иоганн Даубманнус, Daubmannus Johannes
  [96, 44, 138, 180],     // Каган, Второй каган, неизвестный каган, Хазарский каган
  [92, 6, 184, 185, 154], // Иуда Халеви, Judah Halavi, Халеви, Халеви Иегуда, Самуил Халеви
  [155, 108],             // Самуэль Коэн, Коэн
  [88, 5],                // Исаак Сангари, Joseph Khazar king? no — skip
  [55, 57, 90],           // Д-р Исайло Сук, Д-р Сук Исайло, Исайло Сук
  [11, 56],               // Абу Кабир Муавия, Д-р Муавия Абу Кабир
  [22, 24],               // Аль-Бекри, Аль‑Бекри
  [25, 94],               // Аль‑Иштакхри, Иштакхри
  [48, 68],               // Госпожа Ефросиния Лукаревич, Ефросиния Лукаревич
  [102, 104, 105, 106, 157], // Кирилл, Константин, Константин Солунский, Константин Философ, Святой Кирилл
  [126, 127],             // Мефодий, Мефодий Солунский
  [128, 129],             // Михаил, Михаил III
  [114, 115],             // Лев III, Лев III Исаврий-ский
  [122, 124, 193, 194, 123, 125], // Масуди, Масуди Юсуф, Юсуф Масуди, Юсуф Масуди З., Масуди Старший, Масуди‑писарь
  [131, 132, 133, 134, 135], // Мокадаса аль Сафер (все варианты)
  [140, 158],             // Никон Севаст, Севаст Никон
  [172, 173],             // Фараби Ибн Кора, Фараби Ибн Коре
  [77, 183],              // Ибн Шапрут, Хаздай Ибн Шапрут
  [188, 189],             // Шайтан, Шайтан Ибн Хадраш
  [18, 19, 17],           // Адам Рухани, Адама Рухани, Адам Кадмон
  [196, 10],              // Ябир Ибн Акшани, Абдул Хамид из Андалузии и Кинам — skip, different
  [136, 151],             // Мустай‑Бег Сабляк, Сабляк‑паша
  [164, 165, 8],          // Теоктист Никольски A, Теоктист Никольский, Nikolski
  [4, 62],                // John Buxtorf, Джон Буксторф
  [119, 163],             // Ловец снов, Старик‑ловец снов
  [64, 65, 66, 67],       // Еврей, Еврей из придворной свиты, Еврейский теолог, Еврейский участник
  [17, 18, 19],           // Адам Кадмон, Адам Рухани, Адама Рухани
];

// Deduplicate group indices (some overlap like 17,18,19)
const canonicalGroups: number[][] = [];
const seen = new Set<number>();
for (const g of groups) {
  const filtered = g.filter(i => !seen.has(i));
  if (filtered.length >= 2) {
    filtered.forEach(i => seen.add(i));
    canonicalGroups.push(filtered);
  }
}

const mergedIndices = new Set<number>();

for (const group of canonicalGroups) {
  const entries = group.map(i => chars[i]).filter(Boolean);
  if (entries.length < 2) continue;

  // Use first entry as canonical, merge others into it
  const canonical = { ...entries[0] };
  const allAliases = new Set<string>(canonical.aliases || []);
  const allSources: any[] = [...(canonical.sources || [])];

  for (let i = 1; i < entries.length; i++) {
    const e = entries[i];
    allAliases.add(e.name);
    for (const a of (e.aliases || [])) allAliases.add(a);
    for (const s of (e.sources || [])) {
      if (!allSources.some((x: any) => x.article === s.article)) {
        allSources.push(s);
      }
    }
    // Use longer description
    if (e.description && e.description.length > (canonical.description || "").length) {
      canonical.description = e.description;
    }
    // Fill in missing fields
    if (!canonical.epoch && e.epoch) canonical.epoch = e.epoch;
    if (canonical.gender === "unknown" && e.gender !== "unknown") canonical.gender = e.gender;
    if ((canonical.religion === "unknown" || !canonical.religion) && e.religion && e.religion !== "unknown") canonical.religion = e.religion;
  }

  allAliases.delete(canonical.name);
  canonical.aliases = [...allAliases];
  canonical.sources = allSources;

  // Replace first entry
  chars[group[0]] = canonical;
  for (let i = 1; i < group.length; i++) {
    mergedIndices.add(group[i]);
  }

  console.log(`  ${canonical.name} <- ${entries.slice(1).map(e => e.name).join(", ")}`);
}

const result = chars.filter((_, i) => !mergedIndices.has(i));
result.sort((a, b) => a.name.localeCompare(b.name));

await Bun.write(CHARS_FILE, JSON.stringify(result, null, 2));
console.log(`\n${chars.length} → ${result.length} персонажей`);
