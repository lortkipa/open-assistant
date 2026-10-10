import OpenAI from 'openai'
import type { EasyInputMessage, Response } from 'openai/resources/responses/responses'
import { systemPrompt, type PromptContext } from './prompt.ts'

export type TimerAction = {
  action: 'create' | 'start' | 'stop' | 'reset'
  timer: string | null
  label: string | null
  seconds: number | null
}
// 'event' is something that happened in the app, like a timer running out.
export type ChatMessage = { from: 'user' | 'agent' | 'event'; text: string; timers?: TimerAction[] }
export type Next = { message: string | null; more: boolean; timers: TimerAction[] }

export const MAX_TIMER_SECONDS = 24 * 60 * 60

const MODEL = process.env.OPENAI_MODEL || 'gpt-6-luna'

let client: OpenAI | undefined
export const aiConfigured = () => !!process.env.OPENAI_API_KEY

// The user often splits one thought across several texts. Sent as separate turns, the model
// answers only the last one, so a run of user messages goes in as a single turn.
// The agent's own texts stay separate, in the JSON shape it replies in: given plain text,
// it often doesn't recognize them as already sent and repeats itself.
// Events (a timer ran out) come from the app, not the user, so they go in as developer turns.
function toInput(messages: ChatMessage[]): EasyInputMessage[] {
  const input: (EasyInputMessage & { content: string })[] = []
  messages.forEach((m, i) => {
    const last = input.at(-1)
    if (m.from === 'user' && last?.role === 'user') last.content += `\n${m.text}`
    else if (m.from === 'user') input.push({ role: 'user', content: m.text })
    else if (m.from === 'event') input.push({ role: 'developer', content: m.text })
    else {
      // Another agent message followed, or this is the one the loop is continuing from.
      const next = messages[i + 1]
      const more = !next || next.from === 'agent'
      const content = JSON.stringify({ message: m.text || null, more, timers: m.timers ?? [] })
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
    if (!Array.isArray(parsed.timers)) return null
    const message = parsed.message?.trim() || null
    const timers = parsed.timers.filter(validAction)
    return { message, more: (message !== null || timers.length > 0) && parsed.more, timers }
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

async function call(ctx: PromptContext, messages: ChatMessage[], signal: AbortSignal) {
  client ??= new OpenAI()
  return client.responses.create(
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
            },
            required: ['message', 'more', 'timers'],
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
