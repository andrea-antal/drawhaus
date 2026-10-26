// Run: node --test house.test.js
// Tests the drawing script that ships inside index.html, with the Plotline pen paths.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

const load = (src) => {
  const ctx = { module: { exports: {} }, URLSearchParams }; // the browser has URLSearchParams; a bare vm context has not
  vm.runInNewContext(src, ctx);
  return ctx.module.exports;
};
const font = load(fs.readFileSync(__dirname + '/glyphs.js', 'utf8'));
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const H = load(html.match(/<script id="house">([\s\S]*?)<\/script>/)[1]);
const { iso, box, hide, plan, drawing, scene, STAGES, ROOMS, SLOTS, KIT, BED, HOUSE, WAVE } = H;

const near = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`);

test('the camera looks from the front right corner, turned 45° and down at 20°: z straight up', () => {
  const [ax, ay] = iso([1, 0, 0]), [bx, by] = iso([0, 1, 0]), [cx, cy] = iso([0, 0, 1]);
  near(bx, -ax, 'x right, y left');
  near(by, ay, 'x and y slope down alike');
  near(ay / ax, Math.sin((20 * Math.PI) / 180), 'looking down at 20°');
  near(cx, 0, 'z straight up');
  assert.ok(cy < 0, 'z up');
});

// Feet a line of sight climbs per foot it moves along x and y: zero on screen along [1, 1, CLIMB].
const CLIMB = (2 * iso([1, 0, 0])[1]) / -iso([0, 0, 1])[1];

test('a box shows 9 edges: top, right and front faces only', () => {
  const strokes = hide(box(0, 0, 0, 2, 3, 1, { stage: 0 }), []);
  assert.strictEqual(strokes.length, 9);
});

test('a line behind a box is hidden where the box covers it', () => {
  // Vertical line behind the near corner of a unit box: hidden up to where a line of sight grazes the box's top edge.
  const line = { pts: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 3]], stage: 0 };
  const strokes = hide(box(0, 0, 0, 1, 1, 1, { stage: 0, ink: false }), [line]);
  assert.strictEqual(strokes.length, 1);
  const ys = strokes[0].pts.map((p) => p[1]).sort((a, b) => a - b);
  near(ys[0], iso([-0.5, -0.5, 3])[1], 'top end');
  near(ys[1], iso([-0.5, -0.5, 1 - 0.5 * CLIMB])[1], 'hidden below the box');
});

test('a line drawn on a face stays visible', () => {
  const line = { pts: [[0.2, 0.5, 1], [0.8, 0.5, 1]], stage: 0 };
  const strokes = hide(box(0, 0, 0, 1, 1, 1, { stage: 0, ink: false }), [line]);
  assert.strictEqual(strokes.length, 1);
  near(strokes[0].pts[0][0], iso([0.2, 0.5, 1])[0], 'start');
  near(strokes[0].pts[1][0], iso([0.8, 0.5, 1])[0], 'end');
});

test('see-through faces do not hide lines', () => {
  const line = { pts: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 3]], stage: 0 };
  const strokes = hide(box(0, 0, 0, 1, 1, 1, { stage: 0, ink: false, see: true }), [line]);
  assert.strictEqual(strokes.length, 1);
  near(Math.abs(strokes[0].pts[0][1] - strokes[0].pts[1][1]), Math.abs(iso([0, 0, 3.5])[1]), 'full length');
});

// Strokes along the seam where box [0,1] meets box [1,2] in x.
const seamStrokes = (a, b) => {
  const faces = [...box(0, 0, 0, 1, 1, 1, a), ...box(1, 0, 0, 2, 1, 1, b)];
  const seam = [iso([1, 0, 1]), iso([1, 1, 1]), iso([1, 1, 0])];
  return hide(faces, []).filter((s) => s.pts.every((p) => seam.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6)));
};

test('two boxes side by side in one stage draw no seam where their faces meet', () => {
  assert.strictEqual(seamStrokes({ stage: 0 }, { stage: 0 }).length, 0);
});

test('boxes in different stages keep the seam, so each stage starts as a closed drawing', () => {
  assert.strictEqual(seamStrokes({ stage: 0 }, { stage: 1 }).length, 2);
});

test('joined boxes draw no seam, even across stages', () => {
  assert.strictEqual(seamStrokes({ stage: 0, join: true }, { stage: 1, join: true }).length, 0);
});

test('a crease stays even where two coplanar faces also meet on it', () => {
  // Two boxes side by side, with a third box on the first: its right face meets both tops along x = 1.
  const faces = [...box(0, 0, 0, 1, 1, 1, { stage: 0 }), ...box(1, 0, 0, 2, 1, 1, { stage: 0 }), ...box(0, 0, 1, 1, 1, 2, { stage: 0 })];
  const edge = [iso([1, 0, 1]), iso([1, 1, 1])];
  const on = hide(faces, []).filter((s) => s.pts.every((p) => edge.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6)));
  assert.strictEqual(on.length, 1);
});

test('plan waits before a stroke given a pause', () => {
  const opts = { draw: 10, travel: 20, lift: 0.5, home: [0, 0] };
  const two = [[[0, 0], [10, 0]], [[10, 10], [10, 30]]];
  const base = plan(two, opts).total;
  near(plan(two, { ...opts, pauses: { 1: 2 } }).total, base + 2, 'total');
});

// ---- The house a player builds ----

test('a player picks from her 7 rooms', () => {
  assert.deepStrictEqual([...ROOMS], ['lab', 'kitchen', 'dining', 'living', 'bedroom', 'bathroom', 'office']);
});

test('the house has 4 rooms on the ground floor and 3 upstairs, each floor split evenly along the house', () => {
  assert.strictEqual(SLOTS.length, 7);
  const ground = SLOTS.slice(0, 4), up = SLOTS.slice(4);
  for (const floor of [ground, up]) {
    assert.strictEqual(floor[0].x0, 0, 'starts at the left end wall');
    near(floor[floor.length - 1].x1, HOUSE.W, 'reaches the right end wall');
    for (const s of floor) near(s.x1 - s.x0, HOUSE.W / floor.length, 'even');
  }
  assert.ok(ground.every((s) => s.z === 0), 'ground floor');
  assert.ok(up.every((s) => s.z > 10), 'upstairs');
  near(KIT, HOUSE.W / 4, 'a room kit fits the narrower ground-floor room');
});

// Her house: her rooms in her order. Then 7 houses that turn her rooms one slot on each time, so every room
// stands in every slot once.
const HERS = { rooms: [...ROOMS], name: '', extras: ['heat pump'] };
const turn = (k) => ({ rooms: ROOMS.map((_, i) => ROOMS[(i + k) % ROOMS.length]), name: '' });
const sh = drawing(font, HERS);
const turns = ROOMS.map((_, k) => drawing(font, turn(k)));

test('every room kit fits in every slot: past the glass post on its left, inside the house, under the ceiling', () => {
  ROOMS.forEach((_, k) => {
    const house = turn(k), sc = scene(font, house);
    SLOTS.forEach((s, i) => {
      const faces = sc.faces.filter((f) => f.stage === i + 1 && f.kit);
      assert.ok(faces.length > 0, `${house.rooms[i]} in slot ${i + 1} has furniture`);
      for (const f of faces) {
        for (const [x, y, z] of f.pts) {
          const at = `${f.kit} in slot ${i + 1} at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`;
          assert.ok(x >= s.x0 + 0.15 - 1e-9 && x <= s.x0 + KIT + 1e-9, `${at}: off the room's length`);
          assert.ok(y >= -1e-9 && y <= HOUSE.D + 1e-9, `${at}: off the room's depth`);
          assert.ok(z >= s.z - 1e-9 && z <= HOUSE.ceiling(i, y) + 1e-9, `${at}: through the floor or the ceiling`);
        }
      }
    });
  });
});

