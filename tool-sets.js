/**
 * Fairy Ⅲ · 工具链配置（Host 半侧，2026-11-27）
 *
 * 主人要的是「Fairy 会话的工具有多少、开哪些，能在设置里点，而且真的省 token」。
 * 工具 schema 是每一次请求都要重发的固定成本（实测这套配置约 1.5 万 token），
 * 把用不上的工具从该 agent 的可见集合里摘掉，模型就既看不到说明也调不动。
 *
 * 三个落点：
 *   · ~/.dsh/fairy-tools.json            开关（enabled / mode / allow）
 *   · ~/.dsh/fairy-tools.snapshot.json   gate 从真实 Fairy 会话里量到的工具清单
 *   · toolgate.js                        按 agent 落实 restrict（见那个文件）
 *
 * 这个模块只依赖 node:fs / os / path，不碰 Cordis ctx —— 可以用 node 直接测；
 * index.js（HTTP 路由）与 toolgate.js（agent 限制）共用同一份配置解析，
 * 避免「设置页说省了 8k、实际只藏了 2 个工具」这种两套口径。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** 只对这一个 preset 的会话生效；别的模式一律不碰。 */
export const FAIRY_PRESET = 'fairy'
export const CONFIG_VERSION = 1
export const MODES = ['lean', 'recommended', 'custom', 'all']

export const CONFIG_FILE = () => process.env.FAIRY_TOOLS_CONFIG || join(homedir(), '.dsh', 'fairy-tools.json')
export const SNAPSHOT_FILE = () => process.env.FAIRY_TOOLS_SNAPSHOT || join(homedir(), '.dsh', 'fairy-tools.snapshot.json')

/** 设置页里的分组顺序；工具没登记分组时落到 other。 */
export const GROUPS = [
  { id: 'file', label: '文件与命令' },
  { id: 'web', label: '联网' },
  { id: 'memory', label: '记忆' },
  { id: 'task', label: '任务与定时' },
  { id: 'delegate', label: '委派与协作' },
  { id: 'deliver', label: '交互与交付' },
  { id: 'dev', label: '系统与开发' },
  { id: 'other', label: '其他' },
]

/**
 * 工具名 → 中文短名 + 分组。
 * 名字来自在装版本的实测清单；插件升级新增的工具没登记也能用（显示原名、落 other），
 * 不会因为这张表过期而把工具藏掉。
 */
export const TOOL_META = {
  read: { group: 'file', label: '读取文件' },
  read_image: { group: 'file', label: '读取图片' },
  write: { group: 'file', label: '创建文件' },
  edit: { group: 'file', label: '编辑文件' },
  apply_patch: { group: 'file', label: '补丁式编辑' },
  glob: { group: 'file', label: '按路径查找' },
  grep: { group: 'file', label: '按内容搜索' },
  pwsh: { group: 'file', label: 'PowerShell 命令' },
  bash: { group: 'file', label: 'Bash 命令' },
  working_directory: { group: 'file', label: '切换工作目录' },
  web_search: { group: 'web', label: '联网搜索' },
  web_fetch: { group: 'web', label: '抓取网页' },
  mind_view: { group: 'memory', label: '自我觉知总览' },
  mind_status: { group: 'memory', label: '记忆状态诊断' },
  mind_search: { group: 'memory', label: '搜索压缩原文' },
  mind_expand: { group: 'memory', label: '取回压缩原文' },
  mind_compress: { group: 'memory', label: '主动压缩上下文' },
  mind_intend: { group: 'memory', label: '声明当前意图' },
  mind_lifeline: { group: 'memory', label: '月度生命索引' },
  nm_observe: { group: 'memory', label: '写一条神经记忆' },
  nm_recall: { group: 'memory', label: '召回神经记忆' },
  nm_status: { group: 'memory', label: '神经记忆状态' },
  nm_forget: { group: 'memory', label: '执行一轮遗忘' },
  nm_export: { group: 'memory', label: '导出记忆快照' },
  nm_delete: { group: 'memory', label: '删除记忆条目' },
  ask_user_question: { group: 'deliver', label: '向主人提问' },
  present: { group: 'deliver', label: '交付文件' },
  propose_action: { group: 'deliver', label: '操作卡片' },
  office_render: { group: 'deliver', label: '渲染 Office 文档' },
  office_convert: { group: 'deliver', label: '转换 Office 文档' },
  office_recalculate: { group: 'deliver', label: '重算表格公式' },
  todo_write: { group: 'task', label: '待办清单' },
  schedule_create: { group: 'task', label: '创建定时任务' },
  schedule_list: { group: 'task', label: '列出定时任务' },
  schedule_view: { group: 'task', label: '查看定时任务' },
  schedule_edit: { group: 'task', label: '修改定时任务' },
  job_list: { group: 'task', label: '列出后台任务' },
  job_output: { group: 'task', label: '读取后台输出' },
  job_kill: { group: 'task', label: '终止后台任务' },
  get_goal: { group: 'task', label: '读取目标' },
  create_goal: { group: 'task', label: '建立目标' },
  update_goal: { group: 'task', label: '更新目标' },
  subagent: { group: 'delegate', label: '派出子代理' },
  subagent_fork: { group: 'delegate', label: '子代理（继承上下文）' },
  subagent_codex: { group: 'delegate', label: 'Codex 子代理' },
  workflow: { group: 'delegate', label: '多代理工作流' },
  send_message: { group: 'delegate', label: '给子代理发消息' },
  list_agents: { group: 'delegate', label: '列出子代理' },
  wait_agent: { group: 'delegate', label: '等待子代理' },
  list_subagent_models: { group: 'delegate', label: '子代理可用模型' },
  team_task_create: { group: 'delegate', label: '创建团队任务' },
  team_task_list: { group: 'delegate', label: '列出团队任务' },
  team_task_get: { group: 'delegate', label: '查看团队任务' },
  team_task_update: { group: 'delegate', label: '更新团队任务' },
  skill: { group: 'dev', label: '加载技能' },
  plugin_manager: { group: 'dev', label: '插件管理' },
  plugin_market: { group: 'dev', label: '插件市场' },
  cordis_inspect_list: { group: 'dev', label: 'Cordis 能力目录' },
  cordis_inspect_query: { group: 'dev', label: 'Cordis 能力查询' },
  create_worktree: { group: 'dev', label: '创建 Git worktree' },
  load_workspace_dependencies: { group: 'dev', label: '加载工作区依赖' },
  exit_plan_mode: { group: 'dev', label: '提交计划并退出计划模式' },
}

