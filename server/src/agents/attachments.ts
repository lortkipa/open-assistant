import { sql } from '../db.ts'
import { aiConfigured, openai } from './reply.ts'

// Files the user attaches to messages. They're stored in Postgres; the model gets images and PDFs
// through the OpenAI Files API (uploaded once, then referred to by id), text files inline, and
// anything else by name only.

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024
export const MAX_ATTACHMENTS = 20
// Larger text files would crowd out the chat; the agent is told it only has the name.
const MAX_INLINE_TEXT = 200 * 1024

// What the app gets for each attachment.
export type AttachmentMeta = { id: string; name: string; type: string; size: number }

// What the model gets.
export type ModelAttachment =
  | { kind: 'image'; name: string; fileId: string }
  | { kind: 'pdf'; name: string; fileId: string }
  | { kind: 'text'; name: string; text: string }
  | { kind: 'other'; name: string; type: string; size: number }

// The formats OpenAI reads as images.
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const TEXT_TYPES = /^text\/|^application\/(json|xml|javascript|x-sh|x-yaml|yaml|toml|sql|x-httpd-php)|\+(json|xml)$/
// Code and config often come without a useful type.
const TEXT_EXTENSIONS = new Set(
  'txt md markdown csv tsv json jsonc yaml yml toml ini cfg conf env xml html htm css scss less js jsx mjs cjs ts tsx mts cts py rb go rs java kt kts swift c h cc cpp hpp cs php sh bash zsh fish ps1 sql graphql proto lua r dart scala clj ex exs erl hs ml vue svelte astro tex log diff patch gitignore dockerfile makefile cmake gradle uproject uplugin'.split(' '),
)

const extension = (name: string) => (name.includes('.') ? name.split('.').pop()! : name).toLowerCase()

function kindOf(a: AttachmentMeta): ModelAttachment['kind'] {
  if (IMAGE_TYPES.includes(a.type)) return 'image'
  if (a.type === 'application/pdf' || extension(a.name) === 'pdf') return 'pdf'
  if (a.size <= MAX_INLINE_TEXT && (TEXT_TYPES.test(a.type) || TEXT_EXTENSIONS.has(extension(a.name)))) return 'text'
  return 'other'
}

const decoder = new TextDecoder('utf-8', { fatal: true })

type Row = AttachmentMeta & { openaiFileId: string | null; data: Buffer | null }

// Everything the model needs for these attachments, uploading images and PDFs to OpenAI the first
// time they're sent. Bytes are only loaded for what still has to be uploaded or inlined.
export async function forModel(attachments: AttachmentMeta[], signal: AbortSignal): Promise<Map<string, ModelAttachment>> {
  const result = new Map<string, ModelAttachment>()
  if (!attachments.length) return result
  const kinds = new Map(attachments.map((a) => [a.id, kindOf(a)]))
  const needData = attachments.filter((a) => kinds.get(a.id) !== 'other').map((a) => a.id)
  const rows = await sql<Row[]>`
    select id, name, type, size, openai_file_id,
      case when id = any(${needData}::uuid[]) and (openai_file_id is null) then data end as data
    from attachments where id = any(${attachments.map((a) => a.id)}::uuid[])`
  await Promise.all(
    rows.map(async (row) => {
      const kind = kinds.get(row.id)!
      const other = { kind: 'other' as const, name: row.name, type: row.type, size: row.size }
      if (kind === 'text') {
        try {
          result.set(row.id, { kind, name: row.name, text: decoder.decode(row.data!) })
        } catch {
          result.set(row.id, other)
        }
      } else if (kind === 'image' || kind === 'pdf') {
        let fileId = row.openaiFileId
        if (!fileId) {
          const file = new File([new Uint8Array(row.data!)], row.name, { type: row.type })
          const uploaded = await openai().files.create({ file, purpose: kind === 'image' ? 'vision' : 'user_data' }, { signal })
          fileId = uploaded.id
          await sql`update attachments set openai_file_id = ${fileId} where id = ${row.id}`
        }
        result.set(row.id, { kind, name: row.name, fileId })
      } else {
        result.set(row.id, other)
      }
    }),
  )
  return result
}

// The OpenAI copies of deleted attachments. Best effort: a failure only leaves a file on OpenAI.
export function deleteOpenAiFiles(fileIds: string[]) {
  if (!aiConfigured()) return
  for (const id of fileIds) {
    openai()
      .files.delete(id)
      .catch((err) => console.error(`deleting OpenAI file ${id} failed`, err?.message ?? err))
  }
}

// Uploads that never made it into a message (removed from the composer, or the app closed).
// Never sent, so they have no OpenAI copy.
async function sweep() {
  const swept = await sql`delete from attachments where message_id is null and created_at < now() - interval '1 day'`
  if (swept.count) console.log(`swept ${swept.count} unsent attachments`)
}

export function startSweeping() {
  const run = () => sweep().catch((err) => console.error('sweeping attachments failed', err))
  run()
  setInterval(run, 60 * 60 * 1000).unref()
}
