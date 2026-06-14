/* global __dirname */

const { spawn } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const mode = process.argv[2];
if (!mode || !['development', 'production'].includes(mode)) {
  console.error('Usage: node scripts/start-expo-env.js <development|production>');
  process.exit(1);
}

const envPath = resolve(__dirname, `../.env.${mode}`);
if (!existsSync(envPath)) {
  console.error(`Environment file not found: ${envPath}`);
  process.exit(1);
}

for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmedLine = line.trim();
  if (!trimmedLine || trimmedLine.startsWith('#')) {
    continue;
  }

  const separatorIndex = trimmedLine.indexOf('=');
  if (separatorIndex < 0) {
    continue;
  }

  const key = trimmedLine.slice(0, separatorIndex).trim();
  const value = trimmedLine
    .slice(separatorIndex + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
  if (key) {
    process.env[key] = value;
  }
}

const child = spawn('expo', ['start'], {
  env: process.env,
  shell: true,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
