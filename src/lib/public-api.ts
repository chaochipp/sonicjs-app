import { buildListingHref, type PostListParams, type PostListResponse, type PublicPost } from './public-content'

type PostDetailResponse = {
  item: PublicPost
  related: PublicPost[]
}

function buildApiUrl(currentUrl: URL, path: string): URL {
  return new URL(path, currentUrl)
}

export async function fetchPosts(currentUrl: URL, params: PostListParams = {}): Promise<PostListResponse> {
  const path = buildListingHref('/api/public/posts', params)
  const response = await fetch(buildApiUrl(currentUrl, path))

  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.status}`)
  }

  return response.json() as Promise<PostListResponse>
}

export async function fetchPostBySlug(currentUrl: URL, slug: string): Promise<PostDetailResponse | null> {
  const response = await fetch(buildApiUrl(currentUrl, `/api/public/posts/${slug}`))

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch post: ${response.status}`)
  }

  return response.json() as Promise<PostDetailResponse>
}
