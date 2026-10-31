import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Pages build installs both locked dependency graphs before running NYRA regression', () => {
  const pages = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  const required = readFileSync(new URL('../.github/workflows/required-ci.yml', import.meta.url), 'utf8');
  const runtimeInstall = 'npm ci --ignore-scripts --prefix ops/acceptance-bootstrap/runtime';
  assert(required.includes(runtimeInstall), 'Required CI must retain the private role dependency install');

  const buildJob = pages.split('\n  deploy:\n')[0];
  const runSteps = [...buildJob.matchAll(/^\s+- run: (.+)$/gm)].map(match => match[1]);
  const root = runSteps.indexOf('npm ci');
  const runtime = runSteps.indexOf(runtimeInstall);
  const regression = runSteps.indexOf('npm test');
  const build = runSteps.indexOf('npm run build');

  assert(root >= 0, 'Root npm ci must be present');
  assert(runtime > root, 'Private locked dependencies must install after root dependencies');
  assert(regression > runtime, 'All test dependencies must exist before npm test');
  assert(build > regression, 'Normal build remains after regression');
});
