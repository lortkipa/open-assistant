import { OAuth2Client } from 'google-auth-library'

export type GoogleProfile = {
  sub: string
  email: string
  name: string | null
  picture: string | null
}

// Exchanges an authorization code from the desktop app's loopback flow for a verified profile.
// The client secret never leaves the server.
export async function exchangeGoogleCode(code: string, codeVerifier: string, redirectUri: string): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set')
  const client = new OAuth2Client({ clientId, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri })
  const { tokens } = await client.getToken({ code, codeVerifier })
  if (!tokens.id_token) throw new Error('Google returned no id_token')
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId })
  const p = ticket.getPayload()
  if (!p?.sub || !p.email || !p.email_verified) throw new Error('Google account has no verified email')
  return { sub: p.sub, email: p.email, name: p.name ?? null, picture: p.picture ?? null }
}
