import { describe, expect, it } from 'vitest'

import { mergeTinyMceSettings } from './tinymce-settings'

describe('tinymce settings', () => {
  it('injects the configured api key while preserving existing settings', () => {
    const merged = mergeTinyMceSettings(
      '{"apiKey":"no-api-key","defaultHeight":300,"defaultToolbar":"full","skin":"oxide-dark"}',
      'real-api-key'
    )

    expect(JSON.parse(merged)).toEqual({
      apiKey: 'real-api-key',
      defaultHeight: 300,
      defaultToolbar: 'full',
      skin: 'oxide-dark'
    })
  })

  it('creates settings JSON when none exists', () => {
    const merged = mergeTinyMceSettings(null, 'real-api-key')
    expect(JSON.parse(merged)).toEqual({ apiKey: 'real-api-key' })
  })
})
