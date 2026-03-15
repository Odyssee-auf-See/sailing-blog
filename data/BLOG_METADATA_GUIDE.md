## How to add a new post (quick workflow)

1. Add a new object to `posts` in `data/blog_metadata.json`.
2. Give it a unique `id` and `slug`.
3. Set `url` to `pages/blog/post-template.html`.
4. Add `image`, `title`, `excerpt`, `date`, `tag`.
5. Optional: add `heroImages`, `sections`, and `related` for full dynamic rendering.
6. Open in browser with `pages/blog/post-template.html?slug=your-slug`.


# Blog Metadata Guide

This file explains each field in `data/blog_metadata.json` and how it is used by the site.

## Root structure

```json
{
  "site": { ... },
  "posts": [ ... ]
}
```

### `site`
Global settings for the whole blog.

- `baseUrl` (string)
  - Full website base URL (for canonical / social meta URLs).
  - Example: `"https://odyssee-sailing.ch"`

### `posts`
Array of blog post objects. Each object is one post.

---

## Post fields

### Required (recommended for every post)

- `id` (string)
  - Internal unique identifier.
  - Used for related post mapping and fallback slug creation.
  - Example: `"post-16"`

- `slug` (string)
  - URL identifier used in `post-template.html?slug=...`.
  - Must be unique.
  - Example: `"atlantic-crossing-day-3"`

- `title` (string)
  - Main post title.
  - Used in blog cards and post page title.

- `date` (string, `YYYY-MM-DD`)
  - Publish date.
  - Used for sorting and display.

- `tag` (string)
  - Category shown in cards and post header.
  - Should match your existing filter categories if you want filter buttons to work.
  - Current categories in UI: `Reisen`, `Boot`, `Nachhaltigkeit`, `Gedankenchaos`.

- `url` (string)
  - Path to post page template.
  - Usually: `"pages/blog/post-template.html"`
  - The script automatically appends `?slug=...` for template links.

- `image` (string)
  - Card/preview image path.
  - Used in blog overview cards and related posts.

- `excerpt` (string)
  - Short description for cards + SEO description fallback.

### Strongly recommended

- `updated` (string, `YYYY-MM-DD`)
  - Last update date for structured data (`dateModified`).

- `author` (string)
  - Author name for post metadata.

- `keywords` (array of strings)
  - SEO keywords.
  - Example: `["Segeln", "Navigation", "Boot"]`

- `canonical` (string)
  - Canonical URL path or absolute URL.
  - Example path: `"/pages/blog/post-template.html?slug=atlantic-crossing-day-3"`

- `intro` (string)
  - Intro paragraph shown below post title on post page.

### Optional for full dynamic post-template rendering

- `heroImages` (array)
  - Images for top carousel on post page.
  - Shape:
    - `src` (string): image path
    - `alt` (string): caption/alt text

- `sections` (array)
  - Main article content blocks (rendered into `.content-block`).
  - Each section supports:
    - `title` (string)
    - `html` (string): body HTML (you can use `<br>`)
    - `gallery` (array, optional): horizontal gallery under that section
      - item shape: `src` + `alt`

- `related` (array of strings)
  - List of related post IDs or slugs.
  - Used to render related posts row at the bottom.
  - If empty or missing, system falls back to newest posts excluding current.

---

## Minimal post example

```json
{
  "id": "post-16",
  "slug": "atlantic-crossing-day-3",
  "title": "Atlantic Crossing - Day 3",
  "date": "2026-03-15",
  "updated": "2026-03-15",
  "tag": "Reisen",
  "url": "pages/blog/post-template.html",
  "image": "assets/images/blog/blog_16.jpg",
  "excerpt": "Logbook update from day 3 of our Atlantic crossing.",
  "author": "Vito & Lea",
  "keywords": ["Atlantik", "Segeln", "Logbuch"]
}
```

## Full post example (template-driven)

```json
{
  "id": "post-17",
  "slug": "anchoring-in-croatia",
  "title": "Ankern in Kroatien",
  "date": "2026-03-20",
  "updated": "2026-03-20",
  "tag": "Boot",
  "url": "pages/blog/post-template.html",
  "canonical": "/pages/blog/post-template.html?slug=anchoring-in-croatia",
  "image": "assets/images/blog/blog_17.jpg",
  "excerpt": "Unsere besten Tipps für sichere Ankerplätze in Kroatien.",
  "intro": "Was wir in einer Woche entlang der dalmatinischen Küste gelernt haben.",
  "author": "Vito & Lea",
  "keywords": ["Ankern", "Kroatien", "Segeln"],
  "heroImages": [
    { "src": "pages/blog/posts/post-17/assets/images/photo1.jpg", "alt": "Ankerbucht bei Sonnenaufgang" }
  ],
  "sections": [
    {
      "title": "Winddreher am Abend",
      "html": "Ab 19 Uhr drehte der Wind deutlich nach Nordost ...",
      "gallery": [
        { "src": "pages/blog/posts/post-17/assets/images/photo2.jpg", "alt": "Bucht am Abend" }
      ]
    }
  ],
  "related": ["post-6", "post-12"]
}
```

