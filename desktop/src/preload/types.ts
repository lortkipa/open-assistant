export type ApiResult<T = any> = { status: number; data: T }

export type DesktopApi = {
  // Pass a requestId to be able to cancel the request with abort(); it then resolves with error 'aborted'.
  request: <T = any>(method: string, path: string, body?: unknown, requestId?: string) => Promise<ApiResult<T>>
  abort: (requestId: string) => Promise<void>
  googleSignIn: () => Promise<ApiResult>
  googleCancel: () => Promise<void>
  focus: () => Promise<void>
}
