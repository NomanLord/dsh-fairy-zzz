/**
 * Fairy Ⅲ · 工具链闸门（Host 半侧，2026-11-27）
 *
 * 主人要「Fairy 模式的工具能动态删/加，靠少下发工具省 token，并且能在皮肤设置里开关」。
 * 实现只用 DSH 公开的 `ctx.tools.restrict()`：它只能从**带 agent scope 的 ctx** 调用
 * （全局调用会被明确拒绝），所以本插件挂在 profile 全局，监听 `agent/created`，
 * 只对 preset 为 `fairy` 的 agent 调 `agent.ctx.tools.restrict(...)`。
 *
 * 为什么限制要落在 agent 作用域，而不是 preset 插件里：
 *   · `restrict` 校验的名字只能是「继承层」的工具（全局 + preset 挂的 tool-*）；
 *     preset 自己的插件把工具注册在 preset 层，从 preset ctx 调 restrict 会被判成
 *     unknown global tool，藏不掉这些工具。
 *   · 从 agent ctx 调，agent 自己的注册保持可见，preset 层与全局层都按 allow 过滤 ——
 *     正好覆盖 Fairy 会话的整套工具链（read / write / web / schedule / mind / nm ...）。
 *
 * 生效语义：
 *   · 新建 / 恢复的 Fairy 会话在 `agent/created` 时立刻限制（首轮请求就是精简后的）；
 *   · 已在线会话靠 1.5 秒轮询 + 设置页写入后的 `fairy-tools/changed` 事件重算；
 *   · 关掉主开关或选「全部」= 解除限制（dispose 上一次的 restrict）。
 *
 * 插件自己绝不抛异常：`agent/created` 的监听器一旦抛错会**让会话创建失败**，
 * 省 token 的工具没资格把主人的会话弄挂。
 */
import {
  FAIRY_PRESET,
  catalogFromDefinitions,
  readConfig,
  readSnapshot,
  resolveAllow,
  writeSnapshot,
} from './tool-sets.js'

export const name = 'fairy-toolgate'

/* 需要 tools（限制的对象）与 agents（已有会话 + 生命周期事件）。 */
export const inject = ['tools', 'agents']

const POLL_MS = 1500

