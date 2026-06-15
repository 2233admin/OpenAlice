import { useEffect, useMemo, useRef, useState } from 'react';
import { formatRelativeTime } from '../../lib/intl';
import type { ReactElement } from 'react';
import { Bot, Code2, Cpu, LayoutGrid, Library, Play, Sparkles, Square, Terminal, X, type LucideIcon } from 'lucide-react';

import { headlessApi, type HeadlessTaskRecord } from '../../api/headless';
import {
  deleteWorkspace,
  type AgentInfo,
  type SessionRecord,
  type TemplateInfo,
  type Workspace,
} from './api';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';

const HEADLESS_POLL_MS = 5000;

export interface Selection {
  readonly wsId: string;
  readonly sessionId: string | null;
}

export interface SpawnOpts {
  readonly resume?: 'last' | string;
  readonly agent?: string;
}

export interface SidebarProps {
  readonly workspaces: readonly Workspace[];
  readonly templates: readonly TemplateInfo[];
  readonly agents: readonly AgentInfo[];
  readonly listError: string | null;
  readonly selection: Selection | null;
  readonly onSelectWorkspace: (wsId: string) => void;
  readonly onSelectSession: (wsId: string, sessionId: string) => void;
  readonly onSpawn: (wsId: string, opts?: SpawnOpts) => void;
  readonly onPauseSession: (wsId: string, sessionId: string) => void;
  readonly onResumeSession: (wsId: string, sessionId: string) => void;
  readonly onDeleteSession: (wsId: string, sessionId: string) => void;
  readonly onChanged: () => void;
  /** Optional: open the per-workspace AI-provider config modal. */
  readonly onConfigureWorkspace?: (wsId: string) => void;
  /** Open the Workspaces Overview dashboard tab (card view of all workspaces). */
  readonly onOpenOverview?: () => void;
  /** True when the Workspaces Overview tab is currently focused — highlights the pinned row. */
  readonly overviewActive?: boolean;
  /** Open the Templates catalog tab (one card per workspace template). */
  readonly onOpenTemplates?: () => void;
  /** True when a Templates tab (catalog or detail) is currently focused. */
  readonly templatesActive?: boolean;
}

