# Newsletter Setup

## Purpose

This setup enables:
- Email signups for blog notifications
- Double opt-in verification flow
- GitHub Actions based notification sends with optional custom text

## Files

- `data/subscribers.json`: subscriber store (`pending` / `verified`)
- `data/newsletter_notifications_log.json`: idempotency + send history
- `server/newsletter/newsletter-subscribe.js`: creates pending subscriber and verification token URL
- `server/newsletter/newsletter-verify.js`: marks subscriber as verified
- `server/newsletter/send-news-notification.js`: sends new-post emails via SMTP
- `.github/workflows/notify-subscribers.yml`: automatic/manual notification workflow

## Required GitHub Secrets

- `PERSONAL_TOKEN` (repo write for committing log)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE` (`true` for port 465, else `false`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` (sender email)

## Optional GitHub Variables

- `SITE_BASE_URL` (e.g. `https://odyssee-sailing.ch`)
- `NEWSLETTER_DEFAULT_TEXT` (fallback intro text)
- `NEWSLETTER_SUBSCRIBERS_ENDPOINT` (e.g. `https://odyssee-sailing.ch/api/newsletter/verified`)

## Additional GitHub Secret (when using Worker subscriber API)

- `NEWSLETTER_API_TOKEN` (must match Worker secret with same value)

## CLI Examples

Create pending signup and print verification URL:

```bash
node server/newsletter/newsletter-subscribe.js --email user@example.com --language de --source blog-form
```

Verify a pending subscriber:

```bash
node server/newsletter/newsletter-verify.js --email user@example.com --token <token>
```

Send notifications manually for a specific post:

```bash
node server/newsletter/send-news-notification.js --post-slug segelboot-suche --custom-text "Neuer Beitrag ist online" 
```

Dry run:

```bash
node server/newsletter/send-news-notification.js --dry-run
```

## Integration Note

The website signup form posts to `/api/newsletter/subscribe`.

Cloudflare Worker implementation is included in:

- `workers/newsletter-api/src/worker.js`
- `workers/newsletter-api/wrangler.toml`
- `workers/newsletter-api/README.md`

After deployment, route `https://odyssee-sailing.ch/api/newsletter/*` to the Worker.

The sender script can read verified subscribers either:

1. from local `data/subscribers.json` (default), or
2. from Worker endpoint using `NEWSLETTER_SUBSCRIBERS_ENDPOINT` + `NEWSLETTER_API_TOKEN` (recommended for production).
