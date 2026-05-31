import { useState, useEffect, useCallback, useMemo } from 'react'
import { api, type AppConfig } from '../api'
import type { ToolInfo } from '../api/tools'
import { Toggle } from '../components/Toggle'
import { SaveIndicator } from '../components/SaveIndicator'
import { ConfigSection, Field, inputClass } from '../components/form'
import { useAutoSave } from '../hooks/useAutoSave'
import { PageHeader } from '../components/PageHeader'
import { PageLoading, EmptyState } from '../components/StateViews'

type SettingsLocale = 'en' | 'zh'

const SETTINGS_LOCALE_KEY = 'openalice-settings-locale'

type SettingsTextKey =
  | 'settingsTitle'
  | 'settingsTab'
  | 'toolsTab'
  | 'generalSectionTitle'
  | 'generalSectionDescription'
  | 'language'
  | 'languageEnglish'
  | 'languageChinese'
  | 'agentSectionTitle'
  | 'agentSectionDescription'
  | 'evolutionModeTitle'
  | 'evolutionModeFullAccess'
  | 'evolutionModeSandbox'
  | 'personaSectionTitle'
  | 'personaSectionDescription'
  | 'compactionSectionTitle'
  | 'compactionSectionDescription'
  | 'maxContextTokensLabel'
  | 'maxOutputTokensLabel'
  | 'loading'
  | 'save'
  | 'saving'
  | 'saved'
  | 'failedToLoadPersona'
  | 'failedToSave'
  | 'unsavedChanges'
  | 'noToolsTitle'
  | 'noToolsDescription'
  | 'toolsSummary'

const SETTINGS_TEXT: Record<SettingsLocale, Record<SettingsTextKey, string>> = {
  en: {
    settingsTitle: 'Settings',
    settingsTab: 'Settings',
    toolsTab: 'Tools',
    generalSectionTitle: 'General',
    generalSectionDescription: 'Global application preferences.',
    language: 'Language',
    languageEnglish: 'English',
    languageChinese: '中文',
    agentSectionTitle: 'Agent',
    agentSectionDescription:
      'Controls file-system and tool permissions for the AI. Changes apply on the next request.',
    evolutionModeTitle: 'Evolution Mode',
    evolutionModeFullAccess:
      'Full project access — AI can modify source code',
    evolutionModeSandbox:
      'Sandbox mode — AI can only edit data/brain/',
    personaSectionTitle: 'Persona',
    personaSectionDescription:
      "The system prompt that defines Alice's personality and behavior. Changes take effect on next server restart.",
    compactionSectionTitle: 'Compaction',
    compactionSectionDescription:
      'Context window management. When conversation size approaches Max Context minus Max Output tokens, older messages are automatically summarized to free up space.',
    maxContextTokensLabel: 'Max Context Tokens',
    maxOutputTokensLabel: 'Max Output Tokens',
    loading: 'Loading...',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Saved',
    failedToLoadPersona: 'Failed to load persona',
    failedToSave: 'Failed to save',
    unsavedChanges: 'Unsaved changes',
    noToolsTitle: 'No tools registered.',
    noToolsDescription: 'Tools will appear here when the engine starts.',
    toolsSummary:
      '{toolCount} tools in {groupCount} groups — changes apply on next AI request',
  },
  zh: {
    settingsTitle: '设置',
    settingsTab: '设置',
    toolsTab: '工具',
    generalSectionTitle: '通用',
    generalSectionDescription: '应用级核心设置。',
    language: '语言',
    languageEnglish: 'English',
    languageChinese: '中文',
    agentSectionTitle: '智能体',
    agentSectionDescription:
      '控制 AI 的文件系统与工具权限。配置变更会在下一次请求后生效。',
    evolutionModeTitle: '演进模式',
    evolutionModeFullAccess: '完整项目权限 — AI 可修改源码',
    evolutionModeSandbox: '沙盒模式 — AI 仅可编辑 data/brain/ 下文件',
    personaSectionTitle: '人格',
    personaSectionDescription:
      '定义 Alice 个性与行为的系统提示词。改动需在下次服务端重启后生效。',
    compactionSectionTitle: '压缩策略',
    compactionSectionDescription:
      '上下文窗口管理。当对话量接近“最大上下文”减“最大输出”时，系统会自动总结更早消息以释放空间。',
    maxContextTokensLabel: '最大上下文 Token',
    maxOutputTokensLabel: '最大输出 Token',
    loading: '加载中...',
    save: '保存',
    saving: '保存中...',
    saved: '已保存',
    failedToLoadPersona: '加载人格失败',
    failedToSave: '保存失败',
    unsavedChanges: '有未保存修改',
    noToolsTitle: '暂无工具注册。',
    noToolsDescription: '引擎启动后工具会在这里出现。',
    toolsSummary:
      '共 {toolCount} 个工具，{groupCount} 个分组 — 变更将在下一次 AI 请求生效',
  },
}

