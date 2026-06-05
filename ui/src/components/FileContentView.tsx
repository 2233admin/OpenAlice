/**
 * Renders the content of a single workspace file by extension.
 *
 * Shared by the Inbox detail pane and the dedicated File Viewer tab so
 * both render `.md` / `.html` / plain-text the same way, and surface the
 * same tombstone copy for the `readWorkspaceFile` error variants
 * (missing workspace / missing file / too large / …).
 *
 * `.html` deliberately routes through MarkdownContent for now: marked
 * passes raw HTML through, then DOMPurify sanitises before insertion.
 * Good enough for HTML fragments; a faithful full-document HTML report
 * would want a sandboxed iframe renderer instead — deferred until agents
 * actually emit those.
 */

import type { ReactElement } from 'react'

import { MarkdownContent } from './MarkdownContent'
import type { ReadFileResult } from './workspace/api'

export function FileContentView({
  path,
  result,
}: {
  path: string
  result: ReadFileResult
}): ReactElement {
  if (result.kind === 'ok') return <DocBody path={path} content={result.content} />
  return <DocTombstone result={result} />
}

function DocBody({ path, content }: { path: string; content: string }): ReactElement {
  const lower = path.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return <MarkdownContent text={content} />
  }
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    // DOMPurify sanitisation is inside MarkdownContent; for raw HTML we
    // run it through the markdown renderer too — marked passes HTML
    // through, then DOMPurify sanitises before insertion.
    return <MarkdownContent text={content} />
  }
  // Plain-text fallback (.txt, .log, no extension, code files…)
  return (
    <pre className="text-[12px] text-text whitespace-pre-wrap font-mono leading-relaxed">
      {content}
    </pre>
  )
}

function DocTombstone({ result }: { result: ReadFileResult }): ReactElement {
  const message = (() => {
    switch (result.kind) {
      case 'workspace_missing':
        return 'Workspace no longer exists — it may have been deleted.'
      case 'file_missing':
        return 'File not found at this path — it may have been moved, renamed, or deleted in the workspace.'
      case 'too_large':
        return `File too large to render (${(result.sizeBytes / 1024).toFixed(0)} KB). Open it inside the workspace instead.`
      case 'invalid_path':
        return 'Invalid path.'
      case 'error':
        return `Could not read file: ${result.message}`
      case 'ok':
        return ''
    }
  })()
  return <div className="text-[12px] text-text-muted italic">{message}</div>
}
