import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import {
  type Row as RowModel,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { gsap } from 'gsap'
import { AnimatePresence, motion } from 'motion/react'
import { toast, Toaster } from 'sonner'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { PageHeader } from '../components/PageHeader'
import { Section } from '../components/form'

type RiskState = 'live' | 'watch' | 'risk'

type WorkCardRow = {
  id: string
  symbol: string
  score: number
  owner: string
  state: RiskState
  updated: string
}

type CommandAction = {
  id: string
  label: string
  detail: string
  perform: () => void
}

const INITIAL_ROWS: WorkCardRow[] = [
  {
    id: 'aapl',
    symbol: 'AAPL',
    score: 84,
    owner: 'RiskOps',
    state: 'live',
    updated: '13:40',
  },
  {
    id: 'nvda',
    symbol: 'NVDA',
    score: 92,
    owner: 'AlphaDesk',
    state: 'live',
    updated: '13:35',
  },
  {
    id: 'tsla',
    symbol: 'TSLA',
    score: 75,
    owner: 'QuantLab',
    state: 'watch',
    updated: '13:21',
  },
  {
    id: 'amd',
    symbol: 'AMD',
    score: 81,
    owner: 'Research',
    state: 'watch',
    updated: '13:10',
  },
  {
    id: 'amzn',
    symbol: 'AMZN',
    score: 68,
    owner: 'RiskOps',
    state: 'risk',
    updated: '12:59',
  },
]

const GSAP_CHIPS = ['GSAP', 'Tween', 'Timeline', 'Stagger']

function moveById<T extends { id: string }>(
  list: readonly T[],
  fromId: string,
  toId: string,
): T[] {
  if (fromId === toId) return [...list]
  const from = list.findIndex((item) => item.id === fromId)
  const to = list.findIndex((item) => item.id === toId)
  if (from === -1 || to === -1) return [...list]
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function stateTag(state: RiskState) {
  if (state === 'live') return { label: 'Live', className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' }
  if (state === 'watch') return { label: 'Watch', className: 'text-amber-300 bg-amber-500/10 border-amber-500/30' }
  return { label: 'Risk', className: 'text-rose-300 bg-rose-500/10 border-rose-500/30' }
}

function DraggableRow({
  row,
  onFilterOwner,
  onMoveToTop,
}: {
  row: RowModel<WorkCardRow>
  onFilterOwner: (owner: string) => void
  onMoveToTop: (id: string) => void
}) {
  const { setNodeRef: setDragRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: row.id,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: row.id })
  const setRefs = useCallback((node: HTMLTableRowElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }, [setDragRef, setDropRef])

  const dragStyle = transform
    ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
    : 'none'
  const styleTag = { transform: dragStyle }
  const state = stateTag(row.original.state)

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <motion.tr
          ref={setRefs}
          style={styleTag}
          className={`border-b border-border/80 bg-bg transition-colors ${isDragging ? 'opacity-60' : 'hover:bg-bg-secondary'} ${isOver ? 'bg-bg-secondary' : ''}`}
        >
          <td className="px-3 py-2 w-11">
            <button
              type="button"
              className="w-7 h-7 rounded bg-bg-secondary text-text-muted hover:text-text border border-border/60"
              {...attributes}
              {...listeners}
              aria-label={`drag ${row.original.symbol}`}
            >
              ::
            </button>
          </td>
          <td className="px-3 py-2 font-mono text-sm text-text">{row.original.symbol}</td>
          <td className="px-3 py-2 tabular-nums text-sm text-text">{row.original.score}</td>
          <td className="px-3 py-2 text-sm text-text-muted">{row.original.owner}</td>
          <td className="px-3 py-2 text-sm">
            <span className={`inline-flex px-2 py-1 rounded-full border text-xs ${state.className}`}>
              {state.label}
            </span>
          </td>
          <td className="px-3 py-2 text-sm text-text">{row.original.updated}</td>
        </motion.tr>
      </ContextMenu.Trigger>
        <ContextMenu.Portal>
        <ContextMenu.Content
          className="w-52 rounded-md border border-border bg-bg-secondary shadow-xl p-1 text-sm"
        >
          <ContextMenu.Item
            className="px-2.5 py-1.5 rounded-sm cursor-default focus:bg-bg-tertiary data-[highlighted]:bg-bg-tertiary outline-none"
            onSelect={() => onMoveToTop(row.id)}
          >
            Move {row.original.symbol} to top
          </ContextMenu.Item>
          <ContextMenu.Item
            className="px-2.5 py-1.5 rounded-sm cursor-default focus:bg-bg-tertiary data-[highlighted]:bg-bg-tertiary outline-none"
            onSelect={() => onFilterOwner(row.original.owner)}
          >
            Filter owner: {row.original.owner}
          </ContextMenu.Item>
          <ContextMenu.Item
            className="px-2.5 py-1.5 rounded-sm cursor-default focus:bg-bg-tertiary data-[highlighted]:bg-bg-tertiary outline-none"
            onSelect={() => {
              navigator.clipboard?.writeText(row.original.symbol).then(() => {
                toast.success(`Copied ${row.original.symbol}`)
              }).catch(() => {
                toast.error('Copy failed')
              })
            }}
          >
            Copy symbol
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

export function DevShowcasePage() {
  const [rows, setRows] = useState<WorkCardRow[]>(() => [...INITIAL_ROWS])
  const [rowFilter, setRowFilter] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteValue, setPaletteValue] = useState('')
  const gsapCardsRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const columns = useMemo<ColumnDef<WorkCardRow>[]>(() => [
    { accessorKey: 'symbol', header: 'Symbol', cell: (info) => info.getValue<string>() },
    { accessorKey: 'score', header: 'Score', cell: (info) => info.getValue<number>() },
    { accessorKey: 'owner', header: 'Owner', cell: (info) => info.getValue<string>() },
    { accessorKey: 'state', header: 'State', cell: (info) => {
      const state = stateTag(info.getValue<RiskState>())
      return <span className={`px-2 py-0.5 rounded-full border text-xs ${state.className}`}>{state.label}</span>
    }},
    { accessorKey: 'updated', header: 'Updated', cell: (info) => info.getValue<string>() },
  ], [])

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const q = rowFilter.trim().toLowerCase()
        if (!q) return true
        return (
          row.symbol.toLowerCase().includes(q) ||
          row.owner.toLowerCase().includes(q) ||
          row.state.includes(q)
        )
      }),
    [rowFilter, rows],
  )

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const shuffleRows = useCallback(() => {
    setRows((current) => {
      const copy = [...current]
      copy.sort(() => Math.random() - 0.5)
      return copy
    })
    toast.success('Rows shuffled')
    setPaletteOpen(false)
  }, [])

  const clearFilter = useCallback(() => {
    setRowFilter('')
    toast.success('Filter cleared')
    setPaletteOpen(false)
  }, [])

  const focusInbox = useCallback(() => {
    navigate('/inbox')
    setPaletteOpen(false)
    toast.success('Navigated to /inbox')
  }, [navigate])

  const commandActions: CommandAction[] = useMemo(
    () => [
      { id: 'shuffle', label: 'Shuffle rows', detail: 'Mix list order randomly', perform: shuffleRows },
      { id: 'clear', label: 'Clear owner filter', detail: 'Show all symbols', perform: clearFilter },
      { id: 'inbox', label: 'Jump to Inbox', detail: 'Open inbox route', perform: focusInbox },
    ],
    [shuffleRows, clearFilter, focusInbox],
  )

  const onMoveToTop = useCallback((id: string) => {
    setRows((current) => {
      const idx = current.findIndex((row) => row.id === id)
      if (idx < 0) return current
      const next = [...current]
      const [row] = next.splice(idx, 1)
      next.unshift(row)
      return next
    })
    toast.success('Moved row to top')
    setPaletteOpen(false)
  }, [])

  const onFilterOwner = useCallback((owner: string) => {
    setRowFilter(owner)
    toast.success(`Filter owner = ${owner}`)
    setPaletteOpen(false)
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const onDragEnd = useCallback((event: DragEndEvent) => {
    const overId = event.over?.id ? String(event.over.id) : null
    const activeId = String(event.active.id)
    if (!overId || activeId === overId) return
    setRows((current) => moveById(current, activeId, overId))
    toast.success('Reordered by drag')
  }, [])

  const summaryCards = useMemo(() => {
    const live = rows.filter((row) => row.state === 'live').length
    const watch = rows.filter((row) => row.state === 'watch').length
    const risk = rows.filter((row) => row.state === 'risk').length
    const avg = rows.length
      ? (rows.reduce((acc, row) => acc + row.score, 0) / rows.length).toFixed(1)
      : '0.0'
    return [
      { label: 'Live', value: String(live), hint: 'tracking' },
      { label: 'Watch', value: String(watch), hint: 'watchlist' },
      { label: 'Risk', value: String(risk), hint: 'needs attention' },
      { label: 'Score Avg', value: avg, hint: 'all symbols' },
    ]
  }, [rows])

  useLayoutEffect(() => {
    const cards = gsapCardsRef.current?.querySelectorAll<HTMLElement>('.gsap-card')
    if (!cards || cards.length === 0) return

    const timeline = gsap.from(cards, {
      opacity: 0,
      y: 16,
      rotate: -2,
      duration: 0.42,
      stagger: 0.06,
      ease: 'back.out(1.6)',
      onComplete: () => {
        gsap.set(cards, { rotate: 0 })
      },
    })

    return () => {
      timeline.kill()
    }
  }, [])

  const replayGsapDemo = useCallback(() => {
    const cards = gsapCardsRef.current?.querySelectorAll<HTMLElement>('.gsap-card')
    if (!cards || cards.length === 0) return

    gsap.killTweensOf(cards)
    gsap.fromTo(
      cards,
      { scale: 0.97, y: 8, opacity: 0.7 },
      { scale: 1, y: 0, opacity: 1, duration: 0.24, stagger: 0.05, ease: 'power2.out', yoyo: true, repeat: 1 },
    )
    toast.success('GSAP demo replayed')
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="h-full overflow-y-auto">
      <Toaster richColors position="top-right" />
      <PageHeader title="Component Showcase" />

      <div className="px-4 md:px-6 py-5 space-y-5">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: index * 0.04 }}
              className="rounded-lg border border-border bg-bg-secondary p-4"
            >
              <p className="text-sm text-text-muted">{card.label}</p>
              <p className="mt-2 text-2xl text-text font-semibold">{card.value}</p>
              <p className="text-xs text-text-muted mt-1">{card.hint}</p>
            </motion.div>
          ))}
        </section>

        <Section title="GSAP 3 Showcase" description="GSAP-powered motion with replayable timing curves.">
          <div ref={gsapCardsRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GSAP_CHIPS.map((chip) => (
              <div
                key={chip}
                className="gsap-card rounded-lg border border-border bg-bg-secondary p-4 text-center"
              >
                <p className="text-sm text-text-muted">Chip</p>
                <p className="mt-2 text-xl font-semibold text-text">{chip}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={replayGsapDemo}
            className="mt-3 px-3 py-2 rounded-md border border-border text-sm hover:bg-bg-secondary"
          >
            Replay GSAP
          </button>
        </Section>

        <Section title="Command palette" description="Press ⌘K / Ctrl+K to open. Row actions can also use context menu.">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={rowFilter}
              onChange={(event) => setRowFilter(event.target.value)}
              placeholder="Filter symbols / owners..."
              className="flex-1 min-w-[220px] px-3 py-2 border border-border rounded-md text-sm bg-bg text-text focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="px-3 py-2 rounded-md border border-border text-sm hover:bg-bg-secondary"
            >
              Open Command Palette
            </button>
          </div>
        </Section>

        <Section
          title="TanStack Table + dnd + Context Menu"
          description="Table rows are drag-reorderable and each row has a right-click context menu."
        >
          <AnimatePresence>
            <DndContext
              sensors={sensors}
              onDragEnd={onDragEnd}
            >
              <div className="overflow-x-auto border border-border rounded-lg bg-bg">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-bg-secondary text-text-muted">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        <th className="w-12" />
                        {headerGroup.headers.map((header) => (
                          <th key={header.id} className="px-3 py-2 text-left">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow
                        key={row.id}
                        row={row}
                        onFilterOwner={onFilterOwner}
                        onMoveToTop={onMoveToTop}
                      />
                    ))}
                  </tbody>
                </table>
                {table.getRowModel().rows.length === 0 && (
                  <div className="px-3 py-6 text-sm text-text-muted">No matching rows.</div>
                )}
              </div>
            </DndContext>
          </AnimatePresence>
        </Section>
      </div>

      {paletteOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 p-4 md:p-6 flex items-start justify-center"
          onClick={() => setPaletteOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="w-full max-w-xl mt-12"
            onClick={(event) => event.stopPropagation()}
          >
            <Command
              value={paletteValue}
              onValueChange={setPaletteValue}
              className="border border-border rounded-lg bg-bg shadow-xl overflow-hidden"
              shouldFilter
            >
              <Command.Input
                value={paletteValue}
                onValueChange={setPaletteValue}
                placeholder="Search actions"
                className="w-full px-3 py-3 bg-transparent border-b border-border text-sm text-text outline-none"
              />
              <Command.List className="max-h-72 overflow-y-auto">
                <Command.Empty className="px-3 py-3 text-sm text-text-muted">No actions</Command.Empty>
                <Command.Group heading="Showcase Actions">
                  {commandActions.map((action) => (
                    <Command.Item
                      key={action.id}
                      value={action.id}
                      onSelect={() => action.perform()}
                      className="px-3 py-2 cursor-default text-sm text-text data-[selected=true]:bg-bg-secondary outline-none"
                    >
                      <div className="flex flex-col">
                        <span>{action.label}</span>
                        <span className="text-xs text-text-muted">{action.detail}</span>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </div>
  )
}
