#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const META_PATH = path.join(ROOT_DIR, 'data', 'blog_metadata.json');
const SUBSCRIBERS_PATH = path.join(ROOT_DIR, 'data', 'subscribers.json');
const LOG_PATH = path.join(ROOT_DIR, 'data', 'newsletter_notifications_log.json');

function readArgValue(flag) {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return '';
  return String(args[index + 1]).trim();
}

function hasArg(flag) {
  return process.argv.slice(2).includes(flag);
}

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function saveJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function normalizePosts(meta) {
  const posts = Array.isArray(meta?.posts) ? meta.posts : [];
  return [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function resolvePostToSend(posts, sentPostIds, forcedSlug) {
  if (forcedSlug) {
    return posts.find((post) => post.slug === forcedSlug || post.id === forcedSlug) || null;
  }

  return posts.find((post) => !sentPostIds.includes(post.id || post.slug)) || null;
}

function getVerifiedSubscribers(payload) {
  const subscribers = Array.isArray(payload?.subscribers) ? payload.subscribers : [];
  return subscribers.filter((subscriber) => subscriber.status === 'verified' && !subscriber.unsubscribedAt && subscriber.email);
}

async function loadVerifiedSubscribersFromApi() {
  const endpoint = process.env.NEWSLETTER_SUBSCRIBERS_ENDPOINT;
  if (!endpoint) return null;

  const apiToken = process.env.NEWSLETTER_API_TOKEN || '';
  const headers = apiToken ? { Authorization: `Bearer ${apiToken}` } : {};
  const response = await fetch(endpoint, { headers });

  if (!response.ok) {
    throw new Error(`Subscriber API request failed: ${response.status}`);
  }

  const payload = await response.json();
  const subscribers = Array.isArray(payload?.subscribers) ? payload.subscribers : [];
  return subscribers
    .filter((item) => typeof item === 'string' && item.trim())
    .map((email) => ({ email: email.trim(), status: 'verified' }));
}

function buildTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS are required.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function buildPostUrl(post, siteBaseUrl) {
  const baseUrl = String(siteBaseUrl || 'https://odyssee-sailing.ch').replace(/\/$/, '');
  const canonical = post.canonical || post.url || '';

  if (!canonical) return baseUrl;
  if (/^(https?:)?\/\//i.test(canonical)) return canonical;

  const normalizedPath = canonical.startsWith('/') ? canonical : `/${canonical}`;
  return `${baseUrl}${normalizedPath}`;
}

function createMessageContent(post, customText, siteBaseUrl) {
  const postUrl = buildPostUrl(post, siteBaseUrl);
  const subject = `Neuer Blogbeitrag: ${post.title}`;
  const excerpt = post.excerpt || '';
  const introText = customText
    ? `${customText}\n\n`
    : 'Wir haben einen neuen Logbucheintrag fuer dich veroeffentlicht.\n\n';

  const text = `${introText}${post.title}\n${excerpt}\n\nZum Beitrag: ${postUrl}\n\nDu moechtest keine Nachrichten mehr erhalten? Antworte auf diese E-Mail mit "abmelden".`;

  const html = `
    <div style="font-family: Roboto, Arial, sans-serif; line-height: 1.6; color: #1a1a2e;">
      <p>${(customText || 'Wir haben einen neuen Logbucheintrag fuer dich veroeffentlicht.').replace(/</g, '&lt;')}</p>
      <h2 style="margin-bottom: 0.35rem;">${post.title}</h2>
      <p style="margin-top: 0; color: #4b5563;">${excerpt}</p>
      <p><a href="${postUrl}" style="display: inline-block; padding: 10px 14px; background: #1e3a5f; color: #fff; text-decoration: none; border-radius: 6px;">Beitrag lesen</a></p>
      <p style="font-size: 0.85rem; color: #6b7280;">Falls du keine Nachrichten mehr erhalten moechtest, antworte auf diese E-Mail mit "abmelden".</p>
    </div>
  `;

  return { subject, text, html };
}

async function main() {
  const forcedSlug = readArgValue('--post-slug') || process.env.NEWSLETTER_POST_SLUG || '';
  const customText = readArgValue('--custom-text') || process.env.NEWSLETTER_CUSTOM_TEXT || '';
  const dryRun = hasArg('--dry-run') || String(process.env.NEWSLETTER_DRY_RUN || '').toLowerCase() === 'true';

  const meta = loadJson(META_PATH, { site: {}, posts: [] });
  const posts = normalizePosts(meta);
  const siteBaseUrl = meta?.site?.baseUrl || process.env.SITE_BASE_URL || 'https://odyssee-sailing.ch';

  if (posts.length === 0) {
    console.log('[newsletter] No posts found in metadata, nothing to send.');
    return;
  }

  const apiSubscribers = await loadVerifiedSubscribersFromApi();
  const subscriberPayload = apiSubscribers ? { subscribers: apiSubscribers } : loadJson(SUBSCRIBERS_PATH, { subscribers: [] });
  const verifiedSubscribers = getVerifiedSubscribers(subscriberPayload);
  if (verifiedSubscribers.length === 0) {
    console.log('[newsletter] No verified subscribers, nothing to send.');
    return;
  }

  const logPayload = loadJson(LOG_PATH, { sentPostIds: [], runs: [] });
  if (!Array.isArray(logPayload.sentPostIds)) logPayload.sentPostIds = [];
  if (!Array.isArray(logPayload.runs)) logPayload.runs = [];

  const post = resolvePostToSend(posts, logPayload.sentPostIds, forcedSlug);
  if (!post) {
    console.log('[newsletter] No unsent post found, skipping.');
    return;
  }

  const postKey = post.id || post.slug;
  if (!forcedSlug && logPayload.sentPostIds.includes(postKey)) {
    console.log(`[newsletter] Post ${postKey} already sent, skipping.`);
    return;
  }

  const { subject, text, html } = createMessageContent(post, customText, siteBaseUrl);
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  let sentCount = 0;
  let failedCount = 0;

  if (!dryRun) {
    const transporter = buildTransport();

    for (const subscriber of verifiedSubscribers) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: subscriber.email,
          subject,
          text,
          html,
        });
        sentCount += 1;
      } catch (error) {
        failedCount += 1;
        console.error(`[newsletter] Failed for ${subscriber.email}: ${error.message}`);
      }
    }
  } else {
    sentCount = verifiedSubscribers.length;
  }

  logPayload.runs.push({
    postId: postKey,
    slug: post.slug,
    title: post.title,
    sentAt: new Date().toISOString(),
    recipients: verifiedSubscribers.length,
    sentCount,
    failedCount,
    dryRun,
    customText: customText || null,
  });

  if (!dryRun && failedCount === 0 && !logPayload.sentPostIds.includes(postKey)) {
    logPayload.sentPostIds.push(postKey);
  }

  saveJson(LOG_PATH, logPayload);

  console.log(`[newsletter] Processed post ${postKey}. recipients=${verifiedSubscribers.length}, sent=${sentCount}, failed=${failedCount}, dryRun=${dryRun}`);
}

main().catch((error) => {
  console.error(`[newsletter] Fatal error: ${error.message}`);
  process.exit(1);
});
