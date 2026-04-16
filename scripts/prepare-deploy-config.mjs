import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const targetEnv = process.argv[2]

if (!targetEnv) {
  throw new Error('Missing target environment. Use: node scripts/prepare-deploy-config.mjs <production|server774>')
}

const deployTargets = {
  production: {
    name: 'sonicjs-app',
    vars: { ENVIRONMENT: 'production' },
    routes: [{ pattern: 'topheroes.cwcat.com', custom_domain: true }],
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'sonicjs-db',
        database_id: 'afd7dca7-7ba2-496a-b1ce-e15ee0cfc9a3',
        migrations_dir: './node_modules/@sonicjs-cms/core/migrations'
      }
    ],
    r2_buckets: [
      {
        binding: 'MEDIA_BUCKET',
        bucket_name: 'sonicjs-media'
      }
    ]
  },
  server774: {
    name: '774topheroes',
    vars: { ENVIRONMENT: 'server774' },
    routes: [{ pattern: '774.cwcat.com', custom_domain: true }],
    d1_databases: [
      {
        binding: 'DB',
        database_name: '774',
        database_id: 'd6967cf4-6c6e-4e73-8f87-98b6f1a68c2f',
        migrations_dir: './node_modules/@sonicjs-cms/core/migrations'
      }
    ],
    r2_buckets: [
      {
        binding: 'MEDIA_BUCKET',
        bucket_name: '774bucket'
      }
    ]
  }
}

const overrides = deployTargets[targetEnv]

if (!overrides) {
  throw new Error(`Unsupported target environment: ${targetEnv}`)
}

const configPath = resolve('dist/server/wrangler.json')
const config = JSON.parse(readFileSync(configPath, 'utf8'))

config.name = overrides.name
config.vars = overrides.vars
config.routes = overrides.routes
config.d1_databases = overrides.d1_databases
config.r2_buckets = overrides.r2_buckets

writeFileSync(configPath, `${JSON.stringify(config)}\n`)
