/**
 * UTA client SDK.
 *
 * `createUTAClient({ baseUrl })` returns an object with one method per UTA
 * endpoint. Methods are populated as Step 2 wires up each route — until
 * then the client is an empty namespace placeholder so Alice can import the
 * package and validate the wire boundary at the type level.
 */

export interface UTAClientOptions {
  /** UTA service base URL, e.g. `http://127.0.0.1:47333`. */
  baseUrl: string
  /** Optional fetch override (for testing). Defaults to global fetch. */
  fetch?: typeof globalThis.fetch
}

export interface UTAClient {
  readonly baseUrl: string
}

export function createUTAClient(options: UTAClientOptions): UTAClient {
  return {
    baseUrl: options.baseUrl.replace(/\/$/, ''),
  }
}
