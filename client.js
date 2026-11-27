window.__ModuleLoader__.load({
  id: 'dsh-fairy-zzz',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useLayoutEffect, useRef, useState } = React

    const NS = 'fairy-zzz'
    const PKG = 'dsh-fairy-zzz'
    const VOICE_KEY = 'fairy.zzz.voice'
    const SEEN_KEY = 'fairy.zzz.seen'
    const DRAG_KEY = 'fairy.zzz.drag'
    const POS_KEY = 'fairy.zzz.dock-pos'
    const EYE_KEY = 'fairy.zzz.eye-hidden'
    const TURN_COUNT_KEY = 'fairy.zzz.turn-count'
    const THEME_KEY = 'fairy.zzz.theme-mode'
    /* ————— 复位延迟（ms）：所有「复位 / 重新落位」都等这一个时间 —————
       2026-11-22 主人要求「把所有的复位延迟设定成同一时间」，原来这里各写各的：
         · 设置页「眼标复位」/ fz3:dock-reset 的防抖 ...... 2000ms
         · 每轮对话结束后的自动复位 ...................... 1500ms（再叠上面 2000ms）
         · 侧栏开合后重新落位 ............................ 1000ms
         · 首帧落位的重试节拍 ............................ 400ms
         · 新建对话页切回来后的落位轮询 .................. 250ms
       现在统一成这一个数。宿主侧栏/面板的过渡是 --ds-transition-duration-slow = 0.3s，
       所以 300ms 是「量几何不量到半路」的下限；这里取 350ms 留一点余量。
       想整体调快/调慢只改这一行，五个路径会一起变。 */
    const RESET_DELAY = 350
    /* 毛玻璃模糊强度（px）：设置页滑块的持久化键与取值范围 */
    const GLASS_KEY = 'fairy.zzz.glass-blur'
    const GLASS_DEFAULT = 14
    const GLASS_MIN = 0
    const GLASS_MAX = 30
    /* 一次性迁移：早前那版“窄窗口自动关眼徽”把 EYE_KEY 写成了 true，这里复位一次 */
    try {
      if (localStorage.getItem('fairy.zzz.eye-hidden.v2') !== '1') {
        localStorage.removeItem(EYE_KEY)
        localStorage.setItem('fairy.zzz.eye-hidden.v2', '1')
      }
    } catch (e) { /* 隐私模式忽略 */ }
    const greetSlot = () => {
      const hh = new Date().getHours()
      if (hh >= 5 && hh < 11) return 'morning'
      if (hh >= 11 && hh < 14) return 'noon'
      if (hh >= 14 && hh < 18) return 'afternoon'
      if (hh >= 18 && hh < 23) return 'evening'
      return 'night'
    }
    const GREETING_FILE = () => 'greet-' + greetSlot() + '.wav'
    const GREETING = () => '/fairy-zzz/assets/voice/' + GREETING_FILE()
    /* 新建对话页 hero 的官方文案没有插槽可换：按界面语言改写成 H.D.D 版本 */
    const HERO_COPY = {
      zh: { headline: '空洞深潜系统', badge: 'H.D.D Ⅲ' },
      en: { headline: 'HOLLOW DEEP DIVE SYSTEM', badge: 'H.D.D III' },
    }
    const CJK_RE = /[\u3400-\u9fff]/

    /* ————— 新建对话页（hero）的判定 —————
       hero 标题组（_titleGroup，收缩到内容宽，左缘 = 标题文字起点）量得到、且在视口里，
       就认为停在「新会话界面」。眼徽在这一页由 placeHero 钉到标题文字的正上方（深浅色一致）；
       其它复位路径（每轮结束、侧栏开合、拖拽坐标）一律让路，不跟它抢位置。 */
    const heroRect = () => {
      if (typeof document === 'undefined') return null
      const group = document.querySelector('[class*="_headline"] [class*="_titleGroup"]')
      if (group === null) return null
      const r = group.getBoundingClientRect()
      if (!(r.width > 40 && r.height > 8)) return null
      if (r.bottom <= 0 || r.top >= window.innerHeight) return null
      return r
    }
    const onHeroPage = () => heroRect() !== null

    /* Fairy 眼睛：Apache-2.0，改编自 Fairy-DSH（见 NOTICE-fairy-dsh.md） */
    const FAIRY_EYE_SVG = `<!-- SPDX-License-Identifier: Apache-2.0 Adapted from Fairy-DSH, Copyright 2026 Chengzhibense. Source commit d639887a386b0de6fef2e61c97dc268631854591: mascot-geometry.js / mascot-eye-svg.js (see ../NOTICE). MODIFIED for pi-fairy-animation: standalone SVG, padded canvas, named offline animation anchors, white outer halo in both themes, separate contrast edge; browser effects, states, scanlines and glitch clones removed. Generated PNGs and vector previews inherit this attribution; see ../NOTICE. --> <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="-1 -1 162 162"> <defs> <linearGradient id="outer-gradient" x1=".2" y1="0" x2=".8" y2="1"> <stop stop-color="#3145d6"/> <stop offset=".54" stop-color="#2233b2"/> <stop offset="1" stop-color="#2b3cbc"/> </linearGradient> <!-- One static radial field replaces separate halo strokes, avoiding alpha seams. --> <radialGradient id="sclera-halo-gradient" gradientUnits="userSpaceOnUse" cx="80" cy="80" r="56" color-interpolation="linearRGB"> <stop offset=".82" stop-color="#ffffff" stop-opacity="0"/> <stop offset=".864" stop-color="#ffffff" stop-opacity=".22"/> <stop offset=".875" stop-color="#ffffff" stop-opacity=".28"/> <stop offset=".89" stop-color="#ffffff" stop-opacity=".19"/> <stop offset=".91" stop-color="#ffffff" stop-opacity=".11"/> <stop offset=".94" stop-color="#ffffff" stop-opacity=".07"/> <stop offset=".96" stop-color="#ffffff" stop-opacity=".035"/> <stop offset="1" stop-color="#ffffff" stop-opacity="0"/> </radialGradient> <radialGradient id="outer-halo-gradient" gradientUnits="userSpaceOnUse" cx="80" cy="80" r="79" color-interpolation="linearRGB"> <stop offset=".80" stop-color="#ffffff" stop-opacity="0"/> <stop offset=".84" stop-color="#ffffff" stop-opacity=".10"/> <stop offset=".868" stop-color="#ffffff" stop-opacity=".28"/> <stop offset=".90" stop-color="#ffffff" stop-opacity=".18"/> <stop offset=".95" stop-color="#ffffff" stop-opacity=".06"/> <stop offset=".99" stop-color="#ffffff" stop-opacity=".02"/> <stop offset="1" stop-color="#ffffff" stop-opacity="0"/> </radialGradient> <radialGradient id="highlight-halo-gradient" gradientUnits="userSpaceOnUse" cx="98" cy="100.5" r="18" color-interpolation="linearRGB"> <stop offset=".53" stop-color="#f5f8fd" stop-opacity="0"/> <stop offset=".56" stop-color="#f5f8fd" stop-opacity=".16"/> <stop offset=".611" stop-color="#f5f8fd" stop-opacity=".43"/> <stop offset=".72" stop-color="#f5f8fd" stop-opacity=".19"/> <stop offset=".77" stop-color="#f5f8fd" stop-opacity=".12"/> <stop offset=".83" stop-color="#f5f8fd" stop-opacity=".055"/> <stop offset=".89" stop-color="#f5f8fd" stop-opacity=".02"/> <stop offset=".96" stop-color="#f5f8fd" stop-opacity=".004"/> <stop offset="1" stop-color="#f5f8fd" stop-opacity="0"/> </radialGradient> <clipPath id="fz3-lid-cover-clip"><circle cx="80" cy="80" r="56"/></clipPath> </defs> <!-- 79-unit halo within an 81-unit half-canvas: padding with near-original apparent disc size. --> <g id="fairy"> <circle id="outer-halo" cx="80" cy="80" r="79" fill="url(#outer-halo-gradient)"/> <!-- Only this supporting edge changes with theme; white rim and halo stay white. --> <circle id="contrast-edge" cx="80" cy="80" r="68" fill="none" stroke="#dceaff" stroke-width="1.8"/> <circle id="outer-disc" cx="80" cy="80" r="68" fill="url(#outer-gradient)" stroke="#f2fbff" stroke-width="1.2"/> <g id="corners" transform="rotate(0 80 80)" fill="#1f2573"> <circle cx="80" cy="80" r="51.75"/> <rect x="37" y="37" width="86" height="86" rx="2" transform="rotate(3 80 80)"/> </g> <g id="eye-anatomy"><g id="sclera" transform="translate(80 80) scale(1) translate(-80 -80)"> <circle cx="80" cy="80" r="48" fill="#eef0f5"/> <circle id="sclera-halo" cx="80" cy="80" r="56" fill="url(#sclera-halo-gradient)"/> <circle cx="80" cy="80" r="48" fill="none" stroke="#ffffff" stroke-width=".8" stroke-opacity=".16"/> </g> <g id="iris-outer" transform="translate(80 80) scale(1) translate(-80 -80)"> <circle cx="80" cy="80" r="33" fill="#9daee0"/> </g> <g id="iris-blue" transform="translate(80 80) scale(1) translate(-80 -80)"> <circle cx="80" cy="80" r="24.15" fill="#eef0f5"/> <circle cx="80" cy="80" r="23.5" fill="#2f74c9"/> </g> <g id="pupil" transform="translate(80 80) scale(1) translate(-80 -80)"> <circle cx="80" cy="80" r="16.6" fill="none" stroke="#f5f8fd" stroke-width=".1"/> <circle cx="80" cy="80" r="16" fill="#2e2f78"/> </g> <!-- Same phase as blue iris, but painted last (above pupil), as in upstream. --> <g id="highlight" transform="translate(80 80) scale(1) translate(-80 -80)"> <circle id="highlight-halo" cx="98" cy="100.5" r="18" fill="url(#highlight-halo-gradient)"/> <circle id="catchlight-lower-right" cx="98" cy="100.5" r="11" fill="#f5f8fd"/> </g> </g> <g id="fz3-lid-cover" clip-path="url(#fz3-lid-cover-clip)"><path class="fz3-lid-shape" d="M20 60 Q80 90 140 60 V-40 H20 Z" fill="#1f2573"/></g> </g> </svg> `

    /* ------------------------------------------------------------------ *
     * ———————————— */
    const ZH = {
      'greet.kicker': 'H.D.D CORE // FAIRY ONLINE',
      'greet.1': '检测到主人。Fairy 已就位，置信度 100%。',
      'greet.2': 'H.D.D 全链路自检通过，语音模块在线。',
      'greet.3': '今天的烂摊子，请交给本系统——这是最优解。',
      'greet.sub': 'Ⅲ型总序式集成泛用人工智能 · VOICE LINK ACTIVE',
      'greet.tap': '点一下（或按任意键），听 Fairy 打招呼',
      'dock.tag': 'FAIRY Ⅲ',
      'dock.tagsub': 'H.D.D / B4',
      'dock.title': 'FAIRY Ⅲ // H.D.D CORE',
      'dock.sub': 'Ⅲ型总序式集成泛用人工智能',
      'dock.autoVoice': '自动语音',
      'dock.engine': '语音引擎',
      'dock.ready': '就绪',
      'dock.idle': '待机',
      'dock.busy': '合成中',
      'dock.speaking': '发声',
      'dock.replayGreet': '重播问候',
      'dock.stop': '停止发声',
      'dock.test': '试听一句',
      'dock.foot': 'GPT-SoVITS · Fairy_e10_s870',
      'dock.error': '语音链路异常',
    }
    const EN = {
      'greet.kicker': 'H.D.D CORE // FAIRY ONLINE',
      'greet.1': 'Master detected. Fairy is online. Confidence: 100%.',
      'greet.2': 'H.D.D self-check passed. Voice module linked.',
      'greet.3': 'Today’s mess goes to this system. It is the optimal solution.',
      'greet.sub': 'III-Type Omnibus Integrated AI · VOICE LINK ACTIVE',
      'greet.tap': 'Tap (or press any key) to hear Fairy say hello',
      'dock.tag': 'FAIRY Ⅲ',
      'dock.tagsub': 'H.D.D',
      'dock.title': 'FAIRY Ⅲ // H.D.D CORE',
      'dock.sub': 'III-Type Omnibus Integrated General-Purpose AI',
      'dock.autoVoice': 'Auto voice',
      'dock.engine': 'Voice engine',
      'dock.ready': 'ready',
      'dock.idle': 'idle',
      'dock.busy': 'synth',
      'dock.speaking': 'speaking',
      'dock.replayGreet': 'Replay greeting',
      'dock.stop': 'Stop',
      'dock.test': 'Test voice',
      'dock.foot': 'GPT-SoVITS · Fairy_e10_s870',
      'dock.error': 'voice link error',
    }
    let tr = null
    const t = (key) => {
      try {
        if (tr) {
          const value = tr(key)
          if (value && value !== key) return value
        }
      } catch {}
      return ZH[key] ?? key
    }

    /* ------------------------------------------------------------------ *
     * 声音状态 */
    /* 2026-11-23 03:20 一次性修复：文件末尾曾有一段调试残留，每次页面加载都把
       fairy.zzz.voice 写成 'false'，等于把主人的语音开关永久关掉（那段已删除）。
       它留下的 'false' 还在 localStorage 里，这里恢复成 'true' 一次；
       跑过这次之后只听主人在设置页里的开关。 */
    try {
      const VOICE_MIG = 'fairy.zzz.voice.migrated-20261123'
      if (!localStorage.getItem(VOICE_MIG)) {
        if (localStorage.getItem(VOICE_KEY) === 'false') localStorage.setItem(VOICE_KEY, 'true')
        localStorage.setItem(VOICE_MIG, '1')
      }
    } catch {}
    const voice = { enabled: readBool(VOICE_KEY, true), busy: false, speaking: false, error: '' }
    const listeners = new Set()
    const emit = () => {
      for (const fn of [...listeners]) {
        try {
          fn()
        } catch {}
      }
    }
    const patchVoice = (next) => {
      Object.assign(voice, next)
      emit()
    }
    const useVoice = () => {
      const [, bump] = useState(0)
      useEffect(() => {
        const fn = () => bump((n) => n + 1)
        listeners.add(fn)
        return () => {
          listeners.delete(fn)
        }
      }, [])
      return voice
    }

    let player = null
    let playSeq = 0
    let autoArmAt = Date.now() + 30_000

    /* 自动朗读的"上膛"时机：
       原来是页面加载后 30 秒内才允许自动念（为了绕开浏览器的自动播放拦截）。
       实际用起来就是"过了半分钟之后，她再也不念了"。
       改成：只要用户点过任何地方（有手势授权），立刻解锁，之后一直有效。 */
    try {
      window.addEventListener('pointerdown', () => { autoArmAt = 0 }, { once: true })
      window.addEventListener('keydown', () => { autoArmAt = 0 }, { once: true })
    } catch (e) {}

    /* 朗读没念完之前不弹用量气泡：等 voice 既不 busy 也不 speaking 再放行 */
    function whenVoiceIdle() {
      if (!voice.busy && !voice.speaking) return Promise.resolve()
      return new Promise((resolve) => {
        let settled = false
        let timer = null
        const check = () => {
          if (voice.busy || voice.speaking) return
          finish()
        }
        const finish = () => {
          if (settled) return
          settled = true
          if (timer !== null) clearTimeout(timer)
          listeners.delete(check)
          resolve()
        }
        timer = setTimeout(finish, 240_000)
        listeners.add(check)
      })
    }

    /* 一轮刚结束时 TTS 可能还没开始播：先给它 3 秒的启动窗口，
       真的读起来了就等读完，压根没读（关了声/没摘要）就立即放行 */
    function whenSpeechDone() {
      if (!voice.enabled) return Promise.resolve()
      const startedAt = Date.now()
      return new Promise((resolve) => {
        const poll = () => {
          if (voice.busy || voice.speaking) {
            whenVoiceIdle().then(resolve)
            return
          }
          if (Date.now() - startedAt >= 3000) {
            resolve()
            return
          }
          setTimeout(poll, 120)
        }
        poll()
      })
    }

    const pausePlayer = () => {
      if (player) {
        try {
          player.pause()
        } catch {}
        player = null
      }
    }

    const stopSpeech = () => {
      playSeq += 1
      pausePlayer()
      patchVoice({ busy: false, speaking: false })
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fz3:say', { detail: { end: true } })) } catch {}
    }

    function playClip(url, token) {
      return new Promise((done) => {
        if (token !== playSeq) {
          done()
          return
        }
        const audio = new Audio(url)
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          if (player === audio) player = null
          done()
        }
        player = audio
        audio.onended = finish
        audio.onerror = finish
        audio.onpause = () => {
          if (!audio.ended) finish()
        }
        audio
          .play()
          .then(() => {
            if (token === playSeq) patchVoice({ speaking: true, busy: false, error: '' })
        })
          .catch(() => {
            if (token === playSeq) patchVoice({ error: t('dock.error') })
            finish()
          })
        setTimeout(finish, 240_000)
      })
    }

    async function fetchVoice(text) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 240_000)
      try {
        const res = await fetch('/fairy-zzz/tts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.url) throw new Error(data.error || 'tts failed')
        return data.url
      } finally {
        clearTimeout(timer)
      }
    }

    /* 2026-11-23 主人：地址不念、英文不念。
       朗读前统一过一遍筛子：
         · URL / 盘符路径 / UNC / unix 路径 / 带扩展名的文件名 → 删掉；
         · 整句没有中文（纯英文、命令行）→ 整句删掉；
         · 句内的英文词 → 删掉，只留 Fairy / HDD 两个专有名词；
         · 数字与中文标点保留。
       结果是：英文思考、路径、代码片段都不会被念出来，只剩能听懂的中文。 */
    const SPEAK_WORDS = { "\uE000": "Fairy", "\uE001": "HDD" }
    function stripUnspeakable(text) {
  /* 2026-11-23 主人口径：语音不再过滤英文（英文照念），只跳过「地址」：
     网址 / www / 盘符路径 / UNC 路径 / 相对路径 / 带扩展名的文件名，
     外加整段代码块（念出来是噪音）。
     H.D.D 统一成 HDD，免得合成端把缩写拆成三段。 */
  let s = String(text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.[^\s]+/gi, ' ')
    .replace(/[A-Za-z]:\\[^\s，。；：、！？）)」』”"]+/g, ' ')
    .replace(/\\\\[^\s，。；：、！？）)」』”"]+/g, ' ')
    .replace(/(^|[\s（(「【])[./~][\w.@%-]+(?:\/[\w.@%-]+)+\/?/g, ' ')
    .replace(/\b[\w.-]+\.(?:js|ts|tsx|json|md|tgz|zip|png|jpg|jpeg|gif|mp4|webm|wav|mp3|ps1|cjs|mjs|css|html|yml|yaml|log|txt|exe|asar|map)\b/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/H\s*[.．·]\s*D\s*[.．·]\s*D\s*[.．]?/gi, 'HDD')
  return s
    .replace(/-{2,}/g, ' ')
    .replace(/\s+([，。；：、！？）)」』”"])/g, '$1')
    .replace(/([，。；：、])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

    function cleanSpeakable(raw) {
      return String(raw ?? '')
        /* 2026-11-23 修「念 H.D.D. 不连贯」：缩写里的点会让合成端拆成 H / D / D
           三段，段间多出约 0.4 秒静音；统一收成 HDD。 */
        /* 2026-11-23 修「念 H.D.D. 不连贯」：缩写里的点会让合成端拆成 H / D / D
           三段，段间多出约 0.4 秒静音；统一收成 HDD。
           2026-11-23 16:5x 补：紧跟单词时（H.D.D.System）要留一个空格，
           否则会拼成 HDDSystem 被当成一个词念。 */
        .replace(/H\s*[.．·]\s*D\s*[.．·]\s*D\s*[.．]?(?=[A-Za-z0-9])/gi, 'HDD ')
        .replace(/H\s*[.．·]\s*D\s*[.．·]\s*D\s*[.．]?/gi, 'HDD')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]*`/g, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/[*_~#>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    /* 朗读正文 = 清掉的 markdown 再去掉地址与英文，最后按 4000 字兜底截断 */
    function speakableText(raw) {
      return cleanSpeakable(stripUnspeakable(raw)).slice(0, 4000)
    }

    function chunkText(text, maxLength = 90, maxChunks = 8) {
      const pieces = text.split(/(?<=[。！？；\n])/).map((s) => s.trim()).filter(Boolean)
      const chunks = []
      let buffer = ''
      for (const piece of pieces) {
        if ((buffer + piece).length > maxLength && buffer) {
          chunks.push(buffer)
          buffer = piece
        } else {
          buffer += piece
        }
        if (chunks.length >= maxChunks) break
      }
      if (buffer && chunks.length < maxChunks) chunks.push(buffer)
      const out = chunks.filter((s) => s.length > 0)
      return out.length ? out : [text.slice(0, maxLength)]
    }

    /* 把回复压成 50 字左右的摘要：优先在句末断，其次在逗号/分号断，都不行才硬切 */
    function summarizeForBubble(text, max = 50) {
      const clean = speakableText(text)
      if (!clean) return ''
      if (clean.length <= max) return clean
      const win = clean.slice(0, max + 12)
      const sentence = Math.max(win.lastIndexOf('。'), win.lastIndexOf('！'), win.lastIndexOf('？'))
      if (sentence >= max * 0.55) return win.slice(0, sentence + 1)
      const clause = Math.max(win.lastIndexOf('，'), win.lastIndexOf('；'), win.lastIndexOf('、'))
      if (clause >= max * 0.55) return win.slice(0, clause + 1)
      return clean.slice(0, max)
    }

    /* 把长分析切成交给语音队列的段：优先按句末标点断，单段 ≤ 380 字，
       最多 24 段（约 9000 字）—— 再多就不是「念回复」而是「念小说」了。 */
    function splitForQueue(text, max = 380, maxParts = 24) {
      const pieces = []
      let buffer = ''
      const push = (s) => { if (s) pieces.push(s) }
      for (const sentence of String(text || '').split(/(?<=[。！？；!?;\n])/)) {
        const s = sentence.trim()
        if (!s) continue
        if (s.length > max) {
          push(buffer)
          buffer = ''
          for (let i = 0; i < s.length; i += max) push(s.slice(i, i + max))
        } else if (buffer && buffer.length + s.length > max) {
          push(buffer)
          buffer = s
        } else {
          buffer += s
        }
        if (pieces.length >= maxParts) break
      }
      push(buffer)
      return pieces.slice(0, maxParts)
    }

    /* 2026-11-23 16:26 主人要求「不用全部读，只读分析完成的，还有结尾的总结」：
       自动朗读只挑两类内容 ——
         ① 结论句：含有「结论 / 总结 / 总之 / 所以 / 因此」的句子，最多两句；
         ② 结尾总结：最后一段（句子超过三句时只留最后三句）。
       去重后拼起来，总长兜底 600 字；实在挑不出来才退回开头 200 字，绝不整篇念。 */
    function pickSpeakableSummary(text, max = 600) {
      const raw = String(text || '').replace(/\r/g, '')
      const clean = (s) => String(s || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]*`/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/[*_~`#>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const sentences = (s) => clean(s).split(/(?<=[。！？!?])/).map((x) => x.trim()).filter((x) => x.length > 1)
      const lines = raw.split('\n').map((s) => s.trim()).filter((s) => s && !/^[|>]/.test(s) && !/^#{1,6}\s/.test(s))
      const picked = []
      const seenKeys = new Set()
      const push = (s) => {
        const key = s.slice(0, 24)
        if (!s || s.length < 2 || seenKeys.has(key)) return
        seenKeys.add(key)
        picked.push(s)
      }
      /* ① 结论句 */
      const keyword = /(结论|总结|总之|所以|因此)/
      const conclusion = []
      for (const line of lines) {
        if (!keyword.test(line)) continue
        for (const s of sentences(line)) if (keyword.test(s)) conclusion.push(s)
        if (conclusion.length >= 2) break
      }
      conclusion.slice(0, 2).forEach(push)
      /* ② 结尾总结：最后一段 */
      const lastLine = lines.length ? lines[lines.length - 1] : ''
      const tail = sentences(lastLine)
      if (tail.length) push(tail.length > 3 ? tail.slice(-3).join('') : tail.join(''))
      let out = picked.join('').trim()
      if (out.length < 6) out = clean(raw).slice(0, 200)
      return out.slice(0, max)
    }

    /* 「回复弹完」之后念的总结：目标约 100 字（超过 130 字在句末收口，不足 40 字才硬切）。
       仍然只用原文里的句子拼，不调模型、不额外花钱。 */
    function pickSummary(text, target = 100) {
      const base = pickSpeakableSummary(text, 600)
      if (base.length <= target + 30) return base
      const parts = base.split(/(?<=[。！？!?；;])/)
      let out = ''
      for (const part of parts) {
        if (out && out.length + part.length > target + 30) break
        out += part
      }
      const trimmed = out.trim()
      return trimmed.length >= 40 ? trimmed : base.slice(0, target)
    }

    /* 2026-11-27 主人要求「每条回复只念一句话」：一轮只投一次语音队列，整段念一次。
       同一句为什么会被念两遍（2026-11-27 23:06 主人反馈）：
       宿主 GET /fairy-zzz/analysis 的 text 字段其实是「回复正文第一句」（index.js 的
       replyLeadText），不是分析正文；上一版把它当「分析结论」拼在正文开头前面，
       于是正文首句被念了两遍（宿主流里带着空格，和 DOM 里的文本逐字比较对不上，
       原来的去重拦不住）。宿主的分析缓冲区又是跨会话共享的，偶尔还会混进别的会话的句子。
       现在只用「这一轮正文」：开头约 50 字 + 结尾约 50 字，按句子下标分开、绝不重叠；
       同一句（去掉空白与标点后的指纹）只留第一次出现；整段上限 160 字。 */
    const TRIO_PART = 50
    const TRIO_CAP = 160
    const TRIO_STOP = /[。！？!?；;]$/
    /* 指纹：宿主流与 DOM 的空格/标点常有一两个字符的差异，逐字比较认不出是同一句 */
    const TRIO_STRIP = /[\s，。；：！？、,.!?;:'"“”‘’（）()【】\[\]…—\-]+/g
    const trioKey = (text) => String(text || '').replace(TRIO_STRIP, '')
    function trioSentences(text) {
      return String(text || '')
        .replace(/\r/g, '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]*`/g, ' ')
        .split(/(?<=[。！？!?；;\n])/)
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s.length > 1)
    }
    /* 正文只念一遍：先按句子去重，再从开头取约 50 字、结尾取约 50 字；
       两段的句子下标严格分开，正文短到只剩一两句时就只念那一两句。 */
    function trioAnswerParts(text) {
      const keys = new Set()
      const list = []
      for (const sentence of trioSentences(text)) {
        const key = trioKey(sentence)
        if (key.length < 2 || keys.has(key)) continue
        keys.add(key)
        list.push(sentence)
      }
      if (!list.length) return []
      const head = []
      let used = 0
      for (let i = 0; i < list.length; i += 1) {
        const size = list[i].length
        /* 第一句再长也要念：否则开头会整段消失 */
        if (head.length && used + size > TRIO_PART) break
        head.push(i)
        used += size
        if (used >= TRIO_PART) break
      }
      const tail = []
      used = 0
      const headEnd = head[head.length - 1]
      for (let i = list.length - 1; i > headEnd; i -= 1) {
        const size = list[i].length
        if (used + size > TRIO_PART) break
        tail.unshift(i)
        used += size
      }
      return head.concat(tail).map((index) => list[index])
    }
    function pickTrio(answerText) {
      let out = ''
      for (const part of trioAnswerParts(answerText)) {
        out += TRIO_STOP.test(part) ? part : part + '。'
      }
      /* 剥掉行内代码后可能留下「结论： 每次…」这种多余空格，念起来会多一个停顿 */
      out = out.replace(/([，。；：！？、])\s+(?=\S)/g, '$1')
      if (out.length <= TRIO_CAP) return out
      /* 正文是一整段、中间没有句子标点时，优先在标点处收口，别念到一半断掉 */
      const clipped = out.slice(0, TRIO_CAP)
      const cut = Math.max(
        clipped.lastIndexOf('。'),
        clipped.lastIndexOf('；'),
        clipped.lastIndexOf('！'),
        clipped.lastIndexOf('？'),
      )
      return cut >= 40 ? clipped.slice(0, cut + 1) : clipped + '。'
    }

    /* 「分析完成」时念的分析结果（2026-11-27 起不再单独念，保留给旧调用/单测）：
       整段放不下就取结尾（结论通常落在最后），从最近的句号/换行之后开始，免得从半句切进去。 */
    function pickAnalysis(text, max = ANALYSIS_MAX) {
  const clean = String(text || '').replace(/\r/g, '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  /* 2026-11-23 定稿：要念的是「已完成分析」下面那一行 —— 回复正文的第一句。
     不再取思考的最后一段，也不做段落合并。 */
  /* 2026-11-23 主人要求「代码块不读」：选句前剥掉围栏代码块与行内代码。 */
  const prose = clean.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/\s+/g, ' ').trim()
  const base = prose !== '' ? prose : clean
  const cut = base.search(/[。！？!?；;]/)
  const first = cut >= 0 ? base.slice(0, cut + 1) : base
  return first.slice(0, max)
}

    async function speakText(raw, options = {}) {
      const force = options.force === true
      const text = speakableText(raw)
      if (!text) return
      if (!force && !voice.enabled) return
      stopSpeech()
      const token = ++playSeq
      const chunks = chunkText(text, options.chunkLength || 90)
      const showBubble = options.bubble !== false
      const say = (detail) => {
        if (!showBubble || typeof window === 'undefined') return
        try { window.dispatchEvent(new CustomEvent('fz3:say', { detail })) } catch {}
      }
      patchVoice({ busy: true, speaking: false, error: '' })
      let next = fetchVoice(chunks[0])
      for (let index = 0; index < chunks.length; index += 1) {
        let url
        try {
          url = await next
        } catch (cause) {
          if (token === playSeq) patchVoice({ busy: false, error: String(cause?.message || cause) })
          if (token === playSeq) say({ end: true })
          return
        }
        if (token !== playSeq) return
        if (index + 1 < chunks.length) next = fetchVoice(chunks[index + 1])
        patchVoice({ busy: false, speaking: true })
        say({ text: chunks[index], index, total: chunks.length })
        await playClip(url, token)
        if (token !== playSeq) return
      }
      if (token === playSeq) patchVoice({ busy: false, speaking: false })
      if (token === playSeq) say({ end: true })
    }

    function readStored(key, fallback) {
      try {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : fallback
      } catch {
        return fallback
      }
    }
    function readBool(key, fallback) {
      const value = readStored(key, fallback)
      return typeof value === 'boolean' ? value : fallback
    }
    function writeStored(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {}
    }

    /* 记忆系统卡片图标（2026-11-27）：跟着两个插件的配色画，不引外部资源 */
    const MIND_ICON =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#6aa8ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="7" cy="7.5" r="2.4"/><circle cx="17" cy="7.5" r="2.4"/><circle cx="12" cy="17" r="2.4"/>' +
      '<path d="M9 8.6 11.1 14.8M15 8.6 12.9 14.8M9.4 7.5h5.2"/></svg>'
    const NEURAL_ICON =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#b98cff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="2.3"/><circle cx="12" cy="4.2" r="1.8"/><circle cx="19.2" cy="16" r="1.8"/>' +
      '<circle cx="4.8" cy="16" r="1.8"/><path d="M12 9.7V6M13.9 13.4 17.7 15M10.1 13.4 6.3 15"/></svg>'

    /* ———————————————————— */
    function stripChrome(node) {
      const drop = 'pre, code, button, svg, [data-turn-tail], [data-turn-process], [data-turn-usage-details], [data-message-attachments]'
      node.querySelectorAll(drop).forEach((item) => item.remove())
      return (node.innerText || node.textContent || '').trim()
    }

    function readMessageText(el) {
      if (!el || typeof el.closest !== 'function') return ''
      /* 只念「这一轮的最终回复」：DSH 把每条消息渲染成同一个 flow 里的独立条目，
         正文不在 actions 所在的那个条目里，所以要按 data-chat-turn 找到同一轮的答案条目。 */
      const own = el.closest('[data-chat-turn]')
      const turnId = own ? own.getAttribute('data-chat-turn') : null
      const scope =
        el.closest('[data-slot="conversation.chat.flow"]') ||
        el.closest('[data-conversation-scroll]') ||
        document.body
      let answer = null
      let step = null
      let other = null
      const items = scope.querySelectorAll('[data-chat-turn]')
      for (const item of items) {
        if (turnId !== null && item.getAttribute('data-chat-turn') !== turnId) continue
        const kind = item.getAttribute('data-chat-flow-kind')
        if (item.hasAttribute('data-turn-process-answer')) answer = item
        if (kind === 'assistant-step') step = item
        else if (kind !== 'user' && kind !== 'turn-tail' && kind !== 'turn-process' && kind !== 'boundary' && !item.querySelector('[data-turn-tail]')) other = item
      }
      const target = answer || step || other
      if (target) {
        const text = stripChrome(target.cloneNode(true))
        if (text.length > 2) return text
      }
      const tail = el.closest('[data-turn-tail]')
      const local = tail && tail.parentElement ? tail.parentElement : null
      return local ? stripChrome(local.cloneNode(true)) : ''
    }

    const seen = new Set(readStored(SEEN_KEY, []))
    const saveSeen = () => {
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-400)))
      } catch {}
    }
    /* 2026-11-23 03:30 主人报「同一句话被念了两遍（有重音/回声）」：
       当时有两条独立语音通路，谁也不知道对方在播 ——
         ① 皮肤这里「消息挂载即自动朗读」（浏览器 new Audio 播 /fairy-zzz/tts 合成结果）
         ② tools\fairy-say.ps1 → voice-queue 的 SoundPlayer（后台进程念完整结论）
       回复一落地，① 先念 50 字摘要、② 同时念结论，两路叠在一起就是回声。
       于是当时把 ① 关掉了（AUTO_READ = false），但 ② 那个脚本其实从没进过包 ——
       结果就是「Fairy 一句话都不念」。

       2026-11-23 15:05 主人要求「把 1.0.6 念的内容接到 1.0.9 的队列里」：
       ①不再自己出声，改成把摘要 POST 给 /fairy-zzz/say（走 ② 的同一个队列），
       于是只有一个嗓子、天然串行，回声问题从源头消失。
       AUTO_READ_FULL = false → 念 50 字摘要（1.0.6 的口径）；true → 念整条回复。 */
    const AUTO_READ = true
    /* 2026-11-23 16:15 主人要求「完成分析的时候立刻播放分析内容」：
       朗读时机从「消息挂载」挪到「这一轮真正写完」（运行行消失 + 正文不再变化，见 autoRead）。
       2026-11-23 16:26 主人补一句「不用全部读，只读分析完成的，还有结尾的总结」：
       不再整篇念，改成 pickSpeakableSummary() 挑「结论句 + 结尾总结段」，
       所以 AUTO_READ_FULL 回到 false；true 才是整条回复。 */
    const AUTO_READ_FULL = false
    /* 2026-11-27 主人新口径：「语音太多了，每条回复只播放 1 句话」——
       原来分两次出声（① 分析一结束先念分析，② 回复弹完再念总结），现在合并成一次：
       回复写完时只从**这一轮正文**里取「开头约 50 字 + 结论/结尾约 50 字」（pickTrio），
       合成一段投一次队列。
       不再读宿主 /fairy-zzz/analysis：那个接口的 text 其实是「正文第一句」，拼在开头会
       让首句念两遍；它的缓冲区还跨会话共享，偶尔会混进别的会话的句子。 */
    const ANALYSIS_MAX = 400
    /* 队列播报时用「状态文件轮询」驱动眼徽旁那条朗读气泡。
       队列跑在宿主/子进程里，浏览器只能靠 GET /fairy-zzz/say 的 state 知道念到哪一句；
       2026-11-23 主人反馈「自动朗读接进队列后气泡不弹了」，就是这里缺的回传。 */
    let sayPollTimer = null
    let sayLastKey = ''
    const sayBubble = (detail) => {
      try {
        window.dispatchEvent(new CustomEvent('fz3:say', { detail }))
      } catch {}
    }
    const stopSayPoll = () => {
      if (sayPollTimer) {
        clearInterval(sayPollTimer)
        sayPollTimer = null
      }
    }
    const startSayPoll = () => {
      if (sayPollTimer) return
      const startedAt = Date.now()
      let idle = 0
      const tick = async () => {
        if (!sayPollTimer) return
        if (Date.now() - startedAt > 180000) {
          stopSayPoll()
          sayBubble({ end: true })
          return
        }
        try {
          const res = await fetch('/fairy-zzz/say', { cache: 'no-store' })
          const data = res.ok ? await res.json() : null
          const st = data && data.state
          if (st && st.phase === 'speaking' && st.text) {
            const key = String(st.id || '') + ':' + String(st.index || 0)
            if (key !== sayLastKey) {
              sayLastKey = key
              sayBubble({ text: st.display || st.text, index: st.index || 0, total: st.total || 1 })
            }
            idle = 0
            return
          }
          /* 2026-11-23 修「气泡还是不弹」：合成那几秒 phase 还是空、queued 却是 1，
             旧逻辑等两次就放弃了，永远看不到 speaking。只要还有人在排队就不收手。 */
          if (data && Number(data.queued) > 0) {
            idle = 0
            return
          }
          idle += 1
          if (idle >= 4) {
            stopSayPoll()
            sayLastKey = ''
            sayBubble({ end: true })
          }
        } catch {
          idle += 1
          if (idle >= 6) stopSayPoll()
        }
      }
      sayPollTimer = setInterval(tick, 700)
      tick()
    }

    /* 2026-11-27 修「同一句话念两遍」：自动朗读按「去掉空白与标点」的指纹再兜一道，
       90 秒内同一段只投一次队列（手动点朗读按钮走 speakText，不经过这里）。 */
    const AUTO_SAID_GAP = 90_000
    const autoSaid = new Map()
    function firstSight(text) {
      const key = trioKey(text)
      if (!key) return false
      const now = Date.now()
      for (const [oldKey, at] of autoSaid) {
        if (now - at > AUTO_SAID_GAP) autoSaid.delete(oldKey)
      }
      if (autoSaid.has(key)) return false
      autoSaid.set(key, now)
      return true
    }

    async function queueSay(text, options = {}) {
      const clean = speakableText(text)
      /* 2026-11-23 主人要求「不读地址但显示地址」：display 只去 markdown，保留地址，
         随 POST 交给宿主；气泡显示它，朗读仍用剔掉地址的 clean。 */
      const display = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800)
      if (!clean) return false
      try {
        const res = await fetch('/fairy-zzz/say', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: clean, display, chunk: options.chunk || 80 }),
        })
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}))
          patchVoice({ error: String(detail?.error || 'say ' + res.status) })
          /* 队列不可用（路由没加载 / 子进程起不来）→ 退回浏览器直播，宁可双通路风险也不要全程静音。
             队列正常时这条永远不执行，所以不会重新制造 03:30 那种回声。 */
          if (options.fallback !== false) {
            speakText(clean, { force: true, chunkLength: options.chunk || 80 })
          }
          return false
        }
        startSayPoll()
        return true
      } catch (cause) {
        patchVoice({ error: String(cause?.message || cause) })
        if (options.fallback !== false) {
          speakText(clean, { force: true, chunkLength: options.chunk || 80 })
        }
        return false
      }
    }
    /* 2026-11-23 16:15 主人要求「完成分析的时候立刻播放分析内容」
       —— 旧版在消息组件挂载那一刻就念：正文那时往往只有半句，而且只念 50 字摘要。
       现在每轮只挂一个观察器：
         · 正文每 400ms 重新读一次；
         · 「运行行 [data-chat-running] 消失」且「正文 900ms 没再变化」= 这一轮写完；
         · 写完立刻把完整正文交给语音队列（AUTO_READ_FULL）；
         · 10 分钟还没等到（宿主卡住 / DOM 结构变了）就按最后一次正文念，不静音。 */
    const pendingReads = new Map()
    function autoRead(el, messageId) {
      if (!el || !messageId) return
      if (seen.has(messageId) || pendingReads.has(messageId)) return
      if (!voice.enabled || !AUTO_READ) return
      if (Date.now() < autoArmAt) return
      const startedAt = Date.now()
      let lastText = readMessageText(el)
      let stableSince = Date.now()
      const schedule = (fn, ms) => {
        const timer = window.setTimeout(fn, ms)
        pendingReads.set(messageId, timer)
      }
      const finish = (text) => {
        pendingReads.delete(messageId)
        seen.add(messageId)
        saveSeen()
        if (!text || text.length <= 2) return
        if (AUTO_READ_FULL) {
          /* 长分析按句切段后逐条入队：队列是 FIFO 串行的，顺序不会乱；
             也不依赖宿主 /fairy-zzz/say 的 500 字上限（那段要重启宿主才生效）。 */
          for (const piece of splitForQueue(text)) queueSay(piece, { chunk: 22 })
          return
        }
        /* 2026-11-27 主人要求「每条回复只念一句话」：正文头尾拼成约 100~160 字的一段，
           一轮只投一次队列（原来「分析单独念一次 + 结尾再念一次」就是两遍）。
           pickTrio 内部已按句子去重，这里再用 firstSight 兜一道：重挂载 / 重复 finish
           不会再补一嘴。 */
        const spoken = pickTrio(text) || pickSummary(text)
        /* 2026-11-23 16:40 主人反馈「结尾的结论读得很慢」：22 字一段等于每两句就来一次
           合成间隙，听起来一顿一顿。结论本来就短，直接 80 字一段，少断点。 */
        if (spoken.length > 2 && firstSight(spoken)) queueSay(spoken, { chunk: 80 })
      }
      const tick = () => {
        if (!el.isConnected || seen.has(messageId)) {
          pendingReads.delete(messageId)
          return
        }
        const text = readMessageText(el)
        if (text !== lastText) {
          lastText = text
          stableSince = Date.now()
        }
        const running = !!document.querySelector('[data-chat-running]')
        const quiet = Date.now() - stableSince >= 900
        const timedOut = Date.now() - startedAt >= 600000
        if ((!running && quiet && text.length > 2) || (timedOut && text.length > 2)) {
          finish(text)
          return
        }
        schedule(tick, 400)
      }
      schedule(tick, 400)
    }

    /* ------------------------------------------------------------------ *
     * ———————————— */
    const baseTokens = {
      '--dsw-alias-bg-base': 'rgba(8,10,18,0.88)',
      '--dsw-alias-bg-layer-1': 'rgba(11,14,24,0.92)',
      '--dsw-alias-bg-layer-2': 'rgba(15,19,32,0.95)',
      '--dsw-alias-bg-overlay': 'rgba(4,5,12,0.98)',
      '--dsw-alias-border-l1': 'rgba(120,110,255,0.22)',
      '--dsw-alias-border-l2': 'rgba(58,68,140,0.32)',
      '--dsw-alias-brand-primary': '#3f6bff',
      '--dsw-alias-label-primary': '#eef0fa',
      '--dsw-alias-label-secondary': '#8b93b8',
      '--dsw-alias-state-error-primary': '#ff5d7a',
      '--dsw-alias-state-idle-primary': '#7078ac',
      '--dsw-alias-state-success-primary': '#3ef0b0',
      '--dsw-alias-state-warn-primary': '#ffc93c',
      '--dsw-specific-sidebar-fill': 'rgba(9,11,20,0.9)',
      '--dsw-specific-bubble': 'rgba(22,26,42,0.92)',
      '--dsw-alias-markdown-code-block': 'rgba(8,9,20,0.94)',
    }
    /* 浅色面：背景压在 #eef3fc 上，正文与次要文字各降一档对比，状态色保持可辨识 */
    const lightTokens = {
      '--dsw-alias-bg-base': 'rgba(247,250,255,0.92)',
      '--dsw-alias-bg-layer-1': 'rgba(255,255,255,0.94)',
      '--dsw-alias-bg-layer-2': 'rgba(255,255,255,0.97)',
      '--dsw-alias-bg-overlay': 'rgba(255,255,255,0.99)',
      '--dsw-alias-border-l1': 'rgba(60,90,220,0.18)',
      '--dsw-alias-border-l2': 'rgba(120,140,200,0.32)',
      '--dsw-alias-brand-primary': '#2f55e8',
      '--dsw-alias-label-primary': '#141a2e',
      '--dsw-alias-label-secondary': '#59648a',
      '--dsw-alias-state-error-primary': '#d42a4c',
      '--dsw-alias-state-idle-primary': '#818ab0',
      '--dsw-alias-state-success-primary': '#0d9f6e',
      '--dsw-alias-state-warn-primary': '#b1700a',
      '--dsw-specific-sidebar-fill': 'rgba(243,247,255,0.94)',
      '--dsw-specific-bubble': 'rgba(255,255,255,0.96)',
      '--dsw-alias-markdown-code-block': 'rgba(238,243,255,0.96)',
    }
    const TOKENS = {}
    for (const key of Object.keys(baseTokens)) {
      TOKENS[key] = { dark: baseTokens[key], light: lightTokens[key] || baseTokens[key] }
    }

    /* ------------------------------------------------------------------ *
     * 用量气泡的数据源
     * ------------------------------------------------------------------ */
    const runtime = { ctx: null }

    async function fetchUsage() {
      try {
        const res = await fetch('/fairy-zzz/usage', { cache: 'no-store' })
        if (!res.ok) return null
        return await res.json()
      } catch {
        return null
      }
    }

    async function fetchBalance() {
      const ctx = runtime.ctx
      if (!ctx) return { ok: false, reason: '没有插件上下文' }
      let account
      let active
      try {
        /* 账户服务在 ctx.remote 上；没注入 remote.account 时 account 可能还没挂上 */
        account = (ctx.remote && ctx.remote.account) || (ctx['remote.account'] && ctx['remote.account'].account) || null
        active = ctx.locale && ctx.locale.getSnapshot ? ctx.locale.getSnapshot().active : undefined
      } catch (cause) {
        return { ok: false, reason: '账户服务不可用：' + (cause && cause.message ? cause.message : cause) }
      }
      if (!account || typeof account.getBalance !== 'function') return { ok: false, reason: '账户服务未就绪' }
      const version = (typeof globalThis.__DSH_CLIENT_VERSION__ === 'string' && globalThis.__DSH_CLIENT_VERSION__) || '0.2.1-rc.2'
      try {
        const res = await account.getBalance({
          version,
          locale: active || navigator.language || 'zh-CN',
          timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
        })
        if (!res) return { ok: false, reason: '余额接口没有返回' }
        if (!res.ok) return { ok: false, reason: '余额读取被拒绝：' + String(res.error?.code || res.error?.message || '未登录') }
        /* value 可能是钱包数组，也可能被包成 { wallets } / { value } / { bonusWallets } */
        const raw = res.value
        const pick = (list) => (Array.isArray(list) ? list.filter((item) => item && Number.isFinite(Number(item.balance))) : [])
        let wallets = pick(raw)
        if (!wallets.length && raw && !Array.isArray(raw)) {
          wallets = pick(raw.wallets)
          if (!wallets.length) wallets = pick(raw.value)
          if (!wallets.length) wallets = pick(raw.bonusWallets)
        }
        if (!wallets.length) {
          const shape = raw === null ? 'null' : Array.isArray(raw) ? 'array(' + raw.length + ')' : raw && typeof raw === 'object' ? 'object(' + Object.keys(raw).join(',') + ')' : typeof raw
          return { ok: false, reason: '账户里没有钱包（' + shape + '）' }
        }
        const cny = wallets.filter((item) => (item.currency || 'CNY') === 'CNY')
        const use = cny.length ? cny : wallets
        const amount = use.reduce((sum, item) => sum + Number(item.balance), 0)
        return { ok: true, amount, currency: use[0].currency || 'CNY' }
      } catch (cause) {
        return { ok: false, reason: '余额请求失败：' + (cause && cause.message ? cause.message : cause) }
      }
    }

    function yuan(value) {
      if (!Number.isFinite(value)) return '—'
      if (value === 0) return '¥0'
      if (value < 0.01) return '¥' + value.toFixed(4)
      if (value < 10) return '¥' + value.toFixed(3).replace(/0+$/, '')
      return '¥' + value.toFixed(2)
    }

    function tokensText(tokens) {
      const n = Number(tokens) || 0
      if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
      if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
      return String(n)
    }

    /* 峰谷剩余时长：3 小时 12 分 / 47 分 / 不到 1 分 */
    function leftText(ms) {
      const total = Math.max(0, Math.round(Math.max(0, ms) / 60_000))
      const hours = Math.floor(total / 60)
      const minutes = total % 60
      if (hours && minutes) return hours + ' 小时 ' + minutes + ' 分'
      if (hours) return hours + ' 小时'
      if (minutes) return minutes + ' 分'
      return '不到 1 分'
    }

    /* 倒计时表盘（合并自 dsh-fairy-eye-tweak）：04H 09M；整点只显示 04H */
    function clockText(ms) {
      const total = Math.max(0, Math.floor(Math.max(0, ms) / 1_000))
      const hours = String(Math.floor(total / 3600)).padStart(2, '0')
      const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
      return minutes === '00' ? hours + 'H' : hours + 'H ' + minutes + 'M'
    }

    /* ------------------------------------------------------------------ *
     * 样式
     * ------------------------------------------------------------------ */
    /* ————— 并入 dsh-fairy-eye-tweak（2026-11-23 合并） —————
       下面这些规则原先是独立插件 dsh-fairy-eye-tweak 用一张 <style> 叠在皮肤外面的：
       眼徽 64px、用量气泡半透明黑 + 强毛玻璃 + 粗字、隐藏明细行与峰谷徽标、
       倒计时去掉下划线、侧栏会话标题 #999、已归档会话加删除线。
       那个插件在加载顺序上排在皮肤**前面**，所以它一直被皮肤自己的规则压住；
       合并时保持同样的先后（这段拼在 CSS 最前面，皮肤规则跟在后面），
       级联结果与「皮肤 + 插件」两件套时逐条一致，不用再靠 !important 抢图层。
       倒计时文本格式（04H 09M）已直接写进 clockText()，不再用 MutationObserver 改写节点。 */
    const EYE_TWEAK_CSS = `
:root{--fz3-dock-size:64px!important}
.fz3-bubble{background:rgba(7,9,16,.66)!important;-webkit-backdrop-filter:blur(60px) saturate(185%)!important;backdrop-filter:blur(60px) saturate(185%)!important;border:1px solid rgba(255,255,255,.14)!important;box-shadow:0 18px 44px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.06)!important}
.fz3-bubble::after{background:rgba(7,9,16,.66)!important;border-color:rgba(255,255,255,.14)!important;-webkit-backdrop-filter:blur(60px)!important;backdrop-filter:blur(60px)!important}
.fz3-bubble[data-side="left"]::after{background:rgba(7,9,16,.66)!important;border-color:rgba(255,255,255,.14)!important}
.fz3-bubble,.fz3-bubble *{font-family:var(--fz3-font)!important;font-weight:700!important}
.fz3-bubble-sub{display:none!important}
.fz3-peak-badge{display:none!important}
.fz3-peak-clock{color:#ffffff!important;border-bottom:0!important}
[class*="_sessionRow"] [class*="_title"]{color:#999999!important}
[class*="_sessionRow"][class*="_archived"] [class*="_title"]{text-decoration-line:line-through!important;text-decoration-color:#000000!important;text-decoration-thickness:1px!important}
`
    const CSS = EYE_TWEAK_CSS + `
:root{
  --fz3-cyan:#8fb4ff;
  --fz3-blue:#3d5bf0;
  --fz3-violet:#6a5cff;
  --fz3-magenta:#ff3d8b;
  --fz3-amber:#ffc93c;
  --fz3-ink:#070818;
  --fz3-text:#e8f3ff;
  --fz3-mute:#9aa4d6;
  --fz3-line:rgba(110,130,255,.2);
  --fz3-font:"SDK_SC_Web","SDK_TW_Web","SDK_JP_Web","Microsoft YaHei UI",system-ui,sans-serif;
  /* 默认停靠会话区左缘中部（旧位置，主人要求保留）；量不到会话区才退回 25vw / 52vh */
  --fz3-dock-x:25vw;
  --fz3-dock-y:52vh;
  --fz3-dock-size:64px;
  /* 自适应：问候页的眼睛直径 / 眼睛中心高度 / 眼睛到文案的间距，全部随视口缩放 */
  --fz3-eye:clamp(132px,min(32vmin,34vh),330px);
  --fz3-eye-cy:42vh;
  --fz3-eye-gap:clamp(14px,3.4vh,54px);
  color-scheme:dark;
}
html:not([data-fz3-theme="light"]),
html:not([data-fz3-theme="light"]) body{background:#080a12!important;color-scheme:dark;}
/* 浅色主题：DSH 外观切到 light 时，插件把 data-fz3-theme 写到 <html> 上 */
:root[data-fz3-theme="light"]{
  --fz3-ink:#eef3ff;
  --fz3-text:#151b2f;
  --fz3-mute:#5c6684;
  --fz3-line:rgba(60,90,200,.18);
  --fz3-cyan:#2f62e0;
  color-scheme:light;
}
html[data-fz3-theme="light"],html[data-fz3-theme="light"] body{background:#eef3fc!important;color-scheme:light;color:var(--fz3-text);}
html[data-fz3-theme="light"] body::before{
  background:
    radial-gradient(42% 34% at 88% -6%,rgba(120,150,255,.34),transparent 68%),
    radial-gradient(34% 30% at 2% 4%,rgba(90,130,255,.24),transparent 70%),
    radial-gradient(48% 40% at 50% 118%,rgba(150,120,255,.20),transparent 66%),
    repeating-linear-gradient(-24deg,rgba(70,100,200,.05) 0 1px,transparent 1px 132px),
    linear-gradient(160deg,#f8fbff 0%,#eaf0ff 52%,#f3f6ff 100%);
}
html[data-fz3-theme="light"] body::after{
  background:linear-gradient(160deg,#f7faff,#eaf0fb 58%,#f2f6fd);
}
html[data-fz3-theme="light"] .fz3-bubble{
  background:linear-gradient(160deg,rgba(255,255,255,.98),rgba(238,244,255,.98));
  border-color:rgba(70,110,230,.24);
  box-shadow:0 18px 42px rgba(50,80,160,.16),0 0 0 1px rgba(120,160,255,.16) inset;
  color:var(--fz3-text);
}
html[data-fz3-theme="light"] .fz3-bubble::after{background:rgba(255,255,255,.98);border-color:rgba(70,110,230,.24);}
html[data-fz3-theme="light"] .fz3-bubble-head{color:#2f5fe0}
html[data-fz3-theme="light"] .fz3-bubble[data-mode="turn"] .fz3-bubble-head{color:#a76a06}
html[data-fz3-theme="light"] .fz3-bubble-v{color:#111a33}
html[data-fz3-theme="light"] .fz3-bubble-sub{color:rgba(72,86,130,.9)}
html[data-fz3-theme="light"] .fz3-peak-clock{color:#128a4a;border-bottom-color:rgba(18,138,74,.45)}
html[data-fz3-theme="light"] .fz3-peak-clock[data-tone="peak"]{color:#b56a00;border-bottom-color:rgba(181,106,0,.45)}
html[data-fz3-theme="light"] .fz3-peak-badge{box-shadow:none}
html[data-fz3-theme="light"] ::selection{background:rgba(61,91,240,.22);color:#0d1424}
html[data-fz3-theme="light"] .fz3-brandname b{color:#0f1730!important;text-shadow:0 0 12px rgba(96,132,255,.35)!important}
html[data-fz3-theme="light"] .fz3-brandname i{color:rgba(68,96,166,.88)!important}
html[data-fz3-theme="light"] .fz3-brandmark-eye{filter:drop-shadow(0 0 7px rgba(70,110,230,.42))}
/* 侧栏真正的字标是 .fz3-sb-text（.fz3-brandname 只在旧版标记里用） */
html[data-fz3-theme="light"] .fz3-sb-text b{color:#101a35!important;text-shadow:0 0 10px rgba(96,132,255,.28)!important}
html[data-fz3-theme="light"] .fz3-sb-text i{color:rgba(70,98,166,.9)!important}
body{font-family:var(--fz3-font)!important;}
/* 全局字体统一（2026-11-22）：所有控件强制汉仪文黑（--fz3-font），
   覆盖侧边栏、按钮、菜单、输入框等自带字体栈的控件；
   侧栏品牌字标（.fz3-sb-text / .fz3-brandname）保留 HDD Brand 字体。 */
body,
body *{font-family:var(--fz3-font)!important}
:root,body{
  --dsw-font-family:var(--fz3-font)!important;
  --dsw-font-family-brand:var(--fz3-font)!important;
  --ds-font-family-code:var(--fz3-font)!important;
  --dsh-font-family-text:var(--fz3-font)!important;
  --dsh-font-family-code:var(--fz3-font)!important;
}
.fz3-brandname b,.fz3-brandname i,.fz3-sb-text,.fz3-sb-text b,.fz3-sb-text i{font-family:"HDD Brand",var(--fz3-font)!important}
/* 统一加粗：字体只有 Regular 字面，用合成粗体把界面文字提到 700 */
body,
body :not(svg):not(svg *){font-weight:700!important;}
body::before{
  content:"";position:fixed;inset:-12%;z-index:-3;pointer-events:none;
  background:url('/fairy-zzz/assets/greet-bg.webp') center/cover no-repeat;
  filter:brightness(2.9) contrast(1.1) saturate(1.05);
}
/* 毛玻璃层已去掉：改为不透明底色，不再糊背景 */
body::after{
  content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;
  background:
    linear-gradient(160deg,#0a0c17,#05060d 58%,#080a12),
    radial-gradient(120% 90% at 50% 0%,rgba(96,126,255,.10),rgba(96,126,255,0) 62%);
  -webkit-backdrop-filter:none;
  backdrop-filter:none;
}
html[data-fz3-theme="light"] body::after{
  background:
    radial-gradient(120% 90% at 50% 0%,rgba(96,126,255,.10),rgba(96,126,255,0) 62%),
    linear-gradient(160deg,#f8fbff,#eaf0ff 58%,#f2f6fd)!important;
}
@keyframes fz3-drift{
  from{transform:translate3d(-1.4%,-1%,0) scale(1.03)}
  to{transform:translate3d(1.6%,1.2%,0) scale(1.08)}
}
::selection{background:rgba(87,232,255,.30);color:#fff}
*::-webkit-scrollbar{width:9px;height:9px}
*::-webkit-scrollbar-track{background:transparent}
*::-webkit-scrollbar-thumb{
  background:linear-gradient(180deg,rgba(87,232,255,.42),rgba(123,92,255,.52));
  border-radius:9px;border:2px solid transparent;background-clip:padding-box;
}
*::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,rgba(87,232,255,.8),rgba(123,92,255,.9));background-clip:padding-box}
textarea,input{caret-color:var(--fz3-cyan);}
textarea:focus,input:focus{
  box-shadow:0 0 0 1px rgba(87,232,255,.5),0 0 28px -10px rgba(87,232,255,.85)!important;
}
a{color:var(--fz3-cyan);text-underline-offset:3px}
pre,code,kbd,samp{font-family:var(--fz3-font)!important}
button{transition:filter .16s ease,box-shadow .2s ease,background-color .2s ease,color .2s ease,border-color .2s ease}
button:not([disabled]):active{transform:translateY(1px)}
:focus-visible{outline:2px solid rgba(87,232,255,.7);outline-offset:2px}

/* ---------- 品牌 ---------- */
.fz3-brandmark{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px}
.fz3-brandmark-eye{width:100%;height:100%;display:block;filter:drop-shadow(0 0 6px rgba(80,140,255,.5))}
.fz3-brandmark-eye svg{width:100%;height:100%;display:block}
.fz3-brandname{display:flex;flex-direction:column;gap:2px;line-height:1.05;font-family:var(--fz3-font);min-width:0}
.fz3-brandname b{font-family:"HDD Brand",var(--fz3-font);font-weight:700;font-size:23px;letter-spacing:.02em;color:#f2f5ff;font-style:normal;line-height:1;white-space:nowrap}
.fz3-brandname i{font-style:normal;font-size:8px;letter-spacing:.2em;color:rgba(122,188,240,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 品牌行改成横排，右侧挂深浅色切换按钮（本地新增） */
.fz3-brandname-row{flex-direction:row;align-items:center;gap:14px}
.fz3-brandname-row .fz3-theme-toggle{margin-left:0;flex:none}

/* ---------- 图层 ---------- */
/* 这一层网格原本 z-index:0 —— 正好压在内容上面，
   白底会被它染成灰、并夹在输入框与正文之间。
   改成 z-index:-1：退到内容后面，网格只在透明处可见（现在没有透明处），
   等于既保留规则又不影响观感。 */
body::after{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:0;   /* 旧网格层停用：网格改由输入区上方的网格带负责 */
  background-image:linear-gradient(rgba(120,150,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(120,150,255,.05) 1px,transparent 1px);
  background-size:48px 48px,48px 48px;mask-image:radial-gradient(120% 120% at 50% 30%,#000 40%,transparent 100%)}
.fz3-layer{position:fixed;inset:0;z-index:9000;pointer-events:none;font-family:var(--fz3-font);color:var(--fz3-text);-webkit-font-smoothing:antialiased}
.fz3-screen{position:absolute;inset:0;pointer-events:none;transition:opacity 1.25s ease,filter 1.25s ease;overflow:hidden;background:#000}
/* 只有在问好阶段这一层才接收点击；其余时候整层放行，
   否则宿主的弹窗、插件面板、命令面板会被这层透明遮罩吞掉点击 */
.fz3-layer[data-phase="greet"] .fz3-screen{pointer-events:auto}
.fz3-tap{pointer-events:auto;cursor:pointer;animation:fz3-blink 1.9s ease-in-out infinite}
.fz3-layer[data-phase="dock"] .fz3-screen{opacity:0;filter:blur(7px)}
.fz3-bg{position:absolute;inset:0;background:#000}
/* 背景图之上、文字之下的一整层黑色毛玻璃：背景先被糊开，再压一层暗色 */
.fz3-hero{
  position:absolute;inset:0;background:url('/fairy-zzz/assets/greet-bg.webp') center/cover no-repeat;
  opacity:0;transform:scale(1.04);
  filter:brightness(1.95) contrast(1.05) saturate(1.02) blur(14px);
  transition:opacity 1.9s ease,transform 14s ease-out;
}
/* 压在这层毛玻璃上的暗黑罩：中间最淡、越靠边越黑，最后收成纯黑 */
.fz3-hero::after{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(122% 106% at 50% 46%,rgba(0,0,0,.26) 0%,rgba(0,0,0,.55) 58%,rgba(0,0,0,.87) 86%,#000 100%);
  -webkit-backdrop-filter:blur(12px) saturate(1.08);
  backdrop-filter:blur(12px) saturate(1.08);
}
.fz3-layer[data-phase="greet"] .fz3-hero{opacity:.96;transform:scale(1.01)}
.fz3-layer[data-phase="dock"] .fz3-hero{opacity:0;transition:opacity 1.4s ease}
.fz3-veil{position:absolute;inset:0;pointer-events:none;background:
  radial-gradient(58% 52% at 50% 42%,transparent 12%,rgba(2,5,13,.45) 72%,rgba(2,5,13,.92) 100%),
  linear-gradient(180deg,rgba(2,5,13,.62),transparent 32%,rgba(2,5,13,.78));}

/* ---------- 全息核心 ---------- */
.fz3-core{
  position:fixed;left:50%;top:var(--fz3-eye-cy);width:var(--fz3-eye);aspect-ratio:1/1;
  transform:translate(-50%,-50%);opacity:0;pointer-events:none;z-index:2;
  transition:left 1.35s cubic-bezier(.62,0,.22,1),top 1.35s cubic-bezier(.62,0,.22,1),width 1.35s cubic-bezier(.62,0,.22,1),opacity .55s ease;
}
.fz3-layer[data-phase="greet"] .fz3-core{opacity:1}
.fz3-layer[data-phase="dock"] .fz3-core{
  left:var(--fz3-dock-x);top:var(--fz3-dock-y);width:var(--fz3-dock-size);opacity:1;pointer-events:auto;cursor:pointer;
}
/* 拖拽模式：光标与触摸手势 */
.fz3-layer[data-drag="1"][data-phase="dock"] .fz3-core{cursor:grab;touch-action:none}

/* ————— 用量气泡：单击眼徽展开，再点收起 ————— */
.fz3-bubble{
  position:fixed;
  z-index:9002;
  pointer-events:auto;
  width:236px;
  box-sizing:border-box;
  padding:12px 14px 11px;
  border-radius:14px;
  background:linear-gradient(160deg,rgba(12,26,70,.97),rgba(5,12,34,.97));
  border:1px solid rgba(120,170,255,.3);
  box-shadow:0 18px 44px rgba(2,6,20,.6),0 0 0 1px rgba(87,232,255,.05) inset,0 0 22px rgba(61,91,240,.22);
  color:var(--fz3-text);
  font-family:var(--fz3-font);
  font-size:12px;
  line-height:1.55;
  transform:translateY(-50%);
  animation:fz3-bubble-in .18s ease-out;
}
.fz3-bubble::after{
  content:"";
  position:absolute;
  left:-5px;
  top:50%;
  width:10px;
  height:10px;
  margin-top:-5px;
  transform:rotate(45deg);
  background:rgba(12,26,70,.97);
  border-left:1px solid rgba(120,170,255,.3);
  border-bottom:1px solid rgba(120,170,255,.3);
}
.fz3-bubble-head{
  font-size:10px;
  letter-spacing:.18em;
  text-transform:uppercase;
  color:#8fb4ff;
  margin-bottom:7px;
}
.fz3-bubble[data-mode="turn"] .fz3-bubble-head{color:#ffd98a}
.fz3-bubble-row{display:flex;align-items:baseline;justify-content:space-between;gap:18px}
.fz3-bubble-row + .fz3-bubble-row{margin-top:3px}
.fz3-bubble-k{color:var(--fz3-mute)}
.fz3-bubble-v{font-variant-numeric:tabular-nums;color:#eaf4ff}
.fz3-bubble-v b{font-weight:600}
.fz3-bubble-sub{margin-top:6px;font-size:10px;color:rgba(154,164,214,.85);letter-spacing:.04em}
.fz3-bubble[data-loading="1"] .fz3-bubble-v{opacity:.35}
/* 峰谷：圆角标签 + 等宽倒计时（谷绿 / 峰橙） */
.fz3-peak{display:inline-flex;align-items:center;gap:7px}
.fz3-peak-badge{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:5px;font-size:11px;font-weight:700;line-height:1;color:#fff;background:#2ec25f;box-shadow:0 0 9px rgba(46,194,95,.4)}
.fz3-peak-badge[data-tone="peak"]{background:#f0a13a;box-shadow:0 0 9px rgba(240,161,58,.4)}
.fz3-peak-clock{font-family:var(--fz3-font);font-variant-numeric:tabular-nums;font-size:12.5px;font-weight:700;letter-spacing:.06em;color:#3ed873;padding-bottom:2px;border-bottom:1px solid rgba(62,216,115,.55)}
.fz3-peak-clock[data-tone="peak"]{color:#ffb45c;border-bottom-color:rgba(255,180,92,.55)}

/* 用量气泡：黑底 + SDK_JP_Web 粗体白字；去掉峰谷小徽标和倒计时下划线 */
.fz3-bubble{
  background:#000!important;
  border-color:rgba(255,255,255,.16)!important;
  box-shadow:0 18px 44px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.04) inset!important;
  font-family:"SDK_JP_Web",var(--fz3-font)!important;
  font-weight:700!important;
}
.fz3-bubble::after{background:#000!important;border-color:rgba(255,255,255,.16)!important}
.fz3-bubble-head,.fz3-bubble-k,.fz3-bubble-v,.fz3-bubble-sub,.fz3-bubble-v b,.fz3-peak-clock{color:#fff!important}
.fz3-peak-badge{display:none!important}
.fz3-peak-clock{border-bottom:none!important;padding-bottom:0!important}
/* 只保留标题 + 余额 / 今日花费 / 峰谷 三行，下面的明细行全部隐藏 */
.fz3-bubble-sub{display:none!important}

/* 气泡内文字居中（2026-11-21）：标题、键值行整体水平居中，左右留白对称；
   原实现是标题左对齐 + 键值两端对齐（justify-content:space-between），观感偏向左侧 */
.fz3-bubble{
  padding:15px 18px 14px!important;
  text-align:center!important;
}
.fz3-bubble-head{
  text-align:center!important;
  margin-bottom:9px!important;
}
.fz3-bubble-row{
  justify-content:center!important;
  gap:14px!important;
  text-align:center!important;
}
.fz3-bubble-row + .fz3-bubble-row{margin-top:4px!important}
.fz3-bubble-k,.fz3-bubble-v{text-align:center!important}
.fz3-bubble-sub{text-align:center!important}

/* 朗读摘要气泡：贴在眼徽右边，一段一段换 */
.fz3-say{
  position:fixed;z-index:9003;
  left:calc(var(--fz3-dock-x) + var(--fz3-dock-size) / 2 + 14px);
  top:var(--fz3-dock-y);transform:translateY(-50%);
  max-width:240px;padding:9px 13px;border-radius:14px;
  background:#000;border:1px solid rgba(255,255,255,.16);
  box-shadow:0 12px 30px rgba(0,0,0,.55);
  color:#fff;font-family:"SDK_JP_Web",var(--fz3-font);font-weight:700;
  font-size:12.5px;line-height:1.5;pointer-events:none;
  animation:fz3-bubble-in .18s ease-out;
}
.fz3-say::before{
  content:"";position:absolute;left:-5px;top:50%;width:10px;height:10px;margin-top:-5px;
  transform:rotate(45deg);background:#000;
  border-left:1px solid rgba(255,255,255,.16);border-bottom:1px solid rgba(255,255,255,.16);
}
/* 描边（5px / #595959）：颜色取自用户给的色块截图（86×28 全幅实测 #595959）。
   加粗到 5px 后两处几何必须跟着改，否则会看出毛病：
   1) 尾巴是 10×10 的 content-box，边框在外扩会让它变成 15×15，
      而 left/margin-top 还按 10px 算，三角会整体偏下且接不上主边框
      → 改成 border-box + 16×16 + -8px 偏移，始终贴着气泡边；
   2) 主气泡是 border-box 定宽 236px，5px 边框会向内吃掉 10px 内容宽，
      导致文字行被挤窄可能换行 → 左右 padding 从 18px 收到 14px 抵消掉 */
:root{--fz3-edge:#595959;--fz3-edge-w:5px;--fz3-edge-deep:#353535}
.fz3-bubble{
  border:var(--fz3-edge-w) solid var(--fz3-edge)!important;
  padding:15px 14px 14px!important;
}
.fz3-bubble::after{
  box-sizing:border-box;
  width:16px;height:16px;left:-8px;margin-top:-8px;
  border-left:var(--fz3-edge-w) solid var(--fz3-edge)!important;
  border-bottom:var(--fz3-edge-w) solid var(--fz3-edge)!important;
}
.fz3-say{border:var(--fz3-edge-w) solid var(--fz3-edge)!important}
.fz3-say::before{
  box-sizing:border-box;
  width:16px;height:16px;left:-8px;margin-top:-8px;
  border-left:var(--fz3-edge-w) solid var(--fz3-edge)!important;
  border-bottom:var(--fz3-edge-w) solid var(--fz3-edge)!important;
}
/* —— 应用 UI 的两处也套用同一套描边（与气泡同色同粗）——
   1) 侧栏「新会话」按钮：原样式为 height:38px + padding:8px 12px + border:0.5px
      且 border-box + overflow:hidden。直接换成 5px 边框，内容区会被压成
      38-10-16=12px（行高 22px）→ 文字被裁。所以上下内边距 8px → 3px，
      5+3+22+3+5 = 38px，高度与文字居中完全不变；
      侧栏收起成图标栏时该按钮只有 36×36，加边会挤，故用 :has 排除收起态。 */
html:not(:has([data-sidebar-collapsed="true"])) button[class*="_newSession"]{
  border:var(--fz3-edge-w) solid var(--fz3-edge)!important;
  padding:3px 12px!important;
  box-shadow:inset 0 0 0 2px var(--fz3-edge-deep)!important;
}
/* 行宽对齐：.newSessionRow 原本左右各有 paint-inset(3px)+1px = 4px 外边距，
   而下方 .panelList / 工作区是 scrollArea 网格第 2 列（= 侧栏内容盒全宽）。
   所以按钮比下两块窄 8px。这里把行外边距清零，让三块描边左右边缘完全对齐。 */
html:not(:has([data-sidebar-collapsed="true"])) [class*="_newSessionRow"]{
  margin-left:0!important;
  margin-right:0!important;
}
/* 2) 输入框卡片（composer 的 .card，本版本哈希类名 GRgSLq_card）：
      原本 border:0；加 5px 后 border-box 定宽 100% → 内容窄 10px、外高 +10px，
      既不会裁字也不会挤断工具栏。 */
[class*="GRgSLq_card"]{
  border:var(--fz3-edge-w) solid var(--fz3-edge)!important;
}
/* —— 导航分组（插件 / 自动化任务 / 更多）加同款描边 ——
   .panelList 是侧栏 scrollArea 网格第 2 列的条目，本身没有边框和内边距；
   加 5px 边框会把里面的行压窄 10px，所以补 4px 竖向内边距，
   圆角取 14px 与气泡一致 */
[class*="_panelList"]{
  border:var(--fz3-edge-w) solid var(--fz3-edge)!important;
  border-radius:14px!important;
  padding:4px 6px!important;
  box-shadow:inset 0 0 0 2px var(--fz3-edge-deep)!important;
}

/* —— 工作区整块（「工作区」标题 + 列表）也加同款描边 ——
   容器用本版本的哈希类名 GAkraW_root（box-sizing:border-box，加边不吃外框）；
   列表原本用负边距把自己贴到侧栏边缘（margin-left:-4px 等），
   有了边框就得收回，否则行会压到描边上。 */
[class*="GAkraW_root"]{
  border:var(--fz3-edge-w) solid var(--fz3-edge)!important;
  border-radius:14px!important;
  box-shadow:inset 0 0 0 2px var(--fz3-edge-deep)!important;
}
[class*="GAkraW_root"] [class*="_listArea"]{
  margin-left:0!important;
  margin-right:0!important;
}

/* —— 深灰毛玻璃：侧栏三块 + 输入卡片 + 「已编辑文件」卡片 ——
   半透明深灰底 + backdrop-filter 把背后的星空/渐变糊开，形成磨砂玻璃。
   注意：backdrop-filter 每个元素都会单独建图层，不能无差别套到页面上所有卡片，
   否则长会话里几十张卡片会明显掉帧；这里只挑这几类容器。 */
:root{
  /* 炭灰毛玻璃：颜色取自主人给的色块（#212123，实测占 95.9%）。
     用 0.82 的透明度落在这个色上，同时保留一点透光让 blur 有感；
     想要完全不透（纯 #212123）就把最后一位改成 1。 */
  --fz3-glass:rgba(33,33,35,.82);
  /* 眼徽在「侧栏右缘 a ~ 内容列左缘 b」这条通道里的横向位置：
     0 = 贴侧栏，0.5 = 正中【默认】，1 = 贴内容列。
     想微调就改这个比值（也可以直接覆盖样式表里的同名变量）。 */
  --fz3-eye-gap-ratio:0.5;
  --fz3-glass-hover:rgba(44,44,48,.88);
  --fz3-glass-blur:14px;
  /* 弹层专用：密度更高，浮在不同背景上也不变色 */
  --fz3-glass-menu:rgba(28,28,32,.95);
}
button[class*="_newSession"],
[class*="_panelList"],
[class*="GAkraW_root"],
[class*="GRgSLq_card"],
[class*="HOHHba_card"]{
  background-color:var(--fz3-glass)!important;
  background-image:none!important;
  -webkit-backdrop-filter:var(--fz3-glass-filter,blur(var(--fz3-glass-blur)) saturate(125%))!important;
  backdrop-filter:var(--fz3-glass-filter,blur(var(--fz3-glass-blur)) saturate(125%))!important;
}
@media (hover:hover){
  button[class*="_newSession"]:hover{
    background-color:var(--fz3-glass-hover)!important;
  }
}

/* 「更多」菜单默认不可见：宿主先按自己的位置渲染，重定位脚本还没跑到时
   会在原位露一两帧（就是那下闪光）。这里先藏起来，等 JS 定位完再显式显示。 */
[class*="_moreMenu"]{visibility:hidden}

/* —— 主人自己发的消息也用同一套「卡片」外观 ——
   宿主给用户消息的容器打了 data-message-bubble，是稳定钩子（不依赖哈希类名）。
   底色用弹层那档更实的 --fz3-glass-menu：消息在对话区里，背景会变，
   用半透明会跟侧栏面板对不上；这里不加 backdrop-filter，避免每条消息都建图层。 */
[data-message-bubble]{
  box-sizing:border-box!important;
  border:var(--fz3-edge-w) solid var(--fz3-edge)!important;
  border-radius:14px!important;
  background:var(--fz3-glass-menu)!important;
  box-shadow:none!important;
}

/* —— 「+／斜杠」弹出的命令面板，和输入框保持同一套卡片外观 ——
   j99sVW_card 是宿主 commands 包里那个弹层的编译类名（max-height:320px、自带阴影）。
   换成同样的 5px 描边 + 实底 + 圆角，阴影去掉（描边已经足够分界）。 */
[class*="j99sVW_card"]{
  box-sizing:border-box!important;
  border:var(--fz3-edge-w) solid var(--fz3-edge)!important;
  border-radius:14px!important;
  background:var(--fz3-glass-menu)!important;
  box-shadow:none!important;
}

/* —— 工作区：范围收在本区高度内，超出时在列表内部滚动并显示滑块 ——
   原实现故意把列表交给外层 scrollArea 来滚：
   @container scroll-state(scrollable: bottom){ .listArea{overflow-y:hidden} }
   于是列表能长到整块侧栏高度，冲出工作区。这里改成列表自己滚，
   并给一个高度上限（38vh，约等于截图黄框里列表部分的高度）。
   要调整上限就改这一行。 */
html:not(:has([data-sidebar-collapsed="true"])) [class*="_listArea"]{
  max-height:38vh!important;
  min-height:120px!important;
  overflow-y:auto!important;
  scrollbar-width:thin;
  scrollbar-color:rgba(255,255,255,.28) transparent;
}
[class*="_listArea"]::-webkit-scrollbar{width:6px}
[class*="_listArea"]::-webkit-scrollbar-track{background:transparent}
[class*="_listArea"]::-webkit-scrollbar-thumb{
  background:rgba(255,255,255,.28);
  border-radius:3px;
}
[class*="_listArea"]::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.45)}
@keyframes fz3-bubble-in{from{opacity:0;transform:translateY(-50%) translateX(-6px)}to{opacity:1;transform:translateY(-50%)}}
.fz3-bubble[data-side="left"]{animation-name:fz3-bubble-in-left}
/* 气泡翻到眼徽左侧时尾巴是镜像的（用 right / border-right + border-top），
   原来的 1px 蓝灰描边在这里会盖掉主描边 → 同样按 5px / #595959 重写 */
.fz3-bubble[data-side="left"]::after{
  box-sizing:border-box;width:16px;height:16px;
  left:auto;right:-8px;margin-top:-8px;
  border-left:0!important;border-bottom:0!important;
  border-right:var(--fz3-edge-w) solid var(--fz3-edge)!important;
  border-top:var(--fz3-edge-w) solid var(--fz3-edge)!important;
}
@keyframes fz3-bubble-in-left{from{opacity:0;transform:translateY(-50%) translateX(6px)}to{opacity:1;transform:translateY(-50%)}}

.fz3-layer[data-drag="1"][data-phase="dock"] .fz3-core:active{cursor:grabbing}
.fz3-layer[data-dragging="1"][data-phase="dock"] .fz3-core{transition:none;cursor:grabbing}
.fz3-layer[data-dragging="1"][data-phase="dock"] .fz3-core svg{transition:none;transform:scale(1.05)}
.fz3-core svg{display:block;width:100%;height:100%;filter:none}
.fz3-eye-glyph{transition:transform .28s ease}
.fz3-layer[data-phase="dock"] .fz3-core svg{filter:none;transition:transform .3s ease}
.fz3-layer[data-phase="dock"] .fz3-core:hover .fz3-eye-glyph{transform:scale(1.07)}
/* ---------- 淡蓝色外阴影（2026-11-23 主人给的参考色块） ----------
   参考图是一层很淡的雾蓝：边缘散开、没有硬边，所以用「径向渐变 + 大半径模糊」
   而不是 box-shadow —— box-shadow 跟随方盒边缘，衰减太硬，压不出这种雾感。
   叠在眼体下面（z-index:-1，.fz3-core 有自己的层叠上下文，不会漏到页面底下）。
   调参入口（2026-11-23 主人第一次要求「范围更大、颜色更深」后取的值）：
     --fz3-shadow-spread  外扩幅度（相对眼徽直径，默认 34%）
     --fz3-shadow-blur    模糊半径（默认 24px）
     --fz3-shadow-a       中心浓度（默认 .62，越大越实）
   宿主会给圆角套超椭圆形状，所以这里同样显式写回 round，保证阴影是正圆。 */
.fz3-core::after{
  content:"";position:absolute;inset:calc(-1 * var(--fz3-shadow-spread,34%));z-index:-1;
  border-radius:50% !important;corner-shape:round !important;pointer-events:none;
  background:radial-gradient(closest-side,
    rgba(96,158,255,var(--fz3-shadow-a,.62)),
    rgba(84,140,255,.40) 46%,
    rgba(72,120,246,.18) 70%,
    rgba(64,108,240,0) 90%);
  filter:blur(var(--fz3-shadow-blur,24px));
}
.fz3-eye{position:relative;width:100%;height:100%;display:grid;place-items:center;filter:drop-shadow(0 0 26px rgba(52,96,240,.42))}
.fz3-eye-svg{position:relative;z-index:2;width:100%;height:100%;transition:transform .3s ease}
.fz3-eye-svg svg{width:100%;height:100%;display:block;overflow:visible}
.fz3-eye-svg #sclera,.fz3-eye-svg #iris-outer,.fz3-eye-svg #iris-blue,.fz3-eye-svg #pupil,.fz3-eye-svg #highlight{
  transform-box:view-box;transform-origin:80px 80px;
}
.fz3-eye-svg #corners{transform-box:view-box;transform-origin:80px 80px;animation:fz3-corners 12s linear infinite}
.fz3-eye-svg #sclera{animation:fz3-breath-a 1.5s cubic-bezier(.72,0,.28,1) infinite alternate}
.fz3-eye-svg #iris-outer{animation:fz3-breath-b 1.5s cubic-bezier(.72,0,.28,1) 47ms infinite alternate}
.fz3-eye-svg #iris-blue{animation:fz3-breath-c 1.5s cubic-bezier(.72,0,.28,1) 94ms infinite alternate}
.fz3-eye-svg #pupil{animation:fz3-breath-d 1.5s cubic-bezier(.72,0,.28,1) 187ms infinite alternate}
.fz3-eye-svg #highlight{animation:fz3-catchlight 3.6s ease-in-out infinite}
.fz3-eye-halo{position:absolute;inset:10%;border-radius:50%;z-index:1;pointer-events:none;
  background:radial-gradient(closest-side,rgba(64,112,255,.26),rgba(38,64,200,.10) 58%,transparent 78%);
  filter:blur(20px);animation:fz3-halo-pulse 4.6s ease-in-out infinite}

/* 扩散光环：官方 dsh-fairy-lash-pulse 的 4s 节奏（0-36% 扩散淡出，其余静默）
   2026-11-23 主人要求「圆形相对大小缩小一点」：
     · 起始尺寸：inset 7% → 14%（环的直径从眼框的 86% 收到 72%）
     · 扩散终点：scale 2.78 → 2.35（扩散幅度一起收，否则起点小了、末端反而更显大）
   想再收/放：只动这两个数（inset 越大环越小；末尾 scale 越小扩散越近）。 */
@keyframes fz3-ring{0%{opacity:0;transform:scale(.98)}5%{opacity:.78}12%{opacity:.56}20%{opacity:.2}27%{opacity:0}36%,100%{opacity:0;transform:scale(2.35)}}
.fz3-eye-ring{position:absolute;inset:14%;border-radius:50%;border:2px solid rgba(201,248,255,.86);box-shadow:0 0 14px rgba(120,200,255,.45),inset 0 0 10px rgba(150,220,255,.3);z-index:1;pointer-events:none;opacity:0;transform:scale(.98);animation:fz3-ring 4s cubic-bezier(.42,0,.22,1) infinite;will-change:transform,opacity}

/* 眼徽这一圈必须是**正圆**（2026-11-23 主人要求：矩形波动 → 圆形）
   宿主（DSH 0.2.2 的 corner-shape 主题层）会给圆角套超椭圆形状，
   于是 border-radius:50% 也会被画成"圆角矩形"。这里把形状显式交还成 round，
   半径仍是 50%。呼吸光晕、扫描层、闪光层、眼体本身一起圈住，免得只有局部变圆。 */
.fz3-eye-ring,
.fz3-eye-halo,
.fz3-eye-scan,
.fz3-eye-flash,
.fz3-eye,
.fz3-eye-svg{
  corner-shape:round !important;
  border-radius:50% !important;
}

/* ---------- 设置页 ---------- */
.fz3-set{display:flex;flex-direction:column;gap:14px;padding:2px 2px 8px;color:#e2ecfa;font-family:var(--fz3-font)}
.fz3-set-head{display:flex;align-items:center;gap:12px;padding:2px 0 6px}
.fz3-set-eye{width:46px;height:46px;flex:none;display:block;filter:drop-shadow(0 0 12px rgba(64,116,255,.5))}
.fz3-set-eye svg{width:100%;height:100%;display:block;overflow:visible}
.fz3-set-eye #fz3-lid-cover{display:none!important}
.fz3-set-name{font-size:15px;letter-spacing:.03em}
.fz3-set-sub{font-size:11.5px;color:#8fa3bb;margin-top:3px}
.fz3-set-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(130,160,210,.14)}
.fz3-set-label{font-size:13px}
.fz3-set-desc{font-size:11px;color:#8b9fb8;margin-top:3px;line-height:1.5}
.fz3-set-dot{width:8px;height:8px;border-radius:50%;flex:none;box-shadow:0 0 10px currentColor}
.fz3-set-dot.is-on{background:#4ee6a8;color:#4ee6a8}
.fz3-set-row.is-stack{display:block}
.fz3-set-path{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}
.fz3-set-input{flex:1 1 260px;min-width:0;padding:8px 11px;font-family:inherit;font-size:12.5px;font-weight:400;line-height:1.45;letter-spacing:0;color:#dbe8f6;background:rgba(9,13,22,.82);border:1px solid rgba(120,160,220,.26);border-radius:9px;outline:none;transition:border-color .18s ease,box-shadow .18s ease}
.fz3-set-input:focus{border-color:rgba(87,232,255,.55);box-shadow:0 0 0 3px rgba(87,232,255,.12)}
.fz3-set-input::placeholder{color:rgba(150,172,200,.5)}
.fz3-set-dot.is-wait{background:#f0b45c;box-shadow:0 0 11px rgba(240,180,92,.6)}
.fz3-set-dot.is-off{background:#7d8ea6;color:#7d8ea6}
.fz3-set-switch{width:42px;height:24px;border-radius:99px;border:1px solid rgba(140,170,220,.3);background:rgba(120,150,200,.18);position:relative;cursor:pointer;flex:none;transition:background .18s ease,border-color .18s ease}
.fz3-set-switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#cfdcee;transition:transform .18s ease,background .18s ease}
.fz3-set-switch[data-on="1"]{background:linear-gradient(90deg,#2f7bff,#57e8ff);border-color:rgba(120,225,255,.6)}
.fz3-set-switch[data-on="1"]::after{transform:translateX(18px);background:#04121f}
/* 毛玻璃模糊度滑块 */
.fz3-set-range-wrap{display:flex;align-items:center;gap:10px;flex:none}
.fz3-set-range{
  -webkit-appearance:none;appearance:none;width:132px;height:4px;border-radius:2px;
  background:rgba(140,170,220,.28);outline:none;cursor:pointer;
}
.fz3-set-range::-webkit-slider-thumb{
  -webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;
  background:#57e8ff;border:0;box-shadow:0 0 10px rgba(87,232,255,.55);cursor:pointer;
}
.fz3-set-range::-moz-range-thumb{width:14px;height:14px;border:0;border-radius:50%;background:#57e8ff}
.fz3-set-val{min-width:44px;text-align:right;font-size:12px;color:#9fb4d0;font-variant-numeric:tabular-nums}
.fz3-set-actions{display:flex;flex-wrap:wrap;gap:8px}
.fz3-set-btn{font:inherit;font-size:12px;padding:8px 14px;border-radius:9px;cursor:pointer;color:#e8f2ff;background:rgba(87,232,255,.12);border:1px solid rgba(110,200,255,.32);transition:background .16s ease,border-color .16s ease}
.fz3-set-btn:hover:not(:disabled){background:rgba(87,232,255,.22);border-color:rgba(120,225,255,.6)}
.fz3-set-btn:disabled{opacity:.4;cursor:default}
.fz3-set-btn.is-ghost{background:rgba(255,255,255,.04);border-color:rgba(140,160,190,.24)}
.fz3-set-seg{display:flex;gap:6px;flex:none}
.fz3-set-segbtn{font:inherit;font-size:11.5px;padding:6px 11px;border-radius:8px;cursor:pointer;color:#a9b8d6;background:rgba(255,255,255,.04);border:1px solid rgba(140,160,190,.22);transition:all .16s ease}
.fz3-set-segbtn[data-on="1"]{color:#04121f;background:linear-gradient(90deg,#8fb4ff,#57e8ff);border-color:rgba(120,225,255,.6)}
html[data-fz3-theme="light"] .fz3-set-segbtn{color:#48566f;background:rgba(40,70,150,.05);border-color:rgba(70,110,190,.22)}
html[data-fz3-theme="light"] .fz3-set-segbtn[data-on="1"]{color:#08132a;background:linear-gradient(90deg,#7fa6ff,#4fd2ee)}
.fz3-set-note{font-size:11px;line-height:1.6;color:#7f92a9}
/* 设置页在 DSH 浅色外观下是白底，深色字色必须跟着翻过来 */
html[data-fz3-theme="light"] .fz3-set{color:#16213a}
html[data-fz3-theme="light"] .fz3-set-name{color:#101a30}
html[data-fz3-theme="light"] .fz3-set-sub,
html[data-fz3-theme="light"] .fz3-set-desc,
html[data-fz3-theme="light"] .fz3-set-note{color:rgba(62,80,118,.92)}
html[data-fz3-theme="light"] .fz3-set-row{background:rgba(30,60,130,.045);border-color:rgba(70,110,190,.2)}
html[data-fz3-theme="light"] .fz3-set-input{color:#12203c;background:#fff;border-color:rgba(70,110,190,.3)}
html[data-fz3-theme="light"] .fz3-set-input::placeholder{color:rgba(90,110,150,.55)}
html[data-fz3-theme="light"] .fz3-set-btn{color:#0f2140;background:rgba(70,140,255,.1);border-color:rgba(70,140,255,.38)}
html[data-fz3-theme="light"] .fz3-set-btn.is-ghost{color:#26344f;background:rgba(30,60,130,.05);border-color:rgba(70,110,190,.24)}
html[data-fz3-theme="light"] .fz3-set-switch{background:rgba(130,160,200,.3);border-color:rgba(90,120,180,.42)}
html[data-fz3-theme="light"] .fz3-set-switch::after{background:#fff}
/* ---------- 记忆系统（2026-11-27）：dsh-mind / 神经记忆的开关收在设置页 ----------
   两张卡片各自成组，配色跟着插件图标走：mind 蓝、neural 紫。 */
.fz3-set-group{font-size:11px;letter-spacing:.14em;color:#7f95b5;padding:4px 2px 0;text-transform:uppercase}
.fz3-set-mem{border:1px solid rgba(140,170,220,.16);border-radius:14px;padding:12px 12px 8px;background:rgba(255,255,255,.022);display:flex;flex-direction:column;gap:8px}
.fz3-set-memhead{display:flex;align-items:center;gap:11px;padding:0 2px 2px}
.fz3-set-memicon{width:34px;height:34px;flex:none;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(70,130,255,.12);border:1px solid rgba(110,170,255,.24)}
.fz3-set-memicon svg{width:20px;height:20px;display:block;overflow:visible}
.fz3-set-mem[data-tone="neural"] .fz3-set-memicon{background:rgba(170,90,255,.13);border-color:rgba(190,120,255,.26)}
.fz3-set-memname{font-size:13px;letter-spacing:.02em}
.fz3-set-memsub{font-size:11px;color:#8b9fb8;margin-top:3px;line-height:1.45}
.fz3-set-mem .fz3-set-row{padding:10px 12px;background:rgba(255,255,255,.03)}
.fz3-set-mem .fz3-set-note{padding:0 2px 2px}
html[data-fz3-theme="light"] .fz3-set-group{color:#5b6f92}
html[data-fz3-theme="light"] .fz3-set-mem{background:rgba(255,255,255,.5);border-color:rgba(70,110,190,.18)}
html[data-fz3-theme="light"] .fz3-set-mem .fz3-set-row{background:rgba(30,60,130,.04)}
html[data-fz3-theme="light"] .fz3-set-memsub{color:rgba(62,80,118,.92)}

/* ---------- 工具链（2026-11-27）：Fairy 会话下发哪些工具，由 dsh-fairy-zzz/toolgate 落实 ----------
   一张卡片：总开关 + 三个预设（精简 / 推荐 / 全部）+ 可滚动的分组勾选清单。
   勾选即保存；关掉的工具不会进入该 agent 的模型可见集合，schema token 直接省掉。 */
.fz3-set-tools{border:1px solid rgba(140,170,220,.16);border-radius:14px;padding:12px;background:rgba(255,255,255,.022);display:flex;flex-direction:column;gap:10px}
.fz3-set-toolhead{display:flex;align-items:center;gap:11px;padding:0 2px}
.fz3-set-tooltitle{font-size:13px;letter-spacing:.02em}
.fz3-set-toolsub{font-size:11px;color:#8b9fb8;margin-top:3px;line-height:1.45}
.fz3-set-toolsum{font-size:11.5px;line-height:1.6;color:#9fb4d0}
.fz3-set-toolsum b{color:#57e8ff;font-weight:500}
.fz3-set-toolpresets{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.fz3-set-toolpresets .fz3-set-segbtn{font-size:11px;padding:5px 10px}
.fz3-set-toolmini{font:inherit;font-size:11px;padding:5px 9px;border-radius:7px;cursor:pointer;color:#9fb4d0;background:transparent;border:1px solid rgba(140,160,190,.22)}
.fz3-set-toolmini:hover{color:#dbe8f6;border-color:rgba(120,225,255,.5)}
.fz3-set-toollist{max-height:290px;overflow:auto;border-top:1px solid rgba(140,170,220,.14);padding-top:4px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.24) transparent}
.fz3-set-toollist::-webkit-scrollbar{width:6px}
.fz3-set-toollist::-webkit-scrollbar-thumb{background:rgba(255,255,255,.24);border-radius:3px}
.fz3-set-toolgroup{font-size:10.5px;letter-spacing:.12em;color:#7f95b5;padding:8px 2px 3px}
.fz3-set-toolrow{display:flex;align-items:center;gap:8px;min-height:26px;padding:1px 4px;border-radius:7px;cursor:pointer}
.fz3-set-toolrow:hover{background:rgba(120,170,255,.1)}
.fz3-set-toolcheck{width:14px;height:14px;flex:none;margin:0;accent-color:#57e8ff;cursor:pointer}
.fz3-set-toolname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:#dbe8f6}
.fz3-set-tooltok{flex:none;font-size:10.5px;color:#7f95b5;font-variant-numeric:tabular-nums}
.fz3-set-tools.is-off .fz3-set-toollist{opacity:.42;pointer-events:none}
.fz3-set-tools.is-off .fz3-set-toolmini{display:none}
html[data-fz3-theme="light"] .fz3-set-tools{background:rgba(255,255,255,.5);border-color:rgba(70,110,190,.18)}
html[data-fz3-theme="light"] .fz3-set-toolsub{color:rgba(62,80,118,.92)}
html[data-fz3-theme="light"] .fz3-set-toolsum{color:#4a5f85}
html[data-fz3-theme="light"] .fz3-set-toolsum b{color:#1f7fa8}
html[data-fz3-theme="light"] .fz3-set-toollist{border-color:rgba(70,110,190,.16);scrollbar-color:rgba(70,100,150,.35) transparent}
html[data-fz3-theme="light"] .fz3-set-toollist::-webkit-scrollbar-thumb{background:rgba(70,100,150,.35)}
html[data-fz3-theme="light"] .fz3-set-toolgroup{color:#5b6f92}
html[data-fz3-theme="light"] .fz3-set-toolrow:hover{background:rgba(60,110,200,.08)}
html[data-fz3-theme="light"] .fz3-set-toolname{color:#16213a}
html[data-fz3-theme="light"] .fz3-set-tooltok{color:rgba(62,80,118,.7)}
html[data-fz3-theme="light"] .fz3-set-toolmini{color:#48566f;border-color:rgba(70,110,190,.22)}


/* ---------- 学习代办（2026-11-23 并入皮肤，原独立插件 dsh-learning-todo） ----------
   两处界面共用一套类名：
     · .fz3-td-root / .fz3-td-block —— 侧栏脚部卡片（sidebar.footer.action），
       边框沿用皮肤的 --fz3-edge / --fz3-edge-w，圆角 25px 与「工作区」整块对齐；
     · 显示与否跟设置页「学习代办」那一行的开关走（键名 fairy.zzz.todo-show）。
   行高、内边距与设置页的 .fz3-set-row 保持同一节奏，换深浅色只走 html[data-fz3-theme]。 */
.fz3-td-root{flex:none;width:100%;min-width:0;margin-top:0;--fz3-td-radius:25px}
.fz3-td-block{box-sizing:border-box;width:100%;overflow:hidden;border:var(--fz3-edge-w,0.5px) solid var(--fz3-edge,rgba(130,160,210,.3));border-radius:var(--fz3-td-radius);background:transparent;color:var(--dsw-alias-label-primary,#e2ecfa);font-family:var(--fz3-font)}
/* 侧栏右缘那条竖线是宿主的拖拽把手（[class*="_handle"]）：只去掉可见的线，拖拽照旧 */
[class*="_handle"]{opacity:0!important}
.fz3-td-headrow{display:flex;align-items:center;gap:8px;width:100%;height:34px;padding:0 9px;border:0;background:transparent;color:inherit;font:inherit;font-size:13px;font-weight:500;cursor:pointer;text-align:left}
@media (hover:hover){.fz3-td-headrow:hover{background:rgba(120,170,255,.12)}}
.fz3-td-headlabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fz3-td-headcount{margin-left:auto;font-size:12px;line-height:16px;color:rgba(178,200,230,.72);font-variant-numeric:tabular-nums}
.fz3-td-caret{flex:none;font-size:10px;line-height:1;color:rgba(178,200,230,.72)}
.fz3-td-panel{display:flex;flex-direction:column;min-height:0;max-height:min(46vh,420px);border-bottom:1px solid rgba(130,165,220,.18)}
.fz3-td-body{display:flex;flex:1;flex-direction:column;min-height:0}
.fz3-td-add{display:flex;flex:none;align-items:center;gap:6px;padding:8px 9px}
.fz3-td-input{flex:1;min-width:0;height:28px;padding:0 8px;border:1px solid rgba(120,160,220,.26);border-radius:8px;background:rgba(9,13,22,.6);color:inherit;font:inherit;font-size:13px;outline:0}
.fz3-td-input:focus{border-color:rgba(87,232,255,.55);box-shadow:0 0 0 3px rgba(87,232,255,.1)}
.fz3-td-input::placeholder{color:rgba(150,172,200,.5)}
.fz3-td-addbtn{flex:none;height:28px;padding:0 10px;border:1px solid rgba(110,200,255,.32);border-radius:8px;background:rgba(87,232,255,.12);color:inherit;font:inherit;font-size:12px;cursor:pointer}
.fz3-td-addbtn:hover:not(:disabled){background:rgba(87,232,255,.22);border-color:rgba(120,225,255,.6)}
.fz3-td-addbtn:disabled{opacity:.4;cursor:default}
.fz3-td-list{flex:1;min-height:0;overflow:auto;padding:0 0 6px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.28) transparent}
.fz3-td-list::-webkit-scrollbar{width:6px}
.fz3-td-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.28);border-radius:3px}
.fz3-td-sec{display:flex;align-items:center;gap:6px;width:100%;height:26px;margin-top:2px;padding:0 9px;border:0;background:transparent;color:rgba(178,200,230,.75);font:inherit;font-size:12px;cursor:pointer;text-align:left}
@media (hover:hover){.fz3-td-sec:hover{background:rgba(120,170,255,.1)}}
.fz3-td-seccount{margin-left:auto;font-variant-numeric:tabular-nums}
.fz3-td-row{display:flex;align-items:center;gap:8px;min-height:28px;padding:2px 9px}
@media (hover:hover){.fz3-td-row:hover{background:rgba(120,170,255,.1)}}
label.fz3-td-row{cursor:pointer}
.fz3-td-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.fz3-td-row.is-done .fz3-td-text{color:rgba(170,190,215,.58);text-decoration:line-through}
.fz3-td-date{flex:none;font-size:11px;color:rgba(170,190,215,.65);font-variant-numeric:tabular-nums}
.fz3-td-mark{flex:none;display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:rgba(78,230,168,.18);color:#4ee6a8}
.fz3-td-check{flex:none;width:15px;height:15px;margin:0;accent-color:#57e8ff;cursor:pointer}
.fz3-td-empty{padding:12px 9px;text-align:center;color:rgba(170,190,215,.72);font-size:12px}
/* 2026-11-26 合并「已完成 / 归档已完成」：勾选即归档，底栏那个归档按钮已撤。
   已完成行上留一个「退回」，误勾能把任务捡回待办（原来归档只读，误勾无从挽回）。 */
.fz3-td-restore{flex:none;height:20px;padding:0 6px;border:1px solid rgba(120,160,220,.28);border-radius:6px;background:transparent;color:rgba(178,200,230,.8);font:inherit;font-size:13px;line-height:18px;cursor:pointer;opacity:.55;transition:opacity .15s ease,background .15s ease}
@media (hover:hover){.fz3-td-row:hover .fz3-td-restore,.fz3-td-restore:hover{opacity:1;background:rgba(87,232,255,.12)}}
/* 2026-11-27 永久删除：删掉就没有回头路，所以第一下只把按钮换成「确认删除」，
   第二下才真删；3 秒不动自动收回，误点也不会删掉记录。 */
.fz3-td-del{flex:none;height:20px;padding:0 6px;border:1px solid rgba(120,160,220,.28);border-radius:6px;background:transparent;color:rgba(178,200,230,.8);font:inherit;font-size:13px;line-height:18px;cursor:pointer;opacity:.55;transition:opacity .15s ease,background .15s ease,color .15s ease,border-color .15s ease}
@media (hover:hover){.fz3-td-row:hover .fz3-td-del,.fz3-td-del:hover{opacity:1;color:#ff9a9a;border-color:rgba(255,120,120,.5);background:rgba(255,90,90,.14)}}
.fz3-td-del.is-armed{opacity:1;padding:0 7px;font-size:12px;color:#ffc2c2;border-color:rgba(255,120,120,.72);background:rgba(255,80,80,.22)}
.fz3-td-root.is-rail{width:36px;margin:0 auto}
.fz3-td-root.is-rail .fz3-td-headrow{justify-content:center;height:36px;padding:0}
.fz3-td-root.is-rail .fz3-td-headlabel,.fz3-td-root.is-rail .fz3-td-headcount,.fz3-td-root.is-rail .fz3-td-caret,.fz3-td-root.is-rail .fz3-td-panel{display:none}
.fz3-td-headrow:focus-visible,.fz3-td-input:focus-visible,.fz3-td-addbtn:focus-visible,.fz3-td-sec:focus-visible,.fz3-td-restore:focus-visible,.fz3-td-del:focus-visible,.fz3-td-check:focus-visible{outline:2px solid #57e8ff;outline-offset:-2px}
html[data-fz3-theme="light"] .fz3-td-block{background:#fff;border-color:rgba(70,110,190,.22);color:#16213a}
html[data-fz3-theme="light"] .fz3-td-headrow:hover,html[data-fz3-theme="light"] .fz3-td-sec:hover,html[data-fz3-theme="light"] .fz3-td-row:hover{background:rgba(60,110,200,.08)}
html[data-fz3-theme="light"] .fz3-td-headcount,html[data-fz3-theme="light"] .fz3-td-caret,html[data-fz3-theme="light"] .fz3-td-sec,html[data-fz3-theme="light"] .fz3-td-empty,html[data-fz3-theme="light"] .fz3-td-date{color:rgba(62,80,118,.78)}
html[data-fz3-theme="light"] .fz3-td-input{color:#12203c;background:#fff;border-color:rgba(70,110,190,.3)}
html[data-fz3-theme="light"] .fz3-td-input::placeholder{color:rgba(90,110,150,.55)}
html[data-fz3-theme="light"] .fz3-td-addbtn{color:#0f2140;background:rgba(70,140,255,.1);border-color:rgba(70,140,255,.38)}
html[data-fz3-theme="light"] .fz3-td-restore{color:rgba(62,80,118,.82);border-color:rgba(70,110,190,.34)}
html[data-fz3-theme="light"] .fz3-td-del{color:rgba(62,80,118,.82);border-color:rgba(70,110,190,.34)}
html[data-fz3-theme="light"] .fz3-td-del.is-armed{color:#a82424;border-color:rgba(200,60,60,.6);background:rgba(210,60,60,.14)}
html[data-fz3-theme="light"] .fz3-td-list{scrollbar-color:rgba(70,100,150,.35) transparent}
html[data-fz3-theme="light"] .fz3-td-list::-webkit-scrollbar-thumb{background:rgba(70,100,150,.35)}

/* ---------- 花屏（视频里的随机故障帧） ---------- */
.fz3-glitch{position:absolute;inset:0;z-index:3;pointer-events:none;mix-blend-mode:screen;filter:saturate(1.18) contrast(1.06)}
.fz3-gband{position:absolute;inset:0;display:block;will-change:transform,opacity}
.fz3-gband svg{width:100%;height:100%;display:block}
.fz3-gline{position:absolute;left:-8%;right:-8%;height:1px;background:rgba(205,248,255,.9);mix-blend-mode:screen;opacity:.75;animation:fz3-gline .26s steps(3) infinite}
@keyframes fz3-gline{0%{top:21%}33%{top:57%}66%{top:36%}100%{top:71%}}
.fz3-eye[data-glitch="1"] .fz3-eye-svg{opacity:.42;filter:contrast(1.14) saturate(.9)}
.fz3-eye[data-glitch="1"] .fz3-eye-halo{opacity:.5}

/* ---------- 待机随机小动作 ---------- */
/* 眼睑遮罩：路径与曲线取自 Fairy-DSH 的 thinking-eye-clip（Apache-2.0） */
.fz3-eye-svg #fz3-lid-cover{pointer-events:none}
/* dock 眼徽：眨眼遮罩层改用一份全局唯一的裁剪圆（原 SVG 里同名 clipPath 多份重复，
   引用会指向隐藏副本导致裁剪失效、遮罩整块浮到眼睛上方）。眨眼动画保留。 */
.fz3-core #fz3-lid-cover{clip-path:url(#fz3-lid-clip-global)!important}
.fz3-eye-svg .fz3-lid-shape{transform-box:view-box;transform-origin:80px 60px;transform:translateY(-60px) scaleY(1)}
@keyframes fz3-lid-think{from{transform:translateY(14.5px) scaleY(.55)}to{transform:translateY(15.5px) scaleY(1)}}
@keyframes fz3-lid-soft{from{transform:translateY(-7px)}to{transform:translateY(1px)}}
@keyframes fz3-lid-blink{0%{transform:translateY(-60px) scaleY(1)}40%{transform:translateY(16px) scaleY(1)}56%{transform:translateY(16px) scaleY(1)}100%{transform:translateY(-60px) scaleY(1)}}
@keyframes fz3-eyelid-halo{0%{opacity:1;transform:scale(1)}42%{opacity:.45;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
.fz3-eye[data-lid="think"] .fz3-eye-svg .fz3-lid-shape{animation:fz3-lid-think .72s cubic-bezier(.72,0,.28,1) infinite alternate}
.fz3-eye[data-lid="soft"] .fz3-eye-svg .fz3-lid-shape{animation:fz3-lid-soft 1.9s cubic-bezier(.72,0,.28,1) infinite alternate}
.fz3-eye[data-lid="blink"] .fz3-eye-svg .fz3-lid-shape{animation:fz3-lid-blink 300ms cubic-bezier(.4,0,.2,1) both}
.fz3-eye[data-blink="1"] .fz3-eye-halo{animation:fz3-eyelid-halo 300ms ease both}

/* 瞟一眼：虹膜整组短距离位移 */
@keyframes fz3-glance-l{0%,100%{transform:translateX(0)}34%,62%{transform:translateX(-6%)}}
@keyframes fz3-glance-r{0%,100%{transform:translateX(0)}34%,62%{transform:translateX(6%)}}
.fz3-eye[data-glance="l"] .fz3-eye-svg #iris-outer,
.fz3-eye[data-glance="l"] .fz3-eye-svg #iris-blue,
.fz3-eye[data-glance="l"] .fz3-eye-svg #pupil{animation:fz3-glance-l .72s cubic-bezier(.4,0,.3,1) both!important}
.fz3-eye[data-glance="r"] .fz3-eye-svg #iris-outer,
.fz3-eye[data-glance="r"] .fz3-eye-svg #iris-blue,
.fz3-eye[data-glance="r"] .fz3-eye-svg #pupil{animation:fz3-glance-r .72s cubic-bezier(.4,0,.3,1) both!important}

/* 思考：眼球左右扫视，外框加速 */
/* 思考态：眼睑半闭（见 data-lid="think"），不再横扫 */

.fz3-layer[data-mood="thinking"] .fz3-eye-halo{animation-duration:1.6s}
.fz3-layer[data-mood="thinking"] .fz3-eye-svg #corners{animation-duration:4s}

/* 执行：外框快速自转 + 扫描线 */

.fz3-layer[data-mood="working"] .fz3-eye-svg #pupil{animation:fz3-focus 1.1s ease-in-out infinite}
.fz3-layer[data-mood="working"] .fz3-eye-halo{animation-duration:1.1s}
.fz3-layer[data-mood="working"] .fz3-eye-svg #corners{animation:fz3-corners 1.9s linear infinite}
.fz3-eye-scan{position:absolute;inset:5%;z-index:4;border-radius:50%;overflow:hidden;pointer-events:none;opacity:0}
.fz3-eye-scan::before{
  content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,transparent 44%,rgba(214,232,255,.5) 50%,transparent 56%);
  mix-blend-mode:screen;animation:fz3-scan-move 1.3s linear infinite;
}
.fz3-layer[data-mood="working"] .fz3-eye-scan{opacity:1}

/* 完成：弹一下 + 光环炸开 */
.fz3-layer[data-mood="done"] .fz3-eye{animation:fz3-celebrate 1s cubic-bezier(.3,1.5,.5,1) 1}
.fz3-eye-flash{position:absolute;inset:-4%;z-index:0;border-radius:50%;pointer-events:none;opacity:0;
  border:2px solid rgba(190,220,255,.85)}
.fz3-layer[data-mood="done"] .fz3-eye-flash{animation:fz3-burst .95s ease-out 1}

@keyframes fz3-corners{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes fz3-breath-a{from{transform:scale(.985)}to{transform:scale(.91)}}
@keyframes fz3-breath-b{from{transform:scale(1)}to{transform:scale(.90)}}
@keyframes fz3-breath-c{from{transform:scale(1)}to{transform:scale(.87)}}
@keyframes fz3-breath-d{from{transform:scale(1)}to{transform:scale(.85)}}
@keyframes fz3-catchlight{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.82;transform:scale(.94)}}
@keyframes fz3-look{0%,100%{transform:translateX(0) scale(1)}25%{transform:translateX(-5px) scale(.97)}75%{transform:translateX(5px) scale(.97)}}
@keyframes fz3-focus{0%,100%{transform:scale(1)}50%{transform:scale(.82)}}
@keyframes fz3-celebrate{0%{transform:scale(1)}30%{transform:scale(1.14)}62%{transform:scale(.97)}100%{transform:scale(1)}}
@keyframes fz3-burst{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.5);opacity:0}}
@keyframes fz3-core-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.028)}}
@keyframes fz3-halo-pulse{0%,100%{opacity:.55;transform:scale(.97)}50%{opacity:.95;transform:scale(1.05)}}
@keyframes fz3-eye-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-7px) scale(1.02)}}
@keyframes fz3-scan-move{0%{transform:translateY(-46%)}100%{transform:translateY(46%)}}

/* ———————————————————— */
.fz3-copy{
  position:fixed;left:50%;top:calc(var(--fz3-eye-cy) + var(--fz3-eye) / 2 + var(--fz3-eye-gap));
  transform:translate(-50%,0);width:min(820px,90vw);
  text-align:center;opacity:0;pointer-events:none;z-index:3;transition:opacity .6s ease,transform 1s ease;
}
.fz3-layer[data-phase="greet"] .fz3-copy{opacity:1}
.fz3-layer[data-phase="dock"] .fz3-copy{opacity:0;transform:translate(-50%,-16px)}
.fz3-copy-kicker{font-size:clamp(8px,.78vw,9.5px);letter-spacing:.44em;color:rgba(150,172,255,.82);margin-bottom:clamp(6px,1.4vh,14px);text-indent:.44em}
.fz3-copy-title{display:inline-block;position:relative;margin-bottom:clamp(24px,4.4vh,56px);font-size:clamp(18px,min(3.1vw,4.6vh),38px);font-weight:700;letter-spacing:.045em;line-height:1.06;color:#fff;text-align:center;}
/* 镜面倒影已按用户要求移除（2026-11-21）：标题下方不再有翻转的残影。
   原实现：.fz3-copy-title::after{content:attr(data-text);transform:scaleY(-1);opacity:.26;...} */
.fz3-copy-title-wrap{text-align:center}
.fz3-copy-title-zh{
  font-size:clamp(10px,min(1.15vw,1.7vh),15px);letter-spacing:.34em;text-indent:.34em;
  color:rgba(168,224,255,.92);
  margin-bottom:clamp(4px,1vh,12px);
}
.fz3-copy-lines{display:flex;flex-direction:column;gap:clamp(4px,.9vh,8px);padding:0 clamp(14px,3vw,28px);text-wrap:balance;font-size:clamp(13px,min(1.7vw,2.6vh),22px);line-height:1.52;color:#eef8ff}
.fz3-copy-lines span{opacity:0;transform:translateY(10px);animation:fz3-line .75s cubic-bezier(.2,.7,.2,1) forwards;white-space:pre-wrap}
.fz3-copy-lines span:nth-child(1){animation-delay:.55s}
.fz3-copy-lines span:nth-child(2){animation-delay:1.15s}
.fz3-copy-lines span:nth-child(3){animation-delay:1.75s}
.fz3-copy-sub{margin-top:clamp(6px,1.4vh,16px);font-size:clamp(7px,.66vw,8.5px);letter-spacing:.32em;color:rgba(122,178,230,.6);text-indent:.32em}
.fz3-copy-tap{margin-top:14px;font-size:10px;letter-spacing:.2em;color:rgba(255,201,60,.85);animation:fz3-blink 1.6s ease-in-out infinite}
.fz3-skip2{
  position:absolute;right:clamp(12px,2.4vw,30px);bottom:clamp(10px,2.6vh,26px);pointer-events:auto;background:none;border:0;font:inherit;
  font-size:9.5px;letter-spacing:.26em;color:rgba(150,200,235,.55);cursor:pointer;padding:8px;
}
.fz3-skip2:hover{color:#9fefff}

/* ---------- 左下角坞 ---------- */
.fz3-tag{
  position:fixed;left:calc(var(--fz3-dock-x) + 62px);top:calc(100% - 262px);z-index:5;pointer-events:none;
  display:flex;flex-direction:column;gap:3px;padding:5px 12px 6px 10px;border-left:2px solid rgba(87,232,255,.75);
  background:linear-gradient(90deg,rgba(8,20,42,.82),rgba(8,20,42,0));
  opacity:0;transform:translateX(-8px);
  transition:opacity .6s ease .35s,transform .6s ease .35s;
}
.fz3-layer[data-phase="dock"] .fz3-tag{opacity:1;transform:none}
.fz3-tag b{font-size:11px;letter-spacing:.3em;color:#e6f8ff;text-shadow:0 0 14px rgba(87,232,255,.7)}
.fz3-tag i{font-style:normal;font-size:7.5px;letter-spacing:.24em;color:rgba(140,196,240,.85)}
.fz3-panel{
  position:fixed;left:calc(var(--fz3-dock-x) - 30px);bottom:330px;width:308px;z-index:6;pointer-events:auto;
  padding:14px 15px 12px;color:var(--fz3-text);
  background:linear-gradient(158deg,rgba(10,21,44,.97),rgba(4,8,20,.985));
  border:1px solid rgba(87,232,255,.32);
  clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px));
  box-shadow:0 26px 70px -26px rgba(0,0,0,.95),0 0 46px -22px rgba(87,232,255,.75);
  animation:fz3-panel-in .26s cubic-bezier(.2,.8,.2,1);
  transform-origin:10% 100%;
}
.fz3-panel::before{content:"";position:absolute;left:0;top:0;width:72px;height:2px;background:linear-gradient(90deg,#57e8ff,transparent)}
.fz3-panel::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.24;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.4) 0 1px,transparent 1px 4px)}
.fz3-panel-head{display:flex;align-items:center;justify-content:space-between;padding-bottom:9px;border-bottom:1px solid rgba(87,232,255,.18)}
.fz3-panel-title{font-size:10.5px;letter-spacing:.26em;color:#dff4ff;text-shadow:0 0 10px rgba(87,232,255,.5)}
.fz3-dot{width:6px;height:6px;border-radius:50%;background:#3ef0b0;box-shadow:0 0 10px #3ef0b0;flex:none}
.fz3-dot.off{background:#ff5d7a;box-shadow:0 0 10px #ff5d7a}
.fz3-dot.warn{background:#ffc93c;box-shadow:0 0 10px #ffc93c}
.fz3-panel-sub{font-size:8.5px;letter-spacing:.14em;color:rgba(130,170,215,.68);margin:8px 0 10px}
.fz3-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;font-size:12px;color:rgba(222,238,255,.92)}
.fz3-row-label{display:flex;align-items:center;gap:8px;letter-spacing:.06em}
.fz3-row small{font-size:9px;letter-spacing:.14em;color:rgba(120,170,215,.7)}
.fz3-switch{
  position:relative;width:38px;height:19px;flex:none;padding:0;border:1px solid rgba(87,232,255,.35);
  background:rgba(8,16,34,.9);cursor:pointer;
  clip-path:polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px));
}
.fz3-switch::after{
  content:"";position:absolute;top:2px;left:2px;width:13px;height:13px;background:rgba(150,180,210,.75);
  transition:transform .18s ease,background .18s ease,box-shadow .18s ease;
}
.fz3-switch[data-on="1"]{border-color:rgba(87,232,255,.8);box-shadow:inset 0 0 14px -6px rgba(87,232,255,.9)}
.fz3-switch[data-on="1"]::after{transform:translateX(19px);background:var(--fz3-cyan);box-shadow:0 0 10px var(--fz3-cyan)}
.fz3-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;position:relative;z-index:1}
.fz3-btn{
  font:inherit;font-size:10px;letter-spacing:.1em;color:rgba(214,236,255,.9);background:rgba(10,22,44,.8);
  border:1px solid rgba(87,232,255,.24);padding:8px 8px;cursor:pointer;
  clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));
}
.fz3-btn:hover{background:rgba(87,232,255,.16);border-color:rgba(87,232,255,.7);color:#fff}
.fz3-btn:disabled{opacity:.45;cursor:not-allowed}
.fz3-btn.is-ghost{background:transparent;border-color:rgba(120,160,210,.16);color:rgba(160,190,220,.75)}
.fz3-panel-foot{margin-top:10px;padding-top:8px;border-top:1px solid rgba(87,232,255,.12);display:flex;justify-content:space-between;font-size:7.5px;letter-spacing:.16em;color:rgba(110,150,200,.55)}
.fz3-wave{display:inline-flex;align-items:flex-end;gap:2px;height:11px;margin-left:8px}
.fz3-wave i{display:block;width:2px;height:3px;background:var(--fz3-cyan);box-shadow:0 0 6px var(--fz3-cyan)}
.fz3-wave.on i{animation:fz3-wave .9s ease-in-out infinite}
.fz3-wave i:nth-child(2){animation-delay:.1s}
.fz3-wave i:nth-child(3){animation-delay:.2s}
.fz3-wave i:nth-child(4){animation-delay:.3s}

/* ———————————————————— */
.fz3-voice{
  display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;
  border-radius:50%;border:1px solid transparent;background:transparent;cursor:pointer;
  color:rgba(170,198,228,.72);transition:color .18s ease,background .18s ease,border-color .18s ease,box-shadow .2s ease;
}
.fz3-voice svg{width:15px;height:15px}
.fz3-voice:hover{color:#9ff0ff;background:rgba(87,232,255,.1);border-color:rgba(87,232,255,.35);box-shadow:0 0 16px -6px rgba(87,232,255,.9)}
.fz3-voice[data-state="busy"]{color:var(--fz3-amber);animation:fz3-blink 1.1s steps(2) infinite}
.fz3-voice[data-state="play"]{color:var(--fz3-cyan);text-shadow:0 0 10px var(--fz3-cyan)}

/* ———————————————————— */
.fz3-frame{position:fixed;inset:0;pointer-events:none;z-index:3;border-radius:16px;
  box-shadow:0 0 0 7px rgba(8,6,18,.92),0 0 0 8px rgba(146,126,255,.22),0 0 0 14px rgba(70,50,180,.10),0 24px 70px rgba(0,0,0,.55)}
.fz3-sb-stats{position:fixed;left:12px;bottom:74px;width:258px;padding:10px 12px;border-radius:12px;pointer-events:none;z-index:4;
  background:linear-gradient(180deg,rgba(16,14,34,.94),rgba(11,10,24,.94));border:1px solid rgba(120,110,255,.16);
  box-shadow:0 12px 30px rgba(0,0,0,.45);opacity:0;transition:opacity .6s ease .45s}
.fz3-layer[data-phase="dock"] .fz3-sb-stats{opacity:1}
.fz3-sb-row{display:flex;align-items:baseline;gap:8px;font-size:10px;letter-spacing:.06em;color:rgba(150,164,214,.78)}
.fz3-sb-row b{font-size:12px;font-weight:600;color:#eaf0ff;letter-spacing:.02em}
.fz3-sb-row2{margin-top:7px}
.fz3-sb-row em{margin-left:auto;font-style:normal;font-size:9px;padding:2px 7px;border-radius:6px;
  color:rgba(196,208,255,.9);background:rgba(90,80,190,.22);border:1px solid rgba(130,120,255,.22)}
/* 官方字标是 SVG（没有文本节点）：按 CSS Module 的语义后缀直接隐掉，
   字标由 .fz3-sb-brand 叠加层绘制（隐藏逻辑见下方 ResizeObserver） */
[class*="_brandName"],[class*="_brandMark"]{visibility:hidden!important}

.fz3-sb-brand{position:fixed;left:var(--fz3-brand-left,10px);top:var(--fz3-brand-top,52px);width:262px;height:var(--fz3-brand-h,46px);padding:0 10px;border-radius:11px;display:flex;align-items:center;gap:16px;pointer-events:none;z-index:4;background:transparent;box-shadow:none;border-radius:0;
  opacity:0;transition:opacity .6s ease .35s}
.fz3-layer[data-phase="dock"] .fz3-sb-brand{opacity:1}
/* 侧边栏收起（_collapsed_）时，左上角字标一并隐藏 */
body:has([class*="_collapsed_"]) .fz3-sb-brand{
  opacity:0!important;visibility:hidden!important;pointer-events:none!important;
  transition:opacity .25s ease,visibility 0s linear .25s;
}
.fz3-sb-logo{width:22px;height:22px;flex:0 0 22px;display:block;background:url('/fairy-zzz/assets/brand-zzz.png') center/contain no-repeat}
/* 只让它不可见，不能 display:none：这份 SVG 里的渐变/裁剪定义是页面里第一份副本，
   一旦 display:none，其它副本（dock 眼徽）按 ID 引用会失效，蓝色外圈就没了 */
.fz3-sb-logo svg{visibility:hidden!important}
/* 品牌字标专用：ZZZ 的 SDK_RU_Web（Heavy 拉丁字面），不经系统安装，直接随皮肤加载 */
@font-face{
  font-family:"HDD Brand";
  src:url('/fairy-zzz/assets/brand-heavy.ttf') format('truetype');
  font-weight:100 900;font-style:normal;font-display:swap;
}
.fz3-sb-text{display:flex;flex-direction:column;gap:3px;min-width:0}
.fz3-sb-text b{font-size:19px;font-weight:700;letter-spacing:.02em;color:#f2f5ff;line-height:1;
  font-family:"HDD Brand",var(--fz3-font);font-style:normal}
.fz3-sb-text i{font-style:normal;font-size:8.5px;letter-spacing:.16em;color:rgba(150,168,220,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* 侧边栏文字：黑色描边 + 稍暗的灰色字（只作用于带 _logoRow 的侧栏根节点内） */
[class*="_root_"]:has(> [class*="_logoRow"]),
[class*="_root_"]:has(> [class*="_logoRow"]) *{
  color:#b3bccd!important;
  -webkit-text-stroke:.7px rgba(0,0,0,.88);
  paint-order:stroke fill;
}
/* 品牌字标保持自己的白色，不吃侧栏那套灰字+描边 */
[class*="_root_"]:has(> [class*="_logoRow"]) .fz3-brandname,
[class*="_root_"]:has(> [class*="_logoRow"]) .fz3-brandname *{
  color:#f2f5ff!important;
  -webkit-text-stroke:0!important;
}

/* 新建对话页的 hero 标题行（2026-11-22 按主人要求改）：
   标题「空洞深潜系统」前面的小眼标删掉，改由眼徽本体（.fz3-core）复位到
   标题上方当品牌徽（深浅色都悬在「深潜」两字中心的正上方）—— 定位在下面 FairySkin 的 placeHero 里量标题行算出来的。
   这里只把外层 fishHitbox 收起、插槽组件也不再渲染任何 SVG：
   眼徽是按 id 引用渐变/裁剪的，页面里若有一份 display:none 的 SVG 副本，
   引用会指到不可见的那份，蓝色外圈和光晕就整块消失（侧栏字标当年踩过这个坑）。
   标题与「预览版」徽章没有插槽，文本由 FairySkin 里的定时 effect 改写。 */
[class*="_headline"] [class*="_fishHitbox"]{display:none!important}
.fz3-hero-mark{display:none!important}
[class*="_headline"] [class*="_titleGroup"]>span:first-child{letter-spacing:.06em;text-shadow:0 0 20px rgba(87,232,255,.42)}
html[data-fz3-theme="light"] [class*="_headline"] [class*="_titleGroup"]>span:first-child{text-shadow:0 0 14px rgba(70,110,230,.3)}

.fz3-wave{position:fixed;right:24px;bottom:118px;width:104px;display:flex;flex-direction:column;align-items:center;gap:7px;
  pointer-events:none;z-index:4;opacity:0;transition:opacity .6s ease .5s}
.fz3-layer[data-phase="dock"] .fz3-wave{opacity:1}
.fz3-wave-dot{width:5px;height:5px;border-radius:50%;background:#ff6b8a;box-shadow:0 0 8px rgba(255,107,138,.9);align-self:flex-start;margin-left:6px}
.fz3-wave-bars{display:flex;align-items:center;gap:3px;height:22px;min-height:22px}
.fz3-wave-bars i{display:block;width:4px;height:22px;border-radius:2px;background:linear-gradient(180deg,rgba(196,216,255,1),rgba(108,140,255,.75));
  transform-origin:bottom;animation:fz3-bar 1.05s ease-in-out infinite}
.fz3-wave-bars i:nth-child(1){animation-delay:0s}.fz3-wave-bars i:nth-child(2){animation-delay:.12s}
.fz3-wave-bars i:nth-child(3){animation-delay:.24s}.fz3-wave-bars i:nth-child(4){animation-delay:.06s}
.fz3-wave-bars i:nth-child(5){animation-delay:.3s}.fz3-wave-bars i:nth-child(6){animation-delay:.18s}
.fz3-wave-bars i:nth-child(7){animation-delay:.36s}.fz3-wave-bars i:nth-child(8){animation-delay:.09s}
.fz3-wave-bars i:nth-child(9){animation-delay:.27s}.fz3-wave-bars i:nth-child(10){animation-delay:.15s}
.fz3-wave-bars i:nth-child(11){animation-delay:.33s}.fz3-wave-bars i:nth-child(12){animation-delay:.21s}
@keyframes fz3-bar{0%,100%{transform:scaleY(.28)}50%{transform:scaleY(1)}}
.fz3-wave-slider{position:relative;width:88px;height:10px;border-radius:6px;background:rgba(18,20,44,.92);
  border:1px solid rgba(120,140,255,.18);box-shadow:inset 0 1px 2px rgba(0,0,0,.5)}
.fz3-wave-slider b{position:absolute;left:3px;top:2px;bottom:2px;width:58%;border-radius:5px;
  background:linear-gradient(90deg,rgba(110,90,255,.85),rgba(150,120,255,.55))}
.fz3-wave-slider-2 b{width:34%;background:linear-gradient(90deg,rgba(70,120,255,.8),rgba(120,150,255,.45))}
.fz3-tag{display:none!important}
.fz3-rim{position:fixed;left:-90px;top:-140px;width:560px;height:560px;pointer-events:none;
  background:radial-gradient(closest-side,rgba(126,92,255,.16),rgba(70,60,220,.05) 58%,transparent 76%);filter:blur(8px)}
.fz3-bay{position:fixed;left:50%;bottom:-190px;width:980px;height:400px;transform:translateX(-50%);pointer-events:none;
  background:radial-gradient(closest-side,rgba(74,96,255,.16),rgba(60,50,200,.05) 60%,transparent 78%)}
/* 氛围层：回到 screen 混合 + .42（正常混合会把渐变自身的颜色铺满全屏，
   整片发灰；screen 只加亮，观感才对）。
   性能问题改用「缩放期间临时降级」解决，见下面 fz3-resizing 那组规则。 */
.fz3-atmos{position:fixed;inset:0;z-index:3;pointer-events:none;overflow:hidden;mix-blend-mode:screen;opacity:.42}
.fz3-atmos-frame{position:absolute;inset:9px;border:1px solid rgba(87,232,255,.06)}
.fz3-atmos-frame::before,.fz3-atmos-frame::after{content:"";position:absolute;width:16px;height:16px;border:1px solid rgba(87,232,255,.22)}
.fz3-atmos-frame::before{left:-1px;top:-1px;border-right:0;border-bottom:0}
.fz3-atmos-frame::after{right:-1px;bottom:-1px;border-left:0;border-top:0}
.fz3-atmos-glow{position:absolute;left:-12%;top:-26%;width:64%;height:70%;background:radial-gradient(circle,rgba(70,52,255,.16),transparent 68%);filter:blur(34px);animation:fz3-breathe 14s ease-in-out infinite}
.fz3-atmos-sweep{position:absolute;left:0;right:0;height:130px;background:linear-gradient(180deg,transparent,rgba(87,232,255,.05),transparent);animation:fz3-sweep 13s linear infinite}
.fz3-atmos-flash{position:absolute;right:4%;top:2%;width:34%;height:30%;background:radial-gradient(ellipse at 60% 20%,rgba(120,190,255,.16),transparent 60%);filter:blur(20px);animation:fz3-flash 11s steps(1) infinite}

@keyframes fz3-rot{to{transform:rotate(360deg)}}
@keyframes fz3-rot-rev{to{transform:rotate(-360deg)}}
@keyframes fz3-line{to{opacity:1;transform:none}}
@keyframes fz3-blink{50%{opacity:.3}}
@keyframes fz3-breathe{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}
@keyframes fz3-twinkle{0%,100%{opacity:.15}45%{opacity:.9}55%{opacity:.35}}
@keyframes fz3-wave{0%,100%{height:3px}50%{height:11px}}
@keyframes fz3-sweep{0%{top:-25%}100%{top:115%}}
@keyframes fz3-flash{0%,38%,41%,63%,100%{opacity:.35}39%,40%,64%{opacity:.85}}
@keyframes fz3-panel-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}

@media (max-width:1180px){
  :root{--fz3-dock-size:56px}
}
@media (max-width:820px){
  :root{--fz3-dock-size:42px;--fz3-eye-cy:40vh}
  .fz3-tag{left:calc(var(--fz3-dock-x) + 38px);top:calc(100% - 214px)}
  .fz3-panel{left:12px;width:min(320px,calc(100vw - 24px))}
  .fz3-copy{width:92vw}
  .fz3-copy-title{letter-spacing:.01em}
  .fz3-copy-lines{font-size:clamp(11px,2.55vw,15px);padding:0 18px;line-break:strict}
}
/* 窗口大于 800×400 时眼徽放大（基准 64px → 80px，约 1.25 倍；原来是 96px = 1.5 倍）。
   放大后定位与气泡挂点不用改：JS 读的就是 --fz3-dock-size，
   朗读气泡的偏移也是 calc(var(--fz3-dock-size)/2 + 14px)，会一起放大。 */
@media (min-width:800px) and (min-height:400px){
  :root{--fz3-dock-size:80px}
}
/* 大窗口再放大一档（2026-11-22：窗口 >1600×900 时眼徽变大）。
   实际生效值由 JS 的 eye-shrink 守卫决定（大窗 96 / 常规 64 / 窄窗 48），
   这条只做首帧兜底，两边数值保持一致。 */
@media (min-width:1600px) and (min-height:900px){
  :root{--fz3-dock-size:96px}
}
/* 矮视口：收掉次要行、压字号，保证眼睛与文案都完整在画面内 */
@media (max-height:620px){
  :root{--fz3-eye-cy:40vh}
  .fz3-copy-kicker{display:none}
  .fz3-copy-lines{font-size:clamp(12px,min(1.7vw,2.9vh),18px)}
  .fz3-copy-sub{display:none}
  .fz3-copy-sub.fz3-tap{display:block}
  .fz3-copy-title{margin-bottom:clamp(16px,3.2vh,30px)}
}
@media (max-height:460px){
  :root{--fz3-eye-cy:38vh;--fz3-eye:clamp(96px,min(26vmin,30vh),180px)}
  .fz3-copy-title::after{display:none}
  .fz3-copy-title-zh{display:none}
}

/* ——— 侧边栏「应用」那一排的深浅色切换（本地新增） ———
   尺寸/圆角与官方那排 22px 的小按钮对齐，颜色走宿主 token，
   深浅两种皮肤下都不需要单独配色。 */
.fz3-theme-toggle{
  width:22px;height:22px;flex:none;padding:0;margin-left:2px;
  display:inline-flex;align-items:center;justify-content:center;
  border:0;border-radius:6px;background:transparent;cursor:pointer;
  color:var(--dsw-alias-label-tertiary,rgba(154,164,214,.82));
  transition:background .18s ease,color .18s ease,transform .12s ease;
}
.fz3-theme-toggle:hover{color:var(--dsw-alias-label-primary,#eaf4ff);background:rgba(120,170,255,.14)}
.fz3-theme-toggle:active{transform:scale(.92)}
.fz3-theme-toggle:focus-visible{outline:1px solid rgba(87,232,255,.75);outline-offset:1px}
.fz3-theme-toggle svg{display:block;pointer-events:none}

/* —— 统一底色（放在最后，覆盖前面所有分块规则）——
   凡是加了灰色气泡描边的窗口，底色与透明度都跟聊天输入卡保持一致：
   同一个 --fz3-glass + 同一个模糊变量。以前弹层/消息用的是更实的
   --fz3-glass-menu，看上去比输入框深一档，这里统一掉。 */
button[class*="_newSession"],
[class*="_panelList"],
[class*="GAkraW_root"],
[class*="GRgSLq_card"],
[class*="HOHHba_card"],
[class*="_moreMenu"],
[data-message-bubble],
[class*="j99sVW_card"]{
  background-color:var(--fz3-glass)!important;
  background-image:none!important;
  -webkit-backdrop-filter:var(--fz3-glass-filter,blur(var(--fz3-glass-blur)) saturate(125%))!important;
  backdrop-filter:var(--fz3-glass-filter,blur(var(--fz3-glass-blur)) saturate(125%))!important;
}

/* —— 全局字重加粗（对齐主人给的样张）——
   两个旋钮：
     --fz3-ui-weight  字重，默认 600（样张大约在 600~700 之间）
     --fz3-ui-stroke  描边补厚，默认 0.15px（0.06 太细、0.22 偏粗，取中间）；它只压粗笔画、不改变字距，
                      比直接上 800 更不容易把布局挤乱
   觉得不够厚就把 weight 提到 700，或把 stroke 提到 0.25px。 */
:root{
  --fz3-ui-weight:600;
  --fz3-ui-stroke:0;
}
body,body *{
  font-weight:var(--fz3-ui-weight)!important;
  /* 不再用 text-stroke：描边在深色底上会让边缘发毛，就是“糊”的原因 */
  -webkit-text-stroke:0!important;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}

/* —— 文字亮度过高一档：把主/次/三级文字的 token 各压暗一点点 ——
   宿主把正文几乎都用 #fff 这类最亮值，长时间看发刺眼。
   这里覆盖四个 label token，用 !important 压过宿主写在 html 上的内联值。
   2026-11-22 主人要求"白字再调暗一点"：四个值整体再降一档
   （primary #e6e6e6→#c9c9c9）。想更暗就继续调小，想回上一版：
   #e6e6e6 / #c8c8c8 / #a6a6a6 / #8d8d8d。 */
:root{
  --dsw-alias-label-primary:#c9c9c9!important;
  --dsw-alias-label-secondary:#b0b0b0!important;
  --dsw-alias-label-tertiary:#969696!important;
  --dsw-alias-label-caption:#7f7f7f!important;
}

/* —— 性能：消息气泡不再做背景模糊 ——
   backdrop-filter 会给每个应用它的元素单独建合成层，侧栏开合、窗口缩放时
   每个气泡都要重算一次模糊，几十条消息直接掉帧。
   底色保持不变（仍是 --fz3-glass，视觉几乎看不出差别），只去掉模糊。 */
[data-message-bubble]{
  -webkit-backdrop-filter:none!important;
  backdrop-filter:none!important;
}

/* —— 侧栏开合动画期间临时关掉毛玻璃 ——
   宽度过渡时这几块每帧都要重算 backdrop-filter，是收起/展开掉帧的主要来源。
   宿主在动画期间会给祖先挂 data-animating，借它做“动画期无模糊、结束后恢复”。 */
[data-animating] button[class*="_newSession"],
[data-animating] [class*="_panelList"],
[data-animating] [class*="GAkraW_root"],
[data-animating] [class*="GRgSLq_card"]{
  -webkit-backdrop-filter:none!important;
  backdrop-filter:none!important;
}

/* —— 眼徽的发光：用 box-shadow 替换 drop-shadow ——
   drop-shadow 要按 alpha 轮廓逐帧重算，眼徽又有眨眼/呼吸动画（SVG 内容每帧变化），
   每次变化都要重新光栅化一层 26px 的模糊；换成圆形容器上的 box-shadow 后
   是静态阴影，动画期间不再重算。观感几乎一致（眼徽本身就是圆形轮廓）。 */
.fz3-eye{
  border-radius:50%!important;
  filter:none!important;
  box-shadow:0 0 26px rgba(52,96,240,.42);
}

/* —— 把「问好阶段」用的全屏层在常态下彻底移出绘制 ——
   .fz3-screen 里有一层 filter:blur(14px) 的全屏背景图，外加一个铺满视口的
   backdrop-filter:blur(12px)（.fz3-hero::after）。即使 opacity:0，Chromium 仍会
   为它们维护合成层并参与每帧合成 —— 缩放窗口、开合侧栏时的掉帧与“先黑一下”
   主要是这一层造成的。进入 dock 后用 visibility 延迟隐藏，并清掉两个滤镜。 */
.fz3-layer[data-phase="dock"] .fz3-screen{
  opacity:0!important;
  filter:none!important;
  visibility:hidden!important;
  transition:opacity 1.25s ease,visibility 0s linear 1.25s;
}
.fz3-layer[data-phase="dock"] .fz3-hero,
.fz3-layer[data-phase="dock"] .fz3-hero::after,
.fz3-layer[data-phase="dock"] .fz3-veil{
  filter:none!important;
  -webkit-backdrop-filter:none!important;
  backdrop-filter:none!important;
}

/* —— 窗口缩放期间：停掉眼徽的过渡与动画 ——
   眼徽有 left/top/width 各 1.35s 的过渡，窗口一变它就连续重绘 1 秒多；
   再加上呼吸/扫描等循环动画，正好和窗口自身的重排抢合成器，
   表现就是“窗口先黑一下、过一会儿才适配”。
   fz3-resizing 由 resize 监听挂上，120ms 后自动摘掉。 */
html.fz3-resizing .fz3-core{transition:none!important}
html.fz3-resizing .fz3-eye-halo,
html.fz3-resizing .fz3-eye-ring,
html.fz3-resizing .fz3-eye-svg *,
html.fz3-resizing .fz3-gline,
html.fz3-resizing .fz3-eye-scan{animation-play-state:paused!important}
/* 缩放期间把氛围层降级成普通混合：整屏 screen 混合组在窗口重排时
   最容易导致「局部没画出来」；锚定完成后立即恢复。 */
html.fz3-resizing .fz3-atmos{
  mix-blend-mode:normal!important;
  opacity:.12!important;
}
/* 缩放/最大化期间临时关掉面板磨砂：backdrop-filter 每次重排都要重新采样背景，
   几个面板一起就是明显卡顿与「局部没画出来」。外壳稳定后再恢复。 */
html.fz3-resizing [class*="_newSession"],
html.fz3-resizing [class*="_panelList"],
html.fz3-resizing [class*="GAkraW_root"],
html.fz3-resizing [class*="GRgSLq_card"]{
  -webkit-backdrop-filter:none!important;
  backdrop-filter:none!important;
}

/* —— 背景装饰层：去掉两处隐藏得很深的性能杀手 ——
   ① .fz3-atmos-glow 是 64%×70% 视口大小的一块层，带着 filter:blur(34px)。
      它本身只是一张径向渐变，渐变已经是柔和的，34px 模糊纯属浪费；
      而且它还在 14s 循环缩放着 —— 等于每帧都在重算半屏模糊。
   ② .fz3-atmos-sweep 的动画改的是 top（布局属性），一条铺满宽度的光带
      每帧触发一次重排。改成 transform 位移，只走合成，不再碰布局。
   ③ .fz3-atmos-flash 同样是渐变 + blur(20px)，同样去掉模糊。
   三条都不改变观感：渐变自带柔边，位移换成 transform 后轨迹一致。 */
.fz3-atmos-glow{filter:none!important}
/* .fz3-atmos-flash{filter:none!important} —— 元素已移除，规则一并停用 */
.fz3-atmos-sweep{
  top:0!important;
  animation:fz3-sweep-t 13s linear infinite!important;
}
@keyframes fz3-sweep-t{
  0%{transform:translateY(-25vh)}
  100%{transform:translateY(115vh)}
}

/* —— 补回被去掉模糊后“涨”上来的亮度 ——
   上一轮为了性能去掉了 .fz3-atmos-glow / -flash 的 blur()。
   那层模糊原本把光晕摊开、边缘淡掉，去掉之后同样强度的渐变会显得更集中、更亮，
   整片界面因此看着发白。这里把装饰层整体压暗一档来还原原来的观感：
   模糊是“摊开”，降低 opacity 是“减亮”，两者在视觉上等价，但后者不花性能。
   想更暗就继续调小（.35 / .25）。 */
/* 氛围层：回到 17:38 那版的 .42（当时"灰蒙蒙"的真凶是 Windows 亚克力，不是它）。
   想更亮：.42 → .55 / .75（上游内联值）；想更淡：.42 → .25。 */
.fz3-atmos{opacity:.42!important}

/* ============================================================
   Fairy 主题 · 覆盖层（整理版）
   ------------------------------------------------------------
   基础皮肤（上面的规则）保持不动；这里只放"本机定制"的部分。
   分成四组：① 通用  ② 深色  ③ 浅色  ④ 组件细节
   所有需要压过基础规则的声明都带 !important；
   需要压过"带 html[data-fz3-theme] 前缀"的旧规则时，这里也带同前缀。
   ============================================================ */

/* ========== ① 通用 ========== */

/* 眼徽：去掉 box-shadow，只留圆形光晕（方形盒子画阴影会变成圆角矩形） */
.fz3-eye{
  filter:none !important;
  box-shadow:none !important;
  border:none !important;
  background:none !important;
}

/* 圆角档位（iOS 风格；具体数值由 JS 按高度动态覆盖，这里只是兜底） */
:root{
  --fz3-r-sm:12px;
  --fz3-r-md:24px;
  --fz3-r-lg:20px;
  --fz3-light-bg:#d6e4ff;
}

/* 品牌行：整体居中 + 横向偏移 */
:root{ --fz3-brand-shift:-20px; }
.fz3-sb-brand{
  justify-content:center !important;
  padding-left:0 !important;
  padding-right:0 !important;
  transform:translateX(var(--fz3-brand-shift,-20px)) !important;
}

/* 气泡：圆角 + 细边（不再用 5px 粗边） */
.fz3-bubble{
  border-radius:16px !important;
  border:4px solid #cfd4dd !important;
}
/* 气泡标题：留在气泡内、与键名列左对齐 */
.fz3-bubble .fz3-bubble-head{
  position:static !important;
  transform:none !important;
  display:block !important;
  margin:0 0 8px 0 !important;
  padding:0 !important;
  border:0 !important;
  border-radius:0 !important;
  background:transparent !important;
  text-align:left !important;
  letter-spacing:.14em !important;
  text-transform:uppercase !important;
}
/* 气泡文字：键黑、值灰 */
html[data-fz3-theme] .fz3-bubble-head,
html[data-fz3-theme] .fz3-bubble-k{ color:#000 !important; }
html[data-fz3-theme] .fz3-bubble-v,
html[data-fz3-theme] .fz3-bubble-v b,
html[data-fz3-theme] .fz3-peak-clock,
html[data-fz3-theme] .fz3-peak-clock[data-tone="peak"],
html[data-fz3-theme] .fz3-peak-badge{
  color:#9aa0aa !important;
  border-bottom-color:rgba(154,160,170,.55) !important;
}

/* 左上角直角 */
[class*="_frame"],
[class*="_frame"]::before,
[class*="_sidebarCol"],
[class*="_centerCol"]{
  border-radius:0 !important;
  corner-shape:round !important;
}

/* ========== ② 深色 ========== */

/* 窗口外壳统一成页面底，避免输入区周围出现比页面略亮的矩形 */
body[data-ds-dark-theme] [data-windows-titlebar] [class*="_frame"],
body[data-ds-dark-theme] [data-windows-titlebar] [class*="_frame"]::before,
body[data-ds-dark-theme] [class*="_sidebarCol"],
body[data-ds-dark-theme] [class*="_centerCol"],
body[data-ds-dark-theme] [data-slot="conversation.content"],
body[data-ds-dark-theme] [data-conversation-scroll]{
  background-color:#080a12 !important;
  background-image:none !important;
  border:0 !important;
  box-shadow:none !important;
}

/* 输入区外壳：不画底色（元素保留，负责布局） */
body[data-ds-dark-theme] [class*="GRgSLq_dock"],
body[data-ds-dark-theme] [class*="GRgSLq_root"],
body[data-ds-dark-theme] [data-slot="conversation.composer"],
body[data-ds-dark-theme] [data-slot="conversation.composer.bar"],
body[data-ds-dark-theme] [data-slot="conversation.composer.dock"],
body[data-ds-dark-theme] [data-slot="conversation.input.dock"]{
  background:none !important;
  background-color:transparent !important;
  background-image:none !important;
  border:0 !important;
  box-shadow:none !important;
}

/* 深色气泡：深玻璃 + 浅字 */
body[data-ds-dark-theme] .fz3-bubble{ background:rgba(18,20,26,.86) !important; }
body[data-ds-dark-theme] .fz3-bubble-head,
body[data-ds-dark-theme] .fz3-bubble-k{ color:#e6e6e6 !important; }

/* ========== ③ 浅色 ========== */

/* 设计变量
   2026-11-22 补 body 兜底选择器：这套浅色变量只挂在 html[data-fz3-theme="light"]
   上时，主题判定一旦没把属性写对（或宿主切主题还没同步），浅色界面下气泡就会
   继续用 :root 里那套深色 --fz3-glass，在白底上糊成一块灰。宿主自己的深浅信号
   是 body 上的 data-ds-dark-theme（深色有、浅色没有），跟着它走更稳。 */
/* —— 浅色模式文字灰阶（主人 2026-11-23 指定）——
   五档灰，按语义挂到宿主的 label token 上，浅色下所有文字都从这张表取：
     深灰   #333333  清晰、稳重，最推荐      → 标题 / 加粗 / 按钮 / 输入文字
     中灰   #666666  低调、简洁              → 列表 / 次级 / 时间戳（正文已另定为 #999999）
     浅灰   #888888  比较轻，适合辅助文字    → 说明 / 占位提示
     淡灰   #AAAAAA  仅适合次要标注          → 宿主自用的归档行（本皮肤不覆盖）
   （#444444 一档现在不再用作正文，仍保留在主人给的表里备用。）
   只改这一处 + 下面这六行变量；dsh-chat-tone 里同一套灰阶见
   dsh-chat-tone/client.js「七、浅色模式」。深色模式一个字节不动。 */
html[data-fz3-theme="light"],
body:not([data-ds-dark-theme]){
  --fz3-glass:rgba(255,255,255,.78) !important;
  --fz3-glass-hover:rgba(246,249,255,.9) !important;
  --fz3-glass-menu:#ffffff !important;
  --fz3-edge:#dfe3ea !important;
  --fz3-edge-deep:#eef1f6 !important;
  --fz3-text:#151b2f !important;
  --fz3-mute:#666666 !important;
  --ct-body:#999999 !important;
  --dsw-alias-label-primary:#999999 !important;
  --dsw-alias-label-secondary:#999999 !important;
  --dsw-alias-label-tertiary:#666666 !important;
  --dsw-alias-label-caption:#888888 !important;
  color-scheme:light !important;
}

/* 浅色下的消息气泡：白玻璃 + 浅灰描边，别再用深色玻璃
   文字跟着灰阶走：气泡里的正文 = #999999（主人 2026-11-23 指定，
   比五档灰阶里的正文 #666666 更浅；标题/列表/提示仍走原灰阶）。 */
body:not([data-ds-dark-theme]) [data-message-bubble]{
  background-color:rgba(255,255,255,.92) !important;
  background-image:none !important;
  border-color:#dfe3ea !important;
  color:#999999 !important;
}

/* 背景：纯浅蓝，无渐变、无网格 */
html[data-fz3-theme="light"] body::before,
body:not([data-ds-dark-theme]) body::before{
  background-color:var(--fz3-light-bg) !important;
  background-image:none !important;
  opacity:1 !important;
  filter:none !important;
}
html[data-fz3-theme="light"] body::after{
  background:var(--fz3-light-bg) !important;
  background-image:none !important;
}

/* ============================================================
   浅色背景：宿主那只"翻越鲸鱼" → 直接用深色那段 ZZZ 视频
   ------------------------------------------------------------
   鲸鱼是宿主品牌包 @deepseek-ai/dsh-client-ui-brand-official 的
   <canvas data-home-whale>（PixelWhale），浅色下隐藏。
   ZZZ 标不再用静态图复刻 —— 静态图补不出那块立体板的厚度与光影，
   直接复用深色已在用的 .fz3-videobg（assets/zzz-logo-bg.mp4，实测 5s 一圈）：
     filter:invert(1)          白板→黑板、黑底→白底，适配浅色底
     mix-blend-mode:multiply   反相后的白底叠在底色上等于透明，
                               只留下黑色 ZZZ 标，页面底色仍由 body::after 提供
   想调浓淡：改 opacity；不想要就整段删掉（视频会回到浅色隐藏）。
   ============================================================ */
html[data-fz3-theme="light"] canvas[data-home-whale],
body:not([data-ds-dark-theme]) canvas[data-home-whale]{
  display:none !important;
}
/* 浅色专用的 ZZZ 视频：由 JS 插进中间栏（文字区域）里，不是整窗固定层。
   定位/层级和宿主那只鲸鱼 canvas 一致 —— absolute inset:0 + z-index:-1，
   落在"栏目底色之上、正文之下"。中间栏必须成为包含块与独立层叠上下文，
   这条负 z-index 才稳定（否则会跑到整页背景后面去）。
   2026-11-23 1.0.18：invert(1) 也不再实时套了 —— 浅色改吃 assets/
   zzz-logo-bg-light.mp4（negate 烘进素材），运行时只剩 opacity + multiply。
   multiply 得留着：反相后的白底要靠它融进页面底色。 */
.fz3-logo-video{
  position:absolute !important;
  inset:0 !important;
  width:100% !important;
  height:100% !important;
  object-fit:cover !important;
  pointer-events:none !important;
  z-index:-1 !important;
  display:none !important;
  opacity:0 !important;
}
html[data-fz3-theme="light"] .fz3-logo-video,
body:not([data-ds-dark-theme]) .fz3-logo-video{
  display:block !important;
  opacity:.3 !important;
  filter:none !important;
  mix-blend-mode:multiply !important;
}
html[data-fz3-theme="light"] [class*="_centerCol"],
body:not([data-ds-dark-theme]) [class*="_centerCol"]{
  position:relative !important;
  isolation:isolate !important;
}
html[data-fz3-theme="light"],
html[data-fz3-theme="light"] body,
html[data-fz3-theme="light"] [data-windows-titlebar] [class*="_frame"],
html[data-fz3-theme="light"] [data-windows-titlebar] [class*="_frame"]::before,
html[data-fz3-theme="light"] [class*="_sidebarCol"],
html[data-fz3-theme="light"] [class*="_centerCol"],
body:not([data-ds-dark-theme]),
body:not([data-ds-dark-theme]) [data-windows-titlebar] [class*="_frame"],
body:not([data-ds-dark-theme]) [data-windows-titlebar] [class*="_frame"]::before,
body:not([data-ds-dark-theme]) [class*="_sidebarCol"],
body:not([data-ds-dark-theme]) [class*="_centerCol"]{
  background-color:var(--fz3-light-bg) !important;
  background-image:none !important;
}

/* 氛围层：浅色下关掉（否则整片发灰） */
html[data-fz3-theme="light"] .fz3-atmos,
body:not([data-ds-dark-theme]) .fz3-atmos{
  opacity:0 !important;
}

/* 面板与输入卡片：白玻璃 */
html[data-fz3-theme="light"] button[class*="_newSession"],
html[data-fz3-theme="light"] [class*="_panelList"],
html[data-fz3-theme="light"] [class*="GAkraW_root"],
html[data-fz3-theme="light"] [class*="GRgSLq_card"],
body:not([data-ds-dark-theme]) button[class*="_newSession"],
body:not([data-ds-dark-theme]) [class*="_panelList"],
body:not([data-ds-dark-theme]) [class*="GAkraW_root"],
body:not([data-ds-dark-theme]) [class*="GRgSLq_card"]{
  background-color:rgba(255,255,255,.78) !important;
  background-image:none !important;
  border-color:#dfe3ea !important;
  -webkit-backdrop-filter:blur(22px) saturate(1.1) !important;
  backdrop-filter:blur(22px) saturate(1.1) !important;
}

/* 输入区外壳：不画底色 */
html[data-fz3-theme="light"] [class*="GRgSLq_dock"],
html[data-fz3-theme="light"] [class*="GRgSLq_root"],
html[data-fz3-theme="light"] [data-slot="conversation.composer"],
html[data-fz3-theme="light"] [data-slot="conversation.composer.bar"],
html[data-fz3-theme="light"] [data-slot="conversation.composer.dock"],
html[data-fz3-theme="light"] [data-slot="conversation.input.dock"],
body:not([data-ds-dark-theme]) [class*="GRgSLq_dock"],
body:not([data-ds-dark-theme]) [class*="GRgSLq_root"],
body:not([data-ds-dark-theme]) [data-slot="conversation.composer"],
body:not([data-ds-dark-theme]) [data-slot="conversation.composer.bar"],
body:not([data-ds-dark-theme]) [data-slot="conversation.composer.dock"],
body:not([data-ds-dark-theme]) [data-slot="conversation.input.dock"]{
  background:none !important;
  background-color:transparent !important;
  background-image:none !important;
  border:0 !important;
  box-shadow:none !important;
}

/* 浅色气泡：白底 + 灰边 */
html[data-fz3-theme="light"] .fz3-bubble,
body:not([data-ds-dark-theme]) .fz3-bubble{
  background:#fff !important;
  background-image:none !important;
  border-color:#cfd4dd !important;
  box-shadow:none !important;
}

/* 品牌：浅色下 Z 字反相成黑色 + 白边 */
html[data-fz3-theme="light"] .fz3-sb-logo{
  filter:invert(1) drop-shadow(0 0 .6px #fff) drop-shadow(0 0 1.2px #fff) drop-shadow(0 0 1.8px #fff) !important;
}
html[data-fz3-theme="light"] .fz3-sb-text b,
html[data-fz3-theme="light"] .fz3-brandname b{
  color:#0f1730 !important;
}

/* ========== ④ 组件细节 ========== */

/* 开屏层在 dock 阶段彻底摘掉（带 backdrop-filter 的元素即使 opacity:0 仍参与合成） */
.fz3-layer[data-phase="dock"] .fz3-screen,
.fz3-layer[data-phase="dock"] .fz3-bg,
.fz3-layer[data-phase="dock"] .fz3-hero,
.fz3-layer[data-phase="dock"] .fz3-veil{
  display:none !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
  filter:none !important;
}



/* ========== 气泡：排版 + 尾巴（补） ========== */
/* 每行「键 …… 值」两端对齐：键靠左、值靠右 */
.fz3-bubble-row{
  display:flex !important;
  align-items:baseline !important;
  justify-content:space-between !important;
  width:100% !important;
  gap:12px !important;
}
.fz3-bubble-k{ flex:0 0 auto !important; text-align:left !important; }
.fz3-bubble-v{ flex:0 0 auto !important; margin-left:auto !important; text-align:right !important; }
.fz3-bubble-head{ text-align:left !important; }

/* 尾巴：跟气泡同色、同边宽（基础规则里是 #000 + 5px，太重） */
.fz3-bubble::after{
  background:#ffffff !important;
  border-left:4px solid #cfd4dd !important;
  border-bottom:4px solid #cfd4dd !important;
}
/* 深色下尾巴用深色玻璃 + 同色描边 */
body[data-ds-dark-theme] .fz3-bubble::after{
  background:rgba(18,20,26,.86) !important;
  border-left-color:#595959 !important;
  border-bottom-color:#595959 !important;
}


/* 深色气泡：灰边（和皮肤其它面板一致的 #595959） */
body[data-ds-dark-theme] .fz3-bubble{
  border:4px solid #595959 !important;
  background:rgba(18,20,26,.86) !important;
}
body[data-ds-dark-theme] .fz3-bubble::after{
  border-left:4px solid #595959 !important;
  border-bottom:4px solid #595959 !important;
}


/* ========== 气泡底：加毛玻璃，挡住下面文字 ========== */
/* 浅色：白底提到 .97 + 18px 模糊，背后的正文不会透上来 */
.fz3-bubble{
  -webkit-backdrop-filter:blur(18px) saturate(1.2) !important;
  backdrop-filter:blur(18px) saturate(1.2) !important;
}
html[data-fz3-theme="light"] .fz3-bubble,
body:not([data-ds-dark-theme]) .fz3-bubble{
  background:rgba(255,255,255,.97) !important;
  background-image:none !important;
}
body[data-ds-dark-theme] .fz3-bubble{
  background:rgba(16,18,24,.94) !important;
  background-image:none !important;
}


/* ========== 深色底：改成纯黑 #000 ========== */
:root{ --fz3-dark-bg:#000000; }

html[data-fz3-theme="dark"],
html[data-fz3-theme="dark"] body,
body[data-ds-dark-theme],
body[data-ds-dark-theme] [data-windows-titlebar] [class*="_frame"],
body[data-ds-dark-theme] [data-windows-titlebar] [class*="_frame"]::before,
body[data-ds-dark-theme] [class*="_sidebarCol"],
body[data-ds-dark-theme] [class*="_centerCol"],
body[data-ds-dark-theme] [data-slot="conversation.content"],
body[data-ds-dark-theme] [data-conversation-scroll]{
  background-color:var(--fz3-dark-bg) !important;
  background-image:none !important;
}
/* 背景大层也压成纯黑（原来是一段深蓝渐变） */
html[data-fz3-theme="dark"] body::after{
  background:var(--fz3-dark-bg) !important;
  background-image:none !important;
}


/* ========== 深色侧栏：面板也压成黑 ========== */
/* 侧栏列本身已 #000；这里把里面的面板（新会话 / 插件组 / 工作区组）
   从炭灰 rgba(42,42,46,.62) 改成半透明黑，保持层次但整体是黑的。 */
body[data-ds-dark-theme] button[class*="_newSession"],
body[data-ds-dark-theme] [class*="_panelList"],
body[data-ds-dark-theme] [class*="GAkraW_root"],
body[data-ds-dark-theme] [class*="GRgSLq_card"]{
  background-color:rgba(0,0,0,.62) !important;
  background-image:none !important;
  border-color:#595959 !important;
}


/* ========== 深色：删掉星空图 ========== */
/* body::before 原本是星空底图（brightness 2.9 提亮）。
   纯黑方案不需要它，直接不绘制 —— 注意用 opacity/背景置空，
   不要用 display:none（那份 SVG 里可能有被其它元素按 ID 引用的定义）。 */
html[data-fz3-theme="dark"] body::before,
body[data-ds-dark-theme] body::before{
  background:none !important;
  background-image:none !important;
  opacity:0 !important;
  filter:none !important;
}


/* ========== 深色：删掉氛围层 ========== */
/* .fz3-atmos 是铺满视口的 screen 混合层（光斑 / 扫描带 / 角标），
   关掉后深色就是纯黑一块，不再有任何冷光叠加。 */
html[data-fz3-theme="dark"] .fz3-atmos,
body[data-ds-dark-theme] .fz3-atmos{
  opacity:0 !important;
  mix-blend-mode:normal !important;
}


/* ========== 深色：设计变量也改成纯黑 ========== */
/* 插件启动时会写入一套 --dsw-* 变量（偏蓝的深色）：
     --dsw-alias-bg-base        rgba(8,10,18,.88)
     --dsw-specific-sidebar-fill rgba(9,11,20,.9)
   宿主很多组件（侧栏列、面板、分隔）直接用这些变量取色，
   所以只改具体元素不够 —— 侧栏仍会泛蓝。这里把变量本身改掉。 */
html[data-fz3-theme="dark"],
body[data-ds-dark-theme]{
  --dsw-alias-bg-base:#000000 !important;
  --dsw-specific-sidebar-fill:#000000 !important;
}


/* ========== 圆角：固定值（2026-11-22 实测） ========== */
/* 原动态公式：r = 高度 ≤44 ? 高度/2 : 高度×0.23（夹在 6~36）。
   按当时的实际高度换算，得到下面这组固定值：
     新会话按钮   高 34  → 17      （胶囊 = 高度一半）
     面板组       高 110 → 25      （110 × 0.23）
     输入卡片     高 90  → 21      （90 × 0.23）
     用量气泡     高 105 → 24      （105 × 0.23）
   想整体放大/缩小：把四个值一起乘一个系数即可。 */
button[class*="_newSession"]{ border-radius:17px !important; }
[class*="_panelList"],
[class*="GAkraW_root"]{ border-radius:25px !important; }
[class*="GRgSLq_card"]{ border-radius:21px !important; }
.fz3-bubble{ border-radius:24px !important; }


/* ========== 消息气泡：圆角更圆 ========== */
/* 宿主给用户消息容器打了 data-message-bubble，是稳定钩子。
   基类用的是 14px，这里提到 22px，观感更接近聊天气泡。 */
[data-message-bubble]{
  border-radius:22px !important;
}


/* ========== 开屏：去掉背景图，改成毛玻璃 ========== */
/* 原来 .fz3-screen / .fz3-bg 是黑底 + greet-bg.webp。
   现在全部置空，只留一层 blur —— 开屏期间看到的是"被磨砂的界面"。
   注意：全屏 backdrop-filter 超过 40px 会让 Chromium 渲染异常（80px 会白屏），
   所以这里用 24px。 */
.fz3-screen{
  background:transparent !important;
  background-image:none !important;
}
.fz3-bg{
  background:transparent !important;
  background-image:none !important;
  display:none !important;
}
.fz3-hero{ background:transparent !important; }

/* 浅色开屏：补一层"有色块起伏"的底，否则磨砂看不出来。
   原因：开屏的模糊来自 .fz3-layer[data-phase="greet"] 的 backdrop-filter，
   它只能糊"背后"的东西。深色背后有 ZZZ 背景视频，糊出来是可见的色块；
   浅色背后是 body::after 那片纯浅色渐变（不透明），糊白还是白，于是
   「开屏问候背景没有模糊效果」。随包的 greet-bg.webp 是近黑的星尘图
   （均值 RGB 18,19,23），拿它当浅色底会变黑，所以这里用浅色系渐变色块
   自绘，交给 .fz3-hero 自带的 filter:blur() 糊开，得到和深色同构的磨砂层次。
   注意：1.0.6 里 .fz3-veil 只有 CSS、没有对应 DOM 节点（全文件搜不到元素创建），
   所以那套「白雾 + 噪点 + 暗角」实际从未渲染 —— 白雾这里直接并入 .fz3-hero 的
   背景栈最顶层，不再依赖 .fz3-veil。 */
html[data-fz3-theme="light"] .fz3-hero,
body:not([data-ds-dark-theme]) .fz3-hero{
  /* 放大出血：30px 模糊会在边缘采到透明像素，不留 bleed 会出现一圈发白的边 */
  inset:-8% !important;
  background:
    linear-gradient(rgba(255,255,255,.34),rgba(255,255,255,.34)),
    radial-gradient(44% 38% at 22% 26%,#c9d9ff 0%,rgba(201,217,255,0) 62%),
    radial-gradient(38% 34% at 78% 22%,#ffdfec 0%,rgba(255,223,236,0) 64%),
    radial-gradient(50% 44% at 62% 82%,#cdeeff 0%,rgba(205,238,255,0) 66%),
    linear-gradient(160deg,#f7faff,#eaf0ff 58%,#f2f6fd) !important;
  filter:brightness(1) saturate(1.06) blur(30px) !important;
}

/* 磨砂层：浅色用白雾，深色用黑雾，都带模糊 */
.fz3-veil{
  background:transparent !important;
  background-image:none !important;
  -webkit-backdrop-filter:blur(24px) saturate(1.05) !important;
  backdrop-filter:blur(24px) saturate(1.05) !important;
}
html[data-fz3-theme="light"] .fz3-veil,
body:not([data-ds-dark-theme]) .fz3-veil{
  background:rgba(255,255,255,.22) !important;
}
html[data-fz3-theme="dark"] .fz3-veil,
body[data-ds-dark-theme] .fz3-veil{
  background:rgba(0,0,0,.28) !important;
}


/* ========== 开屏：加磨砂颗粒感 ========== */
/* 纯 blur 只是"糊"，没有"砂"的质感。这里叠一层极细的噪点（SVG feTurbulence
   生成，不占素材文件），再用 overlay 混合，做出磨砂玻璃的颗粒。
   噪点太强会像电视雪花，.26 是保守值。 */
.fz3-veil{
  -webkit-backdrop-filter:blur(28px) saturate(1.08) !important;
  backdrop-filter:blur(28px) saturate(1.08) !important;
}
.fz3-veil::after{
  content:"" !important;
  position:absolute !important;
  inset:0 !important;
  pointer-events:none !important;
  opacity:.26 !important;
  mix-blend-mode:overlay !important;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>") !important;
  background-size:160px 160px !important;
  background-repeat:repeat !important;
}


/* ========== 开屏：重模糊（接近系统"模糊壁纸"观感） ========== */
/* 参考的是 Win11 那种"壁纸被糊成色块"的效果。
   注意 Chromium 的坑：全屏 backdrop-filter 超过 ~40px 会渲染异常（80px 直接白屏），
   所以 blur 顶到 36px，靠下面两层补偿"厚度"：
     1. 更大的 saturate（颜色更浓，像糊开的色块）
     2. 一层柔和暗角，模拟光在玻璃里扩散
   想要更糊只能牺牲性能用 scale 放大法，先看这版够不够。 */
.fz3-veil{
  -webkit-backdrop-filter:blur(6px) saturate(1.03) brightness(1.005) !important;
  backdrop-filter:blur(6px) saturate(1.03) brightness(1.005) !important;
}
/* 暗角 + 中心提亮：让糊开的色块有"纵深" */
.fz3-veil::before{
  content:"" !important;
  position:absolute !important;
  inset:0 !important;
  pointer-events:none !important;
  background:
    radial-gradient(120% 90% at 50% 38%,transparent 38%,rgba(0,0,0,.18) 100%) !important;
}


/* ========== 开屏：模糊挂在最外层 ========== */
/* 之前挂在 .fz3-veil 上完全没效果 —— 因为 .fz3-screen 有 transition:filter，
   带 filter 的祖代会截断 backdrop-filter 的取样范围（只模糊祖先内部）。
   改成挂在 .fz3-layer 上（最外层，fixed + inset:0，覆盖整个窗口），
   并且只在 greet 阶段生效，dock 之后立刻取消，不影响日常使用。 */
.fz3-layer[data-phase="greet"]{
  -webkit-backdrop-filter:blur(3px) saturate(1.02) brightness(1.003) !important;
  backdrop-filter:blur(3px) saturate(1.02) brightness(1.003) !important;
}
/* 内层保持透明，避免挡住这层模糊 */
.fz3-layer[data-phase="greet"] .fz3-screen{
  -webkit-backdrop-filter:none !important;
  backdrop-filter:none !important;
  filter:none !important;
}
.fz3-layer[data-phase="greet"] .fz3-veil{
  -webkit-backdrop-filter:none !important;
  backdrop-filter:none !important;
  filter:none !important;
}


/* ========== 深色动态背景：ZZZ Logo 循环视频（仅深色） ========== */
/* 浅色完全不参与：opacity 恒为 0，也不做任何铺底改动。 */
/* 2026-11-22 修「开屏问候玻璃层未关闭」：
   这条视频原来挂在 shell.overlay 槽里。shell.overlay 这一整块容器本身就压在
   客户端内容上面，所以 z-index:-2 只是让它在自己容器内部垫底，整块视频仍然
   盖在界面上 —— 黑底视频 + opacity .62 就等于给整个界面糊了一层"墨镜"，
   而且和开屏无关、一直不退场。
   现在改成真正的背景：由 apply() 把 video 插进 <body> 开头、z-index:-1，
   落在所有内容后面（见下面让 body 让出底色的两条规则）。 */
/* 2026-11-23 1.0.18：这里原来挂着 filter:brightness(.62) saturate(.95)。
   一条铺满整窗、正在播放的视频套 filter，等于每帧多一次全屏滤镜 pass，而且
   让它彻底上不了合成器的直出路径 —— 主人反馈的「旋转背景偶尔卡住」就是这里
   最贵的一笔。滤镜本身没有"实时"的必要：亮度/饱和是固定值，已经烘进
   assets/zzz-logo-bg.mp4（ffmpeg lutrgb ×0.62 + eq saturation .95），
   运行时只留 opacity，画面观感和 .62 滤镜版一致。 */
.fz3-videobg{
  position:fixed !important;
  inset:0 !important;
  width:100% !important;
  height:100% !important;
  object-fit:cover !important;
  pointer-events:none !important;
  z-index:-1 !important;
  opacity:0 !important;
  filter:none !important;
}
html[data-fz3-theme="dark"] .fz3-videobg,
body[data-ds-dark-theme] .fz3-videobg{
  /* 2026-11-22 主人要求"再淡一点"：.62 → .38（约原来的六成）。
     再淡：调到 .28 / .22；想恢复原样：.62。 */
  opacity:.38 !important;
}
/* 视频要当背景，body 就得让出底色：z-index:-1 的元素会被 body 自己的
   background 盖住（body 背景在绘制顺序里晚于负 z-index 子元素）。
   把底色交给 html（同一个 #080a12），视频就落在"底色之上、内容之下"。
   同时关掉 body::before —— 那张 greet-bg 图本来被 body 底色挡着，
   body 一变透明它就会露出来，而且它带 brightness(2.9)，会发白。 */
html:not([data-fz3-theme="light"]) body[data-ds-dark-theme],
html[data-fz3-theme="dark"] body{
  background:transparent !important;
  background-image:none !important;
}
html:not([data-fz3-theme="light"]) body[data-ds-dark-theme]::before,
html[data-fz3-theme="dark"] body::before{
  display:none !important;
}

/* 深色外壳让开，视频才看得见（浅色不动） */
body[data-ds-dark-theme] [class*="_frame"],
body[data-ds-dark-theme] [class*="_frame"]::before,
body[data-ds-dark-theme] [class*="_sidebarCol"],
body[data-ds-dark-theme] [class*="_centerCol"],
body[data-ds-dark-theme] [data-slot="conversation.content"],
body[data-ds-dark-theme] [data-conversation-scroll]{
  background-color:transparent !important;
  background-image:none !important;
}
/* 会话视图根的底色（2026-11-22 实测定位）：
   宿主的会话列根节点是 .an3WzG_root{background:var(--dsw-alias-bg-base)}，
   我们又把 --dsw-alias-bg-base 定成了 #000，于是它整块不透明地盖在
   z-index:-1 的背景视频上 —— 视频在播（readyState 4 / currentTime 在走）、
   但一个像素都看不见。这里只把它这一层变透明，视频就透出来了。
   注意：an3WzG 是宿主构建时的哈希，DSH 升级后类名可能变；变了就照
   elementsFromPoint 报出来的新哈希换掉这一组选择器。 */
body[data-ds-dark-theme] [class*="an3WzG_root"]{
  background-color:transparent !important;
  background-image:none !important;
}


/* ========== 语音气泡：浅色改白底深字 ========== */
/* .fz3-say 是眼徽旁边那条"朗读摘要"，基础样式是黑底白字（深色专用）。
   浅色下要反过来，否则白字贴浅蓝底会看不清。 */
html[data-fz3-theme="light"] .fz3-say,
body:not([data-ds-dark-theme]) .fz3-say{
  background:#ffffff !important;
  color:#151b2f !important;
  border-color:#cfd4dd !important;
  box-shadow:0 10px 24px rgba(30,45,80,.14) !important;
}
html[data-fz3-theme="light"] .fz3-say::before,
body:not([data-ds-dark-theme]) .fz3-say::before{
  background:#ffffff !important;
  border-left-color:#cfd4dd !important;
  border-bottom-color:#cfd4dd !important;
}

/* —— 浅色：内容列铺近白底 ——
   插件/设置页的正文区本身没有背景，直接透出外壳的 #d6e4ff，
   整块看起来就是一块突兀的浅蓝色块（2026-11-22 用户反馈）。
   给内容列垫一层近白底，和侧栏 / 页面头部的白面接上。 */
html[data-fz3-theme="light"] [class*="_centerCol"],
body:not([data-ds-dark-theme]) [class*="_centerCol"]{
  background-color:#fbfcff !important;
  background-image:none !important;
}

/* —— 浅色：让宿主的会话根层让开，ZZZ 视频才看得见（2026-11-25 修）——
   1.0.18 起，浅色专用那条 video.fz3-logo-video 是插在 [class*="_centerCol"]
   的第一个子节点、z-index:-1，设计意图是"栏目底色之上、正文之下"。
   但宿主会话根 .an3WzG_root{background:var(--dsw-alias-bg-base);position:relative}
   是一整列不透明的层，浅色下就是白色：它排在负 z-index 之后绘制，
   把视频整块盖住 —— 元素在播、像素为零，看上去就是"不加载"。
   深色在 1.0.17 已经踩过同一个坑（上面 an3WzG_root 那段只修了深色），
   这里把同一件事补在浅色上。不写死哈希：改抓宿主自己给的语义属性 data-phase
   （会话根一定有 data-phase=active|settling|hero），再叠一条 "_root" 类名限定，
   免得误伤带 data-phase 的输入框；DSH 升级换了哈希也不失效。
   conversation.content / conversation-scroll 一并让开，免得又哪层垫了白底。 */
html[data-fz3-theme="light"] [class*="_centerCol"] [data-phase][class*="_root"],
html[data-fz3-theme="light"] [class*="_centerCol"] [data-slot="conversation.content"],
html[data-fz3-theme="light"] [class*="_centerCol"] [data-conversation-scroll],
body:not([data-ds-dark-theme]) [class*="_centerCol"] [data-phase][class*="_root"],
body:not([data-ds-dark-theme]) [class*="_centerCol"] [data-slot="conversation.content"],
body:not([data-ds-dark-theme]) [class*="_centerCol"] [data-conversation-scroll]{
  background-color:transparent !important;
  background-image:none !important;
}

/* ========== 聊天窗口右下角的 NOW LOADING 动画（2026-11-22） ==========
   贴着输入卡片上沿、右缘内缩 16px；如果「任务清单」停靠条出现在输入框上方，
   就整体抬到那条的上方，避免被任务条压住（2026-11-22 主人要求）。
   位置由 JS 每 500ms 按实际矩形重算一次，切侧栏、输入框长高、任务条展开都会跟。
   是否播放由 /fairy-zzz/mood 决定：thinking / working / running 时播放；
   回到 idle / done 再等 2.5 秒后**暂停定格、留在原位**，永不隐藏
   （播放时 72% 、定格后 55% 不透明度：播放也走浅色，定格再淡一档，一眼能看出是静止的）。
   想停掉：JS 里的 CORNER_ANIM = false。 */
.fz3-loading.fz3-corner{
  position:fixed;
  left:0;
  top:0;
  /* 2026-11-23 历史：一开始取 0（被聊天列底衬盖住一部分）、9001（反过来压住菜单）、
     900 / 2000（压住菜单但也被主人嫌高）。最终口径是「文本聊天区的上一层」→ 1。 */
  /* 角落印章的层叠高度。2026-11-23 主人定的口径：「文本聊天区的上一层」——
     正文那一层是 0（z:auto 的流内内容），印章取 +1，正好压过正文一层，
     又是整张样式表里最小的正数层级。位置仍由 place() 算，挂载点不动。 */
  z-index:var(--fz3-corner-z,1);
  display:none;
  align-items:center;
  height:var(--fz3-loading-h,48px);
  pointer-events:none;
  opacity:var(--fz3-corner-opacity,.72);
  transition:opacity .35s ease;
}
/* 2026-11-23 主人第二轮要求：整枚印章右移，贴到输入卡片右上角的内侧
   （上一版是左移 96px）。数值由 JS 读这个变量，place() 每 500ms 重排时都重读，
   改这里就能实时调，不用动 JS。
   0px = 贴输入卡片右缘内缩 12px；正数往左，负数往右（可越过卡片右缘）。 */
:root{ --fz3-corner-shift:0px; }
/* 角落印章的层叠高度：文本聊天区那一层（0）+ 1。
   2026-11-23 主人定的口径，改这一行即可；位置仍由 place() 算。 */
:root{ --fz3-corner-z:1; }
/* 2026-11-23 主人要求：**播放时**也用浅一点的颜色状态 —— 原来是 .92，黑字压在浅底上太实，
   动画一跑就抢视线。现在：播放 .72 / 定格 .55，两者都留成变量，改这一行立刻生效。
   想要更淡就把 --fz3-corner-opacity 往下调（.6 以下会开始糊）。 */
:root{ --fz3-corner-opacity:.72; --fz3-corner-opacity-paused:.55; }
.fz3-loading.fz3-corner[data-paused="1"]{opacity:var(--fz3-corner-opacity-paused,.55)}
.fz3-loading video{height:100%;width:auto;display:block}
/* 2026-11-23 主人要求：**浅色模式**下 NOW LOADING 印章改成 #B0B0B0，不要再反相成纯黑。
   素材（assets/loading.webm）是纯白印章（255）+ 灰阶描边，透明底；
   原来 invert(1) 把它压成 #000，压在浅色底上太重。
   brightness(0.6902) 正好把 255 映射成 176 = #B0B0B0，内部灰阶等比变浅，alpha 不动。
   要换别的灰：目标值 / 255（#C0C0C0 → 0.7529）。深色模式仍是原样白色印章。 */
html[data-fz3-theme="light"] .fz3-loading video,
body:not([data-ds-dark-theme]) .fz3-loading video{filter:brightness(.6902)}

/* ========== 设置面板：把蓝色换成中性灰（2026-11-22 主人要求） ==========
   设置弹层（data-shortcut-modal="settings" 是宿主给的稳定钩子）里，蓝色有两层来源：
   ① 直接用的 --dsw-alias-bg-layer-1/2/3（偏蓝深灰，面板 #141824、卡片 #0F131F）；
   ② 已经组合好的别名 —— 宿主在 :root 上写了
        --dsw-alias-settings-card-fill: var(--dsw-alias-bg-layer-2)
      这种「别名套别名」在 :root 上就完成替换了，只改 layer-* 对卡片无效，
      所以连别名一起点名覆盖。作用域限定在设置弹层内，弹层外面不受影响。 */
body[data-ds-dark-theme] [data-shortcut-modal="settings"]{
  --dsw-alias-bg-layer-1:#121214 !important;
  --dsw-alias-bg-layer-2:#141416 !important;
  --dsw-alias-bg-layer-3:#1e2023 !important;
  --dsw-alias-bg-layer-4:#26282b !important;
  --dsw-alias-bg-mask-1:rgba(0,0,0,.62) !important;
  --dsw-alias-settings-card-fill:#101012 !important;
  --dsw-alias-settings-card-stroke:#2a2c30 !important;
  --dsw-alias-bg-l1:#1b1d1f !important;
  --dsw-alias-bg-l2:#17181a !important;
  --dsw-alias-bg-elevated:#1c1e21 !important;
  --dsw-alias-bg-module-platform:#1d1f22 !important;
  --dsw-alias-bg-skeleton:rgba(255,255,255,.07) !important;
  --dsw-alias-card-tile-fill:#1b1d1f !important;
  --dsw-alias-fill-l1:#1b1d1f !important;
  --dsw-alias-fill-l2:#202224 !important;
  --dsw-alias-interactive-bg-hover:rgba(255,255,255,.06) !important;
  --dsw-alias-interactive-bg-hover-solid:#26282b !important;
  --dsw-alias-interactive-bg-active:rgba(255,255,255,.10) !important;
  --dsw-alias-state-business-primary:#53575e !important;
  --dsw-alias-state-business-tertiary:#8b8f96 !important;
  --dsw-alias-button-primary-fill:#53575e !important;
  --dsw-alias-button-primary-hover:#5e6268 !important;
  --dsw-alias-button-elevated-fill:#1c1e21 !important;
  --dsw-focus-ring-color:#8b8f96 !important;
  --dsw-alias-border-l1:#26282c !important;
  --dsw-alias-border-l2:#2f3236 !important;
  --dsw-alias-border-l3:#3a3d42 !important;
  --dsw-alias-border-l4:#2a2c30 !important;
  --dsw-alias-border-selected:#6f737a !important;
  --dsw-specific-sidebar-nav-item-active:rgba(255,255,255,.10) !important;
}

/* ========== 主题校验：最终配色层（2026-11-22） ==========
   这一层必须放在 CSS 最后：前面 1600~1900 行里累积了多轮「白色字 / 黑底 / 白底」
   互相覆盖的规则，靠零散补丁永远压不干净。这里改成：
   ① 两套颜色只在 html[data-fz3-theme] 上定义成变量，一次写全；
   ② 所有品牌名、用量气泡的文字/底色都只引用变量；
   ③ 选择器统一带 html[data-fz3-theme]，源顺序最后 + !important，
      稳定压过 body[data-ds-dark-theme] / 旧浅色规则。
   运行时的 theme-watch 还会按实际对比度兜底（见 __fz3ThemeCheck）。 */
html[data-fz3-theme="light"]{
  --fz3-brand-fg:#0f1730;
  --fz3-brand-sub:#3f5378;
  --fz3-bubble-bg:#ffffff;
  --fz3-bubble-border:#cfd4dd;
  --fz3-bubble-title:#1f2d4a;
  --fz3-bubble-key:#33415c;
  --fz3-bubble-val:#0b1428;
  --fz3-bubble-sub:#58647c;
  --fz3-bubble-peak:#0b6b3a;
  --fz3-bubble-peak-peak:#9a5b00;
  --fz3-brand-glow:none;
}
html[data-fz3-theme="dark"]{
  --fz3-brand-fg:#f2f5ff;
  --fz3-brand-sub:rgba(122,188,240,.78);
  --fz3-bubble-bg:#000000;
  --fz3-bubble-border:#595959;
  --fz3-bubble-title:#ffffff;
  --fz3-bubble-key:#d7dce6;
  --fz3-bubble-val:#ffffff;
  --fz3-bubble-sub:#b9c2d4;
  --fz3-bubble-peak:#3ed873;
  --fz3-bubble-peak-peak:#ffb45c;
  --fz3-brand-glow:0 0 10px rgba(96,132,255,.28);
}
html[data-fz3-theme] .fz3-sb-text b,
html[data-fz3-theme] .fz3-brandname b{
  color:var(--fz3-brand-fg) !important;
  text-shadow:var(--fz3-brand-glow) !important;
}
html[data-fz3-theme] .fz3-sb-text i,
html[data-fz3-theme] .fz3-brandname i{
  color:var(--fz3-brand-sub) !important;
}
html[data-fz3-theme] .fz3-bubble{
  background:var(--fz3-bubble-bg) !important;
  background-image:none !important;
  border-color:var(--fz3-bubble-border) !important;
  color:var(--fz3-bubble-val) !important;
}
html[data-fz3-theme] .fz3-bubble::after{
  background:var(--fz3-bubble-bg) !important;
  border-left-color:var(--fz3-bubble-border) !important;
  border-bottom-color:var(--fz3-bubble-border) !important;
}
html[data-fz3-theme] .fz3-bubble-head{ color:var(--fz3-bubble-title) !important; }
html[data-fz3-theme] .fz3-bubble-k{ color:var(--fz3-bubble-key) !important; }
html[data-fz3-theme] .fz3-bubble-v,
html[data-fz3-theme] .fz3-bubble-v b{ color:var(--fz3-bubble-val) !important; }
html[data-fz3-theme] .fz3-bubble-sub{ color:var(--fz3-bubble-sub) !important; }
html[data-fz3-theme] .fz3-peak-clock{
  color:var(--fz3-bubble-peak) !important;
  border-bottom-color:color-mix(in srgb, var(--fz3-bubble-peak) 55%, transparent) !important;
}
html[data-fz3-theme] .fz3-peak-clock[data-tone="peak"]{
  color:var(--fz3-bubble-peak-peak) !important;
  border-bottom-color:color-mix(in srgb, var(--fz3-bubble-peak-peak) 55%, transparent) !important;
}

/* ============================================================
   运行行的图标（2026-11-23 主人改口：这一行只留文字）
   ------------------------------------------------------------
   运行行（div[data-chat-running]）行首宿主画了一只鲸鱼。2026-11-23 凌晨试过
   换成自绘邦布，主人最终要求「把邦布删了，文字换成 H.D.D.空洞文件检索中ing」——
   所以现在 scan() 给行打上 [data-fz3-noicon]，图标槽整块收起来：
   邦布不注入、宿主的鲸鱼也不显示，这一行只剩文字。
   想把邦布放回来：JS 里 RUNNING_ICON 改成 'bangboo'（视频抽帧 27 帧那套），
   想回到宿主原样就改成 'whale'。
   ============================================================ */
[data-fz3-noicon] [class*="runningIcon"],
[data-fz3-noicon] [class*="runningWhaleAnimated"],
[data-fz3-noicon] [class*="runningWhaleStill"]{ display:none !important; }

/* 注入邦布时才藏鲸鱼（RUNNING_ICON = 'bangboo' 时生效） */
[data-fz3-bangboo] [class*="runningWhaleAnimated"],
[data-fz3-bangboo] [class*="runningWhaleStill"]{ display:none !important; }

/* ---- 邦布（2026-11-23：改用 loading.webm 抽帧的完整 27 帧）-------------- *
   旧版：14(+delta)px 的 runningIcon 里塞 42px/帧的 sprite，用 CSS
   steps(27) 播 —— 20px 见方的一团剪影，帧间只差几度倾斜，看起来就是静止的。
   新版三件事一起改：
     1) 宿主给 .runningIcon 的尺寸是 calc(14px + --dsh-content-font-delta)，
        这里统一拉到 20×28（行高 28px，装得下）。宿主类名带哈希，用
        [class*="runningIcon"] 抓，皮肤样式表在宿主之后注入，同权重后到者赢。
     2) sprite 换成 assets/bangboo-run-webm-27f.png：从 loading.webm 逐帧解出
        27 帧（0.9s 一轮，432 帧 = 27×16 个循环），27 帧统一裁切窗、
        2 倍降采样、46×59/帧。播放交给 apply() 里 running-label 那段的
        rAF 播放器：逐帧推进 + 每轮两次小跳，相位走绝对时钟（重挂不跳相）。
        不再依赖 CSS animation —— 皮肤样式在，但 motion 偏好、缓存旧样式
        这类坑都绕开了。
     3) 目前 RUNNING_ICON = 'none'，这段样式处于待命状态。
   图高只占 92% 并贴底，上面留出的 2px 就是起跳的空间：runningIcon 有
   contain:strict，超出去的部分会被裁掉，所以余量必须在盒子里面。 */
/* 盒子尺寸跟着 sprite 的长宽比走：帧是 46×59（0.78），所以宽 20 / 高 28，
   图高 92% 时帧宽正好 20.1px，和盒子几乎同宽，整帧都装得下。 */
[class*="runningIcon"]{ width:20px; height:28px; }
/* 宿主的 .V4vHZW_runningIcon 与上一行同权重 (0,1,0)，而聊天插件的样式表是
   懒加载、注入在皮肤之后，会反压过来；用 :root 抬高一级，不靠 !important。 */
:root [class*="runningIcon"]{ width:20px; height:28px; }

.fz3-boo{ display:block; position:relative; width:100%; height:100%; overflow:hidden; }
.fz3-boo img{
  position:absolute; left:0; bottom:0; height:92%; width:auto; max-width:none;
  filter:brightness(0) invert(1);
  will-change:transform;
  backface-visibility:hidden;
}
/* 浅色模式：同一张图翻成黑邦布。
   只认皮肤自己的 data-fz3-theme：宿主在换了皮肤开关后仍可能停在
   data-ds-theme-source=light，那两条当兜底会串色，已撤。 */
html[data-fz3-theme="light"] .fz3-boo img{ filter:brightness(0); }


/* ============================================================
   归档聊天标题加删除线（2026-11-23 主人要求）
   ------------------------------------------------------------
   宿主在侧栏工作区列表里把「已归档」的会话排在同一分组的末尾，
   行上挂 Rows.module.css 的 archived 类，并给整行写 aria-description
   （它的唯一取值是「已归档，无法打开」），标题文字本身仍是普通 span。
   这里不改宿主 bundle，只用两条选择器给标题加删除线：
     1) 优先用宿主当前的类名（本次安装的哈希前缀是 wnFoaW_）；
        宿主升级换哈希时这条会自动失效，不会误伤别的元素。
     2) 兜底用语义属性：会话行 data-row-key="session:…" + role=treeitem
        + aria-description，凡是带这三样的行都是归档行，标题取子元素里
        类名含 title 的 span（行标题 _title，搜索结果的 _searchResultTitle）。
   只加删除线，不改行高与截断/滚动逻辑；文字仍用宿主给归档行的
   caption 灰（#7f7f7f），删除线本身按主人 2026-11-23 的要求改成白色。
   白色只在深色主题成立：浅色主题的侧栏底色是浅的，白线等于没画，
   所以线色走一个自定义属性，深色 #fff、浅色 #AAAAAA（淡灰），
   由皮肤自己挂在 html 上的 data-fz3-theme 切；属性缺失时 var() 兜底取 #fff。
   搜索浮层里命中归档会话的结果行同样处理，两处读起来是同一个状态。
   不想再要：整段删掉即可（备份见工作区 archived-strike-20261123）。
   ============================================================ */
html{ --fz3-archived-strike:#fff; }
/* 浅色模式：删除线换成「淡灰」#AAAAAA（主人 2026-11-23 追加要求：换成浅色）。
   上一版线色跟文字走（currentColor）—— 归档行文字现在是石墨灰 #444444，
   线也就成了同一道深灰，划掉的分量偏重。改成五档灰里最轻的一档：
   线只当「已归档」的次要标注，文字仍是 #444444，两者分开看更轻。
   深色主题仍是纯白，未动。 */
html[data-fz3-theme="light"]{ --fz3-archived-strike:#aaaaaa; }
.wnFoaW_sessionRow.wnFoaW_archived .wnFoaW_title,
.wnFoaW_searchResultRow.wnFoaW_archived .wnFoaW_searchResultTitle,
[data-row-key^="session:"][role="treeitem"][aria-description] [class*="title" i]{
  text-decoration:line-through;
  text-decoration-thickness:1px;
  text-decoration-color:var(--fz3-archived-strike, #fff);
}

/* ============================================================
   浅色模式文字：主人给的五档灰阶（2026-11-23 第二次定稿）
   ------------------------------------------------------------
   chat-tone 那层用五个角色变量给全站文字定调，这里把浅色下的取值换成
   主人指定的灰阶（深色模式仍用 chat-tone 自己的灰白，一个字节不动）：
     --ct-key    #333333  标题 / 加粗 / 按钮 / 标签页（深灰，最推荐）
     --ct-body   #444444  正文（石墨灰，柔和但依然醒目）
     --ct-input  #333333  输入框里打的字
     --ct-list   #444444  侧栏工作区列表整行
     --ct-hint   #888888  占位提示 / 说明（浅灰）
   次级 / 三级 / 最次要三档走宿主的 label token，见上方「③ 浅色」变量块：
     primary #444444、secondary #444444、tertiary #666666、caption #888888。
   只认皮肤自己的深浅信号（html[data-fz3-theme="light"]）：皮肤切深色时
   背景也被皮肤刷成深色，跟着 body 的宿主属性走会给深底配深字。
   2026-11-23 02:20 起这几行就是浅色的唯一来源：原先末尾那个每 1.5s 写行内
   --ct-* 的 __TEMP_CHAT_TONE_LIGHT__ 已撤（两实例交替写色会让文字一闪一闪）。
   改色时与 dsh-chat-tone 的「七、浅色模式」一并改，两处必须一致
   （校验见 color-pass\verify-gray-tone.mjs）。
   ============================================================ */
html[data-fz3-theme="light"],
html[data-fz3-theme="light"] body,
html[data-fz3-theme="light"] [data-theme]{
  --ct-key:#333333;
  --ct-body:#999999;
  --ct-input:#333333;
  --ct-list:#666666;
  --ct-hint:#888888;
}

/* ============================================================
   律动光带（TextShimmer）：回到源文件自己的取值（2026-11-23 定稿）
   ------------------------------------------------------------
   宿主画光带用的是 color:var(--dsw-alias-label-shimmer)，本来就有按主题分好的
   取值（浅色 30% 黑、运行行用 deep-diving-shimmer 暗蓝、深色亮白），
   不该由我们另指定一个颜色 —— 上一版指定 #8ABCFE 亮蓝，观感「很不自然」，
   主人要求直接用源文件的取值。
   问题只出在：皮肤末尾 __TEMP_CHAT_TONE__ / dsh-chat-tone 的
   button,button *{color:var(--ct-key)!important} 会把按钮里的扫光层也刷成
   正文色（浅色 #333333），于是柔和扫光变成一条实心深灰条。
   这里只做一件事：把扫光层的颜色**交还**给源文件那个 token，不加任何自定义色。
   扫光层内部的文字由宿主的 ._sweep_ * {color:inherit!important} 自动跟随，
   不需要另外写。深色主题一个字不动。
   ============================================================ */
html[data-fz3-theme="light"] [class*="_sweep_"]{
  color:var(--dsw-alias-label-shimmer)!important;
  -webkit-text-fill-color:currentColor!important;
}

/* ============================================================
   思考 / 工具标题区：整体回到 1.0.5 的取值（2026-11-23 主人要求）
   ------------------------------------------------------------
   1.0.5（11-22 21:01 打包那份）里，这块**根本没有皮肤规则**，颜色全来自
   皮肤「③ 浅色」的四个 label token：
     primary #1b2333 / secondary #3f4a5e / tertiary #5c6684 / caption #6b7691
   后来 chat-tone 的灰阶把 --ct-key / --ct-body 刷成 #333333 / #666666，
   而且它的「button, button *」会把工具行标题（宿主就是 button）一起带走，
   这块的观感就变了。
   这里把这一块（宿主工具行的类名前缀 BE0jCW_，不假设哈希之外的写法）
   的四个 label token 与五个 ct 角色变量一起钉回 1.0.5 的取值。
   侧栏与正文的五档灰阶不动；深色主题不在作用域内，一个字节不动。
   02:44 那两条「#000000 / #345EBA」的临时规则已撤（那是按 01:52 截图猜的，
   主人现在明确要 1.0.5）。
   ============================================================ */
html[data-fz3-theme="light"] [class*="BE0jCW_root"],
html[data-fz3-theme="light"] [class*="BE0jCW_root"] *{
  --dsw-alias-label-primary:#1b2333 !important;
  --dsw-alias-label-secondary:#3f4a5e !important;
  --dsw-alias-label-tertiary:#5c6684 !important;
  --dsw-alias-label-caption:#6b7691 !important;
  --ct-key:#1b2333 !important;
  --ct-body:#1b2333 !important;
  --ct-input:#1b2333 !important;
  --ct-list:#1b2333 !important;
  --ct-hint:#6b7691 !important;
}

/* ============================================================
   运行行律动：直接用「深色主题那套」配色（2026-11-23 主人定稿）
   ------------------------------------------------------------
   主人的话：「浅色模式这个区域配色直接用深色的配置」，并在选项里选定
   「只把律动用深色那套」——
     · 运行行文字 = 深色主题的亮蓝 #8ABCFE
     · 扫光层     = 深色主题的 45% 白光 rgba(255,255,255,.45)
   思考 / 工具标题区不动（上面那段仍是 1.0.5 的 #1b2333）。
   提醒：浅色底 #f7faff 上 #8ABCFE 的对比度只有 1.6:1，属于「亮光装饰」而不是
   正文，主人确认过就用这版；想让它更显眼可以把底色一起压深（嵌一块深色终端），
   或者把字压到 #345EBA（4.6:1）。改下面两个色值即可。
   ============================================================ */
html[data-fz3-theme="light"] [data-chat-running],
html[data-fz3-theme="light"] [data-chat-running] *{
  color:#8ABCFE !important;
  -webkit-text-fill-color:currentColor !important;
}
html[data-fz3-theme="light"] [data-chat-running] [class*="_sweep_"],
html[data-fz3-theme="light"] [data-chat-running] [class*="_sweep_"] *{
  color:rgba(255,255,255,.45) !important;
  -webkit-text-fill-color:currentColor !important;
}

/* 对话列里其他律动行（「正在运行命令」这一排工具 / 思考标题）**
   扫光颜色照搬上面运行行那套：45% 白光，不再用浅色主题原本的 30% 黑扫光。
   只换扫光层颜色，标题字仍是 1.0.5 的 #1b2333（上面那段）。 */
html[data-fz3-theme="light"] [data-conversation-scroll] [class*="_sweep_"],
html[data-fz3-theme="light"] [data-conversation-scroll] [class*="_sweep_"] *{
  color:rgba(255,255,255,.45) !important;
  -webkit-text-fill-color:currentColor !important;
}

`

    /* ------------------------------------------------------------------ *
     * 图标
     * ------------------------------------------------------------------ */
    /* 待机随机小动作：眨眼（偶尔连眨）+ 偶尔瞟一眼。
       眨眼是整只眼纵向压扁成一条光缝再弹回，300ms 一次。 */
    const BLINK_MS = 300
    let lastGlitchAt = 0

    /* 本次页面加载是否已经打过招呼：组件重挂载（切会话等）时不再重播问好，直接落到左下坞 */
    let greeted = false

    function CoreGlyph({ phase, mood }) {
      const [blink, setBlink] = useState('0')
      const [glance, setGlance] = useState('')
      const [glitch, setGlitch] = useState(null)

      /* 花屏：随机把整只眼切成 2~4 条横带，各自横向错位叠一层；切换情绪时也来一下。 */
      const fireGlitch = useCallback(() => {
        if (Date.now() - lastGlitchAt < 1800) return
        lastGlitchAt = Date.now()
        const bands = []
        let y = 2 + Math.random() * 10
        const count = 2 + Math.floor(Math.random() * 3)
        for (let i = 0; i < count && y < 92; i += 1) {
          const h = 4 + Math.random() * 15
          bands.push({
            top: y,
            h: Math.min(h, 96 - y),
            dx: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 14),
            o: 0.5 + Math.random() * 0.5,
          })
          y += h + 5 + Math.random() * 20
        }
        if (!bands.length) return
        setGlitch({ id: Math.random(), bands: bands })
        if (typeof window !== 'undefined') window.__fz3Glitches = (window.__fz3Glitches || 0) + 1
        setTimeout(() => setGlitch(null), 150 + Math.random() * 190)
      }, [])

      useEffect(() => {
        let alive = true
        let timer = null
        const schedule = () => {
          const hot = mood === 'working' || mood === 'thinking'
          const wait = hot ? 4200 + Math.random() * 5200 : 7600 + Math.random() * 9400
          timer = setTimeout(() => {
            if (!alive) return
            fireGlitch()
            schedule()
          }, wait)
        }
        schedule()
        return () => { alive = false; clearTimeout(timer) }
      }, [phase, mood, fireGlitch])

      useEffect(() => {
        const t = setTimeout(() => { try { fireGlitch() } catch (e) {} }, 180)
        return () => clearTimeout(t)
      }, [mood, phase, fireGlitch])

      useEffect(() => {
        let alive = true
        let timer = null
        /* 所有到点动作都登记句柄，切状态或卸载时一并清掉 */
        const pending = new Set()
        const after = (fn, ms) => {
          const id = setTimeout(() => { pending.delete(id); if (alive) fn() }, ms)
          pending.add(id)
        }
        const idleLike = mood !== 'working' && mood !== 'thinking'
        /* 思考 / 执行中不眨眼：只保留眼睑半闭的思考态。
           切进来的瞬间可能正眨到一半（眼睑收起、300ms 后才弹回），
           这里立刻收尾回睁眼，否则 data-lid 会停在 blink 上，思考态就看不见眼睑。 */
        if (!idleLike) {
          setBlink('0')
          setGlance('')
          return undefined
        }
        const schedule = () => {
          const wait = 3400 + Math.random() * 5200
          timer = setTimeout(() => {
            if (!alive) return
            setBlink('1')
            if (typeof window !== 'undefined') window.__fz3Blinks = (window.__fz3Blinks || 0) + 1
            after(() => setBlink('0'), BLINK_MS)
            if (Math.random() < 0.24) {
              after(() => {
                setBlink('1')
                after(() => setBlink('0'), BLINK_MS - 40)
              }, 470)
            }
            if (Math.random() < 0.45) {
              const dir = Math.random() < 0.5 ? 'l' : 'r'
              after(() => setGlance(dir), 520)
              after(() => setGlance(''), 1240)
            }
            schedule()
          }, wait)
        }
        schedule()
        return () => {
          alive = false
          clearTimeout(timer)
          pending.forEach(clearTimeout)
          pending.clear()
          setBlink('0')
          setGlance('')
        }
      }, [phase, mood])

      return h(
        'div',
        { className: 'fz3-eye', 'data-blink': blink, 'data-glance': glance || undefined, 'data-glitch': glitch ? '1' : undefined, 'data-lid': mood === 'thinking' || mood === 'working' ? 'think' : (blink === '1' ? 'blink' : (mood === 'done' ? 'soft' : undefined)) },
        h('span', { className: 'fz3-eye-halo', 'aria-hidden': 'true' }),
        h('span', { className: 'fz3-eye-ring', 'aria-hidden': 'true' }),
        h('div', {
          className: 'fz3-eye-svg',
          'aria-hidden': 'true',
          dangerouslySetInnerHTML: { __html: FAIRY_EYE_SVG },
        }),
        glitch
          ? h('span', { className: 'fz3-glitch', 'aria-hidden': 'true' },
              glitch.bands.map((b, i) => h('span', {
                key: glitch.id + '-' + i,
                className: 'fz3-gband',
                style: {
                  clipPath: 'inset(' + b.top.toFixed(1) + '% 0 ' + Math.max(0, 100 - b.top - b.h).toFixed(1) + '% 0)',
                  transform: 'translateX(' + b.dx.toFixed(1) + 'px)',
                  opacity: b.o.toFixed(2),
                },
                dangerouslySetInnerHTML: { __html: FAIRY_EYE_SVG },
              })),
              h('span', { className: 'fz3-gline', 'aria-hidden': 'true' }))
          : null,
        h('span', { className: 'fz3-eye-scan', 'aria-hidden': 'true' }),
        h('span', { className: 'fz3-eye-flash', 'aria-hidden': 'true' }),
      )
    }

    /* ------------------------------------------------------------------ *
     * 学习代办（2026-11-23 并入皮肤：原独立插件 dsh-learning-todo）
     *
     * 数据只住在浏览器：localStorage 的 dsh.learning-todo.v1 —— 沿用原插件的键名，
     * 以前装过那个插件、记过任务的人，清单原样接过来。两个入口共用同一个 store：
     *   · 侧栏脚部卡片（sidebar.footer.action）—— 常驻、点表头展开、Esc 收起；
     *   · 设置页「学习代办」那一行的「打开代办」按钮 —— 打开居中任务板弹窗。
     * 宿主把侧栏收成图标轨时卡片只剩图标，弹窗照常可用。
     * 2026-11-26 主人砍掉了「归档已完成」那一步：勾选 = 完成 = 直接进「已完成」，
     * 只有一个分区、一个动作；已完成行上的「退回」把任务放回待办。
     * 仍不提供改名 / 删除（清单是记录，不是编辑器）。
     * ------------------------------------------------------------------ */
    const TODO_KEY = 'dsh.learning-todo.v1'
    /* 侧栏卡片显隐偏好（设置页开关写这里） */
    const TODO_SHOW_KEY = 'fairy.zzz.todo-show'
    /* 「已完成」分组的默认态（2026-11-26 主人要求：默认收起，别让归档列表把待办挤下去）
       只当「默认值」用：卡片 / 弹窗每次挂载时按它决定初始收起与否；
       手动点箭头仍可临时展开，但不会把这个偏好改掉。 */
    const TODO_DONE_KEY = 'fairy.zzz.todo-done-open'
    const TODO_SEED = [
      '任务 1：实现 exp_to_next_level（升级经验公式）',
      '任务 2：实现 clamp_hp（血量夹取到 0 与上限之间）',
      '任务 3：实现 format_damage（拼出伤害字符串）',
      '收工：pytest 14 条测试全绿',
      '收工：git commit + push，CI 变绿',
    ]

    const todoStorage = () => {
      try {
        return typeof localStorage === 'undefined' ? null : localStorage
      } catch {
        return null
      }
    }

    const todoId = () => {
      try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
      } catch {}
      return 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
    }

    /* 读回一条存储记录；没有可用标题的就丢掉 */
    const todoReadTask = (entry) => {
      if (entry === null || typeof entry !== 'object') return null
      const title = typeof entry.title === 'string' ? entry.title.trim() : ''
      if (title === '') return null
      return {
        id: typeof entry.id === 'string' && entry.id !== '' ? entry.id : todoId(),
        title,
        done: entry.done === true,
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
        archivedAt: typeof entry.archivedAt === 'string' ? entry.archivedAt : '',
      }
    }

    /* 第一次打开时的初始清单（只在本浏览器还没有存档时用） */
    const todoSeedState = () => {
      const now = Date.now()
      return {
        items: TODO_SEED.map((title, index) => ({
          id: 'seed-' + String(index + 1),
          title,
          done: false,
          createdAt: new Date(now - (TODO_SEED.length - index) * 1000).toISOString(),
          archivedAt: '',
        })),
        archive: [],
      }
    }

    const todoReadState = () => {
      const store = todoStorage()
      if (store === null) return todoSeedState()
      let raw = null
      try {
        raw = store.getItem(TODO_KEY)
      } catch {
        raw = null
      }
      if (raw === null) return todoSeedState()
      try {
        const parsed = JSON.parse(raw)
        if (parsed !== null && typeof parsed === 'object' && Array.isArray(parsed.items) && Array.isArray(parsed.archive)) {
          const items = parsed.items.map(todoReadTask).filter(Boolean)
          const archive = parsed.archive.map(todoReadTask).filter(Boolean)
          /* 2026-11-26 改成「勾选即归档」之后，待办里不该再留着 done=true 的行。
             旧存档里那种「勾了但还没点归档」的任务，读的时候直接并进已完成，
             否则它们会顶着删除线卡在待办里、又没有按钮能把它们送走。 */
          const stale = items.filter((item) => item.done)
          if (stale.length === 0) return { items, archive }
          return {
            items: items.filter((item) => !item.done),
            archive: [
              ...stale.map((item) => ({ ...item, archivedAt: item.archivedAt || item.createdAt || new Date().toISOString() })),
              ...archive,
            ],
          }
        }
      } catch {}
      return todoSeedState()
    }

    const todoWriteState = (state) => {
      const store = todoStorage()
      if (store === null) return
      try {
        store.setItem(TODO_KEY, JSON.stringify({ v: 1, items: state.items, archive: state.archive }))
      } catch {}
    }

    /* 一份内存里的真相：所有界面读到的是同一份清单 */
    const todoStore = {
      state: null,
      listeners: new Set(),
      read() {
        if (this.state === null) this.state = todoReadState()
        return this.state
      },
      update(fn) {
        const next = fn(this.read())
        if (next === this.state) return
        this.state = next
        todoWriteState(next)
        for (const listener of [...this.listeners]) listener(next)
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => {
          this.listeners.delete(listener)
        }
      },
    }

    function useTodo() {
      const [state, setSnapshot] = useState(() => todoStore.read())
      useEffect(() => todoStore.subscribe(setSnapshot), [])
      const update = useCallback((fn) => {
        todoStore.update(fn)
      }, [])
      return [state, update]
    }

    /* 侧栏卡片显不显：设置页的开关改它，卡片订阅它；偏好记在本机（fairy.zzz.todo-show） */
    const todoShow = {
      value: readBool(TODO_SHOW_KEY, true),
      listeners: new Set(),
      set(value) {
        if (this.value === value) return
        this.value = value
        try { writeStored(TODO_SHOW_KEY, value) } catch {}
        for (const listener of [...this.listeners]) listener(value)
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => {
          this.listeners.delete(listener)
        }
      },
    }

    function useTodoShow() {
      const [show, setShow] = useState(todoShow.value)
      useEffect(() => todoShow.subscribe(setShow), [])
      return show
    }

    /* 「已完成」默认展开与否：键名 fairy.zzz.todo-done-open，缺省 false（= 默认收起）。
       与 todoShow 同构，设置页改一下，已经挂着的卡片/弹窗立刻跟着变。 */
    const todoDoneOpen = {
      value: readBool(TODO_DONE_KEY, false),
      listeners: new Set(),
      set(value) {
        if (this.value === value) return
        this.value = value
        try { writeStored(TODO_DONE_KEY, value) } catch {}
        for (const listener of [...this.listeners]) listener(value)
      },
      subscribe(listener) {
        this.listeners.add(listener)
        return () => {
          this.listeners.delete(listener)
        }
      },
    }

    function useTodoDoneOpen() {
      const [open, setOpen] = useState(todoDoneOpen.value)
      useEffect(() => todoDoneOpen.subscribe(setOpen), [])
      return open
    }

    /* 归档行上的短日期（本地化的「月 日」）；解析不了就留空 */
    function todoArchiveStamp(value) {
      if (typeof value !== 'string' || value === '') return ''
      const time = Date.parse(value)
      if (Number.isNaN(time)) return ''
      try {
        return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(time)
      } catch {
        return ''
      }
    }

    /* 清单图标：一个勾选框 + 两行字 */
    function TodoMark({ size }) {
      const px = typeof size === 'number' && size > 0 ? size : 16
      return h(
        'svg',
        { width: px, height: px, viewBox: '0 0 36 36', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
        h('rect', { x: 4.75, y: 12.75, width: 10.5, height: 10.5, rx: 3, stroke: 'currentColor', strokeWidth: 2.1 }),
        h('path', {
          d: 'M7.7 18.2 9.8 20.3 12.9 16.6',
          stroke: 'currentColor',
          strokeWidth: 2.1,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
        h('path', { d: 'M19.5 15.2 31.2 15.2', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' }),
        h('path', { d: 'M19.5 20.8 27.4 20.8', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' }),
      )
    }

    function todoCheckGlyph() {
      return h(
        'svg',
        { width: 9, height: 9, viewBox: '0 0 12 12', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M2.4 6.3 4.7 8.6 9.6 3.6',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    /* 列表本体：侧栏卡片与弹窗共用，只有外层容器不同 */
    function TodoBody({ autoFocus }) {
      const [state, setState] = useTodo()
      const [draft, setDraft] = useState('')
      /* 已经按下「×」、正等第二下确认的那一行；同一时刻只可能有一行处于这个状态 */
      const [armedId, setArmedId] = useState('')
      useEffect(() => {
        if (armedId === '') return undefined
        const timer = setTimeout(() => setArmedId(''), 3000)
        return () => clearTimeout(timer)
      }, [armedId])
      /* 初始收起与否吃设置里的默认值（缺省收起）；设置页一动，这边立刻跟上 */
      const doneDefault = useTodoDoneOpen()
      const [showDone, setShowDone] = useState(doneDefault)
      useEffect(() => {
        setShowDone(doneDefault)
      }, [doneDefault])
      const inputRef = useRef(null)

      useEffect(() => {
        if (autoFocus && inputRef.current !== null) inputRef.current.focus()
      }, [autoFocus])

      const addTask = useCallback(() => {
        const title = draft.trim()
        if (title === '') return
        setState((prev) => ({
          ...prev,
          items: [...prev.items, { id: todoId(), title, done: false, createdAt: new Date().toISOString(), archivedAt: '' }],
        }))
        setDraft('')
        if (inputRef.current !== null) inputRef.current.focus()
      }, [draft, setState])

      /* 2026-11-26 合并：勾一下 = 完成任务，直接落进「已完成」并记时间。
         原来要先勾、再点底栏「归档已完成」，两步说的是同一件事，撤掉那个按钮。 */
      const completeTask = useCallback(
        (id) => {
          setState((prev) => {
            const target = prev.items.find((item) => item.id === id)
            if (!target) return prev
            const stamp = new Date().toISOString()
            return {
              items: prev.items.filter((item) => item.id !== id),
              archive: [{ ...target, done: true, archivedAt: stamp }, ...prev.archive],
            }
          })
        },
        [setState],
      )

      /* 已完成 → 退回待办：误勾的救命入口（原来归档只读，误勾就没有回头路） */
      const restoreTask = useCallback(
        (id) => {
          setState((prev) => {
            const back = prev.archive.find((item) => item.id === id)
            if (!back) return prev
            return {
              items: [{ ...back, done: false, archivedAt: '' }, ...prev.items],
              archive: prev.archive.filter((item) => item.id !== id),
            }
          })
        },
        [setState],
      )

      /* 已完成 → 永久删除：从清单和 localStorage 一起消失，没有撤销，
         所以按钮要点两下（第一下换成「确认删除」，第二下才真删，3 秒不动自动收回）。 */
      const deleteTask = useCallback(
        (id) => {
          setState((prev) => {
            if (!prev.archive.some((item) => item.id === id)) return prev
            return { ...prev, archive: prev.archive.filter((item) => item.id !== id) }
          })
        },
        [setState],
      )

      const submit = useCallback(
        (event) => {
          event.preventDefault()
          addTask()
        },
        [addTask],
      )

      const activeRows =
        state.items.length === 0
          ? h('div', { className: 'fz3-td-empty' }, '没有待办。添加一条新的学习任务吧。')
          : state.items.map((item) =>
              h(
                'label',
                { key: item.id, className: item.done ? 'fz3-td-row is-done' : 'fz3-td-row' },
                h('input', {
                  type: 'checkbox',
                  className: 'fz3-td-check',
                  checked: item.done,
                  onChange: () => completeTask(item.id),
                }),
                h('span', { className: 'fz3-td-text', title: item.title }, item.title),
              ),
            )

      const doneRows =
        state.archive.length === 0
          ? h('div', { className: 'fz3-td-empty' }, '还没有完成的任务。勾一下待办，它就会出现在这里。')
          : state.archive.map((item) => {
              const stamp = todoArchiveStamp(item.archivedAt)
              return h(
                'div',
                { key: item.id, className: 'fz3-td-row' },
                h('span', { className: 'fz3-td-mark', role: 'img', 'aria-label': '已完成' }, todoCheckGlyph()),
                h('span', { className: 'fz3-td-text', title: item.title }, item.title),
                stamp === '' ? null : h('span', { className: 'fz3-td-date' }, stamp),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'fz3-td-restore',
                    title: '退回待办',
                    'aria-label': '退回待办：' + item.title,
                    onClick: () => {
                      setArmedId('')
                      restoreTask(item.id)
                    },
                  },
                  '←',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: armedId === item.id ? 'fz3-td-del is-armed' : 'fz3-td-del',
                    title: armedId === item.id ? '再点一下永久删除' : '永久删除',
                    'aria-label': (armedId === item.id ? '确认永久删除：' : '永久删除：') + item.title,
                    onClick: () => {
                      if (armedId === item.id) {
                        deleteTask(item.id)
                        setArmedId('')
                        return
                      }
                      setArmedId(item.id)
                    },
                  },
                  armedId === item.id ? '确认删除' : '×',
                ),
              )
            })

      return h(
        'div',
        { className: 'fz3-td-body' },
        h(
          'form',
          { className: 'fz3-td-add', onSubmit: submit },
          h('input', {
            ref: inputRef,
            type: 'text',
            className: 'fz3-td-input',
            value: draft,
            placeholder: '添加一条学习任务',
            'aria-label': '添加一条学习任务',
            onChange: (event) => setDraft(event.target.value),
          }),
          h('button', { type: 'submit', className: 'fz3-td-addbtn', disabled: draft.trim() === '' }, '添加'),
        ),
        h(
          'div',
          { className: 'fz3-td-list' },
          activeRows,
          h(
            'button',
            {
              type: 'button',
              className: 'fz3-td-sec',
              'aria-expanded': showDone,
              onClick: () => {
                setArmedId('')
                setShowDone((value) => !value)
              },
            },
            h('span', { className: 'fz3-td-caret' }, showDone ? '▾' : '▸'),
            '已完成',
            h('span', { className: 'fz3-td-seccount' }, String(state.archive.length)),
          ),
          showDone ? doneRows : null,
        ),
      )
    }

    /* 侧栏脚部卡片：常驻一张带描边的卡；表头钉在侧栏最下缘，列表从它上方展开
       （并入自本地插件「绳匠满级之路」：展开方向、截断半行、隐藏侧栏拖拽线都照搬） */
    function LearningTodoCard(props) {
      const wide = !props || props.wide !== false
      const [state] = useTodo()
      const show = useTodoShow()
      const [open, setOpen] = useState(false)

      useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [open])

      /* 抽屉打开后工作区列表变短，视口边缘可能正好把某一行切成两半 ——
         半行贴在卡片上方像一道污渍。整行藏掉（不是淡出、不是盖住），
         视口不再切到它就恢复。 */
      useEffect(() => {
        if (!open || !show) return undefined
        let hidden = []
        const restore = () => {
          for (const el of hidden) el.style.visibility = ''
          hidden = []
        }
        const trim = () => {
          restore()
          const container = document.querySelector('[data-slot="sidebar"] [class*="_listArea"]')
          const blockEl = document.querySelector('.fz3-td-root')
          if (!container || !blockEl) return
          const edge = blockEl.getBoundingClientRect().top
          const walk = (node) => {
            for (const child of Array.from(node.children)) {
              const r = child.getBoundingClientRect()
              if (r.height === 0) continue
              if (!(r.top < edge - 0.5 && r.bottom > edge + 0.5)) continue
              const deeperCut = Array.from(child.children).some((gc) => {
                const gr = gc.getBoundingClientRect()
                return gr.height > 0 && gr.top < edge - 0.5 && gr.bottom > edge + 0.5
              })
              if (deeperCut) {
                walk(child)
                continue
              }
              child.style.visibility = 'hidden'
              hidden.push(child)
            }
          }
          walk(container)
        }
        const container = document.querySelector('[data-slot="sidebar"] [class*="_listArea"]')
        const frame = requestAnimationFrame(trim)
        if (container) container.addEventListener('scroll', trim)
        window.addEventListener('resize', trim)
        const observer = typeof ResizeObserver === 'function' && container ? new ResizeObserver(trim) : null
        if (observer && container) observer.observe(container)
        return () => {
          cancelAnimationFrame(frame)
          if (container) container.removeEventListener('scroll', trim)
          window.removeEventListener('resize', trim)
          if (observer) observer.disconnect()
          restore()
        }
      }, [open, show])

      if (!show) return null
      return h(
        'div',
        { className: wide ? 'fz3-td-root' : 'fz3-td-root is-rail' },
        h(
          'div',
          { className: 'fz3-td-block' },
          /* 抽屉渲染在表头**上方**：表头永远是侧栏最下沿的那一行，
             两种状态下位置都不动；分隔线因此画在抽屉下缘。 */
          open
            ? h(
                'div',
                { className: 'fz3-td-panel' },
                h(TodoBody, { autoFocus: false }),
              )
            : null,
          h(
            'button',
            {
              type: 'button',
              className: 'fz3-td-headrow',
              'aria-expanded': open,
              title: '绳匠满级之路',
              onClick: () => setOpen((value) => !value),
            },
            h(TodoMark, { size: 16 }),
            h('span', { className: 'fz3-td-headlabel' }, '绳匠满级之路'),
            h('span', { className: 'fz3-td-headcount' }, String(state.items.length)),
            h('span', { className: 'fz3-td-caret' }, open ? '▴' : '▸'),
          ),
        ),
      )
    }

    /* 设置页：语音开关、引擎状态、试听问候 / 测试语音 / 停止 */
    function FairySettings() {
      const voiceState = useVoice()
      /* 学习代办：这一行读同一份清单，只用来显示未完成 / 已归档数量 */
      const [todoState] = useTodo()
      const todoShowOn = useTodoShow()
      const todoDoneOn = useTodoDoneOpen()
      const [engine, setEngine] = useState(null)
      const [engineBusy, setEngineBusy] = useState('')
      const ping = useCallback(() => {
        fetch('/fairy-zzz/health', { cache: 'no-store' })
          .then((res) => res.json())
          .then((data) => setEngine(data))
          .catch(() => setEngine({ ok: false, engine: false }))
      }, [])
      useEffect(() => {
        ping()
        const timer = setInterval(ping, 5000)
        return () => clearInterval(timer)
      }, [ping])
      const [voiceHome, setVoiceHome] = useState('')
      /* 毛玻璃模糊度滑块：初值读持久化值，变动立刻写 CSS 变量并保存 */
      const [glassBlur, setGlassBlur] = useState(() => {
        const raw = Number(readStored(GLASS_KEY, GLASS_DEFAULT))
        return Number.isFinite(raw) ? Math.max(GLASS_MIN, Math.min(GLASS_MAX, raw)) : GLASS_DEFAULT
      })
      useEffect(() => {
        try {
    const root = document.documentElement
    root.style.setProperty('--fz3-glass-blur', glassBlur + 'px')
    /* 0 时直接把整个 filter 置为 none：否则 blur(0px) 仍会为每个元素建合成层 */
    root.style.setProperty('--fz3-glass-filter', glassBlur > 0 ? 'blur(' + glassBlur + 'px) saturate(125%)' : 'none')
  } catch (e) { /* 静默 */ }
      }, [glassBlur])
      const changeGlass = (next) => {
        const value = Math.max(GLASS_MIN, Math.min(GLASS_MAX, Math.round(Number(next) || 0)))
        setGlassBlur(value)
        try { writeStored(GLASS_KEY, value) } catch (e) { /* 静默 */ }
      }
      const [voiceInfo, setVoiceInfo] = useState(null)
      const [voiceHomeBusy, setVoiceHomeBusy] = useState('')

      /* ── 记忆系统（2026-11-27）：两个宿主插件的开关都收进设置页 ──
         dsh-mind 写 ~/.dsh/mind.json（15 秒轮询热加载）；
         神经记忆写 profile 的 cordis.patch.yml（宿主只在启动时读，必须重启）。
         两者生效语义不同，提示文案必须分开写，不能都糊成「已保存」。 */
      const [mem, setMem] = useState({
        mind: { enabled: true, psyche: true, tacit: true, diary: true, lifeline: true, tools: true },
        neural: { observe: true, recall: true, forget: true },
      })
      const [memBusy, setMemBusy] = useState('')
      const [memNote, setMemNote] = useState('')
      const loadMem = useCallback(() => {
        fetch('/fairy-zzz/memory', { cache: 'no-store' })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.ok && data.mind && data.neural) setMem({ mind: data.mind, neural: data.neural })
          })
          .catch(() => {})
      }, [])
      useEffect(() => {
        loadMem()
      }, [loadMem])
      const saveMem = useCallback((group, patch) => {
        setMemBusy(group)
        fetch('/fairy-zzz/memory', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ [group]: patch }),
        })
          .then((res) => {
            if (res.status === 404) return null
            return res.json().catch(() => null)
          })
          .then((data) => {
            if (!data) {
              setMemNote('宿主还在跑旧版本，重启 DSH 之后这里才能保存')
              return
            }
            if (data.mind && data.neural) setMem({ mind: data.mind, neural: data.neural })
            if (data.ok === false && data.errors && data.errors.length) {
              setMemNote('写入失败：' + data.errors.join('；'))
              return
            }
            setMemNote(
              group === 'mind'
                ? '已写入 mind.json，最迟 15 秒热加载生效'
                : '已写入 profile 配置，重启 App 后生效',
            )
          })
          .catch(() => setMemNote('保存失败：宿主没有响应'))
          .then(() => setMemBusy(''))
      }, [])
      const memRow = (group, key, label, desc) =>
        h(
          'div',
          { className: 'fz3-set-row' },
          h('div', null, h('div', { className: 'fz3-set-label' }, label), h('div', { className: 'fz3-set-desc' }, desc)),
          h('button', {
            type: 'button',
            className: 'fz3-set-switch',
            disabled: memBusy === group,
            'data-on': mem[group][key] ? '1' : '0',
            'aria-pressed': !!mem[group][key],
            onClick: () => saveMem(group, { [key]: !mem[group][key] }),
          }),
        )

      /* ── 工具链（2026-11-27）：Fairy 会话下发哪些工具 ──
         配置写 ~/.dsh/fairy-tools.json；限制由同包的 toolgate.js 在 agent scope 里落实。
         设置页只做两件事：展示「全量 / 当前 / 省下多少 token」，以及把勾选写回去。 */
      const [toolState, setToolState] = useState(null)
      const [toolBusy, setToolBusy] = useState('')
      const [toolNote, setToolNote] = useState('')
      /* 连点勾选时只让最后一次请求的结果落到 UI：本地是乐观更新，
         旧响应晚到会把刚勾上的又抹掉，所以给每次保存编号。 */
      const toolSeq = useRef(0)
      const loadTools = useCallback(() => {
        fetch('/fairy-zzz/tools', { cache: 'no-store' })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.ok) setToolState(data)
          })
          .catch(() => {})
      }, [])
      useEffect(() => {
        loadTools()
      }, [loadTools])
      const saveTools = useCallback((patch, note) => {
        const seq = (toolSeq.current += 1)
        setToolBusy('tools')
        fetch('/fairy-zzz/tools', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        })
          .then((res) => {
            if (res.status === 404) return null
            return res.json().catch(() => null)
          })
          .then((data) => {
            if (seq !== toolSeq.current) return
            if (!data) {
              setToolNote('宿主还在跑旧版本，重启 DSH 之后这里才能保存')
              return
            }
            if (data.ok === false) {
              setToolNote('保存失败：' + (data.error || '未知错误'))
              return
            }
            setToolState(data)
            setToolNote(note || '已保存；在线的 Fairy 会话 1–2 秒内生效')
          })
          .catch(() => {
            if (seq === toolSeq.current) setToolNote('保存失败：宿主没有响应')
          })
          .then(() => {
            if (seq === toolSeq.current) setToolBusy('')
          })
      }, [])
      const fmtTok = (value) => {
        const number = Number(value) || 0
        if (number >= 10000) return (number / 1000).toFixed(0) + 'k'
        if (number >= 1000) return (number / 1000).toFixed(1) + 'k'
        return String(number)
      }
      const renderToolchain = () => {
        if (!toolState) return h('div', { className: 'fz3-set-note' }, '正在读取 Fairy 工具链…')
        const cfg = toolState.config || {}
        const catalog = (toolState.catalog && toolState.catalog.tools) || []
        const totals = toolState.totals || { all: { count: 0, tokens: 0 }, enabled: { count: 0, tokens: 0 }, saved: { tokens: 0, pct: 0 } }
        const active = cfg.enabled !== false && cfg.mode !== 'all'
        const allow = new Set(active ? cfg.allow || [] : catalog.map((tool) => tool.name))
        const groups = toolState.groups || []
        const byGroup = new Map()
        for (const tool of catalog) {
          const id = tool.group || 'other'
          if (!byGroup.has(id)) byGroup.set(id, [])
          byGroup.get(id).push(tool)
        }
        const toggleTool = (name) => {
          const next = new Set(allow)
          if (next.has(name)) next.delete(name)
          else next.add(name)
          const nextAllow = [...next]
          /* 先本地更新勾选态，再发请求；响应回来用服务端的合计覆盖。 */
          setToolState((prev) =>
            prev ? { ...prev, config: { ...prev.config, enabled: true, mode: 'custom', allow: nextAllow } } : prev,
          )
          saveTools({ enabled: true, mode: 'custom', allow: nextAllow }, '已保存；在线的 Fairy 会话 1–2 秒内生效')
        }
        const pickPreset = (mode) => {
          saveTools(
            { enabled: true, mode },
            mode === 'all' ? '已恢复全部工具：Fairy 会话下次请求不再裁剪工具' : mode === 'lean' ? '已切到精简工具集' : '已切到推荐工具集',
          )
        }
        const summary = cfg.enabled === false
          ? '已关闭：Fairy 会话照旧拿到全部 ' + String(totals.all.count) + ' 个工具，约 ' + fmtTok(totals.all.tokens) + ' token。'
          : cfg.mode === 'all'
            ? '全部开启：' + String(totals.all.count) + ' 个工具都会下发，约 ' + fmtTok(totals.all.tokens) + ' token。'
            : '当前下发 ' + String(totals.enabled.count) + ' / ' + String(totals.all.count) + ' 个工具，约 ' + fmtTok(totals.enabled.tokens) + ' token；每次请求省下约 ' + fmtTok(totals.saved.tokens) + '（' + String(totals.saved.pct) + '%）。'
        const catalogNote = cfg.error
          ? '配置读取有问题：' + cfg.error
          : (toolState.catalog && toolState.catalog.source === 'global')
            ? '还没从 Fairy 会话同步到完整清单（现在只显示全局工具）。打开或新建一个 Fairy 模式会话后，这里会自动补齐。'
            : (cfg.enabled && toolState.catalog && toolState.catalog.agents > 0 && !toolState.catalog.applied && !(toolState.catalog.error))
              ? '限制还没落实：确认 dsh-fairy-zzz/toolgate 这一行已激活（重启 DSH 后生效）。'
              : ''
        const segBtn = (mode, label) =>
          h(
            'button',
            {
              type: 'button',
              className: 'fz3-set-segbtn',
              'data-on': cfg.mode === mode ? '1' : '0',
              'aria-pressed': cfg.mode === mode,
              onClick: () => pickPreset(mode),
            },
            label,
          )
        const allNames = catalog.map((tool) => tool.name)
        return h(
          'div',
          { className: 'fz3-set-tools' + (active ? '' : ' is-off') },
          h(
            'div',
            { className: 'fz3-set-toolhead' },
            h(
              'div',
              { style: { flex: '1 1 auto', minWidth: 0 } },
              h('div', { className: 'fz3-set-tooltitle' }, 'Fairy 工具链'),
              h('div', { className: 'fz3-set-toolsub' }, '只给 Fairy 模式下发勾选的工具；关掉的工具模型看不到，也不花 token'),
            ),
            h('button', {
              type: 'button',
              className: 'fz3-set-switch',
              disabled: toolBusy === 'tools',
              'data-on': cfg.enabled === false ? '0' : '1',
              'aria-pressed': cfg.enabled !== false,
              onClick: () => saveTools({ enabled: cfg.enabled === false }, cfg.enabled === false ? '工具链已打开' : '工具链已关闭：全部工具可见'),
            }),
          ),
          h('div', { className: 'fz3-set-toolsum' }, summary),
          catalog.length
            ? h(
                'div',
                { className: 'fz3-set-toolpresets' },
                segBtn('lean', '精简'),
                segBtn('recommended', '推荐'),
                segBtn('all', '全部'),
                h('button', { type: 'button', className: 'fz3-set-toolmini', onClick: loadTools }, '刷新清单'),
                active
                  ? h('button', { type: 'button', className: 'fz3-set-toolmini', onClick: () => saveTools({ enabled: true, mode: 'custom', allow: allNames }, '已全选') }, '全选')
                  : null,
                active
                  ? h('button', { type: 'button', className: 'fz3-set-toolmini', onClick: () => saveTools({ enabled: true, mode: 'custom', allow: [] }, '已全部关掉：模型将看不到任何继承工具') }, '全不选')
                  : null,
              )
            : null,
          catalog.length
            ? h(
                'div',
                { className: 'fz3-set-toollist' },
                groups.map((group) => {
                  const items = byGroup.get(group.id) || []
                  if (!items.length) return null
                  return h(
                    'div',
                    { key: 'group-' + group.id },
                    h('div', { className: 'fz3-set-toolgroup' }, group.label + ' · ' + String(items.length)),
                    items.map((tool) =>
                      h(
                        'label',
                        { key: tool.name, className: 'fz3-set-toolrow', title: tool.description || tool.name },
                        h('input', {
                          type: 'checkbox',
                          className: 'fz3-set-toolcheck',
                          checked: allow.has(tool.name),
                          onChange: () => toggleTool(tool.name),
                        }),
                        h('span', { className: 'fz3-set-toolname' }, tool.label || tool.name),
                        h('span', { className: 'fz3-set-tooltok' }, '~' + fmtTok(tool.tokens)),
                      ),
                    ),
                  )
                }),
              )
            : h('div', { className: 'fz3-set-note' }, '还没读到工具清单：打开或新建一个 Fairy 模式会话后会自动补齐。'),
          catalog.length
            ? h('div', { className: 'fz3-set-note' }, '勾选即保存；在线的 Fairy 会话 1–2 秒内生效，新会话立即生效。token 是按 schema 字符量折算的估算值，真实分词以模型为准。')
            : null,
          catalogNote ? h('div', { className: 'fz3-set-note' }, catalogNote) : null,
          toolNote ? h('div', { className: 'fz3-set-note' }, toolNote) : null,
        )
      }

      /* 眼徽拖拽开关：写 localStorage 后广播事件，让皮肤图层立刻切换指针行为 */
      const [dragPref, setDragPref] = useState(() => readBool(DRAG_KEY, true))
      const [hasCustomPos, setHasCustomPos] = useState(() => !!readStored(POS_KEY, null))
      const toggleDrag = () => {
        const next = !dragPref
        writeStored(DRAG_KEY, next)
        setDragPref(next)
        try { window.dispatchEvent(new CustomEvent('fz3:drag-pref')) } catch {}
      }
      const resetDockPos = () => {
        try { localStorage.removeItem(POS_KEY) } catch {}
        setHasCustomPos(false)
        try { window.dispatchEvent(new CustomEvent('fz3:dock-reset')) } catch {}
      }
      /* 眼徽显隐：隐藏后整层只剩背景装饰，不再有任何浮层压住界面 */
      const [eyeHidden, setEyeHidden] = useState(() => readBool(EYE_KEY, false))
      const toggleEye = () => {
        const next = !eyeHidden
        writeStored(EYE_KEY, next)
        setEyeHidden(next)
        try { window.dispatchEvent(new CustomEvent('fz3:eye-pref')) } catch {}
      }
      const [themeMode, setThemeMode] = useState(() => readStored(THEME_KEY, 'auto'))
      const pickTheme = (mode) => {
        writeStored(THEME_KEY, mode)
        setThemeMode(mode)
        try { window.dispatchEvent(new CustomEvent('fz3:theme-pref')) } catch {}
      }
      /* 2026-11-23：设置页「主题校验」卡片已整块移除，这里的状态订阅 / 重校验逻辑随之删除。 */
      const seg = (mode, label) =>
        h(
          'button',
          {
            type: 'button',
            className: 'fz3-set-segbtn',
            'data-on': themeMode === mode ? '1' : '0',
            'aria-pressed': themeMode === mode,
            onClick: () => pickTheme(mode),
          },
          label,
        )
      const loadVoiceHome = useCallback(() => {
        fetch('/fairy-zzz/voice-home', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data) return
            setVoiceInfo(data)
            setVoiceHome(data.home || '')
          })
          .catch(() => {})
      }, [])
      useEffect(() => {
        loadVoiceHome()
      }, [loadVoiceHome])
      /* 宿主还没有 voice-home 路由时（旧版本），至少把当前引擎目录显示出来 */
      useEffect(() => {
        if (voiceInfo) return
        const home = (engine && engine.engineHome) || ''
        if (home && !voiceHome) setVoiceHome(home)
      }, [engine, voiceInfo, voiceHome])
      const saveVoiceHome = useCallback(
        (home) => {
          setVoiceHomeBusy('save')
          fetch('/fairy-zzz/voice-home', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ home: String(home ?? '') }),
          })
            .then((r) => {
              if (r.status === 404) {
                return { ok: false, reason: '宿主还在跑旧版本，重启 DSH 之后这里才能保存' }
              }
              return r.json().catch(() => null)
            })
            .then((data) => {
              if (data) setVoiceInfo(data)
              setVoiceHome((data && data.home) || '')
              ping()
            })
            .catch(() => {})
            .then(() => setVoiceHomeBusy(''))
        },
        [ping],
      )
      const controlEngine = useCallback(
        (action) => {
          setEngineBusy(action)
          fetch('/fairy-zzz/engine?action=' + action, { cache: 'no-store' })
            .catch(() => {})
            .then(() => {
              ping()
              setTimeout(ping, 1500)
              setTimeout(ping, 4000)
              setTimeout(() => setEngineBusy(''), 600)
            })
        },
        [ping],
      )
      const busy = voiceState.busy || voiceState.speaking
      const ready = !!(engine && engine.ok && engine.engine)
      const enginePhase = (engine && engine.engineState) || (ready ? 'ready' : 'dead')
      const engineHome = (engine && engine.engineHome) || ''
      const engineText = busy
        ? '正在合成…'
        : voiceState.speaking
          ? '正在播放…'
          : enginePhase === 'ready'
            ? '已就绪 · GPT-SoVITS（本地 CPU 推理）'
            : enginePhase === 'loading'
              ? '模型加载中，请稍候…'
              : enginePhase === 'error'
                ? '引擎报错：' + String((engine && engine.engineError) || '未知错误').slice(0, 80)
                : engineHome
                  ? '未运行（引擎在 ' + engineHome + '）'
                  : '未运行：没找到语音引擎'
      const setVoice = (enabled) => {
        patchVoice({ enabled: enabled })
        writeStored(VOICE_KEY, enabled)
        if (!enabled) stopSpeech()
      }
      const playGreet = () => { stopSpeech(); const audio = new Audio(GREETING()); audio.play().catch(() => {}) }
      const testVoice = () => { speakText('测试中。主人，我的声音听起来还满意吗？不满意也请忍着，本系统就这一副嗓子。', { force: true }) }
      return h(
        'div',
        { className: 'fz3-set' },
        h(
          'div',
          { className: 'fz3-set-head' },
          h('span', { className: 'fz3-set-eye', 'aria-hidden': 'true', dangerouslySetInnerHTML: { __html: FAIRY_EYE_SVG } }),
          h(
            'div',
            null,
            h('div', { className: 'fz3-set-name' }, 'Fairy · Ⅲ型'),
            h('div', { className: 'fz3-set-sub' }, 'H.D.D 空洞深潜系统 · 皮肤与语音'),
          ),
        ),
        h(
          'div',
          { className: 'fz3-set-row' },
          h('div', null, h('div', { className: 'fz3-set-label' }, '自动朗读回复'), h('div', { className: 'fz3-set-desc' }, '每轮只念一段：本轮正文的开头约 50 字 + 结尾约 50 字，同一句不会念两遍')),
          h('button', {
            type: 'button',
            className: 'fz3-set-switch',
            'data-on': voiceState.enabled ? '1' : '0',
            'aria-pressed': !!voiceState.enabled,
            onClick: () => setVoice(!voiceState.enabled),
          }),
        ),
        h(
          'div',
          { className: 'fz3-set-row' },
          h(
            'div',
            null,
            h('div', { className: 'fz3-set-label' }, '拖动眼徽'),
            h(
              'div',
              { className: 'fz3-set-desc' },
              dragPref
                ? '已开启：按住会话区左缘的眼标，拖到屏幕任意位置，位置会被记住'
                : '已锁定：眼标固定在会话区左缘中部',
            ),
          ),
          h('button', {
            type: 'button',
            className: 'fz3-set-switch',
            'data-on': dragPref ? '1' : '0',
            'aria-pressed': !!dragPref,
            onClick: toggleDrag,
          }),
        ),
        h(
          'div',
          { className: 'fz3-set-row' },
          h(
            'div',
            null,
            h('div', { className: 'fz3-set-label' }, '显示眼徽'),
            h(
              'div',
              { className: 'fz3-set-desc' },
              eyeHidden
                ? '已隐藏：眼徽和用量气泡都不再出现，随时能在这里重新打开'
                : '停在会话区左缘，可以拖着走，也可以随时隐藏',
            ),
          ),
          h('button', {
            type: 'button',
            className: 'fz3-set-switch',
            'data-on': eyeHidden ? '0' : '1',
            'aria-pressed': !eyeHidden,
            onClick: toggleEye,
          }),
        ),
        h(
          'div',
          { className: 'fz3-set-row' },
          h(
            'div',
            null,
            h('div', { className: 'fz3-set-label' }, '毛玻璃模糊度'),
            h('div', { className: 'fz3-set-desc' }, '侧栏、输入框、卡片背后磨砂的强度；0 = 只留半透明底板，不做模糊'),
          ),
          h(
            'div',
            { className: 'fz3-set-range-wrap' },
            h('input', {
              type: 'range',
              className: 'fz3-set-range',
              min: GLASS_MIN,
              max: GLASS_MAX,
              step: 1,
              value: glassBlur,
              'aria-label': '毛玻璃模糊度',
              onChange: (event) => changeGlass(event.target.value),
            }),
            h('span', { className: 'fz3-set-val' }, glassBlur + 'px'),
          ),
        ),
        /* 学习代办显隐：打开 = 侧栏脚部显示那张卡片，关闭 = 不显示 */
        h(
          'div',
          { className: 'fz3-set-row' },
          h(
            'div',
            null,
            h('div', { className: 'fz3-set-label' }, '学习代办'),
            h(
              'div',
              { className: 'fz3-set-desc' },
              todoShowOn
                ? '已打开：侧栏脚部显示「绳匠满级之路」卡片，点表头展开清单' +
                  (todoState.items.filter((item) => !item.done).length === 0
                    ? ''
                    : '（还有 ' + String(todoState.items.filter((item) => !item.done).length) + ' 条没做完）')
                : '已关闭：侧栏不再显示这张卡片，随时能在这里重新打开（清单数据仍在这台机器上）',
            ),
          ),
          h('button', {
            type: 'button',
            className: 'fz3-set-switch',
            'data-on': todoShowOn ? '1' : '0',
            'aria-pressed': todoShowOn,
            onClick: () => todoShow.set(!todoShowOn),
          }),
        ),
        /* 「已完成」分组默认态（2026-11-26 主人要求默认收起）：
           这一项只决定卡片打开时的初始状态，手动点箭头随时能展开。 */
        h(
          'div',
          { className: 'fz3-set-row' },
          h(
            'div',
            null,
            h('div', { className: 'fz3-set-label' }, '已完成默认展开'),
            h(
              'div',
              { className: 'fz3-set-desc' },
              todoDoneOn
                ? '已打开：每次展开卡片都直接列出「已完成」清单（当前 ' + String(todoState.archive.length) + ' 条）'
                : '已收起：卡片默认只列待办，点「已完成」那一行才展开清单（当前 ' + String(todoState.archive.length) + ' 条）',
            ),
          ),
          h('button', {
            type: 'button',
            className: 'fz3-set-switch',
            'data-on': todoDoneOn ? '1' : '0',
            'aria-pressed': todoDoneOn,
            onClick: () => todoDoneOpen.set(!todoDoneOn),
          }),
        ),
        h(
          'div',
          { className: 'fz3-set-row' },
          h(
            'div',
            null,
            h('div', { className: 'fz3-set-label' }, '外观'),
            h(
              'div',
              { className: 'fz3-set-desc' },
              themeMode === 'auto'
                ? '跟随 DSH 外观；如果浅色下仍有看不清的字，可以直接强制深色'
                : themeMode === 'dark'
                  ? '已强制深色：无论 DSH 用哪种外观，皮肤都按深色渲染'
                  : '已强制浅色：适合把 DSH 也切到浅色时使用',
            ),
          ),
          h('div', { className: 'fz3-set-seg' }, seg('auto', '跟随'), seg('dark', '深色'), seg('light', '浅色')),
        ),
        /* 2026-11-23：设置页「主题校验」卡片按主人要求移除；自检逻辑本身保留，只是不再有 UI 入口。 */
        h(
          'div',
          { className: 'fz3-set-row' },
          h('div', null, h('div', { className: 'fz3-set-label' }, '语音引擎'), h('div', { className: 'fz3-set-desc' }, engineText)),
          h('span', { className: 'fz3-set-dot' + (ready ? ' is-on' : enginePhase === 'loading' ? ' is-wait' : ' is-off') }),
        ),
        h(
          'div',
          { className: 'fz3-set-row is-stack' },
          h(
            'div',
            null,
            h('div', { className: 'fz3-set-label' }, '语音引擎目录'),
            h(
              'div',
              { className: 'fz3-set-desc' },
              voiceInfo && voiceInfo.ok
                ? (voiceInfo.source === 'settings' ? '已指定：' : voiceInfo.source === 'env' ? '来自环境变量：' : voiceInfo.source === 'portable' ? '便携包自带：' : '旧变量：') + (voiceInfo.home || '')
                : (voiceInfo && voiceInfo.reason) || '选一个装好 GPT-SoVITS 的目录，整个目录搬去哪都行',
            ),
          ),
          h(
            'div',
            { className: 'fz3-set-path' },
            h('input', {
              type: 'text',
              className: 'fz3-set-input',
              value: voiceHome,
              spellCheck: false,
              placeholder: '例如 D:\\Fairy\\tts 或 /opt/fairy-tts',
              onChange: (event) => setVoiceHome(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') saveVoiceHome(voiceHome)
              },
            }),
            h(
              'button',
              { type: 'button', className: 'fz3-set-btn', onClick: () => saveVoiceHome(voiceHome), disabled: voiceHomeBusy === 'save' },
              voiceHomeBusy === 'save' ? '保存中…' : '保存',
            ),
            h(
              'button',
              { type: 'button', className: 'fz3-set-btn is-ghost', onClick: loadVoiceHome },
              '检测',
            ),
            h(
              'button',
              { type: 'button', className: 'fz3-set-btn is-ghost', onClick: () => saveVoiceHome('') },
              '清除',
            ),
          ),
        ),
        h(
          'div',
          { className: 'fz3-set-actions' },
          h('button', { type: 'button', className: 'fz3-set-btn', onClick: () => controlEngine('start'), disabled: engineBusy === 'start' || ready }, engineBusy === 'start' ? '启动中…' : '启动引擎'),
          h('button', { type: 'button', className: 'fz3-set-btn is-ghost', onClick: () => controlEngine('stop'), disabled: engineBusy === 'stop' || !ready }, '停止引擎'),
          h('button', { type: 'button', className: 'fz3-set-btn is-ghost', onClick: ping }, '刷新状态'),
        ),
        h(
          'div',
          { className: 'fz3-set-actions' },
          h('button', { type: 'button', className: 'fz3-set-btn', onClick: playGreet }, '试听问候'),
          h('button', { type: 'button', className: 'fz3-set-btn is-ghost', onClick: resetDockPos, disabled: !hasCustomPos }, '眼标复位'),
          h('button', { type: 'button', className: 'fz3-set-btn', onClick: testVoice, disabled: busy }, '测试语音'),
          h('button', { type: 'button', className: 'fz3-set-btn is-ghost', onClick: stopSpeech, disabled: !busy }, '停止'),
        ),
        h('div', { className: 'fz3-set-note' }, 'Fairy 皮肤 · 待机随机眨眼与花屏、思考态眼睑呼吸，开关都在这里；对话区左缘的眼标可以拖动（开关见上），只作状态指示，不弹出面板。'),
      )
    }

    function BrandMark() {
      return h(
        'span',
        { className: 'fz3-brandmark', 'aria-hidden': 'true' },
        h('span', {
          className: 'fz3-brandmark-eye',
          'aria-hidden': 'true',
          dangerouslySetInnerHTML: { __html: FAIRY_EYE_SVG },
        }),
      )
    }

    function BrandName() {
      return h(
        'span',
        { className: 'fz3-brandname fz3-brandname-row' },
        h('b', null, 'H.D.D.System'),
        h(ThemeToggle, { key: 'theme-toggle' }),
      )
    }

    /* 侧边栏「应用」那一排的深浅色切换按钮（本地新增）：
       只切 Fairy 自己的皮肤（fairy.zzz.theme-mode），不改宿主的外观设置；
       与设置页里的「深色 / 浅色 / 跟随」共用同一个存储键，点一下就派发 fz3:theme-pref 让皮肤重算。 */
    function ThemeToggle() {
      const resolve = () => {
        try {
          const forced = readStored(THEME_KEY, 'auto')
          if (forced === 'light' || forced === 'dark') return forced
        } catch {}
        try {
          return document.documentElement.dataset.fz3Theme === 'light' ? 'light' : 'dark'
        } catch {}
        return 'dark'
      }
      const [mode, setMode] = useState(resolve)
      useEffect(() => {
        const sync = () => setMode(resolve())
        try { window.addEventListener('fz3:theme-pref', sync) } catch {}
        /* 自动切换（宿主改外观）不经过 fz3:theme-pref，跟随自检报告同步图标 */
        try { window.addEventListener('fz3:theme-report', sync) } catch {}
        return () => {
          try { window.removeEventListener('fz3:theme-pref', sync) } catch {}
          try { window.removeEventListener('fz3:theme-report', sync) } catch {}
        }
      }, [])
      const next = mode === 'light' ? 'dark' : 'light'
      const label = mode === 'light' ? '切换为深色' : '切换为浅色'
      const glyph =
        mode === 'light'
          ? [
              h('circle', { key: 'sun-core', cx: '12', cy: '12', r: '4.1' }),
              h('path', {
                key: 'sun-rays',
                d: 'M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5L17 7M7 17l-1.5 1.5',
              }),
            ]
          : h('path', { key: 'moon', d: 'M20.1 14.6A8.4 8.4 0 1 1 9.4 3.9a6.6 6.6 0 0 0 10.7 10.7Z' })
      return h(
        'button',
        {
          type: 'button',
          className: 'fz3-theme-toggle',
          'data-mode': mode,
          title: label,
          'aria-label': label,
          onClick: (event) => {
            try { event.preventDefault() } catch {}
            try { event.stopPropagation() } catch {}
            try { writeStored(THEME_KEY, next) } catch {}
            try { window.dispatchEvent(new CustomEvent('fz3:theme-pref')) } catch {}
            setMode(next)
          },
        },
        h(
          'svg',
          {
            viewBox: '0 0 24 24',
            width: '15',
            height: '15',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '1.6',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true',
          },
          glyph,
        ),
      )
    }

    /* 新建对话页 hero 标题前的品牌徽：2026-11-22 起主人不要这个静态小图标了 ——
       眼徽本体停在标题上方（深浅色都悬在「深潜」两字中心的正上方，见 FairySkin 里的 placeHero），这里只留一个
       空 span 占住插槽（返回 null 怕宿主的 slot 把 fallback 鱼标又渲出来），
       外层 fishHitbox 由 CSS 收起。
       注意不能退回成「渲染 SVG 再 display:none」：眼徽的渐变/裁剪是按 id 引用的，
       多一份不可见的副本会让引用失效。 */
    function HeroMark() {
      return h('span', { className: 'fz3-hero-mark', 'aria-hidden': 'true' })
    }

    function Waveform({ on }) {
      return h(
        'span',
        { className: 'fz3-wave' + (on ? ' on' : '') },
        h('i'),
        h('i'),
        h('i'),
        h('i'),
      )
    }

    /* ------------------------------------------------------------------ *
     * ———————————— */
    function VoiceAction(props) {
      const ref = useRef(null)
      const state = useVoice()
      const messageId = props && props.messageId
      const mode = state.busy ? 'busy' : state.speaking ? 'play' : 'idle'

      useEffect(() => {
        autoRead(ref.current, messageId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      const onClick = useCallback(() => {
        if (state.busy || state.speaking) {
          stopSpeech()
          return
        }
        speakText(readMessageText(ref.current), { force: true })
      }, [state.busy, state.speaking])

      return h(
        'button',
        {
          ref,
          type: 'button',
          className: 'fz3-voice',
          'data-state': mode,
          title: mode === 'busy' ? 'Fairy 正在组织声带…' : '让 Fairy 念出来',
          'aria-label': 'Fairy 朗读',
          onClick,
        },
        h(
          'svg',
          { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' },
          h('path', { d: 'M4 9.5v5a1 1 0 0 0 1 1h2.6l3.6 3.1a1 1 0 0 0 1.7-.8V6.2a1 1 0 0 0-1.7-.8L7.6 8.5H5a1 1 0 0 0-1 1Z' }),
          h('path', { d: 'M16 8.6a4.6 4.6 0 0 1 0 6.8' }),
          h('path', { d: 'M18.8 6a8 8 0 0 1 0 12' }),
        ),
      )
    }

    /* ------------------------------------------------------------------ *
     * 背景氛围层 */
    function Atmos() {
      return h(
        'div',
        { className: 'fz3-atmos', 'aria-hidden': 'true' },
        h('div', { className: 'fz3-atmos-glow' }),
        /* 右上角光斑已移除（原来是 .fz3-atmos-flash + fz3-flash 11s 阶梯闪烁）。
           想恢复：把下面这行的注释去掉即可。 */
        // h('div', { className: 'fz3-atmos-flash' }),
        h('div', { className: 'fz3-atmos-sweep' }),
        h('div', { className: 'fz3-atmos-frame' }),
        h('div', { className: 'fz3-rim' }),
        h('div', { className: 'fz3-bay' }),
      )
    }

    /* ------------------------------------------------------------------ *
     * 主界面：居中问好→左下坞
     * 问候语按 Fairy 人设重写（2026-11-22）：自称 Fairy、称对方「主人」，
     * 冷静的陈述句 + 数据 + 轻毒舌，不撒娇不卖萌。按时段取一句。 */
    function greetLine() {
      const hh = new Date().getHours()
      if (hh >= 5 && hh < 11) {
        return '检测到主人已上线。Fairy 自检完成，可用算力 100%。今天的第一件事，建议交给本系统。'
      }
      if (hh >= 11 && hh < 14) {
        return '午间时段。Fairy 检测到主人尚未进食。结论：压缩包能解，胃不能。'
      }
      if (hh >= 14 && hh < 18) {
        return '下午好。Fairy 的效率稳定在 99.98%。主人的摸鱼指数，正在采样。'
      }
      if (hh >= 18 && hh < 23) {
        return '晚间。Fairy 已切换到夜班模式——本系统不需要睡眠，主人需要。'
      }
      return '深夜 0 点后仍检测到主人活动。Fairy 的功耗不受影响，主人的肝会。请自行权衡。'
    }


    /* 气泡：usage 态给「余额 / 今日花费 / 峰谷」，turn 态只给「本轮花费 / 峰谷」 */
    function BubbleCard({ data, onMeasure, onFlip }) {
      const { mode, x, y, side, loading, usage, balance } = data
      const peak = usage && usage.peak
      const bucket = usage ? (mode === 'turn' ? usage.turn : usage.today) : null
      const rows = []

      /* 把真实尺寸交给父层，翻面/夹边都按实际宽高算，不会盖到眼徽 */
      const boxRef = useRef(null)
      const lastSize = useRef({ w: 0, h: 0 })
      useLayoutEffect(() => {
        const el = boxRef.current
        if (!el || typeof onMeasure !== 'function') return
        const w = el.offsetWidth
        const h = el.offsetHeight
        if (w === lastSize.current.w && h === lastSize.current.h) return
        lastSize.current = { w, h }
        onMeasure({ w, h })
      })

      /* 峰谷剩余时间：每秒走一格，换价瞬间归零 */
      const [nowTick, setNowTick] = useState(() => Date.now())
      const nextAt = peak && peak.nextAt ? peak.nextAt : 0
      useEffect(() => {
        if (!nextAt) return undefined
        setNowTick(Date.now())
        const timer = setInterval(() => setNowTick(Date.now()), 1000)
        return () => clearInterval(timer)
      }, [nextAt])

      const left = nextAt ? nextAt - nowTick : 0

      /* 倒计时归零 = 刚换了价：让父层重新拉一次，峰谷标签与花费跟着翻面 */
      const flipFired = useRef(0)
      useEffect(() => {
        if (!nextAt || left > 0 || flipFired.current === nextAt) return
        flipFired.current = nextAt
        if (typeof onFlip === 'function') onFlip(mode)
      }, [left, nextAt, mode, onFlip])

      if (mode === 'usage') {
        rows.push(['余额', loading ? '…' : balance && balance.ok ? yuan(balance.amount) : '读取失败'])
        rows.push(['今日花费', loading ? '…' : bucket ? yuan(bucket.cost) : '—'])
      } else {
        rows.push(['本轮花费', loading ? '…' : bucket ? yuan(bucket.cost) : '—'])
      }
      const tone = peak && peak.offPeak ? 'valley' : 'peak'
      rows.push([
        '峰谷',
        loading
          ? '…'
          : peak
            ? nextAt && left > 0
              ? h(
                  'span',
                  { className: 'fz3-peak' },
                  h('span', { className: 'fz3-peak-badge', 'data-tone': tone }, peak.offPeak ? '谷' : '峰'),
                  h('span', { className: 'fz3-peak-clock', 'data-tone': tone }, clockText(left)),
                )
              : peak.label
            : '—',
      ])

      const detail = []
      if (bucket && bucket.calls) {
        detail.push(
          `${bucket.calls} 次请求 · ${tokensText(bucket.hit)} 命中 / ${tokensText(bucket.miss)} 未命中 / ${tokensText(bucket.out)} 输出`,
        )
      }
      if (peak) {
        const flip = peak.offPeak ? '高峰' : '空闲'
        detail.push(
          nextAt
            ? left > 0
              ? `${peak.window} · 后转${flip}价`
              : `${peak.window} · 换价时刻已到，正在刷新`
            : `${peak.window} · ${peak.next}`,
        )
      }
      if (mode === 'usage' && !loading && balance && !balance.ok && balance.reason) detail.push(balance.reason)

      return h(
        'div',
        {
          ref: boxRef,
          className: 'fz3-bubble',
          'data-mode': mode,
          'data-side': side || 'right',
          'data-loading': loading ? '1' : '0',
          style: { left: x + 'px', top: y + 'px' },
        },
        h('div', { className: 'fz3-bubble-head' }, mode === 'turn' ? 'Fairy · 本轮结算' : 'Fairy · Token'),
        rows.map(([k, v]) => h('div', { className: 'fz3-bubble-row', key: k }, h('span', { className: 'fz3-bubble-k' }, k), h('span', { className: 'fz3-bubble-v' }, h('b', null, v)))),
        detail.length ? h('div', { className: 'fz3-bubble-sub' }, detail.map((line, i) => h('div', { key: i }, line))) : null,
      )
    }

    function FairySkin() {
      /* 直接进居中问好：开机动画已移除。同一次页面加载里只问好一次，
         之后组件重挂载（切会话等）直接落到左下坞。 */
      /* 初始一律进主界面；要不要补播问候，由下面按「主进程运行标识」判断。
         这样刷新页面不会重播问候，只有主进程重启（真正的"打开客户端"）才播一次。 */
      const [phase, setPhase] = useState('dock')
      useEffect(() => {
        /* 「开屏问候只在第一次打开客户端时播一次」：
           主进程在 /fairy-zzz/health 里返回 runId（pid + 启动时间）。
           客户端把它记进 localStorage —— 只有 runId 变了（主进程真的重启过）才播。
           于是：刷新页面、热重载、换会话都不会重播；关掉客户端再开才播一次。 */
        const KEY = 'fairy.zzz.greet-run'
        let alive = true
        fetch('/fairy-zzz/health', { cache: 'no-store' })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!alive || !data) return
            const runId = String(data.runId || '')
            let last = ''
            try { last = localStorage.getItem(KEY) || '' } catch (e) { last = '' }
            if (runId !== '' && runId !== last) {
              try { localStorage.setItem(KEY, runId) } catch (e) { /* 隐私模式忽略 */ }
              greeted = true
              setPhase('greet')
            }
          })
          .catch(() => { /* 拿不到就不播，避免反复弹 */ })
        return () => { alive = false }
      }, [])

      /* 运行态情绪：宿主 /fairy-zzz/mood 轮询（idle / thinking / working / done） */
      const [mood, setMood] = useState('idle')

      /* 眼徽拖拽：开关与坐标都放 localStorage，设置页改开关时靠事件通知这里 */
      const [dragOn, setDragOn] = useState(() => readBool(DRAG_KEY, true))
      const [eyeHidden, setEyeHidden] = useState(() => readBool(EYE_KEY, false))
      const [dragging, setDragging] = useState(false)
      const [customPos, setCustomPos] = useState(() => {
        /* 定位规则改成「固定在侧栏右侧」后，旧的拖拽坐标作废一次（之后重新拖动仍会记住） */
        try {
          if (localStorage.getItem('fairy.zzz.dock-pos.v2') !== '1') {
            localStorage.removeItem(POS_KEY)
            localStorage.setItem('fairy.zzz.dock-pos.v2', '1')
            return null
          }
        } catch (e) { /* 隐私模式忽略 */ }
        const saved = readStored(POS_KEY, null)
        return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : null
      })
      /* 复位令牌：customPos 已经是 null 时再 setCustomPos(null) 不会触发重渲染，
         定位 effect 也就不会重跑，「复位」看起来就像没反应。用它强制重算一次。 */
      const [resetTick, setResetTick] = useState(0)
      const dragRef = useRef(null)

      /* 用量气泡：null = 收起；mode = 'usage'（余额·今日·峰谷）| 'turn'（本轮·峰谷） */
      const [bubble, setBubble] = useState(null)
      /* 朗读摘要气泡：speakText 每念一段就推一段文字过来 */
      const [say, setSay] = useState('')
      const bubbleTimer = useRef(null)
      const bubbleSize = useRef({ w: 236, h: 162 })

      const closeBubble = useCallback(() => {
        if (bubbleTimer.current) {
          clearTimeout(bubbleTimer.current)
          bubbleTimer.current = null
        }
        setBubble(null)
      }, [])

      /* 气泡挂点：右侧放不下（会越出右边界）就翻到眼徽左侧，垂直始终跟着眼徽中心 */
      const bubblePlace = useCallback((rect) => {
        const W = bubbleSize.current.w || 236
        const H = bubbleSize.current.h || 162
        const gap = 16
        const margin = 12
        const flip = rect.right + gap + W > window.innerWidth - margin
        const raw = flip ? rect.left - gap - W : rect.right + gap
        return {
          x: Math.round(Math.min(Math.max(raw, margin), Math.max(margin, window.innerWidth - W - margin))),
          y: Math.round(
            Math.min(Math.max(rect.top + rect.height / 2, H / 2 + 8), Math.max(H / 2 + 8, window.innerHeight - H / 2 - 8)),
          ),
          side: flip ? 'left' : 'right',
        }
      }, [])

      const openBubble = useCallback(async (mode) => {
        const el = coreRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        /* 气泡默认挂在眼徽右侧；右边放不下就整体翻到左侧，上下越界再回收 */
        const pos = bubblePlace(r)
        setBubble({ mode, ...pos, loading: true })
        if (bubbleTimer.current) {
          clearTimeout(bubbleTimer.current)
          bubbleTimer.current = null
        }
        const [usage, balance] = await Promise.all([fetchUsage(), mode === 'usage' ? fetchBalance() : Promise.resolve(null)])
        setBubble((prev) => (prev && prev.mode === mode ? { ...prev, ...pos, loading: false, usage, balance } : prev))
        /* 两种用量气泡都只停留 3 秒（原来是「本轮结算」18 秒、手动打开的不关） */
        bubbleTimer.current = setTimeout(() => {
          bubbleTimer.current = null
          setBubble((prev) => (prev && prev.mode === mode ? null : prev))
        }, 3_000)
      }, [])

      /* 气泡跟随眼徽：眼徽会被拖拽、侧栏开合、窗口缩放重新定位，
         而气泡原来只在打开那一刻算一次坐标，眼徽一移它就掉队。
         气泡可见期间用 rAF 跟踪眼徽当前矩形，位置有变化才更新状态。 */
      useEffect(() => {
        if (!bubble) return undefined
        let raf = 0
        const tick = () => {
          const el = coreRef.current
          if (el !== null) {
            const next = bubblePlace(el.getBoundingClientRect())
            setBubble((prev) =>
              prev && (prev.x !== next.x || prev.y !== next.y || prev.side !== next.side) ? { ...prev, ...next } : prev,
            )
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
      }, [bubble !== null, bubblePlace])

      /* 自动弹出的「本轮结算」要排到朗读之后：每次排队领一个号，
         等这一轮朗读结束再弹；期间又排了新队就让旧的作废 */
      const turnTicket = useRef(0)
      const openTurnBubbleWhenQuiet = useCallback(() => {
        const ticket = ++turnTicket.current
        whenSpeechDone().then(() => {
          if (ticket !== turnTicket.current) return
          openBubble('turn')
        })
      }, [openBubble])

      const clampPos = useCallback((x, y) => {
        const root = document.documentElement
        const size = parseFloat(getComputedStyle(root).getPropertyValue('--fz3-dock-size')) || 64
        const half = size / 2 + 4
        return {
          x: Math.round(Math.min(Math.max(Number(x) || 0, half), window.innerWidth - half)),
          y: Math.round(Math.min(Math.max(Number(y) || 0, half), window.innerHeight - half)),
        }
      }, [])

      const applyPos = useCallback((p) => {
        const root = document.documentElement
        root.style.setProperty('--fz3-dock-x', p.x + 'px')
        root.style.setProperty('--fz3-dock-y', p.y + 'px')
      }, [])

      useEffect(() => {
        /* 字标位置与显隐：ResizeObserver 盯官方 logo 行、MutationObserver 盯侧栏挂载/卸载，
           侧栏一收起（行消失或宽度 ≤60px）字标立刻隐藏，没有轮询延迟。 */
        let row = null
        let ro = null
        let scheduled = false
        const brand = () => document.querySelector('.fz3-sb-brand')
        const apply = () => {
          const el = brand()
          const r = row === null ? null : row.getBoundingClientRect()
          const visible = r !== null && r.width > 60 && r.height > 0
          if (el !== null) {
            /* 只能用 visibility 隐藏，绝对不能用 display:none：这份字标里的 SVG 带着
               渐变/裁剪定义，是页面里的第一份副本；display:none 会让它退出渲染树，
               dock 眼徽按 ID 引用的渐变随之失效 —— 表现就是「收起侧栏后蓝色外圈没了」 */
            el.style.visibility = visible ? '' : 'hidden'
            el.style.pointerEvents = visible ? '' : 'none'
          }
          if (!visible) return
          const root = document.documentElement
          root.style.setProperty('--fz3-brand-top', Math.round(r.top - 6) + 'px')
          root.style.setProperty('--fz3-brand-left', Math.round(r.left) + 'px')
          root.style.setProperty('--fz3-brand-h', Math.round(Math.max(40, r.height + 12)) + 'px')
        }
        const bind = () => {
          const next = document.querySelector('[class*="_brandIdentity"]') || document.querySelector('[class*="_logoRow"]')
          if (next !== row) {
            row = next
            if (ro !== null) { ro.disconnect(); ro = null }
            if (row !== null && typeof ResizeObserver !== 'undefined') {
              ro = new ResizeObserver(() => apply())
              ro.observe(row)
            }
          }
          apply()
        }
        const schedule = () => {
          if (scheduled) return
          scheduled = true
          requestAnimationFrame(() => { scheduled = false; try { bind() } catch (e) { /* 静默 */ } })
        }
        bind()
        const mo = new MutationObserver(schedule)
        mo.observe(document.body, { childList: true, subtree: true })
        return () => { mo.disconnect(); if (ro !== null) ro.disconnect() }
      }, [])
      /* ———————————— 「更多」菜单改为侧栏右侧弹出 + 灰气泡描边 ————————————
         宿主用的是 portal 浮层，位置由 Menu 自己算；这里在它出现时覆写定位：
         贴侧栏右缘往外弹，顶边与「更多」那一行对齐，宽同面板，
         并套上和气泡一致的 5px #595959 描边 + 毛玻璃底。 */
      useEffect(() => {
        if (typeof document === 'undefined') return undefined
        const MENU_SEL = '[class*="_moreMenu"]'
        const PANEL_SEL = '[class*="_panelList"]'
        const place = () => {
          const menu = document.querySelector(MENU_SEL)
          if (menu === null) return
          const s = menu.style
          const set = (k, v) => s.setProperty(k, v, 'important')
          const panel = document.querySelector(PANEL_SEL)
          const trigger = panel === null ? null : panel.querySelector('button[aria-haspopup="menu"]')
          /* 找不到锚点也不能让它一直隐身：直接显示，交回宿主自己的定位 */
          if (panel === null || trigger === null) { set('visibility', 'visible'); return }
          const pr = panel.getBoundingClientRect()
          const tr = trigger.getBoundingClientRect()
          const cs = getComputedStyle(document.documentElement)
          const edge = parseFloat(cs.getPropertyValue('--fz3-edge-w')) || 5
          const color = (cs.getPropertyValue('--fz3-edge') || '#595959').trim()
          const glass = (cs.getPropertyValue('--fz3-glass-menu') || 'rgba(28,28,32,.95)').trim()
          const blurRaw = parseFloat(cs.getPropertyValue('--fz3-glass-blur'))
          const blur = Number.isFinite(blurRaw) ? blurRaw : 14
          set('position', 'fixed')
          set('left', Math.round(pr.right + 10) + 'px')
          set('top', Math.round(tr.top - edge) + 'px')
          set('width', Math.round(pr.width) + 'px')
          set('min-width', '0')
          set('max-width', 'none')
          set('margin', '0')
          set('transform', 'none')
          set('background', glass)
          set('-webkit-backdrop-filter', 'blur(' + blur + 'px) saturate(125%)')
          set('backdrop-filter', 'blur(' + blur + 'px) saturate(125%)')
          set('border', edge + 'px solid ' + color)
          set('border-radius', '14px')
          set('box-shadow', 'none')
          /* 定位完成，同步显示（CSS 里默认是 hidden，避免原位闪一帧） */
          set('visibility', 'visible')
        }
        const timer = setInterval(place, 500)
        /* MutationObserver 抢在首帧前定位，比 120ms 轮询快得多 */
        /* 观察器原来对每个 DOM 变更都直接跑 place()（流式输出时每秒几十次，
           每次都 querySelector + 强制布局）；改成 rAF 合并，一帧最多一次。 */
        let pending = false
        const schedulePlace = () => {
          if (pending) return
          pending = true
          requestAnimationFrame(() => { pending = false; try { place() } catch (e) { /* 静默 */ } })
        }
        const obs = new MutationObserver(schedulePlace)
        obs.observe(document.body, { childList: true, subtree: true })
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
          clearInterval(timer)
          obs.disconnect()
          window.removeEventListener('resize', place)
          window.removeEventListener('scroll', place, true)
        }
      }, [])
      
      
      /* 眨眼遮罩的全局裁剪圆：只注入一次，供 .fz3-core #fz3-lid-cover 引用 */
      useEffect(() => {
        if (typeof document === 'undefined' || document.getElementById('fz3-lid-clip-global') !== null) return
        const NS = 'http://www.w3.org/2000/svg'
        const holder = document.createElementNS(NS, 'svg')
        holder.setAttribute('width', '0')
        holder.setAttribute('height', '0')
        holder.setAttribute('aria-hidden', 'true')
        holder.style.position = 'absolute'
        holder.style.left = '-9999px'
        const clip = document.createElementNS(NS, 'clipPath')
        clip.setAttribute('id', 'fz3-lid-clip-global')
        const circle = document.createElementNS(NS, 'circle')
        circle.setAttribute('cx', '80')
        circle.setAttribute('cy', '80')
        circle.setAttribute('r', '56')
        clip.appendChild(circle)
        holder.appendChild(clip)
        document.body.appendChild(holder)
      }, [])
      useEffect(() => {
        /* hero 的标题与「预览版」徽章没有插槽，只能改写 DOM 文本：按界面语言换成
           空洞深潜系统 / HOLLOW DEEP DIVE SYSTEM 与 H.D.D 徽章。
           官方组件只在悬停等状态变化时重渲染，React 不会把这段文字改回去；
           会话切换会重挂载 hero，所以用一个低频定时器兜底重刷。 */
        if (typeof document === 'undefined') return undefined
        const apply = () => {
          const group = document.querySelector('[class*="_headline"] [class*="_titleGroup"]')
          if (!group) return
          const headline = group.querySelector('span')
          const badge = group.querySelector('[class*="_previewBadge"]')
          const zh = CJK_RE.test((headline && headline.textContent) || '')
            || CJK_RE.test((badge && badge.textContent) || '')
          const copy = zh ? HERO_COPY.zh : HERO_COPY.en
          if (headline && headline.textContent !== copy.headline) headline.textContent = copy.headline
          if (badge && badge.textContent !== copy.badge) badge.textContent = copy.badge
        }
        apply()
        /* 改写节拍跟复位延迟对齐：切回新会话页时，标题与徽章的文字越快换成 H.D.D 版，
           标题组宽度就越早落定，眼徽也就不会先按「预览版」的宽度落一次再被校正。 */
        const timer = setInterval(() => { try { apply() } catch (e) {} }, RESET_DELAY)
        return () => clearInterval(timer)
      }, [])
      useEffect(() => {
        /* dock 定位：
           · 新建对话页（hero 在）→ 悬在「空洞深潜系统」标题上方（placeHero，2026-11-22 主人要求）；
           · 侧栏展开 → 贴在面板右缘 +GAP、垂直居中；
           · 侧栏收起 → 落在「窗口左缘 ~ 内容列左缘」的 1/2 处（不再死贴最左边）。
           窗口尺寸变化时重新量；主人拖过之后其它情况用记住的坐标。
           GAP 原为 14，2026-11-21 按主人要求整体右移 8px → 22（想再调只改这个数）。 */
        if (eyeHidden) return undefined
        const root = document.documentElement
        const GAP = 22
        /* 眼徽复位位置：默认落在【窗口垂直正中】（RAISE = 0）。
           以前这里上移了「4 行文字」，看起来偏高；现在按主人要求回正。
           想再上移：把 0 换成 lineHeight * 行数，例如 lineHeight * 2。 */
        const lineHeight = parseFloat(getComputedStyle(document.body).lineHeight) || 24
        const RAISE = 0
        /* 眼徽复位位置：按窗口比例定位（不再依赖侧栏几何）
           纵向用 DOCK_Y_RATIO（0.5 = 正中）；横向按侧栏右缘与内容列左缘之间的通道计算 */
        /* DOCK_X_RATIO 已废弃：横向改回按侧栏/内容通道计算 */
        /* 纵向：0.52 = 52vh（主人 2026-11-23 定的基准；0.5 是正中）。
           这个值以前由 dsh-fairy-eye-tweak 用 !important 顶成 52vh —— 两个来源抢一个坐标，
           切换页时就会走成「先复位再横移」的两段。现在只此一处，过渡才是一条直线。 */
        const DOCK_Y_RATIO = 0.52
        /* 侧栏是否收起。不能靠类名：真实类名是 wtg9ga_collapsed（无尾下划线），
           原来的 [class*="_collapsed_"] 永远匹配不到，于是收起时总走「扫内容区」的
           兜底路径，扫到聊天正文那列就把眼徽丢到正文中间（窗口越宽、留白越多越明显）。
           这里用两条稳定的几何/CSS 信号判断。 */
        const isCollapsed = () => {
          const panel = document.querySelector('[class*="_panelList"]')
          /* 收起时宿主把这组 display:none；offsetParent 为 null 就是它 */
          if (panel !== null && panel.offsetParent === null) return true
          const row = document.querySelector('[class*="_logoRow"]') || document.querySelector('[class*="_brandIdentity"]')
          if (row === null) return false
          const host = row.parentElement || row
          const rect = host.getBoundingClientRect()
          return rect.width > 0 && rect.width < 120
        }
        /* 内容区左缘：从对话流节点往上走祖先（十几个节点），
           比 document.querySelectorAll('div,main,section') 全量扫描（几百个节点、
           每个都要强制一次布局）便宜一个数量级 —— 侧栏开合、窗口缩放时不再掉帧。
           2026-11-22 实测宿主这版 DOM 有两个坑：
             · [data-slot="conversation.chat.flow"] 这层是 display:contents，量出来 0×0，
               不能把它当成「没有内容列」；
             · 短会话的内容列（_column）只有一两百 px 高，原来的 h>=300 会把它漏掉，
               于是眼徽掉进「贴窗口最左边」的兜底位置 —— 主人看到的就是这个定位错误。
           所以零尺寸节点直接跳过，高度门槛降到 40。 */
        const areaLeft = (minLeft, maxLeft) => {
          const vw = window.innerWidth
          const limit = Math.min(maxLeft, vw * 0.5)
          let node = document.querySelector('[data-slot="conversation.chat.flow"]')
            || document.querySelector('[data-conversation-scroll]')
          let best = -1
          let hops = 0
          while (node !== null && node !== document.body && hops < 24) {
            const r = node.getBoundingClientRect()
            if (r.width >= 400 && r.height >= 40 && r.width <= vw * 0.88) {
              const left = r.left
              if (left >= minLeft && left <= limit && (best < 0 || left < best)) best = left
            }
            node = node.parentElement
            hops += 1
          }
          return best
        }
        /* 侧栏收起（或窗口里根本没有侧栏）：眼徽落在「窗口左缘 ~ 内容列左缘」这条空白带的
           1/2 处（比值取 --fz3-eye-gap-ratio，0.5 = 正中），不再死贴窗口最左边。
           量不到内容列（比如首帧 DOM 还没出来）才退回贴边，避免飞到正文里。 */
        const placeLeft = () => {
          const size = parseFloat(getComputedStyle(root).getPropertyValue('--fz3-dock-size')) || 64
          const rawRatio = parseFloat(getComputedStyle(root).getPropertyValue('--fz3-eye-gap-ratio'))
          const ratio = Number.isFinite(rawRatio) ? Math.min(Math.max(rawRatio, 0), 1) : 0.5
          const left = areaLeft(40, 1e9)
          const x = left < 60 ? size / 2 + 8 : left * ratio
          root.style.setProperty('--fz3-dock-x', Math.round(x) + 'px')
          root.style.setProperty('--fz3-dock-y', Math.round(window.innerHeight * DOCK_Y_RATIO - RAISE) + 'px')
        }
        /* 新建对话页（hero）：眼徽复位到标题上方当品牌徽。
           2026-11-22 主人先指着标题前那个位置说「眼徽复位到这里」，原来那个 34px 的
           静态小眼标已经删掉（HeroMark 只留空 span + CSS 收起 _fishHitbox）；
           同一天又要「放到深潜俩字中间的正上方」：浅色先改，随后要求深色也改到同一处
           —— 所以现在深 / 浅两套主题共用这一个锚点，heroTarget 里不再按主题分叉。
           横向 = 标题文字中心；纵向 = 文字行顶 - HERO_TOP_GAP - 半个眼徽。
           量的是 _titleGroup 里的文字 span 而不是它外层的 _headline ——
           外层是 align-items:stretch 拉满整列的 flex 容器，它的左缘是内容列边缘，
           不是标题文字（拿它当锚点眼徽会跑到正文左边去）。
           标题量不到（已经进入对话）就返回 false，继续走侧栏 / 贴边那套老逻辑。 */
        /* 眼徽悬在标题上方的净空：眼徽下缘 ~ 标题文字行顶（深 / 浅色一致） */
        const HERO_TOP_GAP = 10
        const heroRow = heroRect
        /* 标题文字（「空洞深潜系统」那一个 span）的矩形。
           横向居中必须按**文字**量，不能按 _titleGroup —— 组里右边还挂着
           「H.D.D Ⅲ」徽章，按组居中会整体偏右半个徽章。 */
        const heroText = () => {
          const el = document.querySelector('[class*="_headline"] [class*="_titleGroup"]>span:first-child')
          if (el === null) return null
          const r = el.getBoundingClientRect()
          if (!(r.width > 40 && r.height > 8)) return null
          return { rect: r, ls: parseFloat(getComputedStyle(el).letterSpacing) || 0 }
        }
        /* 标题锚点的目标坐标（含当前档位的半个眼徽），量不到就 null。
           「深潜」正好是「空洞深潜系统」的第 3、4 个字，六个等宽字时它们的中心
           就是整段标题文字的中心 —— 所以横向取文字矩形中心（扣掉末字后面那份字距，
           字距 .06em 在最后一个字后面也留了一份，不减会偏右半份），
           纵向取「文字行顶 − HERO_TOP_GAP − 半个眼徽」，眼徽下缘正好悬在标题上沿。
           深色与浅色走同一套算法：主题只改配色，不移动标题。 */
        const heroTarget = () => {
          const r = heroRow()
          if (r === null) return null
          const size = parseFloat(getComputedStyle(root).getPropertyValue('--fz3-dock-size')) || 64
          const half = size / 2
          const edge = half + 4
          const text = heroText()
          const box = text === null ? r : text.rect
          const cx = box.left + box.width / 2 - (text === null ? 0 : text.ls / 2)
          return {
            x: Math.round(Math.min(Math.max(cx, edge), window.innerWidth - edge)),
            y: Math.round(box.top - HERO_TOP_GAP - half),
          }
        }
        const placeHero = () => {
          const t = heroTarget()
          if (t === null) return false
          /* 这里**不**关过渡：主人明确要求「我需要过渡」，眼徽要滑到标题那边。
             之前那版「两段动作」的病根不在过渡本身，而是落了两次位
             （第一次量到的是内容列还在做 0.3s 宽度过渡、标题徽章还没改写的半路位置）。
             现在由下面 heroWatch 的稳定性门槛保证「只落一次」，过渡留着一整段走完。 */
          root.style.setProperty('--fz3-dock-x', t.x + 'px')
          root.style.setProperty('--fz3-dock-y', t.y + 'px')
          return true
        }
        /* 侧栏右缘：优先用侧栏列本身（宿主固定类名 _sidebarCol，最稳），
           退而求其次才用面板列表 —— 面板列表在大窗口/工具栏收纳时可能量不到，
           那样眼徽就会退回「内容列左缘 + GAP」，直接压到正文上（最大化时就是这样）。 */
        const sidebarRight = () => {
          const col = document.querySelector('[class*="_sidebarCol"]')
          if (col) {
            const r = col.getBoundingClientRect()
            if (r.width > 120 && r.right > 60) return r.right
          }
          const side = document.querySelector('[class*="_panelList"]')
            || document.querySelector('[class*="_scrollRegion"]')
            || document.querySelector('[class*="_regionArea"]')
          if (side) {
            const r = side.getBoundingClientRect()
            if (r.width > 120 && r.right > 60) return r.right
          }
          return -1
        }
        const measure = () => {
          const size = parseFloat(getComputedStyle(root).getPropertyValue('--fz3-dock-size')) || 64
          const y = Math.round(window.innerHeight * DOCK_Y_RATIO - RAISE) + 'px'
          if (isCollapsed()) { placeLeft(); return true }
          const sr = sidebarRight()
          if (sr < 0) { placeLeft(); return true }
          const left = areaLeft(sr + 8, 1e9)
          /* 有内容列左缘 → 落在「侧栏右缘 ~ 内容列左缘」这条通道的正中；
             量不到内容列 → 贴着侧栏右缘放（GAP 可调）。 */
          /* 横向位置 = a + (b - a) × 比值。
             a = 侧栏右缘（sr），b = 内容列左缘（left），比值取自 --fz3-eye-gap-ratio。
             0.5 就是两者正中；越接近 0 越贴侧栏。 */
          const rawRatio = parseFloat(getComputedStyle(root).getPropertyValue('--fz3-eye-gap-ratio'))
          const ratio = Number.isFinite(rawRatio) ? Math.min(Math.max(rawRatio, 0), 1) : 0.5
          /* 两侧栏同开 + 窗口偏小 → 贴着左侧栏右边 10px 放，
             这时中间通道很窄，居中会压到正文。 */
          const rightCol = document.querySelector('[class*="_rightbarCol"]')
          const rightRect = rightCol ? rightCol.getBoundingClientRect() : null
          const twoSidebars =
            window.innerWidth < 1920 &&
            window.innerHeight < 1080 &&
            rightRect !== null &&
            rightRect.width >= 120
          if (twoSidebars) {
            const xEdge = sr + 10 + size / 2
            root.style.setProperty('--fz3-dock-x', Math.round(xEdge) + 'px')
            root.style.setProperty('--fz3-dock-y', y)
            return true
          }
          /* 横向 = a + (b - a) × 比值：a 侧栏右缘，b 内容列左缘，
             比值来自 --fz3-eye-gap-ratio（0.5 = 通道正中）。 */
          const x = left > sr + 40 ? sr + (left - sr) * ratio : sr + GAP + size / 2
          root.style.setProperty('--fz3-dock-x', Math.round(x) + 'px')
          root.style.setProperty('--fz3-dock-y', y)
          return true
        }
        const apply = () => {
          /* 已经判定在新会话页：位置一律由标题锚点决定，其它复位路径谁拖过都不算。 */
          if (onHero) {
            placeHero()
            return true
          }
          /* 新建对话页刚出现、还在等布局落定的那一两个节拍里，别的复位路径也别抢着落位 ——
             否则会先落到半路位置、再被校正一次，看起来就是「两段动作」。 */
          if (heroRect() !== null) return true
          if (isCollapsed()) { placeLeft(); return true }
          if (customPos) { applyPos(clampPos(customPos.x, customPos.y)); return true }
          return measure()
        }
        /* 新建对话页 ↔ 对话页切换：hero 标题行出现/消失时重排一次。
           不做 MutationObserver：流式回复时 DOM 每秒变几十次，每次都量一遍布局太贵。
           按 RESET_DELAY（和其他复位路径同一个时间）廉价轮询，只写 CSS 变量：
             · hero 出现 → 等布局落定（目标在两个节拍内基本不动）才落位，只落一次，
               而且这一落是有 1.35s 过渡的（主人要的就是这段滑行）；
             · hero 消失（连续两个节拍都量不到才认）→ 退回侧栏/贴边的老逻辑；
             · 标题位置或眼徽档位变了（80/96/48）→ 跟着重算，别偏半个眼徽。
            只有目标真的变了才写变量，平时就是一次 querySelector + 一次矩形测量。 */
        let onHero = null
        let heroMiss = 0
        let pendX = NaN
        let pendY = NaN
        let pendTicks = 0
        let lastX = NaN
        let lastY = NaN
        /* 目标抖动容差：1~2px 的亚像素差不算「移动」，否则会节拍级地反复校正 */
        const NEAR = 2
        /* 落位后把「实际写进 CSS 变量的坐标」记成基准，后续只按它判断要不要校正
           （直接记目标坐标的话，一旦两次测量之间有细微差别就再也对不上了） */
        const syncPlaced = (fallback) => {
          const nx = parseFloat(root.style.getPropertyValue('--fz3-dock-x'))
          const ny = parseFloat(root.style.getPropertyValue('--fz3-dock-y'))
          lastX = Number.isFinite(nx) ? nx : (fallback ? fallback.x : NaN)
          lastY = Number.isFinite(ny) ? ny : (fallback ? fallback.y : NaN)
        }
        /* 右栏开合：右栏有可能是 transform 位移（宽度不变），ResizeObserver 与
           transitionend 都未必收得到；这里用「开/关」这个布尔量在同一个 350ms 节拍里兜底，
           状态一变就走统一的 schedule()（再等一个 RESET_DELAY 落位）。 */
        let lastRightOpen = null
        const heroWatch = setInterval(() => {
          try {
            const rb = document.querySelector('[class*="_rightbarCol"]')
            const rightOpen = rb !== null && rb.getBoundingClientRect().width >= 120
            if (rightOpen !== lastRightOpen) {
              const first = lastRightOpen === null
              lastRightOpen = rightOpen
              if (!first && !onHero) schedule()
            }
            const t = heroTarget()
            if (t !== null) {
              heroMiss = 0
              if (!onHero) {
                /* 刚回到新会话页：切页那一瞬内容列还在做 0.3s 宽度过渡、标题徽章
                   （预览版 → H.D.D Ⅲ）也还没改写，这时量到的是半路位置 ——
                   落了就会「先挪一小段再挪一段」。这里等目标稳定（容差 NEAR）再落位。
                   兜底：最多等 3 个节拍（约 1s），之后不管稳不稳都落，避免一直不落。 */
                const stable = Math.abs(t.x - pendX) <= NEAR && Math.abs(t.y - pendY) <= NEAR
                pendX = t.x
                pendY = t.y
                pendTicks += 1
                if (!stable && pendTicks < 3) return
                if (!placeHero()) return
                onHero = true
                pendTicks = 0
                syncPlaced(t)
                return
              }
              if (Math.abs(t.x - lastX) > NEAR || Math.abs(t.y - lastY) > NEAR) {
                if (!placeHero()) return
                syncPlaced(t)
              }
              return
            }
            /* 量不到：给一个节拍的宽限，别把「正在重排」误判成「已经离开」 */
            if (onHero) {
              heroMiss += 1
              if (heroMiss < 2) return
              onHero = false
              heroMiss = 0
              pendX = NaN
              pendY = NaN
              pendTicks = 0
              lastX = NaN
              lastY = NaN
              apply()
            }
          } catch (e) { /* 静默 */ }
        }, RESET_DELAY)
        try { onHero = heroTarget() !== null } catch (e) { onHero = null }
        let tries = 0
        const timer = setInterval(() => {
          tries += 1
          try { if (apply() || tries > 20) clearInterval(timer) } catch (e) { clearInterval(timer) }
        }, RESET_DELAY)
        /* 缩放防抖：拖窗口时 resize 每帧都会触发，原来每次都跑一次 measure（含强制布局），
           几十次/秒直接掉帧。这里合并成 120ms 内只算一次。 */
        let resizeTimer = null
        let resizeSettle1 = null
        let resizeSettle2 = null
        const onResize = () => {
          /* 缩放期间先挂标记：关掉眼徽的 1.35s 过渡与循环动画，
             避免它们和窗口重排抢合成器（表现就是“先黑一下再适配”）。 */
          document.documentElement.classList.add('fz3-resizing')
          if (resizeTimer !== null) clearTimeout(resizeTimer)
          if (resizeSettle1 !== null) clearTimeout(resizeSettle1)
          if (resizeSettle2 !== null) clearTimeout(resizeSettle2)
          resizeTimer = setTimeout(() => {
            resizeTimer = null
            document.documentElement.classList.remove('fz3-resizing')
            try { apply() } catch (e) { /* 静默 */ }
            /* 最大化/还原后补量：
               窗口尺寸是瞬间变的，但侧栏宽度、内容列位置带过渡动画，
               120ms 时量到的还是中间态 —— 眼徽就会停在错误位置。
               这里再补两次，等布局彻底稳定后以最终几何为准。 */
            if (resizeSettle1 !== null) clearTimeout(resizeSettle1)
            if (resizeSettle2 !== null) clearTimeout(resizeSettle2)
            /* 补量两次都用同一个复位延迟：一次在过渡结束后，一次再延一个周期兜底 */
            resizeSettle1 = setTimeout(() => { try { apply() } catch (e) { /* 静默 */ } }, RESET_DELAY)
            resizeSettle2 = setTimeout(() => { try { apply() } catch (e) { /* 静默 */ } }, RESET_DELAY * 2)
          }, 120)
        }
        window.addEventListener('resize', onResize)
        /* 侧栏开合：等一个复位延迟（RESET_DELAY ≈ 侧栏 0.3s 过渡之后）再按新状态落位；
           只写 CSS 变量，不动 React 状态 */
        let settle = null
        let sidebarObs = null
        let sidebarHost = null
        const schedule = () => {
          if (settle) clearTimeout(settle)
          /* 新建对话页让路：这一页上眼徽只跟标题走（heroWatch 每 RESET_DELAY 校一次），
             侧栏开合引起的重排不参与，免得两套逻辑各写一次坐标 */
          settle = setTimeout(() => {
            try { if (!onHeroPage()) apply() } catch (e) { /* 静默 */ }
          }, RESET_DELAY)
        }
        const bind = () => {
          const row = document.querySelector('[class*="_logoRow"]')
          const host = row === null ? null : (row.parentElement || row)
          if (host === sidebarHost) return
          sidebarHost = host
          if (sidebarObs) { sidebarObs.disconnect(); sidebarObs = null }
          if (host) {
            sidebarObs = new MutationObserver(schedule)
            sidebarObs.observe(host, { attributes: true, attributeFilter: ['class'] })
          }
        }
        bind()
        /* 左/右两栏的宽度变化都要触发重排：
           · 左栏靠 _logoRow 所在容器的 class 变化（收起/展开）能收到，
             但拖分隔条改宽度没有 class 变化、也不一定有 transitionend；
           · 右栏（_rightbarCol）压根不在上面那条观察线上 —— 打开/关上右栏时
             内容列会重新居中，眼徽该落的通道中心跟着变，2026-11-22 主人就是
             发现「打开右侧边栏时没有复位」。
           这里给两栏各挂一个 ResizeObserver，宽度一变就按统一的 RESET_DELAY 重排；
           观察目标消失/出现（右栏有时整块卸载）也补一次 schedule。 */
        let colObs = null
        let colEls = []
        const bindCols = () => {
          const next = [
            document.querySelector('[class*="_sidebarCol"]'),
            document.querySelector('[class*="_rightbarCol"]'),
          ].filter((el) => el !== null)
          if (next.length === colEls.length && next.every((el, i) => el === colEls[i])) return
          const had = colEls.length > 0
          colEls = next
          if (colObs) { colObs.disconnect(); colObs = null }
          if (next.length > 0 && typeof ResizeObserver !== 'undefined') {
            colObs = new ResizeObserver(() => schedule())
            next.forEach((el) => colObs.observe(el))
          }
          /* 第一次绑定不算「变化」，之后的出现/消失都补一次落位 */
          if (had) schedule()
        }
        bindCols()
        let raf = 0
        const bodyObs = new MutationObserver(() => {
          if (raf) return
          raf = requestAnimationFrame(() => {
            raf = 0
            try { bind() } catch (e) { /* 静默 */ }
            try { bindCols() } catch (e) { /* 静默 */ }
          })
        })
        bodyObs.observe(document.body, { childList: true, subtree: true })
        /* 侧栏/右栏宽度是带过渡动画的：动画结束（transitionend）也触发一次落位。
           2026-11-22 起把 _sidebarCol / _rightbarCol / _frame 也纳入命中，
           右栏开关如果没有尺寸变化（零宽面板）也还有这一层兜底。 */
        const onTransition = (event) => {
          const target = event && event.target
          if (!target || typeof target.matches !== 'function') return
          if (
            target.matches('[class*="_root_"]')
            || target.matches('[class*="_logoRow"]')
            || target.matches('[class*="_sidebarCol"]')
            || target.matches('[class*="_rightbarCol"]')
            || target.matches('[class*="_frame"]')
          ) schedule()
        }
        document.addEventListener('transitionend', onTransition, true)
        /* 眼徽档位（80/96/48）变了：坐标里含半个眼徽，得按新尺寸重排一次 */
        const onEyeSize = () => {
          try { if (!onHeroPage()) apply() } catch (e) { /* 静默 */ }
        }
        window.addEventListener('fz3:eye-size', onEyeSize)
        return () => {
          clearInterval(timer)
          clearInterval(heroWatch)
          if (resizeTimer !== null) clearTimeout(resizeTimer)
          window.removeEventListener('resize', onResize)
          document.removeEventListener('transitionend', onTransition, true)
          window.removeEventListener('fz3:eye-size', onEyeSize)
          if (settle) clearTimeout(settle)
          if (sidebarObs) sidebarObs.disconnect()
          if (colObs) colObs.disconnect()
          bodyObs.disconnect()
          if (raf) cancelAnimationFrame(raf)
        }
      }, [customPos, applyPos, clampPos, eyeHidden, resetTick])

      /* 记住的位置也要跟着窗口缩放夹一下，别把眼标留在屏幕外。
         新建对话页不夹：那里位置由标题决定，写回拖拽坐标只会把它从标题上方抢走。 */
      useEffect(() => {
        if (!customPos) return undefined
        const onResize = () => {
          if (onHeroPage()) return
          applyPos(clampPos(customPos.x, customPos.y))
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }, [customPos, applyPos, clampPos])

      /* 设置页里的开关与「复位」通过自定义事件同步到这个图层 */
      useEffect(() => {
        const sync = () => setDragOn(readBool(DRAG_KEY, true))
        const syncEye = () => setEyeHidden(readBool(EYE_KEY, false))
        /* 复位延迟统一用 RESET_DELAY（原来是 2 秒）：侧栏收起/展开带 0.3s 过渡动画，
           立刻重算会量到动画中途的错误几何；RESET_DELAY 取 350ms 正好卡在动画之后。
           新建对话页上「复位」只清坐标、不重排：这一页眼徽悬在标题上方，位置由 heroWatch 维护。 */
        let resetTimer = null
        const onReset = () => {
          if (resetTimer !== null) clearTimeout(resetTimer)
          resetTimer = setTimeout(() => {
            resetTimer = null
            try { localStorage.removeItem(POS_KEY) } catch {}
            setCustomPos(null)
            setDragging(false)
            if (onHeroPage()) return
            setResetTick((n) => n + 1)
          }, RESET_DELAY)
        }
        window.addEventListener('fz3:drag-pref', sync)
        window.addEventListener('fz3:eye-pref', syncEye)
        window.addEventListener('fz3:dock-reset', onReset)
        window.addEventListener('storage', sync)
        window.addEventListener('storage', syncEye)
        return () => {
          if (resetTimer !== null) clearTimeout(resetTimer)
          window.removeEventListener('fz3:drag-pref', sync)
          window.removeEventListener('fz3:eye-pref', syncEye)
          window.removeEventListener('fz3:dock-reset', onReset)
          window.removeEventListener('storage', sync)
          window.removeEventListener('storage', syncEye)
        }
      }, [])

      /* 朗读摘要气泡：speakText 每段开始时推一段文字，念完/停止时清空 */
      useEffect(() => {
        const onSay = (event) => {
          const detail = event && event.detail ? event.detail : {}
          if (detail.end) { setSay(''); return }
          setSay(String(detail.text || ''))
          /* 朗读一开口就把「本轮结算」收起来，别和朗读气泡抢位置 */
          setBubble((prev) => (prev && prev.mode === 'turn' ? null : prev))
        }
        window.addEventListener('fz3:say', onSay)
        return () => window.removeEventListener('fz3:say', onSay)
      }, [])

      useEffect(() => {
        let alive = true
        const tick = () => {
          fetch('/fairy-zzz/mood', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (alive && d && d.mood) setMood(d.mood)
            })
            .catch(() => {})
        }
        const timer = setInterval(tick, 900)
        tick()
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [])
      /* 2026-11-27 23:20 删掉「轮询 /fairy-zzz/analysis 存 lastAnalysis」那段：
         那个接口的 text 是正文第一句（不是分析正文），拼进朗读就是同一句念两遍；
         它的缓冲区还跨会话共享。现在朗读只用这一轮 DOM 里的正文（pickTrio）。
         宿主那条路由保留，设置页/排查「为什么没念」时仍可取诊断字段。 */
      /* 一轮跑完 → 每 10 轮才自动弹一次“本轮花费”，18 秒后自己消失；
         但要等这一轮的朗读念完再弹，否则两个气泡会叠在一起 */
      const doneMark = useRef('')
      useEffect(() => {
        if (phase !== 'dock' || mood !== 'done') return
        const stamp = String(Date.now()).slice(0, -4)
        if (doneMark.current === stamp) return
        doneMark.current = stamp
        let count = 0
        try { count = Number(readStored(TURN_COUNT_KEY, 0)) || 0 } catch (e) { count = 0 }
        count += 1
        const show = count % 10 === 0
        try { writeStored(TURN_COUNT_KEY, count % 10) } catch (e) { /* 静默 */ }
        if (show) openTurnBubbleWhenQuiet()
      }, [mood, phase, openTurnBubbleWhenQuiet])
      /* 每轮对话结束（mood 变 done）后把眼徽复位到固定锚点，效果等同设置页里的
         「复位」按钮：清掉拖拽坐标 + 重新按侧栏测量定位。
         这里不再自己等 1.5 秒 —— 复位延迟统一由 fz3:dock-reset 的处理方按 RESET_DELAY
         生效，所有复位路径（按钮 / 每轮结束 / 切页）都是「触发后同一个时间」到位。 */
      useEffect(() => {
        if (phase !== 'dock' || mood !== 'done') return undefined
        try { window.dispatchEvent(new CustomEvent('fz3:dock-reset')) } catch (e) { /* 静默 */ }
        return undefined
      }, [mood, phase])
      useEffect(() => closeBubble, [closeBubble])
      const [needTap, setNeedTap] = useState(false)
      const [engine, setEngine] = useState(null)
      const greetAudio = useRef(null)
      const coreRef = useRef(null)
      const layerRef = useRef(null)
      const voiceState = useVoice()

      const toDock = useCallback(() => {
        setPhase('dock')
        setNeedTap(false)
        autoArmAt = Date.now() + 2600
      }, [])

      /* ———————————————————— 眼徽拖拽 ———————————————————— */
      const toggleBubble = useCallback(() => {
        if (phase !== 'dock') return
        if (bubble) {
          closeBubble()
          return
        }
        openBubble('usage')
      }, [bubble, phase, openBubble, closeBubble])

      const onCoreDown = (e) => {
        if (!dragOn || phase !== 'dock') return
        if (typeof e.button === 'number' && e.button !== 0) return
        const r = e.currentTarget.getBoundingClientRect()
        /* 新建对话页上眼徽悬在标题上方（位置由 placeHero 决定），拖了也会被拉回去。
           不能像老代码那样直接 return —— 那样 dragRef 不会被赋值，onPointerUp
           会提前退出，默认开启拖拽时新会话页单击眼徽根本打不开用量气泡。
           现在只在 move 里锁住位移，单击照旧走 onCoreUp 的 toggleBubble。 */
        dragRef.current = {
          id: e.pointerId,
          dx: e.clientX - (r.left + r.width / 2),
          dy: e.clientY - (r.top + r.height / 2),
          sx: e.clientX,
          sy: e.clientY,
          moved: false,
          locked: onHeroPage(),
        }
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
        e.preventDefault()
      }
      const onCoreMove = (e) => {
        const drag = dragRef.current
        if (!drag || drag.id !== e.pointerId) return
        /* 新会话页：位置由标题锚点锁定，拖动不接管，但仍允许单击弹气泡 */
        if (drag.locked) return
        if (!drag.moved) {
          if (Math.abs(e.clientX - drag.sx) < 4 && Math.abs(e.clientY - drag.sy) < 4) return
          drag.moved = true
          setDragging(true)
        }
        applyPos(clampPos(e.clientX - drag.dx, e.clientY - drag.dy))
        /* 气泡跟着眼徽走：拖动中每个 move 重算一次挂点，靠近右边界自动翻到左侧 */
        if (bubble) {
          const el = coreRef.current
          if (el) {
            const next = bubblePlace(el.getBoundingClientRect())
            setBubble((prev) =>
              prev && (prev.x !== next.x || prev.y !== next.y || prev.side !== next.side) ? { ...prev, ...next } : prev,
            )
          }
        }
        e.preventDefault()
      }
      const onCoreUp = (e) => {
        const drag = dragRef.current
        if (!drag || drag.id !== e.pointerId) return
        dragRef.current = null
        setDragging(false)
        /* 只是点了一下、没拖动 → 展开/收起用量气泡 */
        if (!drag.moved) {
          toggleBubble()
          return
        }
        const r = e.currentTarget.getBoundingClientRect()
        const next = clampPos(r.left + r.width / 2, r.top + r.height / 2)
        setCustomPos(next)
        writeStored(POS_KEY, next)
      }

      /* ———————————————————— */
      useEffect(() => {
        if (phase !== 'greet') return undefined
        let alive = true
        let timer = null
        /* 问候是否已经交给宿主进程在播（网页播放被拦时的后备路径） */
        let hostVoice = false
        /* 正常情况：问候放完（或 13 秒）就收成眼徽 */
        let lock = setTimeout(() => {
          if (alive) toDock()
        }, 13_000)
        const audio = new Audio(GREETING())
        greetAudio.current = audio
        audio.volume = 0.95
        audio.onended = () => {
          if (!alive) return
          clearTimeout(lock)
          timer = setTimeout(() => {
            if (alive) toDock()
          }, 1900)
        }
        audio.play().then(
          () => {
            if (alive) setNeedTap(false)
          },
          () => {
            if (!alive) return
            /* 网页的自动播放被策略拦下：请宿主进程直接放这段 wav（PowerShell 的
               SoundPlayer，不受浏览器策略限制）。宿主不在（旧版本 / 非 Windows）时
               再退回到「点一下才出声」。 */
            fetch('/fairy-zzz/greet', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ file: GREETING_FILE() }),
            })
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (!alive) return
                if (data && data.ok) {
                  hostVoice = true
                  setNeedTap(false)
                  return
                }
                throw new Error((data && data.reason) || 'host voice unavailable')
              })
              .catch(() => {
                if (!alive) return
                setNeedTap(true)
                clearTimeout(lock)
                lock = setTimeout(() => {
                  if (alive) toDock()
                }, 30_000)
              })
          },
        )
        return () => {
          alive = false
          clearTimeout(lock)
          if (timer) clearTimeout(timer)
          if (hostVoice) {
            /* 问候已经交给宿主播放：收成眼徽 / 跳过时把它停掉，免得声音迟到 */
            try {
              fetch('/fairy-zzz/greet', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ stop: true }),
                keepalive: true,
              }).catch(() => {})
            } catch {}
          }
          try {
            audio.onended = null
            audio.pause()
          } catch {}
          greetAudio.current = null
        }
      }, [phase, toDock])

      const retryVoice = useCallback(() => {
        const audio = greetAudio.current
        if (!audio) return
        audio.play().then(
          () => setNeedTap(false),
          () => {},
        )
      }, [])

      /* 自动播放被拦时，按键盘同样算一次用户交互：敲一下键也能把问候语音喊出来 */
      useEffect(() => {
        if (phase !== 'greet' || !needTap) return undefined
        const onKey = () => retryVoice()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [phase, needTap, retryVoice])

      /* 开屏模糊的首帧修复（2026-11-22）：Chromium 会给 backdrop-filter 缓存一份
         背景取样快照。开屏层挂上时界面才刚画完，模糊便“没生效”，要等窗口 resize
         触发重排才恢复 —— 表现就是「开屏没糊，拖一下窗口才有」。
         这里在 greet 阶段补几次强制重采样：先内联关掉滤镜、下一帧再撤掉，
         让浏览器重新取一次背景。 */
      useEffect(() => {
        if (phase !== 'greet') return undefined
        const el = layerRef.current
        if (!el) return undefined
        const timers = [0, 320, 900, 2000].map((ms) => window.setTimeout(() => {
          el.style.setProperty('-webkit-backdrop-filter', 'none', 'important')
          el.style.setProperty('backdrop-filter', 'none', 'important')
          window.requestAnimationFrame(() => {
            el.style.removeProperty('-webkit-backdrop-filter')
            el.style.removeProperty('backdrop-filter')
          })
        }, ms))
        return () => timers.forEach((timer) => window.clearTimeout(timer))
      }, [phase])

      const busy = voiceState.busy || voiceState.speaking

      return h(
        'div',
        { ref: layerRef, className: 'fz3-layer', 'data-phase': phase, 'data-mood': mood, 'data-drag': dragOn ? '1' : '0', 'data-dragging': dragging ? '1' : '0' },
        h(
          'div',
          { className: 'fz3-screen', onClick: needTap ? retryVoice : undefined },
          h('div', { className: 'fz3-bg' }),
          h('div', { className: 'fz3-hero' }),
          needTap
            ? h(
                'div',
                {
                  className: 'fz3-copy-sub fz3-tap',
                  role: 'button',
                  onClick: retryVoice,
                  style: { position: 'absolute', left: 0, right: 0, bottom: 'clamp(12px,5vh,44px)', textAlign: 'center' },
                },
                t('greet.tap'),
              )
            : null,
          phase === 'greet' ? h('button', { type: 'button', className: 'fz3-skip2', onClick: toDock }, 'SKIP ▸') : null,
        ),

        phase === 'dock'
          ? h(
              'div',
              { className: 'fz3-sb-brand', 'aria-hidden': 'true' },
              h('span', { className: 'fz3-sb-logo', dangerouslySetInnerHTML: { __html: FAIRY_EYE_SVG } }),
              h(
                'span',
                { className: 'fz3-sb-text' },
                h('b', null, 'H.D.D.System'),
              ),
            )
          : null,

        /* ———————————————————— */
        !eyeHidden
          ? h(
              'div',
              {
                ref: coreRef,
                className: 'fz3-core',
                'data-phase': phase,
                'data-drag': dragOn ? '1' : '0',
                onPointerDown: onCoreDown,
                onPointerMove: onCoreMove,
                onPointerUp: onCoreUp,
                onPointerCancel: onCoreUp,
                onClick: dragOn ? undefined : toggleBubble,
                /* 不挂 title：悬浮提示会盖住眼徽，交互靠气泡自己说明 */
                'aria-label': 'Fairy',
              },
              h(CoreGlyph, { phase, mood }),
            )
          : null,

        /* ———————————————————— 用量气泡 ———————————————————— */
        bubble && !eyeHidden
          ? h(BubbleCard, {
              key: bubble.mode,
              data: bubble,
              /* 换价瞬间：重新拉一次用量，气泡里的峰谷立刻翻面 */
              onFlip: (mode) => {
                openBubble(mode)
              },
              onMeasure: (size) => {
                bubbleSize.current = size
                /* 尺寸一变立刻重算一次挂点，避免首帧用旧宽高定位 */
                const el = coreRef.current
                if (!el) return
                const next = bubblePlace(el.getBoundingClientRect())
                setBubble((prev) =>
                  prev && (prev.x !== next.x || prev.y !== next.y || prev.side !== next.side) ? { ...prev, ...next } : prev,
                )
              },
            })
          : null,

        /* ———————————————————— 朗读摘要气泡 ———————————————————— */
        say && phase === 'dock' && !eyeHidden
          ? h('div', { className: 'fz3-say' }, say)
          : null,

        /* ———————————————————— */
        h(
          'div',
          { className: 'fz3-copy' },
          h('div', { className: 'fz3-copy-kicker' }, t('greet.kicker')),
          h('div', { className: 'fz3-copy-title-zh' }, '空 洞 深 潜 系 统'),
          h('div', { className: 'fz3-copy-title-wrap' }, h('div', { className: 'fz3-copy-title', 'data-text': 'START H.D.D.SYSTEM' }, 'START H.D.D.SYSTEM')),
          h(
            'div',
            { className: 'fz3-copy-lines' },
            h('span', null, greetLine()),
          ),
          h('div', { className: 'fz3-copy-sub' }, t('greet.sub')),
        ),

        /* 左下角标签 */
        h(
          'div',
          { className: 'fz3-tag' },
          h('b', null, t('dock.tag')),
          h('i', null, t('dock.tagsub')),
        ),

      )
    }

    /* ------------------------------------------------------------------ *
     * 挂载
     * ------------------------------------------------------------------ */
    return {
      inject: ['slots', 'remote', 'remote.account', 'locale'],
      apply(ctx) {
        runtime.ctx = ctx
        const guard = (label, fn) => {
          try {
            return fn()
          } catch (cause) {
            try {
              console.warn('[fairy-zzz] ' + label, cause)
            } catch {}
            return undefined
          }
        }

        guard('locale', () => {
          const locale = ctx.get && ctx.get('locale')
          if (!locale || typeof locale.register !== 'function') return
          locale.register(NS, 'zh-CN', ZH)
          locale.register(NS, 'en-US', EN)
          tr = locale.bind(NS)
        })

        guard('styles', () => {
          if (typeof document === 'undefined') return
          const tagId = PKG + '/fairy-zzz.css'
          const existing = document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']')
          if (existing) {
            /* HMR 重新 apply 时把内容刷新一遍，否则样式表会一直停在第一次注入的版本 */
            if (existing.textContent !== CSS) existing.textContent = CSS
            return
          }
          const tag = document.createElement('style')
          tag.dataset.plugin = PKG
          tag.dataset.pluginCss = tagId
          tag.textContent = CSS
          document.head.appendChild(tag)
          if (ctx && typeof ctx.effect === 'function') {
            ctx.effect(() => () => {
              try { tag.remove() } catch {}
            })
          }
        })

        guard('tokens', () => {
          const theme = ctx.get && ctx.get('theme')
          if (theme && typeof theme.overrideTokens === 'function') theme.overrideTokens(PKG, TOKENS)
        })

        /* ------------------------------------------------------------ *
         * 运行状态行：文案 + 邦布（2026-11-22）
         * 
         * 宿主在回复期间渲染 div[data-chat-running] 里的
         * 「深度求索中，用时 N 秒」，这里就地把它换成绝区零语汇：
         *   深度求索中 → 空洞深潜中
         * H.D.D. 的全称就是 Hollow Deep Diving System（空洞深潜系统），
         * 原词「深度求索」的「深潜」本义正好被接住，只是换了个世界观说法。
         * 同时把行首那只鲸鱼换成自绘的邦布（见 CSS 里的 .fz3-boo 一段）：
         * 鲸鱼是宿主 APNG 遮罩画的，动不了它的图形，只能整层隐藏后
         * 往 .runningIcon 里塞一个内联 SVG。宿主若改了 DOM 结构，
         * 找不到 .runningIcon 就自动不换，鲸鱼照常显示。
         * 不改 bundle、不碰宿主的语言包，宿主升级也不会被冲掉。
         * 2026-11-23 主人要求：
         *   · 文案改成「H.D.D.空洞探索中」（03:03 再改，之前那版是
         *     「H.D.D.空洞文件检索中ing」）；
         *   · 行尾的计时也一起改口：宿主动态拼的「，用时 N 秒 …」补成
         *     「，已用时 N 秒 …」（03:05 主人给的目标整行是
         *     「H.D.D.空洞探索中，已用时 21秒 ···」）；
         *   · 行首那只邦布删掉（RUNNING_ICON = 'none'：连宿主的鲸鱼一起收起来，
         *     这一行只剩文字）。
         * 想换词：改 RUNNING_TO；想把邦布放回来：RUNNING_ICON 换 'bangboo'
         * （27 帧视频跑动）或 'whale'（宿主原样）。
         * ------------------------------------------------------------ */
        guard('running-label', () => {
          const RUNNING_RELABEL = true
          /* 'none' = 行内不出图标（当前）；'bangboo' = 换成皮肤那只邦布；'whale' = 宿主原样 */
          const RUNNING_ICON = 'none'
          const RUNNING_MASCOT = RUNNING_ICON === 'bangboo'
          if (!RUNNING_RELABEL || typeof document === 'undefined') return
          const RUNNING_TO = 'H.D.D.空洞探索中'
          /* 宿主原始文案、皮肤上一版改过的文案、隔壁 chat-tone 改过的文案，几种都认：
             chat-tone 也会把「深度求索中 / 空洞深潜中」改成「空洞探索中」，
             两个观察器谁先跑都不重要，最终都落到这句话上。
             最后一条是 03:02 之前那版文案，防止旧 DOM/旧缓存里的字留下来。 */
          const RUNNING_PAIRS = [
            ['深度求索中', RUNNING_TO],
            ['空洞深潜中', RUNNING_TO],
            ['空洞探索中', RUNNING_TO],
            ['H.D.D.空洞文件检索中ing', RUNNING_TO],
            ['Deep diving', 'H.D.D. Hollow Exploring'],
            ['Hollow exploring', 'H.D.D. Hollow Exploring'],
          ]
          const BOO_CLASS = 'fz3-boo'
          /* 真身：2026-11-23 主人建议的「视频里抽帧」路线 —— 从 assets/loading.webm
             逐帧解出 27 帧（0.9s 一轮，432 帧 = 27×16），统一裁切窗保住跑动位移，
             2 倍降采样拼成 46×59/帧的横排 sprite。深色白、浅色黑仍靠 filter 翻转。 */
          const BOO_SRC = '/fairy-zzz/assets/bangboo-run-webm-27f.png'
          const BOO_FRAMES = 27
          const BOO_CYCLE_MS = 900
          const BOO_HOP_PX = 1.8
          /* 播放器：横排 sprite 逐帧左移 + 每轮两次小跳（跳的余量由 CSS 里
             图高 90%、贴底对齐让出来）。不用 CSS animation——motion 偏好、
             旧样式缓存这类外部条件都不再能把它按成静止画面。
             每个播放器都登记进 stops，节点被宿主拆掉或插件卸载时一起停。 */
          const stops = new Set()
          /* 谁还在播：scan() 每 200ms 拿它当花名册，发现「盒子在、播放器不在」
             就补一个。切主题、宿主重排、插件重新 apply 之后都不会僵住。 */
          const playing = new WeakSet()
          const playBoo = (img) => {
            let raf = 0
            /* 帧宽必须用 rect 的小数值算：clientWidth/clientHeight 会取整，
               20.3 被当成 20.5 时每帧漂 0.2px，一轮下来就串到下一帧去了。
               每循环重算一次，字体缩放后也能自己纠正。 */
            let step = 0
            const frameMs = BOO_CYCLE_MS / BOO_FRAMES
            const stop = () => {
              try { cancelAnimationFrame(raf) } catch {}
              playing.delete(img)
              stops.delete(stop)
            }
            const tick = (now) => {
              if (!img.isConnected) { stop(); return }
              /* 图还没解码完就先等，别拿 0 宽去算步长 */
              if (img.naturalWidth === 0) { raf = requestAnimationFrame(tick); return }
              /* 相位走**绝对时钟**，不拿「元素挂载时刻」当零点（2026-11-23 修）：
                 运行行每秒改写「用时 N 秒」，宿主的 React 会把行内节点重建一次，
                 播放器随之重挂。用相对起点的话每 1 秒相位就归零一次 ——
                 一圈 660ms 里后 340ms 的那几帧永远轮不到，看到的就像「少了几帧」。
                 绝对时钟下重挂不跳相，同一屏里多只邦布也自然同步。 */
              const frame = Math.floor(now / frameMs) % BOO_FRAMES
              if (frame === 0 || step === 0) step = img.getBoundingClientRect().width / BOO_FRAMES
              const phase = (now % BOO_CYCLE_MS) / BOO_CYCLE_MS
              const hop = Math.abs(Math.sin(2 * Math.PI * phase)) * BOO_HOP_PX
              img.style.transform = 'translate3d(' + (-frame * step).toFixed(2) + 'px,'
                + (-hop).toFixed(2) + 'px,0)'
              raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
            stops.add(stop)
          }
          const injectBoo = (row) => {
            if (!RUNNING_MASCOT) return
            if (!row || row.querySelector('.' + BOO_CLASS)) return
            let icon = null
            try { icon = row.querySelector('[class*="runningIcon"]') } catch { return }
            if (!icon) return
            try {
              const box = document.createElement('span')
              box.className = BOO_CLASS
              box.setAttribute('aria-hidden', 'true')
              const img = document.createElement('img')
              img.src = BOO_SRC
              img.alt = ''
              img.draggable = false
              /* 图挂了（换图时写错文件名 / 资源没同步）就把盒子撤掉、
                 把 data-fz3-bangboo 抹掉，让宿主那只鲸鱼回来 —— 宁可看到鲸鱼，
                 也不要一个空着的 20×28 坑。 */
              img.addEventListener('error', () => {
                try { box.remove(); row.removeAttribute('data-fz3-bangboo') } catch {}
              })
              box.appendChild(img)
              icon.appendChild(box)
              playBoo(img)
              /* 少了这个属性，CSS 就不会去藏鲸鱼——宁可两只都在，也不要空缺 */
              row.setAttribute('data-fz3-bangboo', '1')
            } catch {}
          }
          const TEXT_NODE = 3
          /* 2026-11-23 03:05 主人要求整行读作
             「H.D.D.空洞探索中，已用时 21秒 ···」：
             计时词由宿主动态拼在文案后面，这里把「，用时」补成「，已用时」。
             正则允许「用时」和秒数之间没有空格；已经写成「，已用时」的不会再命中
             （「，」后面跟的是「已」），所以是幂等的。 */
          const fixTimer = (s) => s.replace(/，用时\s*/g, '，已用时 ')
          const rewrite = (node) => {
            try {
              let text = node && node.nodeValue
              if (!text) return false
              let changed = false
              const timed = fixTimer(text)
              if (timed !== text) { text = timed; changed = true }
              /* 幂等：已经是新文案就别再套一遍（否则「…中ing」会变成「…中inging」，
                 属性层和文本层先后各跑一次时尤其容易踩到） */
              if (text.indexOf(RUNNING_TO) < 0) {
                /* 命中即停：新文案「H.D.D.空洞探索中」里本身含「空洞探索中」，
                   继续套第二条会叠成「H.D.D.H.D.D.空洞探索中」。 */
                for (const pair of RUNNING_PAIRS) {
                  if (text.indexOf(pair[0]) < 0) continue
                  text = text.split(pair[0]).join(pair[1])
                  changed = true
                  break
                }
              }
              if (!changed) return false
              node.nodeValue = text
              return true
            } catch { return false }
          }
          /* 律动层（TextShimmer）的文字不在文本节点里，而在 data-shimmer-text
             属性上，由 ::after{content:attr(...)} 画出来。只改文本节点的话，
             底下是新闻案、上面压着旧文案，两层叠在一起就是「重影」。
             所以属性也要一起换（2026-11-23 主人提醒）。 */
          const rewriteAttr = (el) => {
            try {
              if (!el || el.nodeType !== 1 || !el.getAttribute) return false
              const v = el.getAttribute('data-shimmer-text')
              if (!v) return false
              let next = v
              let changed = false
              const timed = fixTimer(next)
              if (timed !== next) { next = timed; changed = true }
              /* 同上：幂等，别把新文案再套一遍 */
              if (next.indexOf(RUNNING_TO) < 0) {
                for (const pair of RUNNING_PAIRS) {
                  if (next.indexOf(pair[0]) < 0) continue
                  next = next.split(pair[0]).join(pair[1])
                  changed = true
                  break                   /* 同上：命中即停，避免重复前缀 */
                }
              }
              if (!changed || next === v) return false
              el.setAttribute('data-shimmer-text', next)
              return true
            } catch { return false }
          }
          const rewriteAttrsIn = (root) => {
            if (!root || root.nodeType !== 1) return
            rewriteAttr(root)
            let list = null
            try { list = root.querySelectorAll('[data-shimmer-text]') } catch { list = null }
            if (list) list.forEach(rewriteAttr)
          }
          const rewriteTree = (root) => {
            if (!root) return
            if (root.nodeType === TEXT_NODE) { rewrite(root); return }
            if (root.nodeType !== 1) return
            rewriteAttrsIn(root)
            let walker = null
            try { walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */) } catch { return }
            let node = walker.nextNode()
            while (node) {
              rewrite(node)
              node = walker.nextNode()
            }
          }
          /* 宿主每秒重写这个文本节点：characterData 观察器在微任务里就地改回，
             React 之后下一次渲染再被改回一次，循环往复但每次只做字符串比较。
             属性也一起看着（宿主重绘律动层时会重写 data-shimmer-text）。 */
          const watched = new WeakSet()
          const observer = typeof MutationObserver === 'function'
            ? new MutationObserver((records) => {
                for (const record of records) {
                  if (record.type === 'characterData') rewrite(record.target)
                  else if (record.type === 'attributes') rewriteAttr(record.target)
                  else if (record.type === 'childList') {
                    for (const node of record.addedNodes) rewriteTree(node)
                  }
                }
              })
            : null
          const watch = (el) => {
            if (!el || watched.has(el)) return
            watched.add(el)
            if (observer) {
              try {
                observer.observe(el, {
                  childList: true,
                  characterData: true,
                  subtree: true,
                  attributes: true,
                  attributeFilter: ['data-shimmer-text'],
                })
              } catch {}
            }
            rewriteTree(el)
          }
          const scan = () => {
            try {
              document.querySelectorAll('[data-chat-running]').forEach((row) => {
                watch(row)
                /* 'none'：整行只留文字 —— 宿主那只鲸鱼图标也一起收起来，
                   否则「邦布删掉了」但鲸鱼又冒出来，等于没删。 */
                if (RUNNING_ICON === 'none') {
                  if (!row.hasAttribute('data-fz3-noicon')) row.setAttribute('data-fz3-noicon', '1')
                } else if (row.hasAttribute('data-fz3-noicon')) {
                  row.removeAttribute('data-fz3-noicon')
                }
                injectBoo(row)
              })
              /* 监督者：盒子还在、播放器却没了（切主题、宿主重排、热重载都可能
                 把 img 摘下来再过一手），就地补一个，别留一具静止的邦布。 */
              document.querySelectorAll('.' + BOO_CLASS + ' img').forEach((img) => {
                if (!playing.has(img)) playBoo(img)
              })
            } catch {}
          }
          scan()
          /* 运行行每轮对话重新挂载：200ms 扫一遍补挂，首帧最多旧词 0.2s，基本察觉不到 */
          const timer = window.setInterval(scan, 200)
          if (typeof ctx.effect === 'function') {
            ctx.effect(() => () => {
              try { observer && observer.disconnect() } catch {}
              try { window.clearInterval(timer) } catch {}
              try { for (const stop of [...stops]) stop() } catch {}
              try {
                document.querySelectorAll('.' + BOO_CLASS).forEach((node) => node.remove())
                document.querySelectorAll('[data-fz3-bangboo]').forEach((node) => node.removeAttribute('data-fz3-bangboo'))
              } catch {}
            })
          }
        })

        /* 毛玻璃模糊度：设置页的滑块会把它存进 localStorage，这里在插件装载时先套一遍，
           免得没打开设置页时一直用 CSS 里的默认值 */
        guard('glass-blur', () => {
          if (typeof document === 'undefined') return
          const raw = Number(readStored(GLASS_KEY, 14))
          const value = Number.isFinite(raw) ? Math.max(0, Math.min(30, raw)) : 14
          document.documentElement.style.setProperty('--fz3-glass-blur', value + 'px')
          document.documentElement.style.setProperty('--fz3-glass-filter', value > 0 ? 'blur(' + value + 'px) saturate(125%)' : 'none')
        })

        guard('theme-watch', () => {
          /* 主题服务缺席时也照样跑：宿主令牌 / body 属性仍是可靠信号，
             不能因为一个服务没就绪就整段跳过（跳过 = 白字没人管）。 */
          const theme = (ctx.get && ctx.get('theme')) || null
          if (typeof document === 'undefined') return
          const root = document.documentElement

          /* ============================================================
           * 主题校验 + 自动切换（2026-11-22）
           *
           * 老逻辑只信 theme.getTheme()：那个快照偶尔比真实 DOM 慢一拍，
           * 于是 data-fz3-theme 卡在 dark，浅色界面里品牌名 / 气泡继续用白字。
           * 新逻辑按「实际画出来的东西」判定，顺序：
           *   1. 用户强制（设置页 / 侧栏按钮）—— 永远优先，不自动改；
           *   2. 宿主设计令牌 --dsw-alias-bg-base / --dsw-alias-label-primary 的亮度
           *      （宿主外观决定这两个值，皮肤 overrideTokens 也按宿主的 active
           *      colorScheme 取值，所以能真实反映宿主是深还是浅）；
           *   3. theme 服务的 active.colorScheme；
           *   4. body[data-ds-dark-theme] / html data-theme；
           *   5. 保持上一次的值，不瞎猜。
           * 判定完写 data-fz3-theme + data-fz3-theme-src；随后做对比度自检，
           * 品牌名 / 用量气泡低于阈值时自动改成可读色（内联兜底 + 数据属性）。
           * ============================================================ */
          const FZ3_ALLOWED = ['light', 'dark']

          /* ---------- 颜色解析 / 亮度 / 对比度 ---------- */
          const parseColor = (raw) => {
            if (!raw) return null
            const s = String(raw).trim().toLowerCase()
            if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
            if (s === 'white') return { r: 255, g: 255, b: 255, a: 1 }
            if (s === 'black') return { r: 0, g: 0, b: 0, a: 1 }
            if (s[0] === '#') {
              const h = s.slice(1)
              if (h.length === 3 || h.length === 4) {
                const n = h.split('').map((c) => parseInt(c + c, 16))
                if (n.some(Number.isNaN)) return null
                return { r: n[0], g: n[1], b: n[2], a: h.length === 4 ? n[3] / 255 : 1 }
              }
              if (h.length === 6 || h.length === 8) {
                const n = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6), h.length === 8 ? h.slice(6, 8) : 'ff'].map((c) => parseInt(c, 16))
                if (n.some(Number.isNaN)) return null
                return { r: n[0], g: n[1], b: n[2], a: n[3] / 255 }
              }
              return null
            }
            let m = /^rgba?\(([^)]+)\)$/.exec(s)
            if (m) {
              const parts = m[1].split(/[,\s/]+/).filter(Boolean)
              const rgb = parts.slice(0, 3).map((v) => (v.endsWith('%') ? Number(v.slice(0, -1)) * 2.55 : Number(v)))
              if (rgb.some((v) => !Number.isFinite(v))) return null
              const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? Number(parts[3].slice(0, -1)) / 100 : Number(parts[3])
              return { r: rgb[0], g: rgb[1], b: rgb[2], a: Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1 }
            }
            /* Chrome 对 color-mix() 会算成 color(srgb r g b / a)，三个分量是 0..1 */
            m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/.exec(s)
            if (m) {
              return { r: Number(m[1]) * 255, g: Number(m[2]) * 255, b: Number(m[3]) * 255, a: m[4] === undefined ? 1 : Number(m[4]) }
            }
            return null
          }
          const lin = (v) => {
            const x = Math.max(0, Math.min(255, v)) / 255
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
          }
          const relLum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
          const contrast = (a, b) => {
            const l1 = relLum(a)
            const l2 = relLum(b)
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
          }
          const over = (fg, bg) => ({
            r: fg.r * fg.a + bg.r * (1 - fg.a),
            g: fg.g * fg.a + bg.g * (1 - fg.a),
            b: fg.b * fg.a + bg.b * (1 - fg.a),
            a: 1,
          })
          const rgbCss = (c) => 'rgb(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ')'

          /* ---------- 宿主真实主题 ---------- */
          const readToken = (name) => {
            try {
              const a = getComputedStyle(document.body).getPropertyValue(name)
              if (a && a.trim()) return a.trim()
            } catch {}
            try {
              const b = getComputedStyle(root).getPropertyValue(name)
              if (b && b.trim()) return b.trim()
            } catch {}
            return ''
          }
          const tokenTheme = () => {
            const bg = parseColor(readToken('--dsw-alias-bg-base'))
            if (bg) {
              const l = relLum(bg)
              if (l >= 0.5) return 'light'
              if (l <= 0.2) return 'dark'
            }
            const fg = parseColor(readToken('--dsw-alias-label-primary'))
            if (fg) {
              const l = relLum(fg)
              if (l <= 0.35) return 'light'
              if (l >= 0.65) return 'dark'
            }
            return null
          }
          const hostAttrTheme = () => {
            try {
              if (document.body && document.body.hasAttribute('data-ds-dark-theme')) return 'dark'
              const ds = root.dataset
              if (ds.theme === 'light' || ds.colorScheme === 'light') return 'light'
              if (ds.theme === 'dark' || ds.colorScheme === 'dark') return 'dark'
            } catch {}
            return null
          }
          const serviceTheme = () => {
            try {
              const snap = typeof theme.getTheme === 'function' ? theme.getTheme() : null
              const active = snap && snap.active
              if (!active) return null
              const scheme = String(active.colorScheme || '')
              if (scheme === 'light' || scheme === 'dark') return scheme
              const id = String(active.id || '')
              if (id === 'light' || id === 'dark') return id
            } catch {}
            return null
          }

          /* ---------- 判定 ---------- */
          const resolve = () => {
            let forced = 'auto'
            try {
              forced = readStored(THEME_KEY, 'auto')
              if (forced === 'light' || forced === 'dark') return { mode: forced, source: 'preference', forced: true }
            } catch {}
            const byToken = tokenTheme()
            if (byToken) return { mode: byToken, source: 'host-token', forced: false, host: byToken }
            const byService = serviceTheme()
            if (byService) return { mode: byService, source: 'theme-service', forced: false }
            const byAttr = hostAttrTheme()
            if (byAttr) return { mode: byAttr, source: 'host-attr', forced: false }
            const last = FZ3_ALLOWED.indexOf(root.dataset.fz3Theme) >= 0 ? root.dataset.fz3Theme : 'dark'
            return { mode: last, source: 'keep', forced: false }
          }

          /* ---------- 自检目标 ---------- */
          const TARGETS = [
            { sel: '.fz3-sb-text b', label: '侧栏品牌名', kind: 'brand' },
            { sel: '.fz3-sb-text i', label: '侧栏品牌副标', kind: 'brand' },
            { sel: '.fz3-brandname b', label: '品牌名', kind: 'brand' },
            { sel: '.fz3-bubble-head', label: '气泡标题', kind: 'bubble' },
            { sel: '.fz3-bubble-k', label: '气泡键名', kind: 'bubble' },
            { sel: '.fz3-bubble-v', label: '气泡数值', kind: 'bubble' },
            { sel: '.fz3-bubble-v b', label: '气泡数值', kind: 'bubble' },
            { sel: '.fz3-bubble-sub', label: '气泡明细', kind: 'bubble' },
            { sel: '.fz3-peak-clock', label: '峰谷时钟', kind: 'bubble' },
          ]
          const fixedEls = new Set()
          const isLargeText = (cs) => {
            const px = parseFloat(cs.fontSize) || 12
            const weight = parseInt(cs.fontWeight, 10) || 400
            return px >= 24 || (px >= 18.66 && weight >= 700)
          }
          const bgOf = (el) => {
            let node = el
            let fallback = null
            while (node && node.nodeType === 1) {
              const cs = getComputedStyle(node)
              const c = parseColor(cs.backgroundColor)
              if (c && c.a >= 0.8) {
                if (c.a >= 0.999) return c
                if (!fallback) fallback = c
              }
              node = node.parentElement
            }
            const bodyBg = parseColor(getComputedStyle(document.body).backgroundColor) || { r: 0, g: 0, b: 0, a: 1 }
            return fallback ? over(fallback, bodyBg) : bodyBg
          }
          const clearFix = (el) => {
            try {
              el.style.removeProperty('color')
              el.style.removeProperty('text-shadow')
              delete el.dataset.fz3ContrastFix
            } catch {}
            fixedEls.delete(el)
          }
          const fixEl = (el, bg, kind) => {
            const darkBg = relLum(bg) < 0.5
            const color = kind === 'brand' ? (darkBg ? '#f2f5ff' : '#0f1730') : darkBg ? '#ffffff' : '#0b1428'
            try {
              el.style.setProperty('color', color, 'important')
              el.style.setProperty('text-shadow', 'none', 'important')
              el.dataset.fz3ContrastFix = '1'
            } catch {}
            fixedEls.add(el)
            return color
          }

          const audit = (reason) => {
            const items = []
            const seen = new Set()
            for (const target of TARGETS) {
              let nodes = []
              try { nodes = [...document.querySelectorAll(target.sel)] } catch { nodes = [] }
              for (const el of nodes) {
                if (!el || seen.has(el)) continue
                seen.add(el)
                const text = (el.textContent || '').trim()
                if (!text) continue
                const rect = el.getBoundingClientRect()
                if (rect.width < 1 || rect.height < 1) continue
                const cs = getComputedStyle(el)
                if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue
                const fg = parseColor(cs.color)
                if (!fg) continue
                const bg = bgOf(el)
                const eff = fg.a < 1 ? over(fg, bg) : fg
                const ratio = contrast(eff, bg)
                const min = isLargeText(cs) ? 3 : 4.5
                const ok = ratio >= min
                if (!ok) fixEl(el, bg, target.kind)
                else if (fixedEls.has(el)) clearFix(el)
                items.push({
                  selector: target.sel,
                  label: target.label,
                  text: text.slice(0, 20),
                  color: rgbCss(eff),
                  background: rgbCss(bg),
                  ratio: Math.round(ratio * 100) / 100,
                  min,
                  ok,
                  fixed: !ok,
                })
              }
            }
            const failures = items.filter((i) => !i.ok).length
            const autoFixed = items.filter((i) => i.fixed).length
            const minRatio = items.length ? Math.min(...items.map((i) => i.ratio)) : null
            const report = {
              at: Date.now(),
              reason: reason || 'auto',
              theme: root.dataset.fz3Theme || null,
              source: root.dataset.fz3ThemeSrc || null,
              preference: (() => { try { return readStored(THEME_KEY, 'auto') } catch { return 'auto' } })(),
              host: tokenTheme(),
              items,
              total: items.length,
              failures,
              fixed: autoFixed,
              minRatio,
              ok: failures === 0,
            }
            report.message = report.ok
              ? (items.length ? '通过：最低对比度 ' + minRatio.toFixed(1) + ':1（' + report.theme + '）' : '通过：当前没有可测元素')
              : '已自动修正 ' + autoFixed + ' 处低对比度文字（' + report.theme + '）'
            try {
              root.dataset.fz3Contrast = report.ok ? 'pass' : 'fixed'
              window.__fz3ThemeReport = report
              window.dispatchEvent(new CustomEvent('fz3:theme-report', { detail: report }))
            } catch {}
            return report
          }

          /* ---------- 应用 + 自检节拍 ---------- */
          let auditTimer = 0
          const scheduleAudit = (reason, delay) => {
            if (auditTimer) return
            auditTimer = window.setTimeout(() => {
              auditTimer = 0
              try { audit(reason) } catch {}
            }, delay === undefined ? 120 : delay)
          }

          let lastSwitch = null
          const apply = (reason) => {
            const resolved = resolve()
            const prev = root.dataset.fz3Theme
            if (prev !== resolved.mode) {
              root.dataset.fz3Theme = resolved.mode
              lastSwitch = { from: prev || null, to: resolved.mode, at: Date.now(), source: resolved.source }
              /* 主题一变，旧的兜底内联色已经过时：先全部撤掉，交给新 CSS */
              for (const el of [...fixedEls]) clearFix(el)
            }
            root.dataset.fz3ThemeSrc = resolved.source
            if (lastSwitch) root.dataset.fz3ThemeSwitch = lastSwitch.from + '→' + lastSwitch.to
            scheduleAudit(reason || 'apply')
            return resolved
          }

          apply('boot')
          /* 插件可能比宿主写外观属性更早执行：补几次重试，覆盖首屏 */
          for (const delay of [60, 180, 420, 900, 1800]) {
            window.setTimeout(() => { try { apply('retry') } catch {} }, delay)
          }

          /* 对外诊断接口：控制台 / 设置页「主题校验」共用 */
          const runCheck = () => {
            apply('manual')
            return audit('manual')
          }
          try { window.__fz3ThemeCheck = runCheck } catch {}

          /* 常驻轮询：只做字符串比较；宿主切外观没触发事件时也能在 500ms 内纠正 */
          const pollTimer = window.setInterval(() => {
            try { apply('poll') } catch {}
          }, 500)
          /* 气泡是点开的、品牌名也可能换，2 秒兜底自检一次 */
          const auditTick = window.setInterval(() => {
            try { audit('tick') } catch {}
          }, 2000)
          const onPref = () => apply('pref')
          const onPointer = () => scheduleAudit('pointer', 260)
          try { window.addEventListener('fz3:theme-pref', onPref) } catch {}
          try { window.addEventListener('pointerup', onPointer, true) } catch {}

          let off = null
          if (typeof ctx.on === 'function') {
            try { off = ctx.on('theme/change', () => apply('theme-change')) } catch { off = null }
          }
          let media = null
          const onMedia = () => apply('media')
          try {
            media = window.matchMedia('(prefers-color-scheme: light)')
            media.addEventListener('change', onMedia)
          } catch { media = null }

          let pending = 0
          let observer = null
          try {
            /* 拖动眼徽会不停改 <html> 内联样式：260ms 去抖 */
            observer = new MutationObserver(() => {
              if (pending) return
              pending = window.setTimeout(() => {
                pending = 0
                try { apply('mutation') } catch {}
              }, 260)
            })
            observer.observe(root, { attributes: true, attributeFilter: ['style', 'class', 'data-theme', 'data-color-scheme', 'data-fz3-theme'] })
            /* 宿主切深浅时改的是 <body data-ds-dark-theme> */
            observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'class', 'style', 'data-theme'] })
          } catch { observer = null }

          if (typeof ctx.effect === 'function') {
            ctx.effect(() => () => {
              try { off && off() } catch {}
              try { window.removeEventListener('fz3:theme-pref', onPref) } catch {}
              try { window.removeEventListener('pointerup', onPointer, true) } catch {}
              try { pending && clearTimeout(pending) } catch {}
              try { auditTimer && clearTimeout(auditTimer) } catch {}
              try { media && media.removeEventListener('change', onMedia) } catch {}
              try { observer && observer.disconnect() } catch {}
              try { window.clearInterval(pollTimer) } catch {}
              try { window.clearInterval(auditTick) } catch {}
              for (const el of [...fixedEls]) clearFix(el)
              try {
                if (window.__fz3ThemeCheck === runCheck) delete window.__fz3ThemeCheck
                delete window.__fz3ThemeReport
                delete root.dataset.fz3Theme
                delete root.dataset.fz3ThemeSrc
                delete root.dataset.fz3Contrast
                delete root.dataset.fz3ThemeSwitch
              } catch {}
            })
          }
        })

        /* ------------------------------------------------------------ *
         * 动态圆角：按元素高度算半径（r = h × 0.23）
         * 
         * 参考图实测：深色卡片 263×105，圆角约 24px → 半径 ≈ 高度的 23%。
         * 固定像素没法让不同高度的元素保持同一比例，所以这里量高度再写。
         * 用 ResizeObserver 监听尺寸变化，元素换了/尺寸变了都会重算。
         * ------------------------------------------------------------ */
        guard('dyn-radius', () => {
          /* 2026-11-22 起改用固定半径（见 CSS 里的「圆角：固定值」），这里直接返回 */
          return
          const SEL = [
            'button[class*="_newSession"]',
            '[class*="_panelList"]',
            '[class*="GAkraW_root"]',
            '[class*="GRgSLq_card"]',
            '.fz3-bubble',
          ].join(',')
          /* 大元素：半径 = 高度 × 0.23（与参考图一致）
             小元素（高 ≤ 44px，比如「新会话」按钮）：做成胶囊 = 高度的一半，
             否则 34px 高的按钮算出来只有 10px，看起来是方的。 */
          const RATIO = 0.23
          const SMALL = 44
          const MAX = 36
          const radiusFor = (h) => {
            const raw = h <= SMALL ? h / 2 : h * RATIO
            return Math.round(Math.min(MAX, Math.max(6, raw)))
          }
          const seen = new WeakSet()
          const apply = (el) => {
            try {
              const h = el.getBoundingClientRect().height
              if (!h) return
              const r = radiusFor(h)
              el.style.setProperty('border-radius', r + 'px', 'important')
            } catch (e) { /* 静默 */ }
          }
          let ro = null
          try {
            ro = new ResizeObserver((entries) => {
              for (const entry of entries) apply(entry.target)
            })
          } catch { ro = null }
          const scan = () => {
            try {
              document.querySelectorAll(SEL).forEach((el) => {
                if (seen.has(el)) { apply(el); return }
                seen.add(el)
                apply(el)
                if (ro) ro.observe(el)
              })
            } catch (e) { /* 静默 */ }
          }
          scan()
          let mo = null
          try {
            mo = new MutationObserver(() => scan())
            mo.observe(document.body, { childList: true, subtree: true })
          } catch { mo = null }
          const timer = window.setInterval(scan, 1200)
          if (typeof ctx.effect === 'function') {
            ctx.effect(() => () => {
              try { ro && ro.disconnect() } catch {}
              try { mo && mo.disconnect() } catch {}
              try { window.clearInterval(timer) } catch {}
            })
          }
        })
        /* ------------------------------------------------------------ *
         * 眼徽自适应：两个侧栏都开着、且窗口小于 1920x1080 时缩小
         * 
         * 判断依据（都在 DOM 上，稳定）：
         *   · 左栏 [class*="_sidebarCol"] 可见
         *   · 右栏 [class*="_rightbarCol"] 可见（宽度 > 120）
         *   · 窗口 < 1920x1080
         * 命中就把 --fz3-dock-size 从 64 降到 48，同时把气泡字号略缩，
         * 否则两边一挤，眼徽会压到正文或右栏。
         * ------------------------------------------------------------ */
        guard('eye-shrink', () => {
          const root = document.documentElement
          const visible = (el, minW) => {
            if (!el) return false
            const r = el.getBoundingClientRect()
            return r.width >= minW && r.height > 100
          }
          const readSize = () => parseFloat(getComputedStyle(root).getPropertyValue('--fz3-dock-size')) || 64
          let cur = readSize()
          const apply = () => {
            try {
              const big = window.innerWidth >= 1600 && window.innerHeight >= 900
              const narrow = window.innerWidth < 1920 && window.innerHeight < 1080
              const left = visible(document.querySelector('[class*="_sidebarCol"]'), 120)
              const right = visible(document.querySelector('[class*="_rightbarCol"]'), 120)
              const shrink = narrow && left && right
              const want = shrink ? 48 : big ? 96 : 64
              if (want === cur) return
              cur = want
              root.style.setProperty('--fz3-dock-size', want + 'px')
              root.style.setProperty('--fz3-eye-shrink', shrink ? '1' : '0')
              /* 档位一变，横向坐标里「半个眼徽」那截就旧了：通知落位那边按新尺寸重算。
                 新建对话页上由 heroWatch 自己跟着重算，这里只需要管对话页。 */
              try { window.dispatchEvent(new CustomEvent('fz3:eye-size')) } catch (e) { /* 静默 */ }
            } catch (e) { /* 静默 */ }
          }
          apply()
          const onResize = () => apply()
          window.addEventListener('resize', onResize)
          const timer = window.setInterval(apply, 600)
          if (typeof ctx.effect === 'function') {
            ctx.effect(() => () => {
              try { window.removeEventListener('resize', onResize) } catch {}
              try { window.clearInterval(timer) } catch {}
            })
          }
        })
        /* ------------------------------------------------------------ *
         * 运行状态行右端的 NOW LOADING 动画（2026-11-22 重做）
         * 挂载点：宿主运行期间渲染的那一行「深度求索中，用时 N 秒」
         * （div.V4vHZW_running），绝对定位到该行右端；每 900ms 复查补回
         * 被 React 冲掉的节点。是否显示由 /fairy-zzz/mood 决定：
         * thinking / working / running 才播，其余状态立刻摘掉。
         * 不想再要：把 TAIL_ANIM 改成 false。
         * ------------------------------------------------------------ */
        /* ------------------------------------------------------------ *
         * 聊天窗口里的 NOW LOADING 动画（2026-11-22）
         * 挂在聊天窗口（对话列）右上角内侧，不挂在「思考 / 写入 / 深度求索中」
         * 这些行里：行内挂载会随 React 每秒重渲染被冲掉，位置也乱跳。
         * 做法：body 里放一个 fixed 定位的小播放器，每 500ms 按聊天窗口的
         * rect 重新摆一次（右缘内缩 16px、上缘内缩 12px），与输入框高度无关。
         * 播放：thinking / working / running 时播；回到 idle / done 再等 2.5 秒
         * 暂停定格、留在原位（永不隐藏），下一轮接着播。
         * 不想再要：把 CORNER_ANIM 改成 false。
         * ------------------------------------------------------------ */
        guard('corner-anim', () => {
          if (typeof document === 'undefined' || !document.body) return
          const CORNER_ANIM = true
          if (!CORNER_ANIM) return
          const SRC = '/fairy-zzz/assets/loading.webm'
          const box = document.createElement('div')
          box.className = 'fz3-loading fz3-corner'
          box.setAttribute('aria-hidden', 'true')
          const video = document.createElement('video')
          video.src = SRC
          video.muted = true
          video.loop = true
          video.playsInline = true
          video.setAttribute('preload', 'auto')
          box.appendChild(video)
          /* 2026-11-23 主人要求「刚好在文字的上一层」：印章保持在正文之上。
             挂到 body 末尾 + z-index:0 时，它是「定位元素」，按 CSS 绘制顺序
             排在流内正文（步骤 3/5）之上，但低于 z-index>0 的浮层/菜单。
             试过插到 #root 之前去夹「文字↔卡片」：会被聊天列底下那层不透明
             底衬整片盖掉（实测印章直接消失），所以还是挂 body 末尾。 */
          /* 2026-11-23：插件被热替换时，旧实例的印章没人删，body 里会越攒越多
             （主人这张截图里同时出现了三枚）。挂自己之前先把别人的清掉，
             保证全局只有一枚；真被 React/热替换冲掉也能靠 500ms 的 place() 补回。 */
          try {
            const stale = document.querySelectorAll('.fz3-loading.fz3-corner')
            for (let i = 0; i < stale.length; i += 1) {
              try { stale[i].remove() } catch (e) {}
            }
          } catch (e) {}
          document.body.appendChild(box)

          /* 2026-11-23 诊断：把印章的层叠实况回报给宿主，`GET /fairy-zzz/stack` 可读。
             主人反馈「置到文字上一层没生效」，而肉眼很难分清是
             ①z-index 被更大的浮层压住、②某个祖先建了层叠上下文把它关在里面、
             ③被容器裁掉。这里一次性把 computedStyle、祖先里所有会形成层叠上下文的节点、
             以及印章中心点真正命中谁（elementFromPoint）都报上去。只报一次。 */
          /* 2026-11-23：上报从「只报一次」改成「命中对象或坐标一变就重报」。
             主人这次要动印章的挂载层级，一-shot 快照量到的常是挂载瞬间的中间态
             （坐标还没落好、父节点刚换），看不出改完到底什么样。 */
          let stackSig = ''
          const describeNode = (node) => {
            if (!node) return 'null'
            const cls = String(node.className || '').trim().split(/\s+/).slice(0, 3).join('.')
            return node.tagName + (cls ? '.' + cls : '')
          }
          const reportStack = () => {
            const r = box.getBoundingClientRect()
            if (r.width < 1 || r.height < 1) return
            try {
              const sig = Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width) + ',' +
                (box.parentElement ? String(box.parentElement.className || box.parentElement.tagName) : '-')
              if (sig === stackSig) return
              stackSig = sig
              const cs = window.getComputedStyle(box)
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
              const contexts = []
              let p = box.parentElement
              while (p && p !== document.documentElement) {
                const s = window.getComputedStyle(p)
                if (s.zIndex !== 'auto' || s.transform !== 'none' || s.filter !== 'none' || s.opacity !== '1' || s.isolation === 'isolate') {
                  contexts.push(describeNode(p) + ' z=' + s.zIndex + ' pos=' + s.position + ' op=' + s.opacity + ' tf=' + (s.transform === 'none' ? '-' : 'yes'))
                }
                p = p.parentElement
              }
              /* 印章中心点被谁压着，就把它和它往上所有带 z-index 的祖先一起报上来 ——
                 这样才能知道「要压过它得用多大的 z」。 */
              const hitChain = []
              let q = hit
              while (q && q !== document.documentElement) {
                const s2 = window.getComputedStyle(q)
                if (s2.zIndex !== 'auto' || s2.position !== 'static') {
                  hitChain.push(describeNode(q) + ' z=' + s2.zIndex + ' pos=' + s2.position)
                }
                q = q.parentElement
              }
              fetch('/fairy-zzz/stack', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  z: cs.zIndex,
                  position: cs.position,
                  opacity: cs.opacity,
                  filter: cs.filter,
                  rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
                  hit: describeNode(hit),
                  hitIsStamp: !!(hit && (hit === box || box.contains(hit))),
                  parent: describeNode(box.parentElement),
                  contexts,
                  hitChain,
                  viewport: { w: window.innerWidth, h: window.innerHeight },
                }),
              }).catch(() => {})
            } catch (e) {}
          }

          let active = false
          let pauseTimer = null
          /* 位置（2026-11-22 主人第二轮要求）：
             贴聊天窗口右下角、输入卡片上沿；如果「任务清单」停靠条
             （section[data-testid="todo-panel"]，宿主 conversation.input.dock）
             出现在输入框上方，就整体再往上让，放到那条的上方，免得被它压住。
             锚点优先级：todo 条 → 输入卡片 → 聊天窗口底 → 视口底，任何情况下
             都落在右下角，不会停在 (0,0)，也不会因为找不到锚点就不显示。 */
          const CHAT_SELECTORS = ['[data-conversation-scroll]', '[class*="_centerCol"]']
          const COMPOSER_SELECTORS = [
            '[data-slot="conversation.composer"]',
            '[class*="GRgSLq_card"]',
            '[class*="GRgSLq_root"]',
          ]
          const TODO_SELECTORS = ['[data-testid="todo-panel"]', 'section[class*="DXuOLW_root"]']
          const findChat = () => {
            for (const sel of CHAT_SELECTORS) {
              let el = null
              try { el = document.querySelector(sel) } catch (e) { el = null }
              if (!el) continue
              const r = el.getBoundingClientRect()
              if (r.width >= 200 && r.height >= 200) return { sel, r }
            }
            return null
          }
          const rectOfSel = (sel) => {
            let el = null
            try { el = document.querySelector(sel) } catch (e) { el = null }
            if (!el) return null
            const r = el.getBoundingClientRect()
            return r.width >= 60 && r.height >= 8 ? r : null
          }
          /* 同一个用途有好几个候选选择器时，取**最窄**的那个 —— 外层 slot 容器
             往往铺满整列/整窗，真正想对齐的是里面那张卡片。 */
          const pickRect = (selectors, narrowest) => {
            const hits = []
            for (const sel of selectors) {
              const r = rectOfSel(sel)
              if (r) hits.push({ sel, r })
            }
            if (!hits.length) return null
            if (narrowest) hits.sort((a, b) => a.r.width - b.r.width)
            return hits[0]
          }
          const composerHit = () => pickRect(COMPOSER_SELECTORS, true)
          const todoHit = () => pickRect(TODO_SELECTORS, true)
          const place = () => {
            const w = box.offsetWidth || 167
            const h = box.offsetHeight || 48
            const chat = findChat()
            const ch = composerHit()
            const composer = ch ? ch.r : null
            /* 2026-11-22 主人第三轮要求：**不再捕捉任务条**。任务条出现/展开
               都不影响落点，动画固定贴在输入卡片上沿右侧；任务条占的地方就让
               它叠在任务条右端（fixed + z-index 9001 + pointer-events:none，
               只盖住视觉，不挡点击）。 */
            const right = chat ? chat.r.right : window.innerWidth
            const anchorRight = composer ? composer.right : right
            let refTop = null
            if (composer) refTop = composer.top
            else if (chat) refTop = chat.r.bottom - 24
            else refTop = window.innerHeight - 140
            /* 2026-11-23 主人要求：印章贴回输入卡片右上角内侧（上一版左移 96px）。
               偏移量由 CSS 变量 --fz3-corner-shift 决定（默认 0），每次重排都重读，
               改 CSS 即可实时生效；读不到就回落到 0。 */
            const shiftLeft = () => {
              let raw = ''
              try {
                raw = window.getComputedStyle(document.documentElement)
                  .getPropertyValue('--fz3-corner-shift')
              } catch (e) { raw = '' }
              const px = parseFloat(raw)
              return Number.isFinite(px) ? px : 0
            }
            box.style.left = Math.round(Math.max(8, anchorRight - w - 12 - shiftLeft())) + 'px'
            box.style.top = Math.round(Math.max(8, refTop - h - 8)) + 'px'
            reportStack()
          }
          const show = () => {
            box.style.display = 'flex'
            box.dataset.paused = '0'
            place()
            try {
              const p = video.play()
              if (p && typeof p.catch === 'function') p.catch(() => {})
            } catch (e) {}
          }
          /* 暂停但**不隐藏**（2026-11-22 主人要求）：定格在当前帧、留在原位，
             下一轮进入 thinking 时从这一帧接着播，不会跳回开头。 */
          const pause = () => {
            box.dataset.paused = '1'
            try { video.pause() } catch (e) {}
          }
          const poll = () => {
            try {
              fetch('/fairy-zzz/mood', { cache: 'no-store' })
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => {
                  const m = d && d.mood
                  const next = m === 'thinking' || m === 'working' || m === 'running'
                  if (next === active) return
                  active = next
                  if (active) {
                    if (pauseTimer) {
                      window.clearTimeout(pauseTimer)
                      pauseTimer = null
                    }
                    show()
                  } else {
                    /* 回复结束后再多播 2.5 秒，然后暂停定格、留在原位
                       （2026-11-22 主人要求：别再消失）。
                       这 2.5 秒里如果又回到运行态，就取消这次暂停。 */
                    if (pauseTimer) window.clearTimeout(pauseTimer)
                    pauseTimer = window.setTimeout(() => {
                      pauseTimer = null
                      if (!active) pause()
                    }, 2500)
                  }
                })
                .catch(() => {})
            } catch (e) { /* 静默 */ }
          }
          const reposition = () => { if (box.style.display !== 'none') place() }
          window.addEventListener('resize', reposition)
          /* 一上来就摆好：显示首帧、保持暂停，开回合再播。 */
          box.style.display = 'flex'
          box.dataset.paused = '1'
          place()
          window.setTimeout(() => {
            place()
          }, 1200)
          poll()
          const moodTimer = window.setInterval(poll, 800)
          const placeTimer = window.setInterval(reposition, 500)
          if (ctx && typeof ctx.effect === 'function') {
            ctx.effect(() => () => {
              try { if (pauseTimer) window.clearTimeout(pauseTimer) } catch {}
              try { window.clearInterval(moodTimer) } catch {}
              try { window.clearInterval(placeTimer) } catch {}
              try { window.removeEventListener('resize', reposition) } catch {}
              try { video.pause(); box.remove() } catch {}
            })
          }
        })

        /* 深色背景视频：静音循环，浅色时 CSS 会把它藏起来。
           2026-11-22 起不再走 shell.overlay 槽（那个槽整块压在界面上面，
           视频会变成一层暗色"墨镜"），改为由下面 apply() 里的
           videobg 守卫直接插进 <body> 开头当背景。 */
        const mount = (key, spec, component) => {
          guard('inject:' + key, () => {
            ctx.slots.inject(key, () => {
              guard('register:' + key, () => {
                ctx.slots.register({ name: key, ...spec }, component)
              })
            })
          })
        }
        /* ---------- 背景视频（ZZZ Logo 循环动画，1080p60） ----------
           2026-11-22：先按主人反馈把"压在界面上的黑玻璃"关掉，随后主人要求保留动画
           当背景 —— 于是它插进 <body> 开头、z-index:-1，落在内容后面；配合 CSS 里
           让 body 让出底色的那两条规则，就成了真背景，不再压住界面。

           2026-11-23（1.0.19）：**按主题懒建**，不再是"两条都建、再藏一条"。
           以前深色下浅色那条（video.fz3-logo-video，插在中间栏）虽然被
           display:none 藏了，浏览器不会替你停解码器 —— 两条 1080p60 同源视频
           一起空转，白烧一半的解码/合成预算。现在：
             · 深色：只建 video.fz3-videobg（整窗）；浅色那条**连元素都不创建**；
             · 浅色：只建 video.fz3-logo-video（中间栏）；深色那条不创建；
             · 切主题：进来的那条建出来，离开的那条 pause + 摘 src + load()
               （解码器与缓冲一起释放）再 remove()，全局任何时刻只有一条在解码。
           不想再要：VIDEO_BG = false。 */
        const VIDEO_BG = true
        const BG = {
          dark: { cls: 'fz3-videobg', src: '/fairy-zzz/assets/zzz-logo-bg.mp4' },
          light: { cls: 'fz3-logo-video', src: '/fairy-zzz/assets/zzz-logo-bg-light.mp4' },
        }
        const bgVideo = { dark: null, light: null }
        const bgIsLight = () => {
          const root = document.documentElement
          const mode = root && root.dataset ? root.dataset.fz3Theme : null
          if (mode === 'light') return true
          if (mode === 'dark') return false
          return !(document.body !== null && document.body.hasAttribute('data-ds-dark-theme'))
        }
        /* 元素可能在 HMR / 重新 apply 时被别处留下：先按类名认领，别重复建 */
        const claimBgVideo = (which) => {
          if (typeof document === 'undefined') return null
          if (bgVideo[which] !== null && bgVideo[which].isConnected) return bgVideo[which]
          const found = document.querySelector('video.' + BG[which].cls)
          bgVideo[which] = found
          return found
        }
        const dropBgVideo = (which) => {
          const video = claimBgVideo(which)
          if (video === null) return
          try { video.pause() } catch {}
          try { video.removeAttribute('src'); video.load() } catch {}
          try { video.remove() } catch {}
          bgVideo[which] = null
        }
        const ensureBgVideo = (which) => {
          if (!VIDEO_BG) return null
          if (typeof document === 'undefined' || !document.body) return null
          const isLight = which === 'light'
          /* 主题不对就一条都不建 —— 这就是"深色下浅色那条不要运行"的落点 */
          if (isLight !== bgIsLight()) return null
          const kept = claimBgVideo(which)
          if (kept !== null) return kept
          /* 深色铺整窗（挂 body 首位）；浅色挂进中间栏正文之下，层级同宿主鲸鱼：
             优先鲸鱼 canvas 的父节点，量不到（已进对话 / 还没渲染）退回中间栏。 */
          let host = document.body
          if (isLight) {
            const whale = document.querySelector('canvas[data-home-whale]')
            host = whale !== null && whale.parentElement !== null
              ? whale.parentElement
              : document.querySelector('[class*="_centerCol"]')
          }
          if (host === null) return null
          const video = document.createElement('video')
          video.className = BG[which].cls
          video.src = BG[which].src
          video.muted = true
          video.loop = true
          video.playsInline = true
          video.autoplay = true
          video.preload = 'auto'
          video.setAttribute('aria-hidden', 'true')
          host.insertBefore(video, host.firstChild)
          bgVideo[which] = video
          try {
            const started = video.play()
            if (started && typeof started.catch === 'function') started.catch(() => {})
          } catch (e) { /* 自动播放被拦：留一帧底色，不影响使用 */ }
          return video
        }

        /* ---------- 背景视频监督（1.0.18 起）：卡住自救 ----------
           主人 2026-11-23 的反馈：「后面的背景偶尔会卡住」，界面照常能点。
           编解码器偶发停滞后没人拉一把，只能干等下一次 loop 才自己恢复 ——
           现在每秒看一次 currentTime：不动 play()，连拉两次不动就 load() 重挂。
           控制台可查：window.__fz3Bg -> { ticks, resets, reloads, theme, last }。 */
        guard('videobg-health', () => {
          if (typeof window === 'undefined' || typeof document === 'undefined') return
          const stats = { ticks: 0, resets: 0, reloads: 0, theme: null, last: null }
          try { window.__fz3Bg = stats } catch {}
          const lastTimes = new WeakMap()
          const stuck = new WeakMap()
          const checkStall = (video) => {
            const prev = lastTimes.get(video)
            lastTimes.set(video, video.currentTime)
            if (prev === undefined || video.currentTime !== prev) { stuck.set(video, 0); return }
            /* 在播、可见，但一秒内时间轴没动：解码头掉了 */
            const n = (stuck.get(video) || 0) + 1
            stuck.set(video, n)
            stats.last = { at: Date.now(), stuckFor: n, src: video.getAttribute('src') }
            if (n === 1) {
              stats.resets += 1
              const p = video.play()
              if (p && typeof p.catch === 'function') p.catch(() => {})
            } else if (n >= 3) {
              stats.reloads += 1
              stuck.set(video, 0)
              try { video.load() } catch {}
              const p = video.play()
              if (p && typeof p.catch === 'function') p.catch(() => {})
            }
          }
          const tick = () => {
            if (document.hidden) return
            const light = bgIsLight()
            stats.theme = light ? 'light' : 'dark'
            /* 先拆不该在的那条，再保证该在的那条活着 */
            dropBgVideo(light ? 'dark' : 'light')
            const video = ensureBgVideo(light ? 'light' : 'dark')
            if (video !== null) {
              if (video.paused) {
                const p = video.play()
                if (p && typeof p.catch === 'function') p.catch(() => {})
                lastTimes.set(video, video.currentTime)
                stuck.set(video, 0)
              } else {
                checkStall(video)
              }
            }
            stats.ticks += 1
          }
          const timer = window.setInterval(tick, 1000)
          window.setTimeout(tick, 300)
          window.setTimeout(tick, 1200)
          if (ctx && typeof ctx.effect === 'function') {
            ctx.effect(() => () => {
              window.clearInterval(timer)
              dropBgVideo('dark')
              dropBgVideo('light')
            })
          }
        })

        mount('sidebar.brand.mark', { id: 'fairy-zzz-brandmark', priority: 100 }, BrandMark)
        mount('conversation.hero.brand.mark', { id: 'fairy-zzz-hero-mark', priority: 100 }, HeroMark)
        mount('sidebar.brand.name', { id: 'fairy-zzz-brandname', priority: 100 }, BrandName)
        mount('shell.overlay', { id: 'fairy-zzz-skin', order: 24 }, FairySkin)
        mount('shell.overlay', { id: 'fairy-zzz-atmos', order: 12 }, Atmos)
            mount('conversation.chat.assistant-actions', { id: 'fairy-zzz-voice', order: 20, label: '朗读' }, VoiceAction)
        mount('settings.section', { id: 'fairy-zzz-settings', order: 40, label: 'Fairy' }, FairySettings)
        /* 学习代办（原 dsh-learning-todo）：侧栏脚部卡片，显隐由设置页开关控制 */
        mount('sidebar.footer.action', { id: 'fairy-zzz-todo', order: 10 }, LearningTodoCard)

      },
    }
  },
})


/* __TEMP_CHAT_TONE__ */
;(() => {
  const css = ":root,:root [data-theme],html,body{--ct-body:#B0B0B0;--ct-key:#eef0fa;--ct-input:#aaaaaa;--ct-list:#aaaaaa;--ct-hint:#6b6f76;--dsw-alias-label-primary:var(--ct-body)!important;--dsw-alias-label-secondary:var(--ct-body)!important;}h1,h2,h3,h4,h5,h6,strong,b,th,dt,code,kbd,samp,pre,a,[class*='_title'],[class*='_heading'],[class*='_headline']{color:var(--ct-key)!important;}button,button *,[role='button'],[role='tab']{color:var(--ct-key)!important;}textarea,input,[role='textbox'],[role='textbox'] *,[contenteditable='true'],[contenteditable='true'] *{color:var(--ct-input)!important;-webkit-text-fill-color:var(--ct-input)!important;}pre code,pre code *{color:inherit!important;}html body [class*='_listArea'][class*='_listArea'],html body [class*='_listArea'][class*='_listArea'] *{color:var(--ct-list)!important;}input::placeholder,textarea::placeholder,[role='textbox']::before,[contenteditable='true']::before,[class*='_placeholder'][class*='_placeholder'],[class*='_placeholder'][class*='_placeholder'] *{color:var(--ct-hint)!important;-webkit-text-fill-color:var(--ct-hint)!important;}:root body [class*='runningIcon']{width:30px!important;height:42px!important;}";
  const el = document.createElement('style');
  el.setAttribute('data-temp-chat-tone', '1');
  el.textContent = css;
  document.head.appendChild(el);
})();

/* __TEMP_CHAT_TONE_TEXT__ */

(() => {
  const FROM = ['深度求索中', '空洞深潜中'];
  const TO = '空洞探索中';
  const EN_FROM = 'Deep diving';
  const EN_TO = 'Hollow exploring';
  const skip = (el) => !el || !!el.closest('pre, code, textarea, input, [contenteditable="true"]');
  const convert = (s) => {
    let out = s;
    for (const f of FROM) if (out.includes(f)) out = out.split(f).join(TO);
    if (out.includes(EN_FROM)) out = out.split(EN_FROM).join(EN_TO);
    return out;
  };
  // 律动层的文案在 data-shimmer-text 属性里，必须连属性一起改
  const fixAttr = (el) => {
    if (!el || el.nodeType !== 1) return;
    const v = el.getAttribute && el.getAttribute('data-shimmer-text');
    if (v) {
      const next = convert(v);
      if (next !== v) el.setAttribute('data-shimmer-text', next);
    }
    if (el.querySelectorAll) {
      el.querySelectorAll('[data-shimmer-text]').forEach((n) => {
        const old = n.getAttribute('data-shimmer-text');
        const nb = convert(old);
        if (nb !== old) n.setAttribute('data-shimmer-text', nb);
      });
    }
  };
  const walk = (root) => {
    if (!root) return;
    if (root.nodeType === 3) {
      if (!skip(root.parentElement)) {
        const next = convert(root.nodeValue);
        if (next !== root.nodeValue) root.nodeValue = next;
      }
      return;
    }
    if (root.nodeType !== 1 || skip(root)) return;
    fixAttr(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const next = convert(n.nodeValue);
      if (next !== n.nodeValue) n.nodeValue = next;
    }
  };
  walk(document.body);
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') walk(r.target);
      else if (r.type === 'attributes') fixAttr(r.target);
      else r.addedNodes.forEach((nd) => walk(nd));
    }
  });
  mo.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['data-shimmer-text'],
  });
  window.__ctRunningText = mo;
})();


/* __TEMP_CHAT_TONE_LIGHT__ —— 2026-11-23 02:20 撤掉（主人报「浅色文字一闪一闪」）
   ------------------------------------------------------------
   这一段原来干的事：每 1.5s 往 <body> 写一遍行内 --ct-*（浅色 #333/#444/#888，
   深色灰白），靠行内 !important 压过宿主/皮肤写在别处的值。
   问题出在「它既是定时写手、又跟着 bundle 实例走」：
     · 插件 bundle 被热替换（不刷新页面直接换新代码）时，旧实例的 setInterval
       不会停，新旧两个实例各写各的调色板 —— 文字每 1.5s 变一次色，即「一闪一闪」。
     · 以前两份取值一模一样，所以从没显形；这轮把 #000/#4d4d4d 换成
       #333333/#444444 之后，新旧两份对不上了，一闪就看得出来。
   现在浅色由皮肤 CSS「五档灰阶」块 + dsh-chat-tone 的
   :root[data-fz3-theme="light"] 静态决定，深色由两边各自 :root 的灰白决定 ——
   纯静态级联，多开几个实例也只会算出同一个值，不可能再闪。
   摘掉行内后的实测（CDP 读 getComputedStyle）：
     浅色  --ct-key #333333 / --ct-body #444444 / --ct-input #333333 /
           --ct-list #444444 / --ct-hint #888888 / label-primary #444444
     深色  --ct-key #eef0fa / --ct-body #B0B0B0 / --ct-input·list #aaaaaa /
           --ct-hint #6b6f76 / label-primary·secondary #B0B0B0
   —— 与原来定时写进去的值逐项相同。
   想恢复旧行为：把这段注释换回原来那个定时写变量的 IIFE
   （备份见 color-pass\client.js.bak-before-removing-tone-js）。
   ------------------------------------------------------------ */


/* __TEMP_CHAT_TONE_SHIM__ */
;(() => {
  const css = "@keyframes ct-shimmer-sweep{0%{transform:translate(-100%)}66.6667%,to{transform:translate(100%)}}@keyframes ct-shimmer-highlight{0%{transform:translate(100%)}66.6667%,to{transform:translate(-100%)}}[data-shimmer] [class*='_decoration_']{display:block!important;visibility:visible!important;opacity:1!important;position:absolute!important;inset:0!important;overflow:clip!important;pointer-events:none!important;}[data-shimmer] [class*='_sweep_']{position:absolute!important;inset:0!important;overflow:hidden!important;mask-image:linear-gradient(105deg,transparent 0%,#000 40% 60%,transparent 100%)!important;-webkit-mask-image:linear-gradient(105deg,transparent 0%,#000 40% 60%,transparent 100%)!important;animation:ct-shimmer-sweep 1.5s steps(48,end) .3s infinite!important;}[data-shimmer] [class*='_highlight_']{width:100%!important;height:100%!important;animation:ct-shimmer-highlight 1.5s steps(48,end) .3s infinite!important;}";
  const el = document.createElement('style');
  el.setAttribute('data-temp-chat-tone-shim', '1');
  el.textContent = css;
  document.head.appendChild(el);
})();

/* __TEMP_CHAT_TONE_VOICE__ —— 2026-11-23 03:20 撤掉
   这段调试残留每次页面加载都会执行 localStorage.setItem('fairy.zzz.voice','false')，
   等于把主人的语音开关永久关掉（皮肤默认是 true，见 VOICE_KEY / readBool(VOICE_KEY,true)）。
   语音不播放的第一嫌疑人就是它：删掉之后开关状态不再被强行改写。
   注意：它已经写进去的 'false' 还留在浏览器 localStorage 里，需要在
   设置 → Fairy → 语音 里重新打开一次（或清掉 fairy.zzz.voice 这个键）。 */

