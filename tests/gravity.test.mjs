import test from 'node:test';
import assert from 'node:assert/strict';
import Gravity from '../dist/bend/gravity.mjs';

const body = (mass, x, y, vx, vy) => ({ $: 'Body', mass, x, y, vx, vy });
const list = bodies => bodies.reduceRight((tail, head) => ({ $: 'Con', head, tail }), { $: 'Nil' });
function unpack(bodies) {
  const result = [];
  while (bodies.$ === 'Con') {
    result.push(bodies.head);
    bodies = bodies.tail;
  }
  assert.equal(bodies.$, 'Nil');
  return result;
}

test('Gravity: an isolated body travels ballistically with either integrator', () => {
  const initial = list([body(2, 1, -2, 0.5, -0.25)]);
  for (const verlet of [false, true]) {
    assert.deepEqual(Gravity.step(initial, 0.5, verlet), list([body(2, 1.25, -2.125, 0.5, -0.25)]));
    assert.deepEqual(Gravity.advance(8, initial, 0.5, verlet), list([body(2, 3, -3, 0.5, -0.25)]));
    assert.deepEqual(Gravity.step(list([]), 0.5, verlet), list([]));
    assert.deepEqual(Gravity.advance(0, initial, 0.5, verlet), initial);
  }
  assert.deepEqual(initial, list([body(2, 1, -2, 0.5, -0.25)]), 'the reusable input is unchanged');
});

test('Gravity: explicit Euler uses old velocities and softened, mass-weighted pair forces', () => {
  const initial = list([body(2, -0.5, 0, 0, 0), body(3, 0.5, 0, 0, 0)]);
  const [a, b] = unpack(Gravity.step(initial, 0.125, false));
  assert.equal(a.x, -0.5, 'explicit Euler drifts with the old velocity, not the new one');
  assert.equal(b.x, 0.5);
  // Separation=1, epsilon=.05: delta-v = dt * otherMass / (1.0025)^(3/2).
  assert.ok(Math.abs(a.vx - 0.37359813174981726) < 1e-7);
  assert.ok(Math.abs(b.vx + 0.24906542116654484) < 1e-7);
  assert.ok(Math.abs(a.mass * a.vx + b.mass * b.vx) < 2e-7, 'total momentum stays zero');
  assert.equal(a.vy, 0);
  assert.equal(b.vy, 0);
});

test('Gravity: velocity Verlet kicks, drifts, re-evaluates forces and is time-reversible', () => {
  const initial = list([body(2, -0.5, 0, 0, 0), body(3, 0.5, 0, 0, 0)]);
  const next = Gravity.step(initial, 0.125, true);
  const [a, b] = unpack(next);
  // x1 = x0 + dt*v0 + dt^2*a0/2, using the independently worked force above.
  assert.ok(Math.abs(a.x + 0.4766501167656364) < 1e-7);
  assert.ok(Math.abs(b.x - 0.48443341117709093) < 1e-7);
  assert.ok(Math.abs(a.mass * a.vx + b.mass * b.vx) < 2e-7);
  const asymmetric = list([body(2, -0.5, 0.25, 0.125, -0.25), body(3, 0.5, -0.25, -0.25, 0.5)]);
  const restored = unpack(Gravity.step(Gravity.step(asymmetric, 0.03125, true), -0.03125, true));
  unpack(asymmetric).forEach((expected, i) => {
    for (const field of ['mass', 'x', 'y', 'vx', 'vy']) {
      assert.ok(Math.abs(restored[i][field] - expected[field]) < 2e-7, `${i}.${field} round-trips`);
    }
  });
});

test('Gravity: energy counts kinetic energy and each softened pair once, including coincidence', () => {
  assert.equal(Gravity.energy(list([])), 0);
  assert.equal(Gravity.energy(list([body(2, 7, -4, 3, 4)])), 25, 'no self potential');
  const pair = list([body(2, -0.5, 0, 0, 0), body(3, 0.5, 0, 0, 0)]);
  assert.ok(Math.abs(Gravity.energy(pair) + 6 / Math.sqrt(1.0025)) < 1e-6);
  const coincident = list([body(1, 2, -3, 0, 0), body(2, 2, -3, 0, 0), body(3, 2, -3, 0, 0)]);
  assert.ok(Math.abs(Gravity.energy(coincident) + 220) < 2e-5, 'potential is -(2+3+6)/epsilon');
  for (const verlet of [false, true]) {
    const next = Gravity.advance(20, coincident, 0.01, verlet);
    assert.deepEqual(next, coincident, 'coincident resting bodies exert zero vector force');
    assert.ok(Number.isFinite(Gravity.energy(next)));
    for (const current of unpack(next)) {
      for (const field of ['mass', 'x', 'y', 'vx', 'vy']) assert.ok(Number.isFinite(current[field]));
    }
  }
});

