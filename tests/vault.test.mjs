import test from 'node:test';
import assert from 'node:assert/strict';
import Vault from '../dist/bend/vault.mjs';

const wallets = (left, right) => ({ $: 'Wallets', left, right });

test('Vault: a transfer moves tokens between wallets without changing the input', () => {
  const initial = Object.freeze(wallets(80, 20));
  const result = Vault.transfer(initial, 25, true);
  assert.deepEqual(result, { $: 'Accepted', ledger: wallets(55, 45) });
  assert.equal(Vault.total(result.ledger), 100);
  assert.deepEqual(initial, wallets(80, 20));
});

test('Vault: zero, exact balance, empty source and overdrafts in both directions', () => {
  const cases = [
    [80, 20, 0, true, 'Accepted', 80, 20],
    [80, 20, 0, false, 'Accepted', 80, 20],
    [0, 0, 0, true, 'Accepted', 0, 0],
    [0, 0, 0, false, 'Accepted', 0, 0],
    [80, 20, 80, true, 'Accepted', 0, 100],
    [80, 20, 20, false, 'Accepted', 100, 0],
    [80, 20, 15, false, 'Accepted', 95, 5],
    [0, 100, 1, true, 'Rejected', 0, 100],
    [100, 0, 1, false, 'Rejected', 100, 0],
    [80, 20, 81, true, 'Rejected', 80, 20],
    [80, 20, 21, false, 'Rejected', 80, 20],
    [80, 20, 10000, true, 'Rejected', 80, 20],
    [80, 20, 10000, false, 'Rejected', 80, 20],
    [10000, 0, 10000, true, 'Accepted', 0, 10000],
    [0, 10000, 10000, false, 'Accepted', 10000, 0],
  ];
  for (const [left, right, amount, direction, status, afterLeft, afterRight] of cases) {
    const initial = Object.freeze(wallets(left, right));
    const result = Vault.transfer(initial, amount, direction);
    assert.deepEqual(result, { $: status, ledger: wallets(afterLeft, afterRight) },
      `${left},${right}; amount=${amount}; toRight=${direction}`);
    assert.deepEqual(Vault.result_ledger(result), result.ledger);
    assert.deepEqual(initial, wallets(left, right));
  }
});

// Independent oracle: closed-form BigInt accounting, not the Bend worker's
// repeated one-token movement and rollback. Expected balances stay exact.
function transferOracle({ left, right }, amount, toRight) {
  let l = BigInt(left), r = BigInt(right);
  const a = BigInt(amount), accepted = a <= (toRight ? l : r);
  if (accepted) {
    l += toRight ? -a : a;
    r += toRight ? a : -a;
  }
  return { $: accepted ? 'Accepted' : 'Rejected', ledger: wallets(Number(l), Number(r)) };
}

test('Vault: exhaustive small transfers agree with exact accounting and direction symmetry', () => {
  for (let left = 0; left <= 12; left++) for (let right = 0; right <= 12; right++) {
    for (let amount = 0; amount <= 14; amount++) for (const toRight of [false, true]) {
      const initial = Object.freeze(wallets(left, right));
      const result = Vault.transfer(initial, amount, toRight);
      assert.deepEqual(result, transferOracle(initial, amount, toRight));
      assert.equal(Vault.total(result.ledger), Number(BigInt(left) + BigInt(right)));
      const mirrored = Vault.transfer(Object.freeze(wallets(right, left)), amount, !toRight);
      assert.deepEqual(mirrored, {
        $: result.$, ledger: wallets(result.ledger.right, result.ledger.left),
      });
      if (result.$ === 'Accepted') {
        assert.deepEqual(Vault.transfer(result.ledger, amount, !toRight), {
          $: 'Accepted', ledger: initial,
        });
      } else {
        assert.deepEqual(result.ledger, initial);
      }
      assert.deepEqual(initial, wallets(left, right));
    }
  }
});

