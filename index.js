import { appendFileSync, closeSync, createReadStream, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import zlib from 'node:zlib'
import { MIND_KEYS, NEURAL_KEYS, memorySnapshot, writeMindFlags, writeNeuralFlags } from './memory-switch.js'
import {
  GROUPS,
  LEAN,
  RECOMMENDED,
  catalogFromDefinitions,
  readConfig,
  readSnapshot,
  resolveAllow,
  summarize,
  writeConfig,
} from './tool-sets.js'

/**
 * Fairy Ⅲ · H.D.D Skin — Host half.
 *
 *   GET  /fairy-zzz/assets/<file>   boot.mp4 / poster.jpg / hero.png / voice/greet-*.wav
 *   GET  /fairy-zzz/audio/<hash>.wav synthesized voice cache (Range capable)
 *   POST /fairy-zzz/tts             { text } -> { url, cached, seconds }
 *   GET  /fairy-zzz/mood            { mood } -> idle | thinking | working | done
 *   GET  /fairy-zzz/voice-home      { ok, home, source, reason }
 *   POST /fairy-zzz/voice-home      { home, probe? } -> 保存/校验引擎目录
 *   GET  /fairy-zzz/engine          { phase, home, error } -> 本地语音引擎状态
 *   POST /fairy-zzz/engine          { action: 'start' | 'stop' }
 *   GET  /fairy-zzz/tools           { config, catalog, totals } -> Fairy 工具链
 *   POST /fairy-zzz/tools           { enabled?, mode?, allow? } -> 保存并热生效
 *   GET  /fairy-zzz/health          { ok, engine, voice }
 *
 * The Client half owns every pixel; this half owns bytes, cache and the local
 * GPT-SoVITS process (already resident on 127.0.0.1:9800 in the usual case).
 */
export const name = 'fairy-zzz'
export const inject = ['webServer']

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ASSETS = join(HERE, 'assets')
const CACHE = process.env.FAIRY_CACHE_DIR || join(HERE, 'cache')

/* 语音队列：tools/fairy-say.ps1 负责合成 + SoundPlayer 串行播放，
   回复文本由皮肤 POST /fairy-zzz/say 交给它 —— 这是唯一会出声的通路，
   皮肤自己不再用浏览器 new Audio 播（2026-11-23 双通路回声事故）。 */
const SAY_SCRIPT = join(HERE, 'tools', 'fairy-say.ps1')
const SAY_ROOT = process.env.FAIRY_VOICE_STORE || join(homedir(), '.dsh', 'storages', 'fairy-voice')
const SAY_REQ_DIR = join(SAY_ROOT, 'requests')
const SAY_QUEUE_FILE = join(SAY_ROOT, 'queue.txt')

/* 印章层叠诊断的最近一次上报（内存里存一份，GET /fairy-zzz/stack 读取） */
let lastStack = null

/* 缓存命中门槛：真实合成结果都在几十 KB 以上，低于这个数的只可能是坏文件
   （例如 SAPI 兜底写出的 46 字节 RIFF 头），不能当成「已缓存」拿去播。 */
const MIN_WAV_BYTES = 2048

const TTS_PORT = Number(process.env.FAIRY_TTS_PORT || 9800)

/* 主进程「本次运行」的唯一标识：进程不退出就不会变。
   开屏问候用它做去重 —— 同一个主进程里只播一次，
   进程重启（pid 或启动时间变了）才重新播。 */
const RUN_ID = `run-${process.pid}-${Math.floor((Date.now() - process.uptime() * 1000) / 1000)}`

/* 语音引擎位置由用户自己指定，优先级：
   1. voice-home.txt（设置面板里填的目录，与插件同目录）—— 用户选择永远优先
   2. FAIRY_VOICE_HOME 环境变量（安装脚本 / 进阶用户）
   3. 插件同级 voice/（免安装便携包自带引擎）
   4. 旧版 FAIRY_TTS_DIR 环境变量（兼容早期安装）
   都没有就返回空串：皮肤照常工作，只是不朗读，设置面板会提示去指定目录。
   （问候语是预录 wav，不依赖引擎。） */
const VOICE_HINT = join(HERE, 'voice-home.txt')

function readVoiceHome() {
  try {
    const hint = readFileSync(VOICE_HINT, 'utf8').trim()
    if (hint) return resolve(hint)
  } catch {}
  if (process.env.FAIRY_VOICE_HOME) return resolve(process.env.FAIRY_VOICE_HOME)
  const beside = join(HERE, '..', 'voice')
  if (existsSync(join(beside, 'fairy_server.py'))) return resolve(beside)
  if (process.env.FAIRY_TTS_DIR) return resolve(process.env.FAIRY_TTS_DIR)
  return ''
}

function voiceHomeSource() {
  try {
    if (readFileSync(VOICE_HINT, 'utf8').trim()) return 'settings'
  } catch {}
  if (process.env.FAIRY_VOICE_HOME) return 'env'
  if (existsSync(join(HERE, '..', 'voice', 'fairy_server.py'))) return 'portable'
  if (process.env.FAIRY_TTS_DIR) return 'legacy'
  return 'none'
}

/* 用户填进来的路径：去引号、合并重复分隔符，Windows 下统一成反斜杠。 */
const IS_WIN = process.platform === 'win32'

function cleanHome(value) {
  let out = String(value ?? '')
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/([\\/])\1+/g, '$1')
  if (IS_WIN) out = out.replace(/\//g, '\\')
  return out
}

/* 检查一个目录是不是能跑起来的语音引擎，返回可读的诊断。 */
function inspectVoiceDir(dir) {
  const empty = { ok: false, home: '', source: voiceHomeSource(), reason: '' }
  if (!dir) return { ...empty, reason: '还没有指定语音引擎目录' }
  if (!existsSync(dir)) return { ...empty, home: dir, reason: '目录不存在：' + dir }
  const server = join(dir, 'fairy_server.py')
  if (!existsSync(server)) return { ...empty, home: dir, reason: '目录里没有 fairy_server.py' }
  const python = resolvePython(dir)
  if (!existsSync(python)) return { ...empty, home: dir, reason: '目录里没有 python\\python.exe 或 py311\\python.exe' }
  if (!existsSync(join(dir, 'GPT-SoVITS'))) return { ...empty, home: dir, reason: '目录里没有 GPT-SoVITS' }
  return {
    ok: true,
    home: dir,
    source: voiceHomeSource(),
    python,
    server,
    models: existsSync(join(dir, 'models')) ? join(dir, 'models') : '',
    reason: '',
  }
}

function saveVoiceHome(dir) {
  const clean = cleanHome(dir)
  const info = inspectVoiceDir(clean)
  if (!info.ok) return info
  try {
    writeFileSync(VOICE_HINT, clean + '\n', 'utf8')
  } catch (cause) {
    return { ...info, ok: false, reason: '写不进 voice-home.txt：' + String(cause?.message ?? cause) }
  }
  syncVoiceHome()
  return { ...inspectVoiceDir(clean), source: 'settings', saved: true }
}

let TTS_DIR = readVoiceHome()
let TTS_PY = resolvePython(TTS_DIR)
let TTS_SERVER = join(TTS_DIR, 'fairy_server.py')

function resolvePython(dir) {
  if (!dir) return ''
  return existsSync(join(dir, 'python', 'python.exe'))
    ? join(dir, 'python', 'python.exe')
    : join(dir, 'py311', 'python.exe')
}

/* 每次用到引擎前重新解析一次：改了环境变量 / voice-home.txt 之后
   不必重启宿主，下一次请求就会指向新目录。 */
function syncVoiceHome() {
  let dir = ''
  try {
    dir = readVoiceHome()
  } catch {
    return
  }
  if (dir === TTS_DIR) return
  TTS_DIR = dir
  TTS_PY = resolvePython(dir)
  TTS_SERVER = join(dir, 'fairy_server.py')
}
/* 语速：默认 0.72（上游原值 1.04；0.9 再乘 0.8 得到 0.72）。
   临时调整可以在插件目录放一个 voice-speed.txt 写数字，每次请求都会重读，
   改完不必重启宿主；越界值夹到 0.6–1.4。 */
const TTS_SPEED_DEFAULT = 0.72
const SPEED_HINT = join(HERE, 'voice-speed.txt')

function readSpeed() {
  try {
    const raw = readFileSync(SPEED_HINT, 'utf8').trim()
    const value = Number(raw)
    if (Number.isFinite(value) && value > 0) return Math.min(1.4, Math.max(0.6, value))
  } catch {}
  return TTS_SPEED_DEFAULT
}

/* 2026-11-23 16:15 主人要「播放分析内容」：上限从 500 字放宽到 4000 字，
   切段交给 fairy-say.ps1（按句切、Chunk 80），这里只做兜底截断。 */
const MAX_CHARS = 4000

const MIME = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

const mimeOf = (file) => MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'

async function sizeOf(file) {
  try {
    const info = await stat(file)
    return info.isFile() ? info.size : -1
  } catch {
    return -1
  }
}

async function sendFile(req, res, file) {
  const total = await sizeOf(file)
  if (total < 0) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found')
    return
  }
  const type = mimeOf(file)
  const range = req.headers.range
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (match) {
      const start = match[1] ? Number(match[1]) : 0
      const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1
      if (start <= end && start < total) {
        res.writeHead(206, {
          'content-type': type,
          'content-range': `bytes ${start}-${end}/${total}`,
          'accept-ranges': 'bytes',
          'content-length': end - start + 1,
          'cache-control': 'no-cache',
        })
        createReadStream(file, { start, end }).pipe(res)
        return
      }
    }
  }
  res.writeHead(200, {
    'content-type': type,
    'accept-ranges': 'bytes',
    'content-length': total,
    'cache-control': 'no-cache',
  })
  createReadStream(file).pipe(res)
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((done, fail) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        fail(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => done(Buffer.concat(chunks).toString('utf8')))
    req.on('error', fail)
  })
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/* ———————————————— 开屏问候：宿主直接放声 ————————————————
   网页要「先有一次用户交互」才允许出声（Chromium 的自动播放策略），而开屏问候
   是页面刚加载就要播，必然被拒。所以客户端播放失败时改由宿主进程直接播这段 wav：
   Windows 下用 PowerShell 的 System.Media.SoundPlayer，不受网页策略限制。
   只允许播 voice/ 下这几支预录问候，不接受任意路径。 */