// ---- Outside things and pets ----

const ALL = { ...HERS, extras: [...H.EXTRAS] }, NONE = { ...HERS, extras: [] };
const all = drawing(font, ALL), none = drawing(font, NONE);
// How many faces and lines each stage has: which pen draws a thing, or whether it is printed.
const perStage = (house) => {
  const sc = scene(font, house), n = STAGES.map(() => 0);
  for (const o of [...sc.faces, ...sc.items]) n[o.stage]++;
  return n;
};

test('outside, a player picks a heat pump, a rain barrel, an EV charger and a delivery box; and pets of their own', () => {
  assert.deepStrictEqual([...H.OUTSIDE], ['heat pump', 'rain barrel', 'EV charger', 'delivery box']);
  assert.deepStrictEqual([...H.PETS], ['cat', 'dog', 'fish']);
  assert.deepStrictEqual([...H.ATTIC], ['boxes', 'trunk', 'rocking horse', 'dress form', 'Christmas tree', 'fairy lights']);
  assert.deepStrictEqual([...H.EXTRAS], [...H.OUTSIDE, ...H.PETS, ...H.ATTIC]);
});

test('each outside thing and the cat are at the end wall, drawn last by the ground-floor pen; the dog and fish are printed on the lawn', () => {
  const base = perStage(NONE);
  for (const x of H.EXTRAS) {
    const n = perStage({ ...HERS, extras: [x] }), stage = H.ATTIC.includes(x) ? 8 : x === 'dog' || x === 'fish' ? 0 : 4;
    n.forEach((c, i) => {
      if (i === stage) assert.ok(c > base[i], `${x} adds to ${STAGES[i]}`);
      else assert.strictEqual(c, base[i], `${x} adds nothing to ${STAGES[i]}`);
    });
  }
  const dog = drawing(font, { ...NONE, extras: ['dog'] });
  assert.ok(dog.printed.length > none.printed.length, 'the dog is printed');
  for (const p of dog.printed.flatMap((s) => s.pts)) assert.ok(onLawn(p), 'the dog and its kennel stay on the lawn');
  const fish = drawing(font, { ...NONE, extras: ['fish'] });
  assert.ok(fish.printed.length > none.printed.length, 'the fish are printed');
  for (const p of fish.printed.flatMap((s) => s.pts)) assert.ok(onLawn(p), 'the pond and its fish stay on the lawn');
});

