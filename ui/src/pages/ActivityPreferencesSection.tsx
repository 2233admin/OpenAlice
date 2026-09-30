import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfigSection, inputClass } from '../components/form'
import { Toggle } from '../components/Toggle'
import { Button } from '../components/ui/button'
import { useActivityPreferences } from '../hooks/useActivityPreferences'
import { EVENT_CLASSES, type ActivityPreferences } from '../../../apps/desktop/src/activity-policy'
export function ActivityPreferencesSection() {
  const { t } = useTranslation()
  const prefs = useActivityPreferences()
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 10_000); return () => window.clearInterval(timer) }, [])
  const settings = prefs.settings
  return <ConfigSection title={t('activityPreferences.title')} description={t('activityPreferences.description')}>
    {prefs.loading ? <p role="status">{t('pet.loading')}</p> : !settings ? <p className="text-sm text-muted-foreground">{t('activityPreferences.desktopOnly')}</p> :
      <div className="space-y-4">
        {(['enabled', 'main', 'pet', 'brief'] as const).map(key => <div key={key} className="flex items-center justify-between gap-4">
          <label htmlFor={`activity-${key}`} className="text-sm">{t(`activityPreferences.${key}`)}</label>
          <Toggle id={`activity-${key}`} checked={settings[key]} disabled={prefs.pending} ariaLabel={t(`activityPreferences.${key}`)} onChange={value => { void prefs.update({ [key]: value }) }} />
        </div>)}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="activity-preset" className="text-sm">{t('activityPreferences.level')}</label>
          <select id="activity-preset" className={`${inputClass} max-w-64`} value={settings.preset} disabled={prefs.pending}
            onChange={e => { void prefs.update({ preset: e.target.value as ActivityPreferences['preset'] }) }}>
            {(['action', 'important', 'all'] as const).map(value => <option key={value} value={value}>{t(`activityPreferences.preset.${value}`)}</option>)}
          </select>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{t(`activityPreferences.help.${settings.preset}`)}</p>
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-medium">{t('activityPreferences.overrides')}</h4>
          {EVENT_CLASSES.map(kind => <div key={kind} className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={`activity-event-${kind}`} className="text-sm">{t(`activityPreferences.event.${kind}`)}</label>
            <select id={`activity-event-${kind}`} className={`${inputClass} max-w-40`} value={settings.overrides[kind] ?? 'inherit'} disabled={prefs.pending}
              onChange={e => { const overrides = { ...settings.overrides }; if (e.target.value === 'inherit') delete overrides[kind]; else overrides[kind] = e.target.value as 'show' | 'hide'; void prefs.update({ overrides }) }}>
              {(['inherit','show','hide'] as const).map(value => <option key={value} value={value}>{t(`activityPreferences.override.${value}`)}</option>)}
            </select>
          </div>)}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" disabled={prefs.pending} onClick={() => { void prefs.update({ pausedUntil: settings.pausedUntil > now ? 0 : Date.now() + 3_600_000 }) }}>
            {t(settings.pausedUntil > now ? 'activityPreferences.resume' : 'activityPreferences.pause')}
          </Button>
          <Button variant="ghost" disabled={prefs.pending} onClick={() => { void prefs.reset() }}>{t('activityPreferences.reset')}</Button>
        </div>
        {settings.pausedUntil > now && <p role="status" className="text-xs text-muted-foreground">{t('activityPreferences.paused', { time: new Date(settings.pausedUntil).toLocaleTimeString() })}</p>}
        <p className="text-xs leading-5 text-muted-foreground">{t('activityPreferences.local')}</p>
        {prefs.pending && <p role="status" className="text-xs text-muted-foreground">{t('pet.saving')}</p>}
      </div>}
    {prefs.error && <p role="alert" className="mt-3 text-sm text-destructive">{t('activityPreferences.error')}</p>}
  </ConfigSection>
}