const GREET_FILES = new Set([
  'greet.wav',
  'greet-morning.wav',
  'greet-noon.wav',
  'greet-afternoon.wav',
  'greet-evening.wav',
  'greet-night.wav',
])
let greetChild = null

function powershellPath() {
  const root = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
  const full = join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  return existsSync(full) ? full : 'powershell.exe'
}

function stopGreet() {
  const child = greetChild
  greetChild = null
  if (!child) return false
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
    } else {
      child.kill('SIGTERM')
    }
    return true
  } catch {
    return false
  }
}

function playGreet(file) {
  if (!IS_WIN) return { ok: false, reason: '宿主播放只支持 Windows' }
  if (!GREET_FILES.has(file)) return { ok: false, reason: '不认识的问候文件：' + file }
  const target = join(ASSETS, 'voice', file)
  if (!existsSync(target)) return { ok: false, reason: '问候文件不存在：' + target }
  stopGreet()
  const literal = target.replace(/'/g, "''")
  try {
    const child = spawn(
      powershellPath(),
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', `(New-Object System.Media.SoundPlayer '${literal}').PlaySync()`],
      { stdio: 'ignore', windowsHide: true, detached: true },
    )
    child.on('error', () => {})
    child.unref()
    greetChild = child
    return { ok: true, file, pid: child.pid }
  } catch (cause) {
    return { ok: false, reason: String(cause?.message ?? cause) }
  }
}

/* 当前时段该说哪一句（与客户端 greetSlot 保持一致） */
function currentGreetFile() {
  const hh = new Date().getHours()
  const slot = hh >= 5 && hh < 11
    ? 'morning'
    : hh >= 11 && hh < 14
      ? 'noon'
      : hh >= 14 && hh < 18
        ? 'afternoon'
        : (hh >= 18 && hh < 23 ? 'evening' : 'night')
  return 'greet-' + slot + '.wav'
}

/* 问候播放记录：排查「开屏没声音」时看 cache/greet.log */
function greetLog(line) {
  try {
    mkdirSync(CACHE, { recursive: true })
    appendFileSync(join(CACHE, 'greet.log'), new Date().toISOString() + ' ' + line + '\n', 'utf8')
  } catch {}
}

async function engineState() {
  try {
    const res = await fetch(`http://127.0.0.1:${TTS_PORT}/health`, { signal: AbortSignal.timeout(1500) })
    if (!res.ok) return { up: false, loading: false, ready: false, error: '', state: 'dead' }
    const data = await res.json().catch(() => ({}))
    const loading = Boolean(data?.loading)
    const ready = Boolean(data?.ready)
    return { up: true, loading, ready, error: String(data?.error ?? ''), state: ready ? 'ready' : loading ? 'loading' : 'error' }
  } catch {
    return { up: false, loading: false, ready: false, error: '', state: 'dead' }
  }
}

async function pingEngine() {
  return (await engineState()).up
}

let enginePromise = null
let engineChild = null

function ensureEngine() {
  syncVoiceHome()
  if (!enginePromise) {
    enginePromise = (async () => {
      const state = await engineState()
      if (state.up) return true
      if (!existsSync(TTS_PY) || !existsSync(TTS_SERVER)) {
        throw new Error(TTS_DIR ? `语音引擎不完整：${TTS_DIR}（请在 设置 → Fairy 里重新指定目录）` : '还没有指定语音引擎目录（设置 → Fairy → 语音引擎目录）')
      }
      const logFile = join(TTS_DIR, 'server.log')
      let out = 'ignore'
      try {
        out = openSync(logFile, 'a')
      } catch {}
      const child = spawn(TTS_PY, [TTS_SERVER, '--port', String(TTS_PORT)], {
        detached: true,
        stdio: ['ignore', out, out],
        cwd: TTS_DIR,
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      })
      child.unref()
      engineChild = child
      for (let tick = 0; tick < 180; tick += 1) {
        await sleep(1000)
        const now = await engineState()
        if (now.up) return true
        if (child.exitCode !== null && child.exitCode !== undefined) break
      }
      throw new Error('语音引擎启动超时（日志见 voice/server.log）')
    })().catch((cause) => {
      enginePromise = null
      throw cause
    })
  }
  return enginePromise
}

async function stopEngine() {
  enginePromise = null
  const child = engineChild
  engineChild = null
  if (!child) return false
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
    } else {
      child.kill('SIGTERM')
    }
    return true
  } catch {
    return false
  }
}

