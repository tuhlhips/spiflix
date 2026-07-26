import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sodium from 'libsodium-wrappers'

/**
 * VidLink signs its API paths with a token minted inside a WebAssembly module
 * (a Go binary plus its JS glue, both vendored beside this file). The glue
 * expects browser globals and registers `globalThis.getAdv` once the module's
 * main() has run — hence the shims and the short poll below.
 *
 * Node-only: it needs `fs` and `eval`, so this provider is not registered on
 * the Cloudflare Worker path (see worker.ts).
 */

type TokenMinter = (tmdbId: string) => string | null

let bootPromise: Promise<TokenMinter> | null = null

export function getTokenMinter(): Promise<TokenMinter> {
  if (bootPromise) return bootPromise

  bootPromise = (async () => {
    const g = globalThis as any
    g.window ??= globalThis
    g.self ??= globalThis
    g.document ??= { createElement: () => ({}), body: { appendChild: () => {} } }

    await sodium.ready
    g.sodium = sodium

    const dir = import.meta.dirname
    const glue = readFileSync(join(dir, 'glue.js'), 'utf8')
    // Indirect eval so the glue runs in global scope, where it assigns
    // `globalThis.Dm` — the Go runtime shim the wasm module needs.
    ;(0, eval)(glue)

    const Go = g.Dm
    if (typeof Go !== 'function') throw new Error('WASM glue did not define its runtime')

    const go = new Go()
    const bytes = readFileSync(join(dir, 'fu.wasm'))
    const { instance } = await WebAssembly.instantiate(bytes, go.importObject)
    // Deliberately not awaited — the Go runtime's run() only settles on exit.
    void go.run(instance)

    for (let i = 0; i < 40 && typeof g.getAdv !== 'function'; i++) {
      await new Promise(r => setTimeout(r, 50))
    }
    if (typeof g.getAdv !== 'function') throw new Error('token minter unavailable after WASM boot')

    return g.getAdv as TokenMinter
  })()

  // Let a failed boot be retried on the next request instead of poisoning the
  // provider for the process lifetime.
  bootPromise.catch(() => { bootPromise = null })

  return bootPromise
}
