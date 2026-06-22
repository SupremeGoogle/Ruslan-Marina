const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Load environment variables from .env.local in the project root
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        process.env[key] = value;
      }
    }
  });
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node run-env.js <command> [args...]');
  process.exit(1);
}

const cmd = args[0];
const cmdArgs = args.slice(1);

const child = spawn(cmd, cmdArgs, {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

child.on('close', (code) => {
  process.exit(code);
});
