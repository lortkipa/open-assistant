import { useEffect, useState } from 'react'
import { api, type User } from './api'
import { Login } from './screens/Login'
import { Verify } from './screens/Verify'
import { Name } from './screens/Name'
import { Home } from './screens/Home'

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
      return <Home user={screen.user} onSignedOut={signOut} />
  }
}
