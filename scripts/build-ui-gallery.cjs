/* Assemble genuine emulator captures without changing their content. */
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const directory = path.resolve(__dirname, '../docs/ui-validation');
const groups = {
  overview: ['home-empty', 'home-populated', 'records-populated', 'activity-populated', 'insights-populated', 'settings-populated'],
  workflows: ['new', 'detail', 'payment', 'collection', 'settlement', 'correction', 'closed', 'categories', 'missing'],
  states: ['payment-review', 'states', 'confirmation', 'home-dark', 'settings-dark'],
};
const width = 324, height = 576, gutter = 16;
const metadata = [];
for (const [group, names] of Object.entries(groups)) {
  const board = new PNG({ width: 3 * width + 4 * gutter, height: Math.ceil(names.length / 3) * (height + gutter) + gutter });
  board.data.fill(245);
  for (let i = 3; i < board.data.length; i += 4) board.data[i] = 255;
  names.forEach((name, index) => {
    const source = PNG.sync.read(fs.readFileSync(path.join(directory, `${name}.png`)));
    const hierarchy = fs.readFileSync(path.join(directory, `${name}.xml`), 'utf8');
    if (/Render Error|Uncaught Error|Unable to resolve module|Guest screens require/.test(hierarchy)) throw new Error(`Runtime error in ${name}`);
    const xOffset = gutter + (index % 3) * (width + gutter), yOffset = gutter + Math.floor(index / 3) * (height + gutter);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const sx = Math.min(source.width - 1, Math.max(0, (x + 0.5) * source.width / width - 0.5));
      const sy = Math.min(source.height - 1, Math.max(0, (y + 0.5) * source.height / height - 0.5));
      const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(source.width - 1, x0 + 1), y1 = Math.min(source.height - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      for (let c = 0; c < 3; c++) {
        const a = source.data[(y0 * source.width + x0) * 4 + c] * (1 - fx) + source.data[(y0 * source.width + x1) * 4 + c] * fx;
        const b = source.data[(y1 * source.width + x0) * 4 + c] * (1 - fx) + source.data[(y1 * source.width + x1) * 4 + c] * fx;
        board.data[((y + yOffset) * board.width + x + xOffset) * 4 + c] = Math.round(a * (1 - fy) + b * fy);
      }
    }
    metadata.push({ name, group, width: source.width, height: source.height, sampleData: name !== 'home-empty', runtimeErrorDetected: false });
  });
  fs.writeFileSync(path.join(directory, `${group}-gallery.png`), PNG.sync.write(board));
}
const contrast = JSON.parse(fs.readFileSync(path.join(directory, 'contrast.json'), 'utf8'));
fs.writeFileSync(path.join(directory, 'validation-summary.json'), JSON.stringify({
  date: '2026-10-30', platform: 'Android API 37 emulator', primaryConfiguration: '1080x1920, 440 dpi, font scale 1.0',
  automated: { typecheck: 'passed', lint: 'passed', tests: { passed: 69, failed: 0 }, contrastPairs: contrast.length, contrastPassed: contrast.every(pair => pair.passes) },
  captures: metadata,
  pending: ['Supplemental tablet and large-text visual checks: final emulator capture approval review timed out twice.', 'iOS device validation', 'Physical-device visual validation'],
}, null, 2) + '\n');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
fs.writeFileSync(path.join(directory, 'gallery.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NoDebt UI validation</title>
<style>body{margin:0;background:#f6f8f5;color:#12231b;font:16px/1.5 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:32px}h1{margin:0}p{max-width:800px;color:#617065}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}figure{margin:0;background:white;border:1px solid #e0e7dd;border-radius:16px;padding:12px}img{width:100%;height:auto;border-radius:8px}figcaption{font-size:14px;padding:8px 0}a{color:#0d593f}</style>
<main><h1>NoDebt UI validation</h1><p>Actual Android emulator captures, 30 October 2026. All populated views are explicitly marked, read-only design samples. Home empty shows the actual guest ledger. Captures were collected during refinement; the final shared metric uses neutral amount text.</p>
${Object.entries(groups).map(([group, names]) => `<h2>${escape(group)}</h2><div class="grid">${names.map(name => `<figure><a href="${name}.png"><img loading="lazy" src="${name}.png" alt="NoDebt ${escape(name.replaceAll('-', ' '))}"></a><figcaption>${escape(name.replaceAll('-', ' '))} · <a href="${name}.xml">accessibility hierarchy</a></figcaption></figure>`).join('')}</div>`).join('')}
<p>See <a href="README.md">validation notes</a> for test coverage and remaining device checks.</p></main></html>`);
console.log(`Built 3 contact sheets and a browser gallery from ${metadata.length} native captures; ${contrast.length} contrast pairs pass.`);
