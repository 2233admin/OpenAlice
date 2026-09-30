// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import '../i18n'
import { i18n } from '../i18n'
import { ActivityPreferencesSection } from './ActivityPreferencesSection'
import { DEFAULT_ACTIVITY_PREFERENCES as defaults, type ActivityPreferences } from '../../../apps/desktop/src/activity-policy'
beforeAll(async () => { await i18n.changeLanguage('en') })
afterEach(() => { cleanup(); Reflect.deleteProperty(window,'openAlice') })
function bridge(fail=false) {
  let settings=structuredClone(defaults)
  const updatePreferences=vi.fn(async(patch:Partial<ActivityPreferences>)=>{if(fail) throw new Error('disk failure');return settings={...settings,...patch}})
  const resetPreferences=vi.fn(async()=>settings=structuredClone(defaults))
  Object.defineProperty(window,'openAlice',{configurable:true,value:{companion:{activity:{getPreferences:async()=>settings,updatePreferences,resetPreferences,onPreferences:()=>()=>{}}}}})
  return {updatePreferences,resetPreferences}
}
describe('activity settings',()=>{
  it('shows desktop boundary',()=>{render(<ActivityPreferencesSection/>);expect(screen.queryByRole('combobox')).toBeNull();expect(screen.getByText(/desktop app/)).toBeTruthy()})
  it('loads official defaults, autosaves preset/override, pause and reset',async()=>{
    const b=bridge();render(<ActivityPreferencesSection/>);const preset=await screen.findByRole('combobox',{name:'Notification level'})
    expect((preset as HTMLSelectElement).value).toBe('important')
    fireEvent.change(preset,{target:{value:'all'}});await waitFor(()=>expect(b.updatePreferences).toHaveBeenCalledWith({preset:'all'}))
    await waitFor(()=>expect((preset as HTMLSelectElement).disabled).toBe(false))
    fireEvent.change(screen.getByRole('combobox',{name:'News'}),{target:{value:'hide'}});await waitFor(()=>expect(b.updatePreferences).toHaveBeenCalledWith({overrides:{news:'hide'}}))
    await waitFor(()=>expect((screen.getByRole('button',{name:'Pause for 1 hour'}) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button',{name:'Pause for 1 hour'}));await screen.findByRole('button',{name:'Resume notifications'})
    fireEvent.click(screen.getByRole('button',{name:'Restore notification defaults'}));await waitFor(()=>expect(b.resetPreferences).toHaveBeenCalled())
    await waitFor(()=>expect((preset as HTMLSelectElement).value).toBe('important'))
    expect((screen.getByRole('combobox',{name:'News'}) as HTMLSelectElement).value).toBe('inherit')
  })
  it('keeps confirmed settings after a save failure and exposes retry',async()=>{
    const b=bridge(true);render(<ActivityPreferencesSection/>);const preset=await screen.findByRole('combobox',{name:'Notification level'})
    fireEvent.change(preset,{target:{value:'all'}});await screen.findByRole('alert');expect((preset as HTMLSelectElement).value).toBe('important')
    fireEvent.change(preset,{target:{value:'action'}});await waitFor(()=>expect(b.updatePreferences).toHaveBeenCalledTimes(2))
  })
})
