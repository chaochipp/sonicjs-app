import { describe, expect, it } from 'vitest'

import {
  buildListingHref,
  parseTagList,
  resolveHomepageSections,
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

  it('preserves legacy base64 images in stored html content', () => {
    const record: PublicPostRecord = {
      id: 'post-legacy',
      slug: 'legacy-inline-image',
      title: 'Legacy Inline Image',
      data: JSON.stringify({
        content: '<p>Legacy image</p><p><img src="data:image/png;base64,AAAA" alt="Legacy" /></p>',
        author: 'cwcat',
        category: 'guides'
      }),
      status: 'published',
      publishedAt: 1_710_100_000_000,
      createdAt: 1_710_100_000_000,
      updatedAt: 1_710_100_100_000
    }

    const post = toPublicPost(record)

    expect(post.contentHtml).toContain('src="data:image/png;base64,AAAA"')
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

  it('builds homepage sections with at most two featured posts and no duplicates in recents', () => {
    const featured = [
      {
        id: 'featured-1',
        slug: 'lead-guide',
        title: 'Lead Guide',
        excerpt: 'Lead excerpt',
        contentHtml: '<p>Lead</p>',
        author: 'Bao',
        category: 'guides',
        categorySlug: 'guides',
        tags: [],
        featuredImage: null,
        featuredImageAlt: 'Lead Guide',
        seoTitle: 'Lead Guide',
        seoDescription: 'Lead excerpt',
        featured: true,
        publishedAt: '2024-01-01T00:00:00.000Z',
        publishedAtLabel: 'Jan 1, 2024'
      },
      {
        id: 'featured-2',
        slug: 'support-guide',
        title: 'Support Guide',
        excerpt: 'Support excerpt',
        contentHtml: '<p>Support</p>',
        author: 'Bao',
        category: 'guides',
        categorySlug: 'guides',
        tags: [],
        featuredImage: null,
        featuredImageAlt: 'Support Guide',
        seoTitle: 'Support Guide',
        seoDescription: 'Support excerpt',
        featured: true,
        publishedAt: '2024-01-02T00:00:00.000Z',
        publishedAtLabel: 'Jan 2, 2024'
      },
      {
        id: 'featured-3',
        slug: 'overflow-guide',
        title: 'Overflow Guide',
        excerpt: 'Overflow excerpt',
        contentHtml: '<p>Overflow</p>',
        author: 'Bao',
        category: 'guides',
        categorySlug: 'guides',
        tags: [],
        featuredImage: null,
        featuredImageAlt: 'Overflow Guide',
        seoTitle: 'Overflow Guide',
        seoDescription: 'Overflow excerpt',
        featured: true,
        publishedAt: '2024-01-03T00:00:00.000Z',
        publishedAtLabel: 'Jan 3, 2024'
      }
    ]
    const recent = [
      featured[1],
      {
        id: 'recent-1',
        slug: 'recent-guide',
        title: 'Recent Guide',
        excerpt: 'Recent excerpt',
        contentHtml: '<p>Recent</p>',
        author: 'Bao',
        category: 'events',
        categorySlug: 'events',
        tags: [],
        featuredImage: null,
        featuredImageAlt: 'Recent Guide',
        seoTitle: 'Recent Guide',
        seoDescription: 'Recent excerpt',
        featured: false,
        publishedAt: '2024-01-04T00:00:00.000Z',
        publishedAtLabel: 'Jan 4, 2024'
      }
    ]

    const sections = resolveHomepageSections(featured, recent)

    expect(sections.featuredPosts.map((post) => post.id)).toEqual(['featured-1', 'featured-2'])
    expect(sections.recentPosts.map((post) => post.id)).toEqual(['recent-1'])
  })

  it('omits the featured section entirely when there are no featured posts', () => {
    const sections = resolveHomepageSections([], [
      {
        id: 'recent-1',
        slug: 'recent-guide',
        title: 'Recent Guide',
        excerpt: 'Recent excerpt',
        contentHtml: '<p>Recent</p>',
        author: 'Bao',
        category: 'events',
        categorySlug: 'events',
        tags: [],
        featuredImage: null,
        featuredImageAlt: 'Recent Guide',
        seoTitle: 'Recent Guide',
        seoDescription: 'Recent excerpt',
        featured: false,
        publishedAt: '2024-01-04T00:00:00.000Z',
        publishedAtLabel: 'Jan 4, 2024'
      }
    ])

    expect(sections.featuredPosts).toEqual([])
    expect(sections.recentPosts).toHaveLength(1)
  })
})
