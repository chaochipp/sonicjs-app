const ADMIN_QUIll_OVERRIDE_STYLE_ID = 'topheroes-admin-quill-override-style'
const ADMIN_QUILL_OVERRIDE_SCRIPT_ID = 'topheroes-admin-quill-override-script'
const QUILL_BULLET_FORMAT_PATTERN = /(['"])list\1,\s*(['"])bullet\2,\s*(['"])indent\3/g
const INVALID_QUILL_FORMATS_SNIPPET = "'list', 'bullet', 'indent',"
const FIXED_QUILL_FORMATS_SNIPPET = "'list', 'indent',"
const BROKEN_AUTOSAVE_FETCH_SNIPPET = 'fetch(form.action, {'
const FIXED_AUTOSAVE_FETCH_SNIPPET =
  "const submitUrl = form.getAttribute('action') || form.getAttribute('hx-post') || window.location.pathname;\n          fetch(submitUrl, {"

function buildAdminQuillOverrideStyle(): string {
  return `<style id="${ADMIN_QUIll_OVERRIDE_STYLE_ID}">
.dark .ql-editor [style*="color"] {
  color: inherit !important;
}

.dark .ql-editor [style*="background"] {
  background-color: transparent !important;
}

.dark .ql-editor font[color] {
  color: inherit !important;
}
</style>`
}

