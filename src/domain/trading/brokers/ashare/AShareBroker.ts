/**
 * AShareBroker — IBroker adapter for A-share trading via QT backend.
 *
 * Calls the quant-terminal FastAPI backend over HTTP.
 * Supports TDX (通达信 GUI automation) and QMT (迅投 XtQuant SDK) modes.
 * aliceId format: "{accountId}|{code}" (e.g. "ashare-tdx|000001")
 *
 * QT backend endpoints (surplus/backend/app/api/):
 *   GET  /account/info         — init connectivity check (balance + positions + readers)
 *   GET  /account/balance      — { data: { available?, ... } }
 *   GET  /account/positions    — { data: [{ code, volume, avg_price, current_price, pnl, pnl_pct }] }
 *   GET  /order/pending        — { data: [{ id, code, direction, price, volume, status, strategy }] }
 *   POST /order/submit         — { code, direction, price, volume, strategy, confirm }
 *   POST /order/cancel/{id}    — { status, order_id }
 */

import { z } from 'zod'
import Decimal from 'decimal.js'
import { Contract, ContractDescription, ContractDetails, Order, OrderState, UNSET_DOUBLE, UNSET_DECIMAL } from '@traderalice/ibkr'
import {
  BrokerError,
  type IBroker,
  type AccountCapabilities,
  type AccountInfo,
  type Position,
  type PlaceOrderResult,
  type OpenOrder,
  type Quote,
  type MarketClock,
  type BrokerConfigField,
} from '../types.js'
import '../../contract-ext.js'

// ==================== QT backend response shapes ====================

interface QtBalanceResponse {
  data: {
    available?: number
    total?: number
    market_value?: number
    // TDX raw parse may have ad-hoc keys
    [key: string]: unknown
  }
  error?: string
}

interface QtPosition {
  code: string
  market?: number
  volume: number
  avg_price: number
  current_price?: number
  pnl?: number
  pnl_pct?: number
}

interface QtPositionsResponse {
  data: QtPosition[]
  count: number
  error?: string
}

interface QtOrder {
  id: number
  code: string
  direction: string   // "buy" | "sell"
  price: number
  volume: number
  status: string      // "pending" | "submitted" | "filled" | "cancelled" | "rejected"
  strategy?: string
  entrust_no?: string
}

interface QtPendingOrdersResponse {
  data: QtOrder[]
  count: number
  error?: string
}

interface QtSubmitOrderResponse {
  order_id?: number
  status?: string
  code?: string
  direction?: string
  price?: number
  volume?: number
  // preview response fields
  preview?: boolean
  message?: string
  error?: string
}

interface QtCancelOrderResponse {
  status?: string
  order_id?: number
  error?: string
}

interface QtAccountInfoResponse {
  data: {
    balance?: { available?: number; total?: number; [key: string]: unknown }
    positions?: QtPosition[]
    positions_count?: number
    readers?: Array<{ name: string; available?: boolean }>
    [key: string]: unknown
  }
  error?: string
}

// ==================== A-share market clock ====================

/**
 * Determine if the A-share market is currently open.
 * Trading hours (Beijing time / UTC+8):
 *   Morning:   09:30 – 11:30
 *   Afternoon: 13:00 – 15:00
 * No weekend/holiday awareness — callers should treat MARKET_CLOSED as transient.
 */
