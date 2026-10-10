export type ApiResult<T = any> = { status: number; data: T }

export type DesktopApi = {
  request: <T = any>(method: string, path: string, body?: unknown) => Promise<ApiResult<T>>
  // Live updates from the server until the returned function is called. Each (re)connect
  // first sends { type: 'open' }, after which anything missed should be reloaded.
  listen: (onEvent: (event: any) => void) => () => void
  googleSignIn: () => Promise<ApiResult>
  googleCancel: () => Promise<void>
  focus: () => Promise<void>
}
