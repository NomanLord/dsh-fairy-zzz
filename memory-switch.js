/**
 * Fairy Ⅲ · 记忆开关（Host 半侧，2026-11-27）
 *
 * 为什么要有这个模块：`dsh-mind` 与 `dsh-neural-memory` 是宿主插件，它们各有一套
 * 互不相干的配置落点，主人不该为了"现在别注入"去手改 JSON / YAML：
 *
 *   · dsh-mind          → ~/.dsh/mind.json，插件自己每 15 秒轮询 mtime 热加载
 *   · dsh-neural-memory → profile 的 cordis.patch.yml，宿主只在启动时读，必须重启
 *
 * 两个来源的语义不同，上层（设置页）必须如实标出，不能都写成"已保存"。
 *
 * ⚠️ neural 那边**必须写全量键**：Cordis 的 config 覆盖是整份替换，少写一个键
 *    就等于把它重置回缺省（dim 从 128 掉回默认之类，且不会有任何提示）。
 * ⚠️ 找不到 profile 目录就报错，不猜路径 —— 写错文件比写不进去更难查。
 *
 * 单独成文件而不是塞进 index.js：index.js 依赖 Cordis 的 ctx，这里只依赖 fs，
 * 这样可以用 `node -e "import('./memory-switch.js')"` 直接测读写，不用启动宿主。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export const MIND_KEYS = ['enabled', 'psyche', 'tacit', 'diary', 'lifeline', 'tools']
export const NEURAL_KEYS = ['observe', 'recall', 'forget']

/** profile 目录：按 package.json 里含 dsh-fairy-zzz 来认，换 profile 名也不用改代码。 */
let profileDirCache = ''
export function resolveProfileDir() {
  if (profileDirCache) return profileDirCache
  const base = join(homedir(), '.dsh', 'profiles')
  try {
    for (const entry of readdirSync(base)) {
      const dir = join(base, entry)
      try {
        if (readFileSync(join(dir, 'package.json'), 'utf8').includes('dsh-fairy-zzz')) {
          profileDirCache = dir
          return dir
        }
      } catch {
        /* 没 package.json 的目录跳过 */
      }
    }
  } catch {
    /* 没有 profiles 目录：交给调用方报错 */
  }
  return ''
}

export const mindConfigPath = () => process.env.MIND_CONFIG || join(homedir(), '.dsh', 'mind.json')
export const neuralPatchPath = () => {
  const dir = resolveProfileDir()
  return dir ? join(dir, 'cordis.patch.yml') : ''
}

/** 写文件统一走临时文件 + rename：避免 dsh-mind 正好在轮询那一刻读到半截 JSON。 */
function writeFileAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = file + '.fairy-tmp'
  writeFileSync(tmp, text, 'utf8')
  renameSync(tmp, file)
}

/**
 * 读 dsh-mind 的开关。读不到 / 读坏一律按「全开」显示 ——
 * 与 DEFAULT_CONFIG 一致；显示成"关着"而实际在注入，比显示"开着"更难查。
 */
export function readMindFlags() {
  const path = mindConfigPath()
  const flags = { enabled: true, psyche: true, tacit: true, diary: true, lifeline: true, tools: true }
  let exists = false
  try {
    exists = existsSync(path)
    if (!exists) return { flags, exists, path }
    const raw = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
    const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback)
    if (typeof raw?.enabled === 'boolean') flags.enabled = raw.enabled
    flags.psyche = bool(raw?.psyche?.inject, true) && bool(raw?.psyche?.enabled, true)
    flags.tacit = bool(raw?.tacit?.inject, true) && bool(raw?.tacit?.enabled, true)
    flags.diary = bool(raw?.diary?.enabled, true)
    flags.lifeline = bool(raw?.lifeline?.inject, true) && bool(raw?.lifeline?.enabled, true)
    flags.tools = bool(raw?.tools, true)
  } catch {
    /* 坏 JSON：沿用默认值，dsh-mind 自己也会拒绝热加载这份坏文件 */
  }
  return { flags, exists, path }
}

