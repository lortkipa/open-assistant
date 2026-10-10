import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from './types'

const api: DesktopApi = {
  request: (method, path, body, requestId) => ipcRenderer.invoke('api:request', method, path, body, requestId),
  abort: (requestId) => ipcRenderer.invoke('api:abort', requestId),
  googleSignIn: () => ipcRenderer.invoke('google:signIn'),
  googleCancel: () => ipcRenderer.invoke('google:cancel'),
  focus: () => ipcRenderer.invoke('app:focus'),
}

contextBridge.exposeInMainWorld('api', api)
