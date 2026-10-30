// Linux integration check against a Bend source checkout and its real kernel.
// Run with BEND_SOURCE and BENDTT_KERNEL set; see docs/kernel-stack.md.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

assert.equal(process.platform, 'linux', 'This check uses Linux ulimit -v');
assert.ok(process.env.BEND_SOURCE, 'Set BEND_SOURCE to the Bend source checkout');
assert.ok(process.env.BENDTT_KERNEL, 'Set BENDTT_KERNEL to its compiled BendTT kernel');

const source = path.resolve(process.env.BEND_SOURCE);
const kernel = path.resolve(process.env.BENDTT_KERNEL);
const bun = process.env.BUN || 'bun';
const env = {
  ...process.env,
  BEND_NO_TELEMETRY: '1',
  BENDTT_KERNEL: kernel,
  LEAN_NUM_THREADS: '1',
};
// Do not let caller settings bypass the stack thread or select another Base.
for (const key of ['LEAN_STACK_SIZE_KB', 'LEAN_MAIN_USE_THREAD', 'BEND_LIB']) {
  delete env[key];
}

let dir;
let proof;
let input;
let limited;

function run(bin, args, overrides = {}) {
  const got = spawnSync(bin, args, {
    cwd: source,
    env: { ...env, ...overrides },
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.ifError(got.error);
  return { ...got, out: got.stdout + got.stderr };
}

function verdict(stack) {
  return run(bun, ['bend2/main.ts', proof, '--verdict'], {
    BENDTT: limited,
    ...(stack === undefined ? {} : { LEAN_STACK_SIZE_KB: stack }),
  });
}

function accepts(got) {
  assert.equal(got.signal, null, got.out);
  assert.equal(got.status, 0, got.out);
  assert.equal(got.out.trim(), 'ALL PROOFS CHECK');
}

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'bend-stack-'));
  proof = path.join(dir, 'proof.bend');
  input = path.join(dir, 'proof.bendtt');
  limited = path.join(dir, 'kernel-limited.sh');
  writeFileSync(proof, `import Base

law same:
  {False{} == False{} : Bool}

def same(): {==}
`);
  // Limit only the kernel: Bun itself reserves a large virtual address space.
  // 3 GiB leaves room for Lean startup but cannot fit a 4 GiB thread stack.
  // Inherit the requested stack unchanged, unlike the original workaround.
  writeFileSync(limited, `#!/bin/sh
set -eu
ulimit -c 0
ulimit -v 3145728
exec "$BENDTT_KERNEL" "$@"
`, { mode: 0o700 });
  const emitted = run(bun, ['bend2/main.ts', proof, '-o', input]);
  assert.equal(emitted.status, 0, emitted.out);
  assert.equal(emitted.out.trim(), '');
});

after(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test('the same real kernel/input fails at 4 GiB and succeeds at 64 MiB', () => {
  const large = run(limited, [input], { LEAN_STACK_SIZE_KB: '4194304' });
  assert.equal(large.signal, 'SIGABRT', large.out);
  assert.match(large.out, /failed to create thread: Resource temporarily unavailable/);
  accepts(run(limited, [input], { LEAN_STACK_SIZE_KB: '65536' }));
});

test('--verdict defaults to a stack that fits the kernel address-space limit', () => {
  accepts(verdict());
});

test('an empty stack setting uses the default', () => {
  accepts(verdict(''));
});

test('--verdict honors a non-default caller stack size', () => {
  accepts(verdict('98304'));
  const large = verdict('4194304');
  assert.equal(large.status, 1, large.out);
  assert.match(large.out, /Error: BendTT infrastructure: kernel terminated by SIGABRT/);
  assert.doesNotMatch(large.out, /ALL PROOFS CHECK/);
});

test('the smaller stack still rejects a false equality in the real kernel', () => {
  const text = readFileSync(input, 'utf8');
  const falseText = text.replace('== (.False, ())', '== (.True, ())');
  assert.notEqual(falseText, text, 'The control must actually change the equality');
  const falseInput = path.join(dir, 'false.bendtt');
  writeFileSync(falseInput, falseText);
  const rejected = run(limited, [falseInput], { LEAN_STACK_SIZE_KB: '65536' });
  assert.equal(rejected.signal, null, rejected.out);
  assert.equal(rejected.status, 1, rejected.out);
  assert.match(rejected.out, /^SOME PROOFS FAIL\n/);
  assert.doesNotMatch(rejected.out, /ALL PROOFS CHECK/);
});
