import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createActivityPreferenceStore, migrateActivityPreferences } from './activity-preferences.js'
import { DEFAULT_ACTIVITY_PREFERENCES as defaults, allowsActivity, type ActivityPreferences } from './activity-policy.js'
import type { AgentActivitySignal } from './activity-projection.js'
const signal = (kind: AgentActivitySignal['kind']): AgentActivitySignal => ({id:'1',kind,occurredAt:0,revision:1})
describe('activity preferences', () => {
  it('validates preset decisions, overrides, unknown events and pause', () => {
    expect(allowsActivity(defaults,signal('conversation'))).toBe(false)
    for(const kind of ['conversation-failed','conversation-completed','inbox','news','conversation-paused'] as const) expect(allowsActivity(defaults,signal(kind))).toBe(true)
    expect(allowsActivity({...defaults,preset:'action'},signal('inbox'))).toBe(false)
    expect(allowsActivity({...defaults,preset:'all'},signal('conversation'))).toBe(true)
    expect(allowsActivity({...defaults,overrides:{news:'hide',progress:'show'}},signal('news'))).toBe(false)
    expect(allowsActivity({...defaults,overrides:{progress:'show'}},signal('conversation'))).toBe(true)
    expect(allowsActivity(defaults,{...signal('news'),kind:'unknown' as never})).toBe(false)
    expect(allowsActivity({...defaults,pausedUntil:100},signal('news'),99)).toBe(false)
    expect(allowsActivity({...defaults,enabled:false},signal('news'))).toBe(false)
  })
  it('persists serial updates/reset; rejects invalid updates and damaged disk schema', async () => {
    const dir=mkdtempSync(join(tmpdir(),'oa-notify-'));const path=join(dir,'prefs.json')
    try {
      const store=createActivityPreferenceStore(path);expect(store.get()).toEqual(defaults)
      await Promise.all([store.update({preset:'all'}),store.update({brief:false,overrides:{news:'hide'}})])
      expect(createActivityPreferenceStore(path).get()).toMatchObject({preset:'all',brief:false,overrides:{news:'hide'}})
      expect(()=>store.update({url:'evil'})).toThrow();expect(()=>store.update({overrides:{unknown:'show'}})).toThrow()
      const before=readFileSync(path,'utf8');expect(()=>store.update({pausedUntil:Infinity})).toThrow();expect(readFileSync(path,'utf8')).toBe(before)
      await store.reset();expect(store.get()).toEqual(defaults)
      writeFileSync(path,'{"preset":"bogus"}');expect(createActivityPreferenceStore(path).get()).toEqual(defaults)
    } finally {rmSync(dir,{recursive:true,force:true})}
  })
  it('updates versioned default references without overwriting explicit user decisions',()=>{
    const old:ActivityPreferences={...defaults,defaultsVersion:0,preset:'action',overrides:{news:'show',failure:'hide'},brief:false}
    expect(migrateActivityPreferences(old)).toEqual({...old,defaultsVersion:1})
    expect(()=>migrateActivityPreferences({...old,version:999})).toThrow()
  })
})
