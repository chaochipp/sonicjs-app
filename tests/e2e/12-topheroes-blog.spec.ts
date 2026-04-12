import { expect, test } from '@playwright/test'

test.describe('TopHeroes blog frontend', () => {
  test('homepage renders the editorial shell and optional featured section', async ({ page }) => {
    const response = await page.goto('/')

    expect(response?.ok()).toBeTruthy()
    await expect(page.getByRole('searchbox')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Browse all articles' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'CMS' })).toBeVisible()

    const featuredHeading = page.getByRole('heading', {
      name: 'Featured strategies and key updates'
    })

    if (await featuredHeading.count()) {
      await expect(featuredHeading).toBeVisible()
      await expect(featuredHeading).toBeInViewport()

      const featuredSection = page.locator('section[aria-labelledby="featured-posts-heading"]')
      const featuredCount = await featuredSection.locator('article').count()
      expect(featuredCount).toBeGreaterThanOrEqual(1)
      expect(featuredCount).toBeLessThanOrEqual(2)
    }
  })

  test('archive search form is available', async ({ page }) => {
    await page.goto('/posts')

    await expect(page.getByRole('searchbox')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
  })

  test('public api remains mounted under /api', async ({ page }) => {
    const response = await page.goto('/api/public/posts')

    expect(response?.ok()).toBeTruthy()
  })
})