const GROUP_LABELS: Record<SettingsLocale, Record<string, string>> = {
  en: {
    thinking: 'Thinking Kit',
    cron: 'Cron Scheduler',
    equity: 'Equity Data',
    'crypto-data': 'Crypto Data',
    'currency-data': 'Currency Data',
    news: 'News',
    'news-archive': 'News Archive',
    analysis: 'Analysis Kit',
    'crypto-trading': 'Crypto Trading',
    'securities-trading': 'Securities Trading',
  },
  zh: {
    thinking: '思考工具',
    cron: '定时任务',
    equity: '股票数据',
    'crypto-data': '加密货币数据',
    'currency-data': '外汇数据',
    news: '新闻',
    'news-archive': '新闻归档',
    analysis: '分析工具',
    'crypto-trading': '加密货币交易',
    'securities-trading': '证券交易',
  },
}

function resolveSettingsLocale(): SettingsLocale {
  if (typeof window === 'undefined') return 'en'

  try {
    const raw = localStorage.getItem(SETTINGS_LOCALE_KEY)
    if (raw === 'zh' || raw === 'en') return raw
  } catch {
    // storage read failed, fallback below
  }

  const browser = (window.navigator?.language || '').toLowerCase()
  return browser.startsWith('zh') ? 'zh' : 'en'
}

function formatMessage(
  locale: SettingsLocale,
  key: SettingsTextKey,
  values?: Record<string, string | number>,
) {
  const template = SETTINGS_TEXT[locale][key]
  if (!values) return template
  return Object.entries(values).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
    template,
  )
}

function getGroupLabel(locale: SettingsLocale, key: string) {
  return GROUP_LABELS[locale][key] ?? key
}

// ==================== Settings Section ====================

function SettingsSection({
  locale,
  onLocaleChange,
}: {
  locale: SettingsLocale
  onLocaleChange: (locale: SettingsLocale) => void
}) {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const t = (key: SettingsTextKey, values?: Record<string, string | number>) =>
    formatMessage(locale, key, values)

  useEffect(() => {
    api.config.load().then(setConfig).catch(() => {})
  }, [])

  if (!config) return <PageLoading />

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[880px] mx-auto">
        {/* General */}
        <ConfigSection
          title={t('generalSectionTitle')}
          description={t('generalSectionDescription')}
        >
          <Field label={t('language')}>
            <div className="max-w-[220px] sm:max-w-[260px]">
              <select
                className={inputClass}
                value={locale}
                onChange={(e) => {
                  const nextLocale = e.target.value as SettingsLocale
                  onLocaleChange(nextLocale)
                }}
              >
                <option value="en">{t('languageEnglish')}</option>
                <option value="zh">{t('languageChinese')}</option>
              </select>
            </div>
          </Field>
        </ConfigSection>

        {/* Agent */}
        <ConfigSection
          title={t('agentSectionTitle')}
          description={t('agentSectionDescription')}
        >
          <div className="flex items-center justify-between gap-4 py-1">
            <div className="flex-1">
              <span className="text-sm font-medium text-text">
                {t('evolutionModeTitle')}
              </span>
              <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                {config.agent?.evolutionMode
                  ? t('evolutionModeFullAccess')
                  : t('evolutionModeSandbox')}
              </p>
            </div>
            <Toggle
              checked={config.agent?.evolutionMode || false}
              onChange={async (v) => {
                try {
                  await api.config.updateSection('agent', { ...config.agent, evolutionMode: v })
                  setConfig((c) =>
                    c ? { ...c, agent: { ...c.agent, evolutionMode: v } } : c,
                  )
                } catch {
                  // Toggle doesn't flip on failure
                }
              }}
            />
          </div>
        </ConfigSection>

        {/* Persona */}
        <ConfigSection
          title={t('personaSectionTitle')}
          description={t('personaSectionDescription')}
        >
          <PersonaEditor locale={locale} />
        </ConfigSection>

        {/* Compaction */}
        <ConfigSection
          title={t('compactionSectionTitle')}
          description={t('compactionSectionDescription')}
        >
          <CompactionForm config={config} locale={locale} />
        </ConfigSection>
      </div>
    </div>
  )
}

