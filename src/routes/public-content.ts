import { Hono } from 'hono'
import { z } from 'zod'

import {
  BLOG_COLLECTION,
  DEFAULT_PAGE_SIZE,
  buildListingHref,
  formatCategoryLabel,
  normalizePage,
  normalizePageSize,
  normalizeSearchTerm,
  resolveCategoryCounts,
  resolveRelatedPosts,
  slugifyCategory,
  toPublicPost,
  type PublicCategory,
  type PublicPost,
  type PublicPostRecord
} from '../lib/public-content'

type Bindings = {
  DB: D1Database
}

const querySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  featured: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional()
})

type ContentRow = {
  id: string
  slug: string
  title: string
  data: string
  status: string
  publishedAt: number | null
  createdAt: number
  updatedAt: number
}

function isMissingContentTable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return error.message.includes('no such table: content') || error.message.includes('no such table: collections')
}

function createSearchPredicate(q: string): { clause: string; bindings: string[] } {
  if (!q) {
    return { clause: '', bindings: [] }
  }

  const token = `%${q.toLowerCase()}%`
  return {
    clause: `
      AND (
        lower(c.title) LIKE ?
        OR lower(coalesce(json_extract(c.data, '$.excerpt'), '')) LIKE ?
        OR lower(coalesce(json_extract(c.data, '$.content'), '')) LIKE ?
        OR lower(coalesce(json_extract(c.data, '$.tags'), '')) LIKE ?
        OR lower(coalesce(json_extract(c.data, '$.category'), '')) LIKE ?
      )
    `,
    bindings: [token, token, token, token, token]
  }
}

function createCategoryPredicate(category: string): { clause: string; bindings: string[] } {
  if (!category) {
    return { clause: '', bindings: [] }
  }

  return {
    clause: `AND lower(replace(coalesce(json_extract(c.data, '$.category'), ''), ' ', '-')) = ?`,
    bindings: [category]
  }
}

function createFeaturedPredicate(featured: boolean): { clause: string; bindings: string[] } {
  if (!featured) {
    return { clause: '', bindings: [] }
  }

  return {
    clause: `AND lower(coalesce(json_extract(c.data, '$.featured'), 'false')) = 'true'`,
    bindings: []
  }
}

async function loadPostRows(
  db: D1Database,
  {
    q,
    category,
    featured,
    page,
    pageSize
  }: {
    q: string
    category: string
    featured: boolean
    page: number
    pageSize: number
  }
) {
  const searchPredicate = createSearchPredicate(q)
  const categoryPredicate = createCategoryPredicate(category)
  const featuredPredicate = createFeaturedPredicate(featured)
  const offset = (page - 1) * pageSize

  const whereClause = `
    WHERE col.name = ?
      AND c.status = 'published'
      ${searchPredicate.clause}
      ${categoryPredicate.clause}
      ${featuredPredicate.clause}
  `

  const bindings = [
    BLOG_COLLECTION,
    ...searchPredicate.bindings,
    ...categoryPredicate.bindings
  ]

  const listBindings = [...bindings, pageSize, offset]

  const listQuery = `
    SELECT
      c.id,
      c.slug,
      c.title,
      c.data,
      c.status,
      c.published_at AS publishedAt,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt
    FROM content c
    INNER JOIN collections col ON col.id = c.collection_id
    ${whereClause}
    ORDER BY coalesce(c.published_at, c.created_at, c.updated_at) DESC, c.updated_at DESC
    LIMIT ?
    OFFSET ?
  `

  const countQuery = `
    SELECT COUNT(*) AS totalItems
    FROM content c
    INNER JOIN collections col ON col.id = c.collection_id
    ${whereClause}
  `

  const categoryQuery = `
    SELECT
      coalesce(json_extract(c.data, '$.category'), '') AS category,
      COUNT(*) AS count
    FROM content c
    INNER JOIN collections col ON col.id = c.collection_id
    WHERE col.name = ?
      AND c.status = 'published'
    GROUP BY category
    HAVING category != ''
    ORDER BY count DESC, category ASC
  `

  const [listResult, countResult, categoryResult] = await Promise.all([
    db.prepare(listQuery).bind(...listBindings).all<ContentRow>(),
    db.prepare(countQuery).bind(...bindings).first<{ totalItems: number }>(),
    db.prepare(categoryQuery).bind(BLOG_COLLECTION).all<{ category: string; count: number }>()
  ])

  const rows = listResult.results ?? []
  const posts = rows.map((row) => toPublicPost(row as PublicPostRecord))
  const categories =
    categoryResult.results?.map((row) => ({
      slug: slugifyCategory(row.category),
      label: formatCategoryLabel(row.category),
      count: Number(row.count)
    })) ?? resolveCategoryCounts(posts)

  return {
    posts,
    categories,
    totalItems: Number(countResult?.totalItems ?? 0)
  }
}