/** 精简：只留聊天 + 读写 + 联网 + 交付，约 11 个工具。 */
export const LEAN = [
  'read', 'write', 'edit', 'glob', 'grep', 'pwsh',
  'web_search', 'web_fetch',
  'ask_user_question', 'todo_write', 'present',
]

/**
 * 推荐：人设「工具纪律」里点名的能力都在，砍掉插件管理 / Cordis / worktree /
 * 团队任务 / 工作流 / Office 这些每次请求都很贵、平时又不用的。
 */
export const RECOMMENDED = [
  ...LEAN,
  'read_image',
  'mind_view', 'mind_status', 'mind_search', 'mind_expand', 'mind_compress', 'mind_intend', 'mind_lifeline',
  'nm_recall', 'nm_observe', 'nm_status',
  'schedule_create', 'schedule_list', 'schedule_view', 'schedule_edit',
  'job_list', 'job_output', 'job_kill',
  'get_goal', 'create_goal', 'update_goal',
  'subagent',
  'skill',
]

/** 命名预设；custom 直接读 allow。 */
export const PRESETS = { lean: LEAN, recommended: RECOMMENDED }

export const DEFAULT_CONFIG = () => ({
  version: CONFIG_VERSION,
  enabled: true,
  mode: 'recommended',
  allow: [...RECOMMENDED],
  updatedAt: 0,
})

/** 工具的显示元数据；没登记的名字原样落到 other，不丢工具。 */
export function describeTool(name) {
  const meta = TOOL_META[name]
  return meta ? { group: meta.group, label: meta.label } : { group: 'other', label: String(name) }
}

/** 去重 + 只留非空短字符串，顺序保持不变。 */
export function uniqueNames(value, limit = 400) {
  const seen = new Set()
  const out = []
  if (!Array.isArray(value)) return out
  for (const item of value) {
    if (typeof item !== 'string') continue
    const name = item.trim()
    if (!name || name.length > 80 || seen.has(name)) continue
    seen.add(name)
    out.push(name)
    if (out.length >= limit) break
  }
  return out
}

/**
 * 把磁盘上的 JSON 归一成完整配置。
 * mode 决定语义，allow 只对 custom 生效 —— 避免「文件里写着推荐、allow 是旧的自定义」
 * 这种自相矛盾的状态。
 */
export function normalizeConfig(raw) {
  const fallback = DEFAULT_CONFIG()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback
  const config = { ...fallback }
  if (typeof raw.enabled === 'boolean') config.enabled = raw.enabled
  if (MODES.includes(raw.mode)) config.mode = raw.mode
  if (Number.isFinite(Number(raw.updatedAt))) config.updatedAt = Number(raw.updatedAt)
  const allow = uniqueNames(raw.allow)
  if (config.mode === 'lean') config.allow = [...LEAN]
  else if (config.mode === 'recommended') config.allow = [...RECOMMENDED]
  else if (config.mode === 'all') config.allow = allow
  /* custom 但文件里没写 allow（手改坏了 / 只写了 mode）时按推荐处理：
     空列表在 restrict 语义里是「全部隐藏」，不该由一次拼写错误造成。 */
  else config.allow = Array.isArray(raw.allow) ? allow : [...RECOMMENDED]
  return config
}

/**
 * 本次真正要限制成什么：null = 不限制（主开关关掉或 mode=all），
 * 数组 = 只允许这些名字（可能为空数组，表示全部隐藏）。
 */
export function resolveAllow(config) {
  if (!config || config.enabled === false) return null
  if (config.mode === 'all') return null
  if (config.mode === 'lean') return [...LEAN]
  if (config.mode === 'recommended') return [...RECOMMENDED]
  return uniqueNames(config.allow)
}

