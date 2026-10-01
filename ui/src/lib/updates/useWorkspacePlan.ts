import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useUpdateLifecycle } from '../../hooks/useUpdateLifecycle'
import { workspacePlanKey, type WorkspacePlanRequest } from './workspacePlans'

/** Internal binding to the existing public lifecycle owner, never a second cache. */
export function useWorkspacePlan(request: WorkspacePlanRequest) {
  const { workspacePlans } = useUpdateLifecycle()
  const key = workspacePlanKey(request)
  const resource = workspacePlans.resource(request)
  const current = useRef(resource)
  current.current = resource
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot)
  // A content/receipt invalidation also refreshes a review that is already open.
  // Settled success and error observations remain cached when reopened.
  useEffect(() => { void workspacePlans.ensure(request) }, [workspacePlans, key, resource, snapshot])
  return {
    plan: snapshot.value?.plan ?? null, loading: snapshot.checking,
    error: snapshot.error ?? snapshot.value?.error ?? null, unsupported: snapshot.value?.unsupported ?? false,
    refresh: () => workspacePlans.refresh(request),
    replace: (plan: NonNullable<typeof snapshot.value>['plan']) => plan ? workspacePlans.replace(request, plan) : Promise.resolve(),
    invalidate: () => workspacePlans.invalidateWorkspace(request.workspaceId),
    identity: resource,
    isActive: workspacePlans.isActive,
    isCurrent: () => workspacePlans.isActive() && current.current === resource,
  }
}
