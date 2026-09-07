/**
 * Retired preset ids keep resolving. A released Session log carries the
 * creation-time `agentPreset` verbatim across format migrations, so a session
 * created under a since-renamed shipped preset asks the roster for the old id
 * on resume. The roster answers with the successor instead of
 * `agent-preset/not-found`, both for an explicit id and for a stored default.
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import FileSettingsProvider from '@deepseek-ai/dsh-settings-file'
import { describe, expect, it } from 'vitest'
import AgentPresets, { COMPOSITION_FILE, LEGACY_PRESET_IDS, SETTINGS_NAMESPACE } from '@deepseek-ai/dsh-agent-presets'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const ROOTS = [{ path: join(FIXTURES, 'system'), trust: 'system' as const }]
const NS = SETTINGS_NAMESPACE

/** The one retired id this suite exercises, and the successor the map must name. */
const RETIRED = 'code'
const SUCCESSOR = 'ptc'

/** A user root supplying only `id`, composed from the contribute fixture. */
async function rootWith(id: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-preset-legacy-'))
  await mkdir(join(root, id))
  await writeFile(
    join(root, id, COMPOSITION_FILE),
    `- id: only\n  name: ${join(FIXTURES, 'plugins', 'contribute.js')}\n  config:\n    tool: only\n`,
  )
  return root
}

/** The same composition `settings.spec.ts` builds, with a file-backed settings provider. */
async function harness(
  extraRoots: readonly { path: string; trust: 'system' | 'user' }[] = [],
): Promise<Context> {
  const home = await mkdtemp(join(tmpdir(), 'dsh-preset-legacy-settings-'))
  const settingsFile = join(home, 'settings.yaml')
  await writeFile(settingsFile, '{}\n')

  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(FIXTURES).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(FileSettingsProvider, { path: settingsFile, watch: false })
  await ctx.plugin(AgentPresets, {
    default: 'standard',
    roots: [...ROOTS, ...extraRoots],
    includeShippedRoot: false,
    includeUserRoot: false,
  })
  return ctx
}

describe('retired preset ids', () => {
  it('names the successor of the shipped rename', () => {
    expect(LEGACY_PRESET_IDS).toStrictEqual({ [RETIRED]: SUCCESSOR })
  })

  it('resolves a retired id to its successor when a root supplies the successor', async () => {
    const ctx = await harness([{ path: await rootWith(SUCCESSOR), trust: 'user' }])

    const resolved = await ctx.agentPresets.resolve(RETIRED)

    expect(resolved.id).toBe(SUCCESSOR)
  })

  it('resolves a stored default naming the retired id the same way', async () => {
    const ctx = await harness([{ path: await rootWith(SUCCESSOR), trust: 'user' }])
    await ctx.settings.update(NS, { default: RETIRED })

    expect(ctx.agentPresets.defaultId).toBe(RETIRED)
    expect((await ctx.agentPresets.resolve()).id).toBe(SUCCESSOR)
  })

  it('lets a root that still supplies the retired id win over the successor', async () => {
    const ctx = await harness([
      { path: await rootWith(RETIRED), trust: 'user' },
      { path: await rootWith(SUCCESSOR), trust: 'user' },
    ])

    expect((await ctx.agentPresets.resolve(RETIRED)).id).toBe(RETIRED)
  })

  it('still reports the retired id as not found when no root supplies the successor', async () => {
    const ctx = await harness()

    await expect(ctx.agentPresets.resolve(RETIRED))
      .rejects.toThrow(/preset "code" not found \(available: minimal, standard\)/)
  })

  it('never lists the retired id in the roster', async () => {
    const ctx = await harness([{ path: await rootWith(SUCCESSOR), trust: 'user' }])

    const ids = (await ctx.agentPresets.list()).map(preset => preset.id)

    expect(ids).toContain(SUCCESSOR)
    expect(ids).not.toContain(RETIRED)
  })
})
