import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import Interpreter from '../dist/bend/interpreter.mjs';

const number = value => ({ $: 'Number', value });
const boolean = value => ({ $: 'Boolean', value });
const add = (left, right) => ({ $: 'Add', left, right });
const multiply = (left, right) => ({ $: 'Multiply', left, right });
const less = (left, right) => ({ $: 'Less', left, right });
const choose = (condition, yes, no) => ({ $: 'If', condition, yes, no });
const numberResult = value => ({ $: 'NumberResult', value });
const booleanResult = value => ({ $: 'BooleanResult', value });
const typeError = message => ({ $: 'TypeError', message });

test('Interpreter: the checked public boundary evaluates Nat and Bool literals', () => {
  assert.deepEqual(Interpreter.run(number(0)), numberResult(0));
  assert.deepEqual(Interpreter.run(number(42)), numberResult(42));
  assert.deepEqual(Interpreter.run(boolean(true)), booleanResult(true));
  assert.deepEqual(Interpreter.run(boolean(false)), booleanResult(false));
});

test('Interpreter: nested numeric operators elaborate and evaluate with their indexed result types', () => {
  assert.deepEqual(Interpreter.run(add(number(2), multiply(number(3), number(4)))), numberResult(14));
  assert.deepEqual(Interpreter.run(multiply(add(number(2), number(3)), number(4))), numberResult(20));
  assert.deepEqual(Interpreter.run(multiply(number(0), number(7))), numberResult(0));
  assert.deepEqual(Interpreter.run(less(number(2), number(3))), booleanResult(true));
  assert.deepEqual(Interpreter.run(less(number(3), number(3))), booleanResult(false));
  assert.deepEqual(Interpreter.run(less(add(number(2), number(3)), number(4))), booleanResult(false));
});

test('Interpreter: conditionals compose numeric and Boolean expressions without mixing branch types', () => {
  const condition = less(add(number(1), number(2)), multiply(number(2), number(2)));
  assert.deepEqual(Interpreter.run(choose(condition, number(7), number(9))), numberResult(7));
  assert.deepEqual(Interpreter.run(choose(boolean(false), number(7), number(9))), numberResult(9));
  assert.deepEqual(Interpreter.run(choose(condition, less(number(4), number(5)), boolean(false))), booleanResult(true));
  assert.deepEqual(Interpreter.run(choose(boolean(false), boolean(true), boolean(false))), booleanResult(false));
  assert.deepEqual(Interpreter.run(add(choose(condition, number(7), number(9)), number(3))), numberResult(10));
  assert.deepEqual(Interpreter.run(choose(choose(condition, boolean(false), boolean(true)), number(7), number(9))), numberResult(9));
});

test('Interpreter: the raw boundary rejects wrong numeric operands in either position', () => {
  for (const [operator, name] of [[add, 'Add'], [multiply, 'Multiply'], [less, 'Less']]) {
    for (const value of [true, false]) {
      for (const expression of [operator(boolean(value), number(2)), operator(number(2), boolean(value)), operator(boolean(value), boolean(value))]) {
        assert.deepEqual(Interpreter.run(expression), typeError(`${name} expects two Nat operands`));
      }
    }
  }
});

test('Interpreter: both branches must type-check even when the invalid branch is not selected', () => {
  for (const condition of [boolean(true), boolean(false), less(number(1), number(2))]) {
    assert.deepEqual(Interpreter.run(choose(condition, number(7), boolean(false))), typeError('If branches must have the same type'));
    assert.deepEqual(Interpreter.run(choose(condition, boolean(true), number(7))), typeError('If branches must have the same type'));
    const invalid = add(boolean(true), number(1));
    assert.deepEqual(Interpreter.run(choose(condition, number(7), invalid)), typeError('Add expects two Nat operands'));
    assert.deepEqual(Interpreter.run(choose(condition, invalid, number(7))), typeError('Add expects two Nat operands'));
  }
  assert.deepEqual(Interpreter.run(choose(number(1), number(7), number(9))), typeError('If condition must be Bool'));
});

test('Interpreter: errors propagate through nested conditions and operators before evaluation', () => {
  const invalid = less(boolean(false), number(3));
  const expected = typeError('Less expects two Nat operands');
  for (const expression of [
    add(invalid, number(0)), add(number(0), invalid),
    multiply(invalid, number(0)), multiply(number(0), invalid),
    less(invalid, number(0)), less(number(0), invalid),
    choose(invalid, number(1), number(2)),
    choose(boolean(true), number(1), choose(boolean(false), invalid, boolean(false))),
    choose(boolean(false), choose(boolean(true), boolean(true), invalid), boolean(false)),
  ]) assert.deepEqual(Interpreter.run(expression), expected);
});

test('Interpreter: all conditional type combinations obey Bool condition and equal branch types', () => {
  // Each fixture has an independently worked result; some are compound trees.
  const fixtures = [
    [number(0), numberResult(0)],
    [add(number(3), number(4)), numberResult(7)],
    [boolean(false), booleanResult(false)],
    [less(number(2), number(3)), booleanResult(true)],
  ];
  for (const [condition, c] of fixtures) {
    for (const [yes, y] of fixtures) {
      for (const [no, n] of fixtures) {
        const expected = c.$ !== 'BooleanResult' ? typeError('If condition must be Bool')
          : y.$ !== n.$ ? typeError('If branches must have the same type')
          : c.value ? y : n;
        assert.deepEqual(Interpreter.run(choose(condition, yes, no)), expected);
      }
    }
  }
});