function getAShareMarketClock(): MarketClock {
  const now = new Date()
  // Convert to Beijing time (UTC+8)
  const bjOffset = 8 * 60   // minutes
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const bjMin = (utcMin + bjOffset) % (24 * 60)
  const bjDay = Math.floor((utcMin + bjOffset) / (24 * 60)) % 7

  // day-of-week in Beijing: 0=Sun, 1=Mon, ..., 6=Sat
  // We don't know the actual weekday without full UTC date math, so use getDay() adjusted:
  const bjDate = new Date(now.getTime() + bjOffset * 60 * 1000)
  const bjDow = bjDate.getUTCDay()   // 0=Sun, 6=Sat
  const isWeekend = bjDow === 0 || bjDow === 6

  const MORNING_OPEN  = 9 * 60 + 30   // 570
  const MORNING_CLOSE = 11 * 60 + 30  // 690
  const AFTERNOON_OPEN  = 13 * 60     // 780
  const AFTERNOON_CLOSE = 15 * 60     // 900

  const inMorning   = bjMin >= MORNING_OPEN && bjMin < MORNING_CLOSE
  const inAfternoon = bjMin >= AFTERNOON_OPEN && bjMin < AFTERNOON_CLOSE
  const isOpen = !isWeekend && (inMorning || inAfternoon)

  // Calculate next open/close in UTC
  const minutesToMs = (m: number) => m * 60 * 1000
  const bjMidnightUtc = new Date(bjDate.getUTCFullYear(), bjDate.getUTCMonth(), bjDate.getUTCDate())
  bjMidnightUtc.setTime(bjMidnightUtc.getTime() - bjOffset * 60 * 1000)

  let nextOpen: Date | undefined
  let nextClose: Date | undefined

  if (isOpen) {
    // Currently open — next close is end of current session
    if (inMorning) {
      nextClose = new Date(bjMidnightUtc.getTime() + minutesToMs(MORNING_CLOSE))
    } else {
      nextClose = new Date(bjMidnightUtc.getTime() + minutesToMs(AFTERNOON_CLOSE))
    }
  } else {
    // Currently closed — find next open
    if (!isWeekend && bjMin < MORNING_OPEN) {
      // Before morning open today
      nextOpen = new Date(bjMidnightUtc.getTime() + minutesToMs(MORNING_OPEN))
      nextClose = new Date(bjMidnightUtc.getTime() + minutesToMs(MORNING_CLOSE))
    } else if (!isWeekend && bjMin >= MORNING_CLOSE && bjMin < AFTERNOON_OPEN) {
      // Lunch break
      nextOpen = new Date(bjMidnightUtc.getTime() + minutesToMs(AFTERNOON_OPEN))
      nextClose = new Date(bjMidnightUtc.getTime() + minutesToMs(AFTERNOON_CLOSE))
    } else {
      // After close or weekend — next trading day 09:30
      const daysUntilMonday = bjDow === 6 ? 2 : bjDow === 0 ? 1 : 1  // Fri→+3, Sat→+2, Sun→+1, weekday-after-close→+1
      const nextDayMs = (bjDow === 5 ? 3 : bjDow === 6 ? 2 : bjDow === 0 ? 1 : 1) * 24 * 60 * 60 * 1000
      nextOpen = new Date(bjMidnightUtc.getTime() + nextDayMs + minutesToMs(MORNING_OPEN))
      nextClose = new Date(bjMidnightUtc.getTime() + nextDayMs + minutesToMs(MORNING_CLOSE))
    }
  }

  return { isOpen, nextOpen, nextClose, timestamp: now }
}

// ==================== Contract helpers ====================

/** Determine exchange from A-share stock code. */
function codeToExchange(code: string): 'SSE' | 'SZSE' {
  return (code.startsWith('6') || code.startsWith('11')) ? 'SSE' : 'SZSE'
}

/** Build an IBKR Contract for an A-share stock code. */
function makeAShareContract(code: string): Contract {
  const c = new Contract()
  c.symbol = code
  c.secType = 'STK'
  c.exchange = codeToExchange(code)
  c.currency = 'CNY'
  return c
}

/** Map QT order status string → IBKR OrderState status string. */
function mapQtOrderStatus(qtStatus: string): string {
  switch (qtStatus) {
    case 'filled':    return 'Filled'
    case 'cancelled': return 'Cancelled'
    case 'rejected':  return 'Inactive'
    case 'pending':
    case 'submitted': return 'Submitted'
    default:          return 'Submitted'
  }
}

