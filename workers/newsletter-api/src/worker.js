export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/newsletter/subscribe' && request.method === 'POST') {
        return withCors(await handleSubscribe(request, env), request, env);
      }

      if (url.pathname === '/api/newsletter/verify' && request.method === 'GET') {
        return withCors(await handleVerify(url, env), request, env);
      }

      if (url.pathname === '/api/newsletter/unsubscribe' && request.method === 'GET') {
        return withCors(await handleUnsubscribe(url, env), request, env);
      }

      if (url.pathname === '/api/newsletter/verified' && request.method === 'GET') {
        return withCors(await handleVerifiedList(request, env), request, env);
      }

      return withCors(json({ ok: false, error: 'Not found' }, 404), request, env);
    } catch (error) {
      return withCors(json({ ok: false, error: error.message || 'Unexpected error' }, 500), request, env);
    }
  },
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(request, env);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get('Origin') || '';
  const allowedOrigin = env.ALLOWED_ORIGIN || '*';
  const origin = allowedOrigin === '*' ? '*' : (requestOrigin === allowedOrigin ? allowedOrigin : allowedOrigin);

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function base64Url(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    const n = (b0 << 16) | (b1 << 8) | b2;
    out += chars[(n >> 18) & 63];
    out += chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : '';
    out += i + 2 < bytes.length ? chars[n & 63] : '';
  }
  return out;
}

function randomToken(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function subscriberKey(email) {
  const hash = await sha256Hex(email.toLowerCase());
  return `sub:${hash}`;
}

async function handleSubscribe(request, env) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email || '').trim().toLowerCase();
  const source = String(body?.source || 'web').slice(0, 200);
  const language = String(body?.language || 'de').slice(0, 10);

  if (!isValidEmail(email)) {
    return json({ ok: false, error: 'Invalid email address' }, 400);
  }

  const key = await subscriberKey(email);
  const now = new Date().toISOString();
  const existingRaw = await env.NEWSLETTER_KV.get(key);
  const existing = existingRaw ? JSON.parse(existingRaw) : null;

  const verifyToken = randomToken(32);
  const verifyTokenHash = await sha256Hex(verifyToken);
  const unsubscribeToken = existing?.unsubscribeToken || randomToken(32);

  const record = {
    email,
    status: existing?.status === 'verified' ? 'verified' : 'pending',
    source,
    language,
    subscribedAt: existing?.subscribedAt || now,
    pendingAt: now,
    verifiedAt: existing?.verifiedAt || null,
    unsubscribedAt: existing?.unsubscribedAt || null,
    verifyTokenHash,
    unsubscribeToken,
  };

  if (record.status === 'verified') {
    return json({
      ok: true,
      status: 'verified',
      emailSent: false,
      verifyUrl: null,
    });
  }

  await env.NEWSLETTER_KV.put(key, JSON.stringify(record));

  const siteBase = String(env.SITE_BASE_URL || 'https://odyssee-sailing.ch').replace(/\/$/, '');
  const verifyUrl = `${siteBase}/api/newsletter/verify?token=${encodeURIComponent(verifyToken)}&email=${encodeURIComponent(email)}`;

  const emailSent = await maybeSendVerifyEmail(env, {
    to: email,
    verifyUrl,
    language,
  });

  return json({
    ok: true,
    status: record.status,
    emailSent,
    verifyUrl: emailSent ? null : verifyUrl,
  });
}

