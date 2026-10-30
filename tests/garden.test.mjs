import test from 'node:test';
import assert from 'node:assert/strict';
import Garden from '../dist/bend/garden.mjs';

// Public seams agreed for this experiment: seed, step, and advance.
const chemical = (u, v) => ({ $: 'Chemical', u, v });
const list = cells => cells.reduceRight((tail, head) => ({ $: 'Con', head, tail }), { $: 'Nil' });
function unpack(cells) {
  const result = [];
  while (cells.$ === 'Con') {
    assert.equal(cells.head.$, 'Chemical');
    result.push(cells.head);
    cells = cells.tail;
  }
  assert.equal(cells.$, 'Nil');
  return result;
}

test('Garden: asymmetric one-step fixture uses all nine old cells and wraps both axes', () => {
  const cells = Array.from({ length: 25 }, () => chemical(1, 0));
  cells[0] = chemical(0.5, 0.25);
  cells[11] = chemical(0.75, 0.125);
  const actual = unpack(Garden.step(5, list(cells), 0.04, 0.06));
  // Independently worked sparse fixture. At source A (0,0): lapU=.5,
  // lapV=-.25, uvv=.03125, so next=(.56875,.23625). Source B (1,2)
  // has lapU=.25, lapV=-.125, uvv=.01171875. A contributes (-.016,.004)
  // to orthogonal water neighbors and (-.004,.001) to diagonal ones;
  // B contributes half as much. Their neighborhoods overlap asymmetrically.
  const expected = [
    [.56875, .23625], [.984, .004], [1, 0], [1, 0], [.984, .004],
    [.982, .0045], [.988, .003], [.998, .0005], [1, 0], [.996, .001],
    [.992, .002], [.78828125, .11421875], [.992, .002], [1, 0], [1, 0],
    [.998, .0005], [.992, .002], [.998, .0005], [1, 0], [1, 0],
    [.984, .004], [.996, .001], [1, 0], [1, 0], [.996, .001],
  ];
  assert.equal(actual.length, expected.length);
  expected.forEach(([u, v], i) => {
    assert.ok(Math.abs(actual[i].u - u) < 2e-7, `cell ${i}: u=${actual[i].u}, expected ${u}`);
    assert.ok(Math.abs(actual[i].v - v) < 2e-7, `cell ${i}: v=${actual[i].v}, expected ${v}`);
  });
});

test('Garden: zero and multiple steps preserve reusable immutable input', () => {
  const original = list([
    chemical(.5, .25), chemical(.75, .125), chemical(.6, .3), chemical(1, 0),
  ]);
  const saved = structuredClone(original);
  for (let cursor = original; cursor.$ === 'Con'; cursor = cursor.tail) {
    Object.freeze(cursor.head);
    Object.freeze(cursor);
  }
  assert.deepEqual(Garden.advance(0, 2, original, .04, .06), saved);
  let repeated = original;
  for (let i = 0; i < 17; i++) repeated = Garden.step(2, repeated, .04, .06);
  assert.deepEqual(Garden.advance(17, 2, original, .04, .06), repeated);
  assert.deepEqual(original, saved);
  assert.deepEqual(Garden.advance(17, 2, original, .04, .06), repeated, 'same snapshot can be reused');
  assert.notDeepEqual(repeated, original, 'this is not an identity evolution');
});

test('Garden: all-water equilibrium stays exact, including empty and tiny grids', () => {
  for (const size of [0, 1, 2, 5, 48]) {
    const initial = list(Array.from({ length: size * size }, () => chemical(1, 0)));
    for (const [feed, kill] of [[.01, .01], [.04, .06], [.08, .08]]) {
      assert.deepEqual(unpack(Garden.advance(8, size, initial, feed, kill)), unpack(initial));
    }
  }
});

test('Garden: one- and two-cell sides count repeated toroidal neighbors', () => {
  const [single] = unpack(Garden.step(1, list([chemical(.5, .25)]), .04, .06));
  // Every neighbor of the singleton is itself: zero diffusion, only reaction/feed/loss.
  assert.ok(Math.abs(single.u - .48875) < 1e-7);
  assert.ok(Math.abs(single.v - .25625) < 1e-7);
  const four = unpack(Garden.step(2, list([
    chemical(.5, .25), chemical(1, 0), chemical(1, 0), chemical(1, 0),
  ]), .04, .06));
  // Orthogonal positions each see the source twice; opposite sees it four times diagonally.
  const expected = [[.56875, .23625], [.968, .008], [.968, .008], [.984, .004]];
  expected.forEach(([u, v], i) => {
    assert.ok(Math.abs(four[i].u - u) < 1e-7);
    assert.ok(Math.abs(four[i].v - v) < 1e-7);
  });
});

