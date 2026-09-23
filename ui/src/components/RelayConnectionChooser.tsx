import { useEffect, useState } from 'react'
import { ArrowRight, CircleAlert, Monitor, RefreshCw, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { useRelayConnection, type RelayStatus } from '../hooks/useRelayConnection'

export function RelayConnectionChooser({ open, onOpenChange, initialStatus }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStatus?: RelayStatus | null
}) {
  const { t } = useTranslation()
  const relay = useRelayConnection(initialStatus)
  const [machineKey, setMachineKey] = useState<string | null>(null)
  const [projectKey, setProjectKey] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setMachineKey(initialStatus?.target?.machine ?? null)
    setProjectKey(initialStatus?.target?.project ?? null)
    void relay.refresh()
  }, [open, initialStatus?.target?.machine, initialStatus?.target?.project, relay.refresh])
  const selectedMachine = relay.fleet.find((machine) => machine.key === machineKey)
  const selectedProject = selectedMachine?.projects.find((project) => project.key === projectKey)
  const canConnect = selectedMachine && selectedProject?.available && selectedProject.runtime.webEndpoint
    && (selectedMachine.connection === 'local' || selectedMachine.connection === 'online')
  const isCurrent = relay.status?.target?.machine === machineKey && relay.status?.target?.project === projectKey

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(45rem,calc(100dvh-2rem))] min-w-0 flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-5 pr-12">
          <DialogTitle>{t('settings.backendConnection.change')}</DialogTitle>
          <DialogDescription>{t('settings.backendConnection.relayChooseDescription', 'Choose one Machine and one running AliceProject. This connection is shared by every tab using this relay.')}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-0 overflow-y-auto sm:grid-cols-2 sm:overflow-hidden">
          <div className="min-h-0 border-b border-border/70 p-3 sm:overflow-y-auto sm:border-b-0 sm:border-r">
            <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">{t('settings.backendConnection.machine')}</p>
            {relay.fleet.map((machine) => (
              <button key={machine.key} type="button" onClick={() => { setMachineKey(machine.key); setProjectKey(null) }}
                aria-pressed={machine.key === machineKey}
                className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary ${machine.key === machineKey ? 'bg-secondary' : ''}`}>
                {machine.key === 'local' ? <Monitor className="size-4 shrink-0" aria-hidden /> : <Server className="size-4 shrink-0" aria-hidden />}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{machine.displayName}</span><span className="block text-xs text-muted-foreground">{machine.connection}</span></span>
                {machine.key === machineKey && <ArrowRight className="size-4 shrink-0" aria-hidden />}
              </button>
            ))}
            {relay.loading && <p role="status" className="px-2 py-3 text-xs text-muted-foreground">{t('settings.backendConnection.checking')}</p>}
          </div>
          <div className="min-h-0 p-3 sm:overflow-y-auto">
            <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">AliceProject</p>
            {!selectedMachine && <p className="px-2 py-4 text-sm text-muted-foreground">{t('settings.backendConnection.chooseMachine', 'Choose a Machine to see its Projects.')}</p>}
            {selectedMachine?.issue && <p className="flex gap-2 px-2 py-3 text-sm text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{selectedMachine.issue.message}</p>}
            {selectedMachine?.projects.map((project) => {
              const integrated = project.key === '@electron-current' && !!window.openAlice?.runtime
              const running = project.available && !!project.runtime.webEndpoint
              return <button key={project.key} type="button" onClick={() => setProjectKey(project.key)} aria-pressed={project.key === projectKey}
                className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary ${project.key === projectKey ? 'bg-secondary' : ''}`}>
                <span className="block truncate text-sm font-medium">{integrated ? `${t('settings.backendConnection.thisElectronApp')} · ${project.displayName}` : project.displayName}</span>
                <span className={`block text-xs ${running || integrated ? 'text-success' : 'text-muted-foreground'}`}>{integrated ? t('settings.backendConnection.currentIntegrated', 'Running in Electron') : running ? t('settings.backendConnection.running', 'Running') : t('settings.backendConnection.notRunning', 'Not running · start from CLI first')}</span>
              </button>
            })}
            {selectedMachine && !selectedMachine.projects.length && !selectedMachine.issue && <p className="px-2 py-4 text-sm text-muted-foreground">{t('settings.backendConnection.noProjects', 'No AliceProjects found on this Machine.')}</p>}
          </div>
        </div>
        {relay.error && <p role="alert" className="mx-5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{relay.error}</p>}
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border/70 px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => void relay.refresh()} disabled={relay.loading || relay.busy}><RefreshCw className="size-4" aria-hidden />{t('settings.backendConnection.retry')}</Button>
          <Button type="button" size="sm" disabled={!canConnect || relay.busy} onClick={() => { if (machineKey && projectKey) void relay.connect(machineKey, projectKey).catch(() => undefined) }}>
            {relay.busy ? t('settings.backendConnection.checking') : isCurrent ? t('settings.backendConnection.reconnect', 'Reconnect') : t('settings.backendConnection.connect', 'Connect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
