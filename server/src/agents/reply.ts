import OpenAI from 'openai'
import type { EasyInputMessage, Response, ResponseInputContent } from 'openai/resources/responses/responses'
import type { ModelAttachment } from './attachments.ts'
import { MAX_TIMER_SECONDS, systemPrompt, type PromptContext } from './prompt.ts'
import { REPEATS, validLocal, type Repeat } from './reminders.ts'

export type TimerAction = {
  action: 'create' | 'start' | 'stop' | 'reset'
  timer: string | null
  label: string | null
  seconds: number | null
}
// `at` is the user's local time, 'YYYY-MM-DDTHH:MM'. A create carries the id the server gave the reminder.
export type ReminderAction = {
  action: 'create' | 'cancel'
  reminder: string | null
  at: string | null
  repeat: Repeat | null
  note: string | null
}
// 'event' is something that happened in the app, like a timer running out or a reminder coming due.
export type ChatMessage = {
  from: 'user' | 'agent' | 'event'
  text: string
  timers?: TimerAction[]
  reminders?: ReminderAction[]
  attachments?: ModelAttachment[]
}
export type Next = { message: string | null; more: boolean; timers: TimerAction[]; reminders: ReminderAction[] }

const MODEL = process.env.OPENAI_MODEL || 'gpt-6-luna'

let client: OpenAI | undefined
export const aiConfigured = () => !!process.env.OPENAI_API_KEY
export const openai = () => (client ??= new OpenAI())

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

// A user message with its attachments, each introduced by name so the agent can refer to it.
function userParts(m: ChatMessage): ResponseInputContent[] {
  const parts: ResponseInputContent[] = m.text ? [{ type: 'input_text', text: m.text }] : []
  for (const a of m.attachments ?? []) {
    if (a.kind === 'other') {
      parts.push({ type: 'input_text', text: `[Attached file: ${a.name} (${a.type || 'unknown type'}, ${kb(a.size)}). Its contents can't be read here, only its name.]` })
    } else if (a.kind === 'image') {
      parts.push({ type: 'input_text', text: `[Attached image: ${a.name}]` })
      parts.push({ type: 'input_image', file_id: a.fileId, detail: 'auto' })
    } else if (a.kind === 'pdf') {
      parts.push({ type: 'input_text', text: `[Attached PDF: ${a.name}]` })
      parts.push({ type: 'input_file', file_id: a.fileId })
    } else {
      parts.push({ type: 'input_text', text: `[Attached file: ${a.name}]\n\`\`\`\`\n${a.text}\n\`\`\`\`` })
    }
  }
  return parts
}

// The user often splits one thought across several texts. Sent as separate turns, the model
// answers only the last one, so a run of user messages goes in as a single turn.
// The agent's own texts stay separate, in the JSON shape it replies in: given plain text,
// it often doesn't recognize them as already sent and repeats itself.
// Events (a timer ran out, a reminder is due) come from the app, not the user, so they go in as developer turns.
function toInput(messages: ChatMessage[]): EasyInputMessage[] {
  const input: EasyInputMessage[] = []
  messages.forEach((m, i) => {
    const last = input.at(-1)
    if (m.from === 'user' && last?.role === 'user') (last.content as ResponseInputContent[]).push(...userParts(m))
    else if (m.from === 'user') input.push({ role: 'user', content: userParts(m) })
    else if (m.from === 'event') input.push({ role: 'developer', content: m.text })
    else {
      // Another agent message followed, or this is the one the loop is continuing from.
      const next = messages[i + 1]
      const more = !next || next.from === 'agent'
      const content = JSON.stringify({ message: m.text || null, more, timers: m.timers ?? [], reminders: m.reminders ?? [] })
      input.push({ role: 'assistant', content, phase: 'final_answer' })
    }
  })
  return input
}

// The model may also write commentary (progress notes) as separate output messages;
// `output_text` would glue those onto the JSON, so read only the final answer.
function parseFinal(response: Response): Next | null {
  const final = response.output.findLast((item) => item.type === 'message' && item.phase !== 'commentary')
  if (final?.type !== 'message') return null
  const text = final.content.map((c) => (c.type === 'output_text' ? c.text : '')).join('')
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed?.more !== 'boolean' || (parsed.message !== null && typeof parsed.message !== 'string')) return null
    if (!Array.isArray(parsed.timers) || !Array.isArray(parsed.reminders)) return null
    const message = parsed.message?.trim() || null
    const timers = parsed.timers.filter(validAction)
    const reminders = parsed.reminders.filter(validReminderAction)
    return { message, more: (message !== null || timers.length > 0 || reminders.length > 0) && parsed.more, timers, reminders }
  } catch {
    return null
  }
}

// Actions missing what they need are dropped rather than failing the whole reply.
function validAction(a: any): a is TimerAction {
  if (a?.action === 'create') {
    return typeof a.label === 'string' && !!a.label.trim() && Number.isInteger(a.seconds) && a.seconds >= 1 && a.seconds <= MAX_TIMER_SECONDS
  }
  return ['start', 'stop', 'reset'].includes(a?.action) && typeof a.timer === 'string'
}

function validReminderAction(a: any): a is ReminderAction {
  if (a?.action === 'create') {
    return typeof a.at === 'string' && validLocal(a.at) && REPEATS.includes(a.repeat) && typeof a.note === 'string' && !!a.note.trim()
  }
  return a?.action === 'cancel' && typeof a.reminder === 'string'
}

async function call(ctx: PromptContext, messages: ChatMessage[], signal: AbortSignal) {
  return openai().responses.create(
    {
      model: MODEL,
      instructions: systemPrompt(ctx),
      input: toInput(messages),
      tools: [{ type: 'web_search' }],
      reasoning: { effort: 'low' },
      text: {
        format: {
          type: 'json_schema',
          name: 'next_message',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              message: { type: ['string', 'null'] },
              more: { type: 'boolean' },
              timers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    action: { type: 'string', enum: ['create', 'start', 'stop', 'reset'] },
                    timer: { type: ['string', 'null'] },
                    label: { type: ['string', 'null'] },
                    seconds: { type: ['integer', 'null'] },
                  },
                  required: ['action', 'timer', 'label', 'seconds'],
                  additionalProperties: false,
                },
              },
              reminders: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    action: { type: 'string', enum: ['create', 'cancel'] },
                    reminder: { type: ['string', 'null'] },
                    at: { type: ['string', 'null'] },
                    repeat: { type: ['string', 'null'], enum: [...REPEATS, null] },
                    note: { type: ['string', 'null'] },
                  },
                  required: ['action', 'reminder', 'at', 'repeat', 'note'],
                  additionalProperties: false,
                },
              },
            },
            required: ['message', 'more', 'timers', 'reminders'],
            additionalProperties: false,
          },
        },
      },
      store: false,
    },
    { signal },
  )
}

// One call decides one message: what to send next (or nothing), and whether another follows.
// A reply that doesn't fit the schema gets one more try.
export async function nextMessage(ctx: PromptContext, messages: ChatMessage[], signal: AbortSignal): Promise<Next> {
  for (let attempt = 1; ; attempt++) {
    const response = await call(ctx, messages, signal)
    const next = parseFinal(response)
    if (next) return next
    console.error(`agent reply ${response.id} unreadable (attempt ${attempt}):`, JSON.stringify(response.output))
    if (attempt === 2) throw new Error('unreadable model reply')
  }
}
