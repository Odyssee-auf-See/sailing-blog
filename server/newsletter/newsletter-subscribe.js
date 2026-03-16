#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SUBSCRIBERS_PATH = path.join(ROOT_DIR, 'data', 'subscribers.json');
const BLOG_META_PATH = path.join(ROOT_DIR, 'data', 'blog_metadata.json');

function readArgValue(flag) {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return '';
  return String(args[index + 1]).trim();
}

function ensureSubscribersFile() {
  if (!fs.existsSync(SUBSCRIBERS_PATH)) {
    fs.writeFileSync(SUBSCRIBERS_PATH, JSON.stringify({ subscribers: [] }, null, 2) + '\n', 'utf8');
  }
}

function loadSubscribers() {
  ensureSubscribersFile();
  const raw = fs.readFileSync(SUBSCRIBERS_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.subscribers)) parsed.subscribers = [];
  return parsed;
}

function saveSubscribers(payload) {
  fs.writeFileSync(SUBSCRIBERS_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function getSiteBaseUrl() {
  if (process.env.SITE_BASE_URL) return process.env.SITE_BASE_URL.replace(/\/$/, '');

  try {
    const raw = fs.readFileSync(BLOG_META_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const baseUrl = parsed?.site?.baseUrl;
    if (baseUrl) return String(baseUrl).replace(/\/$/, '');
  } catch (_) {
    // noop
  }

  return 'https://odyssee-sailing.ch';
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function main() {
  const emailInput = readArgValue('--email').toLowerCase();
  const language = readArgValue('--language') || 'de';

  if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
    console.error('Usage: node server/newsletter/newsletter-subscribe.js --email user@example.com [--language de]');
    process.exit(1);
  }

  const payload = loadSubscribers();
  const nowIso = new Date().toISOString();

  const existing = payload.subscribers.find((subscriber) => String(subscriber.email || '').toLowerCase() === emailInput);

  const verifyToken = crypto.randomBytes(32).toString('hex');
  const unsubscribeToken = existing?.unsubscribeToken || crypto.randomBytes(32).toString('hex');

  const record = {
    email: emailInput,
    status: 'pending',
    language,
    subscribedAt: existing?.subscribedAt || nowIso,
    pendingAt: nowIso,
    verifiedAt: existing?.verifiedAt || null,
    unsubscribeToken,
    verifyTokenHash: hashToken(verifyToken),
    source: readArgValue('--source') || 'manual',
  };

  if (existing) {
    Object.assign(existing, record);
  } else {
    payload.subscribers.push(record);
  }

  saveSubscribers(payload);

  const baseUrl = getSiteBaseUrl();
  const verifyUrl = `${baseUrl}/api/newsletter/verify?token=${encodeURIComponent(verifyToken)}&email=${encodeURIComponent(emailInput)}`;

  console.log(JSON.stringify({
    ok: true,
    email: emailInput,
    status: 'pending',
    verifyUrl,
    message: 'Subscriber saved as pending. Send the verifyUrl via your transactional mail flow.',
  }, null, 2));
}

main();
