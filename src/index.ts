import { Glob } from "bun";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const BOOK_DIR = import.meta.dir + "/../book";

type Article = { name: string; slug: string; content: string };
type Chapter = { name: string; slug: string; content: string; articles?: Article[] };
type Character = {
  name: string; aliases: string[]; type: string; epoch: string;
  gender: string; religion: string; description: string;
  sources: { article: string; quote: string }[];
};

async function loadBook(): Promise<Chapter[]> {
  const entries = await readdir(BOOK_DIR);
  const chapters: Chapter[] = [];

  for (const entry of entries.sort()) {
    if (entry === "00-chapters.txt" || entry.endsWith(".json")) continue;
    const fullPath = join(BOOK_DIR, entry);
    const s = await stat(fullPath);

    if (s.isFile() && entry.endsWith(".txt")) {
      const content = await Bun.file(fullPath).text();
      const slug = entry.replace(/\.txt$/, "");
      const firstLine = content.split("\n")[0].trim();
      chapters.push({ name: firstLine || slug, slug, content });
    } else if (s.isDirectory()) {
      const articleFiles = (await readdir(fullPath)).filter((f) => f.endsWith(".txt")).sort();
      const articles: Article[] = [];
      for (const af of articleFiles) {
        const content = await Bun.file(join(fullPath, af)).text();
        const slug = `${entry}/${af.replace(/\.txt$/, "")}`;
        const firstLine = content.split("\n")[0].trim();
        articles.push({ name: firstLine || af, slug, content });
      }
      chapters.push({ name: entry, slug: entry, content: "", articles });
    }
  }
  return chapters;
}

async function loadCharacters(): Promise<Character[]> {
  try {
    return await Bun.file(join(BOOK_DIR, "characters.json")).json();
  } catch { return []; }
}

function wordCount(s: string) {
  return s.split(/\s+/).filter(Boolean).length;
}

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TYPE_LABELS: Record<string, string> = {
  person: "персона", historical: "историч.", mythical: "мифич.", concept: "концепт",
};
const RELIGION_COLORS: Record<string, string> = {
  "христианство": "#8b0000", "ислам": "#006400", "иудаизм": "#b8860b",
  "хазарская вера": "#4a0082", "khazar faith": "#4a0082",
};