/** Build an IBKR OrderState from a QT status string. */
function makeOrderState(qtStatus: string): OrderState {
  const s = new OrderState()
  s.status = mapQtOrderStatus(qtStatus)
  return s
}

/** Map QT pending order → IBroker OpenOrder. */
function mapQtOrderToOpenOrder(o: QtOrder): OpenOrder {
  const contract = makeAShareContract(o.code)

  const order = new Order()
  order.action = o.direction === 'buy' ? 'BUY' : 'SELL'
  order.orderType = 'LMT'
  order.lmtPrice = o.price
  order.totalQuantity = new Decimal(o.volume)
  order.tif = 'DAY'
  // QT uses integer order IDs. IBKR orderId is number — store directly.
  order.orderId = o.id

  return {
    contract,
    order,
    orderState: makeOrderState(o.status),
  }
}

// ==================== Broker config ====================

export interface AShareBrokerConfig {
  id: string
  label?: string
  baseUrl: string
  mode: 'tdx' | 'qmt' | 'ths' | 'paper'
}

// ==================== AShareBroker ====================

export class AShareBroker implements IBroker {
  // ---- Self-registration ----

  static configSchema = z.object({
    baseUrl: z.string().default('http://localhost:8000'),
    mode: z.enum(['tdx', 'qmt', 'ths', 'paper']).default('tdx'),
  })

  static configFields: BrokerConfigField[] = [
    {
      name: 'baseUrl',
      type: 'text',
      label: 'QT Backend URL',
      default: 'http://localhost:8000',
      required: true,
      description: 'URL of the quant-terminal FastAPI backend',
    },
    {
      name: 'mode',
      type: 'select',
      label: 'Trading Mode',
      required: true,
      options: [
        { value: 'tdx',   label: 'TDX (通达信 GUI)' },
        { value: 'qmt',   label: 'QMT (迅投 XtQuant)' },
        { value: 'ths',   label: 'THS (同花顺)' },
        { value: 'paper', label: 'Paper (模拟)' },
      ],
    },
  ]

  static fromConfig(config: { id: string; label?: string; brokerConfig: Record<string, unknown> }): AShareBroker {
    const bc = AShareBroker.configSchema.parse(config.brokerConfig)
    return new AShareBroker({ id: config.id, label: config.label, ...bc })
  }

  // ---- Instance ----

  readonly id: string
  readonly label: string

  private readonly baseUrl: string
  private readonly mode: AShareBrokerConfig['mode']

  constructor(config: AShareBrokerConfig) {
    this.id = config.id
    this.label = config.label ?? `A-Share (${config.mode.toUpperCase()})`
    this.baseUrl = config.baseUrl.replace(/\/$/, '')   // strip trailing slash
    this.mode = config.mode
  }

  // ---- HTTP helper ----

