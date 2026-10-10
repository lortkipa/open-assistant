import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { DesktopApi } from './types'

const api: DesktopApi = {
  request: (method, path, body) => ipcRenderer.invoke('api:request', method, path, body),
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
}

contextBridge.exposeInMainWorld('api', api)