// The strokes a lawn thing adds, and the box round them on the sheet.
const key = (s) => JSON.stringify(s.pts);
const added = (house, base) => { const old = new Set(drawing(font, base).printed.map(key)); return drawing(font, house).printed.filter((s) => !old.has(key(s))); };
const bbox = (strokes) => {
  const xs = strokes.flatMap((s) => s.pts.map((p) => p[0])), ys = strokes.flatMap((s) => s.pts.map((p) => p[1]));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

// The box round each attic thing on the screen, from its faces and lines in the scene.
const atticBoxes = (house) => {
  const sc = scene(font, house), boxes = {};
  for (const o of [...sc.faces, ...sc.items]) {
    if (!o.tag || o.tag === 'window') continue;
    const b = (boxes[o.tag] ||= [Infinity, Infinity, -Infinity, -Infinity]);
    for (const [x, y] of o.pts.map(iso)) [b[0], b[1], b[2], b[3]] = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
  }
  return boxes;
};

test('in the attic, each thing stands on the attic floor, under the roof, and the upstairs pen draws it', () => {
  const g = HOUSE.GABLE(0), pitch = (g[2][1] - g[3][1]) / (g[2][0] - g[3][0]), under = (y) => 15.6 + pitch * y;
  for (const x of H.ATTIC) {
    const faces = scene(font, { ...NONE, extras: [x] }).faces.filter((f) => f.tag === x);
    for (const f of faces) {
      for (const [px, py, pz] of f.pts) {
        const at = `${x} at ${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)}`;
        assert.ok(px >= 0 && px <= HOUSE.W && py <= HOUSE.D, `${at}: outside the attic`);
        assert.ok(pz >= 20.6 - 1e-9 && pz <= under(py) + 1e-9, `${at}: through the attic floor or the roof`);
      }
    }
    const one = drawing(font, { ...NONE, extras: [x] });
    assert.ok(one.pens[1].strokes.length > none.pens[1].strokes.length, `${x}: drawn, not hidden`);
  }
});

test('in the attic, the things a player picks keep clear of each other and of the bird, the cow box and the bulb', () => {
  const boxes = atticBoxes({ ...NONE, extras: [...H.ATTIC] });
  assert.deepStrictEqual(Object.keys(boxes).sort(), [...H.ATTIC, 'bird', 'cow box', 'bulb'].sort());
  const names = Object.keys(boxes).filter((n) => n !== 'fairy lights'); // they hang along the whole attic, over everything
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const [a, b] = [boxes[names[i]], boxes[names[j]]];
      assert.ok(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1], `${names[i]} and ${names[j]} overlap`);
    }
  }
  // The lights slope down the screen with the house, so compare them with each thing where they pass over it.
  const sc = scene(font, { ...NONE, extras: [...H.ATTIC] });
  const lights = sc.items.filter((o) => o.tag === 'fairy lights').flatMap((o) => o.pts.map(iso));
  for (const n of names.filter((n) => n !== 'bulb')) { // the bulb's cord runs up past them to the roof
    const over = lights.filter(([x]) => x >= boxes[n][0] && x <= boxes[n][2]);
    assert.ok(over.length && Math.max(...over.map((p) => p[1])) < boxes[n][1], `the fairy lights hang into the ${n}`);
  }
});

test('on the lawn, the dog, the fish pond and the longest sign keep clear of each other', () => {
  const things = {
    dog: bbox(added({ ...NONE, extras: ['dog'] }, NONE)),
    fish: bbox(added({ ...NONE, extras: ['fish'] }, NONE)),
    sign: bbox(added({ ...NONE, name: 'W'.repeat(20) }, NONE)),
  };
  const names = Object.keys(things);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const [a, b] = [things[names[i]], things[names[j]]];
      const apart = a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1];
      assert.ok(apart, `${names[i]} and ${names[j]} overlap`);
    }
  }
});

test('the sheet stays the same size whatever stands outside, so the drawing does not jump', () => {
  for (const x of H.EXTRAS) {
    const one = drawing(font, { ...NONE, extras: [x] });
    near(one.w, none.w, `${x}: sheet width`);
    near(one.h, none.h, `${x}: sheet height`);
  }
  near(all.w, none.w, 'all: sheet width');
  near(all.h, none.h, 'all: sheet height');
});

test('the outside things and pets live in the link too, one letter each', () => {
  const house = { rooms: [...ROOMS], name: 'Ann', extras: ['rain barrel', 'cat'] };
  assert.strictEqual(H.encode(house), 'rooms=lkdvbto&extras=rc&flip=1&name=Ann');
  assert.deepStrictEqual([...H.decode('#' + H.encode(house), font).extras], ['rain barrel', 'cat']);
  assert.strictEqual(H.encode({ ...house, extras: [] }), 'rooms=lkdvbto&extras=&flip=1&name=Ann');
  assert.deepStrictEqual([...H.decode('#rooms=lkdvbto&extras=', font).extras], [], 'nothing outside');
  assert.deepStrictEqual([...H.decode('#rooms=lkdvbto&extras=cxcd', font).extras], ['cat', 'dog'], 'unknown letters and repeats drop out');
  assert.deepStrictEqual([...H.decode('#rooms=lkdvbto&extras=f', font).extras], ['fish']);
  assert.deepStrictEqual([...H.decode('#rooms=lkdvbto', font).extras], ['heat pump'], 'a link from before keeps its heat pump');
});

test('a random house gets each outside thing and pet on a coin toss', () => {
  assert.deepStrictEqual([...H.randomExtras(() => 0.4)], [...H.EXTRAS]);
  assert.deepStrictEqual([...H.randomExtras(() => 0.6)], []);
});