export function Sidebar(props: SidebarProps): ReactElement {
  const [showCreate, setShowCreate] = useState(false);

  // Headless runs, polled once for the whole tree (not per-workspace) and
  // grouped client-side. Low-frequency passive surface → plain polling.
  const [headlessTasks, setHeadlessTasks] = useState<readonly HeadlessTaskRecord[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const tasks = await headlessApi.list({ limit: 200 });
        if (!cancelled) setHeadlessTasks(tasks);
      } catch {
        /* sidebar group just stays as-is; the Automation panel surfaces errors */
      }
    };
    void load();
    const id = setInterval(() => void load(), HEADLESS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  const headlessByWs = useMemo(() => {
    const map = new Map<string, HeadlessTaskRecord[]>();
    for (const t of headlessTasks) {
      const list = map.get(t.wsId);
      if (list) list.push(t);
      else map.set(t.wsId, [t]);
    }
    return map;
  }, [headlessTasks]);

  const onDelete = async (id: string): Promise<void> => {
    if (!window.confirm('Delete workspace? (registry only — files on disk are kept.)')) return;
    const ok = await deleteWorkspace(id);
    if (ok) {
      props.onChanged();
      if (props.selection?.wsId === id) props.onSelectWorkspace('');
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Workspaces</span>
        <button
          type="button"
          className="sidebar-new-btn"
          onClick={() => setShowCreate(true)}
          aria-label="New workspace"
        >
          +
        </button>
      </div>

      {showCreate && (
        <CreateWorkspaceDialog
          templates={props.templates}
          agents={props.agents}
          onCreated={(workspace) => {
            props.onChanged();
            props.onSelectWorkspace(workspace.id);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      <ul className="sidebar-list">
        {props.onOpenOverview && (
          <li className="sidebar-overview-row">
            <button
              type="button"
              className={`sidebar-overview-btn${props.overviewActive ? ' is-active' : ''}`}
              onClick={props.onOpenOverview}
              title="Card-based dashboard of all workspaces"
            >
              <LayoutGrid size={13} strokeWidth={2.25} aria-hidden="true" />
              <span>Overview</span>
            </button>
          </li>
        )}
        {props.onOpenTemplates && (
          <li className="sidebar-overview-row">
            <button
              type="button"
              className={`sidebar-overview-btn${props.templatesActive ? ' is-active' : ''}`}
              onClick={props.onOpenTemplates}
              title="Browse workspace templates"
            >
              <Library size={13} strokeWidth={2.25} aria-hidden="true" />
              <span>Templates</span>
            </button>
          </li>
        )}
        {props.workspaces.length === 0 && !props.listError && (
          <li className="sidebar-empty">no workspaces yet</li>
        )}
        {props.listError && <li className="sidebar-error">{props.listError}</li>}
        {props.workspaces.map((w) => (
          <WorkspaceRow
            key={w.id}
            workspace={w}
            agents={props.agents}
            selection={props.selection}
            headlessTasks={headlessByWs.get(w.id) ?? []}
            onSelectWorkspace={props.onSelectWorkspace}
            onSelectSession={props.onSelectSession}
            onSpawn={props.onSpawn}
            onPauseSession={props.onPauseSession}
            onResumeSession={props.onResumeSession}
            onDeleteSession={props.onDeleteSession}
            onDelete={onDelete}
            onConfigureWorkspace={props.onConfigureWorkspace}
          />
        ))}
      </ul>
    </aside>
  );
}

export interface WorkspaceRowProps {
  readonly workspace: Workspace;
  readonly agents: readonly AgentInfo[];
  readonly selection: Selection | null;
  /** This workspace's headless (automation) runs, newest-first. */
  readonly headlessTasks?: readonly HeadlessTaskRecord[];
  readonly onSelectWorkspace: (wsId: string) => void;
  readonly onSelectSession: (wsId: string, sessionId: string) => void;
  readonly onSpawn: (wsId: string, opts?: SpawnOpts) => void;
  readonly onPauseSession: (wsId: string, sessionId: string) => void;
  readonly onResumeSession: (wsId: string, sessionId: string) => void;
  readonly onDeleteSession: (wsId: string, sessionId: string) => void;
  readonly onDelete: (id: string) => Promise<void>;
  readonly onConfigureWorkspace?: (wsId: string) => void;
}

function agentLabel(id: string, agents: readonly AgentInfo[]): string {
  const a = agents.find((x) => x.id === id);
  return a?.displayName ?? id;
}

function agentPrefix(id: string): string {
  if (id === 'claude') return 'c';
  if (id === 'codex') return 'x';
  if (id === 'shell') return 'sh';
  return id[0] ?? '?';
}

/**
 * Glyph for a given agent SDK. Icon-first so users don't have to learn the
 * `c1` / `x1` / `sh1` naming convention — at-a-glance they see which CLI
 * the session is running. Unknown adapter id falls back to its first
 * letter (text), keeping the badge non-empty even for future adapters
 * before they get an icon.
 */
const AGENT_ICONS: Record<string, LucideIcon> = {
  claude: Sparkles,
  codex: Cpu,
  opencode: Code2,
  pi: Bot,
  shell: Terminal,
};

function AgentBadgeGlyph({ agentId }: { agentId: string }): ReactElement {
  const Icon = AGENT_ICONS[agentId];
  if (Icon) return <Icon size={11} strokeWidth={2.25} aria-hidden="true" />;
  return <span aria-hidden="true">{agentPrefix(agentId)}</span>;
}

export function WorkspaceRow(props: WorkspaceRowProps): ReactElement {
  const w = props.workspace;
  const isSelected = props.selection?.wsId === w.id && props.selection.sessionId === null;
  const hasRunning = w.sessions.some((s) => s.state === 'running');

  const [spawnMenuOpen, setSpawnMenuOpen] = useState(false);
  const plusBtnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!spawnMenuOpen) return;
    const onDocClick = (e: MouseEvent): void => {
      const t = e.target as Node | null;
      if (plusBtnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setSpawnMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSpawnMenuOpen(false);
    };
    const tid = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    document.addEventListener('keydown', onEsc);
    return () => {
      clearTimeout(tid);
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [spawnMenuOpen]);

  const onPlusClick = (): void => {
    if (w.agents.length <= 1) {
      props.onSpawn(w.id, { agent: w.agents[0] ?? 'claude' });
      return;
    }
    setSpawnMenuOpen((v) => !v);
  };

  const onMenuPick = (agentId: string): void => {
    setSpawnMenuOpen(false);
    props.onSpawn(w.id, { agent: agentId });
  };

  const plusTitle =
    w.agents.length === 1
      ? `spawn a new ${agentLabel(w.agents[0]!, props.agents)} session`
      : 'spawn a new session…';

  return (
    <li className="sidebar-tree-item">
      <div className={`sidebar-row ${isSelected ? 'is-selected' : ''}`}>
        <button
          type="button"
          className="sidebar-row-main"
          onClick={() => props.onSelectWorkspace(w.id)}
          title={w.tag}
        >
          <span
            className="sidebar-status-dot"
            style={{ background: hasRunning ? '#7ee787' : '#6e7681' }}
            title={hasRunning ? `${w.sessions.filter((s) => s.state === 'running').length} running` : 'idle'}
          />
          <span className="sidebar-tag">{w.tag}</span>
          <span className="sidebar-meta">{formatRelativeTime(w.createdAt)}</span>
        </button>
        {w.agents.length > 0 && (
          <div className="sidebar-spawn-wrap">
            <button
              ref={plusBtnRef}
              type="button"
              className="sidebar-action sidebar-action-spawn"
              title={plusTitle}
              aria-haspopup={w.agents.length > 1}
              aria-expanded={spawnMenuOpen}
              onClick={onPlusClick}
            >
              +
            </button>
            {spawnMenuOpen && (
              <ul ref={menuRef} className="sidebar-spawn-menu" role="menu">
                {w.agents.map((agentId) => (
                  <li key={agentId}>
                    <button
                      type="button"
                      role="menuitem"
                      className="sidebar-spawn-menu-item"
                      onClick={() => onMenuPick(agentId)}
                    >
                      <span className="sidebar-spawn-menu-prefix">+</span>
                      <span className="sidebar-spawn-menu-name">{agentLabel(agentId, props.agents)}</span>
                      <span className="sidebar-spawn-menu-suffix">{agentPrefix(agentId)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {props.onConfigureWorkspace && (
          <button
            type="button"
            className="sidebar-action sidebar-action-config"
            title="configure AI provider for this workspace"
            onClick={() => props.onConfigureWorkspace?.(w.id)}
          >
            ⚙
          </button>
        )}
        <button
          type="button"
          className="sidebar-action sidebar-action-delete"
          title="delete workspace"
          onClick={() => void props.onDelete(w.id)}
        >
          ×
        </button>
      </div>

      {w.sessions.length > 0 && (
        <ul className="sidebar-children">
          {w.sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              isActive={props.selection?.wsId === w.id && props.selection.sessionId === s.id}
              onSelect={() => props.onSelectSession(w.id, s.id)}
              onPause={() => props.onPauseSession(w.id, s.id)}
              onResume={() => props.onResumeSession(w.id, s.id)}
              onDelete={() => props.onDeleteSession(w.id, s.id)}
            />
          ))}
        </ul>
      )}

      {(props.headlessTasks?.length ?? 0) > 0 && (
        <HeadlessGroup
          tasks={props.headlessTasks!}
          onOpenAsSession={(t) => props.onSpawn(w.id, { resume: t.agentSessionId!, agent: t.agent })}
        />
      )}
    </li>
  );
}

// ── headless runs (the collapsed second tier under a workspace) ─────────────

const HEADLESS_DOT: Record<HeadlessTaskRecord['status'], string> = {
  running: '#58a6ff',
  done: '#6e7681',
  failed: '#f85149',
  interrupted: '#d29922',
};

/**
 * The boss/employee visual hierarchy: interactive sessions are the first-class
 * rows; headless (automation) runs live in this one collapsed group beneath
 * them — out of the way until the user actually wants to check on a worker.
 * Expanding shows each run; a finished run with a captured agent session id
 * gets the ▸ "open as session" action, which resumes the run's conversation
 * in a normal interactive session (terminal tab) for inspection/takeover.
 * Runs still in flight are view-only (concurrent resume is undefined) — the
 * Automation panel has the live output log.
 */
function HeadlessGroup(props: {
  readonly tasks: readonly HeadlessTaskRecord[];
  readonly onOpenAsSession: (t: HeadlessTaskRecord) => void;
}): ReactElement {
  const [open, setOpen] = useState(false); // collapsed by default, by design
  const runningCount = props.tasks.filter((t) => t.status === 'running').length;

  return (
    <div className="sidebar-headless">
      <button
        type="button"
        className="sidebar-headless-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={
          runningCount > 0
            ? `headless runs — ${runningCount} running`
            : 'headless runs (automation)'
        }
      >
        <span className="sidebar-headless-caret">{open ? '▾' : '▸'}</span>
        <span className="sidebar-headless-label">headless</span>
        <span className="sidebar-headless-count">{props.tasks.length}</span>
        {runningCount > 0 && (
          <span
            className="sidebar-status-dot sidebar-headless-running-dot"
            style={{ background: HEADLESS_DOT.running }}
          />
        )}
      </button>
      {open && (
        <ul className="sidebar-headless-list">
          {props.tasks.map((t) => (
            <HeadlessTaskRow key={t.taskId} task={t} onOpenAsSession={props.onOpenAsSession} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HeadlessTaskRow(props: {
  readonly task: HeadlessTaskRecord;
  readonly onOpenAsSession: (t: HeadlessTaskRecord) => void;
}): ReactElement {
  const t = props.task;
  const openable = t.status !== 'running' && !!t.agentSessionId;
  const titleParts = [`${t.agent} · ${t.status}`, formatRelativeTime(t.startedAt)];
  if (t.error) titleParts.push(t.error);
  titleParts.push(t.prompt);

  return (
    <li className="sidebar-headless-item" title={titleParts.join('\n')}>
      <span
        className="sidebar-status-dot"
        style={{ background: HEADLESS_DOT[t.status] }}
        aria-label={t.status}
      />
      <span className={`sidebar-agent-badge is-${t.agent} is-paused`}>
        <AgentBadgeGlyph agentId={t.agent} />
      </span>
      <span className="sidebar-headless-prompt">{t.prompt}</span>
      {openable && (
        <button
          type="button"
          className="sidebar-session-action sidebar-session-resume"
          title="open this run as an interactive session"
          onClick={(e) => {
            e.stopPropagation();
            props.onOpenAsSession(t);
          }}
        >
          ▸
        </button>
      )}
    </li>
  );
}

export interface SessionRowProps {
  session: SessionRecord;
  isActive: boolean;
  onSelect: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}

export function SessionRow(props: SessionRowProps): ReactElement {
  const s = props.session;
  const isPaused = s.state === 'paused';
  // Title: the captured first message (seeded sessions), else the sticky name.
  const display = s.title?.trim() || s.name;
  const tidShort = s.agentSessionId ? s.agentSessionId.slice(0, 8) : null;
  const metaParts: string[] = [`agent ${s.agent}`];
  if (s.pid !== null) metaParts.push(`pid ${s.pid}`);
  if (tidShort) metaParts.push(tidShort);
  if (isPaused) metaParts.push('paused');
  const meta = metaParts.join(' · ');
  // Full message on hover when it's been truncated, then the technical meta.
  const tooltip = s.title?.trim() ? `${s.title.trim()}\n${meta}` : meta;

  return (
    <li
      className={`sidebar-session ${props.isActive ? 'is-active' : ''} ${isPaused ? 'is-paused' : ''}`}
    >
      <button type="button" className="sidebar-session-main" onClick={props.onSelect} title={tooltip}>
        <span className={`sidebar-agent-badge is-${s.agent} ${isPaused ? 'is-paused' : ''}`}>
          <AgentBadgeGlyph agentId={s.agent} />
        </span>
        <span className="sidebar-session-name">{display}</span>
      </button>
      {/* Right-aligned, always-visible state-as-action: a running session shows
          STOP (■, click to pause it); a paused one shows PLAY (▶, click to
          resume). The glyph is the at-a-glance state AND the action; the shape
          stays put on the right edge regardless of title length. */}
      {isPaused ? (
        <button
          type="button"
          className="sidebar-session-action sidebar-session-resume is-persistent"
          title="resume this session"
          aria-label="resume this session"
          onClick={(e) => {
            e.stopPropagation();
            props.onResume();
          }}
        >
          <Play size={11} strokeWidth={0} fill="currentColor" />
        </button>
      ) : (
        <button
          type="button"
          className="sidebar-session-action sidebar-session-pause is-persistent"
          title="stop this session"
          aria-label="stop this session"
          onClick={(e) => {
            e.stopPropagation();
            props.onPause();
          }}
        >
          <Square size={10} strokeWidth={0} fill="currentColor" />
        </button>
      )}
      <button
        type="button"
        className="sidebar-session-action sidebar-session-delete"
        title="delete this session"
        aria-label="delete this session"
        onClick={(e) => {
          e.stopPropagation();
          props.onDelete();
        }}
      >
        <X size={12} strokeWidth={2.5} />
      </button>
    </li>
  );
}