async function handleVerify(url, env) {
  const token = String(url.searchParams.get('token') || '');
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
  const siteBase = String(env.SITE_BASE_URL || 'https://odyssee-sailing.ch').replace(/\/$/, '');

  if (!token || !isValidEmail(email)) {
    return Response.redirect(`${siteBase}/server/newsletter/error`, 302);
  }

  const key = await subscriberKey(email);
  const raw = await env.NEWSLETTER_KV.get(key);
  if (!raw) {
    return Response.redirect(`${siteBase}/server/newsletter/error`, 302);
  }

  const record = JSON.parse(raw);
  if (record.status === 'verified') {
    return Response.redirect(`${siteBase}/server/newsletter/verified`, 302);
  }

  const incomingHash = await sha256Hex(token);
  if (!record.verifyTokenHash || record.verifyTokenHash !== incomingHash) {
    return Response.redirect(`${siteBase}/server/newsletter/error`, 302);
  }

  record.status = 'verified';
  record.verifiedAt = new Date().toISOString();
  delete record.verifyTokenHash;

  await env.NEWSLETTER_KV.put(key, JSON.stringify(record));
  return Response.redirect(`${siteBase}/server/newsletter/verified`, 302);
}

async function handleUnsubscribe(url, env) {
  const token = String(url.searchParams.get('token') || '');
  const email = String(url.searchParams.get('email') || '').trim().toLowerCase();

  if (!token || !isValidEmail(email)) {
    return json({ ok: false, error: 'Missing token or email' }, 400);
  }

  const key = await subscriberKey(email);
  const raw = await env.NEWSLETTER_KV.get(key);
  if (!raw) {
    return json({ ok: false, error: 'Subscriber not found' }, 404);
  }

  const record = JSON.parse(raw);
  if (record.unsubscribeToken !== token) {
    return json({ ok: false, error: 'Invalid unsubscribe token' }, 400);
  }

  record.unsubscribedAt = new Date().toISOString();
  await env.NEWSLETTER_KV.put(key, JSON.stringify(record));

  return json({ ok: true, unsubscribed: true });
}

async function handleVerifiedList(request, env) {
  const expected = String(env.NEWSLETTER_API_TOKEN || '');
  const authHeader = request.headers.get('Authorization') || '';

  if (!expected) {
    return json({ ok: false, error: 'NEWSLETTER_API_TOKEN not configured' }, 500);
  }

  if (authHeader !== `Bearer ${expected}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let cursor;
  const subscribers = [];

  do {
    const listed = await env.NEWSLETTER_KV.list({ prefix: 'sub:', cursor });
    cursor = listed.cursor;

    for (const key of listed.keys) {
      const raw = await env.NEWSLETTER_KV.get(key.name);
      if (!raw) continue;
      const record = JSON.parse(raw);
      if (record.status === 'verified' && !record.unsubscribedAt && isValidEmail(record.email || '')) {
        subscribers.push(record.email.toLowerCase());
      }
    }
  } while (cursor);

  return json({ ok: true, subscribers });
}

async function maybeSendVerifyEmail(env, payload) {
  const fromEmail = env.MAILCHANNELS_FROM_EMAIL; // kannst du behalten oder umbenennen
  const fromName = env.MAILCHANNELS_FROM_NAME || 'Odyssee auf See';

  if (!fromEmail) {
    console.error("RESEND_FROM_EMAIL is not set!");
    return false;
  }

  if (!env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not set!");
    return false;
  }

  const intro = payload.language === 'de'
    ? 'Bitte bestaetige deine E-Mail-Adresse, um Benachrichtigungen zu neuen Blogbeitraegen zu erhalten.'
    : 'Please confirm your email address to receive new blog post notifications.';

  const subject = payload.language === 'de'
    ? 'Bitte bestaetige deine Newsletter-Anmeldung'
    : 'Please confirm your newsletter subscription';

  const contentText = `${intro}\n\nBestaetigen: ${payload.verifyUrl}`;
  const contentHtml = `<p>${intro}</p><p><a href="${payload.verifyUrl}">Anmeldung bestaetigen</a></p>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [payload.to],
      subject: subject,
      text: contentText,
      html: contentHtml,
    }),
  });

  const responseText = await response.text();
  console.log("Resend Status:", response.status);
  if (!response.ok) {
    console.error("Resend Error Details:", responseText);
  } else {
    console.log("Resend success: Mail should be on its way.");
  }

  return response.ok;
}