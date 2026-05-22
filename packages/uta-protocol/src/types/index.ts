/**
 * Wire types — the shapes that travel over the UTA-Alice HTTP boundary.
 *
 * Distinct from in-process domain types (`Contract`, `OpenOrder`, `IBroker`,
 * `TradingGit`) which live inside UTA and never cross the wire. Wire types
 * are intentionally narrower: AI-facing summary objects, not the full
 * broker SDK surface.
 *
 * Files are stubbed during Step 1 of the UTA-split rollout; populated as
 * UTA service (Step 2) wires up each route.
 */

export * from './errors.js'
