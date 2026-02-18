const chapters = [
  { file: "14-ХРИСТИАНСКИЕ-ИСТОЧНИКИ-О-ХАЗАРСКОМ-ВОПРОСЕ.txt", dir: "14-red" },
  { file: "16-ИСЛАМСКИЕ-ИСТОЧНИКИ-О-ХАЗАРСКОМ-ВОПРОСЕ.txt", dir: "16-green" },
  { file: "18-ЕВРЕЙСКИЕ-ИСТОЧНИКИ-О-ХАЗАРСКОМ-ВОПРОСЕ.txt", dir: "18-yellow" },
];

const bookDir = import.meta.dir + "/../book";

// Article heading: 5 spaces + ALL-CAPS first word (2+ uppercase letters)
// Handles: АТЕХ, БРАНКОВИЧ, Д-р (special case), LIBER
// Require ALL-CAPS word (2+ uppercase letters): АТЕХ, БРАНКОВИЧ, LIBER
// Special case: "Д-р" prefix followed by ALL-CAPS word
const headingRe = /^     ((?:Д-р\s+)?[А-ЯA-Z]{2,}[А-ЯA-Z\-]*)/;

function extractName(line: string): string {
  // Grab everything from the heading up to " - ", " @", or end
  const afterIndent = line.replace(/^     /, "");
  // Take the "name" part: all-caps words before the description
  let name = afterIndent
    .replace(/\s*[@*]+\s*.*/, "")       // remove @ and after
    .replace(/\s*\(.*/, "")              // remove (year...) and after
    .replace(/\s+-\s+.*/, "")            // remove " - description"
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+$/, "");
  return name;
}

for (const ch of chapters) {
  const text = await Bun.file(`${bookDir}/${ch.file}`).text();
  const lines = text.split("\n");

  const articles: { name: string; lines: string[] }[] = [];
  let current: { name: string; lines: string[] } | null = null;
  let blankCount = 0;

  for (const line of lines) {
    if (line.trim() === "") {
      blankCount++;
      if (current) current.lines.push(line);
      continue;
    }

    const m = line.match(headingRe);
    // New article: all-caps heading after 2+ blank lines
    if (m && blankCount >= 2) {
      const name = extractName(line);
      if (current) articles.push(current);
      current = { name, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }

    blankCount = 0;
  }
  if (current) articles.push(current);

  // Write files
  const outDir = `${bookDir}/${ch.dir}`;
  await Bun.$`rm -rf ${outDir} && mkdir -p ${outDir}`;

  for (let i = 0; i < articles.length; i++) {
    const num = String(i + 1).padStart(2, "0");
    const filename = `${num}-${articles[i].name}.txt`;
    const content = articles[i].lines.join("\n").trimEnd() + "\n";
    await Bun.write(`${outDir}/${filename}`, content);
    console.log(`  ${ch.dir}/${filename} (${content.length} chars)`);
  }

  console.log(`\n${ch.dir}: ${articles.length} articles\n`);
}
