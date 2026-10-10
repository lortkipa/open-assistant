import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from './types'

const api: DesktopApi = {
  request: (method, path, body) => ipcRenderer.invoke('api:request', method, path, body),
  googleSignIn: () => ipcRenderer.invoke('google:signIn'),
  googleCancel: () => ipcRenderer.invoke('google:cancel'),
}

contextBridge.exposeInMainWorld('api', api)