function renderPage(body: string, title = "Хазарский словарь") {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { max-width: 900px; margin: 2rem auto; padding: 0 1rem; font-family: Georgia, serif; line-height: 1.7; color: #222; }
  a { color: #1a5276; text-decoration: none; }
  a:hover { text-decoration: underline; }
  h1 { border-bottom: 1px solid #ccc; padding-bottom: 0.5rem; }
  h2 { color: #333; margin-top: 2rem; }
  ul { list-style: none; padding: 0; }
  li { margin: 0.3rem 0; }
  .folder { margin: 0.8rem 0 0.2rem; }
  .folder-name { font-weight: bold; color: #8b0000; }
  .folder-name.green { color: #006400; }
  .folder-name.yellow { color: #b8860b; }
  .articles { padding-left: 1.2rem; }
  .articles li { margin: 0.15rem 0; font-size: 0.95em; }
  .wc { color: #999; font-size: 0.8em; margin-left: 0.3em; }
  pre { white-space: pre-wrap; font-family: Georgia, serif; font-size: 1rem; line-height: 1.7; }
  .nav { margin: 2rem 0; font-size: 0.9rem; }
  .nav a { margin-right: 1rem; }
  .tabs { display: flex; gap: 0; border-bottom: 2px solid #ccc; margin: 1.5rem 0 1rem; }
  .tab { padding: 0.5rem 1.2rem; cursor: pointer; border: 1px solid transparent; border-bottom: none; margin-bottom: -2px; color: #666; }
  .tab.active { border-color: #ccc; border-bottom: 2px solid #fff; color: #222; font-weight: bold; }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 0.8rem 1rem; background: #fafafa; }
  .card:hover { border-color: #999; background: #f5f5f0; }
  .card-name { font-weight: bold; font-size: 1.05em; margin-bottom: 0.2rem; }
  .card-name a { color: #222; }
  .card-meta { font-size: 0.8em; color: #888; margin-bottom: 0.3rem; }
  .card-meta span { margin-right: 0.6em; }
  .badge { display: inline-block; padding: 0.1em 0.4em; border-radius: 3px; font-size: 0.75em; color: #fff; }
  .card-desc { font-size: 0.9em; color: #444; line-height: 1.5; }
  .card-sources { font-size: 0.75em; color: #999; margin-top: 0.4rem; }
  .card-aliases { font-size: 0.8em; color: #777; font-style: italic; }
  .filter-bar { margin-bottom: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .filter-bar input { padding: 0.4rem 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-family: Georgia, serif; font-size: 0.9em; flex: 1; min-width: 200px; }
</style>
</head><body>${body}
<script>
document.querySelectorAll('.tabs').forEach(tabs => {
  tabs.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const group = tab.dataset.group;
      tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content[data-group="'+group+'"]').forEach(c => c.classList.remove('active'));
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });
});
const searchInput = document.getElementById('char-search');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(q) ? '' : 'none';
    });
  });
}
</script>
</body></html>`;
}

const FOLDER_LABELS: Record<string, { label: string; css: string }> = {
  "14-red": { label: "Красная книга — Христианские источники", css: "" },
  "16-green": { label: "Зелёная книга — Исламские источники", css: " green" },
  "18-yellow": { label: "Жёлтая книга — Еврейские источники", css: " yellow" },
};

function renderCharacterCard(ch: Character) {
  const relColor = RELIGION_COLORS[ch.religion] || "#666";
  const typeLabel = TYPE_LABELS[ch.type] || ch.type;
  const genderIcon = ch.gender === "female" ? "&#9792;" : ch.gender === "male" ? "&#9794;" : "";
  const srcCount = ch.sources.length;

  let html = `<div class="card">`;
  html += `<div class="card-name"><a href="/char/${encodeURIComponent(ch.name)}">${escHtml(ch.name)}</a> ${genderIcon}</div>`;
  if (ch.aliases?.length) html += `<div class="card-aliases">${ch.aliases.map(escHtml).join(", ")}</div>`;
  html += `<div class="card-meta">`;
  html += `<span class="badge" style="background:${relColor}">${escHtml(ch.religion)}</span> `;
  html += `<span>${typeLabel}</span>`;
  if (ch.epoch) html += ` <span>${escHtml(ch.epoch)}</span>`;
  html += `</div>`;
  html += `<div class="card-desc">${escHtml(ch.description)}</div>`;
  html += `<div class="card-sources">${srcCount} источник${srcCount > 4 ? "ов" : srcCount > 1 ? "а" : ""}</div>`;
  html += `</div>`;
  return html;
}

function renderCharacterPage(ch: Character) {
  const relColor = RELIGION_COLORS[ch.religion] || "#666";
  const typeLabel = TYPE_LABELS[ch.type] || ch.type;
  const genderIcon = ch.gender === "female" ? "&#9792;" : ch.gender === "male" ? "&#9794;" : "";

  let html = `<h1>${escHtml(ch.name)} ${genderIcon}</h1>`;
  if (ch.aliases?.length) html += `<p class="card-aliases">${ch.aliases.map(escHtml).join(", ")}</p>`;
  html += `<p><span class="badge" style="background:${relColor}">${escHtml(ch.religion)}</span> ${typeLabel}`;
  if (ch.epoch) html += ` &middot; ${escHtml(ch.epoch)}`;
  html += `</p>`;
  html += `<p>${escHtml(ch.description)}</p>`;
  html += `<h2>Источники</h2>`;
  for (const src of ch.sources) {
    html += `<div style="margin:0.8rem 0;padding:0.6rem 1rem;border-left:3px solid #ccc;background:#fafafa;">`;
    html += `<div style="font-size:0.85em;color:#666;margin-bottom:0.3rem;"><a href="/${src.article}">${escHtml(src.article)}</a></div>`;
    if (src.quote) html += `<div style="font-style:italic;">&laquo;${escHtml(src.quote)}&raquo;</div>`;
    html += `</div>`;
  }
  html += `<div class="nav"><a href="/">← Оглавление</a></div>`;
  return html;
}

function renderIndex(chapters: Chapter[], characters: Character[]) {
  let html = "<h1>Хазарский словарь</h1><p>Милорад Павич</p>";

  // Tabs
  html += `<div class="tabs" data-group="main">`;
  html += `<div class="tab active" data-group="main" data-target="tab-chapters">Главы</div>`;
  html += `<div class="tab" data-group="main" data-target="tab-characters">Персонажи (${characters.length})</div>`;
  html += `</div>`;

  // Chapters tab
  html += `<div id="tab-chapters" class="tab-content active" data-group="main"><ul>`;
  for (const ch of chapters) {
    if (ch.articles) {
      const info = FOLDER_LABELS[ch.slug] || { label: ch.slug, css: "" };
      html += `<li class="folder"><span class="folder-name${info.css}">${escHtml(info.label)}</span>`;
      html += `<ul class="articles">`;
      for (const a of ch.articles) {
        html += `<li><a href="/${a.slug}">${escHtml(a.name)}</a> <span class="wc">${wordCount(a.content)}</span></li>`;
      }
      html += `</ul></li>`;
    } else {
      html += `<li><a href="/${ch.slug}">${escHtml(ch.name)}</a> <span class="wc">${wordCount(ch.content)}</span></li>`;
    }
  }
  html += "</ul></div>";

  // Characters tab
  html += `<div id="tab-characters" class="tab-content" data-group="main">`;
  html += `<div class="filter-bar"><input id="char-search" type="text" placeholder="Поиск персонажа..."></div>`;
  html += `<div class="cards">`;
  const sorted = [...characters].sort((a, b) => b.sources.length - a.sources.length);
  for (const ch of sorted) {
    html += renderCharacterCard(ch);
  }
  html += `</div></div>`;

  return html;
}

const chapters = await loadBook();
const characters = await loadCharacters();

// Build lookup
type Entry = { name: string; content: string; slug: string };
const allEntries: Entry[] = [];
for (const ch of chapters) {
  if (ch.articles) {
    for (const a of ch.articles) allEntries.push(a);
  } else {
    allEntries.push(ch);
  }
}
const entryMap = new Map(allEntries.map((e) => [e.slug, e]));
const charMap = new Map(characters.map((c) => [c.name, c]));

Bun.serve({
  port: 7777,
  fetch(req) {
    const url = new URL(req.url);
    const path = decodeURIComponent(url.pathname);

    if (path === "/") {
      return new Response(renderPage(renderIndex(chapters, characters)), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Character page
    if (path.startsWith("/char/")) {
      const name = path.slice(6);
      const ch = charMap.get(name);
      if (ch) {
        return new Response(renderPage(renderCharacterPage(ch), ch.name), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    // Article page
    const slug = path.slice(1);
    const entry = entryMap.get(slug);
    if (entry) {
      const idx = allEntries.indexOf(entry);
      let nav = '<div class="nav"><a href="/">← Оглавление</a>';
      if (idx > 0) nav += ` <a href="/${allEntries[idx - 1].slug}">← Пред.</a>`;
      if (idx < allEntries.length - 1) nav += ` <a href="/${allEntries[idx + 1].slug}">След. →</a>`;
      nav += "</div>";
      const body = `<h1>${escHtml(entry.name)}</h1><pre>${escHtml(entry.content)}</pre>${nav}`;
      return new Response(renderPage(body, entry.name), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log("Serving book at http://localhost:7777");
