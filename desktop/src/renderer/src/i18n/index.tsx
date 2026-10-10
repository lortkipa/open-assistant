import { createContext, Fragment, useCallback, useContext, type ReactNode } from 'react'
import { en } from './en'
import { ka } from './ka'

// The app's text in English and Georgian. Signed out it's always English: the language is an account setting.

export type Language = 'en' | 'ka'
export type Key = keyof typeof en
type Vars = Record<string, string | number>

const dictionaries: Record<Language, Record<Key, string>> = { en, ka }

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text

const translate = (language: Language, key: Key, vars?: Vars) => fill(dictionaries[language][key], vars)

// For code outside components (error messages, notifications). Components use useT(), which
// re-renders them (memoized ones too) when the language changes.
let current: Language = 'en'
export const t = (key: Key, vars?: Vars) => translate(current, key, vars)

const LanguageContext = createContext<Language>('en')

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
  current = language
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>
}

export function useT() {
  const language = useContext(LanguageContext)
  return useCallback((key: Key, vars?: Vars) => translate(language, key, vars), [language])
}

// Text with elements in its placeholders, e.g. rich(t('agent.deleteBody'), { name: <strong>…</strong> }).
export function rich(text: string, parts: Record<string, ReactNode>): ReactNode {
  return text.split(/\{(\w+)\}/).map((piece, i) => <Fragment key={i}>{i % 2 ? (parts[piece] ?? `{${piece}}`) : piece}</Fragment>)
}