/** 写 dsh-mind 的开关：只动这几个键，文件里其它键（budget / inject.gapMs…）原样保留。 */
export function writeMindFlags(patch) {
  const path = mindConfigPath()
  let raw = {}
  try {
    raw = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    raw = {}
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {}
  for (const key of MIND_KEYS) {
    const value = patch[key]
    if (typeof value !== 'boolean') continue
    if (key === 'enabled' || key === 'tools') {
      raw[key] = value
      continue
    }
    if (!raw[key] || typeof raw[key] !== 'object' || Array.isArray(raw[key])) raw[key] = {}
    if (key === 'diary') raw.diary.enabled = value
    else {
      raw[key].enabled = value
      raw[key].inject = value
    }
  }
  writeFileAtomic(path, JSON.stringify(raw, null, 2) + '\n')
}

/**
 * 找 profile 补丁里 dsh-neural-memory 那一段的边界。
 * 用行扫描而不是正则整块：YAML 的块边界靠缩进判断，正则很容易把后面的注释吃进去。
 */
function findNeuralBlock(lines) {
  const start = lines.findIndex((line) => /^- id:\s*dsh-neural-memory\s*$/.test(line))
  if (start < 0) return null
  let end = start + 1
  while (end < lines.length) {
    const line = lines[end]
    if (line.trim() === '') {
      end += 1
      continue
    }
    if (!/^\s+\S/.test(line)) break
    end += 1
  }
  while (end > start + 1 && lines[end - 1].trim() === '') end -= 1
  return { start, end }
}

/** 读神经记忆的开关。没有覆盖条目时按 bundle 的缺省（全开）显示。 */
export function readNeuralFlags() {
  const path = neuralPatchPath()
  const flags = { observe: true, recall: true, forget: true }
  if (!path || !existsSync(path)) return { flags, exists: false, path }
  try {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/)
    const span = findNeuralBlock(lines)
    if (!span) return { flags, exists: false, path }
    const body = lines.slice(span.start, span.end).join('\n')
    const pick = (name) => {
      const hit = body.match(new RegExp('^\\s+' + name + ':\\s*(\\S+)\\s*$', 'm'))
      return hit ? hit[1] : ''
    }
    const observe = pick('autoObserve')
    const recall = pick('autoRecall')
    const every = Number(pick('autoForgetEveryTurns'))
    if (observe === 'true') flags.observe = true
    else if (observe === 'false') flags.observe = false
    if (recall === 'true') flags.recall = true
    else if (recall === 'false') flags.recall = false
    if (Number.isFinite(every)) flags.forget = every > 0
    return { flags, exists: true, path }
  } catch {
    return { flags, exists: false, path }
  }
}

/** 写神经记忆的开关：整段重写（全量键），先留一份改动前备份。返回是否真的写了。 */
export function writeNeuralFlags(patch) {
  const path = neuralPatchPath()
  if (!path) throw new Error('找不到 profile 目录（cordis.patch.yml 写不了）')
  const before = readNeuralFlags().flags
  const next = { ...before }
  for (const key of NEURAL_KEYS) {
    if (typeof patch[key] === 'boolean') next[key] = patch[key]
  }
  if (NEURAL_KEYS.every((key) => next[key] === before[key])) return false

  const values = {
    dim: 128,
    embedMode: 'hybrid',
    momentum: 0.25,
    recallBoost: 0.15,
    surpriseThreshold: 0.35,
    decay: 0.02,
    persistDebounceMs: 1500,
    storageFormat: 'base64',
    migrateOnDimChange: true,
    autoObserve: next.observe,
    autoObserveThreshold: 0.55,
    autoObserveMaxSentences: 4,
    autoRecall: next.recall,
    autoRecallMinScore: 0.52,
    autoRecallMinCoverage: 0.3,
    autoRecallMinMargin: 0.08,
    autoRecallTopK: 3,
    autoRecallCooldownTurns: 5,
    autoInjectMaxChars: 600,
    autoForgetEveryTurns: next.forget ? 12 : 0,
    autoForgetDecay: 0.015,
  }
  const block = [
    '- id: dsh-neural-memory',
    '  # 由 Fairy 设置页「记忆系统」写入；整份替换 dsh-neural-memory 的 config',
    '  config:',
  ]
  for (const [key, value] of Object.entries(values)) block.push('    ' + key + ': ' + String(value))

  const original = readFileSync(path, 'utf8')
  const lines = original.split(/\r?\n/)
  const span = findNeuralBlock(lines)
  if (span) {
    lines.splice(span.start, span.end - span.start, ...block)
  } else {
    /* 插在 roost 托管块之前：那块标着 do not edit，写在它后面容易被覆盖或被误删 */
    const guard = lines.findIndex((line) => line.startsWith('# >>>') && line.includes('dsh-roost managed extensions'))
    if (guard >= 0) lines.splice(guard, 0, ...block, '')
    else {
      if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('')
      lines.push(...block, '')
    }
  }
  writeFileSync(path + '.bak-fairy-memory', original, 'utf8')
  writeFileAtomic(path, lines.join('\n'))
  return true
}

export function memorySnapshot() {
  const mind = readMindFlags()
  const neural = readNeuralFlags()
  return {
    ok: true,
    mind: { ...mind.flags, path: mind.path, exists: mind.exists },
    neural: { ...neural.flags, path: neural.path, exists: neural.exists },
    profileDir: resolveProfileDir(),
  }
}