test('Interpreter: frozen shared raw subtrees survive successful and rejected repeated runs', () => {
  const literal = Object.freeze(number(7));
  const shared = Object.freeze(add(literal, literal));
  const condition = Object.freeze(less(literal, shared));
  const valid = Object.freeze(choose(condition, shared, Object.freeze(multiply(shared, shared))));
  const invalid = Object.freeze(choose(condition, shared, Object.freeze(boolean(false))));
  const snapshot = structuredClone({ valid, invalid });
  for (let index = 0; index < 3; index++) {
    assert.deepEqual(Interpreter.run(valid), numberResult(14));
    assert.deepEqual(Interpreter.run(invalid), typeError('If branches must have the same type'));
    assert.deepEqual({ valid, invalid }, snapshot);
    assert.strictEqual(valid.yes, shared);
    assert.strictEqual(shared.left, shared.right);
  }
});

test('Interpreter: Nat arithmetic exceeds U32 but respects Bend 2.0.39 runtime bounds', () => {
  assert.deepEqual(Interpreter.run(add(number(4294967295), number(1))), numberResult(4294967296));
  assert.deepEqual(Interpreter.run(multiply(number(65536), number(65536))), numberResult(4294967296));
  assert.deepEqual(Interpreter.run(add(number(281474976710654), number(1))), numberResult(281474976710655));
  assert.deepEqual(Interpreter.run(less(number(281474976710654), number(281474976710655))), booleanResult(true));
  // This is an upstream runtime bound, stricter than Number.MAX_SAFE_INTEGER.
  // The UI owns input/intermediate-value bounds; overflow is not a TypeError.
  assert.throws(() => Interpreter.run(add(number(281474976710655), number(1))), /Nat past the largest immediate/);
});

test('Interpreter: elaboration checks without evaluating, and typed If evaluates only its selected branch', () => {
  // A well-typed expression whose evaluation hits the documented runtime bound.
  // It distinguishes checking an Expr from prematurely computing a raw value.
  const overflow = multiply(number(16777216), number(16777216));
  assert.throws(() => Interpreter.run(overflow), /Nat past the largest immediate/);
  assert.deepEqual(Interpreter.run(add(overflow, boolean(true))), typeError('Add expects two Nat operands'));
  assert.deepEqual(Interpreter.run(choose(boolean(true), overflow, boolean(false))), typeError('If branches must have the same type'));
  assert.deepEqual(Interpreter.run(choose(boolean(true), number(7), overflow)), numberResult(7));
  assert.deepEqual(Interpreter.run(choose(boolean(false), overflow, number(9))), numberResult(9));
});

test('Interpreter: Bend rejects ill-typed indexed constructors, with a valid control using the same imports', () => {
  const installed = join(homedir(), '.bend/bin/bend');
  const bend = process.env.BEND || (existsSync(installed) ? installed : 'bend');
  const directory = mkdtempSync(join(tmpdir(), 'bend-interpreter-'));
  const module = relative(directory, fileURLToPath(new URL('../experiments/interpreter.bend', import.meta.url)));
  const num = 'I.NumberExpr{1n, {==}}';
  const bit = 'I.BooleanExpr{True{}, {==}}';
  function check(name, expression, type = 'I.TNumber{}') {
    const file = join(directory, `${name}.bend`);
    writeFileSync(file, `import Base\nimport ${module} as I\n\ndef example() -> I.Expr<${type}>:\n  ${expression}\n`);
    const result = spawnSync(bend, [file], { encoding: 'utf8', env: { ...process.env, BEND_NO_TELEMETRY: '1' }, timeout: 60000 });
    assert.ifError(result.error);
    assert.equal(result.signal, null, 'the compiler must finish rather than crash or time out');
    return { status: result.status, output: result.stdout + result.stderr };
  }
  try {
    const valid = check('valid', `I.IfExpr{I.LessExpr{${num}, I.AddExpr{${num}, ${num}, {==}}, {==}}, I.MultiplyExpr{${num}, ${num}, {==}}, ${num}}`);
    assert.equal(valid.status, 0, valid.output);
    assert.match(valid.output, /ALL PROOFS CHECK/);
    for (const [name, expression, type] of [
      ['add-boolean-left', `I.AddExpr{${bit}, ${num}, {==}}`],
      ['add-boolean-right', `I.AddExpr{${num}, ${bit}, {==}}`],
      ['add-wrong-result-index', `I.AddExpr{${num}, ${num}, {==}}`, 'I.TBoolean{}'],
      ['if-numeric-condition', `I.IfExpr{${num}, ${num}, ${num}}`],
      ['if-mixed-branches', `I.IfExpr{${bit}, ${num}, ${bit}}`],
    ]) {
      const rejected = check(name, expression, type);
      assert.notEqual(rejected.status, 0, `${name} must not construct an Expr at the wrong index`);
      assert.match(rejected.output, /SOME PROOFS FAIL/);
      assert.match(rejected.output, /TNumber/);
      assert.match(rejected.output, /TBoolean/);
      assert.doesNotMatch(rejected.output, /unknown|not found|parse error/i, 'rejection must be a type error, not a broken fixture');
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