test('Vault: deterministic random sequences preserve exact totals and every prior snapshot', () => {
  let randomState = 0x7661756c;
  const random = limit => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return Math.floor((randomState / 2 ** 32) * limit);
  };
  let accepted = 0, rejected = 0;
  for (let sequence = 0; sequence < 24; sequence++) {
    let ledger = wallets(random(10001), random(10001));
    const expectedTotal = BigInt(ledger.left) + BigInt(ledger.right), snapshots = [];
    for (let step = 0; step < 300; step++) {
      const input = Object.freeze(ledger), snapshot = { ...input };
      snapshots.push([input, snapshot]);
      const amount = random(10001), toRight = random(2) === 1;
      const result = Vault.transfer(input, amount, toRight);
      assert.deepEqual(result, transferOracle(snapshot, amount, toRight), `sequence ${sequence}, step ${step}`);
      assert.equal(BigInt(Vault.total(result.ledger)), expectedTotal);
      assert.ok(Number.isSafeInteger(result.ledger.left) && result.ledger.left >= 0);
      assert.ok(Number.isSafeInteger(result.ledger.right) && result.ledger.right >= 0);
      if (result.$ === 'Rejected') {
        rejected++;
        assert.deepEqual(result.ledger, snapshot);
      } else {
        accepted++;
      }
      ledger = result.ledger;
    }
    for (const [input, snapshot] of snapshots) assert.deepEqual(input, snapshot);
  }
  assert.ok(accepted > 1000 && rejected > 1000, 'exercise successful and rejected requests');
});

test('Vault: exact values cross U32 boundaries and reach the documented runtime Nat limit', () => {
  const cases = [
    [4294967295, 1, 1, false, 4294967296, 0, 4294967296],
    [1, 4294967295, 1, true, 0, 4294967296, 4294967296],
    [4294967296, 4294967296, 7, true, 4294967289, 4294967303, 8589934592],
    [1, 281474976710654, 1, true, 0, 281474976710655, 281474976710655],
    [281474976710654, 1, 1, false, 281474976710655, 0, 281474976710655],
    [281474976710655, 0, 10000, true, 281474976700655, 10000, 281474976710655],
  ];
  for (const [left, right, amount, direction, afterLeft, afterRight, expectedTotal] of cases) {
    const initial = Object.freeze(wallets(left, right));
    assert.ok([left, right, amount, expectedTotal].every(Number.isSafeInteger));
    assert.ok(expectedTotal <= 2 ** 48 - 1);
    const result = Vault.transfer(initial, amount, direction);
    assert.deepEqual(result, { $: 'Accepted', ledger: wallets(afterLeft, afterRight) });
    assert.equal(Vault.total(result.ledger), expectedTotal);
    assert.deepEqual(initial, wallets(left, right));
  }
  // Runtime overflow fails rather than wrapping. These are out-of-contract
  // inputs: even JS-safe integers can exceed Bend's stricter immediate bound.
  assert.throws(() => Vault.total(wallets(281474976710655, 1)), /Nat past/);
  assert.throws(() => Vault.transfer(wallets(1, 281474976710655), 1, true), /Nat past/);
  assert.throws(() => Vault.total(wallets(Number.MAX_SAFE_INTEGER, 0)), /Nat past/);
});

test('Vault: the generated amount boundary rejects non-Nat JavaScript values', () => {
  // The compiler checks direct Nat arguments, but not nested ledger fields or
  // Bool arguments. The UI must still validate the full documented contract;
  // this test does not promise validation of every malformed record.
  const initial = Object.freeze(wallets(80, 20));
  for (const amount of [-1, 0.5, NaN, Infinity, -Infinity, '1', 1n, null, undefined, 2 ** 54]) {
    assert.throws(() => Vault.transfer(initial, amount, true), /expected a Nat host number/);
    assert.deepEqual(initial, wallets(80, 20));
  }
});
