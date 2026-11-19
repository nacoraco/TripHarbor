import { execSync } from 'node:child_process'
import { Client } from 'pg'
import { TEST_DATABASE_URL } from './test-env'

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL)
  const database = url.pathname.replace(/^\//, '')

  if (!/^[a-zA-Z0-9_]+$/.test(database)) {
    throw new Error('Test database name contains unsupported characters.')
  }

  const adminUrl = new URL(TEST_DATABASE_URL)
  adminUrl.pathname = '/postgres'
  adminUrl.search = ''

  const client = new Client({ connectionString: adminUrl.toString() })

  await client.connect()

  try {
    const exists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database]
    )

    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${database}"`)
    }
  } finally {
    await client.end()
  }

  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
    },
  })
}
