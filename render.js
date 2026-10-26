// Run: node render.js [link ...]. Needs Google Chrome.
// Saves pictures of finished houses in renders/, to check room kits by eye before they ship. With no links, it draws
// 7 houses that turn her rooms one slot on each time, so every room stands in every slot once. A link is the part
// after the #, like rooms=lkdvbto&name=Andrea.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const load = (src) => {
  const ctx = { module: { exports: {} }, URLSearchParams };
  vm.runInNewContext(src, ctx);
  return ctx.module.exports;
};
const font = load(fs.readFileSync(path.join(__dirname, 'glyphs.js'), 'utf8'));
const H = load(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').match(/<script id="house">([\s\S]*?)<\/script>/)[1]);

const links = process.argv.slice(2);
const houses = links.length ? links.map((l) => H.decode(l, font))
  : H.ROOMS.map((_, k) => ({ rooms: H.ROOMS.map((_, i) => H.ROOMS[(i + k) % H.ROOMS.length]), name: `turn ${k}` }));
const out = path.join(__dirname, 'renders');
fs.mkdirSync(out, { recursive: true });
houses.forEach((house, k) => {
  const sh = H.drawing(font, house), file = path.join(out, `house-${k}`);
  fs.writeFileSync(file + '.svg', H.svg(sh, 2));
  execFileSync(CHROME, ['--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--window-size=${Math.round(sh.w * 2)},${Math.round(sh.h * 2)}`, `--screenshot=${file}.png`, 'file://' + file + '.svg'], { stdio: 'ignore' });
  fs.unlinkSync(file + '.svg');
  console.log(`${file}.png  ${H.encode(house)}`);
});
