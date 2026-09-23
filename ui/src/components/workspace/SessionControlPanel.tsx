import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LoaderCircle, ShieldAlert, Square } from 'lucide-react'
import type { useSessionControl } from '../../hooks/useSessionControl'
import { Button } from '../ui/button'
import { inputClass } from '../form'

/** Shared by running-session and details dialogs; all state comes from one hook. */
export function SessionControlPanel({ control }: { control: ReturnType<typeof useSessionControl> }) {
  const { t, i18n } = useTranslation()
  const [seconds, setSeconds] = useState('600')
  useEffect(() => { if (control.data) setSeconds(String(control.data.cooldownSeconds)) }, [control.data?.cooldownSeconds])
  const data = control.data
  const run = data?.execution
  const stopping = run?.phase === 'stopping'
  return <section className="space-y-3 border-t border-border pt-4" aria-label={t('sessionControl.title')}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">{t('sessionControl.title')}</h3>
      {run && <Button variant="destructive" size="sm" disabled={control.busy || (stopping && !run.stopError)}
        onClick={() => void control.interrupt(run.executionId)}>
        {stopping && !run.stopError ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" /> : <Square size={14} />}
        {t(stopping && !run.stopError ? 'sessionControl.stopping' : run.stopError ? 'sessionControl.retry' : 'sessionControl.interrupt')}
      </Button>}
    </div>
    {run && <p className="text-xs leading-relaxed text-muted-foreground">{t('sessionControl.explanation', { minutes: Math.round((data?.cooldownSeconds ?? 600) / 60 * 10) / 10 })}</p>}
    {run?.stopError && <p role="alert" className="text-sm text-destructive">{t('sessionControl.unconfirmed')} {run.stopError}</p>}
    {control.error && <p role="alert" className="break-words text-sm text-destructive">{control.error}</p>}
    {!data && !control.error && <p role="status" className="text-sm text-muted-foreground">{t('common.loading')}</p>}
    {data?.blocks.map(block => <div key={block.id} className="space-y-2 border-l-2 border-border pl-3">
      <div className="flex items-center gap-2 text-sm font-medium"><ShieldAlert size={15} aria-hidden />{t(block.kind === 'user-cooldown' ? 'sessionControl.cooldown' : 'sessionControl.fault')}</div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t(block.kind === 'user-cooldown' ? 'sessionControl.cooldownDescription' : 'sessionControl.faultDescription')}</p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="tabular-nums text-muted-foreground">{block.expiresAt
          ? t('sessionControl.until', { time: new Date(block.expiresAt).toLocaleTimeString(i18n.language), seconds: Math.max(0, Math.ceil((block.expiresAt - data.serverNow) / 1000)) })
          : t('sessionControl.manual')}</span>
        <Button variant="outline" size="sm" disabled={control.busy} onClick={() => void control.release(block.id)}>{t('sessionControl.release')}</Button>
      </div>
      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">{t('sessionControl.reason')}</summary><p className="mt-1 break-words">{block.reason}</p><p>{block.actor.entry} · {new Date(block.createdAt).toLocaleString(i18n.language)}</p></details>
    </div>)}
    {data && !run && data.blocks.length === 0 && <p className="text-sm text-muted-foreground">{t('sessionControl.ready')}</p>}
    {data && <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer">{t('sessionControl.settings')}</summary>
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void control.configure(Number(seconds)) }}>
        <label className="space-y-1">{t('sessionControl.seconds')}<input className={`${inputClass} w-28`} type="number" min={10} max={86400} required value={seconds} onChange={event => setSeconds(event.target.value)} /></label>
        <Button type="submit" size="sm" variant="outline" disabled={control.busy}>{t('common.save')}</Button>
      </form>
      <p className="mt-2">{t('sessionControl.settingsHint')}</p>
    </details>}
  </section>
}
