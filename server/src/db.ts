import postgres, { type Sql, type TransactionSql } from 'postgres'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

export const sql = postgres(process.env.DATABASE_URL, {
  onnotice: () => {},
  transform: postgres.camel,
})

export type User = {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  // Settings → General.
  theme: 'system' | 'light' | 'dark'
  accent: 'bot' | 'neutral'
  language: 'en' | 'ka'
  spellcheck: boolean
}

// Either the pool or a transaction.
export type Db = Sql | TransactionSql
