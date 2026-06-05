import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

type TradingViewDataFeed = Record<string, unknown>
type TradingViewWidgetInstance = { remove: () => void }

interface TradingViewWidgetConfig {
  symbol: string
  interval: string
  container_id: string
  datafeed: TradingViewDataFeed
  locale?: string
  theme?: 'Light' | 'Dark'
  autosize?: boolean
  width?: string
  height?: string
  library_path?: string
  disabled_features?: string[]
  enabled_features?: string[]
  allow_symbol_change?: boolean
  hide_side_toolbar?: boolean
  withdateranges?: boolean
  [key: string]: unknown
}

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: TradingViewWidgetConfig) => TradingViewWidgetInstance
    }
  }
}

interface TradingViewWidgetProps {
  symbol?: string
  interval?: string
  dataFeed?: TradingViewDataFeed
  locale?: string
  theme?: 'light' | 'dark'
  libraryPath?: string
  width?: number | string
  height?: number | string
  containerClassName?: string
  containerStyle?: CSSProperties
  disabledFeatures?: string[]
  enabledFeatures?: string[]
}

const DEFAULT_LIBRARY_PATH = '/tradingview/charting_library/charting_library.js'

function toPixel(value: number | string | undefined, fallback: string): string {
  if (value === undefined) return fallback
  return typeof value === 'number' ? `${value}px` : value
}

function scriptId(path: string): string {
  return `openalice-tv-lib-${path.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

export function TradingViewWidget({
  symbol = 'AAPL',
  interval = '1',
  dataFeed,
  locale = 'en',
  theme = 'dark',
  libraryPath = DEFAULT_LIBRARY_PATH,
  width,
  height,
  containerClassName,
  containerStyle,
  disabledFeatures,
  enabledFeatures,
}: TradingViewWidgetProps) {
  const [error, setError] = useState<string | null>(null)
  const widgetRef = useRef<TradingViewWidgetInstance | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const containerIdRef = useRef<string>(
    `openalice-tv-${Math.random().toString(36).slice(2, 11)}`,
  )

  useEffect(() => {
    if (!containerRef.current) return

    setError(null)

    if (!dataFeed) {
      setError('TradingView Widget 需要传入 dataFeed（Charting Library 的数据适配器）。')
      return
    }

    let cancelled = false

    const ensureLibraryReady = (): Promise<void> => {
      const existing = document.getElementById(scriptId(libraryPath))
      if (existing) {
        return new Promise((resolve, reject) => {
          if (window.TradingView?.widget) {
            resolve()
            return
          }
          const onLoad = () => {
            if (window.TradingView?.widget) resolve()
            else reject(new Error('TradingView 脚本加载完成，但未暴露 window.TradingView.widget'))
          }
          const onError = () => reject(new Error('TradingView 脚本加载失败'))
          existing.addEventListener('load', onLoad, { once: true })
          existing.addEventListener('error', onError, { once: true })
        })
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.id = scriptId(libraryPath)
        script.src = libraryPath
        script.async = true
        script.onload = () => {
          if (window.TradingView?.widget) resolve()
          else reject(new Error('TradingView 脚本加载完成，但未暴露 window.TradingView.widget'))
        }
        script.onerror = () => reject(new Error('TradingView 脚本加载失败'))
        document.body.appendChild(script)
      })
    }

    const init = async () => {
      try {
        await ensureLibraryReady()
        if (cancelled) return

        if (!window.TradingView?.widget) {
          setError('TradingView 全局对象加载失败。')
          return
        }

        if (widgetRef.current) {
          widgetRef.current.remove()
          widgetRef.current = null
        }

        const finalTheme = theme === 'light' ? 'Light' : 'Dark'
        const options: TradingViewWidgetConfig = {
          symbol,
          interval,
          container_id: containerIdRef.current,
          datafeed: dataFeed,
          library_path: libraryPath,
          locale,
          theme: finalTheme,
          autosize: true,
          allow_symbol_change: true,
          hide_side_toolbar: false,
          withdateranges: true,
          disabled_features: disabledFeatures,
          enabled_features: enabledFeatures,
          width: toPixel(width, '100%'),
          height: toPixel(height, '420px'),
        }

        widgetRef.current = new window.TradingView.widget(options)
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e)
          setError(`TradingView 初始化失败：${message}`)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (widgetRef.current) {
        widgetRef.current.remove()
        widgetRef.current = null
      }
    }
  }, [symbol, interval, dataFeed, disabledFeatures, enabledFeatures, locale, libraryPath, theme, width, height])

  const mergedStyle: CSSProperties = {
    width: toPixel(width, '100%'),
    height: toPixel(height, '420px'),
    minHeight: toPixel(height, '420px'),
    position: 'relative',
    ...containerStyle,
  }

  return (
    <div className={containerClassName} style={mergedStyle}>
      <div
        ref={containerRef}
        id={containerIdRef.current}
        style={{ width: '100%', height: '100%' }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-secondary/60 text-xs text-text-muted px-4 text-center">
          {error}
        </div>
      )}
      {!window.TradingView && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-secondary/40 text-xs text-text-muted px-4 text-center">
          如需接入 TradingView，需要放置 `public/tradingview/charting_library/charting_library.js`，并传入 dataFeed 适配器
        </div>
      )}
    </div>
  )
}

