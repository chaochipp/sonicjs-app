# TopHeroes Hub on SonicJS + Astro

This project now combines two layers in one Cloudflare Worker deployment:

- A public Astro frontend for `topheroes.cwcat.com`
- A SonicJS CMS mounted under `/api`

There are now two separate Worker deploy targets using the same codebase:

- `sonicjs-app` for `topheroes.cwcat.com`
- `774topheroes` for `774.cwcat.com`

The intended production shape is:

- `https://topheroes.cwcat.com/` for the public site
- `https://topheroes.cwcat.com/api` for the headless CMS and admin/API routes
- `https://774.cwcat.com/` for the separate 774 site
- `https://774.cwcat.com/api` for the separate 774 CMS and admin/API routes

## Stack

- SonicJS for content management on Cloudflare Workers
- Astro for the public blog frontend
- Tailwind CSS for the design system
- Cloudflare D1 and R2 for storage
- Vitest and Playwright for test coverage

## Public Routes

- `/` homepage with featured and recent content
- `/posts` searchable article archive
- `/posts/[slug]` article detail pages
- `/categories/[slug]` category-specific listing pages
- `/api/public/posts` public JSON API for published content
- `/api/admin` SonicJS admin

## Content Model

The `blog-posts` collection is configured for editorial content such as:

- guides
- references
- tutorials
- news

Posts include category, SEO fields, tags, publish date, and a featured flag so the frontend can support search, filtering, and featured placements.

## Local Development

Install dependencies:

```bash
npm install
```

Run the Astro frontend:

```bash
npm run dev
```

Run the Worker preview:

```bash
npm run build
npm run dev:worker
```

Apply D1 migrations locally:

```bash
npm run db:migrate
```

Configure TinyMCE locally in `.dev.vars`:

```bash
TINYMCE_API_KEY=your-tinymce-api-key
```

The worker bootstraps the SonicJS `tinymce-plugin` settings from `TINYMCE_API_KEY` automatically on request startup.

## Tests

Run unit tests:

```bash
npm test
```

Run end-to-end tests:

```bash
npm run e2e
```

## Deployment

Build the Astro site and deploy the combined Worker:

```bash
npm run deploy
```

Available deploy targets:

```bash
npm run deploy:production
npm run deploy:774
```

Apply remote migrations to the matching environment before first deploy:

```bash
npm run db:migrate:prod
npm run db:migrate:774
```

The current Wrangler config includes separate worker targets:

- `production` -> worker service `sonicjs-app` for `topheroes.cwcat.com`
- `server774` -> worker service `774topheroes` for `774.cwcat.com`

You still need the matching DNS and Cloudflare Worker domain bindings configured in your Cloudflare account.

The current `server774` bindings in `wrangler.toml` point to:

- D1 database id: `d6967cf4-6c6e-4e73-8f87-98b6f1a68c2f`
- R2 bucket: `774bucket`

Set the TinyMCE API key for production before deploying:

```bash
wrangler secret put TINYMCE_API_KEY --env production
```

Set the same secret separately for the 774 environment if needed:

```bash
wrangler secret put TINYMCE_API_KEY --env server774
```

Then deploy the target environment you want:

```bash
npm run deploy:production
# or
npm run deploy:774
```