test('every room is drawn in every slot', () => {
  turns.forEach((t, k) => SLOTS.forEach((_, i) => {
    assert.ok(t.strokes.some((s) => s.stage === i + 1), `${turn(k).rooms[i]} in slot ${i + 1}`);
  }));
});

test('the house is cut in half through the ridge', () => {
  const g = [...HOUSE.GABLE(0)];
  const apex = g.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.strictEqual(apex[0], HOUSE.D, 'the ridge is on the cut');
  assert.strictEqual(g.filter((p) => p[1] === apex[1]).length, 1, 'one slope only');
});

test('the house is twice as deep as her first one, with its ridge at the same height', () => {
  assert.strictEqual(HOUSE.D, 13, 'from the back wall to the cut');
  near(Math.max(...HOUSE.GABLE(0).map((p) => p[1])), 15.6 + 6.5 * Math.sqrt(3), 'ridge height');
});

test('the drawing has a stage per slot, left to right on each floor, then the attic', () => {
  assert.deepStrictEqual([...STAGES], ['first view', 'ground floor 1', 'ground floor 2', 'ground floor 3', 'ground floor 4',
    'upstairs 1', 'upstairs 2', 'upstairs 3', 'attic']);
  for (let i = 0; i < STAGES.length; i++) assert.ok(sh.strokes.some((s) => s.stage === i), `${STAGES[i]} has strokes`);
});

// The lawn in front of the long side: below the line of the ground floor's front edge, so nothing there hides the house.
const edgeA = sh.at([0, HOUSE.D, -0.8]), edgeB = sh.at([HOUSE.W, HOUSE.D, -0.8]);
const onLawn = ([x, y]) => y > edgeA[1] + ((x - edgeA[0]) * (edgeB[1] - edgeA[1])) / (edgeB[0] - edgeA[0]) + 0.5;

test('the first view is printed; the pens draw the rest', () => {
  assert.ok(sh.printed.length > 0, 'first view');
  assert.ok(sh.printed.every((s) => s.stage === 0), 'printed = first view');
  for (const s of sh.printed) {
    for (const p of s.pts) assert.ok(onLawn(p), `first-view point at ${p[0].toFixed(0)},${p[1].toFixed(0)} is on the house`);
  }
});

test('the first view has a picket sign on the lawn in front of the long side', () => {
  const edge = sh.at([HOUSE.W, HOUSE.D, 0])[0];
  const lawn = sh.printed.filter((s) => s.pts.every((p) => onLawn(p) && p[0] < edge));
  assert.ok(lawn.length > 10, 'something stands on the lawn');
});

test('the sign says the player’s name, or welcome when there is none', () => {
  assert.deepStrictEqual([...sh.words.map((w) => w.str)], ['welcome']);
  assert.deepStrictEqual([...drawing(font, { ...HERS, name: 'Ági' }).words.map((w) => w.str)], ['Ági']);
});

test('the sign is at least 12px on a laptop screen', () => {
  const laptop = (900 - 32 - 120) / (sh.h + 2 * BED); // a 900px-tall window, less the gutters and the controls
  for (const w of sh.words) assert.ok(w.size * laptop >= 12, `${w.str} is ${(w.size * laptop).toFixed(1)}px`);
});

test('a name keeps only letters the pen can write: an accent it has not got drops off, 20 letters at most', () => {
  assert.strictEqual(H.cleanName('  Zoë 🏠  Őri  ', font), 'Zoe Őri');
  assert.strictEqual(H.cleanName('x'.repeat(30), font).length, 20);
  assert.strictEqual(H.cleanName('🏠', font), '');
});

test('the house lives in the link: one letter per room, ground floor first, then the name', () => {
  const house = { rooms: ['office', 'lab', 'lab', 'kitchen', 'bathroom', 'living', 'dining'], name: 'Andrea Antal', extras: ['heat pump', 'dog'] };
  const link = H.encode(house);
  assert.strictEqual(link, 'rooms=ollktvd&extras=hd&flip=1&name=Andrea+Antal');
  const back = H.decode('#' + link, font);
  assert.deepStrictEqual({ rooms: [...back.rooms], name: back.name, extras: [...back.extras] }, house);
  assert.strictEqual(H.encode(HERS), 'rooms=lkdvbto&extras=h&flip=1', 'no name, no name in the link');
});

test('a link with no house, or a broken one, gives a random house', () => {
  for (const hash of ['', '#', '#rooms=xyz', '#rooms=lkdvbtoo', '#name=Ann']) {
    const h = H.decode(hash, font);
    assert.deepStrictEqual([...h.rooms].sort(), [...ROOMS].sort(), `"${hash}"`);
  }
  assert.strictEqual(H.decode('#name=Ann', font).name, 'Ann');
});

test('a name from a link is cleaned like a typed one', () => {
  assert.strictEqual(H.decode('#rooms=lkdvbto&name=' + encodeURIComponent('  Zoë 🏠'), font).name, 'Zoe');
});

test('shuffle gives each of her 7 rooms one slot, in a random order', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const seen = new Set();
  for (let n = 0; n < 20; n++) {
    const r = H.shuffle(rand);
    assert.deepStrictEqual([...r].sort(), [...ROOMS].sort());
    seen.add(r.join());
  }
  assert.ok(seen.size > 10, `${seen.size} different houses in 20`);
});