const publicContentApi = new Hono<{ Bindings: Bindings }>()

publicContentApi.get('/posts', async (c) => {
  const parseResult = querySchema.safeParse({
    q: c.req.query('q'),
    category: c.req.query('category'),
    featured: c.req.query('featured'),
    page: c.req.query('page'),
    pageSize: c.req.query('pageSize')
  })

  if (!parseResult.success) {
    return c.json({ error: 'Invalid query parameters' }, 400)
  }

  const q = normalizeSearchTerm(parseResult.data.q)
  const category = slugifyCategory(parseResult.data.category)
  const featured = parseResult.data.featured === 'true'
  const page = normalizePage(parseResult.data.page)
  const pageSize = normalizePageSize(parseResult.data.pageSize ?? DEFAULT_PAGE_SIZE)

  let posts: PublicPost[] = []
  let categories: PublicCategory[] = []
  let totalItems = 0

  try {
    const result = await loadPostRows(c.env.DB, {
      q,
      category,
      featured,
      page,
      pageSize
    })

    posts = result.posts
    categories = result.categories
    totalItems = result.totalItems
  } catch (error) {
    if (!isMissingContentTable(error)) {
      throw error
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  return c.json({
    items: posts,
    categories,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages
    },
    filters: {
      q,
      category,
      featured
    },
    links: {
      self: buildListingHref('/api/public/posts', { q, category, featured, page, pageSize })
    }
  })
})

publicContentApi.get('/posts/:slug', async (c) => {
  const slug = c.req.param('slug')
  const query = `
    SELECT
      c.id,
      c.slug,
      c.title,
      c.data,
      c.status,
      c.published_at AS publishedAt,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt
    FROM content c
    INNER JOIN collections col ON col.id = c.collection_id
    WHERE col.name = ?
      AND c.status = 'published'
      AND c.slug = ?
    LIMIT 1
  `

  let row: ContentRow | null = null

  try {
    row = await c.env.DB.prepare(query).bind(BLOG_COLLECTION, slug).first<ContentRow>()
  } catch (error) {
    if (!isMissingContentTable(error)) {
      throw error
    }
  }

  if (!row) {
    return c.json({ error: 'Post not found' }, 404)
  }

  const post = toPublicPost(row as PublicPostRecord)
  const relatedResult = await c.env.DB.prepare(
    `
      SELECT
        c.id,
        c.slug,
        c.title,
        c.data,
        c.status,
        c.published_at AS publishedAt,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt
      FROM content c
      INNER JOIN collections col ON col.id = c.collection_id
      WHERE col.name = ?
        AND c.status = 'published'
        AND c.slug != ?
        AND lower(replace(coalesce(json_extract(c.data, '$.category'), ''), ' ', '-')) = ?
      ORDER BY coalesce(c.published_at, c.created_at, c.updated_at) DESC
      LIMIT 4
    `
  )
    .bind(BLOG_COLLECTION, slug, post.categorySlug)
    .all<ContentRow>()

  const related = resolveRelatedPosts(
    (relatedResult.results ?? []).map((entry) => toPublicPost(entry as PublicPostRecord)),
    slug,
    post.categorySlug
  )

  return c.json({
    item: post,
    related
  })
})

export default publicContentApi