test('Gravity: dt=0 is an exact identity, even for JS decimals and signed zero', () => {
  const initial = list([body(2, -0.1, 0.2, 0.3, -0.4), body(3, -0, 0.75, -0, 0.25)]);
  for (const verlet of [false, true]) {
    assert.deepEqual(Gravity.step(initial, 0, verlet), initial);
    assert.deepEqual(Gravity.advance(4, initial, -0, verlet), initial);
  }
});

test('Gravity: presets have positive masses, near-zero momentum and bounded Verlet trajectories', () => {
  for (const [index, count] of [[0, 2], [1, 2], [2, 3]]) {
    const initial = Gravity.preset(index);
    const bodies = unpack(initial);
    assert.equal(bodies.length, count);
    assert.ok(bodies.every(current => current.mass > 0));
    for (const field of ['vx', 'vy']) {
      assert.ok(Math.abs(bodies.reduce((p, current) => p + current.mass * current[field], 0)) < 1e-6);
    }
    const e0 = Gravity.energy(initial);
    assert.ok(e0 < 0, 'presets are bound systems');
    // Forty time units cover several inner-planet orbits, not just one step.
    const evolved = Gravity.advance(4000, initial, 0.01, true);
    assert.equal(unpack(evolved).length, count);
    for (const current of unpack(evolved)) {
      for (const field of ['x', 'y', 'vx', 'vy']) assert.ok(Number.isFinite(current[field]));
      assert.ok(Math.hypot(current.x, current.y) < 8, 'no preset body escapes the display scale');
    }
    assert.ok(Math.abs((Gravity.energy(evolved) - e0) / e0) < 0.005, 'energy drift below 0.5%');
    assert.deepEqual(Gravity.preset(index), initial, 'the preset is reusable and deterministic');
  }
  assert.deepEqual(Gravity.preset(0xffffffff), Gravity.preset(0), 'unknown preset indices select the binary');
});

test('Gravity: Verlet keeps binary-orbit energy drift far below explicit Euler', t => {
  const initial = Gravity.preset(0), e0 = Gravity.energy(initial);
  const maximumDrift = [];
  // Equal masses at radius 1 have period about 12.57 with epsilon=.05.
  // dt=.02 over 2000 steps covers >3 orbits with ~628 samples per orbit.
  // Bound max drift, not just the possibly lucky final-phase energy error.
  for (const verlet of [false, true]) {
    let state = initial, maximum = 0;
    for (let i = 0; i < 2000; i++) {
      state = Gravity.step(state, 0.02, verlet);
      maximum = Math.max(maximum, Math.abs((Gravity.energy(state) - e0) / e0));
    }
    assert.deepEqual(Gravity.advance(2000, initial, 0.02, verlet), state);
    for (const field of ['x', 'y', 'vx', 'vy']) {
      const [a, b] = unpack(state);
      assert.ok(Math.abs(a[field] + b[field]) < 1e-6, `pair symmetry: ${field}`);
    }
    maximumDrift.push(maximum);
  }
  const [euler, verlet] = maximumDrift;
  // 0.02% leaves F32 rounding headroom, while still being a useful orbital
  // accuracy bound. Euler must visibly drift; Verlet must be >=100x better.
  assert.ok(verlet < 2e-4, `Verlet maximum relative drift: ${verlet}`);
  assert.ok(euler > 0.05, `Euler positive control should drift >5%: ${euler}`);
  assert.ok(verlet < euler * 0.01, `Verlet=${verlet}, Euler=${euler}`);
  t.diagnostic(`maximum relative energy drift: Euler=${euler}, Verlet=${verlet}`);
});
