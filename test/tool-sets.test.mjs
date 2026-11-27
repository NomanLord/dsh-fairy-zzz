import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'fairy-tools-test-'))
process.env.FAIRY_TOOLS_CONFIG = join(dir, 'fairy-tools.json')
process.env.FAIRY_TOOLS_SNAPSHOT = join(dir, 'fairy-tools.snapshot.json')

const sets = await import('../tool-sets.js')

let pass = 0
function ok(name, cond) {
  assert.ok(cond, name)
  pass += 1
  console.log('  ok  ' + name)
}

// 1. defaults
const base = sets.readConfig()
ok('missing config -> enabled', base.enabled === true)
ok('missing config -> recommended', base.mode === 'recommended')
ok('missing config -> allow=RECOMMENDED', JSON.stringify(base.allow) === JSON.stringify(sets.RECOMMENDED))
ok('missing config -> exists false', base.exists === false)
ok('resolveAllow recommended', JSON.stringify(sets.resolveAllow(base)) === JSON.stringify(sets.RECOMMENDED))

// 2. lean
let cfg = sets.writeConfig({ mode: 'lean' })
ok('lean mode persisted', cfg.mode === 'lean')
ok('lean resolves to LEAN', JSON.stringify(sets.resolveAllow(cfg)) === JSON.stringify(sets.LEAN))
ok('lean file exists', existsSync(process.env.FAIRY_TOOLS_CONFIG))

// 3. custom dedupe / validation
cfg = sets.writeConfig({ mode: 'custom', allow: ['read', 'read', '', 42, 'web_fetch', 'x'.repeat(200)] })
ok('custom dedupes allow', JSON.stringify(cfg.allow) === JSON.stringify(['read', 'web_fetch']))
cfg = sets.writeConfig({ mode: 'custom', allow: Array.from({ length: 500 }, (_, i) => 't' + i) })
ok('allow capped at 400', cfg.allow.length === 400)

// 4. disabled
cfg = sets.writeConfig({ mode: 'custom', allow: ['read'], enabled: false })
ok('disabled -> resolveAllow null', sets.resolveAllow(cfg) === null)

// 5. all
cfg = sets.writeConfig({ enabled: true, mode: 'all' })
ok('all -> resolveAllow null', sets.resolveAllow(cfg) === null)
ok('all keeps mode', cfg.mode === 'all')

// 6. back to recommended
cfg = sets.writeConfig({ mode: 'recommended' })
ok('recommended restores preset', JSON.stringify(cfg.allow) === JSON.stringify(sets.RECOMMENDED))

// 7. corrupt file
writeFileSync(process.env.FAIRY_TOOLS_CONFIG, '{ not json', 'utf8')
const broken = sets.readConfig()
ok('corrupt -> default enabled', broken.enabled === true)
ok('corrupt -> error reported', typeof broken.error === 'string' && broken.error.length > 0)
sets.writeConfig({ mode: 'recommended' })

// 8. token estimate
ok('estimateTokens empty', sets.estimateTokens('') === 0)
ok('estimateTokens cjk positive', sets.estimateTokens('工具链') > 0)
ok('estimateTokens grows', sets.estimateTokens('read a file') > sets.estimateTokens('read'))
ok(
  'cjk denser than ascii',
  sets.estimateTokens('中文中文中文中文') > sets.estimateTokens('abcdefghijklmnop'),
)

// 9. catalog
const catalog = sets.catalogFromDefinitions([
  { name: 'web_fetch', description: 'fetch a url', parameters: { type: 'object' } },
  { name: 'read', description: 'read a file', parameters: { type: 'object' } },
  { name: 'mystery_tool', description: 'x', parameters: {} },
])
ok('catalog sorted', catalog.map((t) => t.name).join(',') === 'mystery_tool,read,web_fetch')
ok('catalog label read', catalog.find((t) => t.name === 'read').label === '读取文件')
ok('catalog group read', catalog.find((t) => t.name === 'read').group === 'file')
ok('catalog fallback group', catalog.find((t) => t.name === 'mystery_tool').group === 'other')
ok('catalog token positive', catalog.every((t) => t.tokens > 0))

