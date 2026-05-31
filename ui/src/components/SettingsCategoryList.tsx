import { useWorkspace } from '../tabs/store'
import { getFocusedTab, type ViewSpec } from '../tabs/types'
import { SidebarRow } from './SidebarRow'

type SettingsCategory = Extract<ViewSpec, { kind: 'settings' }>['params']['category']
type SettingsLocale = 'en' | 'zh'

interface CategoryItem {
  labelKey: keyof typeof SETTINGS_CATEGORY_TEXT.en
  category: SettingsCategory
}

const SETTINGS_CATEGORY_TEXT: Record<
  SettingsLocale,
  Record<SettingsCategory, string>
> = {
  en: {
    general: 'General',
    'ai-provider': 'AI Provider',
    trading: 'Trading',
    connectors: 'Connectors',
    mcp: 'MCP Server',
    'market-data': 'Market Data',
    'news-collector': 'News Sources',
  },
  zh: {
    general: '通用',
    'ai-provider': 'AI 提供商',
    trading: '交易',
    connectors: '连接器',
    mcp: 'MCP 服务',
    'market-data': '市场数据',
    'news-collector': '新闻源',
  },
}

const SETTINGS_LOCALE_KEY = 'openalice-settings-locale'

function resolveSettingsLocale(): SettingsLocale {
  if (typeof window === 'undefined') return 'en'

  try {
    const raw = localStorage.getItem(SETTINGS_LOCALE_KEY)
    if (raw === 'zh' || raw === 'en') return raw
  } catch {
    // ignore storage access errors
  }

  const browser = (window.navigator?.language || '').toLowerCase()
  return browser.startsWith('zh') ? 'zh' : 'en'
}

function formatSettingsText(
  locale: SettingsLocale,
  labelKey: keyof typeof SETTINGS_CATEGORY_TEXT.en,
) {
  return SETTINGS_CATEGORY_TEXT[locale][labelKey]
}

const CATEGORIES: CategoryItem[] = [
  { labelKey: 'general', category: 'general' },
  { labelKey: 'ai-provider', category: 'ai-provider' },
  { labelKey: 'trading', category: 'trading' },
  // Connectors moved to its own ActivityBar Legacy entry — see
  // ConnectorsLegacySidebar.
  { labelKey: 'mcp', category: 'mcp' },
  { labelKey: 'market-data', category: 'market-data' },
  { labelKey: 'news-collector', category: 'news-collector' },
]

/**
 * Settings sidebar — flat list of config categories. Click opens (or
 * focuses) the corresponding tab. Active highlight is driven by the
 * currently-focused tab's spec, not by sidebar selection.
 */
export function SettingsCategoryList() {
  const focused = useWorkspace((state) => getFocusedTab(state)?.spec)
  const openOrFocus = useWorkspace((state) => state.openOrFocus)
  const locale = resolveSettingsLocale()

  return (
    <div className="py-0.5">
      {CATEGORIES.map((item) => {
        const active =
          focused?.kind === 'settings' && focused.params.category === item.category
        return (
          <SidebarRow
            key={item.category}
            label={formatSettingsText(locale, item.labelKey)}
            active={active}
            onClick={() => openOrFocus({ kind: 'settings', params: { category: item.category } })}
          />
        )
      })}

    </div>
  )
}
