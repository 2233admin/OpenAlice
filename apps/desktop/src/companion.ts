import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from 'electron'
import { readFileSync } from 'node:fs'
import { writeFile, rename } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { settleCompanion, snapEase, type Rect } from './companion-geometry.js'

/**
 * One presentation window belonging to the existing desktop process.
 * Thanks to MeteorNOX's DeepSeek Balance Whale Widget for the interaction model:
 * https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget
 * Press/release, mirroring, bubble timing and snapping follow that MIT project;
 * OpenAlice owns the native lifecycle/IPC adaptation. See companion/NOTICE.md.
 */
export function createCompanion(owner: BrowserWindow): BrowserWindow | undefined {
  if (process.env.OPENALICE_DISABLE_COMPANION === '1') return
  const here = dirname(fileURLToPath(import.meta.url))
  const assets = app.isPackaged
    ? join(process.resourcesPath, 'runtime/ui/dist/companion')
    : resolve(here, '../../ui/public/companion')
  const statePath = join(app.getPath('userData'), 'companion.json')
  let size = 220
  let enabled = true
  let saved: Partial<Rect> = {}
  try {
    const value = JSON.parse(readFileSync(statePath, 'utf8'))
    if ([170, 220, 280].includes(value.size)) size = value.size
    if (typeof value.enabled === 'boolean') enabled = value.enabled
    if (Number.isFinite(value.x) && Number.isFinite(value.y)) saved = { x: value.x, y: value.y }
  } catch { /* First launch or damaged launcher preference: use defaults. */ }
  const area = screen.getDisplayMatching(owner.getBounds()).workArea
  const width = Math.round(size * 2.7)
  const initial = { x: saved.x ?? area.x + area.width - width - 24, y: saved.y ?? area.y + area.height - Math.round(size * 1.65) - 24, width, height: Math.round(size * 1.65) }
  const bounds = settleCompanion(initial, screen.getDisplayMatching(initial).workArea, false)
  const pet = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    title: 'Alice', transparent: true, frame: false, hasShadow: false,
    resizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, alwaysOnTop: true, show: false,
    ...(process.platform === 'win32' ? { thickFrame: false, type: 'toolbar' } : {}),
    webPreferences: { preload: join(here, 'companion-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  })
  if (process.platform === 'darwin') pet.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  pet.setIgnoreMouseEvents(true, { forward: true })
  pet.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  pet.webContents.on('will-navigate', event => event.preventDefault())
  let ready = false
  let flipped = bounds.flipped
  let reducedMotion = false
  let snapTimer: ReturnType<typeof setInterval> | undefined
  const stopSnap = () => { clearInterval(snapTimer); snapTimer = undefined }
  let drag: { start: Electron.Point; bounds: Rect; moved: boolean } | undefined
  const updateDrag = () => {
    if (!drag) return
    const cursor = screen.getCursorScreenPoint()
    const dx = cursor.x - drag.start.x, dy = cursor.y - drag.start.y
    if (dx * dx + dy * dy >= 9) drag.moved = true
    if (drag.moved) pet.setPosition(Math.round(drag.bounds.x + dx), Math.round(drag.bounds.y + dy))
  }
  let writeQueue = Promise.resolve()
  const save = () => {
    if (pet.isDestroyed()) return
    const { x, y } = pet.getBounds()
    const payload = JSON.stringify({ x, y, size, enabled })
    writeQueue = writeQueue.then(async () => {
      await writeFile(statePath + '.tmp', payload)
      await rename(statePath + '.tmp', statePath)
    }).catch(error => console.error('[companion] preference save failed:', error.message))
  }
  const settle = (snap = true) => {
    stopSnap()
    const current = pet.getBounds()
    const next = settleCompanion(current, screen.getDisplayMatching(current).workArea, snap)
    flipped = next.flipped
    pet.webContents.send('openalice:companion:flip', flipped)
    if (!snap || reducedMotion) { pet.setPosition(next.x, next.y); save(); return }
    const start = performance.now()
    snapTimer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / 160)
      const ease = snapEase(progress)
      pet.setPosition(Math.round(current.x + (next.x - current.x) * ease), Math.round(current.y + (next.y - current.y) * ease))
      if (progress === 1) { stopSnap(); pet.setPosition(next.x, next.y); save() }
    }, 16)
  }
  const open = () => { if (!owner.isDestroyed()) { if (owner.isMinimized()) owner.restore(); owner.show(); owner.focus() } }
  const toggle = () => {
    enabled = !enabled
    if (enabled && ready) { settle(false); pet.showInactive() } else pet.hide()
    save()
    if (!owner.isDestroyed()) owner.webContents.send('openalice:companion:visibility', enabled)
  }
  const ownerTrusted = (event: Electron.IpcMainInvokeEvent) =>
    event.sender === owner.webContents && event.senderFrame === owner.webContents.mainFrame
  const visibilityChannel = 'openalice:companion:get-visible'
  const toggleChannel = 'openalice:companion:toggle'
  ipcMain.handle(visibilityChannel, event => {
    if (!ownerTrusted(event)) throw new Error('Unauthorized companion access')
    return enabled
  })
  ipcMain.handle(toggleChannel, event => {
    if (!ownerTrusted(event)) throw new Error('Unauthorized companion access')
    toggle()
    return enabled
  })
  pet.once('closed', () => {
    ipcMain.removeHandler(visibilityChannel)
    ipcMain.removeHandler(toggleChannel)
  })
  const menu = () => Menu.buildFromTemplate([
    { label: '打开 OpenAlice', click: open },
    { label: enabled ? 'Hide pet' : 'Show pet', click: toggle },
    { label: '大小', submenu: [170, 220, 280].map(value => ({
      label: value === 170 ? '小' : value === 220 ? '中' : '大', type: 'radio' as const, checked: size === value,
      click: () => {
        const old = pet.getBounds(); size = value
        const height = Math.round(size * 1.65)
        const width = Math.round(size * 2.7)
        pet.setBounds({ x: Math.round(old.x + (old.width - width) / 2), y: old.y + old.height - height, width, height })
        settle(false); save()
      },
    })) },
    { type: 'separator' },
    { label: '退出 OpenAlice', click: () => app.quit() },
  ])
  const icon = nativeImage.createFromPath(join(assets, 'alice.png')).resize({ width: 22, height: 22 })
  const tray = new Tray(icon)
  tray.setToolTip('OpenAlice · Alice')
  const trayMenu = () => tray.popUpContextMenu(menu())
  tray.on('click', trayMenu)
  tray.on('right-click', trayMenu)
  const trusted = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => event.sender === pet.webContents && event.senderFrame === pet.webContents.mainFrame
  const listen = (action: string, callback: (input: unknown) => void) => {
    const channel = 'openalice:companion:' + action
    const handler = (event: Electron.IpcMainEvent, input: unknown) => { if (trusted(event)) callback(input) }
    ipcMain.on(channel, handler)
    pet.once('closed', () => ipcMain.removeListener(channel, handler))
  }
  listen('ready', () => { ready = true; pet.webContents.send('openalice:companion:flip', flipped); if (enabled) pet.showInactive() })
  listen('reduced-motion', value => { if (typeof value === 'boolean') reducedMotion = value })
  listen('interactive', value => { if (typeof value === 'boolean') pet.setIgnoreMouseEvents(drag ? false : !value, { forward: true }) })
  listen('begin-drag', () => { stopSnap(); drag = { start: screen.getCursorScreenPoint(), bounds: pet.getBounds(), moved: false }; pet.setIgnoreMouseEvents(false) })
  listen('move-drag', updateDrag)
  listen('menu', () => menu().popup({ window: pet }))
  listen('open', open)
  const endChannel = 'openalice:companion:end-drag'
  ipcMain.handle(endChannel, (event, cancelled) => {
    if (!trusted(event)) return false
    updateDrag()
    const moved = drag?.moved ?? false
    if (drag && cancelled === true) pet.setBounds(drag.bounds)
    drag = undefined
    if (moved && cancelled !== true) settle()
    return moved
  })
  // Cursor polling recovers hover after native click-through and crosses monitors.
  let lastCursor = ''
  const tick = setInterval(() => {
    if (pet.isDestroyed() || !ready || !pet.isVisible()) return
    const cursor = screen.getCursorScreenPoint()
    updateDrag()
    const box = pet.getBounds()
    const point = { x: cursor.x - box.x, y: cursor.y - box.y }
    const key = `${point.x},${point.y}`
    if (key !== lastCursor) { lastCursor = key; pet.webContents.send('openalice:companion:cursor', point) }
  }, 50)
  const displayChanged = () => { if (!pet.isDestroyed()) { settle(false); save() } }
  screen.on('display-removed', displayChanged)
  screen.on('display-metrics-changed', displayChanged)
  owner.once('closed', () => { if (!pet.isDestroyed()) pet.destroy() })
  pet.once('closed', () => {
    clearInterval(tick); stopSnap(); tray.destroy(); ipcMain.removeHandler(endChannel)
    screen.removeListener('display-removed', displayChanged)
    screen.removeListener('display-metrics-changed', displayChanged)
  })
  void pet.loadFile(join(assets, 'index.html')).catch(error => {
    console.error('[companion] load failed:', error.message)
    if (!pet.isDestroyed()) pet.destroy()
  })
  return pet
}
