import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, ChevronRight, ExternalLink, Folder, Info, LoaderCircle, Monitor, RefreshCw, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Resources } from '../../i18n/locales/en'
import { useUpdateLifecycle } from '../../hooks/useUpdateLifecycle'
import { useAliceProject } from '../../hooks/useAliceProject'
import { useWorkspaces } from '../../contexts/workspaces-context'
import { getBackendConnection } from '../../auth/backendConnection'
import { useBackendRecoverySignal } from '../../auth/AuthContext'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { MachineUpgradeDialog } from './MachineUpgradeDialog'
import { claimUpgradeDialog, shouldRestoreUpgradeDialog } from './upgrade-dialog-owner'

const UI_VERSION = typeof __OPENALICE_UI_VERSION__ === 'string' ? __OPENALICE_UI_VERSION__ : 'development'
const version = (value?: string | null) => value ? `v${value.replace(/^v/, '')}` : '—'
type View = 'app' | 'backend' | 'project' | 'review' | 'native-review' | 'native-progress' | 'backend-review' | null

/** Overview selects observations from the one lifecycle owner. Commands keep
 * their real owner approval boundary; this view must not invent cross-restart
 * orchestration or infer an installed version from a running-version probe. */
export function VersionOverviewSection() {
  const { t } = useTranslation()
  const text = (key: keyof Resources['settings']['versions']) => t(`settings.versions.${key}`)
  const updates = useUpdateLifecycle()
  const { machines, nativeStatus } = updates
  const { project } = useAliceProject()
  const { workspaces, openAgentConfig, listError, hasLoaded } = useWorkspaces()
  const { backendUnavailable, backendRecoveryGeneration } = useBackendRecoverySignal()
  const [view, setView] = useState<View>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const integrated = getBackendConnection().kind === 'electron'
  const target = machines.status?.target
  const remote = Boolean(target && target.machine !== 'local')
  const appVersion = updates.client?.currentVersion ?? UI_VERSION
  const appCandidate = updates.nativeReady?.version ?? updates.client?.discovery.value?.latestVersion
  const appAvailable = Boolean(updates.nativeReady || updates.client?.discovery.value?.status === 'available')
  const backend = updates.versionInfo
  const projectName = project?.displayName ?? target?.projectName ?? text('projectUnknown')
  const machineName = target?.machineName ?? t('settings.backendConnection.thisMachine')
  const nativeBusy = updates.nativeInstalling || nativeStatus?.phase === 'installing'
  const backendBusy = machines.applying || machines.operation?.phase === 'running'
  const workspaceRows = workspaces.filter(workspace => ['chat', 'auto-quant-v2', 'auto-prediction'].includes(workspace.template ?? '')).map(workspace => {
    const state = updates.workspaceStates.find(item => item.workspaceId === workspace.id)
    const applied = state?.phase === 'updated'
    return { workspace, state, current: applied ? state.toVersion : state?.fromVersion ?? workspace.currentVersion ?? workspace.upgradeAvailable?.from,
      candidate: applied ? undefined : state?.toVersion ? state.toVersion : workspace.upgradeAvailable?.to }
  })
  useEffect(() => {
    if (machines.operation?.mode === 'upgrade' && machines.operation.phase === 'running' && shouldRestoreUpgradeDialog('about')) setView('backend-review')
  }, [machines.operation?.id, machines.operation?.phase, machines.operation?.mode])
  useEffect(() => {
    // A project switch invalidates read/review surfaces; an executing owner
    // operation remains attached to its original target and cannot be retargeted.
    if (!backendBusy && !nativeBusy) setView(null)
  }, [backendRecoveryGeneration]) // eslint-disable-line react-hooks/exhaustive-deps
  const open = (next: View) => { setLocalError(null); setView(next) }
  const reviewBackend = () => {
    if (!remote || !target) return
    claimUpgradeDialog('about')
    machines.clearPlan()
    open('backend-review')
    void machines.probe({ mode: 'upgrade', machineKey: target.machine, projectKey: target.project }).catch(() => undefined)
  }
  const openWorkspace = (id: string) => {
    setView(null)
    // Close this focus scope before handing off to the existing content merge
    // review. Repository conflicts require its file-level approval UI.
    openAgentConfig(id, undefined, 'template')
  }
  const appStatus = updates.clientError || updates.nativeError ? text('checkFailed')
    : nativeStatus?.phase === 'downloading' ? text('downloading')
      : appAvailable ? `${text('available')} ${version(appCandidate)}`
        : updates.client?.discovery.value?.status === 'current' ? text('current') : text('unknown')
  const backendStatus = updates.versionError || backend?.error ? text('checkFailed')
    : backend?.hasUpdate ? `${text('available')} ${version(backend.latest)}`
      : backend?.updateAuthority === 'service' ? t('settings.about.status.serviceManaged')
        : backend?.updateAuthority === 'none' ? t('settings.about.status.noUpdater')
          : backend?.updateAuthority === 'source' ? text('sourceManaged')
            : backend?.latest ? text('current') : text('unknown')
  const card = (kind: 'app' | 'backend' | 'project', icon: ReactNode, subtitle: string, identity: string, status: string, children?: ReactNode) => <section className="min-w-0 rounded-xl border border-border/70 bg-secondary/25">
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-5 sm:gap-x-4 sm:p-6">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>{icon}</div>
      <div className="min-w-0"><h3 className="text-base font-semibold">{text(kind)}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{subtitle}</p></div>
      <Button className="col-start-3 row-start-1" variant="ghost" size="sm" aria-label={`${text(kind)} · ${text('details')}`} onClick={() => open(kind)}>{text('details')}<ChevronRight className="size-4" /></Button>
      <div className="col-span-2 col-start-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        {identity && <p className="break-all font-mono text-sm tabular-nums">{identity}</p>}
        <p className="text-xs text-muted-foreground">{status}</p>
      </div>
    </div>{children}
  </section>
  const workspaceList = <div className="mx-5 mb-5 divide-y divide-border/60 rounded-lg border border-border/60 sm:mx-6">
    {workspaceRows.map(({ workspace, state, current, candidate }) => <button key={workspace.id} type="button" onClick={() => openWorkspace(workspace.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-secondary/60 focus-visible:outline-primary">
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{workspace.displayName || workspace.tag}</p><p className="mt-1 text-xs text-muted-foreground">{workspace.template === 'chat' ? text('bundled') : text('independent')}</p></div>
      <span className="font-mono text-xs tabular-nums">{version(current)}</span>
      {candidate && <><ArrowRight className="size-3 text-muted-foreground"/><span className="font-mono text-xs text-primary">{version(candidate)}</span></>}
      <span className="text-xs text-muted-foreground">{state?.phase === 'applying' ? text('updating') : state?.phase === 'blocked' ? text('waiting') : state?.phase === 'failed' ? text('needsAttention') : candidate ? text('available') : state?.phase === 'current' || state?.phase === 'updated' ? text('current') : text('unknown')}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground"/>
    </button>)}
    {!workspaceRows.length && <p className="p-4 text-sm text-muted-foreground">{listError || (!hasLoaded ? text('loading') : text('noWorkspaces'))}</p>}
  </div>
  return <section className="border-t border-border/60 py-7">
    <h2 className="mb-5 text-lg font-semibold">{text('title')}</h2>
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <RefreshCw className={`size-5 shrink-0 text-primary ${updates.checking ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden/>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{updates.availableCount ? t('settings.versions.updateCount', { count: updates.availableCount }) : text('summary')}</p><p className="mt-1 text-xs text-muted-foreground">{integrated ? text('integrated') : text('separated')}</p></div>
      <Button onClick={() => open('review')}>{text('review')}</Button>
    </div>
    <div className="space-y-4">
      {card('app', <Monitor className="size-5"/>, window.openAlice?.updater ? text('desktop') : text('browser'), version(appVersion), appStatus,
        updates.client?.kind === 'cli' && appVersion !== UI_VERSION ? <p className="px-6 pb-4 text-xs text-muted-foreground">{text('uiBuild')} {version(UI_VERSION)}</p> : undefined)}
      {card('backend', <Server className="size-5"/>, `${machineName} · ${backendUnavailable ? text('offline') : text('connected')}`, version(backend?.current), integrated ? text('integrated') : backendStatus)}
      {card('project', <Folder className="size-5"/>, projectName, '', t('settings.versions.componentCount', { count: workspaceRows.length }), workspaceList)}
    </div>
    {view === 'backend-review' ? <MachineUpgradeDialog open plan={machines.plan?.mode === 'upgrade' ? machines.plan : null} operation={machines.operation} busy={machines.applying} error={machines.operationError} onClose={() => { setView(null); machines.clearPlan() }} onApply={() => { void machines.apply().then(() => updates.refresh()).catch(() => undefined) }} onRetry={reviewBackend}/> : <Dialog open={view !== null} onOpenChange={next => { if (!next && !nativeBusy) setView(null) }}>
      <DialogContent showCloseButton={!nativeBusy} className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0" style={{ width: 'calc(100vw - 2rem)', maxWidth: 880 }}>
        <div className="border-b border-border px-6 py-5 pr-14"><DialogTitle className="text-xl">{text(view === 'review' ? 'review' : view === 'native-review' ? 'reviewApp' : view === 'native-progress' ? 'appProgress' : `${view === 'backend' ? 'backend' : view === 'project' ? 'project' : 'app'}Details`)}</DialogTitle><DialogDescription className="mt-2">{text(view === 'review' ? 'reviewDescription' : view === 'native-review' ? 'restartNote' : view === 'native-progress' ? 'handoffNote' : 'detailsDescription')}</DialogDescription></div>
        <div className="min-h-0 overflow-y-auto p-6">
          {view === 'review' && <div className="space-y-3">
            <p className="mb-4 rounded-lg bg-primary/5 p-3 text-sm text-muted-foreground">{text('ownerReview')}</p>
            <ReviewRow title={text('app')} detail={`${version(appVersion)} · ${appStatus}`} label={updates.nativeReady ? text('review') : text('details')} onClick={() => open(updates.nativeReady ? 'native-review' : 'app')}/>
            <ReviewRow title={text('backend')} detail={`${machineName} · ${backendStatus}`} label={text('review')} onClick={integrated ? () => open('app') : remote ? reviewBackend : () => open('backend')}/>
            <ReviewRow title={text('project')} detail={projectName} label={text('details')} onClick={() => open('project')}/>
          </div>}
          {(view === 'app' || view === 'backend') && <>
            <div className="mb-6 flex flex-wrap items-center gap-3"><span className="text-3xl font-semibold tabular-nums">{version(view === 'app' ? appVersion : backend?.current)}</span><span className="rounded-full border border-border px-3 py-1 text-xs">{view === 'app' ? updates.client?.discovery.value?.channel ?? '—' : backend?.channel ?? '—'}</span></div>
            <dl className="grid gap-5 border-y border-border py-5 sm:grid-cols-2"><Fact label={text('runningVersion')} value={version(view === 'app' ? appVersion : backend?.current)}/><Fact label={text('installedVersion')} value={text('notReported')}/><Fact label={text('location')} value={view === 'app' ? t('settings.backendConnection.thisMachine') : machineName}/><Fact label={text('updateStatus')} value={view === 'app' ? appStatus : backendStatus}/></dl>
            {integrated && <p className="mt-4 rounded-lg bg-primary/5 p-3 text-sm">{text('integrated')}</p>}
            {view === 'app' && updates.client?.kind === 'cli' && <p className="mt-4 text-sm text-muted-foreground">{text('cliManaged')}</p>}
            {view === 'backend' && !remote && !integrated && <p className="mt-4 text-sm text-muted-foreground">{text('localManaged')}</p>}
            <details className="mt-5 text-xs text-muted-foreground"><summary className="cursor-pointer py-2">{text('buildDetails')}</summary><p className="py-2">{text('uiBuild')} {version(UI_VERSION)}</p>{(view === 'app' ? updates.clientError : updates.versionError || backend?.error) && <p role="alert">{view === 'app' ? updates.clientError : updates.versionError || backend?.error}</p>}</details>
          </>}
          {view === 'project' && <><p className="mb-5 text-sm text-muted-foreground">{text('projectDescription')}</p>{workspaceList}</>}
          {view === 'native-review' && <><ReviewRow title={text('app')} detail={`${version(appVersion)} → ${version(updates.nativeReady?.version)}`}/><p className="mt-4 rounded-lg bg-primary/5 p-4 text-sm">{text('restartNote')}</p>{remote && <p className="mt-3 text-xs text-muted-foreground">{text('backendOptional')}</p>}</>}
          {view === 'native-progress' && <div role="status" className="space-y-5"><div className="flex items-center gap-3"><LoaderCircle className="size-6 animate-spin motion-reduce:animate-none text-primary"/><p>{nativeStatus?.phase === 'installing' ? t(`settings.about.status.installing.${nativeStatus.stage}`) : updates.nativeError || text('handoffNote')}</p></div><p className="text-sm text-muted-foreground">{text('handoffNote')}</p></div>}
          {(localError || updates.nativeError) && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{localError || updates.nativeError}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/20 px-6 py-4">
          <Button variant="outline" disabled={updates.checking || nativeBusy} onClick={() => { void updates.refresh().catch(error => setLocalError(String(error))) }}><RefreshCw className="size-4"/>{text('checkAgain')}</Button>
          <div className="flex flex-wrap gap-2">
            {!nativeBusy && view !== 'review' && <Button variant="ghost" onClick={() => open('review')}>{text('back')}</Button>}
            {view === 'app' && <Button variant="outline" onClick={() => { void updates.openClientRelease(appCandidate).catch(error => setLocalError(String(error))) }}><ExternalLink className="size-4"/>{t('settings.about.viewReleases')}</Button>}
            {view === 'app' && updates.nativeReady && <Button onClick={() => open('native-review')}>{text('review')}</Button>}
            {view === 'backend' && remote && <Button disabled={machines.probing || backendBusy} onClick={reviewBackend}>{text('review')}</Button>}
            {view === 'native-review' && <Button disabled={!updates.nativeReady || nativeBusy} onClick={() => { setView('native-progress'); void updates.installClient().catch(() => undefined) }}>{t('settings.about.installAndRestart')}</Button>}
            {view === 'review' && <Button variant="outline" onClick={() => setView(null)}>{text('close')}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>}
  </section>
}
function Fact({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div> }
function ReviewRow({ title, detail, label, onClick }: { title: string; detail: string; label?: string; onClick?: () => void }) { return <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-4"><Info className="size-5 shrink-0 text-primary"/><div className="min-w-0 flex-1"><p className="font-medium">{title}</p><p className="mt-1 break-words text-xs text-muted-foreground">{detail}</p></div>{onClick && <Button variant="outline" size="sm" onClick={onClick}>{label}<ChevronRight className="size-4"/></Button>}</div> }
