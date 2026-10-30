import test from 'node:test';
import assert from 'node:assert/strict';
import Lights from '../dist/bend/lights.mjs';
import Fractal from '../dist/bend/fractal.mjs';
import Automaton from '../dist/bend/automaton.mjs';

// Independent coordinate oracle, not the implementation's bit shifts/chase.
function pressOracle(board, index) {
  const row = Math.floor(index / 4), column = index % 4;
  for (const [dy, dx] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const y = row + dy, x = column + dx;
    if (y >= 0 && y < 4 && x >= 0 && x < 4) board ^= 1 << (4 * y + x);
  }
  return board;
}
test('Lights Out: every board gets a globally minimal, deterministically tied solution', () => {
  const best = new Map();
  for (let moves = 0; moves < 65536; moves++) {
    let board = 0, count = 0;
    for (let index = 0; index < 16; index++) {
      if (moves & (1 << index)) { board = pressOracle(board, index); count++; }
    }
    assert.equal(Lights.apply(0, moves), board);
    if (!best.has(board) || count < best.get(board).count) best.set(board, { moves, count });
  }
  assert.equal(best.size, 4096);
  for (let board = 0; board < 65536; board++) {
    const result = Lights.solve(board), expected = best.get(board);
    assert.equal(result.solvable, Boolean(expected), `solvability: ${board}`);
    assert.equal(result.moves, expected?.moves ?? 0, `minimum/tie: ${board}`);
    assert.equal(result.count, expected?.count ?? 0);
    if (result.solvable) assert.equal(Lights.apply(board, result.moves), 0);
  }
});

test('Lights Out: edges never wrap, high bits normalize, and invalid indices are safe', () => {
  for (const board of [0, 1, 0xa591, 65535]) {
    for (let index = 0; index < 16; index++) {
      assert.equal(Lights.press(board, index), pressOracle(board, index));
      assert.equal(Lights.press(Lights.press(board, index), index), board);
    }
  }
  assert.equal(Lights.press(0, 3), 140);
  assert.equal(Lights.press(0, 4), 305);
  assert.equal(Lights.press(0xfeed1234, 0xffffffff), 0x1234);
  assert.equal(Lights.press(0xfeed1234, 16), 0x1234);
  assert.equal(Lights.apply(0xffff0000, 0xffff0000), 0);
  assert.deepEqual(Lights.solve(0xffff0001), Lights.solve(1));
});

function flatten(tree, width) {
  const pixels = new Array(width * width);
  function visit(node) {
    if (node.$ === 'Quad') [node.tl, node.tr, node.bl, node.br].forEach(visit);
    else {
      let cursor = node.counts, i = 0;
      while (cursor.$ === 'Con') {
        const offset = (node.y + Math.floor(i / node.size)) * width + node.x + i % node.size;
        assert.equal(pixels[offset], undefined, 'tiles cannot overlap');
        pixels[offset] = cursor.head;
        cursor = cursor.tail;
        i++;
      }
      assert.equal(i, node.size ** 2);
    }
  }
  visit(tree);
  assert.equal(pixels.filter(value => value !== undefined).length, width ** 2);
  return pixels;
}

test('Fractal: orbit boundaries, zero budget, and Julia constants outside radius two', () => {
  assert.equal(Fractal.escape(32, 0, 0, false, 0, 0), 32);
  assert.equal(Fractal.escape(32, -1, 0, false, 0, 0), 32);
  assert.equal(Fractal.escape(32, 3, 0, false, 0, 0), 1);
  assert.equal(Fractal.escape(32, 2, 0, false, 0, 0), 2);
  assert.equal(Fractal.escape(0, 3, 0, false, 0, 0), 0);
  assert.equal(Fractal.escape(32, 3, 0, true, 0, 0), 0);
  // z=-3 is a fixed point when c=-12; radius 2 alone would misclassify it.
  assert.equal(Fractal.escape(32, -3, 0, true, -12, 0), 32);
});

test('Fractal: asymmetric coordinates, quadrant placement and native reference checksum', () => {
  const single = flatten(Fractal.render(0, 3, 0, 1000000, 32, false, 0, 0), 1);
  assert.deepEqual(single, [1]);
  // centers: (-0.5,1), (1.5,1), (-0.5,-1), (1.5,-1) would be symmetric;
  // offset Y deliberately makes the four samples distinguish orientation.
  const tiny = flatten(Fractal.render(1, 0.5, 0.5, 4, 32, false, 0, 0), 2);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const cx = -0.5 + 2 * x, cy = 1.5 - 2 * y;
    let zx = 0, zy = 0, n = 0;
    while (n < 32 && zx * zx + zy * zy <= 4) {
      [zx, zy] = [zx * zx - zy * zy + cx, 2 * zx * zy + cy]; n++;
    }
    assert.equal(tiny[y * 2 + x], n);
  }
  const image = flatten(Fractal.render(8, -.5, 0, 3, 128, false, 0, 0), 256);
  assert.equal(image.reduce((sum, value) => sum + value, 0), 1689364);
  // Cross tile boundaries in an asymmetric view. Eight steps keep these
  // dyadic-coordinate orbits far from sensitive long-running boundaries.
  const tiled = flatten(Fractal.render(4, .5, .5, 4, 8, false, 0, 0), 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const cx = -1.5 + (x + .5) / 4, cy = 2.5 - (y + .5) / 4;
    let zx = 0, zy = 0, n = 0;
    while (n < 8 && zx * zx + zy * zy <= 4) {
      [zx, zy] = [zx * zx - zy * zy + cx, 2 * zx * zy + cy]; n++;
    }
    assert.equal(tiled[y * 16 + x], n, `pixel ${x},${y}`);
  }
  assert.ok(flatten(Fractal.render(4, .25, -.5, 3, 0, true, -.75, .11), 16).every(n => n === 0));
});

const row = (pairs) => pairs.reduceRight((tail, [past, now]) => ({ $: 'Con', head: { $: 'Cell', past, now }, tail }), { $: 'Nil' });
test('Reversible universe: real evolution, fixed boundaries and both state layers round-trip', () => {
  const seed = row([[false, false], [false, true], [false, false]]);
  const expected = row([[false, true], [true, false], [false, true]]);
  assert.deepEqual(Automaton.forward(seed), expected);
  assert.deepEqual(Automaton.forward(row([[true, false]])), row([[false, true]]));
  // Exhaust every past/current combination up to four cells, not just zero past.
  for (let width = 0; width <= 4; width++) {
    for (let mask = 0; mask < 2 ** (2 * width); mask++) {
      const state = row(Array.from({ length: width }, (_, i) => [Boolean(mask & (1 << (i * 2))), Boolean(mask & (1 << (i * 2 + 1)))]));
      assert.deepEqual(Automaton.backward(Automaton.forward(state)), state);
      assert.deepEqual(Automaton.forward(Automaton.backward(state)), state);
      assert.deepEqual(Automaton.rewind(17, Automaton.travel(17, state)), state);
    }
  }
});
