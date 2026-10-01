import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Resources } from '../../i18n/locales/en'
import type { UpdatePlan } from '@traderalice/update-lifecycle'
import { useUpdateLifecycle } from '../../hooks/useUpdateLifecycle'
import { Button } from '../ui/button'

/** Presentation only: local main/relay owns approval, execution and recovery. */
export function CoordinatedUpdateReview({ remote }: { remote: boolean }) {
  const updates = useUpdateLifecycle()
  const { t } = useTranslation()
  const [client, setClient] = useState(false)
  const [backend, setBackend] = useState(false)
  const [projectUnits, setProjectUnits] = useState<string[]>([])
  const [plan, setPlan] = useState<UpdatePlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(null)
    try { await action() } catch (cause) { setError(String(cause)) } finally { setBusy(false) }
  }
  const text = (key: Exclude<keyof Resources['settings']['updateCoordinator'], 'phase'> | `phase.${keyof Resources['settings']['updateCoordinator']['phase']}`) => t(`settings.updateCoordinator.${key}`)
  const reviewedUnits = plan?.proposals.flatMap(p => p.unit.id === 'project' && p.reference?.plan ? (JSON.parse(p.reference.plan) as UpdatePlan).proposals : [p]) ?? []
  const operation = updates.operation
  const active = operation && operation.phase !== 'succeeded'
  const rows = (updates.inventory ?? []).filter(unit => unit.operations.includes('update') && unit.desired && (!unit.installed || unit.desired.version !== unit.installed.version || unit.desired.commit !== unit.installed.commit))
  return <section className="space-y-3 rounded-xl border border-border p-4">
    <h3 className="font-medium">{text('title')}</h3>
    <p className="text-xs text-muted-foreground">{text('description')}</p>
    {operation?.phase === 'succeeded' && <p role="status" className="text-sm">{text('phase.succeeded')} · {Object.keys(operation.completed).length}/{operation.plan.steps.length}</p>}
    {active ? <div role="status" className="space-y-3">
      <p>{text(`phase.${operation.phase}`)} · {Object.keys(operation.completed).length}/{operation.plan.steps.length}</p>
      {operation.plan.steps.map(step => <p className="text-xs" key={step.id}>{operation.completed[step.id] ? '✓' : '○'} {step.unit} · {step.stage}</p>)}
      {operation.error && <p role="alert" className="text-sm text-warning">{operation.error}</p>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => { void act(updates.resume) }}>{text('resume')}</Button>
      <Button variant="outline" disabled={busy} onClick={() => { void act(updates.abandon) }}>{text('abandon')}</Button></div>
    </div> : <>
      {updates.nativeReady && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={client} onChange={e => { setClient(e.target.checked); setPlan(null) }}/>{text('client')} → {updates.nativeReady.version}</label>}
      {remote && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={backend} onChange={e => { setBackend(e.target.checked); setPlan(null) }}/>{text('backend')}</label>}
      {rows.map(unit => <label key={unit.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={projectUnits.includes(unit.id)} onChange={e => { setProjectUnits(old => e.target.checked ? [...old, unit.id] : old.filter(id => id !== unit.id)); setPlan(null) }}/><span className="min-w-0 break-words">{unit.roles.join(', ')} · {unit.id.split(':').slice(1).join(':')}<span className="block text-xs text-muted-foreground">{unit.installed?.version ?? '—'} → {unit.desired?.version}</span></span></label>)}
      <Button variant="outline" disabled={busy || (!client && !backend && !projectUnits.length)} onClick={() => { void act(async () => setPlan(await updates.review({ client, backend, projectUnits }))) }}>{text('review')}</Button>
      {plan && <div className="space-y-2 border-t border-border pt-3">
        {reviewedUnits.map(p => <p className="break-words text-sm" key={p.unit.id}>{p.unit.owner}: {p.unit.installed?.version ?? '—'} → {p.unit.desired?.version}</p>)}
        {plan.blockers.map(reason => <p key={reason} role="alert" className="text-sm text-warning">{reason}</p>)}
        <Button disabled={busy || Boolean(plan.blockers.length)} onClick={() => { void act(async () => { await updates.approve(plan); setPlan(null); setProjectUnits([]); setClient(false); setBackend(false) }) }}>{text('approve')}</Button>
      </div>}
    </>}
    {updates.inventoryError && <p role="alert" className="text-sm text-warning">{updates.inventoryError}{updates.inventoryCheckedAt && <> · {new Date(updates.inventoryCheckedAt).toLocaleString()}</>}</p>}
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
  </section>
}
