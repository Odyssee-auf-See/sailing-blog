#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const META_PATH = path.join(ROOT_DIR, 'data', 'blog_metadata.json');
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
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
    return posts.find((p) => p.slug === forcedSlug || p.id === forcedSlug) || null;
  }
  return posts.find((p) => !sentPostIds.includes(p.id || p.slug)) || null;
}

async function loadVerifiedSubscribers() {
  const endpoint = process.env.NEWSLETTER_SUBSCRIBERS_ENDPOINT;
  if (!endpoint) throw new Error('NEWSLETTER_SUBSCRIBERS_ENDPOINT is not set');

  const token = process.env.NEWSLETTER_API_TOKEN || '';
  const res = await fetch(endpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) throw new Error(`Subscriber API failed: ${res.status}`);

  const payload = await res.json();
  const subscribers = Array.isArray(payload?.subscribers) ? payload.subscribers : [];
  return subscribers.filter((e) => typeof e === 'string' && e.trim());
}

function buildPostUrl(post, siteBaseUrl) {
  const base = String(siteBaseUrl || 'https://odyssee-sailing.ch').replace(/\/$/, '');
  const canonical = post.canonical || post.url || '';
  if (!canonical) return base;
  if (/^https?:\/\//i.test(canonical)) return canonical;
  return `${base}${canonical.startsWith('/') ? canonical : '/' + canonical}`;
}

function buildEmail(post, customText, siteBaseUrl) {
  const postUrl = buildPostUrl(post, siteBaseUrl);
  const intro = customText || 'Wir haben einen neuen Logbucheintrag fuer dich veroeffentlicht.';
  const excerpt = post.excerpt || '';

  return {
    subject: `Neuer Blogbeitrag: ${post.title}`,
    text: `${intro}\n\n${post.title}\n${excerpt}\n\nZum Beitrag: ${postUrl}\n\nDu moechtest keine Nachrichten mehr erhalten? Antworte auf diese E-Mail mit "abmelden".`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px;">
        <p>${intro.replace(/</g, '&lt;')}</p>
        <h2>${post.title}</h2>
        <p style="color: #4b5563;">${excerpt}</p>
        <p>
          <a href="${postUrl}" style="display:inline-block; padding:10px 14px; background:#1e3a5f; color:#fff; text-decoration:none; border-radius:6px;">
            Beitrag lesen
          </a>
        </p>
        <p style="font-size:0.85rem; color:#6b7280;">
          Falls du keine Nachrichten mehr erhalten moechtest, antworte auf diese E-Mail mit "abmelden".
        </p>
      </div>
    `,
  };
}

async function sendViaResend(to, from, subject, text, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

async function main() {
  const forcedSlug = readArgValue('--post-slug') || process.env.NEWSLETTER_POST_SLUG || '';
  const customText = readArgValue('--custom-text') || process.env.NEWSLETTER_CUSTOM_TEXT || '';
  const dryRun = hasArg('--dry-run') || String(process.env.NEWSLETTER_DRY_RUN || '').toLowerCase() === 'true';

  const from = process.env.RESEND_FROM || 'Lea & Vito <info@odyssee-sailing.ch>';
  const siteBaseUrl = process.env.SITE_BASE_URL || 'https://odyssee-sailing.ch';

  const meta = loadJson(META_PATH, { posts: [] });
  const posts = normalizePosts(meta);

  if (posts.length === 0) {
    console.log('[newsletter] No posts found, nothing to send.');
    return;
  }

  const subscribers = await loadVerifiedSubscribers();
  if (subscribers.length === 0) {
    console.log('[newsletter] No verified subscribers, nothing to send.');
    return;
  }

  const log = loadJson(LOG_PATH, { sentPostIds: [], runs: [] });
  if (!Array.isArray(log.sentPostIds)) log.sentPostIds = [];
  if (!Array.isArray(log.runs)) log.runs = [];

  const post = resolvePostToSend(posts, log.sentPostIds, forcedSlug);
  if (!post) {
    console.log('[newsletter] No unsent post found, skipping.');
    return;
  }

  const postKey = post.id || post.slug;
  const { subject, text, html } = buildEmail(post, customText, siteBaseUrl);

  console.log(`[newsletter] Sending "${post.title}" to ${subscribers.length} subscribers. dryRun=${dryRun}`);

  let sentCount = 0;
  let failedCount = 0;

  if (!dryRun) {
    for (const email of subscribers) {
      try {
        await sendViaResend(email, from, subject, text, html);
        console.log(`  ✓ ${email}`);
        sentCount++;
      } catch (err) {
        console.error(`  ✗ ${email}: ${err.message}`);
        failedCount++;
      }
      // Kurze Pause für Resend Rate Limits
      await new Promise((r) => setTimeout(r, 200));
    }
  } else {
    sentCount = subscribers.length;
    console.log('[newsletter] Dry run — no emails sent.');
  }

  log.runs.push({
    postId: postKey,
    slug: post.slug,
    title: post.title,
    sentAt: new Date().toISOString(),
    recipients: subscribers.length,
    sentCount,
    failedCount,
    dryRun,
    customText: customText || null,
  });

  if (!dryRun && failedCount === 0 && !log.sentPostIds.includes(postKey)) {
    log.sentPostIds.push(postKey);
  }

  saveJson(LOG_PATH, log);
  console.log(`[newsletter] Done. sent=${sentCount}, failed=${failedCount}`);
}

main().catch((err) => {
  console.error(`[newsletter] Fatal: ${err.message}`);
  process.exit(1);
});