import { readdir, readFile } from 'node:fs/promises'
import { sql } from './db.ts'

const dir = new URL('../migrations/', import.meta.url)

// Applies every migrations/*.sql file that hasn't run yet, in name order.
export async function migrate() {
  await sql`create table if not exists migrations (name text primary key, applied_at timestamptz not null default now())`
  const applied = new Set((await sql<{ name: string }[]>`select name from migrations`).map((r) => r.name))
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    if (applied.has(file)) continue
    const body = await readFile(new URL(file, dir), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(body)
      await tx`insert into migrations (name) values (${file})`
    })
    console.log(`migrated ${file}`)
  }
}