// 10. summarize
const fake = [
  { name: 'a', tokens: 100 },
  { name: 'b', tokens: 200 },
  { name: 'c', tokens: 300 },
]
const total = sets.summarize(fake, { enabled: true, mode: 'custom', allow: ['a', 'c'] })
ok('summarize all count', total.all.count === 3 && total.all.tokens === 600)
ok('summarize enabled', total.enabled.count === 2 && total.enabled.tokens === 400)
ok('summarize saved pct', total.saved.tokens === 200 && total.saved.pct === 33)
const unrestricted = sets.summarize(fake, { enabled: true, mode: 'all', allow: [] })
ok('summarize all mode', unrestricted.enabled.tokens === 600 && unrestricted.restricted === false)

// 11. snapshot dedupe
ok('snapshot first write true', sets.writeSnapshot({ tools: ['x'] }) === true)
ok('snapshot same write false', sets.writeSnapshot({ tools: ['x'] }) === false)
const snap = sets.readSnapshot()
ok('snapshot readable', snap && Array.isArray(snap.tools))

// 12. gate with fake ctx
const gate = await import('../toolgate.js')

function makeAgent(id, preset) {
  const state = { disposed: 0, filters: [] }
  const agent = {
    id,
    session: { preset },
    status: 'idle',
    ctx: {
      tools: {
        definitions() {
          if (state.disposed) return []
          return [
            { name: 'read', description: 'read', parameters: {} },
            { name: 'write', description: 'write', parameters: {} },
            { name: 'own_tool', description: 'agent-local', parameters: {} },
          ]
        },
        restrict(filter) {
          if (filter.allow.includes('own_tool')) {
            throw new Error('tools.restrict() names unknown global tool "own_tool"; known global tools: read, write')
          }
          state.filters.push([...filter.allow])
          return () => {
            state.disposed += 1
          }
        },
      },
    },
    state,
  }
  return agent
}

const fairy = makeAgent('s-fairy', 'fairy')
const standard = makeAgent('s-standard', 'standard')
const listeners = new Map()
const fakeCtx = {
  get(name) {
    if (name === 'agentPresets') return { presetForSession: (session) => session.preset }
    return undefined
  },
  on(event, listener) {
    listeners.set(event, listener)
    return () => {}
  },
  effect(fn) {
    const cleanup = fn()
    return typeof cleanup === 'function' ? cleanup : () => {}
  },
  agents: { list: () => [fairy, standard] },
  logger: { info() {} },
}

sets.writeConfig({ enabled: true, mode: 'custom', allow: ['read', 'write', 'own_tool'] })
gate.apply(fakeCtx)
ok('gate restricts fairy', fairy.state.filters.length === 1)
ok('gate filters unknown own_tool', JSON.stringify(fairy.state.filters[0]) === JSON.stringify(['read', 'write']))
ok('gate leaves standard alone', standard.state.filters.length === 0)
const gateSnap = sets.readSnapshot()
ok('snapshot applies count', gateSnap && gateSnap.agents === 1)
ok('snapshot tools kept', gateSnap.tools.length >= 3)

// config change -> poll fallback? Use the event listener to force refresh.
sets.writeConfig({ enabled: false })
listeners.get('fairy-tools/changed')()
ok('disable disposes previous restriction', fairy.state.disposed >= 1)

// disable again with a new fairy agent keeps it unrestricted
const fairy2 = makeAgent('s-fairy-2', 'fairy')
const created = listeners.get('agent/created')
created({ agent: fairy2 })
ok('disabled -> no restriction on new fairy', fairy2.state.filters.length === 0)

// enabled lean -> new fairy restricted to lean
sets.writeConfig({ enabled: true, mode: 'lean' })
const fairy3 = makeAgent('s-fairy-3', 'fairy')
created({ agent: fairy3 })
ok('lean restriction applied', fairy3.state.filters.length === 1)
ok('lean filter is LEAN minus unknown', JSON.stringify(fairy3.state.filters[0]) === JSON.stringify(sets.LEAN.filter((n) => n === 'read' || n === 'write')))

console.log('\nPASS ' + pass)
