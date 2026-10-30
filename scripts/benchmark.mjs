import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { availableParallelism } from 'node:os';
import assert from 'node:assert/strict';

const threads = Math.min(4, availableParallelism());
const expected = {
  automaton: '128 cells / 1000 steps forward + 1000 backward / restored: True',
  fractal: 'Mandelbrot 256x256, iterations=128, checksum=1689364',
  lights: ['board=65535 solvable=True moves=10260 count=4', 'board=19 solvable=True moves=1 count=1', 'board=0 solvable=True moves=0 count=0', 'board=1 solvable=False moves=0 count=0'].join('\n'),
};
console.log('Native CPU / five interleaved runs / median wall time, including process startup.');
console.log('Small workloads may be slower with more threads. No GPU is used.');
for (const name of ['fractal', 'lights', 'automaton', 'gravity', 'raytracer', 'sorting']) {
  const reference = spawnSync(process.execPath, [`build/${name}.cjs`], { encoding: 'utf8', timeout: 120000 });
  assert.equal(reference.status, 0, reference.stderr || reference.error?.message);
  const output = reference.stdout.trim();
  assert.ok(output.length > 0, `${name}: reference must produce output`);
  if (expected[name]) assert.equal(output, expected[name]);
  const results = new Map([...new Set([1, threads])].map(n => [n, []]));
  for (let repeat = 0; repeat < 6; repeat++) {
    const order = [...results.keys()];
    if (repeat % 2) order.reverse();
    for (const count of order) {
      const start = performance.now();
      const result = spawnSync(`./build/${name}`, ['+RTS', '--threads', String(count)], { encoding: 'utf8', timeout: 120000 });
      assert.equal(result.status, 0, result.stderr || result.error?.message);
      assert.equal(result.stdout.trim(), output, `${name}, ${count} threads versus JS reference`);
      if (repeat > 0) results.get(count).push(performance.now() - start);
    }
  }
  console.log(name + ': ' + [...results].map(([count, times]) => `${count} thread(s) ${times.sort((a, b) => a - b)[2].toFixed(1)} ms`).join(' | ') + ' | outputs verified');
}
