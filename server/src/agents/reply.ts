import OpenAI from 'openai'
import type { EasyInputMessage, Response } from 'openai/resources/responses/responses'
import { systemPrompt, type PromptContext } from './prompt.ts'

export type ChatMessage = { from: 'user' | 'agent'; text: string }
export type Next = { message: string | null; more: boolean }

const MODEL = process.env.OPENAI_MODEL || 'gpt-6-luna'

let client: OpenAI | undefined
export const aiConfigured = () => !!process.env.OPENAI_API_KEY

// The user often splits one thought across several texts. Sent as separate turns, the model
// answers only the last one, so a run of user messages goes in as a single turn.
// The agent's own texts stay separate, in the JSON shape it replies in: given plain text,
// it often doesn't recognize them as already sent and repeats itself.
function toInput(messages: ChatMessage[]): EasyInputMessage[] {
  const input: (EasyInputMessage & { content: string })[] = []
  messages.forEach((m, i) => {
    const last = input.at(-1)
    if (m.from === 'user' && last?.role === 'user') last.content += `\n${m.text}`
    else if (m.from === 'user') input.push({ role: 'user', content: m.text })
    else {
      // Another agent message followed, or this is the one the loop is continuing from.
      const more = messages[i + 1]?.from !== 'user'
      input.push({ role: 'assistant', content: JSON.stringify({ message: m.text, more }), phase: 'final_answer' })
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
    const message = parsed.message?.trim() || null
    return { message, more: message !== null && parsed.more }
  } catch {
    return null
  }
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
            },
            required: ['message', 'more'],
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