test('the pens draw the end wall with the side door last, when they reach it from the left', () => {
  const edge = sh.at([HOUSE.W, HOUSE.D, 0])[0];
  for (const pen of sh.pens) assert.ok(pen.strokes.some((s) => s.pts.every((p) => p[0] > edge + 20 && !onLawn(p))), `${pen.name} draws its part of the end wall`);
});

test('two pens draw at once: one on the ground floor, one upstairs and in the attic', () => {
  const names = (pen) => [...pen.stages].map((i) => STAGES[i]);
  assert.strictEqual(sh.pens.length, 2);
  assert.deepStrictEqual(names(sh.pens[0]), ['ground floor 1', 'ground floor 2', 'ground floor 3', 'ground floor 4']);
  assert.deepStrictEqual(names(sh.pens[1]), ['upstairs 1', 'upstairs 2', 'upstairs 3', 'attic']);
  assert.strictEqual(sh.pens[0].strokes.length + sh.pens[1].strokes.length, sh.strokes.filter((s) => s.stage > 0).length);
  for (const pen of sh.pens) assert.ok(pen.strokes.every((s) => pen.stages.includes(s.stage)), `${pen.name} draws only its own rooms`);
});

test('each pen sweeps its floor in one pass from left to right: nothing further left comes after the right end', () => {
  for (const pen of sh.pens) {
    const keys = pen.strokes.map((s) => Math.min(...s.pts.map((p) => p[0])));
    let later = Infinity;
    for (let k = keys.length - 1; k >= 0; k--) {
      assert.ok(keys[k] <= later + WAVE + 1e-6, `${pen.name}: stroke ${k} of ${keys.length} is ${(keys[k] - later).toFixed(0)} units behind the sweep`);
      later = Math.min(later, keys[k]);
    }
  }
});

