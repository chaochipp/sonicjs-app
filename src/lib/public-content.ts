export const BLOG_COLLECTION = 'blog-posts'
export const DEFAULT_PAGE_SIZE = 9
export const MAX_PAGE_SIZE = 24

export type PublicPostRecord = {
  id: string
  slug: string
  title: string
  data: string
  status: string
  publishedAt: number | null
  createdAt: number
  updatedAt: number
}

export type PublicPost = {
  id: string
  slug: string
  title: string
  excerpt: string
  contentHtml: string
  author: string
  category: string
  categorySlug: string
  tags: string[]
  featuredImage: string | null
  featuredImageAlt: string
  seoTitle: string
  seoDescription: string
  featured: boolean
  publishedAt: string | null
  publishedAtLabel: string
}

export type PublicCategory = {
  slug: string
  label: string
  count: number
}

export type PostListParams = {
  q?: string
  category?: string
  featured?: boolean
  page?: number
  pageSize?: number
}

export type PostListResponse = {
  items: PublicPost[]
  categories: PublicCategory[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
  filters: {
    q: string
    category: string
    featured: boolean
  }
}

type RawPostData = {
  title?: unknown
  excerpt?: unknown
  content?: unknown
  author?: unknown
  category?: unknown
  tags?: unknown
  featuredImage?: unknown
  seoTitle?: unknown
  seoDescription?: unknown
  featured?: unknown
}

export function normalizePage(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1
  }

  return Math.floor(value)
}

export function normalizePageSize(value: number | undefined): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return DEFAULT_PAGE_SIZE
  }

  return Math.min(Math.floor(value), MAX_PAGE_SIZE)
}

export function normalizeSearchTerm(value: string | undefined): string {
  return (value ?? '').trim()
}

export function slugifyCategory(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatCategoryLabel(value: string | undefined): string {
  if (!value) {
    return 'Uncategorized'
  }

  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

export function parseTagList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => `${entry}`.trim())
      .filter(Boolean)
  }

  if (typeof value !== 'string') {
    return []
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function parseBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return value === 'true' || value === '1' || value.toLowerCase() === 'yes'
  }

  if (typeof value === 'number') {
    return value === 1
  }

  return false
}

export function extractFeaturedImage(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const knownKeys = ['publicUrl', 'public_url', 'url', 'src']

  for (const key of knownKeys) {
    const match = candidate[key]
    if (typeof match === 'string' && match.trim()) {
      return match
    }
  }

  return null
}

export function safeExcerpt(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  return fallback
}

export function extractHtmlContent(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value && typeof value === 'object' && 'html' in value) {
    const html = (value as { html?: unknown }).html
    if (typeof html === 'string') {
      return html
    }
  }

  return ''
}

export function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function summarizeContent(html: string, maxLength = 180): string {
  const plainText = stripHtml(html)

  if (plainText.length <= maxLength) {
    return plainText
  }

  return `${plainText.slice(0, maxLength).trimEnd()}...`
}

export function formatPublishedDate(timestamp: number | null): string {
  if (!timestamp) {
    return 'Coming soon'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(timestamp))
}

export function toPublicPost(record: PublicPostRecord): PublicPost {
  const rawData = JSON.parse(record.data) as RawPostData
  const contentHtml = extractHtmlContent(rawData.content)
  const category = `${rawData.category ?? ''}`.trim() || 'guides'
  const excerpt = safeExcerpt(rawData.excerpt, summarizeContent(contentHtml))
  const effectivePublishedAt = record.publishedAt ?? record.createdAt ?? record.updatedAt ?? null
  const publishedAt = effectivePublishedAt ? new Date(effectivePublishedAt).toISOString() : null
  const featuredImage = extractFeaturedImage(rawData.featuredImage)

  return {
    id: record.id,
    slug: record.slug,
    title: record.title || `${rawData.title ?? 'Untitled'}`,
    excerpt,
    contentHtml,
    author: `${rawData.author ?? 'TopHeroes Editorial'}`.trim(),
    category,
    categorySlug: slugifyCategory(category),
    tags: parseTagList(rawData.tags),
    featuredImage,
    featuredImageAlt: record.title,
    seoTitle: `${rawData.seoTitle ?? record.title}`.trim(),
    seoDescription: safeExcerpt(rawData.seoDescription, excerpt),
    featured: parseBooleanFlag(rawData.featured),
    publishedAt,
    publishedAtLabel: formatPublishedDate(effectivePublishedAt)
  }
}

export function buildListingQuery(params: PostListParams): URLSearchParams {
  const search = new URLSearchParams()
  const q = normalizeSearchTerm(params.q)
  const category = slugifyCategory(params.category)
  const page = normalizePage(params.page)
  const pageSize = normalizePageSize(params.pageSize)

  if (q) {
    search.set('q', q)
  }

  if (category) {
    search.set('category', category)
  }

  if (params.featured) {
    search.set('featured', 'true')
  }

  if (page > 1) {
    search.set('page', `${page}`)
  }

  if (pageSize !== DEFAULT_PAGE_SIZE) {
    search.set('pageSize', `${pageSize}`)
  }

  return search
}

export function buildListingHref(basePath: string, params: PostListParams): string {
  const search = buildListingQuery(params).toString()
  return search ? `${basePath}?${search}` : basePath
}

export function resolveCategoryCounts(posts: PublicPost[]): PublicCategory[] {
  const counts = new Map<string, PublicCategory>()

  for (const post of posts) {
    if (!post.categorySlug) {
      continue
    }

    const existing = counts.get(post.categorySlug)
    if (existing) {
      existing.count += 1
      continue
    }

    counts.set(post.categorySlug, {
      slug: post.categorySlug,
      label: formatCategoryLabel(post.category),
      count: 1
    })
  }

  return [...counts.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

export function resolveRelatedPosts(posts: PublicPost[], currentSlug: string, categorySlug: string): PublicPost[] {
  return posts
    .filter((post) => post.slug !== currentSlug && post.categorySlug === categorySlug)
    .slice(0, 3)
}