/** CPU 推理排队：一次只跑一句，跟引擎保持一致。 */
let queue = Promise.resolve()

function enqueue(run) {
  const task = queue.then(run, run)
  queue = task.then(
    () => undefined,
    () => undefined,
  )
  return task
}

const pending = new Map()

/* GPT-SoVITS 引擎不可用时的兜底：用 Windows 自带的 SAPI 中文语音合成到同一个 wav。
   文本先落到临时文件再用 [IO.File]::ReadAllText 读，避免命令行转义把中文弄坏。 */
function sapiSynthesize(text, file) {
  return new Promise((resolvePromise, reject) => {
    if (process.platform !== 'win32') {
      reject(new Error('SAPI 兜底只支持 Windows'))
      return
    }
    let txt
    let ps1
    try {
      mkdirSync(CACHE, { recursive: true })
      const stamp = createHash('sha1').update(text).digest('hex')
      txt = join(CACHE, 'sapi-' + stamp + '.txt')
      ps1 = join(CACHE, 'sapi-' + stamp + '.ps1')
      writeFileSync(txt, text, 'utf8')
      writeFileSync(ps1, [
        'Add-Type -AssemblyName System.Speech',
        '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
        "try { $s.SelectVoice('Microsoft Huihui Desktop') } catch {}",
        '$t = [IO.File]::ReadAllText($env:FAIRY_TTS_TXT, [Text.Encoding]::UTF8)',
        '$s.SetOutputToWaveFile($env:FAIRY_TTS_WAV)',
        '$s.Speak($t)',
        '$s.Dispose()',
      ].join("\r\n"), 'utf8')
    } catch (cause) {
      reject(cause)
      return
    }
    const child = spawn(powershellPath(), ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, FAIRY_TTS_TXT: txt, FAIRY_TTS_WAV: file },
    })
    let settled = false
    child.on('error', (cause) => {
      if (settled) return
      settled = true
      reject(cause)
    })
    child.on('exit', (code) => {
      if (settled) return
      settled = true
      try {
        const size = existsSync(file) ? statSync(file).size : 0
        if (size > MIN_WAV_BYTES) resolvePromise({ seconds: 0, engine: 'sapi' })
        else {
          /* 空壳（46 字节那种）必须删掉，否则会被当成缓存永久播放静音 */
          try {
            rmSync(file, { force: true })
          } catch {}
          reject(new Error(`SAPI 没有产出音频（exit ${String(code)}）`))
        }
      } catch (cause) {
        reject(cause)
      }
    })
  })
}