// ==================== Compaction Form ====================

function CompactionForm({ config, locale }: { config: AppConfig; locale: SettingsLocale }) {
  const [ctx, setCtx] = useState(String(config.compaction?.maxContextTokens || ''))
  const [out, setOut] = useState(String(config.compaction?.maxOutputTokens || ''))
  const t = (key: SettingsTextKey, values?: Record<string, string | number>) =>
    formatMessage(locale, key, values)

  const data = useMemo(
    () => ({ maxContextTokens: Number(ctx), maxOutputTokens: Number(out) }),
    [ctx, out],
  )

  const save = useCallback(async (d: { maxContextTokens: number; maxOutputTokens: number }) => {
    await api.config.updateSection('compaction', d)
  }, [])

  const { status, retry } = useAutoSave({ data, save })

  return (
    <>
      <Field label={t('maxContextTokensLabel')}>
        <input
          className={inputClass}
          type="number"
          step={1000}
          value={ctx}
          onChange={(e) => setCtx(e.target.value)}
        />
      </Field>
      <Field label={t('maxOutputTokensLabel')}>
        <input
          className={inputClass}
          type="number"
          step={1000}
          value={out}
          onChange={(e) => setOut(e.target.value)}
        />
      </Field>
      <SaveIndicator status={status} onRetry={retry} />
    </>
  )
}

// ==================== Persona Editor ====================

function PersonaEditor({ locale }: { locale: SettingsLocale }) {
  const [content, setContent] = useState('')
  const [filePath, setFilePath] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const t = (key: SettingsTextKey, values?: Record<string, string | number>) =>
    formatMessage(locale, key, values)

  const loadPersonaError = t('failedToLoadPersona')

  useEffect(() => {
    api.persona.get()
      .then(({ content, path }) => {
        setContent(content)
        setFilePath(path)
      })
      .catch(() => setError(loadPersonaError))
      .finally(() => setLoading(false))
  }, [loadPersonaError])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await api.persona.update(content)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError(t('failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-text-muted">{t('loading')}</div>

  return (
    <>
      <textarea
        className={`${inputClass} min-h-[200px] max-h-[400px] resize-y font-mono text-xs leading-relaxed`}
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          setDirty(true)
        }}
      />
      <div className="flex items-center gap-2 mt-2">
        <button onClick={handleSave} disabled={saving || !dirty} className="btn-primary-sm">
          {saving ? t('saving') : t('save')}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-green" />
            <span className="text-text-muted">{t('saved')}</span>
          </span>
        )}
        {error && (
          <span className="inline-flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-red" />
            <span className="text-red">{error}</span>
          </span>
        )}
        {dirty && !saved && !error && (
          <span className="text-[11px] text-text-muted">{t('unsavedChanges')}</span>
        )}
      </div>
      {filePath && <p className="text-[11px] text-text-muted mt-1">{filePath}</p>}
    </>
  )
}

// ==================== Tools Section ====================

interface ToolGroup {
  key: string
  label: string
  tools: ToolInfo[]
}