const inside = (poly, [x, y]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

test('the walls between rooms are glass: the room behind each pane shows through', () => {
  SLOTS.forEach((s, i) => {
    if (i === 3 || i === 6) return; // the end wall
    const t = turns[(ROOMS.length - i) % ROOMS.length]; // the house with the lab in slot i: its table is at the back
    const z0 = s.z + 0.5, z1 = HOUSE.ceiling(i, 0.5) - 0.5, z2 = HOUSE.ceiling(i, 12.5) - 0.5;
    const pane = [[s.x1, 0.5, z0], [s.x1, 12.5, z0], [s.x1, 12.5, z2], [s.x1, 0.5, z1]].map(t.at); // inside the frame
    const seen = t.strokes.filter((st) => st.stage === i + 1).flatMap((st) => st.pts).filter((p) => inside(pane, p));
    assert.ok(seen.length > 20, `lab in slot ${i + 1}: ${seen.length} points behind the pane`);
  });
});

test('the upstairs pen draws the upstairs floor, so nothing upstairs floats', () => {
  const a = sh.at([20, HOUSE.D, 10.3]), b = sh.at([21, HOUSE.D, 10.3]); // the cut face of the upstairs floor
  const up = sh.pens[1].strokes.filter((s) => s.pts.every((p) => Math.abs(p[1] - (a[1] + ((p[0] - a[0]) * (b[1] - a[1])) / (b[0] - a[0]))) < 5));
  assert.ok(up.length > 10, 'upstairs pen draws the upstairs floor cut');
});

test('the attic floor meets the roof in a line all the way to the door end', () => {
  const g = HOUSE.GABLE(0), pitch = (g[2][1] - g[3][1]) / (g[2][0] - g[3][0]);
  const yb = (20.6 - 15.6) / pitch; // where the attic floor top meets the roof underside
  const a = sh.at([20, yb, 20.6]), b = sh.at([HOUSE.W, yb, 20.6]);
  const close = (p) => {
    const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    return t > 0.05 && t < 0.95 && Math.hypot(a[0] + t * (b[0] - a[0]) - p[0], a[1] + t * (b[1] - a[1]) - p[1]) < 0.5;
  };
  const along = sh.strokes.filter((s) => s.pts.length >= 2 && s.pts.every(close));
  const span = along.reduce((n, s) => n + Math.hypot(s.pts[s.pts.length - 1][0] - s.pts[0][0], s.pts[s.pts.length - 1][1] - s.pts[0][1]), 0);
  assert.ok(span > 0.5 * Math.hypot(b[0] - a[0], b[1] - a[1]), `line drawn for ${span.toFixed(0)} of ${Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(0)} units`);
});

// ---- Roof and window styles ----

test('a player picks a roof: gable, steep or barn; and windows: classic, shutters, arched or round', () => {
  assert.deepStrictEqual([...H.ROOF_STYLES], ['gable', 'steep', 'barn']);
  assert.deepStrictEqual([...H.WINDOW_STYLES], ['classic', 'shutters', 'arched', 'round']);
});

test('every roof sits on the back wall and never comes lower than the gable, so every room and attic thing fits under it', () => {
  const gable = H.roofOf('gable');
  for (const r of H.ROOF_STYLES) {
    const { under } = H.roofOf(r);
    near(under(0), 15.6, `${r}: on top of the back wall`);
    for (let y = 0; y <= HOUSE.D + 1e-9; y += 0.25) assert.ok(under(y) >= gable.under(y) - 1e-9, `${r} lower than the gable at ${y}`);
    const sc = scene(font, { ...ALL, roof: r });
    for (const f of sc.faces.filter((f) => f.kit || H.ATTIC.includes(f.tag))) {
      for (const [, y, z] of f.pts) assert.ok(z <= under(y) + 1e-9, `${f.kit || f.tag} through the ${r} roof at ${y.toFixed(2)}, ${z.toFixed(2)}`);
    }
  }
});

test('no roof is shallower than the line of sight, so we never see a roof from above', () => {
  for (const r of H.ROOF_STYLES) {
    const { under } = H.roofOf(r);
    for (let y = 0; y < HOUSE.D; y += 0.25) assert.ok((under(y + 0.25) - under(y)) / 0.25 > CLIMB + 0.01, `${r} too shallow at ${y}`);
  }
});

test('the attic follows its roof: a barn roof gives a deeper attic floor; a steep roof a taller sheet', () => {
  assert.ok(H.roofOf('barn').back(20) < H.roofOf('gable').back(20) - 1, 'barn attic reaches further back');
  const steep = drawing(font, { ...HERS, roof: 'steep' });
  assert.ok(steep.h > sh.h, 'the steep roof is taller');
  for (const r of H.ROOF_STYLES) {
    const d = drawing(font, { ...ALL, roof: r }), tl = H.timeline(d);
    for (const t of d.strokes) for (const [x, y] of t.pts) assert.ok(x >= 0 && x <= d.w && y >= 0 && y <= d.h, `${r}: point ${x},${y} off the paper`);
    near(tl.total, 7, `${r}: seconds`, 0.2);
  }
});

test('each window style draws its own windows, clear of the EV charger, the porch light and the door', () => {
  const counts = H.WINDOW_STYLES.map((w) => drawing(font, { ...HERS, windows: w }).strokes.length);
  assert.strictEqual(new Set(counts).size, counts.length, `each style draws differently: ${counts}`);
  for (const w of H.WINDOW_STYLES) {
    const sc = scene(font, { ...ALL, windows: w });
    const ys = [...sc.faces, ...sc.items].filter((o) => o.tag === 'window').flatMap((o) => o.pts.map((p) => p[1]));
    assert.ok(ys.length > 0, `${w}: a window`);
    assert.ok(Math.min(...ys) > 7.1 && Math.max(...ys) < 11.35, `${w}: from ${Math.min(...ys).toFixed(2)} to ${Math.max(...ys).toFixed(2)}`);
  }
});

test('the roof and windows live in the link by name; the usual ones, a gable and classic windows, stay out of it', () => {
  const house = { ...HERS, roof: 'barn', windows: 'arched' };
  assert.strictEqual(H.encode(house), 'rooms=lkdvbto&extras=h&roof=barn&windows=arched&flip=1');
  const back = H.decode('#' + H.encode(house), font);
  assert.deepStrictEqual([back.roof, back.windows], ['barn', 'arched']);
  assert.strictEqual(H.encode({ ...HERS, roof: 'gable', windows: 'classic' }), 'rooms=lkdvbto&extras=h&flip=1');
  const old = H.decode('#rooms=lkdvbto&extras=h', font);
  assert.deepStrictEqual([old.roof, old.windows], ['gable', 'classic'], 'a link from before');
  const bad = H.decode('#rooms=lkdvbto&extras=h&roof=igloo&windows=x', font);
  assert.deepStrictEqual([bad.roof, bad.windows], ['gable', 'classic'], 'unknown styles');
  const random = H.decode('', font);
  assert.ok(H.ROOF_STYLES.includes(random.roof) && H.WINDOW_STYLES.includes(random.windows), 'a random house');
});

// ---- The mirror, ink and paper ----

const mirrored = drawing(font, { ...HERS, name: 'L', mirror: true }), plain = drawing(font, { ...HERS, name: 'L' });

test('mirrored, the door end is on the left: the same sheet', () => {
  near(mirrored.w, plain.w, 'sheet width');
  near(mirrored.h, plain.h, 'sheet height');
  const door = plain.at([HOUSE.W, HOUSE.D, 3]), mirroredDoor = mirrored.at([HOUSE.W, HOUSE.D, 3]);
  assert.ok(door[0] > plain.w / 2 && mirroredDoor[0] < mirrored.w / 2, 'the door end swaps sides');
  near(mirroredDoor[0], mirrored.w - door[0], 'mirrored across the middle');
  assert.strictEqual(mirrored.printed.length, plain.printed.length, 'the same lawn');
});

test('mirrored, the sign still reads left to right', () => {
  // An L: the top of its stem is at its left, its foot runs right. Mirrored it would be the other way round.
  for (const d of [plain, mirrored]) {
    const pts = d.printed.filter((s) => s.group === d.words[0].group).flatMap((s) => s.pts), xs = pts.map((p) => p[0]);
    const top = pts.reduce((a, b) => (b[1] < a[1] ? b : a)), [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    assert.ok(top[0] - x0 < (x1 - x0) / 2, `the L reads backwards ${d === mirrored ? 'mirrored' : 'plain'}`);
  }
});

test('mirrored, the pens still sweep from left to right, so they start at the door', () => {
  for (const pen of mirrored.pens) {
    const keys = pen.strokes.map((s) => Math.min(...s.pts.map((p) => p[0])));
    let later = Infinity;
    for (let k = keys.length - 1; k >= 0; k--) {
      assert.ok(keys[k] <= later + WAVE + 1e-6, `${pen.name}: stroke ${k} is behind the sweep`);
      later = Math.min(later, keys[k]);
    }
  }
  near(H.timeline(mirrored).total, 7, 'seconds', 0.2);
});

test('a player picks the ink and the paper; a blueprint always takes white ink', () => {
  assert.deepStrictEqual([...H.INKS], ['blue', 'black', 'dark gray', 'red']);
  assert.deepStrictEqual([...H.PAPERS], ['white', 'grid', 'blueprint', 'blueprint grid']);
  assert.strictEqual(H.look({}).ink, '#22439a', 'her blue ballpoint is the usual one');
  assert.strictEqual(new Set(H.INKS.map((ink) => H.look({ ink }).ink)).size, 4, 'four inks');
  assert.strictEqual(H.look({ ink: 'red', paper: 'blueprint' }).ink, H.look({ paper: 'blueprint grid' }).ink, 'white on a blueprint');
  assert.notStrictEqual(H.look({ paper: 'blueprint' }).paper, H.look({}).paper, 'blue paper');
  assert.deepStrictEqual([...H.PAPERS.map((paper) => !!H.look({ paper }).grid)], [false, true, false, true], 'grid lines');
});

test('the download keeps the ink, the paper and its grid', () => {
  const red = H.svg(sh, 2, { ink: 'red', paper: 'grid' });
  assert.ok(red.includes(H.look({ ink: 'red' }).ink), 'red ink');
  assert.ok(red.includes(H.look({ paper: 'grid' }).grid), 'grid lines');
  const blueprint = H.svg(sh, 2, { paper: 'blueprint' });
  assert.ok(blueprint.includes(H.look({ paper: 'blueprint' }).paper) && !blueprint.includes('<pattern'), 'blue paper, no grid');
});

test('the flip, ink and paper live in the link; the usual ones stay out of it', () => {
  // The usual house is mirrored, its door end on the left. The flip in the link turns it back.
  const house = { ...HERS, ink: 'red', paper: 'blueprint grid', mirror: false };
  assert.strictEqual(H.encode(house), 'rooms=lkdvbto&extras=h&ink=red&paper=blueprint+grid&flip=1');
  const back = H.decode('#' + H.encode(house), font);
  assert.deepStrictEqual([back.ink, back.paper, back.mirror], ['red', 'blueprint grid', false]);
  const usual = H.decode('#rooms=lkdvbto&extras=h', font);
  assert.deepStrictEqual([usual.ink, usual.paper, usual.mirror], ['blue', 'white', true], 'the usual ones');
  assert.strictEqual(H.encode({ ...HERS, mirror: true }), 'rooms=lkdvbto&extras=h', 'mirrored is the usual');
  assert.strictEqual(H.decode('', font).mirror, true, 'a random house is mirrored too');
  const bad = H.decode('#rooms=lkdvbto&ink=gold&paper=foil', font);
  assert.deepStrictEqual([bad.ink, bad.paper], ['blue', 'white'], 'unknown ones');
});

test('the pens draw any house in 7 seconds at 1x, however much its rooms hold, and finish together', () => {
  for (const s of [sh, all, ...turns]) {
    const tl = H.timeline(s), [a, b] = tl.plans.map((p) => p.total);
    near(tl.total, 7, 'total seconds', 0.2);
    assert.ok(Math.abs(a - b) < 0.2, `pens finish ${Math.abs(a - b).toFixed(2)} s apart`);
  }
});

test('everything stays on the paper, even with the longest name', () => {
  const long = drawing(font, { ...HERS, name: 'W'.repeat(20) });
  for (const s of [sh, long, all, ...turns]) {
    for (const t of s.strokes) for (const [x, y] of t.pts) assert.ok(x >= 0 && x <= s.w && y >= 0 && y <= s.h, `point ${x},${y}`);
  }
  for (const p of long.printed.flatMap((s) => s.pts)) assert.ok(onLawn(p), 'a long sign stays on the lawn');
});

test('the download is the finished drawing on paper: a path per stroke, and the name only as pen strokes', () => {
  const s = drawing(font, { ...HERS, name: '<b>&"' });
  const out = H.svg(s, 2);
  assert.match(out, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.strictEqual((out.match(/<path /g) || []).length, s.strokes.length);
  assert.ok(!out.includes('<b>') && !out.includes('&"'), 'the name is drawn, never written into the markup');
  assert.match(out, new RegExp(`width="${Math.round(s.w * 2)}"`), '2 px per sheet unit');
});

// ---- The spec table ----

// The player's rows: a label and a value each, up to 4. A blank row drops out; the labels are in capitals.
const SPECS = [['name', 'Ann'], ['', ''], ['location', 'Vancouver, Canada'], ['SCALE', '1:12']];
const spec = drawing(font, { ...HERS, specs: SPECS });
const boxOf = (strokes) => {
  const xs = strokes.flatMap((s) => s.pts.map((p) => p[0])), ys = strokes.flatMap((s) => s.pts.map((p) => p[1]));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

test('a spec table is printed in the bottom-right corner, with the rows the player writes', () => {
  assert.strictEqual(JSON.stringify(spec.spec.rows), JSON.stringify([['NAME', 'Ann'], ['LOCATION', 'Vancouver, Canada'], ['SCALE', '1:12']]));
  assert.ok(spec.spec.strokes.length > 0, 'the table is drawn');
  for (const s of spec.spec.strokes) assert.ok(spec.printed.includes(s), 'the table is printed with the first view');
  const [, , x1, y1] = boxOf(spec.spec.strokes);
  assert.ok(x1 > 0.9 * spec.w && y1 > 0.9 * spec.h, 'bottom right');
  assert.ok(spec.spec.size * ((320 - 32) / (spec.w + 2 * BED)) >= 12, 'at least 12px on a 320px phone');
});

test('with no specs, or only blank rows, there is no table and the sheet keeps its size', () => {
  for (const specs of [undefined, null, [], [['', ''], ['  ', '']]]) {
    const d = drawing(font, { ...HERS, specs });
    assert.strictEqual(d.spec, null, JSON.stringify(specs));
    assert.strictEqual(d.h, sh.h, 'the same sheet');
  }
});

test('the table grows the sheet under the lawn: the house stays where it was, and clear of the table', () => {
  assert.strictEqual(spec.w, sh.w, 'the same width');
  assert.ok(spec.h > sh.h, 'a taller sheet');
  const house = spec.strokes.filter((s) => !spec.spec.strokes.includes(s));
  assert.deepStrictEqual(house.map((s) => s.pts), sh.strokes.map((s) => s.pts), 'the same house');
  const [x0, y0] = boxOf(spec.spec.strokes);
  for (const s of house) for (const [x, y] of s.pts) assert.ok(x < x0 - 10 || y < y0 - 10, `house line at ${x.toFixed(0)},${y.toFixed(0)}`);
});

test('mirrored, the table stays in the bottom-right corner and reads left to right', () => {
  const m = drawing(font, { ...HERS, specs: SPECS, mirror: true });
  assert.deepStrictEqual(m.spec.strokes.map((s) => s.pts), spec.spec.strokes.map((s) => s.pts));
});

test('a row too long for the sheet makes the table smaller, so it stays on the paper', () => {
  const d = drawing(font, { ...HERS, specs: [['W'.repeat(20), 'W'.repeat(20)]] });
  const [x0, , x1] = boxOf(d.spec.strokes);
  assert.ok(x0 >= 28 - 1e-6 && x1 <= d.w - 28 + 1e-6, `the table spans ${x0.toFixed(0)} to ${x1.toFixed(0)} of ${d.w.toFixed(0)}`);
  assert.ok(d.spec.size < H.SPEC_SIZE, 'smaller');
});

test('the spec table takes as little of the screen as it can: the smallest size whose text makes 12px', () => {
  const house = { ...HERS, specs: SPECS };
  const px = (size, W, Hh) => {
    const d = drawing(font, house, size);
    return d.spec.size * Math.min(W / (d.w + 2 * BED), Hh / (d.h + 2 * BED));
  };
  for (const W of [320, 360, 375, 393, 430]) {
    const size = H.specFor(font, house, W - 32, 700);
    assert.ok(px(size, W - 32, 700) >= 12, `${W}px: ${px(size, W - 32, 700).toFixed(1)}px`);
    assert.ok(size === H.SPEC_SMALL || px(size - 1, W - 32, 700) < 12, `${W}px: ${size - 1} would make 12px too`);
  }
  assert.strictEqual(H.specFor(font, house, 1440 - 32, 900 - 32 - 52), H.SPEC_SMALL, 'a laptop takes the small size');
  assert.ok(px(H.SPEC_SMALL, 1440 - 32, 900 - 32 - 52) >= 12, 'still 12px on a laptop');
  const small = drawing(font, house, H.SPEC_SMALL);
  assert.strictEqual(small.strokes.length - small.spec.strokes.length, sh.strokes.length, 'the same house at any size');
});

test('the specs live in the link, cleaned like a name; with none the link has none', () => {
  const house = { ...HERS, mirror: true, specs: [['NAME', 'Ann'], ['', ''], ['SCALE', '1:12']] };
  const back = H.decode('#' + H.encode(house), font);
  assert.strictEqual(JSON.stringify(back.specs), JSON.stringify([['NAME', 'Ann'], ['SCALE', '1:12']]));
  assert.ok(!H.encode({ ...HERS, mirror: true }).includes('specs'), 'no specs, nothing in the link');
  assert.strictEqual(H.decode('#rooms=lkdvbto', font).specs, null, 'no specs');
  assert.strictEqual(JSON.stringify(H.decode('#rooms=lkdvbto&specs=', font).specs), '[]', 'specs on, every row blank');
  const typed = new URLSearchParams({ rooms: 'lkdvbto', specs: 'Zoë 🏠\tVancouver\nA\tB\nC\tD\nE\tF\nG\tH' }).toString();
  assert.strictEqual(JSON.stringify(H.decode('#' + typed, font).specs), JSON.stringify([['Zoe', 'Vancouver'], ['A', 'B'], ['C', 'D'], ['E', 'F']]), 'cleaned, 4 rows at most');
});
