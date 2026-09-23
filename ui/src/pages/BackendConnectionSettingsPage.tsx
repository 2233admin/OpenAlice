import { useState } from 'react'
import { Cable, ChevronDown, ChevronRight, CircleCheck, FolderKanban, Info, Monitor, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getBackendConnection } from '../auth/backendConnection'
import { RelayConnectionChooser } from '../components/RelayConnectionChooser'
import { Button } from '../components/ui/button'
import { SettingsScrollArea } from '../components/form'
import { PageHeader } from '../components/PageHeader'
import { useAliceProject } from '../hooks/useAliceProject'
import { useRelayConnection } from '../hooks/useRelayConnection'

/** The current backend is the only source of AliceProject identity. SSH identity
 * belongs to the local client and must never be inferred from backend files. */
export function BackendConnectionSettingsPage() {
  const { t } = useTranslation()
  const connection = getBackendConnection()
  const { project, loading, error, refresh } = useAliceProject()
  const relay = useRelayConnection()
  const [chooserOpen, setChooserOpen] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const remote = connection.kind === 'remote' || (relay.status?.target?.machine !== undefined && relay.status.target.machine !== 'local')
  const electron = connection.kind === 'electron'
  const machine = relay.status?.target?.machineName ?? relay.status?.target?.machine ?? (connection.kind === 'remote' ? connection.target : t('settings.backendConnection.thisMachine'))
  const description = relay.status
    ? t('settings.backendConnection.relayDescription', 'Connected through the local CLI relay')
    : connection.kind === 'remote'
    ? t('settings.backendConnection.sshTarget', {
        target: connection.target,
        port: connection.sshPort,
      })
    : electron
      ? t('settings.backendConnection.electronRuntime')
      : t('settings.backendConnection.localEndpoint', { endpoint: connection.endpoint })
  const status = loading
    ? t('settings.backendConnection.checking')
    : project && !error
      ? t('settings.backendConnection.connected')
      : t('settings.backendConnection.unavailable')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={t('settings.backendConnection.title')} />
      <SettingsScrollArea className="px-4 py-5 md:px-8">
        <div className="mx-auto max-w-[880px] space-y-4">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {t('settings.backendConnection.description')}
          </p>

          <section className="overflow-hidden rounded-xl border border-border bg-background" aria-labelledby="current-backend-title">
            <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5">
              <h3 id="current-backend-title" className="text-[14px] font-semibold text-foreground">
                {t('settings.backendConnection.current')}
              </h3>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground" role="status">
                {project && !error && !loading ? <CircleCheck className="size-3.5 text-success" aria-hidden /> : <span className="size-2 rounded-full bg-muted-foreground/60" aria-hidden />}
                {status}
              </span>
            </header>

            <div className="mx-4 border-t border-border/70" />
            <div className="grid grid-cols-[32px_minmax(0,1fr)] items-center gap-3 px-4 py-3.5">
              <Monitor className="size-5 justify-self-center text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">{t('settings.backendConnection.machine')}</p>
                <p className="truncate text-[14px] font-semibold text-foreground" title={machine}>{machine}</p>
                <p className="truncate text-[12px] text-muted-foreground" title={description}>{description}</p>
              </div>
            </div>

            <div className="mx-4 border-t border-border/70" />
            <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5">
              <FolderKanban className="size-5 justify-self-center text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">AliceProject</p>
                <p className="truncate text-[14px] font-semibold text-foreground" title={project?.displayName}>
                  {project?.displayName ?? (loading ? t('settings.backendConnection.checking') : t('settings.backendConnection.projectUnavailable'))}
                </p>
                {project && <p className="truncate font-mono text-[11px] text-muted-foreground">{project.key}</p>}
              </div>
              <span className="hidden rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] text-primary sm:inline-flex">
                {electron ? t('settings.backendConnection.integrated') : t('settings.backendConnection.separated')}
              </span>
            </div>

            <footer className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-3">
              {!electron && (
                <Button type="button" size="sm" onClick={() => relay.status ? setChooserOpen(true) : setShowInstructions((value) => !value)} aria-expanded={relay.status ? chooserOpen : showInstructions} aria-controls={relay.status ? undefined : 'connection-change-instructions'}>
                  {t('settings.backendConnection.change')}
                  {showInstructions ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails} aria-controls="connection-details">
                {t('settings.backendConnection.details')}
                {showDetails ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
              </Button>
              {!loading && !project && (
                <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
                  {t('settings.backendConnection.retry')}
                </Button>
              )}
            </footer>

            {showInstructions && !electron && !relay.status && (
              <div id="connection-change-instructions" className="border-t border-border/70 bg-secondary/25 px-4 py-4 text-[12px] leading-relaxed">
                <p className="font-medium text-foreground">{t('settings.backendConnection.cliTitle')}</p>
                <p className="mt-1 text-muted-foreground">{t('settings.backendConnection.cliDescription')}</p>
                <code className="mt-3 inline-block rounded-md border border-border bg-background px-2 py-1 font-mono text-[12px] text-foreground">openalice</code>
              </div>
            )}
            {showDetails && (
              <dl id="connection-details" className="grid gap-3 border-t border-border/70 bg-secondary/20 px-4 py-4 text-[12px] sm:grid-cols-2">
                <Detail label={t('settings.backendConnection.transport')} value={relay.status ? 'Local CLI relay' : connection.kind === 'remote' ? 'SSH tunnel' : electron ? 'Electron IPC' : 'Loopback HTTP'} />
                <Detail label={t('settings.backendConnection.clientEndpoint')} value={relay.status ? window.location.host : connection.kind === 'remote' ? connection.localEndpoint : electron ? 'app://openalice' : connection.endpoint} />
                {connection.kind === 'remote' && !relay.status && <Detail label={t('settings.backendConnection.remoteEndpoint')} value={`127.0.0.1:${connection.runtimePort}`} />}
                {project && <Detail label={t('settings.backendConnection.projectId')} value={project.id} />}
              </dl>
            )}
          </section>
          <RelayConnectionChooser open={chooserOpen} onOpenChange={setChooserOpen} initialStatus={relay.status} />

          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
            {remote ? <Cable className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : electron ? <Server className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
            {remote ? t('settings.backendConnection.remoteNote') : electron ? t('settings.backendConnection.electronNote') : t('settings.backendConnection.localNote')}
          </p>
        </div>
      </SettingsScrollArea>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-foreground">{value}</dd>
    </div>
  )
}
