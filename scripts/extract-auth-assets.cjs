const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'assets/auth');
fs.mkdirSync(output, { recursive: true });
const read = (name) => PNG.sync.read(fs.readFileSync(path.join(root, 'Design reference', name)));
const reference = read('auth-ref-screen.png');
function crop(source, x, y, width, height, name, alpha) {
  const result = new PNG({ width, height });
  PNG.bitblt(source, result, x, y, width, height, 0, 0);
  if (alpha) for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const i = (row * width + col) * 4;
    result.data[i + 3] = alpha(result.data[i], result.data[i + 1], result.data[i + 2], row, col);
  }
  fs.writeFileSync(path.join(output, name), PNG.sync.write(result));
}
// Extract supplied artwork, never regenerate the brand. No UI text is baked into the screen.
const logo = read('Logoicon.png');
crop(logo, 324, 232, 646, 754, 'brand-mark.png', (r, g, b) => {
  const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, r, g, b);
  const green = Math.min(1, Math.max(0, (saturation - 0.4) / 0.1));
  const yellowHighlight = g >= r && g >= b ? Math.min(1, Math.max(0, (r - b - 20) / 20)) : 0;
  return Math.round(Math.max(green, yellowHighlight) * 255);
});
crop(reference, 0, 724, 941, 294, 'landscape.png', (r, g, b, row) => Math.round(Math.min(1, row / 38, (294 - row) / 32) * 255));
crop(reference, 151, 1258, 52, 53, 'google.png');
const iconAlpha = (r, g, b) => Math.round(255 * Math.min(1, Math.max(0, ((Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, r, g, b) - 0.2) / 0.15)));
crop(reference, 153, 1400, 53, 70, 'guest-leaf.png', iconAlpha);
crop(reference, 160, 1032, 44, 49, 'privacy.png', iconAlpha);
crop(reference, 450, 1032, 40, 49, 'lock.png', iconAlpha);
crop(reference, 733, 1038, 48, 41, 'cloud.png', iconAlpha);


// Preserve the complete side foliage/clouds. Remove the reference's baked-in
// logo/copy region; runtime branding and copy are native elements above this image.
crop(reference, 0, 320, 941, 698, 'backdrop.png', (r, g, b, row, col) => {
  const distanceFromCopy = Math.max(260 - col, col - 700, row - 410);
  const copyMask = Math.min(1, Math.max(0, distanceFromCopy / 18));
  return Math.round(255 * Math.min(1, row / 25, (698 - row) / 22) * copyMask);
});
