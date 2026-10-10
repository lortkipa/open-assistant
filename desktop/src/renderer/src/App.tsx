import { useEffect, useState } from 'react'
import { api, type User } from './api'
import { Login } from './screens/Login'
import { Verify } from './screens/Verify'
import { Name } from './screens/Name'
import { Home } from './screens/Home'
import { I18nProvider } from './i18n'

type Screen =
  | { name: 'loading' }
  | { name: 'login'; email?: string }
  | { name: 'verify'; email: string }
  | { name: 'name'; user: User; suggested?: string | null }
  | { name: 'home'; user: User }

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' })

  const signedIn = (user: User, suggested?: string | null) =>
    setScreen(user.name ? { name: 'home', user } : { name: 'name', user, suggested })

  useEffect(() => {
    api.request('GET', '/me').then(({ status, data }) => {
      if (status === 200) signedIn(data.user)
      else setScreen({ name: 'login' })
    })
  }, [])

  const signOut = () => setScreen({ name: 'login' })

  // Settings belong to the account, so until the main screen they're the defaults.
  const user = screen.name === 'home' ? screen.user : null
  const theme = user?.theme ?? 'system'
  const language = user?.language ?? 'en'
  const spellcheck = user?.spellcheck ?? true

  // While loading, the main process keeps the last theme it saw (no flash before the account arrives).
  const loading = screen.name === 'loading'
  useEffect(() => {
    if (!loading) api.setPreferences({ theme, language, spellcheck })
  }, [loading, theme, language, spellcheck])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return <I18nProvider language={language}>{screenFor()}</I18nProvider>

  function screenFor() {
    switch (screen.name) {
      case 'loading':
        return <div className="screen" />
      case 'login':
        return (
          <Login
            initialEmail={screen.email}
            onCodeSent={(email) => setScreen({ name: 'verify', email })}
            onSignedIn={signedIn}
          />
        )
      case 'verify':
        return (
          <Verify
            email={screen.email}
            onBack={() => setScreen({ name: 'login', email: screen.email })}
            onSignedIn={signedIn}
          />
        )
      case 'name':
        return (
          <Name
            suggested={screen.suggested}
            onDone={(user) => setScreen({ name: 'home', user })}
            onSignedOut={signOut}
          />
        )
      case 'home':
        return <Home user={screen.user} onUserChange={(user) => setScreen({ name: 'home', user })} onSignedOut={signOut} />
    }
  }
}
