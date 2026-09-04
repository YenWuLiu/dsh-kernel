/** Diagnostic: boot the kernel, create one chat agent, print every onEvent event during one send. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { boot, loadLayeredEnv, loadOptionalPatches, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { DSH_LAUNCH_ENVIRONMENT_KEY } from '@deepseek-ai/dsh-launch-environment'
import { provideCmdline } from '@deepseek-ai/dsh-cmdline'
import { createChatAgent } from '@deepseek-ai/dsh-chat-agent'

const NAME = 'dsh-pet-diag'
const APP_ROOT = resolve(fileURLToPath(new URL('./apps/pet', import.meta.url)))
const req = createRequire(join(APP_ROOT, 'package.json'))
const baseManifest = req.resolve('@deepseek-ai/dsh-base/package.json')
const basePatch = resolve(dirname(baseManifest), 'cordis.patch.yml')

process.env.DSH_PERMISSION_MODE ??= 'danger-full-access'
const environment = loadLayeredEnv('dsh')
const stateDir = join(resolveDshHome(), 'dsh-pet-agent')
mkdirSync(stateDir, { recursive: true })
const rootConfig = join(stateDir, 'diag-cordis.yml')
writeFileSync(rootConfig, '[]\n')
const patches = [
  ...loadOverlayPatches(NAME, basePatch),
  ...loadOverlayPatches(NAME, join(APP_ROOT, 'cordis.patch.yml')),
  ...(loadOptionalPatches(NAME, join(stateDir, 'cordis.patch.yml')) ?? []),
]

const ctx = await boot(NAME, rootConfig, structuredClone(patches), (hostCtx) => {
  hostCtx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, environment)
  provideCmdline(hostCtx, { args: [], exit: (code) => process.exit(code), ready: { onReady: (l) => { l(); return () => {} } } })
}, pathToFileURL(APP_ROOT + '/').href)

const chat = await createChatAgent(ctx, { sessionId: `diag-${Date.now()}` })
const counts = new Map()
chat.onEvent((e) => {
  counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
  if (e.type === 'text-delta' && counts.get('text-delta') <= 3) {
    process.stderr.write(`[diag] text-delta: ${JSON.stringify(e.text)}\n`)
  }
})
process.stderr.write('[diag] sending...\n')
const reply = await chat.send('从1数到20，每个数字后面加一个句号')
process.stderr.write(`[diag] reply len=${reply.text.length} error=${reply.error ?? 'none'}\n`)
process.stderr.write(`[diag] event counts: ${JSON.stringify([...counts.entries()])}\n`)
await ctx.fiber.dispose()
process.exit(0)
