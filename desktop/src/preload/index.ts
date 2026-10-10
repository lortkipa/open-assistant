import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { DesktopApi } from './types'

const api: DesktopApi = {
  request: (method, path, body) => ipcRenderer.invoke('api:request', method, path, body),
  upload: (name, type, bytes) => ipcRenderer.invoke('api:upload', name, type, bytes),
  uploadAvatar: (type, bytes) => ipcRenderer.invoke('api:uploadAvatar', type, bytes),
  readAttachment: (id) => ipcRenderer.invoke('attachment:read', id),
  openAttachment: (id, name) => ipcRenderer.invoke('attachment:open', id, name),
  listen: (onEvent) => {
    const listener = (_e: IpcRendererEvent, event: any) => onEvent(event)
    ipcRenderer.on('api:event', listener)
    ipcRenderer.invoke('events:start')
    return () => {
      ipcRenderer.invoke('events:stop')
      ipcRenderer.removeListener('api:event', listener)
    }
  },
  googleSignIn: () => ipcRenderer.invoke('google:signIn'),
  googleCancel: () => ipcRenderer.invoke('google:cancel'),
  focus: () => ipcRenderer.invoke('app:focus'),
  setPreferences: (prefs) => ipcRenderer.invoke('app:preferences', prefs),
}

contextBridge.exposeInMainWorld('api', api)
