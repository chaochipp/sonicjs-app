import handler from '@astrojs/cloudflare/entrypoints/server'

import sonicApp from './index'
import { injectAdminRuntimeOverrides } from './lib/admin-runtime-overrides'
import publicContentApi from './routes/public-content'
import { syncTinyMceApiKey } from './lib/tinymce-settings'

type Bindings = {
  ASSETS: Fetcher
  DB: D1Database
  ENVIRONMENT: string
  MEDIA_BUCKET: R2Bucket
  TINYMCE_API_KEY?: string
}

let tinyMceSyncPromise: Promise<void> | null = null

function ensureTinyMceApiKey(env: Bindings) {
  if (!tinyMceSyncPromise) {
    tinyMceSyncPromise = syncTinyMceApiKey(env.DB, env.TINYMCE_API_KEY).catch((error) => {
      tinyMceSyncPromise = null
      throw error
    })
  }

  return tinyMceSyncPromise
}

async function maybeInjectAdminOverrides(request: Request, response: Response): Promise<Response> {
  const { pathname } = new URL(request.url)
  const contentType = response.headers.get('content-type') ?? ''

  if (!pathname.startsWith('/admin') || !contentType.includes('text/html')) {
    return response
  }

  const html = await response.text()
  const nextHtml = injectAdminRuntimeOverrides(html)

  if (nextHtml === html) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  }

  const headers = new Headers(response.headers)
  headers.delete('content-length')

  return new Response(nextHtml, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

export default {
  async fetch(request, env, ctx) {
    await ensureTinyMceApiKey(env)

    const { pathname } = new URL(request.url)

    if (pathname === '/api/public' || pathname.startsWith('/api/public/')) {
      const apiUrl = new URL(request.url)
      apiUrl.pathname = pathname.replace(/^\/api\/public/, '') || '/'
      const apiRequest = new Request(apiUrl, request)

      return publicContentApi.fetch(apiRequest, env, ctx)
    }

    if (
      pathname === '/api' ||
      pathname.startsWith('/api/') ||
      pathname === '/auth' ||
      pathname.startsWith('/auth/') ||
      pathname === '/admin' ||
      pathname.startsWith('/admin/') ||
      pathname === '/files' ||
      pathname.startsWith('/files/') ||
      pathname === '/media' ||
      pathname.startsWith('/media/')
    ) {
      const response = await sonicApp.fetch(request, env, ctx)
      return maybeInjectAdminOverrides(request, response)
    }

    return handler.fetch(request, env, ctx)
  }
} satisfies ExportedHandler<Bindings>
