import fs from 'node:fs';

const zhPath = '/tmp/macereason-zh-train.jsonl';
const enPath = '/tmp/acereason-math.jsonl';
const outputPath = new URL('../macereason_daily_problems.json', import.meta.url);

const readJsonl = (path) => fs.readFileSync(path, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
const zhRows = readJsonl(zhPath);
const enRows = readJsonl(enPath);

const unsuitable = /(\[asy\]|<img|\\begin\{asy\}|diagram|figure|图中|如图|下图|附图)/i;
const candidates = zhRows
  .map((zh) => ({ zh, en: enRows[zh.original_idx] }))
  .filter(({ zh, en }) => en && zh.problem && en.problem && zh.solution && en.answer)
  .filter(({ zh, en }) => !unsuitable.test(zh.problem) && !unsuitable.test(en.problem))
  .filter(({ zh, en }) => zh.problem.length >= 18 && zh.problem.length <= 340 && en.problem.length <= 760)
  .filter(({ zh, en }) => zh.solution.length <= 120 && en.answer.length <= 120)
  .sort((a, b) => (a.zh.problem.length + a.en.problem.length) - (b.zh.problem.length + b.en.problem.length));

// Keep a broad but browser-friendly range: shorter prompts for Standard and
// longer prompts for Challenge. IDs retain the upstream original_idx pairing.
const standard = candidates.slice(80, 240);
const challenge = candidates.slice(520, 680);
const problems = [...standard.map((row) => [row, 'standard']), ...challenge.map((row) => [row, 'challenge'])]
  .map(([row, level]) => ({
    id: `macereason-${row.zh.original_idx}`,
    originalIdx: row.zh.original_idx,
    level,
    content: { zh: row.zh.problem, en: row.en.problem },
    answers: { zh: row.zh.solution, en: row.en.answer },
    solutions: { zh: row.zh.solution, en: row.en.answer }
  }));

const payload = {
  schemaVersion: 1,
  source: {
    name: 'mAceReason-Math',
    repository: 'https://github.com/apple/ml-macereason-math',
    license: 'CC BY-NC-ND 4.0',
    split: 'parallel train',
    note: 'English originals paired with Chinese machine translations by original_idx; test translations were human-reviewed, while this cached train subset was not individually human-reviewed.'
  },
  problems
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${problems.length} paired problems to ${outputPath.pathname}`);
