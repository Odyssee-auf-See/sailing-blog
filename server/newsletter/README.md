# Newsletter Server Scripts

This folder contains the newsletter sender scripts used by GitHub Actions and local maintenance commands.

## Files

- `newsletter-subscribe.js`
- `newsletter-verify.js`
- `send-news-notification.js`

## Connection to Cloudflare Worker

The production signup API runs in Cloudflare Worker:

- `workers/newsletter-api/src/worker.js`

The Worker handles subscribe and verify endpoints for the static website.

The sender script in this folder can pull verified subscribers from the Worker endpoint:

- `GET /api/newsletter/verified` (protected by bearer token)

Set these environment variables in GitHub Actions:

- `NEWSLETTER_SUBSCRIBERS_ENDPOINT`
- `NEWSLETTER_API_TOKEN`

This keeps public signup data in Cloudflare KV while retaining SMTP send control in the repository workflow.
