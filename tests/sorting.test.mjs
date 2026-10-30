import test from 'node:test';
import assert from 'node:assert/strict';
import Sorting from '../dist/bend/sorting.mjs';

const list = values => values.reduceRight((tail, head) => ({ $: 'Con', head, tail }), { $: 'Nil' });
function array(values) {
  const result = [];
  while (values.$ === 'Con') {
    result.push(values.head);
    values = values.tail;
  }
  assert.equal(values.$, 'Nil');
  return result;
}

test('Sorting: pure merge sort handles empty, singleton, odd lengths and duplicates', () => {
  for (const values of [[], [9], [2, 1], [8, 3, 8, 0, 5, 3, 1], [4, 4, 4], [0, 1, 2, 3]]) {
    const input = list(values);
    const expected = [...values].sort((a, b) => a - b);
    assert.deepEqual(array(Sorting.sort(input)), expected);
    assert.deepEqual(array(input), values, 'the reusable input is unchanged');
    assert.deepEqual(array(Sorting.sort(input)), expected, 'the input may be reused');
  }
});

test('Sorting: playback exposes genuine simultaneous merge stages, not an input/output shortcut', () => {
  const frames = values => array(Sorting.frames(list(values))).map(array);
  assert.deepEqual(frames([8, 7, 6, 5, 4, 3, 2, 1]), [
    [8, 7, 6, 5, 4, 3, 2, 1],
    [7, 8, 5, 6, 3, 4, 1, 2],
    [5, 6, 7, 8, 1, 2, 3, 4],
    [1, 2, 3, 4, 5, 6, 7, 8],
  ]);
  // A finished shorter branch stays in place while its sibling progresses.
  assert.deepEqual(frames([5, 4, 3, 2, 1]), [
    [5, 4, 3, 2, 1],
    [4, 5, 3, 1, 2],
    [4, 5, 1, 2, 3],
    [1, 2, 3, 4, 5],
  ]);
  assert.deepEqual(frames([]), [[]]);
  assert.deepEqual(frames([7]), [[7]]);
});

function counts(values) {
  const result = new Map();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function checkRun(values) {
  const input = list(values);
  const expected = [...values].sort((a, b) => a - b); // Independent comparison-sort oracle.
  const sorted = Sorting.sort(input);
  assert.deepEqual(array(sorted), expected);
  assert.deepEqual(array(Sorting.sort(sorted)), expected, 'sorting is idempotent');
  const history = Sorting.frames(input);
  const frames = array(history).map(array);
  assert.deepEqual(frames[0], values, 'the first frame is the exact input order');
  assert.deepEqual(frames.at(-1), expected, 'the last frame agrees with sort and the oracle');
  assert.equal(frames.length, values.length < 2 ? 1 : Math.ceil(Math.log2(values.length)) + 1);
  const multiset = counts(values);
  for (const frame of frames) {
    assert.equal(frame.length, values.length, 'every frame retains the full length');
    assert.deepEqual(counts(frame), multiset, 'every frame retains all multiplicities');
  }
  assert.deepEqual(array(input), values, 'frame generation does not consume its reusable input');
  assert.deepEqual(array(history).map(array), frames, 'history can be traversed again');
}

test('Sorting: exhaust every list of length zero through seven over three duplicate-containing values', () => {
  for (let length = 0; length <= 7; length++) {
    for (let code = 0; code < 3 ** length; code++) {
      let rest = code;
      const values = Array.from({ length }, () => { const value = rest % 3; rest = Math.floor(rest / 3); return value; });
      checkRun(values);
    }
  }
});

test('Sorting: unsigned boundaries and larger uneven trees preserve every value in every frame', () => {
  const boundaries = [0, 1, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff];
  for (const a of boundaries) for (const b of boundaries) for (const c of boundaries) checkRun([a, b, c]);
  let seed = 0x9e3779b9;
  for (const length of [2, 3, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65, 127, 128, 129, 255, 256, 257, 511, 512, 513, 1024]) {
    checkRun(Array.from({ length }, (_, index) => length - index));
    checkRun(Array.from({ length }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    }));
  }
});

test('Sorting: frozen shared input nodes survive repeated sort and frame calls', () => {
  const input = list([0xffffffff, 0, 7, 7, 0x80000000]);
  for (let node = input; node.$ === 'Con'; node = node.tail) Object.freeze(node);
  const snapshot = structuredClone(input);
  const first = Sorting.frames(input);
  const before = structuredClone(first);
  assert.deepEqual(array(Sorting.sort(input)), [0, 7, 7, 0x80000000, 0xffffffff]);
  assert.deepEqual(Sorting.frames(input), first);
  assert.deepEqual(first, before, 'existing history is unchanged by later calls');
  assert.deepEqual(input, snapshot);
});
