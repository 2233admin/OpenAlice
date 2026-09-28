import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('companion', {
  getSound: () => ipcRenderer.invoke('openalice:companion:sound:get'),
  onSound: (callback: (settings: unknown) => void) => {
    ipcRenderer.on('openalice:companion:sound:changed', (_event, settings) => callback(settings))
  },
  interactive: (enabled: boolean) => ipcRenderer.send('openalice:companion:interactive', enabled),
  beginDrag: () => ipcRenderer.send('openalice:companion:begin-drag'),
  moveDrag: () => ipcRenderer.send('openalice:companion:move-drag'),
  endDrag: (cancelled = false) => ipcRenderer.invoke('openalice:companion:end-drag', cancelled),
  menu: () => ipcRenderer.send('openalice:companion:menu'),
  open: () => ipcRenderer.send('openalice:companion:open'),
  ready: () => ipcRenderer.send('openalice:companion:ready'),
  reducedMotion: (enabled: boolean) => ipcRenderer.send('openalice:companion:reduced-motion', enabled),
  onCursor: (callback: (point: { x: number; y: number }) => void) => {
    ipcRenderer.on('openalice:companion:cursor', (_event, point) => callback(point))
  },
  onFlip: (callback: (flipped: boolean) => void) => {
    ipcRenderer.on('openalice:companion:flip', (_event, flipped) => callback(flipped))
  },
})
