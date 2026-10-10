import { app, Menu, nativeTheme, session, type MenuItemConstructorOptions, type WebContents } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The signed-in user's preferences, as far as the main process needs them. The account keeps them;
// the app sends them here whenever they change, and system theme, English and spell check on while signed out.
export type Preferences = { theme: 'system' | 'light' | 'dark'; spellcheck: boolean; language: 'en' | 'ka' }

// The last theme, so the next start opens in it instead of flashing the system one while the account loads.
const file = () => join(app.getPath('userData'), 'preferences.json')

let language: Preferences['language'] = 'en'

const LABELS = {
  en: {
    addToDictionary: 'Add to dictionary',
    noSuggestions: 'No suggestions',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select all',
  },
  ka: {
    addToDictionary: 'ლექსიკონში დამატება',
    noSuggestions: 'შემოთავაზებები არ არის',
    cut: 'ამოჭრა',
    copy: 'კოპირება',
    paste: 'ჩასმა',
    selectAll: 'ყველაფრის მონიშვნა',
  },
}

const isTheme = (theme: unknown): theme is Preferences['theme'] => theme === 'system' || theme === 'light' || theme === 'dark'

// Before the window opens.
export function loadPreferences() {
  try {
    const { theme } = JSON.parse(readFileSync(file(), 'utf8'))
    if (isTheme(theme)) nativeTheme.themeSource = theme
  } catch {
    // First start, or unreadable: follow the system.
  }
  // macOS checks spelling with the system's own languages.
  if (process.platform !== 'darwin') session.defaultSession.setSpellCheckerLanguages(['en-US'])
}

export function setPreferences(prefs: Preferences) {
  if (isTheme(prefs.theme) && nativeTheme.themeSource !== prefs.theme) {
    nativeTheme.themeSource = prefs.theme
    try {
      writeFileSync(file(), JSON.stringify({ theme: prefs.theme }))
    } catch (err) {
      console.error('saving preferences:', err)
    }
  }
  session.defaultSession.setSpellCheckerEnabled(prefs.spellcheck !== false)
  language = prefs.language === 'ka' ? 'ka' : 'en'
}

export const backgroundColor = () => (nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff')

// Electron shows no right-click menu of its own: this one offers spelling fixes and the usual edit actions.
export function attachContextMenu(contents: WebContents) {
  contents.on('context-menu', (_e, params) => {
    const labels = LABELS[language]
    const items: MenuItemConstructorOptions[] = []
    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length) {
        for (const suggestion of params.dictionarySuggestions) {
          items.push({ label: suggestion, click: () => contents.replaceMisspelling(suggestion) })
        }
      } else items.push({ label: labels.noSuggestions, enabled: false })
      items.push(
        {
          label: labels.addToDictionary,
          click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
        },
        { type: 'separator' },
      )
    }
    const { editFlags } = params
    if (params.isEditable) {
      items.push(
        { label: labels.cut, role: 'cut', enabled: editFlags.canCut },
        { label: labels.copy, role: 'copy', enabled: editFlags.canCopy },
        { label: labels.paste, role: 'paste', enabled: editFlags.canPaste },
        { type: 'separator' },
        { label: labels.selectAll, role: 'selectAll', enabled: editFlags.canSelectAll },
      )
    } else if (params.selectionText.trim()) {
      items.push({ label: labels.copy, role: 'copy', enabled: editFlags.canCopy })
    }
    if (items.length) Menu.buildFromTemplate(items).popup()
  })
}
