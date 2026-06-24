/**
 * Workspace automation — API reference (read-only docs). No interactive
 * try-it by design: triggering a run is a real side effect. Documents the two
 * ways an automation run starts (self-scheduled file + external POST) and how a
 * run reports back. Replaces the old event-bus webhook page's "how to trigger
 * from outside" role for the new workspace-automation system.
 */

const CODE = 'rounded bg-black/30 px-1 py-0.5 font-mono text-[12px] text-text/90'

function Block({ children }: { children: string }) {
  return (
    <pre className="overflow-auto rounded bg-black/30 p-3 text-[12px] leading-snug text-muted whitespace-pre-wrap">
      {children}
    </pre>
  )
}

export function AutomationApiSection() {
  return (
    <div className="max-w-prose mx-auto space-y-6 text-sm leading-relaxed">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-text">Workspace automation</h2>
        <p className="text-muted">
          Automation is just a workspace run with no human attached: the same
          workspace, the same tools, spawned <em>headless</em> on a trigger. A run
          reaches you through the <span className="text-text">Inbox</span> — there
          is no other output channel. There are two ways a run starts.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-text">1 · Self-scheduled (the workspace declares it)</h3>
        <p className="text-muted">
          A workspace schedules itself by writing{' '}
          <code className={CODE}>.alice/schedule.json</code> in its own checkout. A
          launcher scanner reads it and fires each due task as a headless run.
          There is no central registry and no create API — scheduling is a coding
          task (the agent edits the file).
        </p>
        <Block>{`{
  "tasks": [
    {
      "id": "morning-scan",
      "when": { "kind": "cron", "cron": "30 8 * * 1-5" },
      "what": "Pull pre-market movers, write research/premarket.md, then push it to the inbox."
    },
    {
      "id": "thesis-watch",
      "when": { "kind": "every", "every": "1h" },
      "what": "Re-check thesis.md vs the latest quote; alert only if the invalidation level broke, else exit."
    }
  ]
}`}</Block>
        <ul className="ml-4 list-disc space-y-1 text-muted">
          <li>
            <code className={CODE}>when</code>: <code className={CODE}>{`{kind:"every", every:"30m"}`}</code>,{' '}
            <code className={CODE}>{`{kind:"cron", cron:"0 9 * * 1-5"}`}</code>, or{' '}
            <code className={CODE}>{`{kind:"at", at:"2026-03-01T13:30:00Z"}`}</code>.
          </li>
          <li>
            <code className={CODE}>what</code>: a standalone prompt for the headless run — conditions
            live in the prompt, not the schedule.
          </li>
          <li>The scanner ticks about once a minute; runs report (or deliberately stay silent) via the Inbox.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-text">2 · External trigger (POST a run)</h3>
        <p className="text-muted">Trigger a one-off headless run in a specific workspace over HTTP:</p>
        <Block>{`POST /api/workspaces/:id/headless
{
  "prompt": "<the instruction for the run>",
  "agent": "claude",      // optional; defaults to the workspace's default agent
  "timeoutMs": 1800000,   // optional
  "wait": false           // optional; true = block and return the run's result
}

  202  { "taskId": "..." }     // accepted, runs in the background (default)
  429                          // headless concurrency cap reached, retry later`}</Block>
        <p className="text-muted">
          This is the seam for an external system (a webhook bridge, a cron on
          another host) to drive a workspace. Every run is recorded under{' '}
          <span className="text-text">Runs</span>.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-text">Reporting back</h3>
        <p className="text-muted">
          A headless run has no UI. It surfaces results by pushing to the Inbox
          (the <code className={CODE}>alice-workspace inbox push</code> CLI, on every
          workspace's PATH). A run that produces a deliverable but never pushes
          leaves nothing behind — so a prompt should end by reporting, unless it
          was a check that deliberately found nothing to say.
        </p>
      </section>
    </div>
  )
}