test('Garden: three deterministic row-major seed patterns are distinct and reusable', () => {
  for (const size of [0, 1, 8, 48, 64]) {
    const patterns = [];
    for (const pattern of [0, 1, 2]) {
      const initial = unpack(Garden.seed(size, pattern));
      assert.equal(initial.length, size * size);
      assert.deepEqual(unpack(Garden.seed(size, pattern)), initial);
      assert.ok(initial.every(({ u, v }) => (u === 1 && v === 0) || (u === .5 && v >= .25 && v <= .271)));
      if (size >= 8) {
        assert.ok(initial.some(({ v }) => v > 0), 'pattern contains reagent');
        assert.ok(initial.some(({ v }) => v === 0), 'pattern has a water background');
      }
      patterns.push(initial);
    }
    if (size >= 8) {
      assert.notDeepEqual(patterns[0], patterns[1]);
      assert.notDeepEqual(patterns[1], patterns[2]);
      assert.notDeepEqual(patterns[0], patterns[2]);
    }
    assert.deepEqual(unpack(Garden.seed(size, 0xffffffff)), patterns[0], 'unknown index selects central patch');
  }
  const tiny = unpack(Garden.seed(8, 0));
  assert.deepEqual(tiny.flatMap(({ v }, i) => v > 0 ? [i] : []), [27, 28, 35, 36]);
  // Coordinate-keyed perturbation breaks perfect symmetry without random state.
  for (const [i, v] of [[27, .252], [28, .264], [35, .270], [36, .260]]) {
    assert.ok(Math.abs(tiny[i].v - v) < 3e-8);
  }
});

test('Garden: display-sized presets grow nonuniform patterns and remain numerically bounded', t => {
  for (const size of [48, 64]) {
    for (const [pattern, feed, kill] of [[0, .035, .062], [1, .025, .06], [2, .055, .062]]) {
      const initial = Garden.seed(size, pattern);
      const saved = unpack(initial).map(({ u, v }) => ({ u, v }));
      const initialActive = saved.filter(({ v }) => v > .1).length;
      let state = initial;
      // Inspect intermediate states too, not just a potentially lucky final snapshot.
      for (let batch = 0; batch < 10; batch++) {
        state = Garden.advance(100, size, state, feed, kill);
        const cells = unpack(state);
        assert.equal(cells.length, size * size);
        assert.ok(cells.every(({ u, v }) => Number.isFinite(u) && Number.isFinite(v)
          && u >= 0 && u <= 1 && v >= 0 && v <= 1));
      }
      const final = unpack(state);
      const active = final.filter(({ v }) => v > .1).length;
      assert.ok(active > initialActive * 1.3, 'reagent spreads beyond its original patch');
      assert.ok(active < size * size * .7, 'the whole grid is not uniformly saturated');
      assert.ok(final.some(({ v }) => v > .3), 'pattern has strong reagent concentration');
      assert.ok(final.some(({ v }) => v < .01), 'pattern retains low-concentration space');
      assert.ok(final.some(({ v }, i) => Math.abs(v - saved[i].v) > .1), 'visible evolution, not just rounding drift');
      assert.deepEqual(unpack(initial).map(({ u, v }) => ({ u, v })), saved, 'large seed snapshot is reusable');
      if (size === 48) {
        // Recorded from the Bend 2.0.39 native CLI at both 1 and 2 threads.
        // This is only a state digest; JS does not integrate any chemistry.
        const checksum = final.reduce((sum, { u, v }, i) => sum
          + Math.floor(Math.fround(10000 * u)) + (i + 1) * Math.floor(Math.fround(10000 * v)), 0);
        assert.equal(checksum, [550088513, 1108593321, 1312631738][pattern]);
      }
      t.diagnostic(`${size}x${size}, pattern=${pattern}, feed=${feed}, kill=${kill}, active cells: ${initialActive} -> ${active}`);
    }
  }
});

test('Garden: rate-slider corners stay finite through sustained seeded evolution', () => {
  for (const pattern of [0, 1, 2]) {
    for (const feed of [.01, .08]) for (const kill of [.01, .08]) {
      let state = Garden.seed(16, pattern);
      for (let batch = 0; batch < 10; batch++) {
        state = Garden.advance(100, 16, state, feed, kill);
        assert.ok(unpack(state).every(({ u, v }) => Number.isFinite(u) && Number.isFinite(v)
          && u >= 0 && u <= 1 && v >= 0 && v <= 1));
      }
    }
  }
});
