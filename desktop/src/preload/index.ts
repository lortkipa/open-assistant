import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from './types'

const api: DesktopApi = {
  request: (method, path, body, requestId) => ipcRenderer.invoke('api:request', method, path, body, requestId),
  abort: (requestId) => ipcRenderer.invoke('api:abort', requestId),
  googleSignIn: () => ipcRenderer.invoke('google:signIn'),
  googleCancel: () => ipcRenderer.invoke('google:cancel'),
}

contextBridge.exposeInMainWorld('api', api)
