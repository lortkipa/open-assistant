export type ApiResult<T = any> = { status: number; data: T }

export type DesktopApi = {
  request: <T = any>(method: string, path: string, body?: unknown) => Promise<ApiResult<T>>
  // Uploads one attached file; data.attachment is { id, name, type, size }.
  upload: (name: string, type: string, bytes: ArrayBuffer) => Promise<ApiResult>
  // Replaces the profile photo; data.user is the updated user.
  uploadAvatar: (type: string, bytes: ArrayBuffer) => Promise<ApiResult>
  readAttachment: (id: string) => Promise<ArrayBuffer | null>
  // Opens a document in the app the system uses for it. False if it couldn't.
  openAttachment: (id: string, name: string) => Promise<boolean>
  // Live updates from the server until the returned function is called. Each (re)connect
  // first sends { type: 'open' }, after which anything missed should be reloaded.
  listen: (onEvent: (event: any) => void) => () => void
  googleSignIn: () => Promise<ApiResult>
  googleCancel: () => Promise<void>
  focus: () => Promise<void>
  // Theme, spell check and the language of the right-click menu.
  setPreferences: (prefs: {
    theme: 'system' | 'light' | 'dark'
    spellcheck: boolean
    language: 'en' | 'ka'
  }) => Promise<void>
}
