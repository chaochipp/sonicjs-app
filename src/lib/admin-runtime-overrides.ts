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

  async function insertUploadedImage(quill, file) {
    const range = quill.getSelection(true)
    const imageUrl = await uploadImageFile(file)
    const insertIndex = range ? range.index : quill.getLength()

    quill.insertEmbed(insertIndex, 'image', imageUrl, 'user')
    quill.setSelection(insertIndex + 1, 0, 'silent')
  }

  async function handleImageFiles(quill, files) {
    for (const file of files) {
      await insertUploadedImage(quill, file)
    }
  }

  function extractImageFilesFromClipboard(event) {
    const items = Array.from(event.clipboardData?.items || [])
    const files = items
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean)

    if (files.length > 0) {
      return files
    }

    const html = event.clipboardData?.getData('text/html') || ''
    if (!html || html.indexOf('data:image/') === -1) {
      return []
    }

    const matches = Array.from(html.matchAll(/<img[^>]+src=(['"])(data:image\\/[^'"]+)\\1/gi))
    return matches
      .map((match, index) => dataUrlToFile(match[2], 'pasted-image-' + (index + 1)))
      .filter(Boolean)
  }

  function extractImageFilesFromDrop(event) {
    return Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith('image/'))
  }

  function attachImageUploadHandlers(quill) {
    if (!quill || quill.__topheroesImageUploadHandlersApplied || !quill.root) return

    const onPaste = async (event) => {
      const files = extractImageFilesFromClipboard(event)
      if (files.length === 0) {
        return
      }

      event.preventDefault()

      try {
        await handleImageFiles(quill, files)
      } catch (error) {
        console.error('TopHeroes image paste upload failed:', error)
        notifyUploadIssue('Image paste upload failed. Please try again or upload through Media first.')
      }
    }

    const onDrop = async (event) => {
      const files = extractImageFilesFromDrop(event)
      if (files.length === 0) {
        return
      }

      event.preventDefault()

      try {
        await handleImageFiles(quill, files)
      } catch (error) {
        console.error('TopHeroes image drop upload failed:', error)
        notifyUploadIssue('Image drop upload failed. Please try again or upload through Media first.')
      }
    }

    quill.root.addEventListener('paste', onPaste)
    quill.root.addEventListener('drop', onDrop)
    quill.__topheroesImageUploadHandlersApplied = true
  }

  function stripBase64ImagesFromHtml(html) {
    if (typeof html !== 'string' || html.indexOf('data:image/') === -1) {
      return { html, removed: false }
    }

    let removed = false
    const nextHtml = html.replace(/<img[^>]+src=(['"])data:image\\/[^'"]+\\1[^>]*>/gi, () => {
      removed = true
      return ''
    })

    return { html: nextHtml, removed }
  }

  function sanitizeEditorHtml(quill, hiddenInput) {
    if (!quill || !quill.root) return false

    const currentHtml = quill.root.innerHTML || ''
    const result = stripBase64ImagesFromHtml(currentHtml)

    if (!result.removed) {
      if (hiddenInput) {
        hiddenInput.value = currentHtml
      }
      return false
    }

    quill.root.innerHTML = result.html
    if (hiddenInput) {
      hiddenInput.value = result.html
    }
    return true
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
          if (op && op.insert && typeof op.insert === 'object' && typeof op.insert.image === 'string' && op.insert.image.startsWith('data:image/')) {
            return []
          }

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
      const fieldId = editorEl.id ? editorEl.id.replace(/^editor-/, '') : ''
      const hiddenInput = fieldId ? document.getElementById(fieldId) : null

      stripPasteColors(quill)
      attachImageUploadHandlers(quill)
      sanitizeEditorHtml(quill, hiddenInput)
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