function ToolsSection({ locale }: { locale: SettingsLocale }) {
  const [inventory, setInventory] = useState<ToolInfo[]>([])
  const [disabled, setDisabled] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const t = (key: SettingsTextKey, values?: Record<string, string | number>) =>
    formatMessage(locale, key, values)

  useEffect(() => {
    api.tools.load()
      .then((res) => {
        setInventory(res.inventory)
        setDisabled(new Set(res.disabled))
        setLoaded(true)
      })
      .catch(() => {})
  }, [])

  const groups = useMemo<ToolGroup[]>(() => {
    const map = new Map<string, ToolInfo[]>()
    for (const t of inventory) {
      if (!map.has(t.group)) map.set(t.group, [])
      map.get(t.group)!.push(t)
    }
    return Array.from(map.entries()).map(([key, tools]) => ({
      key,
      label: getGroupLabel(locale, key),
      tools: tools.sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }, [inventory])

  const configData = useMemo(
    () => ({ disabled: [...disabled].sort() }),
    [disabled],
  )

  const save = useCallback(async (d: { disabled: string[] }) => {
    await api.tools.update(d.disabled)
  }, [])

  const { status, retry } = useAutoSave({ data: configData, save, enabled: loaded })

  const toggleTool = useCallback((name: string) => {
    setDisabled((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const toggleGroup = useCallback((tools: ToolInfo[], enable: boolean) => {
    setDisabled((prev) => {
      const next = new Set(prev)
      for (const t of tools) {
        if (enable) next.delete(t.name)
        else next.add(t.name)
      }
      return next
    })
  }, [])

  const toggleExpanded = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return (
    <div className="flex-1 overflow-y-auto">
      {!loaded ? (
        <PageLoading />
      ) : groups.length === 0 ? (
        <EmptyState
          title={t('noToolsTitle')}
          description={t('noToolsDescription')}
        />
      ) : (
        <div className="max-w-[880px] mx-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] text-text-muted">
              {t('toolsSummary', { toolCount: inventory.length, groupCount: groups.length })}
            </p>
            <SaveIndicator status={status} onRetry={retry} />
          </div>
          <div className="space-y-2">
            {groups.map((g) => (
              <ToolGroupCard
                key={g.key}
                group={g}
                disabled={disabled}
                expanded={expanded.has(g.key)}
                onToggleExpanded={() => toggleExpanded(g.key)}
                onToggleTool={toggleTool}
                onToggleGroup={toggleGroup}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== ToolGroupCard ====================

interface ToolGroupCardProps {
  group: ToolGroup
  disabled: Set<string>
  expanded: boolean
  onToggleExpanded: () => void
  onToggleTool: (name: string) => void
  onToggleGroup: (tools: ToolInfo[], enable: boolean) => void
}

function ToolGroupCard({
  group,
  disabled,
  expanded,
  onToggleExpanded,
  onToggleTool,
  onToggleGroup,
}: ToolGroupCardProps) {
  const enabledCount = group.tools.filter((t) => !disabled.has(t.name)).length
  const noneEnabled = enabledCount === 0

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-secondary">
        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm font-medium text-text truncate">{group.label}</span>
          <span className="text-[11px] text-text-muted shrink-0">
            {enabledCount}/{group.tools.length}
          </span>
        </button>
        <Toggle
          size="sm"
          checked={!noneEnabled}
          onChange={(v) => onToggleGroup(group.tools, v)}
        />
      </div>

      {/* Tool list */}
      <div
        className={`transition-all duration-150 ${
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="divide-y divide-border">
          {group.tools.map((t) => {
            const enabled = !disabled.has(t.name)
            return (
              <div
                key={t.name}
                className={`flex items-center gap-3 px-4 py-2 ${enabled ? '' : 'opacity-50'}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] text-text font-mono">{t.name}</span>
                  {t.description && (
                    <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">
                      {t.description}
                    </p>
                  )}
                </div>
                <Toggle
                  size="sm"
                  checked={enabled}
                  onChange={() => onToggleTool(t.name)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ==================== Page ====================

type Tab = 'settings' | 'tools'

const TABS: { key: Tab; labelKey: SettingsTextKey }[] = [
  { key: 'settings', labelKey: 'settingsTab' },
  { key: 'tools', labelKey: 'toolsTab' },
]

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('settings')
  const [locale, setLocale] = useState<SettingsLocale>(resolveSettingsLocale())

  const handleLocaleChange = useCallback((nextLocale: SettingsLocale) => {
    if (nextLocale === locale) return
    try {
      localStorage.setItem(SETTINGS_LOCALE_KEY, nextLocale)
    } catch {
      // ignore storage write errors
    }
    setLocale(nextLocale)
    window.location.reload()
  }, [locale])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageHeader title={formatMessage(locale, 'settingsTitle')} />

      <div className="px-4 md:px-6 border-b border-border/60">
        <div className="flex gap-1">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`px-3 py-2 text-sm font-medium transition-colors relative ${
                tab === tabItem.key ? 'text-accent' : 'text-text-muted hover:text-text'
              }`}
            >
              {formatMessage(locale, tabItem.labelKey)}
              {tab === tabItem.key && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 px-4 md:px-8 py-6">
        <div className="flex-1 min-h-0">
          {tab === 'settings' ? (
            <SettingsSection locale={locale} onLocaleChange={handleLocaleChange} />
          ) : (
            <ToolsSection locale={locale} />
          )}
        </div>
      </div>
    </div>
  )
}
