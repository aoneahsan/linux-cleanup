#!/usr/bin/env node
/*
 * linux-cleanup — Node.js launcher for npx + global install.
 *
 *   npx linux-cleanup            (zero-install, ephemeral)
 *   npm i -g linux-cleanup       (persistent install, then 'linux-cleanup')
 *
 * The Node launcher is a thin shim. It:
 *   1. Verifies platform is Linux.
 *   2. Resolves the package's cleanup.sh inside the npm package directory.
 *   3. Routes logs and reports to PERSISTENT storage in ~/.linux-cleanup/
 *      so npx temp eviction never destroys your run history.
 *   4. Forwards stdin/stdout/stderr to keep the interactive UX intact.
 *   5. Forwards every CLI argument unchanged.
 *
 * Author:  Ahsan Mahmood <aoneahsan@gmail.com>
 * Web:     https://aoneahsan.com
 * License: Source-Available, No-Derivatives, Non-Commercial v1.0 (see LICENSE)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// ── Platform guard ──────────────────────────────────────────────────────────
if (process.platform !== 'linux') {
  process.stderr.write(
    `\nlinux-cleanup is Linux-only.\n` +
    `Detected platform: ${process.platform}\n\n` +
    `If you are on macOS or WSL and still want to run it, use the underlying ` +
    `bash entrypoint directly:  bash <package-dir>/cleanup.sh --help\n\n`
  );
  process.exit(2);
}

// ── Resolve package dir (works for npx, global, local clone) ───────────────
const PKG_DIR = path.resolve(__dirname, '..');
const SCRIPT  = path.join(PKG_DIR, 'cleanup.sh');

if (!fs.existsSync(SCRIPT)) {
  process.stderr.write(`Cannot find cleanup.sh at: ${SCRIPT}\n`);
  process.exit(2);
}

// ── Persistent data dir (survives npx temp eviction) ───────────────────────
//   Override with: LINUX_CLEANUP_HOME=/some/path
const DATA_HOME = process.env.LINUX_CLEANUP_HOME
  || path.join(os.homedir(), '.linux-cleanup');

const LOG_DIR     = path.join(DATA_HOME, 'logs');
const REPORTS_DIR = path.join(DATA_HOME, 'reports');

try {
  fs.mkdirSync(LOG_DIR,     { recursive: true });
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
} catch (err) {
  process.stderr.write(`Cannot create data dir at ${DATA_HOME}: ${err.message}\n`);
  process.exit(2);
}

// ── npx detection (purely informational; cleanup.sh shows a hint banner) ──
const isNpx =
  PKG_DIR.includes(path.sep + '_npx' + path.sep) ||
  PKG_DIR.includes(path.sep + '.npm' + path.sep + '_npx' + path.sep) ||
  /npx/i.test(process.env.npm_config_user_agent || '');

// ── Spawn the bash script ─────────────────────────────────────────────────
const args = process.argv.slice(2);

const env = Object.assign({}, process.env, {
  LINUX_CLEANUP_LOG_DIR:     LOG_DIR,
  LINUX_CLEANUP_REPORTS_DIR: REPORTS_DIR,
  LINUX_CLEANUP_DATA_HOME:   DATA_HOME,
  LINUX_CLEANUP_NPX:         isNpx ? '1' : '0',
  LINUX_CLEANUP_LAUNCHER:    'node',
});

const child = spawn('bash', [SCRIPT, ...args], {
  stdio: 'inherit',
  env,
});

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    process.stderr.write(
      `\n'bash' not found on PATH. linux-cleanup requires bash >= 4.0.\n` +
      `Install with:  sudo apt install bash    (or your distro's package manager)\n\n`
    );
  } else {
    process.stderr.write(`Failed to launch cleanup.sh: ${err.message}\n`);
  }
  process.exit(2);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(128 + (os.constants.signals[signal] || 0));
  }
  process.exit(code === null ? 0 : code);
});

// Forward Ctrl-C cleanly
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
});
