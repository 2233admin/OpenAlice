/** Isolated native companion acceptance; no Guardian, credentials, or broker. */
import { app, BrowserWindow } from 'electron'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { createCompanion } from './companion.js'

const home = mkdtempSync(join(tmpdir(), 'openalice-companion-'))
app.setPath('userData', home)
app.on('window-all-closed', () => app.quit())
void app.whenReady().then(async () => {
  const owner = new BrowserWindow({ show: false, width: 900, height: 700 })
  const pet = createCompanion(owner)!
  pet.webContents.on('preload-error', (_event, path, error) => console.error(path, error))
  pet.webContents.on('console-message', (_event, level, message) => { if (level >= 2) console.error(message) })
  await new Promise<void>((done, reject) => {
    const timeout = setTimeout(() => reject(new Error('Companion did not become visible')), 15000)
    pet.once('show', () => { clearTimeout(timeout); done() })
  })
  console.log(`[companion-preview] ready; isolated profile: ${home}`)
  if (!process.argv.includes('--smoke')) return
  const info = await pet.webContents.executeJavaScript(`({bridge: !!window.companion, node: typeof require, alpha: alpha.data[3], width: alpha.width, transition: getComputedStyle(body).transition, origin: getComputedStyle(body).transformOrigin})`)
  assert.equal(info.bridge, true)
  assert.equal(info.node, 'undefined')
  assert.equal(info.alpha, 0)
  assert.equal(info.width, 1254)
  assert.equal(pet.isAlwaysOnTop(), true)
  const box = await pet.webContents.executeJavaScript(`(() => { const r=portrait.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height*.6)} })()`)
  pet.webContents.sendInputEvent({ type: 'mouseDown', ...box, button: 'left', clickCount: 1 })
  await new Promise(done => setTimeout(done, 280))
  assert.equal(await pet.webContents.executeJavaScript(`body.classList.contains('pressed')`), true)
  writeFileSync(join(home, 'pressed.png'), (await pet.webContents.capturePage()).toPNG())
  pet.webContents.sendInputEvent({ type: 'mouseUp', ...box, button: 'left', clickCount: 1 })
  await new Promise(done => setTimeout(done, 650))
  assert.equal(await pet.webContents.executeJavaScript(`bubble.classList.contains('open')`), true)
  assert.equal(await pet.webContents.executeJavaScript(`body.classList.contains('pressed')`), false)
  writeFileSync(join(home, 'bubble.png'), (await pet.webContents.capturePage()).toPNG())
  pet.webContents.send('openalice:companion:flip', true)
  await new Promise(done => setTimeout(done, 350))
  assert.equal(await pet.webContents.executeJavaScript(`mirror.classList.contains('flipped')`), true)
  writeFileSync(join(home, 'flipped.png'), (await pet.webContents.capturePage()).toPNG())
  // Window gutters must preserve portrait size and contain the bubble on both sides.
  for (const size of [170, 220, 280]) {
    pet.setSize(Math.round(size * 1.5), Math.round(size * 1.65))
    for (const flipped of [false, true]) {
      pet.webContents.send('openalice:companion:flip', flipped)
      await new Promise(done => setTimeout(done, 350))
      const layout = await pet.webContents.executeJavaScript(`(() => {
        const b = bubble.getBoundingClientRect(), p = portrait.getBoundingClientRect();
        return {left:b.left, right:b.right, viewport:innerWidth, portrait:p.width,
          offset:(b.left+b.right-p.left-p.right)/2};
      })()`)
      assert.ok(layout.left >= -1 && layout.right <= layout.viewport + 1, 'Bubble clipped')
      assert.ok(Math.abs(layout.portrait - size * .9) < 1, 'Portrait size changed')
      assert.ok(Math.abs(layout.offset - size * .22 * (flipped ? 1 : -1)) < 1, 'Bubble offset changed')
    }
  }
  console.log('[companion-preview] smoke passed', JSON.stringify(info))
  owner.destroy()
  assert.equal(pet.isDestroyed(), true)
}).catch(error => { console.error(error); app.exit(1) })