function synthesize(text, file) {
  return enqueue(async () => {
    try {
      await ensureEngine()
      const res = await fetch(`http://127.0.0.1:${TTS_PORT}/tts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, out: file, speed: readSpeed() }),
        signal: AbortSignal.timeout(240_000),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(`tts ${res.status}: ${data.error ?? 'unknown'}`)
      return data
    } catch (cause) {
      /* 引擎没装 / 没起来 / 报错 → 退回系统语音，至少保证能出声 */
      const fallback = await sapiSynthesize(text, file)
      greetLog('tts fallback sapi: ' + String(cause?.message ?? cause))
      return fallback
    }
  })
}

function cleanText(raw) {
  return String(raw ?? '')
    /* 2026-11-23 修「念 H.D.D. 不连贯」：带点的缩写会在合成端被拆成 H / D / D
       三段分别推理，段间多出约 0.4 秒静音。统一收成 HDD（实测 4.82s→3.54s，内部零空档）。 */
    /* 2026-11-23 16:5x 补：H.D.D 后面紧跟单词时留空格（H.D.D.System → HDD System），
       否则会连写成 HDDSystem 被引擎当成一个词。 */
    .replace(/H\s*[.．·]\s*D\s*[.．·]\s*D\s*[.．]?(?=[A-Za-z0-9])/gi, 'HDD ')
    .replace(/H\s*[.．·]\s*D\s*[.．·]\s*D\s*[.．]?/gi, 'HDD')
    .replace(/```[\s\S]*?```/g, '。')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_~#>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHARS)
}

/* ———————————————— 用量与花费 ————————————————
   本机会话日志（~/.dsh/sessions/<项目>/<会话>/session.v4.jsonl.zstd）是多帧
   zstd 拼接，逐帧解压后每行一个事件；assistant/message 事件带 data.usage：
   { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens }。 */
const SESSIONS_ROOT = join(homedir(), '.dsh', 'sessions')

/* DeepSeek 官方价目（元 / 百万 token），下标 0 = 空闲时段，1 = 高峰时段 */
const PRICES = {
  'deepseek-flash': { hit: [0.02, 0.04], miss: [1, 2], out: [4, 8] },
  'deepseek-v4-pro': { hit: [0.15, 0.3], miss: [4.5, 9], out: [13.5, 27] },
}
const DEFAULT_PRICE = PRICES['deepseek-flash']

/* 高峰：北京时间 周一至周五 09:00–12:00、14:00–18:00（不含中国法定节假日）；
   其余时间——含周末、法定节假日全天——一律空闲，价格是高峰的一半。
   规则出处：https://api-docs.deepseek.com/zh-cn/quick_start/pricing */
const BJ_OFFSET = 8 * 60 * 60 * 1000
const PEAK_RANGES = [[9 * 60, 12 * 60], [14 * 60, 18 * 60]]

/* 2026 年法定节假日（国办发明电〔2025〕，首尾都算）。新年份要补一行，缺年份时按纯工作日算。 */
const HOLIDAY_RANGES = [
  ['2026-01-01', '2026-01-03'], // 元旦
  ['2026-02-15', '2026-02-23'], // 春节
  ['2026-04-04', '2026-04-06'], // 清明节
  ['2026-05-01', '2026-05-05'], // 劳动节
  ['2026-06-19', '2026-06-21'], // 端午节
  ['2026-09-25', '2026-09-27'], // 中秋节
  ['2026-10-01', '2026-10-07'], // 国庆节
]
const HOLIDAY_DAYS = new Set()
for (const [from, to] of HOLIDAY_RANGES) {
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 86_400_000) {
    HOLIDAY_DAYS.add(new Date(t).toISOString().slice(0, 10))
  }
}

/* 把时刻换算成北京时间的日期 / 星期 / 当天分钟数 */
function beijingStamp(ms) {
  const d = new Date(ms + BJ_OFFSET)
  return {
    date: d.toISOString().slice(0, 10),
    weekday: d.getUTCDay(),
    minute: d.getUTCHours() * 60 + d.getUTCMinutes(),
  }
}

function isPeakAt(ms) {
  const s = beijingStamp(ms)
  if (s.weekday === 0 || s.weekday === 6) return false
  if (HOLIDAY_DAYS.has(s.date)) return false
  return PEAK_RANGES.some(([from, to]) => s.minute >= from && s.minute < to)
}

/* 下一次换价：逐分钟找第一个状态翻转的整分（最长间隔是周五 18:00 → 周一 09:00，7 天足够） */
function nextPeakFlip(ms) {
  const current = isPeakAt(ms)
  let t = Math.ceil(ms / 60_000) * 60_000
  const limit = t + 7 * 86_400_000
  while (t < limit) {
    t += 60_000
    if (isPeakAt(t) !== current) return t
  }
  return t
}

function peakState(now = new Date()) {
  const time = now.getTime()
  const offPeak = !isPeakAt(time)
  const flipAt = nextPeakFlip(time)
  const remainMs = Math.max(0, flipAt - time)
  const next = new Date(flipAt + BJ_OFFSET)
  const hh = String(next.getUTCHours()).padStart(2, '0')
  const mm = String(next.getUTCMinutes()).padStart(2, '0')
  return {
    offPeak,
    label: offPeak ? '空闲时段' : '高峰时段',
    window: '工作日 09–12、14–18 高峰',
    remainMs,
    nextAt: flipAt,
    nextClock: hh + ':' + mm,
    next: formatLeft(remainMs) + '后转' + (offPeak ? '高峰' : '空闲') + '价',
  }
}

/* 剩余时长：3 小时 12 分 / 47 分 / 不到 1 分 */
function formatLeft(ms) {
  const total = Math.max(0, Math.round(ms / 60_000))
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours && minutes) return hours + ' 小时 ' + minutes + ' 分'
  if (hours) return hours + ' 小时'
  if (minutes) return minutes + ' 分'
  return '不到 1 分'
}

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd]
const usageCache = new Map()

function sessionFiles() {
  const out = []
  let projects = []
  try {
    projects = readdirSync(SESSIONS_ROOT, { withFileTypes: true })
  } catch {
    return out
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue
    const dir = join(SESSIONS_ROOT, project.name)
    let sessions = []
    try {
      sessions = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const session of sessions) {
      if (!session.isDirectory()) continue
      const file = join(dir, session.name, 'session.v4.jsonl.zstd')
      if (existsSync(file)) out.push(file)
    }
  }
  return out
}

/* 解一整个日志文件，只留用量事件，避免把工具输出全塞进内存 */
function readUsageEvents(file) {
  let st
  try {
    st = statSync(file)
  } catch {
    return []
  }
  const cached = usageCache.get(file)
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) return cached.events
  if (typeof zlib.zstdDecompressSync !== 'function') return []

  const buf = readFileSync(file)
  const starts = []
  for (let i = 0; i + 4 <= buf.length; i++) {
    if (buf[i] === ZSTD_MAGIC[0] && buf[i + 1] === ZSTD_MAGIC[1] && buf[i + 2] === ZSTD_MAGIC[2] && buf[i + 3] === ZSTD_MAGIC[3]) {
      starts.push(i)
    }
  }
  const events = []
  for (let k = 0; k < starts.length; k++) {
    const end = k + 1 < starts.length ? starts[k + 1] : buf.length
    let text = ''
    try {
      text = zlib.zstdDecompressSync(buf.subarray(starts[k], end)).toString('utf8')
    } catch {
      continue
    }
    for (const line of text.split('\n')) {
      if (!line) continue
      let ev
      try {
        ev = JSON.parse(line)
      } catch {
        continue
      }
      if (ev?.type !== 'assistant/message') continue
      const usage = ev?.data?.usage
      const time = ev?.time
      if (!usage || typeof time !== 'number') continue
      events.push({
        time,
        turn: ev?.data?.turn,
        model: ev?.data?.message?.source?.model || '',
        input: Number(usage.inputTokens) || 0,
        output: Number(usage.outputTokens) || 0,
        hit: Number(usage.cacheReadTokens) || 0,
        write: Number(usage.cacheWriteTokens) || 0,
      })
    }
  }
  usageCache.set(file, { mtimeMs: st.mtimeMs, size: st.size, events })
  return events
}

function emptyBucket(extra) {
  return { hit: 0, miss: 0, out: 0, cost: 0, calls: 0, ...extra }
}

/* 每一笔都按它自己发生的那一刻计价：白天跑的算高峰价，夜里补跑的算空闲价 */
function addToBucket(bucket, ev) {
  const price = PRICES[ev.model] || DEFAULT_PRICE
  const priceIndex = isPeakAt(ev.time) ? 1 : 0
  const miss = ev.input + ev.write
  bucket.hit += ev.hit
  bucket.miss += miss
  bucket.out += ev.output
  bucket.calls += 1
  bucket.cost += (ev.hit * price.hit[priceIndex] + miss * price.miss[priceIndex] + ev.output * price.out[priceIndex]) / 1e6
}

function collectUsage() {
  const now = new Date()
  const stamp = beijingStamp(now.getTime())
  const todayStart = Date.parse(stamp.date + 'T00:00:00+08:00')
  const peak = peakState(now)

  const today = emptyBucket()
  let latest = null
  for (const file of sessionFiles()) {
    let st
    try {
      st = statSync(file)
    } catch {
      continue
    }
    if (st.mtimeMs < todayStart - 2 * 86400000) continue
    const events = readUsageEvents(file)
    if (latest === null || st.mtimeMs > latest.mtimeMs) latest = { file, mtimeMs: st.mtimeMs, events }
    for (const ev of events) {
      if (ev.time < todayStart) continue
      addToBucket(today, ev)
    }
  }

  let turn = null
  if (latest && latest.events.length > 0) {
    const last = latest.events[latest.events.length - 1]
    if (typeof last.turn === 'number') {
      turn = emptyBucket({ turn: last.turn })
      for (const ev of latest.events) {
        if (ev.turn === last.turn) addToBucket(turn, ev)
      }
    }
  }

  return { ok: true, now: now.getTime(), peak, today, turn }
}

export function apply(ctx) {
  const webServer = ctx.webServer
  if (!webServer) return

  /* 启动问候状态：宿主起来后如果页面迟迟没来要播放，就自己兜底放一次 */
  let startupTimer = null
  let hostGreetAt = 0
  const STARTUP_GREET_DELAY = 4000
  const DUPLICATE_WINDOW = 12_000

  /* 会话运行态：宿主事件 → 内存里的 mood 状态机（thinking / working / done） */
  const mood = { running: false, since: 0, doneAt: 0 }
    const moodSeen = { api: 0, agent: 0, stream: 0, session: 0 }
  const markRunning = (running) => {
    if (running === mood.running) return
    mood.running = running
    if (running) {
      mood.since = Date.now()
    } else {
      mood.doneAt = Date.now()
    }
  }
  try {
    if (typeof ctx.on === 'function') {
      ctx.on('api-session/status', (_sessionId, running) => { moodSeen.api++; markRunning(Boolean(running)) })
      ctx.on('agent/status', (payload) => { moodSeen.agent++; markRunning(payload?.status === 'running') })
      // 插件中途重载时会错过 running=true 的边沿事件，用流式帧把状态补回来
      ctx.on('agent/assistant-stream', () => { moodSeen.stream++; markRunning(true) })
      ctx.on('session/event', (first, second) => {
        moodSeen.session++
        /* 只有真正开始跑步骤的事件才算「在思考」。新建会话会落 agent-preset/selected
           之类的记账事件，以前这里一律 markRunning(true)，于是新建对话时眼睛会一直停在
           思考动画上。宿主不同版本可能按 (session, event) 或 { session, event } 派发，
           两种形状都取。 */
        const payload = second && typeof second === 'object'
          ? second
          : (first && typeof first === 'object' && first.event ? first.event : first)
        if (payload && payload.type === 'step/start') markRunning(true)
      })
    }
  } catch {}

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/mood',
      handler: (req, res) => {
        const now = Date.now()
        let state = 'idle'
        if (mood.running) {
          state = now - mood.since > 2500 ? 'working' : 'thinking'
        } else if (mood.doneAt && now - mood.doneAt < 2400) {
          state = 'done'
        }
        sendJson(res, 200, {
          mood: state,
          running: mood.running,
          elapsed: mood.running ? now - mood.since : 0,
          doneAt: mood.doneAt,
        })
      },
    }),
  )

  /* ————— 分析（思考）捕获 —————
     2026-11-23 主人要求「分析完成后，立刻朗读分析结果」。
     模型的分析（reasoning）在浏览器里默认折叠、收起来后正文不进 DOM，从页面读不到；
     但宿主侧的 agent/assistant-stream 帧里带着原始增量：
       · chunk.type === 'reasoning-delta' → 分析正文（有的适配器只发 delta）
       · chunk.type === 'block-end' + block.kind === 'reasoning' → 整块正文（权威版本）
       · chunk.type === 'text-delta'      → 正式回答开始（分析到此为止）
       · frame.type === 'end'             → 这次 attempt 收尾（兜底）
     按 attemptId+块号 存块，delta 先拼、block-end 到了就整块覆盖，最后按顺序 join。
     这里攒的是「当前轮」的分析，/fairy-zzz/analysis 交给皮肤轮询。 */
  const analysis = { turn: null, answerStarted: false, doneAt: 0, updatedAt: 0, frames: 0, pieces: 0, types: {} }
  const ANALYSIS_CAP = 24000
  const analysisBlocks = new Map()
  const answerBlocks = new Map()
  /** 回复正文的第一句：界面「已完成分析」下面那行就是它（2026-11-23 主人定稿）。 */
  const LAST_LEAD_FILE = join(SAY_ROOT, 'last-reply-lead.txt')
  let lastReplyLead = ''
  try {
    lastReplyLead = readFileSync(LAST_LEAD_FILE, 'utf8').trim().slice(0, 200)
  } catch {}
  const rememberReplyLead = () => {
    const lead = replyLeadText()
    if (lead && lead !== lastReplyLead) {
      lastReplyLead = lead
      try {
        writeFileSync(LAST_LEAD_FILE, lead, 'utf8')
      } catch {}
    }
    return lead
  }
  const replyLeadText = () => {
    let out = ''
    for (const piece of answerBlocks.values()) out += piece
    /* 2026-11-23 主人要求「代码块不读」：选句前先剥掉围栏代码块与行内代码，
       否则首行是代码时要么被念出来，要么剥完变空。 */
    const clean = out
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!clean) return ''
    const cut = clean.search(/[。！？!?；;]/)
    const first = cut >= 0 ? clean.slice(0, cut + 1) : clean
    return first.slice(0, 160)
  }

  const analysisText = () => {
    let out = ''
    for (const piece of analysisBlocks.values()) out += piece
    return out.slice(-ANALYSIS_CAP)
  }
  try {
    if (typeof ctx.on === 'function') {
      ctx.on('agent/assistant-stream', (payload) => {
        const frame = payload && payload.frame ? payload.frame : payload
        if (!frame || typeof frame !== 'object') return
        analysis.frames += 1
        if (frame.type === 'start') {
          if (analysis.turn !== frame.turn) {
            analysis.turn = frame.turn
            analysisBlocks.clear()
            answerBlocks.clear()
            analysis.answerStarted = false
            analysis.doneAt = 0
            analysis.pieces = 0
          }
          return
        }
        if (frame.type === 'chunk' && frame.chunk) {
          const chunk = frame.chunk
          const tkey = String(chunk.type) + (chunk.block && chunk.block.kind ? '/block:' + chunk.block.kind : '')
          analysis.types[tkey] = (analysis.types[tkey] || 0) + 1
          const key = String(frame.attemptId || '') + ':' + String(chunk.index)
          if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') {
            analysisBlocks.set(key, (analysisBlocks.get(key) || '') + chunk.text)
            analysis.updatedAt = Date.now()
            analysis.pieces = analysisBlocks.size
          } else if (chunk.type === 'block-end' && chunk.block && chunk.block.kind === 'reasoning'
            && typeof chunk.block.text === 'string') {
            analysisBlocks.set(key, chunk.block.text)
            analysis.updatedAt = Date.now()
            analysis.pieces = analysisBlocks.size
          } else if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
            analysis.answerStarted = true
            const akey = String(frame.attemptId || '') + ':a' + String(chunk.index)
            answerBlocks.set(akey, (answerBlocks.get(akey) || '') + chunk.text)
            /* 2026-11-23 主人反馈「念的时候多了一段分析过程」：正文只到半句时不能算 done，
               否则客户端会把兜底内容（思考）当成结果念出去。等首句出现句末标点再置真。 */
            const leadNow = replyLeadText()
            if (leadNow && analysis.doneAt === 0 && /[。！？!?；;\n]/.test(leadNow)) analysis.doneAt = Date.now()
          } else if (chunk.type === 'block-end' && chunk.block && chunk.block.kind === 'text'
            && typeof chunk.block.text === 'string') {
            const akey = String(frame.attemptId || '') + ':a' + String(chunk.index)
            answerBlocks.set(akey, chunk.block.text)
            rememberReplyLead()
          }
          return
        }
        if (frame.type === 'end') rememberReplyLead()
        if (frame.type === 'end' && !analysis.doneAt) {
          analysis.doneAt = Date.now()
        }
      })
    }
  } catch {}

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/analysis',
      handler: (req, res) => {
        const text = replyLeadText() || lastReplyLead || ''
        sendJson(res, 200, {
          turn: analysis.turn,
          text,
          analysis: analysisText().slice(-800),
          done: analysis.doneAt > 0,
          answerStarted: analysis.answerStarted,
          updatedAt: analysis.updatedAt,
          doneAt: analysis.doneAt,
          /* 诊断：帧数 / 分析块数 / 正文字数（判断「为什么没念」时先看这三个数） */
          frames: analysis.frames,
          pieces: analysis.pieces,
          chars: text.length,
          types: analysis.types,
        })
      },
    }),
  )

  ctx.effect(() =>
    webServer.register({
      kind: 'prefix',
      path: '/fairy-zzz/assets',
      handler: (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const rest = decodeURIComponent(url.pathname.slice('/fairy-zzz/assets'.length))
        const file = resolve(ASSETS, '.' + rest)
        if (!file.startsWith(ASSETS + sep)) {
          sendJson(res, 403, { error: 'forbidden' })
          return
        }
        return sendFile(req, res, file)
      },
    }),
  )

  /* 开屏问候：网页播放被自动播放策略拦下时，由宿主进程直接放这段预录 wav */
  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/greet',
      handler: async (req, res) => {
        if (req.method === 'GET') {
          sendJson(res, 200, { ok: true, platform: process.platform, files: [...GREET_FILES] })
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'method not allowed' })
          return
        }
        let body = {}
        try {
          body = JSON.parse(await readBody(req))
        } catch {}
        if (body && body.stop) {
          sendJson(res, 200, { ok: stopGreet() })
          return
        }
        const file = String((body && body.file) || 'greet.wav')
        /* 页面来要播放了：取消启动兜底，避免一次启动两声问候 */
        if (startupTimer) {
          clearTimeout(startupTimer)
          startupTimer = null
        }
        if (hostGreetAt && Date.now() - hostGreetAt < DUPLICATE_WINDOW) {
          greetLog('page ' + file + ' suppressed (host already played)')
          sendJson(res, 200, { ok: true, suppressed: true })
          return
        }
        const result = playGreet(file)
        if (result.ok) hostGreetAt = Date.now()
        greetLog('page ' + file + ' ok=' + result.ok + (result.reason ? ' reason=' + result.reason : ''))
        sendJson(res, result.ok ? 200 : 400, result)
      },
    }),
  )

  /* DSH 一启动就问好：页面通常几秒内就会来请求播放（用页面的时机，视觉与声音同步）；
     如果页面加载慢或压根没挂载主题，这里兜底自己播一次，保证「启动即有声音」。 */
  startupTimer = setTimeout(() => {
    startupTimer = null
    if (hostGreetAt) return
    const file = currentGreetFile()
    const result = playGreet(file)
    if (result.ok) hostGreetAt = Date.now()
    greetLog('startup ' + file + ' ok=' + result.ok + (result.reason ? ' reason=' + result.reason : ''))
  }, STARTUP_GREET_DELAY)
  try {
    startupTimer.unref?.()
  } catch {}

  ctx.effect(() =>
    webServer.register({
      kind: 'prefix',
      path: '/fairy-zzz/audio',
      handler: (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const rest = decodeURIComponent(url.pathname.slice('/fairy-zzz/audio'.length))
        if (!/^\/[a-f0-9]{40}\.wav$/.test(rest)) {
          sendJson(res, 404, { error: 'not found' })
          return
        }
        return sendFile(req, res, join(CACHE, rest.slice(1)))
      },
    }),
  )

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/health',
      handler: async (req, res) => {
        syncVoiceHome()
        const engine = await engineState()
        sendJson(res, 200, {
          ok: true,
          runId: RUN_ID,
          engine: engine.up,
          engineState: engine.state,
          engineError: engine.error,
          engineHome: TTS_DIR,
          engineManaged: Boolean(engineChild),
          voiceHome: inspectVoiceDir(TTS_DIR),
          voice: 'Fairy · Ⅲ',
          speed: readSpeed(),
          on: typeof ctx.on,
          seen: moodSeen,
          mood: mood.running ? 'running' : 'idle',
        })
      },
    }),
  )

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/usage',
      handler: async (req, res) => {
        try {
          const data = collectUsage()
          sendJson(res, 200, data)
        } catch (cause) {
          sendJson(res, 500, { ok: false, error: String(cause?.message ?? cause) })
        }
      },
    }),
  )

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/voice-home',
      handler: async (req, res) => {
        syncVoiceHome()
        if (req.method !== 'POST') {
          sendJson(res, 200, { ok: true, ...inspectVoiceDir(TTS_DIR) })
          return
        }
        let body = {}
        try {
          body = JSON.parse(await readBody(req))
        } catch {
          sendJson(res, 400, { ok: false, reason: 'bad request' })
          return
        }
        const raw = cleanHome(body?.home)
        if (body?.probe) {
          sendJson(res, 200, inspectVoiceDir(raw))
          return
        }
        if (!raw) {
          try {
            rmSync(VOICE_HINT, { force: true })
          } catch {}
          syncVoiceHome()
          sendJson(res, 200, { ok: true, ...inspectVoiceDir(TTS_DIR), cleared: true })
          return
        }
        const info = saveVoiceHome(raw)
        sendJson(res, info.ok ? 200 : 400, info)
      },
    }),
  )

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/engine',
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const action = url.searchParams.get('action') || 'status'
        syncVoiceHome()
        try {
          if (action === 'start') {
            await ensureEngine()
            sendJson(res, 200, { ok: true, engine: await engineState(), home: TTS_DIR })
            return
          }
          if (action === 'stop') {
            const stopped = await stopEngine()
            sendJson(res, 200, { ok: true, stopped, engine: await engineState(), home: TTS_DIR })
            return
          }
          sendJson(res, 200, { ok: true, engine: await engineState(), home: TTS_DIR, managed: Boolean(engineChild) })
        } catch (cause) {
          sendJson(res, 500, { ok: false, error: String(cause?.message ?? cause), home: TTS_DIR })
        }
      },
    }),
  )

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/tts',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'method not allowed' })
          return
        }
        let text = ''
        try {
          const body = JSON.parse(await readBody(req))
          text = cleanText(body?.text)
        } catch {
          sendJson(res, 400, { error: 'bad request' })
          return
        }
        if (!text) {
          sendJson(res, 400, { error: 'empty text' })
          return
        }
        const hash = createHash('sha1').update(text).digest('hex')
        const file = join(CACHE, `${hash}.wav`)
        const url = `/fairy-zzz/audio/${hash}.wav`
        try {
          const cachedSize = await sizeOf(file)
          if (cachedSize > MIN_WAV_BYTES) {
            sendJson(res, 200, { ok: true, url, cached: true })
            return
          }
          /* 2026-11-23 修「语音不播放」：SAPI 兜底在这台机器上会产出 46 字节的空壳
             （只有 RIFF 头、没有音频），而旧的判定是 sizeOf > 0 就算已缓存 ——
             于是同一个文本永远命中那个空壳、永远播静音。低于门槛的一律删掉重合成。 */
          if (cachedSize > 0) {
            try {
              rmSync(file, { force: true })
            } catch {}
          }
          let job = pending.get(hash)
          if (!job) {
            await mkdir(CACHE, { recursive: true })
            job = synthesize(text, file).finally(() => pending.delete(hash))
            pending.set(hash, job)
          }
          const data = await job
          if ((await sizeOf(file)) <= MIN_WAV_BYTES) {
            throw new Error('合成没有产出可用音频（可能是空壳 wav）')
          }
          sendJson(res, 200, { ok: true, url, cached: false, seconds: data?.seconds ?? 0 })
        } catch (cause) {
          try {
            rmSync(file, { force: true })
          } catch {}
          sendJson(res, 502, { error: String(cause?.message ?? cause) })
        }
      },
    }),
  )

  /* ———————————————— 语音队列（唯一会出声的通路） ————————————————
     POST /fairy-zzz/say { text, chunk? } → 交给 tools/fairy-say.ps1 排队播报。
     皮肤把每条回复的摘要（或全文）丢进来，脚本自己合成 + 串行播放；
     宿主只负责落一个 UTF-8 文本文件再拉起子进程，不阻塞 HTTP。
     GET  /fairy-zzz/say → 队列里还有几张嘴在等（排查「没声音」时先看这里）。 */
  /* 2026-11-23 主人要求「不读地址但显示地址」：
   队列只播剔除地址后的文本，这里另外记住原文，GET 时配回去给气泡显示。 */
const sayDisplayJobs = []
ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/say',
      handler: async (req, res) => {
        if (req.method === 'GET') {
          let queued = 0
          let lastError = ''
          let state = null
          try {
            const raw = readFileSync(SAY_QUEUE_FILE, 'utf8')
            queued = raw.split(/\r?\n/).filter((line) => line.trim()).length
          } catch {}
          try {
            const log = readFileSync(join(CACHE, 'say.log'), 'utf8').trim().split(/\r?\n/)
            lastError = log.slice(-3).join(' | ').slice(-300)
          } catch {}
          /* 播报状态：队列脚本每念一句就写一次 state.json，皮肤轮询它驱动朗读气泡。
             超过 20 秒没更新的当成已结束，避免脚本被杀时气泡永远挂着。 */
          try {
            const parsed = JSON.parse(readFileSync(join(SAY_ROOT, 'state.json'), 'utf8'))
            const fresh = Date.now() - Number(parsed?.at || 0) < 20000
            state = { ...parsed, phase: fresh ? parsed?.phase : 'idle' }
            if (state && typeof state.text === 'string' && state.text !== '') {
              for (let jobIndex = sayDisplayJobs.length - 1; jobIndex >= 0; jobIndex -= 1) {
                const job = sayDisplayJobs[jobIndex]
                if (job && job.text.includes(state.text)) {
                  state = { ...state, display: job.display }
                  break
                }
              }
            }
          } catch {}
          sendJson(res, 200, { ok: true, queued, script: existsSync(SAY_SCRIPT), lastError, state })
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'method not allowed' })
          return
        }
        let body = null
        try {
          body = JSON.parse(await readBody(req))
        } catch {
          sendJson(res, 400, { error: 'bad request' })
          return
        }
        const text = cleanText(body?.text)
        if (!text) {
          sendJson(res, 400, { error: 'empty text' })
          return
        }
        if (!existsSync(SAY_SCRIPT)) {
          sendJson(res, 501, { error: 'tools/fairy-say.ps1 不在包里（重装插件）' })
          return
        }
        const chunk = Math.max(12, Math.min(200, Number(body?.chunk) || 80))
        try {
          await mkdir(SAY_REQ_DIR, { recursive: true })
          const file = join(SAY_REQ_DIR, `say-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.txt`)
          const display = typeof body?.display === 'string' ? body.display.trim().slice(0, 800) : ''
          if (display) {
            sayDisplayJobs.push({ text, display })
            while (sayDisplayJobs.length > 20) sayDisplayJobs.shift()
          }
          writeFileSync(file, text, 'utf8')
          /* 2026-11-23 修「投了没声音」：一开始这里是 detached:true + stdio:'ignore' + windowsHide,
             在 Windows 上 CreateProcess 直接失败（DETACHED_PROCESS 撞 CREATE_NO_WINDOW），
             子进程一次都没起来；而我又没接 'error' 事件，所以 HTTP 照样回 ok。
             现在：不 detached；stdio 指向 cache/say.log 而不是 'ignore'
             （'ignore' 与真实文件描述符在个别环境下表现不同，实测落文件最稳，还顺手留下日志）；
             接上 'error'；child.pid 为空直接回 500。 */
          let out = 'ignore'
          try {
            mkdirSync(CACHE, { recursive: true })
            out = openSync(join(CACHE, 'say.log'), 'a')
          } catch {}
          const child = spawn(
            powershellPath(),
            ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', SAY_SCRIPT, '-TextFile', file, '-Chunk', String(chunk), '-Speed', String(readSpeed())],
            { stdio: ['ignore', out, out], windowsHide: true },
          )
          if (typeof out === 'number') {
            try {
              closeSync(out)
            } catch {}
          }
          child.on('error', (cause) => {
            try {
              mkdirSync(CACHE, { recursive: true })
              appendFileSync(join(CACHE, 'say.log'), new Date().toISOString() + ' spawn error: ' + String(cause?.message ?? cause) + '\n', 'utf8')
            } catch {}
          })
          child.unref()
          if (!child.pid) {
            sendJson(res, 500, { ok: false, error: '语音子进程没起来（见 GET /fairy-zzz/say 的 lastError）' })
            return
          }
          sendJson(res, 200, { ok: true, queued: true, pid: child.pid, chars: text.length, chunk })
        } catch (cause) {
          try {
            mkdirSync(CACHE, { recursive: true })
            appendFileSync(join(CACHE, 'say.log'), new Date().toISOString() + ' spawn failed: ' + String(cause?.message ?? cause) + '\n', 'utf8')
          } catch {}
          sendJson(res, 500, { ok: false, error: String(cause?.message ?? cause) })
        }
      },
    }),
  )

  /* 印章层叠诊断：客户端 place() 后一次性 POST 上来，GET 可取。
     用来判断「看起来还在文字下面」是 z-index 不够、祖先叠了上下文、还是被裁掉。 */
  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/stack',
      handler: async (req, res) => {
        if (req.method === 'POST') {
          try {
            lastStack = JSON.parse(await readBody(req))
            sendJson(res, 200, { ok: true })
          } catch {
            sendJson(res, 400, { ok: false })
          }
          return
        }
        sendJson(res, 200, { ok: true, stack: lastStack })
      },
    }),
  )

  /* ———————————————— 工具链（2026-11-27） ————————————————
     主人要的是「Fairy 会话下发哪些工具，设置页里点一下就能改，而且立刻省 token」。
     配置落在 ~/.dsh/fairy-tools.json；真正做限制的是同包的 toolgate.js（按 agent scope
     调 ctx.tools.restrict）。这里只负责读写配置、把真实清单和合计算给设置页看。
     清单优先读 gate 写的快照（含 preset 挂的 read / write / web / schedule / mind …；
     全局 ctx 看不到这些），没有快照时退回全局工具，至少不会空白。 */
  const toolsState = () => {
    const config = readConfig()
    const snapshot = readSnapshot()
    let source = 'none'
    let tools = []
    if (snapshot && Array.isArray(snapshot.tools) && snapshot.tools.length) {
      source = 'snapshot'
      tools = snapshot.tools
    } else {
      let definitions = []
      try {
        const service = typeof ctx.get === 'function' ? ctx.get('tools') : null
        if (service && typeof service.definitions === 'function') definitions = service.definitions()
      } catch {
        /* 没有 tools 服务（理论上不会）：给空清单，UI 会提示 */
      }
      tools = catalogFromDefinitions(definitions)
      if (tools.length) source = 'global'
    }
    return {
      ok: true,
      config: {
        enabled: config.enabled,
        mode: config.mode,
        allow: config.allow,
        exists: config.exists,
        updatedAt: config.updatedAt,
        file: config.file,
        error: config.error || '',
      },
      catalog: {
        source,
        generatedAt: Number(snapshot && snapshot.generatedAt) || 0,
        ageMs: snapshot && snapshot.generatedAt ? Math.max(0, Date.now() - Number(snapshot.generatedAt)) : 0,
        agents: Number(snapshot && snapshot.agents) || 0,
        applied: Boolean(snapshot && snapshot.applied),
        error: String((snapshot && snapshot.error) || ''),
        tools,
      },
      groups: GROUPS,
      presets: { lean: LEAN, recommended: RECOMMENDED },
      totals: summarize(tools, config),
      resolved: resolveAllow(config),
    }
  }

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/tools',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          try {
            sendJson(res, 200, toolsState())
          } catch (cause) {
            sendJson(res, 500, { ok: false, error: String(cause?.message ?? cause) })
          }
          return
        }
        let body = null
        try {
          body = JSON.parse(await readBody(req))
        } catch {
          sendJson(res, 400, { ok: false, error: 'bad request' })
          return
        }
        try {
          writeConfig({ enabled: body?.enabled, mode: body?.mode, allow: body?.allow })
          /* 让 toolgate 立刻重算，不用等它自己的 1.5 秒轮询。 */
          try {
            ctx.emit('fairy-tools/changed')
          } catch {
            /* 事件不可用就靠轮询兜底 */
          }
          sendJson(res, 200, toolsState())
        } catch (cause) {
          sendJson(res, 500, { ok: false, error: String(cause?.message ?? cause) })
        }
      },
    }),
  )

  /* ———————————————— 记忆开关 ———————————————— */

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/fairy-zzz/memory',
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          try {
            sendJson(res, 200, memorySnapshot())
          } catch (cause) {
            sendJson(res, 500, { ok: false, reason: String(cause?.message ?? cause) })
          }
          return
        }
        let body = null
        try {
          body = JSON.parse(await readBody(req))
        } catch {
          sendJson(res, 400, { ok: false, reason: 'bad request' })
          return
        }
        const result = { ok: true, saved: [], errors: [], mind: null, neural: null }
        const mindPatch = {}
        for (const key of MIND_KEYS) {
          if (typeof body?.mind?.[key] === 'boolean') mindPatch[key] = body.mind[key]
        }
        if (Object.keys(mindPatch).length) {
          try {
            writeMindFlags(mindPatch)
            result.saved.push('mind')
          } catch (cause) {
            result.ok = false
            result.errors.push('mind: ' + String(cause?.message ?? cause))
          }
        }
        const neuralPatch = {}
        for (const key of NEURAL_KEYS) {
          if (typeof body?.neural?.[key] === 'boolean') neuralPatch[key] = body.neural[key]
        }
        if (Object.keys(neuralPatch).length) {
          try {
            if (writeNeuralFlags(neuralPatch)) result.saved.push('neural')
            else result.saved.push('neural-unchanged')
          } catch (cause) {
            result.ok = false
            result.errors.push('neural: ' + String(cause?.message ?? cause))
          }
        }
        try {
          const fresh = memorySnapshot()
          result.mind = fresh.mind
          result.neural = fresh.neural
        } catch {
          /* 回读失败不影响"已写入"这个事实，UI 会保留旧显示 */
        }
        sendJson(res, result.ok ? 200 : 500, result)
      },
    }),
  )
}
