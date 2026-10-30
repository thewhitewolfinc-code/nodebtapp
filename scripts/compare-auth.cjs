const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/auth-validation');
const read = (file) => PNG.sync.read(fs.readFileSync(file));
function normalize(source, width = 393, height = 698) {
  const target = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.min(source.width - 1, (x + 0.5) * source.width / width - 0.5);
    const sy = Math.min(source.height - 1, (y + 0.5) * source.height / height - 0.5);
    const x0 = Math.max(0, Math.floor(sx)), y0 = Math.max(0, Math.floor(sy));
    const x1 = Math.min(source.width - 1, x0 + 1), y1 = Math.min(source.height - 1, y0 + 1);
    const fx = Math.max(0, sx - x0), fy = Math.max(0, sy - y0);
    for (let c = 0; c < 3; c++) {
      const a = source.data[(y0 * source.width + x0) * 4 + c] * (1 - fx) + source.data[(y0 * source.width + x1) * 4 + c] * fx;
      const b = source.data[(y1 * source.width + x0) * 4 + c] * (1 - fx) + source.data[(y1 * source.width + x1) * 4 + c] * fx;
      target.data[(y * width + x) * 4 + c] = Math.round(a * (1 - fy) + b * fy);
    }
    target.data[(y * width + x) * 4 + 3] = 255;
  }
  return target;
}
const reference = normalize(read(path.join(root, 'Design reference/auth-ref-screen.png')));
const initial = normalize(read(path.join(output, 'initial.png')));
const final = normalize(read(path.join(output, 'final.png')));
const board = new PNG({ width: 393 * 3, height: 698 });
[reference, initial, final].forEach((p, index) => PNG.bitblt(p, board, 0, 0, 393, 698, index * 393, 0));
fs.writeFileSync(path.join(output, 'comparison.png'), PNG.sync.write(board));
const overlay = new PNG({ width: 393, height: 698 });
for (let i = 0; i < overlay.data.length; i += 4) {
  for (let c = 0; c < 3; c++) overlay.data[i + c] = Math.round((reference.data[i + c] + final.data[i + c]) / 2);
  overlay.data[i + 3] = 255;
}
fs.writeFileSync(path.join(output, 'overlay.png'), PNG.sync.write(overlay));
fs.writeFileSync(path.join(output, 'reference-normalized.png'), PNG.sync.write(reference));
const linear = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => [0.2126, 0.7152, 0.0722].reduce((sum, w, c) => sum + w * linear(parseInt(hex.slice(c * 2 + 1, c * 2 + 3), 16)), 0);
const pairs = [
  ['body on canvas', '#58616C', '#FAFCF8'], ['action label on lime', '#101909', '#C2F568'],
  ['guest label on white', '#101909', '#FFFFFF'], ['focus on canvas', '#176640', '#FAFCF8'],
  ['error on error surface', '#A32932', '#FFF0F0'], ['info on info surface', '#175A91', '#EEF6FE'],
];
const contrast = pairs.map(([name, text, surface]) => {
  const a = luminance(text), b = luminance(surface);
  return { name, text, surface, ratio: Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)) };
});
fs.writeFileSync(path.join(output, 'contrast.json'), JSON.stringify(contrast, null, 2) + '\n');
console.log(JSON.stringify({ normalized: '393x698', order: ['reference', 'initial', 'final'], contrast }, null, 2));
