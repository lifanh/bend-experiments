import test from 'node:test';
import assert from 'node:assert/strict';
import Raytracer from '../dist/bend/raytracer.mjs';

const vec = (x, y, z) => ({ $: 'Vec', x, y, z });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} ≈ ${expected}`);

test('Ray tracer: sphere intersections select the nearest forward root', () => {
  const center = vec(0, 0, 0);
  close(Raytracer.raySphere(vec(0, 0, 5), vec(0, 0, -1), center, 1), 4);
  close(Raytracer.raySphere(vec(0, 0, 5), vec(0, 0, -2), center, 1), 2);
  close(Raytracer.raySphere(vec(1, 0, 5), vec(0, 0, -1), center, 1), 5);
  close(Raytracer.raySphere(center, vec(0, 0, 1), center, 1), 1);
  close(Raytracer.raySphere(vec(0, 0, 1), vec(0, 0, -1), center, 1), 2);
  assert.equal(Raytracer.raySphere(vec(2, 0, 5), vec(0, 0, -1), center, 1), -1);
  assert.equal(Raytracer.raySphere(vec(0, 0, 5), vec(0, 0, 1), center, 1), -1);
  assert.equal(Raytracer.raySphere(center, vec(0, 0, 0), center, 1), -1);
});

function flatten(tree, width) {
  const pixels = new Array(width * width);
  function visit(node) {
    if (node.$ === 'Quad') {
      [node.tl, node.tr, node.bl, node.br].forEach(visit);
      return;
    }
    assert.equal(node.$, 'Tile');
    assert.ok(Number.isInteger(node.x) && Number.isInteger(node.y));
    assert.ok(node.size >= 1 && node.size <= 8);
    assert.ok(node.x >= 0 && node.y >= 0 && node.x + node.size <= width && node.y + node.size <= width);
    let cursor = node.pixels, index = 0;
    while (cursor.$ === 'Con') {
      const offset = (node.y + Math.floor(index / node.size)) * width + node.x + index % node.size;
      assert.equal(pixels[offset], undefined, 'tiles must not overlap');
      assert.ok(Number.isInteger(cursor.head) && cursor.head >= 0 && cursor.head <= 0xffffff);
      pixels[offset] = cursor.head;
      cursor = cursor.tail;
      index++;
    }
    assert.equal(cursor.$, 'Nil');
    assert.equal(index, node.size ** 2);
  }
  visit(tree);
  assert.equal(pixels.filter(value => value !== undefined).length, width ** 2);
  return pixels;
}

const rgb = packed => [packed >>> 16, (packed >>> 8) & 255, packed & 255];

test('Ray tracer: bounded RGB tiles contain sky, ground, and teal/coral/gold spheres', () => {
  for (const depth of [0, 1, 3, 4]) flatten(Raytracer.render(depth, 0, -3, 0, false), 2 ** depth);
  const image = flatten(Raytracer.render(6, 0, -3, 0, false), 64);
  const colors = image.map(rgb);
  assert.ok(new Set(image).size > 300, 'lighting must produce a shaded scene, not flat fills');
  assert.ok(colors.filter(([r, g, b]) => g > r * 1.3 && b > r * 1.3).length > 50, 'teal sphere');
  assert.ok(colors.filter(([r, g, b]) => r > g * 1.3 && r > b * 1.3).length > 50, 'coral sphere');
  assert.ok(colors.filter(([r, g, b]) => r > b * 1.5 && g > b * 1.5 && r < g * 1.3).length > 15, 'gold sphere');
  assert.ok(colors[0][2] > colors[0][0], 'blue sky at top left');
  assert.notEqual(image[0], image.at(-1), 'ground differs from sky');
});

test('Ray tracer: geometric shadows darken surfaces without changing the sky', () => {
  const unshadowed = flatten(Raytracer.render(6, 0, -3, 0, false), 64);
  const shadowed = flatten(Raytracer.render(6, 0, -3, 0, true), 64);
  assert.ok(shadowed.filter((pixel, i) => pixel !== unshadowed[i]).length > 50);
  for (let i = 0; i < shadowed.length; i++) {
    const before = rgb(unshadowed[i]), after = rgb(shadowed[i]);
    assert.ok(after.every((channel, c) => channel <= before[c]), `shadows cannot add light at ${i}`);
  }
  assert.deepEqual(shadowed.slice(0, 64), unshadowed.slice(0, 64));
});

test('Ray tracer: reflections change spheres and ground, with a bounded material blend', () => {
  const matte = flatten(Raytracer.render(6, 0, -3, 0, true), 64);
  const reflected = flatten(Raytracer.render(6, 0, -3, 1, true), 64);
  assert.ok(reflected.filter((pixel, i) => pixel !== matte[i]).length > 500);
  assert.ok(reflected.slice(40 * 64).some((pixel, i) => pixel !== matte[40 * 64 + i]), 'floor reflects the scene');
  assert.deepEqual(reflected.slice(0, 64), matte.slice(0, 64), 'direct sky rays are not reflective surfaces');
  assert.deepEqual(flatten(Raytracer.render(4, 0, -3, -1, true), 16), flatten(Raytracer.render(4, 0, -3, 0, true), 16));
  assert.deepEqual(flatten(Raytracer.render(4, 0, -3, 2, true), 16), flatten(Raytracer.render(4, 0, -3, 1, true), 16));
});

test('Ray tracer: camera orbit and point-light movement change the actual image', () => {
  const base = flatten(Raytracer.render(6, 0, -3, 0.6, true), 64);
  const orbit = flatten(Raytracer.render(6, 0.5, -3, 0.6, true), 64);
  const relit = flatten(Raytracer.render(6, 0, 3, 0.6, true), 64);
  assert.ok(orbit.filter((pixel, i) => pixel !== base[i]).length > 500);
  assert.ok(relit.filter((pixel, i) => pixel !== base[i]).length > 500);
  assert.deepEqual(relit.slice(0, 64), base.slice(0, 64), 'moving a scene light cannot recolor the sky');
  assert.deepEqual(flatten(Raytracer.render(6, 0, -3, 0.6, true), 64), base, 'render is deterministic');
  for (const camera of [-0.8, 0.8]) for (const light of [-6, 6]) {
    for (const reflection of [0, 1]) for (const shadows of [false, true]) {
      flatten(Raytracer.render(4, camera, light, reflection, shadows), 16);
    }
  }
});

test('Ray tracer: pixel-center samples keep their coordinates across tile and quadrant boundaries', () => {
  const tiny = Raytracer.render(4, 0.3, -2, 0.6, true);
  assert.equal(tiny.$, 'Quad');
  assert.deepEqual([tiny.tl, tiny.tr, tiny.bl, tiny.br].map(t => [t.x, t.y, t.size]),
    [[0, 0, 8], [8, 0, 8], [0, 8, 8], [8, 8, 8]]);
  for (const depth of [0, 3, 4, 5]) {
    const size = 2 ** depth;
    const pixels = flatten(Raytracer.render(depth, 0.3, -2, 0.6, true), size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = 2 * (x + 0.5) / size - 1, v = 1 - 2 * (y + 0.5) / size;
      assert.equal(pixels[y * size + x], Raytracer.sample(u, v, 0.3, -2, 0.6, true), `pixel ${x},${y}`);
    }
  }
});

test('Ray tracer: fixed native CPU reference checksum agrees with the JS target', () => {
  const pixels = flatten(Raytracer.render(7, 0, -3, 0.6, true), 128);
  // Independently obtained from raytracer-cli on both 1 and 4 native threads.
  assert.equal(pixels.reduce((sum, pixel) => (sum + pixel) >>> 0, 0), 1421989472);
});
