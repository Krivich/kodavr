/**
 * CONTRACT: scripts/lib/ignition.mjs
 * ROLE: spawns the vendored Ignition engine as a child process
 * EXPORTS:
 *   runIgnition — runs the engine CLI over input/ into output/
 * CONSUMES:
 *   node:child_process — spawn the engine
 *   node:path — resolve the engine CLI path
 *   node:url — find the repo root
 * INVARIANTS:
 *   — a non-zero engine exit is a loud build failure, never silent
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CLI_PATH = join(REPO_ROOT, 'node_modules', 'ignition-ssg', 'engine', 'bin', 'cli.js');

export function runIgnition({ cwd, source = 'input', output = 'output', domain = 'https://example.com' }) {
  return new Promise((resolve, reject) => {
    const args = [CLI_PATH, 'build', '--source', source, '--output', output, '--domain', domain];
    const child = spawn(process.execPath, args, { cwd });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Ignition build failed (exit ${code})\n${stderr}${stdout}`));
    });
  });
}
