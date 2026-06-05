/**
 * Reusable markdown renderer with syntax-highlighted code blocks and copy buttons.
 *
 * Extracted from ChatMessage so other surfaces can render assistant text with
 * the same typography without inheriting chat chrome.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Marked, type TokenizerAndRendererExtension } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import 'highlight.js/styles/github-dark.min.css'

import { useWikilinkHandler } from '../live/wikilink'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Obsidian-style `[[name]]` wikilinks → clickable entity references.
 *
 * Inline marked extension (not a regex preprocess) so it never fires
 * inside code spans / fenced blocks — marked only offers the token stream
 * to extensions in inline contexts. Mirrors the backend matcher in
 * `src/core/entity-backlinks.ts` (`/\[\[([^[\]\n]+)\]\]/`). The rendered
 * anchor carries the lowercased entity key in `data-entity` (entity keys
 * are case-insensitive); MarkdownContent delegates the actual navigation
 * on click so this module stays a pure string renderer.
 */
const wikilinkExtension: TokenizerAndRendererExtension = {
  name: 'wikilink',
  level: 'inline',
  start(src: string) {
    return src.indexOf('[[')
  },
  tokenizer(src: string) {
    const m = /^\[\[([^[\]\n]+)\]\]/.exec(src)
    if (!m) return undefined
    return { type: 'wikilink', raw: m[0], text: m[1]!.trim() }
  },
  renderer(token) {
    const name = token.text as string
    const key = name.toLowerCase()
    return `<a class="wikilink" data-entity="${escapeHtml(key)}">${escapeHtml(name)}</a>`
  },
}

// Shared Marked instance (parser config is stateless — safe to reuse).
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    },
  }),
  { breaks: true },
)
marked.use({ extensions: [wikilinkExtension] })

const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

function addCodeBlockWrappers(html: string): string {
  return html.replace(
    /<pre><code class="hljs language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
    (_, lang, code) =>
      `<div class="code-block-wrapper"><div class="code-header"><span>${lang}</span><button class="code-copy-btn" data-code>${COPY_ICON} Copy</button></div><pre><code class="hljs language-${lang}">${code}</code></pre></div>`,
  ).replace(
    /<pre><code class="hljs">([\s\S]*?)<\/code><\/pre>/g,
    (_, code) =>
      `<div class="code-block-wrapper"><div class="code-header"><span>code</span><button class="code-copy-btn" data-code>${COPY_ICON} Copy</button></div><pre><code class="hljs">${code}</code></pre></div>`,
  )
}

interface MarkdownContentProps {
  text: string
  className?: string
  /**
   * Click handler for `[[name]]` wikilinks, receiving the lowercased entity
   * key. Defaults to jumping to the Tracked activity (see useWikilinkHandler).
   * Pass an explicit handler to override (e.g. tests, alternate surfaces).
   */
  onWikilink?: (entityKey: string) => void
}

export function MarkdownContent({ text, className, onWikilink }: MarkdownContentProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const defaultWikilink = useWikilinkHandler()
  const wikilink = onWikilink ?? defaultWikilink

  const html = useMemo(() => {
    const raw = DOMPurify.sanitize(marked.parse(text) as string)
    return addCodeBlockWrappers(raw)
  }, [text])

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a.wikilink') as HTMLElement | null
      if (link) {
        e.preventDefault()
        const key = link.getAttribute('data-entity')
        if (key) wikilink(key)
        return
      }
      const btn = target.closest('.code-copy-btn') as HTMLButtonElement | null
      if (!btn) return
      const wrapper = btn.closest('.code-block-wrapper')
      const code = wrapper?.querySelector('code')?.textContent ?? ''
      navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = `${CHECK_ICON} Copied!`
        btn.classList.add('copied')
        setTimeout(() => {
          btn.innerHTML = `${COPY_ICON} Copy`
          btn.classList.remove('copied')
        }, 2000)
      })
    },
    [wikilink],
  )

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [handleClick])

  return (
    <div ref={contentRef} className={className}>
      <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
