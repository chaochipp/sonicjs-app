import { describe, expect, it } from 'vitest'

import { injectAdminRuntimeOverrides } from './admin-runtime-overrides'

describe('admin runtime overrides', () => {
  it('injects mixed-paste aware handlers and avoids global base64 sanitizing', () => {
    const html = '<html><head></head><body><div>Admin</div></body></html>'
    const result = injectAdminRuntimeOverrides(html)

    expect(result).toContain("quill.root.addEventListener('paste', onPaste, true)")
    expect(result).toContain("quill.root.addEventListener('drop', onDrop, true)")
    expect(result).toContain('function isMixedClipboardPaste(event, entries)')
    expect(result).toContain('window.setTimeout(async () => {')
    expect(result).toContain('await replacePastedBase64Images(quill, entries, baselineCounts)')
    expect(result).toContain('removeTransientBase64Images(quill, entries.map((entry) => entry.dataUrl))')
    expect(result).not.toContain('function sanitizeEditorHtml')
    expect(result).not.toContain("op.insert.image.startsWith('data:image/')")
  })
})
