const TINYMCE_PLUGIN_ID = 'tinymce-plugin'

type TinyMcePluginRow = {
  settings: string | null
}

type TinyMceSettings = {
  apiKey?: string
  defaultHeight?: number
  defaultToolbar?: string
  skin?: string
  [key: string]: unknown
}

function isMissingPluginsTable(error: unknown): boolean {
  return error instanceof Error && error.message.includes('no such table: plugins')
}

export function mergeTinyMceSettings(settingsJson: string | null, apiKey: string): string {
  const parsedSettings = settingsJson ? (JSON.parse(settingsJson) as TinyMceSettings) : {}

  if (parsedSettings.apiKey === apiKey) {
    return JSON.stringify(parsedSettings)
  }

  return JSON.stringify({
    ...parsedSettings,
    apiKey
  })
}

export async function syncTinyMceApiKey(db: D1Database, apiKey: string | undefined): Promise<void> {
  if (!apiKey?.trim()) {
    return
  }

  try {
    const plugin = await db
      .prepare('SELECT settings FROM plugins WHERE id = ? LIMIT 1')
      .bind(TINYMCE_PLUGIN_ID)
      .first<TinyMcePluginRow>()

    if (!plugin) {
      return
    }

    const nextSettings = mergeTinyMceSettings(plugin.settings, apiKey)

    if (plugin.settings === nextSettings) {
      return
    }

    await db
      .prepare('UPDATE plugins SET settings = ?, last_updated = unixepoch() WHERE id = ?')
      .bind(nextSettings, TINYMCE_PLUGIN_ID)
      .run()
  } catch (error) {
    if (!isMissingPluginsTable(error)) {
      throw error
    }
  }
}