export function readConfig() {
  const file = CONFIG_FILE()
  const base = { ...DEFAULT_CONFIG(), exists: false, file, error: '' }
  try {
    if (!existsSync(file)) return base
    const raw = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
    return { ...normalizeConfig(raw), exists: true, file, error: '' }
  } catch (cause) {
    return { ...base, exists: true, error: '读不懂 ' + file + '：' + String(cause?.message ?? cause) }
  }
}

/** 只接受 enabled / mode / allow；其余字段（version / updatedAt）由这里维护。 */
function pickPatch(patch) {
  const out = {}
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return out
  if (typeof patch.enabled === 'boolean') out.enabled = patch.enabled
  if (MODES.includes(patch.mode)) out.mode = patch.mode
  if (Array.isArray(patch.allow)) out.allow = uniqueNames(patch.allow)
  return out
}

/** 写回配置；返回回读后的完整配置（带 exists / file）。 */
export function writeConfig(patch) {
  const file = CONFIG_FILE()
  const current = readConfig()
  const next = normalizeConfig({ ...current, ...pickPatch(patch), updatedAt: Date.now() })
  writeAtomic(file, JSON.stringify({
    version: CONFIG_VERSION,
    enabled: next.enabled,
    mode: next.mode,
    allow: next.allow,
    updatedAt: Date.now(),
  }, null, 2) + '\n')
  return readConfig()
}

function writeAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = file + '.fairy-tmp'
  writeFileSync(tmp, text, 'utf8')
  renameSync(tmp, file)
}

export function readSnapshot() {
  const file = SNAPSHOT_FILE()
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tools)) return null
    return { ...raw, file }
  } catch {
    return null
  }
}

/** 快照给设置页读；内容没变就不落盘（gate 每次重算都调用它）。 */
export function writeSnapshot(snapshot) {
  const file = SNAPSHOT_FILE()
  const content = { version: CONFIG_VERSION, ...snapshot }
  try {
    const previous = readSnapshot()
    if (previous) {
      const strip = (value) => {
        const { generatedAt, file: _file, ...rest } = value
        return JSON.stringify(rest)
      }
      if (strip(previous) === strip({ ...content, generatedAt: 0 })) return false
    }
  } catch {
    /* 读不到旧快照就当变了 */
  }
  const payload = { ...content, generatedAt: Date.now() }
  writeAtomic(file, JSON.stringify(payload, null, 2) + '\n')
  return true
}

/**
 * 粗估 token：CJK 按 0.9 字/token，其余按 3.6 字符/token。
 * 只是给设置页一个可比较的量级（真实分词以提供方为准），不要拿它当账单。
 */
export function estimateTokens(text) {
  let cjk = 0
  let other = 0
  for (const ch of String(text ?? '')) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x2e80 && code <= 0x9fff) cjk += 1
    else if (code >= 0xf900 && code <= 0xfaff) cjk += 1
    else if (code >= 0xfe30 && code <= 0xfe4f) cjk += 1
    else if (code >= 0xff00 && code <= 0xff60) cjk += 1
    else if (code >= 0x3000 && code <= 0x303f) cjk += 1
    else other += 1
  }
  return Math.ceil(cjk * 0.9 + other / 3.6)
}

/** 只序列化模型真正看到的三段（name / description / parameters）。 */
export function toolTokenEstimate(definition) {
  if (!definition || typeof definition.name !== 'string') return 0
  return estimateTokens(JSON.stringify({
    name: definition.name,
    description: String(definition.description ?? ''),
    parameters: definition.parameters ?? {},
  }))
}

/** ToolDefinition[] → 设置页的清单（名字 / 短名 / 分组 / 估算 token / 截断描述）。 */
export function catalogFromDefinitions(definitions) {
  const out = []
  for (const definition of definitions ?? []) {
    if (!definition || typeof definition.name !== 'string') continue
    const meta = describeTool(definition.name)
    out.push({
      name: definition.name,
      label: meta.label,
      group: meta.group,
      tokens: toolTokenEstimate(definition),
      description: String(definition.description ?? '').slice(0, 360),
    })
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

/** 给设置页的合计：全部 / 当前开启 / 省下多少。 */
export function summarize(tools, config) {
  const list = Array.isArray(tools) ? tools : []
  const allow = resolveAllow(config)
  const known = new Set(list.map((tool) => tool.name))
  const enabled = allow === null ? new Set(known) : new Set(allow.filter((name) => known.has(name)))
  let allTokens = 0
  let enabledTokens = 0
  for (const tool of list) {
    const tokens = Number(tool.tokens) || 0
    allTokens += tokens
    if (enabled.has(tool.name)) enabledTokens += tokens
  }
  const saved = Math.max(0, allTokens - enabledTokens)
  return {
    restricted: allow !== null,
    all: { count: list.length, tokens: allTokens },
    enabled: { count: enabled.size, tokens: enabledTokens },
    saved: {
      count: Math.max(0, list.length - enabled.size),
      tokens: saved,
      pct: allTokens > 0 ? Math.round((saved / allTokens) * 100) : 0,
    },
  }
}
