import 'dotenv/config'

const sourceUrl =
  process.env.DATABASE_URL ??
  'postgresql://tripharbor_user:tripharbor@localhost:5432/tripharbor?schema=public'

function toTestDatabaseUrl(value: string) {
  const url = new URL(value)
  const database = url.pathname.replace(/^\//, '')

  if (!database.endsWith('_test')) {
    url.pathname = `/${database}_test`
  }

  return url.toString()
}

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? toTestDatabaseUrl(sourceUrl)
export const TEST_JWT_SECRET =
  process.env.JWT_SECRET ?? 'tripharbor-test-jwt-secret-at-least-32-characters'
