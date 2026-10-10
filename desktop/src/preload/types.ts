export type ApiResult<T = any> = { status: number; data: T }

export type DesktopApi = {
  request: <T = any>(method: string, path: string, body?: unknown) => Promise<ApiResult<T>>
  googleSignIn: () => Promise<ApiResult>
  googleCancel: () => Promise<void>
}