function buildAdminQuillOverrideScript(): string {
  return `<script id="${ADMIN_QUILL_OVERRIDE_SCRIPT_ID}">
(() => {
  function notifyUploadIssue(message) {
    window.setTimeout(() => {
      window.alert(message)
    }, 0)
  }

  function getUploadedImageUrl(payload) {
    const file = payload && payload.file ? payload.file : null
    if (!file) return null

    if (typeof file.r2_key === 'string' && file.r2_key) {
      return '/files/' + file.r2_key
    }

    if (typeof file.publicUrl === 'string' && file.publicUrl) {
      return file.publicUrl
    }

    return null
  }

  async function uploadImageFile(file) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'uploads')

    const response = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin'
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || 'Upload failed')
    }

    const payload = await response.json()
    const imageUrl = getUploadedImageUrl(payload)

    if (!imageUrl) {
      throw new Error('Upload succeeded but no image URL was returned')
    }

    return imageUrl
  }

  function dataUrlToFile(dataUrl, fallbackName) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return null
    }

    const match = dataUrl.match(/^data:(image\\/[^;]+);base64,(.+)$/)
    if (!match) {
      return null
    }

    const mimeType = match[1]
    const base64 = match[2]
    const extension = mimeType.split('/')[1] || 'png'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    return new File([bytes], fallbackName + '.' + extension, { type: mimeType })
  }

  function getClipboardHtml(event) {
    return event.clipboardData?.getData('text/html') || ''
  }

  function getClipboardText(event) {
    return event.clipboardData?.getData('text/plain') || ''
  }

  function stripImagesFromHtml(html) {
    if (typeof html !== 'string' || !html) {
      return ''
    }

    return html.replace(/<img[^>]*>/gi, ' ')
  }

  function isMixedClipboardPaste(event, entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
      return false
    }

    const htmlWithoutImages = stripImagesFromHtml(getClipboardHtml(event))
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (htmlWithoutImages) {
      return true
    }

    return getClipboardText(event).trim().length > 0
  }

  function removeTransientBase64Images(quill, dataUrls) {
    if (!quill || !quill.root || !Array.isArray(dataUrls) || dataUrls.length === 0) {
      return false
    }

    let removed = false
    const knownDataUrls = new Set(dataUrls.filter((dataUrl) => typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')))

    if (knownDataUrls.size === 0) {
      return false
    }

    quill.root.querySelectorAll('img').forEach((image) => {
      const src = image.getAttribute('src') || ''
      if (!knownDataUrls.has(src)) {
        return
      }

      image.remove()
      removed = true
    })

    if (removed && typeof quill.update === 'function') {
      quill.update('silent')
    }

    return removed
  }

  function collectMatchingImageCounts(root, dataUrls) {
    const counts = new Map()
    if (!root || !Array.isArray(dataUrls) || dataUrls.length === 0) {
      return counts
    }

    const knownDataUrls = new Set(dataUrls.filter((dataUrl) => typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')))
    root.querySelectorAll('img').forEach((image) => {
      const src = image.getAttribute('src') || ''
      if (!knownDataUrls.has(src)) {
        return
      }

      counts.set(src, (counts.get(src) || 0) + 1)
    })

    return counts
  }

  function findNewMatchingImages(root, dataUrl, baselineCount) {
    if (!root || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return []
    }

    const matches = Array.from(root.querySelectorAll('img')).filter((image) => (image.getAttribute('src') || '') === dataUrl)
    return matches.slice(baselineCount)
  }

  async function insertUploadedImage(quill, file) {
    const range = quill.getSelection(true)
    const imageUrl = await uploadImageFile(file)
    const insertIndex = range ? range.index : quill.getLength()

    quill.insertEmbed(insertIndex, 'image', imageUrl, 'user')
    quill.setSelection(insertIndex + 1, 0, 'silent')
  }

  async function handleImageUploads(quill, entries) {
    for (const entry of entries) {
      await insertUploadedImage(quill, entry.file)
    }

    removeTransientBase64Images(quill, entries.map((entry) => entry.dataUrl))
  }

  async function replacePastedBase64Images(quill, entries, baselineCounts) {
    if (!quill || !quill.root || !Array.isArray(entries) || entries.length === 0) {
      return
    }

    for (const entry of entries) {
      if (!entry || typeof entry.dataUrl !== 'string' || !entry.dataUrl.startsWith('data:image/')) {
        continue
      }

      const baselineCount = baselineCounts instanceof Map ? (baselineCounts.get(entry.dataUrl) || 0) : 0
      const imagesToReplace = findNewMatchingImages(quill.root, entry.dataUrl, baselineCount)

      if (imagesToReplace.length === 0) {
        continue
      }

      const imageUrl = await uploadImageFile(entry.file)
      imagesToReplace.forEach((image) => {
        image.setAttribute('src', imageUrl)
      })
    }

    if (typeof quill.update === 'function') {
      quill.update('silent')
    }
  }

  function extractImageFilesFromClipboard(event) {
    const items = Array.from(event.clipboardData?.items || [])
    const files = items
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean)

    if (files.length > 0) {
      return files.map((file) => ({ file, dataUrl: null }))
    }

    const html = event.clipboardData?.getData('text/html') || ''
    if (!html || html.indexOf('data:image/') === -1) {
      return []
    }

    const matches = Array.from(html.matchAll(/<img[^>]+src=(['"])(data:image\\/[^'"]+)\\1/gi))
    return matches
      .map((match, index) => {
        const file = dataUrlToFile(match[2], 'pasted-image-' + (index + 1))
        return file ? { file, dataUrl: match[2] } : null
      })
      .filter(Boolean)
  }

  function extractImageFilesFromDrop(event) {
    return Array.from(event.dataTransfer?.files || [])
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({ file, dataUrl: null }))
  }

  function attachImageUploadHandlers(quill) {
    if (!quill || quill.__topheroesImageUploadHandlersApplied || !quill.root) return

    const onPaste = async (event) => {
      const entries = extractImageFilesFromClipboard(event)
      if (entries.length === 0) {
        return
      }

      if (!isMixedClipboardPaste(event, entries)) {
        event.preventDefault()
        event.stopImmediatePropagation()

        try {
          await handleImageUploads(quill, entries)
        } catch (error) {
          console.error('TopHeroes image paste upload failed:', error)
          notifyUploadIssue('Image paste upload failed. Please try again or upload through Media first.')
        }
        return
      }

      const baselineCounts = collectMatchingImageCounts(quill.root, entries.map((entry) => entry.dataUrl))

      window.setTimeout(async () => {
        try {
          await replacePastedBase64Images(quill, entries, baselineCounts)
        } catch (error) {
          console.error('TopHeroes mixed-content image paste upload failed:', error)
          notifyUploadIssue('Image paste upload failed. Please try again or upload through Media first.')
        }
      }, 0)
    }

    const onDrop = async (event) => {
      const entries = extractImageFilesFromDrop(event)
      if (entries.length === 0) {
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()

      try {
        await handleImageUploads(quill, entries)
      } catch (error) {
        console.error('TopHeroes image drop upload failed:', error)
        notifyUploadIssue('Image drop upload failed. Please try again or upload through Media first.')
      }
    }

    quill.root.addEventListener('paste', onPaste, true)
    quill.root.addEventListener('drop', onDrop, true)
    quill.__topheroesImageUploadHandlersApplied = true
  }

  function stripPasteColors(quill) {
    if (!quill || quill.__topheroesPasteColorFixApplied) return

    const Delta = window.Quill && typeof window.Quill.import === 'function'
      ? window.Quill.import('delta')
      : null

    if (!Delta || !quill.clipboard || typeof quill.clipboard.addMatcher !== 'function') {
      return
    }

    quill.clipboard.addMatcher(Node.ELEMENT_NODE, (_node, delta) => {
      if (!delta || !Array.isArray(delta.ops)) {
        return delta
      }

      return new Delta(
        delta.ops.flatMap((op) => {
          if (!op || !op.attributes) {
            return [op]
          }

          const nextAttributes = { ...op.attributes }
          delete nextAttributes.color
          delete nextAttributes.background

          if (Object.keys(nextAttributes).length === 0) {
            const { attributes, ...rest } = op
            return [rest]
          }

          return [{
            ...op,
            attributes: nextAttributes
          }]
        })
      )
    })

    quill.__topheroesPasteColorFixApplied = true
  }

  function applyQuillOverrides() {
    document.querySelectorAll('.quill-editor').forEach((editorEl) => {
      const quill = editorEl.quillInstance

      stripPasteColors(quill)
      attachImageUploadHandlers(quill)
    })
  }

  function scheduleQuillOverrides() {
    let attempts = 0

    const run = () => {
      applyQuillOverrides()
      attempts += 1

      if (attempts < 24) {
        window.setTimeout(run, 250)
      }
    }

    run()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleQuillOverrides, { once: true })
  } else {
    scheduleQuillOverrides()
  }

  document.body?.addEventListener?.('htmx:afterSwap', () => {
    window.setTimeout(applyQuillOverrides, 0)
  })

  document.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || form.id !== 'content-form') {
      return
    }

    applyQuillOverrides()
  }, true)
})()
</script>`
}

export function injectAdminRuntimeOverrides(html: string): string {
  if (!html.includes('</head>') || !html.includes('</body>')) {
    return html
  }

  let nextHtml = html.replace(QUILL_BULLET_FORMAT_PATTERN, (_match, quote) => {
    return `${quote}list${quote}, ${quote}indent${quote}`
  })

  nextHtml = nextHtml.replaceAll(INVALID_QUILL_FORMATS_SNIPPET, FIXED_QUILL_FORMATS_SNIPPET)
  nextHtml = nextHtml.replaceAll(BROKEN_AUTOSAVE_FETCH_SNIPPET, FIXED_AUTOSAVE_FETCH_SNIPPET)

  if (!nextHtml.includes(ADMIN_QUIll_OVERRIDE_STYLE_ID)) {
    nextHtml = nextHtml.replace('</head>', `${buildAdminQuillOverrideStyle()}</head>`)
  }

  if (!nextHtml.includes(ADMIN_QUILL_OVERRIDE_SCRIPT_ID)) {
    nextHtml = nextHtml.replace('</body>', `${buildAdminQuillOverrideScript()}</body>`)
  }

  return nextHtml
}
