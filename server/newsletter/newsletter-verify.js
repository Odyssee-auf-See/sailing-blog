#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SUBSCRIBERS_PATH = path.join(ROOT_DIR, 'data', 'subscribers.json');

function readArgValue(flag) {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return '';
  return String(args[index + 1]).trim();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function main() {
  const token = readArgValue('--token');
  const email = readArgValue('--email').toLowerCase();

  if (!token || !email) {
    console.error('Usage: node server/newsletter/newsletter-verify.js --token <token> --email user@example.com');
    process.exit(1);
  }

  if (!fs.existsSync(SUBSCRIBERS_PATH)) {
    console.error('No subscribers file found.');
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(SUBSCRIBERS_PATH, 'utf8'));
  const subscribers = Array.isArray(payload.subscribers) ? payload.subscribers : [];

  const subscriber = subscribers.find((entry) => String(entry.email || '').toLowerCase() === email);
  if (!subscriber) {
    console.error('Subscriber not found.');
    process.exit(1);
  }

  if (subscriber.status === 'verified') {
    console.log(JSON.stringify({ ok: true, email, status: 'verified', message: 'Already verified' }, null, 2));
    return;
  }

  const expectedHash = subscriber.verifyTokenHash;
  if (!expectedHash || expectedHash !== hashToken(token)) {
    console.error('Invalid or expired verification token.');
    process.exit(1);
  }

  subscriber.status = 'verified';
  subscriber.verifiedAt = new Date().toISOString();
  delete subscriber.verifyTokenHash;

  fs.writeFileSync(SUBSCRIBERS_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({ ok: true, email, status: 'verified' }, null, 2));
}

main();
