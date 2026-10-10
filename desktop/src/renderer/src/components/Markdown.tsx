import { createContext, memo, useContext, useEffect, useRef, useState, type ComponentProps } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { CheckIcon, CopyIcon } from './icons'

// Single "$" stays plain text so prices like "$5 or $10" aren't read as math; math goes in "$$…$$".
const remarkPlugins = [remarkGfm, [remarkMath, { singleDollarTextMath: false }]] satisfies ComponentProps<
  typeof ReactMarkdown
>['remarkPlugins']
// Code blocks without a language tag get one guessed, only among popular languages: guessing across all
// of them mislabels plain snippets (SQL comes out as VB.NET).
const detectable = [
  'bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'java', 'javascript', 'json',
  'kotlin', 'php', 'python', 'ruby', 'rust', 'sql', 'swift', 'typescript', 'xml', 'yaml',
]
const rehypePlugins = [rehypeKatex, [rehypeHighlight, { detect: true, subset: detectable }]] satisfies ComponentProps<
  typeof ReactMarkdown
>['rehypePlugins']

function CodeBlock({ node, children }: ComponentProps<'pre'> & { node?: { children: unknown[] } }) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  // rehype-highlight leaves the language as a "language-…" class on the inner <code>.
  const code = node?.children[0] as { properties?: { className?: string[] } } | undefined
  const language = code?.properties?.className
    ?.find((name) => name.startsWith('language-'))
    ?.slice('language-'.length)

  const copy = async () => {
    await navigator.clipboard.writeText(preRef.current?.textContent ?? '')
    setCopied(true)
  }

  return (
    <div className="md-code">
      <div className="md-code-header">
        <span>{language ?? 'text'}</span>
        <button className="md-code-copy" onClick={copy}>
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre ref={preRef}>{children}</pre>
    </div>
  )
}

// The message being rendered, so a checkbox can rewrite its own "[ ]" / "[x]" in the text.
const Source = createContext<{ text: string; edit: (text: string) => void } | null>(null)
// Where the current list item starts in the text.
const ItemOffset = createContext<number | undefined>(undefined)

function TaskCheckbox({ checked }: { checked?: boolean }) {
  const source = useContext(Source)
  const offset = useContext(ItemOffset)

  const toggle = () => {
    if (!source || offset === undefined) return
    const marker = /\[[ xX]\]/.exec(source.text.slice(offset))
    if (!marker) return
    const at = offset + marker.index + 1
    source.edit(source.text.slice(0, at) + (checked ? ' ' : 'x') + source.text.slice(at + 1))
  }

  return <input type="checkbox" checked={!!checked} disabled={!source} onChange={toggle} />
}

const components: Components = {
  pre: CodeBlock,
  li: ({ node, ...props }) => (
    <ItemOffset.Provider value={node?.position?.start.offset}>
      <li {...props} />
    </ItemOffset.Provider>
  ),
  input: ({ node: _, ...props }) =>
    props.type === 'checkbox' ? <TaskCheckbox checked={props.checked} /> : <input {...props} />,
  // The main process opens https links in the default browser.
  a: ({ node: _, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
  // Wide tables scroll sideways instead of stretching the chat.
  table: ({ node: _, ...props }) => (
    <div className="md-table">
      <table {...props} />
    </div>
  ),
}

// Renders an agent message. Raw HTML in the text shows as text, never as markup.
// Ticking a task-list checkbox rewrites the message text through onEdit, so the agent sees it too.
type Props = { text: string; id?: string; onEdit?: (id: string, text: string) => void }

export const Markdown = memo(function Markdown({ text, id = '', onEdit }: Props) {
  const source = onEdit ? { text, edit: (next: string) => onEdit(id, next) } : null
  return (
    <div className="md">
      <Source.Provider value={source}>
        <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
          {text}
        </ReactMarkdown>
      </Source.Provider>
    </div>
  )
})