export function apply(ctx) {
  /** agent.id -> { agent, catalog, dispose, error } */
  const tracked = new Map()
  /** 上一次实际生效的配置签名，避免轮询每次都重算。 */
  let signature = null

  const log = (message) => {
    try {
      if (ctx.logger && typeof ctx.logger.info === 'function') ctx.logger.info('[fairy-toolgate] ' + message)
    } catch {
      /* 日志失败不影响限制 */
    }
  }

  const presetService = () => {
    try {
      return ctx.get('agentPresets')
    } catch {
      return undefined
    }
  }

  const presetOf = (agent) => {
    try {
      const service = presetService()
      if (!service || typeof service.presetForSession !== 'function') return null
      return service.presetForSession(agent.session)
    } catch {
      return null
    }
  }

  const isFairy = (agent) => {
    try {
      return presetOf(agent) === FAIRY_PRESET
    } catch {
      return false
    }
  }

  /** 限制前的完整清单（要给设置页看全量，不能拿限制后的结果当目录）。 */
  const catalogOf = (agent) => {
    try {
      return catalogFromDefinitions(agent.ctx.tools.definitions(agent))
    } catch {
      return []
    }
  }

  /** 限制后实际可见的工具名（写进快照，用来核对真的藏掉了）。 */
  const visibleOf = (agent) => {
    try {
      return agent.ctx.tools.definitions(agent).map((tool) => tool.name)
    } catch {
      return []
    }
  }

  const release = (entry) => {
    if (!entry || typeof entry.dispose !== 'function') return
    try {
      entry.dispose()
    } catch {
      /* 会话已经拆掉时 disposer 可能已失效 */
    }
    entry.dispose = null
  }

  /**
   * 把配置落实到一个 agent。返回本次条目。
   * allow 里若混进 agent 自己注册的工具名（restrict 不接受），解析报错里点名的
   * 名字后剔掉重试一次 —— 这样以后别的插件往 agent scope 塞工具也不会把整条限制搞丢。
   */
  const applyTo = (agent, config) => {
    try {
      const previous = tracked.get(agent.id)
      release(previous)

      const catalog = catalogOf(agent)
      const wanted = resolveAllow(config)
      let dispose = null
      let error = ''

      if (wanted !== null) {
        const known = new Set(catalog.map((tool) => tool.name))
        let allow = wanted.filter((name) => known.has(name))
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            dispose = agent.ctx.tools.restrict({ allow })
            error = ''
            break
          } catch (cause) {
            const message = String(cause?.message ?? cause)
            const head = message.includes('known global tools:')
              ? message.slice(0, message.indexOf('known global tools:'))
              : message
            const unknown = []
            const re = /"([^"]+)"/g
            let hit
            while ((hit = re.exec(head))) unknown.push(hit[1])
            const next = allow.filter((name) => !unknown.includes(name))
            if (attempt > 0 || next.length === allow.length) {
              error = message
              break
            }
            allow = next
          }
        }
      }

      const entry = { agent, catalog, dispose, error }
      tracked.set(agent.id, entry)
      if (error) log('限制失败（本会话按全量工具继续）：' + error)
      return entry
    } catch (cause) {
      /* agent 已经拆掉 / ctx 不可用：不再跟踪，绝不向外抛。 */
      tracked.delete(agent.id)
      log('应用限制失败：' + String(cause?.message ?? cause))
      return null
    }
  }

  /**
   * 写快照给设置页。没有在线 Fairy 会话时保留上一次的目录（否则「没有 Fairy 会话」
   * 会把设置页的工具清单清空，主人就没法预先配置了）。
   * 多个 agent 时按名字取并集：子代理会继承父代理的限制，它看到的清单可能是裁剪过的，
   * 不能拿它盖掉主会话那份全量目录。
   */
  const publish = (config, fallback) => {
    const merged = new Map()
    for (const entry of tracked.values()) {
      for (const tool of entry.catalog || []) {
        if (!merged.has(tool.name)) merged.set(tool.name, tool)
      }
    }
    if (!merged.size && fallback) {
      for (const tool of fallback.catalog || []) {
        if (!merged.has(tool.name)) merged.set(tool.name, tool)
      }
    }
    if (!merged.size) {
      try {
        const previous = readSnapshot()
        if (previous && Array.isArray(previous.tools)) {
          for (const tool of previous.tools) {
            if (tool && tool.name && !merged.has(tool.name)) merged.set(tool.name, tool)
          }
        }
      } catch {
        /* 没旧快照就算了 */
      }
    }
    const entry = tracked.size ? tracked.values().next().value : fallback
    const visible = entry && entry.agent ? visibleOf(entry.agent) : []
    const restricted = resolveAllow(config) !== null
    const snapshot = {
      preset: FAIRY_PRESET,
      agents: tracked.size,
      enabled: Boolean(config && config.enabled),
      mode: (config && config.mode) || 'custom',
      applied: Boolean(restricted && tracked.size > 0 && !entry?.error),
      error: entry?.error || '',
      tools: [...merged.values()].sort((a, b) => a.name.localeCompare(b.name)),
      visible,
    }
    try {
      writeSnapshot(snapshot)
    } catch (cause) {
      log('写快照失败：' + String(cause?.message ?? cause))
    }
  }

  const applyAll = (config) => {
    for (const [id, entry] of [...tracked.entries()]) {
      if (!entry.agent) {
        tracked.delete(id)
        continue
      }
      /* 只有「确定换成了别的 preset」才放手；preset 投影偶发读不到（null）时保持现状，
         免得一次抖动就把限制永久卸掉、下一轮也不再补。 */
      let preset = null
      try {
        preset = presetOf(entry.agent)
      } catch {
        preset = null
      }
      if (preset !== null && preset !== FAIRY_PRESET) {
        release(entry)
        tracked.delete(id)
        continue
      }
      applyTo(entry.agent, config)
    }
  }

  const refresh = (force) => {
    let config
    try {
      config = readConfig()
    } catch {
      return
    }
    const nextSignature = JSON.stringify([config.enabled, config.mode, config.allow])
    if (!force && nextSignature === signature) return
    signature = nextSignature
    applyAll(config)
    publish(config)
  }

  /* 已有会话：插件热加载/宿主启动时 agents.list() 里可能已经有一批（启动恢复是分批的，
     后面新建的还会走 agent/created）。 */
  try {
    const config = readConfig()
    signature = JSON.stringify([config.enabled, config.mode, config.allow])
    for (const agent of ctx.agents.list()) {
      if (isFairy(agent)) applyTo(agent, config)
    }
    publish(config)
  } catch (cause) {
    log('初始化失败：' + String(cause?.message ?? cause))
  }

  /* 新会话 / 恢复会话：创建完成前限制好，首轮请求就是精简的。 */
  ctx.on('agent/created', (payload) => {
    try {
      const agent = payload && payload.agent
      if (!agent || !isFairy(agent)) return
      const config = readConfig()
      signature = JSON.stringify([config.enabled, config.mode, config.allow])
      applyTo(agent, config)
      publish(config)
    } catch (cause) {
      log('处理 agent/created 失败：' + String(cause?.message ?? cause))
    }
  })

  /* 会话关闭：不再跟踪；保留目录，记下在线数变化。 */
  ctx.on('agent/disposed', (payload) => {
    try {
      const agent = payload && payload.agent
      if (!agent) return
      const entry = tracked.get(agent.id)
      tracked.delete(agent.id)
      if (entry) {
        entry.agent = null
        publish(readConfig(), entry)
      }
    } catch {
      /* 会话已经没了，不影响其它会话 */
    }
  })

  /* 设置页保存后立刻重算，不用等下一次轮询。 */
  ctx.on('fairy-tools/changed', () => {
    try {
      refresh(true)
    } catch {
      /* 保存已经落盘，轮询会兜底 */
    }
  })

  /* 轮询兜底：手改 fairy-tools.json、或事件在插件重载时丢失，都能自愈。 */
  ctx.effect(() => {
    const timer = setInterval(() => {
      try {
        refresh(false)
      } catch {
        /* 单次轮询失败不致命 */
      }
    }, POLL_MS)
    if (timer && typeof timer.unref === 'function') timer.unref()
    return () => clearInterval(timer)
  })

  /* 插件卸载时解除所有限制，把工具集还给正在跑的 Fairy 会话。 */
  ctx.effect(() => () => {
    for (const entry of tracked.values()) release(entry)
    tracked.clear()
  })
}
