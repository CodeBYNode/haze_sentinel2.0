import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const children = [];
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 250).unref();
}

function start(args, label) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env });
  children.push(child);
  child.once('error', () => {
    process.stderr.write(`Could not start ${label}.\n`);
    stop(1);
  });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      process.stderr.write(`${label} stopped${signal ? ` (${signal})` : ` (exit ${code ?? 1})`}.\n`);
      stop(code || 1);
    }
  });
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
start(['--env-file=.env', 'server/index.mjs'], 'HazeAI API');
start(['node_modules/vite/bin/vite.js'], 'Vite');
