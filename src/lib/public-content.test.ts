import { describe, expect, it } from 'vitest'

import {
  buildListingHref,
  parseTagList,
  slugifyCategory,
  toPublicPost,
  type PublicPostRecord
} from './public-content'

describe('public-content helpers', () => {
  it('maps a database record into a public post model', () => {
    const record: PublicPostRecord = {
      id: 'post-1',
      slug: 'best-farm-route',
      title: 'Best Farm Route',
      data: JSON.stringify({
        excerpt: 'A practical route for early farming.',
        content: '<p>Detailed guide.</p>',
        author: 'Bao',
        category: 'guides',
        tags: 'farm, stamina, route',
        featured: 'true',
        seoTitle: 'Farm Route Guide',
        seoDescription: 'Learn the best farm route.'
      }),
      status: 'published',
      publishedAt: 1_710_000_000_000,
      createdAt: 1_710_000_000_000,
      updatedAt: 1_710_000_100_000
    }

    const post = toPublicPost(record)

    expect(post.slug).toBe('best-farm-route')
    expect(post.categorySlug).toBe('guides')
    expect(post.tags).toEqual(['farm', 'stamina', 'route'])
    expect(post.featured).toBe(true)
    expect(post.seoTitle).toBe('Farm Route Guide')
  })

  it('preserves TinyMCE-style HTML content including images', () => {
    const record: PublicPostRecord = {
      id: 'post-2',
      slug: 'hero-priority',
      title: 'Hero Priority',
      data: JSON.stringify({
        content: '<p>Open with this route.</p><figure><img src="https://cdn.example.com/hero.png" alt="Hero" /></figure>',
        author: 'cwcat',
        category: 'guides'
      }),
      status: 'published',
      publishedAt: null,
      createdAt: 1_710_100_000_000,
      updatedAt: 1_710_100_100_000
    }

    const post = toPublicPost(record)

    expect(post.contentHtml).toContain('<img src="https://cdn.example.com/hero.png"')
    expect(post.publishedAtLabel).not.toBe('Coming soon')
  })

  it('builds stable listing hrefs for combined search and category filters', () => {
    const href = buildListingHref('/posts', {
      q: 'arena team',
      category: 'references',
      page: 2
    })

    expect(href).toBe('/posts?q=arena+team&category=references&page=2')
  })

  it('normalizes tag strings and category slugs', () => {
    expect(parseTagList('alpha, beta, gamma')).toEqual(['alpha', 'beta', 'gamma'])
    expect(slugifyCategory('Hero Tutorials')).toBe('hero-tutorials')
  })
})
