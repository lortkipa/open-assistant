import { join, resolve } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { request } from './api'
import { cancelGoogle, googleAuthorize } from './google'

const PROTOCOL = 'openassistant'

// For automated tests: render without ever showing a window (drive it over --remote-debugging-port).
const offscreen = process.env.OA_OFFSCREEN === '1'

// One running app: opening an openassistant:// link starts a second process on Windows and Linux,
// which hands its arguments to this one through 'second-instance' and exits.
if (!app.requestSingleInstanceLock()) app.exit(0)

let mainWindow: BrowserWindow | null = null

function registerProtocol() {
  if (app.isPackaged) app.setAsDefaultProtocolClient(PROTOCOL)
  // Dev on Windows: point the scheme at this electron binary and entry script.
  else if (process.platform === 'win32') app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolve(process.argv[1])])
  // Dev on Linux needs a .desktop file, which only installed builds have; macOS dev uses the Electron.app bundle.
}

// Bring the app to the front. Desktops may still refuse (focus-stealing prevention), which is
// why the browser also hands off through the deep link.
function focusWindow() {
  const win = mainWindow
  if (!win || win.isDestroyed() || offscreen) return
  if (win.isMinimized()) win.restore()
  win.show()
  if (process.platform === 'win32') {
    win.setAlwaysOnTop(true)
    win.setAlwaysOnTop(false)
  }
  win.focus()
  if (process.platform === 'darwin') app.focus({ steal: true })
}

const isDeepLink = (arg: string) => arg.startsWith(`${PROTOCOL}://`)

// The link carries no data (the sign-in code arrives over loopback), so all it does is focus the app.
// Relaunching the app (with or without a link) just focuses the running window.
app.on('second-instance', () => focusWindow())
app.on('open-url', (e, url) => {
  e.preventDefault()
  if (isDeepLink(url)) focusWindow()
})

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    show: false,
    title: 'Open Assistant',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      offscreen,
    },
  })
  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  if (!offscreen) win.once('ready-to-show', () => win.show())
  // Links never navigate the app window; they open in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

// Requests the renderer may cancel (an agent reply the user interrupted), by the id it picked.
const inFlight = new Map<string, AbortController>()

ipcMain.handle('api:request', async (_e, method: string, path: string, body?: unknown, requestId?: string) => {
  if (!requestId) return request(method, path, body)
  const controller = new AbortController()
  inFlight.set(requestId, controller)
  try {
    return await request(method, path, body, controller.signal)
  } finally {
    inFlight.delete(requestId)
  }
})

ipcMain.handle('api:abort', (_e, requestId: string) => inFlight.get(requestId)?.abort())

ipcMain.handle('google:signIn', async () => {
  const client = await request('GET', '/auth/google/client')
  if (client.status !== 200) {
    console.error('google sign-in: fetching client id failed', client)
    return client
  }
  try {
    const deepLink = app.isDefaultProtocolClient(PROTOCOL)
    const grant = await googleAuthorize(client.data.clientId, deepLink)
    focusWindow()
    const result = await request('POST', '/auth/google', grant)
    if (result.status !== 200) console.error('google sign-in: server rejected the code', result)
    return result
  } catch (err) {
    const reason = (err as Error).message
    console.error('google sign-in:', reason)
    return { status: 0, data: { error: reason === 'cancelled' ? 'cancelled' : 'google_failed' } }
  }
})

ipcMain.handle('google:cancel', () => cancelGoogle())

// Clicking a notification (a timer ran out) brings the app forward.
ipcMain.handle('app:focus', () => focusWindow())

app.whenReady().then(() => {
  registerProtocol()
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
