/**
 * 自动朗读「念什么」的回归测试（2026-11-27 修「同一句话念两遍」）。
 *
 * client.js 是浏览器侧的单文件模块，没有独立的导出；这里用两个稳定标记把它里面
 * 纯函数那一段（TRIO_* + trioSentences / trioAnswerParts / pickTrio）切出来跑，
 * 保证测的就是真正发到语音队列的那段文本。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'client.js'), 'utf8')
const START = '    const TRIO_PART = 50'
const END = '    /* 「分析完成」时念的分析结果'
const from = source.indexOf(START)
const to = source.indexOf(END)
assert.ok(from > 0 && to > from, 'client.js 里找不到朗读函数段（标记被改动了？）')
const block = source.slice(from, to)

/* 自动朗读的「同段 90 秒只投一次」闸也在同一段逻辑里，一起切出来测 */
const GATE_START = '    const AUTO_SAID_GAP'
const GATE_END = '    async function queueSay('
const gateFrom = source.indexOf(GATE_START)
const gateTo = source.indexOf(GATE_END)
assert.ok(gateFrom > 0 && gateTo > gateFrom, 'client.js 里找不到 firstSight 闸（标记被改动了？）')
const gate = source.slice(gateFrom, gateTo)

const { pickTrio, trioKey, firstSight } = new Function(
  block + '\n' + gate + '\nreturn { pickTrio, trioKey, firstSight }',
)()

let pass = 0
function ok(name, cond) {
  assert.ok(cond, name)
  pass += 1
  console.log('  ok  ' + name)
}
function count(text, needle) {
  return text.split(needle).length - 1
}

/* 1. 主人报的「读两遍」：正文首句只准出现一次。
      上一版把 /fairy-zzz/analysis 的 text（其实就是正文首句）当分析结论拼在前面，
      宿主流里多了空格，逐字去重对不上，于是开头那句念了两遍。 */
const bug = '语音通路已经查清，改成每轮只念一句也做完了。解压完成，主人。'
  + '过程记录如下，数字一个都没美化。定下来之后，我再开始处理 Day 1 任务。'
const said = pickTrio(bug)
ok('首句只念一次', count(said, '语音通路已经查清') === 1)
ok('首句就是开头', said.startsWith('语音通路已经查清'))
ok('结尾句也保留', said.includes('我再开始处理 Day 1 任务'))

/* 2. 正文里本来就重复的句子（标点/空格不同也算同一句）只念一次 */
const repeated = '解压完成，主人。解压完成 ，主人！接下来我去看日志。'
const deduped = pickTrio(repeated)
ok('重复句按指纹去重', count(deduped, '解压完成') === 1)

/* 3. 长回复：开头 + 结尾，中间省略；顺序不乱、不重叠、总长受控 */
const long = Array.from({ length: 10 }, (_, i) => `第${i + 1}句是这一段里的正文内容。`).join('')
const longSaid = pickTrio(long)
ok('长回复不超过 160 字', longSaid.length <= 160)
ok('长回复有开头', longSaid.startsWith('第1句'))
ok('长回复有结尾', longSaid.includes('第10句'))
ok('长回复不重复', count(longSaid, '第1句') === 1 && count(longSaid, '第10句') === 1)
ok('长回复顺序正确', longSaid.indexOf('第1句') < longSaid.indexOf('第10句'))

/* 4. 一句话的短回复：原样念一次，句末补句号 */
const oneLine = pickTrio('已经打开窗口')
ok('短回复只念一次', count(pickTrio('已经打开窗口。'), '已经打开窗口') === 1)
ok('短回复补句号', oneLine === '已经打开窗口。')

/* 5. 整段没有句号的超长正文：在标点处收口，不念到一半断掉 */
const flat = '这是一段没有句号的超长正文'.repeat(30)
const flatSaid = pickTrio(flat)
ok('超长正文有上限', flatSaid.length <= 161)
ok('超长正文以标点收口', /[。；！？]$/.test(flatSaid))

/* 6. 只有代码块时没有可念的东西，交给调用方走 pickSummary 兜底 */
ok('空文本返回空串', pickTrio('') === '')
ok('纯代码块没有可念文本', pickTrio('```js\nconst a = 1\n```') === '')

/* 7. 指纹函数本身：空格与标点不影响判定 */
ok('指纹忽略空格标点', trioKey('解压完成，主人！') === trioKey('解压完成 主人'))

/* 8. 投队列前的闸：同一段 90 秒内只放行一次（重挂载/重复收尾不再补一嘴） */
ok('第一次投递放行', firstSight('语音通路已经查清，修完了。') === true)
ok('同一段再投被拦', firstSight('语音通路已经查清 修完了') === false)
ok('不同段落仍放行', firstSight('换一段完全不同的结论文本。') === true)

console.log(`\n全部通过：${pass} 项`)
