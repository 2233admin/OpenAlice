import { BrowserWindow } from 'electron'
import { configureWindowChrome, windowChromeOptions } from './window-chrome.js'
import { createCompanion } from './companion.js'

/** Keep dev/demo and installed desktop renderer isolation and chrome identical. */
export function createAppWindow(preload: string, title = 'OpenAlice'): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title,
    ...windowChromeOptions(),
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: false },
  })
  configureWindowChrome(win)
  try { createCompanion(win) } catch (error) { console.error('[companion] startup failed:', error) }
  return win
}