  /**
   * Typed HTTP call to the QT FastAPI backend.
   * Throws BrokerError('NETWORK') on non-2xx responses.
   */
  private async qtFetch<T>(path: string, opts?: { method?: string; body?: unknown }): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method: opts?.method ?? 'GET',
      headers: opts?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new BrokerError('NETWORK', `QT backend ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  // ---- Lifecycle ----

  async init(): Promise<void> {
    try {
      // Verify connectivity — /account/info returns balance + positions + reader status
      await this.qtFetch<QtAccountInfoResponse>('/account/info')
      console.log(`AShareBroker[${this.id}]: connected to QT backend at ${this.baseUrl} (mode=${this.mode})`)
    } catch (err) {
      throw BrokerError.from(err, 'NETWORK')
    }
  }

  async close(): Promise<void> {
    // QT backend is stateless HTTP — no connection to close
  }

  // ---- Contract search ----

  /**
   * A-shares have no IBKR-style symbol search — pattern is treated as a direct code.
   * Returns a single ContractDescription wrapping the code.
   */
  async searchContracts(pattern: string): Promise<ContractDescription[]> {
    if (!pattern) return []
    const code = pattern.trim()
    const desc = new ContractDescription()
    desc.contract = makeAShareContract(code)
    return [desc]
  }

  async getContractDetails(query: Contract): Promise<ContractDetails | null> {
    const code = query.symbol
    if (!code) return null

    const exchange = codeToExchange(code)
    const details = new ContractDetails()
    details.contract = makeAShareContract(code)
    details.validExchanges = exchange
    details.orderTypes = 'LMT,MKT'
    details.stockType = 'COMMON'
    return details
  }

  // ---- Trading operations ----

  async placeOrder(contract: Contract, order: Order): Promise<PlaceOrderResult> {
    const code = contract.symbol
    if (!code) {
      return { success: false, error: 'Cannot resolve contract: missing symbol' }
    }

    // Determine direction
    const direction = order.action === 'BUY' ? 'buy' : 'sell'

    // Resolve price: LMT uses lmtPrice, MKT uses 0 (QT handles market order routing)
    let price = 0
    if (order.lmtPrice !== UNSET_DOUBLE) {
      price = order.lmtPrice
    } else if (order.orderType === 'MKT') {
      price = 0
    }

    // Resolve volume from totalQuantity
    if (order.totalQuantity.equals(UNSET_DECIMAL)) {
      return { success: false, error: 'Order totalQuantity is required for A-share orders' }
    }
    const volume = order.totalQuantity.toNumber()
    if (!Number.isInteger(volume) || volume <= 0) {
      return { success: false, error: `Invalid volume: ${volume}. A-share orders must be positive integers` }
    }

    try {
      const body = {
        code,
        direction,
        price,
        volume,
        strategy: 'openalice',
        confirm: true,   // Always confirm — Alice is the safety layer
      }

      const res = await this.qtFetch<QtSubmitOrderResponse>('/order/submit', {
        method: 'POST',
        body,
      })

      if (res.error) {
        return { success: false, error: res.error }
      }

      const orderId = res.order_id != null ? String(res.order_id) : undefined
      return {
        success: true,
        orderId,
        orderState: makeOrderState(res.status ?? 'submitted'),
      }
    } catch (err) {
      const be = BrokerError.from(err, 'EXCHANGE')
      return { success: false, error: be.message }
    }
  }

  async modifyOrder(_orderId: string, _changes: Partial<Order>): Promise<PlaceOrderResult> {
    // A-share exchanges do not support in-flight order modification.
    // Cancel + re-submit is the correct pattern.
    throw new BrokerError('EXCHANGE', 'A-share does not support order modification. Cancel and re-submit instead.')
  }

  async cancelOrder(orderId: string): Promise<PlaceOrderResult> {
    try {
      const res = await this.qtFetch<QtCancelOrderResponse>(`/order/cancel/${orderId}`, {
        method: 'POST',
      })

      if (res.error) {
        return { success: false, error: res.error }
      }

      const orderState = new OrderState()
      orderState.status = 'Cancelled'
      return { success: true, orderId, orderState }
    } catch (err) {
      const be = BrokerError.from(err, 'EXCHANGE')
      return { success: false, error: be.message }
    }
  }

  async closePosition(contract: Contract, quantity?: Decimal): Promise<PlaceOrderResult> {
    const code = contract.symbol
    if (!code) {
      return { success: false, error: 'Cannot resolve contract: missing symbol' }
    }

    // Determine quantity to sell: partial close uses provided qty, full close reads position
    let sellVolume: Decimal

    if (quantity != null) {
      sellVolume = quantity
    } else {
      // Full close — fetch current position
      const positions = await this.getPositions()
      const pos = positions.find(p => p.contract.symbol === code)
      if (!pos) {
        return { success: false, error: `No open position for ${code}` }
      }
      sellVolume = pos.quantity
    }

    const sellOrder = new Order()
    sellOrder.action = 'SELL'
    sellOrder.orderType = 'MKT'
    sellOrder.totalQuantity = sellVolume
    sellOrder.tif = 'DAY'
    // lmtPrice intentionally left at UNSET_DOUBLE — placeOrder handles MKT routing

    return this.placeOrder(contract, sellOrder)
  }

  // ---- Queries ----

  async getAccount(): Promise<AccountInfo> {
    try {
      const res = await this.qtFetch<QtBalanceResponse>('/account/balance')
      const data = res.data ?? {}

      // QT balance keys vary by reader implementation:
      // TDX: { available }, QMT: { available, total, market_value }
      const totalCashValue = (data.available as number | undefined) ?? 0
      const netLiq = (data.total as number | undefined) ?? totalCashValue

      return {
        netLiquidation: netLiq,
        totalCashValue,
        unrealizedPnL: 0,   // QT balance doesn't aggregate this — callers use getPositions()
        buyingPower: totalCashValue,
      }
    } catch (err) {
      throw BrokerError.from(err, 'NETWORK')
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const res = await this.qtFetch<QtPositionsResponse>('/account/positions')
      const rows = res.data ?? []

      return rows.map((p): Position => ({
        contract: makeAShareContract(p.code),
        side: 'long',   // A-shares are long-only (no short selling in standard retail accounts)
        quantity: new Decimal(p.volume),
        avgCost: p.avg_price,
        marketPrice: p.current_price ?? p.avg_price,
        marketValue: (p.current_price ?? p.avg_price) * p.volume,
        unrealizedPnL: p.pnl ?? 0,
        realizedPnL: 0,
      }))
    } catch (err) {
      throw BrokerError.from(err, 'NETWORK')
    }
  }

  async getOrders(orderIds: string[]): Promise<OpenOrder[]> {
    // If specific IDs requested, filter from pending list
    const allPending = await this.getOrdersPending()
    if (orderIds.length === 0) return allPending
    const idSet = new Set(orderIds)
    return allPending.filter(o => idSet.has(String(o.order.orderId)))
  }

  async getOrder(orderId: string): Promise<OpenOrder | null> {
    const all = await this.getOrdersPending()
    return all.find(o => String(o.order.orderId) === orderId) ?? null
  }

  /**
   * Fetch all pending/submitted orders from QT backend.
   * Internal helper used by getOrders() and getOrder().
   */
  private async getOrdersPending(): Promise<OpenOrder[]> {
    try {
      const res = await this.qtFetch<QtPendingOrdersResponse>('/order/pending')
      return (res.data ?? []).map(mapQtOrderToOpenOrder)
    } catch (err) {
      throw BrokerError.from(err, 'NETWORK')
    }
  }

  /**
   * Quote is not available via request/response from QT backend.
   * QT uses WebSocket push (surplus market data) rather than REST polling.
   * Returns a stub with timestamp so callers can detect staleness.
   */
  async getQuote(contract: Contract): Promise<Quote> {
    const code = contract.symbol ?? ''
    // QT does not expose a synchronous quote endpoint — market data flows via WS.
    // Return a zero stub. Callers that need live quotes should subscribe to the WS feed.
    return {
      contract: makeAShareContract(code),
      last: 0,
      bid: 0,
      ask: 0,
      volume: 0,
      timestamp: new Date(),
    }
  }

  async getMarketClock(): Promise<MarketClock> {
    return getAShareMarketClock()
  }

  // ---- Capabilities ----

  getCapabilities(): AccountCapabilities {
    return {
      supportedSecTypes: ['STK'],
      supportedOrderTypes: ['LMT', 'MKT'],
    }
  }

  // ---- Contract identity ----

  /**
   * Native key for A-shares is the stock code (e.g. "000001", "600036").
   * aliceId format: "{brokerId}|{code}"
   */
  getNativeKey(contract: Contract): string {
    return contract.symbol
  }

  resolveNativeKey(nativeKey: string): Contract {
    return makeAShareContract(nativeKey)
  }
}
