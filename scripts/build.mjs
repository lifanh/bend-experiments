import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, cpSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const installed = `${homedir()}/.bend/bin/bend`;
const bend = process.env.BEND || (existsSync(installed) ? installed : 'bend');
const patchedSource = `${homedir()}/.local/share/bend-experiments/source-path`;
const verdict = process.env.BEND_VERDICT || (existsSync(patchedSource) ? fileURLToPath(new URL('./bend-verdict.sh', import.meta.url)) : bend);
const env = { ...process.env, BEND_NO_TELEMETRY: '1' };
function run(args, executable = bend) {
  const result = spawnSync(executable, args, { stdio: 'inherit', env });
  if (result.error) {
    console.error(`Cannot run Bend: ${result.error.message}. See README.md for installation.`);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}
const version = spawnSync(bend, ['version'], { encoding: 'utf8', env });
if (version.status !== 0 || !/\b2\.0\.39\b/.test(version.stdout)) {
  console.error('This experiment targets Bend 2.0.39. Install it or set BEND to its executable.');
  process.exit(1);
}
const kernelCheck = process.argv.includes('--verdict');
run(['PROOF.bend', ...(kernelCheck ? ['--verdict'] : [])], kernelCheck ? verdict : bend);
if (process.argv.includes('--proof') || process.argv.includes('--verdict')) process.exit(0);
const experiments = ['automaton', 'fractal', 'lights', 'gravity', 'raytracer', 'sorting'];
if (process.argv.includes('--native')) {
  mkdirSync('build', { recursive: true });
  for (const name of experiments) {
    run([`experiments/${name}-cli.bend`, '-o', `build/${name}`]);
    run([`experiments/${name}-cli.bend`, '-o', `build/${name}.js`]);
    // Bend emits CommonJS IO; .mjs intentionally excludes IO entry points.
    renameSync(`build/${name}.js`, `build/${name}.cjs`);
  }
  console.log(`Built ${experiments.length} native CPU experiments and JS references in build/.`);
} else {
  mkdirSync('dist/bend', { recursive: true });
  cpSync('web', 'dist', { recursive: true });
  for (const name of experiments) run([`experiments/${name}.bend`, '-o', `dist/bend/${name}.mjs`]);
  console.log(`Built ${experiments.length} Bend modules and the playground in dist/.`);
}
