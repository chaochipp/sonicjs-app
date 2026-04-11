import { expect, test } from '@playwright/test'

test.describe('TopHeroes blog frontend', () => {
  test('homepage renders the editorial shell', async ({ page }) => {
    const response = await page.goto('/')

    expect(response?.ok()).toBeTruthy()
    await expect(page.getByRole('link', { name: /All Articles/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'CMS' })).toBeVisible()
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
