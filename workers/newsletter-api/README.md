# Cloudflare Worker: Newsletter API

This Worker provides the API for your static blog signup form.

## Endpoints

- `POST /api/newsletter/subscribe`
- `GET /api/newsletter/verify?token=...&email=...`
- `GET /api/newsletter/unsubscribe?token=...&email=...`
- `GET /api/newsletter/verified` (protected, for GitHub Action sender)

## Storage

Uses Cloudflare KV namespace bound as `NEWSLETTER_KV`.

## Quick Setup

1. Create KV namespace and set `id` in `wrangler.toml`.
2. Set Worker secret token for protected export endpoint:

```bash
wrangler secret put NEWSLETTER_API_TOKEN
```

3. Optional Mailchannels sender identity (for verification email):

```bash
wrangler secret put MAILCHANNELS_FROM_EMAIL
wrangler secret put MAILCHANNELS_FROM_NAME
```

4. Deploy:

```bash
wrangler deploy
```

5. Add route in `wrangler.toml` (or dashboard) to:

`odyssee-sailing.ch/api/newsletter/*`

## Notes

- If `MAILCHANNELS_FROM_EMAIL` is missing, subscribe still works and returns `verifyUrl` in JSON.
- The GitHub Action sender can fetch verified subscribers from:
  `https://odyssee-sailing.ch/api/newsletter/verified`
  with header `Authorization: Bearer <NEWSLETTER_API_TOKEN>`.
