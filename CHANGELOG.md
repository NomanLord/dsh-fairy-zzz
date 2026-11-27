# 更新说明 · v1.2.0

- 基线：v1.1.9 · 日期：2026-11-27
- 改动文件：`client.js`、`README.md`、`CHANGELOG.md`、`package.json`
- 触发：主人「给学习任务的已完成列表加一条永久删除选项」

## 这一版做了什么

| # | 内容 | 落地 |
|---|---|---|
| 1 | 「已完成」每行加永久删除 | 行尾「←」（退回待办）右侧多一个「×」（`fz3-td-del`）：点完从清单与 `localStorage`（`dsh.learning-todo.v1`）一并删掉，不进任何回收站 |
| 2 | 删除要点两下 | 第一下只把按钮换成「确认删除」（`is-armed` 红框），第二下才真删；3 秒不动、或把「已完成」收起，确认态自动收回，误点不丢记录 |
| 3 | 深浅色都跟主题 | 深色悬停红字红底，浅色改深红描边；「×」与「确认删除」都进 `:focus-visible` 焦点环，键盘可达 |
| 4 | 文档同步 | README 学习代办段落补上「×」永久删除与两下确认的说明 |

## 验证

- `node --check client.js`：通过
- `node test/tool-sets.test.mjs`：41 项全过（本次未触碰工具链代码）

## 说明

- 只改客户端（`client.js`），刷新页面即生效，不用重启 DSH。
- 清单仍只住在本机浏览器的 `localStorage`，删除不联网、不可恢复 —— 这也是要两下确认的原因。

---

# 更新说明 · v1.1.9

- 基线：v1.1.8 · 日期：2026-11-27
- 改动文件：`client.js`、`test/voice-narration.test.mjs`（新增）、`README.md`、`CHANGELOG.md`、`package.json`
- 触发：主人「语音会读两遍，检查原因并修复」

## 根因（为什么同一句会念两遍）

| # | 现象 | 根因 |
|---|---|---|
| 1 | 每条回复开头那句被念两次 | `GET /fairy-zzz/analysis` 的 `text` 字段其实是**回复正文第一句**（`index.js` 的 `replyLeadText()`），不是分析正文。上一版把它当「分析结论」拼在正文前面，于是首句先念一次、正文开头又念一次 |
| 2 | 去重为什么没拦住 | 宿主给的句子来自流式原文，皮肤拿到的是 DOM `innerText`，空格/换行常有一两个字符的差异；旧代码用 `out.includes(text)` 逐字比较，认不出是同一句 |
| 3 | 偶尔还念出别的会话的内容 | 宿主的分析缓冲区（`analysisBlocks` / `answerBlocks`）是**跨会话共享**的，没有按 session 过滤；缓冲区里残留别的会话的首句时会被当成本轮「分析结论」拼进来 |
| 4 | 「一轮两次出声」的旧通道 | 旧版是「分析一结束念一段 + 回复弹完再念一段」；上一版虽然合并成 `pickTrio`，但删掉的分析轮询仍在（每个页面每 1.2 秒打一次），一旦页面还跑着旧模块就是两次 POST → 队列里两个 ticket，听感就是整段念两遍 |

## 修复

| # | 改法 | 落地 |
|---|---|---|
| 1 | 朗读只用「这一轮正文」 | `pickTrio(answerText)` 不再接收分析文本：开头约 50 字 + 结尾约 50 字，按**句子下标**分开、绝不重叠 |
| 2 | 同一句只念一次 | 句子先按「去掉空白与标点」的指纹去重（`trioKey`），标点/空格不同也认作同一句；整段上限 160 字，超长在标点处收口 |
| 3 | 删掉客户端 `/fairy-zzz/analysis` 轮询 | 连同 `lastAnalysis` 一起删除，页面少一条每 1.2 秒的请求，也不会再把别的会话的句子拼进来；宿主那条路由保留，仅作诊断 |
| 4 | 自动朗读再加一道闸 | `finish()` 投队列前过 `firstSight()`：同一段（指纹相同）90 秒内只投一次，重挂载 / 重复收尾不会再补一嘴。手动点朗读按钮走 `speakText`，不受影响 |
| 5 | 回归测试 | 新增 `test/voice-narration.test.mjs`：从 `client.js` 切出朗读函数段直接跑，锁死首句只念一次、重复句去重、长文首尾不重叠、160 字上限、投递闸只放行一次（19 项） |

## 验证

- `node --check client.js` / `node --check index.js`：通过
- `node test/voice-narration.test.mjs`：19 项全过
- 复现对照（同一段正文 + 带空格差异的宿主首句）：旧版输出里「语音通路已经查清」出现 **2 次**；新版 **1 次**，整段 76 字
- `test/tool-sets.test.mjs`：41 项仍全过（本次未触碰工具链代码）

## 说明

- 本次只改客户端（`client.js`）；宿主 `index.js` 未改，**刷新页面**即可生效，不用重启 DSH。
- 宿主 `/fairy-zzz/analysis` 的 `text` 仍是「正文第一句」——它现在只用于诊断，不再进朗读。

---

# 更新说明 · v1.1.8

- 基线：v1.1.7 · 日期：2026-11-27
- 改动文件：`client.js`、`index.js`、`toolgate.js`（新增）、`tool-sets.js`（新增）、`cordis.patch.yml`、`package.json`、`locale/*.json`、`README.md`、`CHANGELOG.md`
- 触发：主人「对 fairy 模式的工具链优化，对 tools 进行动态删除和添加，进行动态化管理减少 token。集成到主题皮肤插件和设置中自由打开」

## 这一版做了什么

| # | 内容 | 落地 |
|---|---|---|
| 1 | 新增 `toolgate.js`（profile 全局宿主插件） | 监听 `agent/created`，只对 `agentPresets.presetForSession(agent.session) === 'fairy'` 的会话调 `agent.ctx.tools.restrict({ allow })`；关掉的工具不进模型可见集合，schema token 直接消失 |
| 2 | 新增 `tool-sets.js` | 工具分组 / 中文短名 / 「精简」「推荐」预设、`~/.dsh/fairy-tools.json` 配置读写、gate 快照读写、token 粗估；纯 `node:fs`，可脱离宿主直接测 |
| 3 | 新增路由 `/fairy-zzz/tools` | `GET` 返回配置 + 真实工具清单（优先读 gate 快照）+ 节省合计；`POST { enabled?, mode?, allow? }` 写配置并 `emit('fairy-tools/changed')` 让 gate 立刻重算 |
| 4 | 设置页新增「工具链」卡片 | 总开关 + 「精简 / 推荐 / 全部」+ 分组勾选清单 + 全选/全不选；标题下直接显示「当前 N / 全部 M 个工具，约多少 token，每次省下多少（%）」 |
| 5 | 默认「推荐」+ 打开 | 默认就把插件管理、Cordis 检查、worktree、团队任务、工作流、Office 这些不常用的工具摘掉；要恢复旧行为点「全部」或关掉总开关 |
| 6 | 新增工具自动落位 | 名字没进 `TOOL_META` 的新工具显示原名、归到「其他」，不会被这张表过期误藏 |

## 三个必须写清的取舍

1. **限制写在 agent scope，不写进 preset 插件**：`ctx.tools.restrict()` 只接受「继承层」的工具名；preset 自己挂的工具注册在 preset 层，从 preset ctx 调会被判 unknown global tool，反而藏不掉。profile 全局插件拿 `agent.ctx` 调，才能同时盖住全局层与 preset 层。
2. **绝不打断会话创建**：`agent/created` 的监听器抛错会让会话创建失败；`applyTo()` 全程把异常收在内部，限制失败就按全量工具继续，并把错误写进快照给设置页看。
3. **没会话时保留清单**：没有在线 Fairy 会话时 gate 不写空目录（否则设置页会突然没东西可配），保留上一份快照里的工具清单，只把 `agents` 归零。

## 验证

- `node --check`：`client.js`、`index.js`、`toolgate.js`、`tool-sets.js` 全通过
- `test/tool-sets.test.mjs` 41 项全过（临时目录隔离运行，不碰主人真实配置）：默认配置、`lean/recommended/all/custom` 解析、allow 去重与长度上限、损坏 JSON 回退、原子写、快照去重、token 估算、合计节省、gate 的过滤/重试/释放路径
- 真实宿主里验证：`GET /fairy-zzz/tools` 返回 Fairy 会话的 57 个工具（约 1.45 万 token）；默认「推荐」下发 34 个（约 8.5k token，省 41%），gate 快照的 `visible` 与实际下发集合一致；`mode=lean` 时可见集合缩到 11 个，改回 `recommended` 立即恢复
- 原有设置项、语音链路、眼徽、学习代办均未改动

## 说明

- 新增全局行 `fairy-toolgate` **要重启一次 DSH 才会挂载**（bundle patch 新增了 insert 行）；之后改开关不用重启，刷新设置页即可。
- 客户端半侧（`client.js`）刷新页面即可看到新卡片。
- 默认按「推荐」裁剪；如果主人更想要「全部」，面板里一点即回，配置落在 `~/.dsh/fairy-tools.json`。

---

# 更新说明 · v1.1.7

- 基线：v1.1.6 · 日期：2026-11-27
- 改动文件：`client.js`、`index.js`、`memory-switch.js`（新增）、`package.json`、`CHANGELOG.md`
- 触发：主人「整合到 fairy 中做成设置 fairy 里的开关」

## 这一版做了什么

| # | 内容 | 落地 |
|---|---|---|
| 1 | 设置页新增「记忆系统」分组 | `设置 → Fairy` 多出两张卡片（dsh-mind 蓝、神经持久化记忆紫），开关直接写回两个宿主插件的真实配置，不用再手改 JSON / YAML |
| 2 | dsh-mind 五项开关 | 总开关 + 自我觉知 / 经验库 / 压缩前日记 / 月度生命索引；写 `~/.dsh/mind.json`，插件自己每 15 秒轮询 mtime，**最迟 15 秒热生效**；总开关关掉后插件完全停摆，重新打开要重启 App（它在 apply 阶段就 return 了） |
| 3 | 神经记忆三项开关 | 自动观察 / 自动联想注入 / 自动遗忘；写 profile 的 `cordis.patch.yml`，宿主只在启动时读，**改完必须重启 App** |
| 4 | 新增 host 路由 | `GET /fairy-zzz/memory` 读现状，`POST /fairy-zzz/memory` 写入；写完回读最新状态返回给皮肤，不会出现"点了但还显示旧值" |
| 5 | 新增 `memory-switch.js` | 读写逻辑从 `index.js` 抽出来，只依赖 `node:fs`、不依赖 Cordis ctx —— 可以用 `node -e` 直接测，不必启动宿主 |
| 6 | 块定位不用正则 | `cordis.patch.yml` 里用行扫描按缩进找 `- id: dsh-neural-memory` 段边界；正则整块匹配很容易把后面的注释一起吃进去 |

## 三个必须写清的取舍

1. **neural 覆盖必须写全量键**：Cordis 的 config 覆盖是整份替换，少写一个键等于把它重置回缺省（`dim` 从 128 掉回默认之类），且不会有任何提示。所以那一段每次都整段重写 21 个键，只改其中三个。
2. **不猜路径**：profile 目录按 `package.json` 里含 `dsh-fairy-zzz` 来认，找不到就报错。写错文件比写不进去更难查。
3. **两种生效语义分开写**：mind 是「15 秒热生效」，neural 是「重启生效」，UI 上分开标注，不混成一句「已保存」。

## 验证

- `node --check`：`client.js`、`index.js`、`memory-switch.js` 全通过
- 行为测试 24 项全过（临时 home 隔离运行，不碰主人真实配置）：未知键保留、`enabled`/`inject` 双写、块插在 roost 托管块之前、全量键齐全、重复写同值不落盘、块被整体替换不重复、改动前备份生成
- 原有 11 个设置项、语音链路、眼徽、学习代办逻辑均未改动

## 说明

- 宿主半侧（`index.js` / `memory-switch.js`）改动**要重启 App 才加载**；客户端半侧刷新页面即可。
- 两个插件仍作为独立 bundle 装着 —— 开关是控制面，不是替代品。要彻底从插件列表里消失得卸载插件，功能会一起消失。

---

# 更新说明 · v1.1.6

- 基线：v1.1.5 · 日期：2026-11-26
- 改动文件：`screenshots/00-greet-start.png`、`package.json`、`CHANGELOG.md`
- 触发：主人「把发布版本里我的 swt 相关隐私信息去掉」

## 这一版做了什么

| # | 内容 | 落地 |
|---|---|---|
| 1 | 开屏截图脱敏 | `screenshots/00-greet-start.png` 重做：左侧栏（工作区名、会话标题、左下账号名）与顶栏标签用该区域背景平均色抹平，肉眼不可读；内容列（眼徽、`START H.D.D.SYSTEM`、问候语、输入卡、`NOW LOADING`、`SKIP`）保持原样 |
| 2 | 旧版附件同步替换 | v1.1.5 的 Release 附件已用脱敏包覆盖（版本号仍为 1.1.5，差异只有这张图），旧下载不再带账号信息 |

## 说明

- 只动截图，`client.js` / `index.js` 与 v1.1.5 逐字节一致。
- 中央内容列里隐约可见的背景残影属于公开仓库信息（仓库地址、提交哈希），未做处理；如果主人要求连这些一起抹掉，说一声即可再出一版。

---

# 更新说明 · v1.1.5

- 基线：v1.1.4 · 日期：2026-11-26
- 改动文件：`client.js`、`README.md`、`package.json`、`CHANGELOG.md`
- 触发：主人「将今天的更新发布到 release」。今天的正文描边 / 字色实验（`__FAIRY_ZZZ_SUB_BODY__`）已按主人要求全部撤销，本版只收学习代办改造与仓库回补。

## 这一版做了什么

| # | 内容 | 落地 |
|---|---|---|
| 1 | 学习代办：勾选即完成 | 原来「先勾选、再点底栏『归档已完成』」两步合成一步 —— 勾一下任务直接从待办移进「已完成」并记归档日期；底栏那个归档按钮与 `doneCount` 一并撤掉 |
| 2 | 已完成可退回 | 每行「已完成」右侧新增「←」按钮（`fz3-td-restore`）：点一下任务回到待办顶部，误勾有回头路 |
| 3 | 旧存档自动迁移 | 读取 `dsh.learning-todo.v1` 时，待办里残留的 `done=true` 行直接并进「已完成」（补 `archivedAt`），不会顶着删除线卡在待办里又送不走 |
| 4 | 「已完成」默认收起 | 卡片与任务板打开时只列待办，展开归档要点「已完成」那一行的箭头；`设置 → Fairy` 新增「已完成默认展开」开关，偏好键 `fairy.zzz.todo-done-open`（缺省 `false`，只定初始态） |
| 5 | 文档同步 | README 学习代办段落改写为「勾一下即完成并直接落进已完成，行尾『←』可捡回待办」，并补上开关说明 |
| 6 | 回补 v1.1.4 漏入库的修复 | v1.1.4 那次浅色 ZZZ 视频修复只进了发布包、没进仓库：本版把那段 `data-phase` 选择器（会话根 / `conversation.content` / `conversation-scroll` 让开）补回 `client.js`，否则 1.1.5 会整块回退 1.1.4 的修复 |

## 撤销记录

今天上午的正文「游戏内字幕」体实验（白字 + 八向黑边，后改 `#ECECEC`）已按主人「撤销今天所有对字体进行的改动」全部删除：`client.js` 中 `fz3-sub` 残留 0 处、`ECECEC` 0 处、新增 `text-shadow` 0 处；正文回到 `--ct-body`（深色 `#B0B0B0` / 浅色 `#999999`），观感与 1.1.4 一致。

## 验证

- `client.js` 通过 `node --check`
- 与已发布的 v1.1.4 包逐行对比：本版独有 111 行（学习代办改造）、包内独有 34 行（被替换掉的旧「归档已完成」代码），其余逐行一致
- 包内 49 个文件与 v1.1.4 一致，`package.json` 版本 `1.1.5`

---

# 更新说明 · v1.1.4

- 基线：v1.1.3 · 日期：2026-11-25
- 触发：主人「浅色模式下的旋转 zzz 视频背景不加载了」
- 内容：浅色下宿主会话根整列不透明底衬把 `z-index:-1` 的视频整块盖住（元素在播、像素为零）—— 新增一组浅色规则，用宿主的语义属性 `data-phase` + `_root` 类名限定（不写死构建哈希），让会话根 / `conversation.content` / `conversation-scroll` 让开；深色 1.0.17 的旧规则原样未动。完整说明见 GitHub Release [v1.1.4](https://github.com/NomanLord/dsh-fairy-zzz/releases/tag/v1.1.4)。

---

# 更新说明 · v1.1.3

- 基线：v1.1.2 · 日期：2026-11-24
- 改动文件：`screenshots/00-greet-start.png`（新增）、`screenshots.json`、`README.md`、`package.json`、`CHANGELOG.md`
- 触发：主人「插件市场和 github 的展示图里把这张图放在第一个」

## 这一版做了什么

| # | 内容 | 落地 |
|---|---|---|
| 1 | 开屏问候实拍图进仓库 | 新增 `screenshots/00-greet-start.png`：START H.D.D.SYSTEM 那一屏 |
| 2 | 展示顺序置顶 | `screenshots.json` 第一项改为它 —— dsh-market 详情页按这个顺序展示，1–8 张，现在正好 8 张 |
| 3 | GitHub 首页预览 | README 的「界面预览」与英文 Screenshots 段都把这张图放到最前 |

---

# 更新说明 · v1.1.2

- 基线：v1.1.0 · 日期：2026-11-23
- 改动文件：`client.js`、`index.js`、`package.json`、`CHANGELOG.md`

## 这一版改了什么

| # | 内容 | 落地 |
|---|---|---|
| 1 | 分析结束的朗读改念回复正文首句 | 宿主新增 `answerBlocks` 收集回复正文，`replyLeadText()` 取**正文第一句**；`/fairy-zzz/analysis` 的 `text` 改为「本轮正文首句 → 上轮正文首句」，**不再**退化成思考正文（思考挪到独立的 `analysis` 诊断字段） |
| 2 | 英文照念、地址只显示不朗读、代码块不读 | `stripUnspeakable` 去掉「整句无汉字就丢」和逐词删英文两步，只剔地址（网址 / 盘符 / UNC / 相对路径 / 带扩展名文件名）与代码块；`queueSay` 额外提交 `display`，宿主 `sayDisplayJobs` 按当前句反查，气泡优先显示 `state.display` |
| 3 | 首句判定与持久化 | `done` 改为首句出现 `。！？!?；;` 才算说完（attempt 收尾兜底）；`lastReplyLead` 落盘 `last-reply-lead.txt`，重启后仍能拿到上一轮首句；`ANALYSIS_CAP` 6000 → 24000 |
| 4 | 开屏问候大标题换字 | `.fz3-copy-title`（含 `data-text` 倒影/光泽层）由 `HOLLOW DEEP DIVE SYSTEM` 改为 `START H.D.D.SYSTEM`；中文副标题「空 洞 深 潜 系 统」保持不动。新建对话页 hero 的英文标题仍为 `HOLLOW DEEP DIVE SYSTEM`（那是另一个表面） |
| 5 | 设置 → Fairy 分页空白 | `useTodoShow()` 返回布尔值却按数组解构，`FairySettingsInner` 抛错被设置外壳吞掉；改为 `const todoShowOn = useTodoShow()`（1 行）。引入版本 1.0.22，影响 1.0.22–1.1.1 |

## 验证

- `client.js` / `index.js` 与安装副本 SHA256 一致，`node --check` 全绿
- 离线用例：正文首句截取、英文保留、地址剔除但显示、代码块跳过、围栏块在首行时仍能取到散文句
- 在线用例：`POST /fairy-zzz/say {text, display}` → `GET /fairy-zzz/say` 的 `state.display` 含地址，`state.text` 不含

---

# 更新说明 · v1.1.0

- 基线：v1.0.23 · 日期：2026-11-23
- 定位：把 1.0.18 → 1.0.23 这一串改动收成一个里程碑版本；代码与 1.0.23 完全一致，只改版本号

## 里程碑里有什么

| 区块 | 内容 |
|---|---|
| 背景与性能 | 背景视频去掉实时滤镜、按主题懒建（任意时刻只解码一条），卡顿自愈 |
| 眼徽 | 64px dock、淡蓝外扩散阴影、角落印章层级取 1（正文聊天区的上一层） |
| 学习代办 | 「绳匠满级之路」并入皮肤：侧栏脚部卡片 + 设置页「学习代办」显隐开关，`dsh.learning-todo.v1` 数据原样沿用 |
| 语音 | 分析结束念分析结果（宿主 `GET /fairy-zzz/analysis`）、回复弹完念约 100 字总结；朗读前滤掉网址 / 路径 / 文件名 / 英文（只留 Fairy / HDD） |
| 插件介绍 | 中文置顶：`locale/zh.json` + `locale/en.json`，插件管理与设置页按界面语言读取 |

---
# 更新说明 · v1.0.23

- 基线：v1.0.22 · 日期：2026-11-23
- 改动文件：`locale/zh.json`（新增）、`locale/en.json`（新增）、`package.json`、`CHANGELOG.md`
- 触发：主人「插件主题介绍把中文置顶」

## 这一版做了什么

| # | 内容 | 落地 |
|---|---|---|
| 1 | 插件卡片的中文介绍置顶 | 新增 `locale/zh.json`：`meta.title` = Fairy Ⅲ · 绝区零 H.D.D 皮肤，`meta.description` 为中文功能说明；插件管理与设置页按界面语言读 `meta.title` / `meta.description`，中文界面下不再落到英文兜底 |
| 2 | 英文界面照旧 | `locale/en.json` 提供英文 title / description；`package.json` 的英文描述只当 npm 元数据 |
| 3 | 打包规则 | `exports` 加 `"./locale/*.json"`，`files` 加 `locale`；`pnpm pack` 打出的 tgz 里带两个语言文件 |

- 验证：用 `createRequire` 从 profile 解析 `dsh-fairy-zzz/locale/zh.json` 成功，title / description 均为中文；tgz 内含 `locale/`。

---
# 更新说明 · v1.0.22

- 基线：v1.0.21 · 日期：2026-11-23
- 改动文件：`client.js`、`package.json`、`CHANGELOG.md`、`README.md`
- 触发：主人「地址不念、英文不念」

## 这一版做了什么

| # | 内容 | 落地 |
|---|---|---|
| 1 | 地址不念 | 朗读前统一过滤：URL、盘符路径（`C:\…`）、UNC、unix 路径、带扩展名的文件名整段删掉 |
| 2 | 英文不念 | 整句没有中文的直接丢；句内英文词删掉，只保留 `Fairy` / `HDD`（`H.D.D` 的各种写法都算），数字与中文标点保留 |
| 3 | 一刀切在哪 | 过滤放在 `speakableText()`：自动朗读（分析段 + 总结段）和消息旁的朗读按钮共用同一把筛子 |
| 4 | 副作用 | 英文思考会被整段滤掉——分析那格若全是英文就没有声音，只剩中文总结；这正是主人要的 |

- 验证：用 8 组样本（含路径、URL、文件名、纯英文句、中英混排、纯中文）跑过滤，输出符合预期；`node --check` 通过。

---
# 更新说明 · v1.0.21

- 基线：v1.0.20 · 日期：2026-11-23
- 改动文件：`client.js`、`index.js`、`package.json`、`CHANGELOG.md`、`README.md`
- 触发：主人两条口径 ——「1. 在分析完成后，立刻朗读分析结果；2. 在回复弹完后，播放总结 100 字左右」

## 这一版做了什么

| # | 内容 | 落地 |
|---|---|---|
| 1 | 分析（思考）一结束就念 | 宿主新听 `agent/assistant-stream`：`reasoning-delta` 累积分析正文，第一条 `text-delta` 视为分析结束（`end` 帧兜底），新路由 `GET /fairy-zzz/analysis` 返回 `{ turn, text, done, doneAt }`；皮肤每 1.2s 轮询，一轮只念一次（按 `turn:doneAt` 去重），整段超长时从最后一句往前取 400 字 |
| 2 | 回复弹完念约 100 字总结 | 自动朗读收尾改成 `pickSummary()`：仍只用回复原文里的句子（结论句 + 结尾段），目标 100 字、超过 130 字在句末收口，不足 40 字才硬切 |
| 3 | 为什么要宿主半 | 浏览器里思考面板默认折叠，收起后正文根本不进 DOM —— 页面读不到分析，只能从宿主帧取，所以这次连 `index.js` 一起改 |
| 4 | 开关不变 | 两段都受「自动朗读回复」管辖；关掉则分析、总结都不出声，消息旁的朗读按钮仍念全文 |

- 注意：`index.js` 属于宿主半，**必须重启 DSH 才会挂上 `/fairy-zzz/analysis`**；`client.js` 刷新页面即可生效。
- 验证：两份文件 `node --check` 通过；界面上的实际节奏（分析念多久、总结是否够 100 字）要跑一轮对话确认。

---

# 更新说明 · v1.0.20

- 基线：v1.0.19 · 日期：2026-11-23
- 改动文件：`client.js`、`package.json`、`CHANGELOG.md`、`README.md`
- 触发：主人要求「把学习代办插件并入皮肤，增加 fairy 的设置打开代办的按钮」

## 这一版做了什么

| # | 内容 | 落地 |
|---|---|---|
| 1 | 本地插件「绳匠满级之路」并入皮肤 | 清单 store、侧栏脚部卡片、归档逻辑整段写进 `client.js`，注册座位 `sidebar.footer.action`（order 10）。原插件是 profile 里的 `@dsh-local/view-a46a312b-…`，已从 bundles 里移除；不再需要单独安装 |
| 2 | 卡片外观与行为照旧 | 标题仍是「绳匠满级之路」；表头钉在侧栏最下缘，抽屉从表头**上方**展开；展开时把视口边缘切成半行的那一行整行藏掉；侧栏右缘的拖拽把手线保持隐藏（只去线，拖拽保留） |
| 3 | 设置页新增「学习代办」行（显隐开关） | 和「显示眼徽」同款拨杆：**打开 = 侧栏脚部显示「绳匠满级之路」卡片，关闭 = 整块不显示**；偏好记在 `fairy.zzz.todo-show`，刷新后保持 |
| 4 | 弹窗方案按主人反馈撤掉 | 早前那版「打开代办」会弹出居中任务板；主人要的是「开关侧栏那张卡」，所以弹窗组件、样式与 `shell.overlay` 挂载整段删除，只留开关 |
| 5 | 数据沿用原键名 | `localStorage` 的 `dsh.learning-todo.v1`：以前记过的清单原样接过来，不迁移、不丢 |
| 6 | 深浅色都跟随皮肤 | 卡片边框用 `--fz3-edge*`，开关与设置行沿用 `fz3-set-*` 的深浅色覆盖 |

- 排查记录：上一版页面里卡片右侧那道「多出来的弧」，是皮肤卡片和原插件**同时注册同一个座位**、被 flex 挤到容器外只露出一条描边造成的；插件卸载后只有一张卡，弧消失。
- 验证：两份 `client.js` 都过 `node --check`；界面效果要在刷新后的页面上确认（侧栏卡片随开关出现 / 消失）。

---

# 更新说明 · v1.0.19

- 基线：v1.0.17 · 日期：2026-11-23
- 改动文件：`client.js`、`assets/zzz-logo-bg.mp4`、`assets/zzz-logo-bg-light.mp4`（新增）、`package.json`、`CHANGELOG.md`
- 触发：主人反馈「后面的背景偶尔会卡住，界面还能点」——旋转背景（ZZZ Logo 视频）偶发停顿

## 这一版修了什么

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 1 | 整窗背景视频每帧套一次全屏滤镜，画面偶发掉帧 | `filter:brightness(.62) saturate(.95)` 挂在铺满整窗的 `<video>` 上，等于每帧多一次全屏滤镜 pass，还把视频踢出合成器直出路径 | 亮度/饱和是固定值 → 用 ffmpeg 烘进素材（`eq=saturation=0.95` + `lutrgb ×0.62`），运行时 CSS 只剩 `opacity:.38`，观感不变 |
| 2 | 深色下浅色那条背景视频在后台空转 | 浅色那条（`video.fz3-logo-video`，插在中间栏）被 `display:none` 藏起来，**CSS 藏起来不等于停解码器**；深色那条同理靠 `opacity:0` 藏 | **按主题懒建**：深色下浅色那条连元素都不创建，浅色下深色那条也不创建；切主题时进来的建、离开的 `pause → 摘 src → load() → remove()`，解码器与缓冲一起释放。全局任何时刻只有一条背景视频在解码 |
| 3 | 解码头偶发停滞后只能等下一次 loop 自己恢复 | 没人看 `currentTime` | `videobg-health` 每秒采样：一秒不动 → `play()`；连拉两次不动 → `load()` 重挂。诊断口 `window.__fz3Bg → { ticks, resets, reloads, theme, last }` |
| 4 | 浅色那条在运行时套 `invert(1)+multiply` | 同 #1，多一次全屏滤镜 | 新增 `assets/zzz-logo-bg-light.mp4`（`negate` 烘进素材），运行时只剩 `opacity:.3` + `mix-blend-mode:multiply` |
| 5 | 素材带音轨、moov 在 mdat 之后、10s 一循环 | 背景静音却还带一条音轨；未 faststart | 去音轨、`+faststart`、30s 长循环（10s 原片拼 3 遍，循环接缝实测 PSNR 49.3dB ≈ 一帧步进，无跳变）。**保持 1080p60**（主人要求 60fps，不再降帧率） |

实测依据（`zzz-diag/mp4frames.mjs` 直接解 stts/stss，不依赖 ffmpeg）：原片 600 帧 / 60fps / 每 18 帧一个关键帧 / 帧间隔 16.7ms 无异常 → 卡顿不在素材帧表里，源头在上面的渲染与解码侧。重压后两版均为 1800 帧 / 30s / 60fps / 帧间隔无异常；体积 2.9MB → 1.17MB（深）/ 3.83MB（浅）。

---

# 更新说明 · v1.0.17

- 基线：v1.0.11 · 日期：2026-11-23
- 改动文件：`client.js`、`index.js`、`tools/fairy-say.ps1`、`package.json`、`README.md`、`CHANGELOG.md`
- 覆盖范围：v1.0.12–v1.0.16 的本地迭代 + 本轮语音/朗读修复，一并发布

## 这一版修了什么

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 1 | 念「H.D.D」断成 H / D / D，段间约 0.4 秒静音，整句发涩 | 合成端把缩写里的点当断句 | 队列脚本、宿主清洗、皮肤清洗三处统一 `H.D.D → HDD`；紧跟单词时补空格（`H.D.D.System → HDD System`），避免拼成 `HDDSystem`。实测 5.36s → **4.80s**（本来就写 HDD 的对照 4.98s） |
| 2 | 改 `voice-speed.txt` 无效：写 0.93，自动朗读仍是 0.72 | 宿主 spawn `fairy-say.ps1` 时**没传 `-Speed`**，脚本一直吃默认 0.72 | 宿主 spawn 补 `-Speed readSpeed()`；脚本在未显式传参时读 `voice-speed.txt`——**不重启 DSH 也立刻生效** |
| 3 | 结尾结论「读得很慢」、一顿一顿 | 结论按 22 字一段切，每两句一次合成间隙 | 结论/摘要改 80 字一段；速度默认取 `voice-speed.txt`（本次 0.93） |
| 4 | 自动朗读只念 50 字摘要；有时回复还没写完就开始念 | 消息挂载即朗读 + 50 字摘要口径 | 改为「运行行消失 + 正文 900ms 不再变化」才算写完，**写完立刻**念；内容只挑**结论句 + 结尾总结段**（关键词：结论 / 总结 / 总之 / 所以 / 因此） |
| 5 | 长回复被截断 | 皮肤清洗写死 `.slice(0,420)`；宿主 `MAX_CHARS=500` | 放宽到 4000 字；长文按句切段（≤380 字/段）入队 |
| 6 | 眼徽复位走成两段折线 | 皮肤 `DOCK_Y_RATIO=0.5` 与 `dsh-fairy-eye-tweak` 的 `52vh` 抢同一个坐标 | 只留皮肤一处 `0.52`，过渡回到一条直线 |
| 7 | 角落印章压不到文字上层；朗读气泡在队列播放时不弹 | 层叠高度不足；`/say` 状态轮询在合成阶段放弃过早 | 印章 `--fz3-corner-z` 提到 900，并加 `GET /fairy-zzz/stack` 诊断；状态轮询只要 `queued>0` 就不收手 |

## 念什么（1.0.17 口径）

- `AUTO_READ = true`、`AUTO_READ_FULL = false`：每条回复只念**结论句 + 结尾总结段**，总长兜底 600 字。
- 想整篇念：把 `client.js` 的 `AUTO_READ_FULL` 改 `true`（会按 380 字切段串行播放）。
- 语速：`voice-speed.txt` 写数字（0.6–1.4，默认 0.72），每次合成现读。

## 验证方式

```text
GET  /fairy-zzz/say   -> { ok, queued, script, lastError, state }
POST /fairy-zzz/say   -> { ok, queued, pid, chars, chunk }
GET  /fairy-zzz/stack -> 印章层叠诊断（客户端 place() 后回报）
```

- 语音：手动 `/say` 一句含 `H.D.D` 的文本，音频时长应接近同句写 `HDD` 的版本（≤0.2s 差）。
- 朗读：在回复结束后约 1 秒内应听到「结论句 + 结尾」，且没有整篇念。

## 需要重启

`/fairy-zzz/say` 的 `-Speed`、`MAX_CHARS` 属宿主侧，**重启 DSH 生效**；`tools/fairy-say.ps1` 与 `client.js` 改完刷新即用。

---

# 更新说明 · v1.0.11

- 基线：v1.0.10 · 日期：2026-11-23
- 改动文件：`index.js`、`tools/fairy-say.ps1`、`package.json`、`CHANGELOG.md`

## 这一版修了什么

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 1 | 1.0.10 的 `POST /fairy-zzz/say` 返回 `{ok:true,queued:true}`，但**一声不出**，队列深度永远是 0 | 宿主用 `detached:true` + `stdio:'ignore'` + `windowsHide` 拉子进程：Windows 上 `DETACHED_PROCESS` 与 `CREATE_NO_WINDOW` 同时设置时 CreateProcess 直接失败；而代码没接 `'error'` 事件，于是 HTTP 照样回 ok，用户端一片安静 | 改成与 SAPI 兜底一致的可用形状：**不 detached** + `-WindowStyle Hidden` + `stdio:'ignore'`；接上 `'error'` 写 `cache/say.log`；`child.pid` 为空时直接回 500 |
| 2 | 排查时看不出子进程死在哪 | `/say` 只回队列深度 | `GET /fairy-zzz/say` 增加 `lastError`（`cache/say.log` 尾 3 行）；POST 回 `pid` |
| 3 | `requests/say-*.txt` 只增不减 | 宿主落盘、脚本读完不删 | 脚本读完 `say-*` 请求文件即删 |
| 4 | 队列整体不可用时仍然全程静音 | 没有降级路径 | 皮肤侧 `queueSay` 在路由 404/500 或请求异常时回退浏览器直出（`fallback:false` 可关）。队列正常时这条永不执行，不会重造回声 |

## 验证方式

```text
GET  /fairy-zzz/say          -> { ok, queued, script, lastError }
POST /fairy-zzz/say {text}   -> { ok, queued, pid, chars, chunk }
```

投递后 `queued` 应在 1~2 秒内变成 ≥1，然后随播报结束回到 0。

---

# 更新说明 · v1.0.10

- 基线：v1.0.9 · 日期：2026-11-23
- 改动文件：`client.js`、`index.js`、`README.md`、`package.json`

## 这一版改了什么

| # | 现象 | 修法 |
|---|---|---|
| 1 | 1.0.6 里「每条回复念一段」的内容彻底没声音：皮肤那侧自动朗读被关（`AUTO_READ = false`），替代的队列脚本又没有入口 | 新增 `POST /fairy-zzz/say { text, chunk }`：宿主把文本写成 UTF-8 文件并拉起 `tools/fairy-say.ps1`，**回复内容从此进队列**，与手动播报排同一条队 |
| 2 | 两条语音通路会叠音（03:30 的回声事故） | 皮肤不再用浏览器 `new Audio` 自动播；`autoRead` 改成把文本 POST 给 `/fairy-zzz/say`，全系统只有一个嗓子 |
| 3 | 排障时看不出「有没有人在排队」 | 新增 `GET /fairy-zzz/say` → `{ queued, script }`：队列深度 + 脚本是否在包里 |

## 念什么

- `AUTO_READ = true`，`AUTO_READ_FULL = false` → 每条回复念 **50 字摘要**、22 字切段（**1.0.6 的口径**）。
- 想让她念整条回复：把 `client.js` 里的 `AUTO_READ_FULL` 改成 `true`，一行。
- 每条消息右侧的「朗读」按钮仍是浏览器直出（手动、即时、可打断），不影响队列。

## 需要重启

`/fairy-zzz/say` 是宿主侧路由，**重启 DSH 才生效**；`tools/fairy-say.ps1` 本身改完即用。

---

# 更新说明 · v1.0.9

- 基线：v1.0.8 · 日期：2026-11-23
- 改动文件：`tools/fairy-say.ps1`（新增）、`index.js`、`package.json`、`README.md`

## 这一版修了什么

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 1 | **Fairy 完全不自动播报了** | 1.0.7 为治「同一句话念两遍」把皮肤的自动朗读关掉（`AUTO_READ = false`），注释说正式播报改走 `tools\fairy-say.ps1` 的队列——但这个脚本从没进过包，仓库全历史也搜不到它 | 新增 `tools/fairy-say.ps1`：调本地引擎 `/tts` 合成 + `SoundPlayer` 播放，**跨进程 FIFO 队列**（`%USERPROFILE%\.dsh\storages\fairy-voice\queue.txt`，按 pid 清理死票据），`-NoWait` 交给后台进程播完，不阻塞会话 |
| 2 | 某些句子永远播静音 | SAPI 兜底在本机产出 46 字节空壳（只有 RIFF 头），旧的缓存判定是 `sizeOf > 0` 就算命中，于是空壳被永久拿来播 | 缓存门槛提到 `MIN_WAV_BYTES = 2048`；低于门槛的文件删掉重合成；SAPI 产不出音频时也删文件并报错，不再留下毒缓存 |

## 队列怎么用

```powershell
powershell -ExecutionPolicy Bypass -File tools\fairy-say.ps1 -Text "说这句话"
powershell -ExecutionPolicy Bypass -File tools\fairy-say.ps1 -TextFile reply.md        # 整篇，UTF-8
powershell -ExecutionPolicy Bypass -File tools\fairy-say.ps1 -TextFile reply.md -NoWait  # 后台播，立即返回
```

- 串行：多个调用按票据顺序排队，不会叠音（实测两个并发调用，第二个在第一个播完后才开始合成）
- 分句：默认 80 字一段，在句末/逗号处切
- 退出码：`0` 已播/已交给后台，`2` 引擎不可达，`3` 没内容，`4` 排队超时
- 临时 wav 播完即删，不依赖插件目录，`pnpm install` 清了 `cache/` 也不影响

## 需要补一句的地方

皮肤的自动朗读仍是关的（`AUTO_READ = false`），避免和队列双声。想让每条回复自动开口，
把调用 `fairy-say.ps1 -NoWait` 写进 agent 的人设或收尾流程；手动「朗读」按钮不受影响。

---

# 更新说明 · v1.0.8

- 基线：v1.0.7 · 日期：2026-11-23
- 改动文件：`client.js`、`package.json`

## 这一版改了什么

| # | 现象 | 修法 |
|---|---|---|
| 1 | 右下角 NOW LOADING 印章**播放时**是 92% 不透明，黑字压在浅底上太实，动画一跑就抢视线 | 播放态降到 **72%**；定格态仍是 55%，两档都改成 CSS 变量 `--fz3-corner-opacity` / `--fz3-corner-opacity-paused`，改一行即生效 |

想更淡：把 `--fz3-corner-opacity` 调到 `.6` 左右；再低就开始糊了。

---

# 更新说明 · v1.0.7

- 基线：v1.0.6（仓库 `main`，commit `ad603ee`）
- 日期：2026-11-23
- 改动文件：`client.js`（+2279 / −2260 行）、`fonts/README.md`（+21 行）、`package.json`（1.0.6 → 1.0.7）
- 性质：纯浏览器端皮肤改动，无新增依赖、无构建产物

---

## 一、这一版修了什么

| # | 现象 | 根因 | 修法 |
|---|---|---|---|
| 1 | 浅色模式开屏问候的背景**糊不起来**，仍是干净渐变 | 磨砂靠 `backdrop-filter` 糊「背后的东西」，浅色背后是纯色渐变，糊白还是白；`.fz3-veil` 又只有 CSS、没有 DOM 节点 | `.fz3-hero` 自绘浅色渐变色块 + `blur(30px)`，`inset:-8%` 防边缘白边 |
| 2 | 浅色背景仍是宿主那只「翻越鲸鱼」，想要深色那只 ZZZ | 浅色分支没接管背景图 | 隐藏 `canvas[data-home-whale]`；把 `assets/zzz-logo-bg.mp4` 插进中间栏，`invert(1) + multiply + opacity .3`；中间栏补 `position:relative; isolation:isolate` 稳住负 z-index |
| 3 | 浅色正文与气泡文字偏深（#666） | 灰阶表里正文档位写成了中灰 | `--ct-body`、`--dsw-alias-label-primary/secondary`、气泡文字 → **#999999**；深色正文 `#9a9a9a` → **#B0B0B0** |
| 4 | 设置页那张「主题校验」卡片多余 | 旧 UI 残留 | 删掉 `.fz3-theme-status` 整套 CSS、报告订阅与重校验逻辑（自检函数保留，供内部用） |
| 5 | 皮肤偷写 `cache/greet.log` 的 `FZBADGE` 行 | 11-22 排障时的临时诊断代码 | 整段删除，`place()` 恢复无参调用 |
| 6 | 中文界面没走绝区零字体，字形仍是雅黑 | 系统里没装 `SDK_*` 四款字体，字体栈整条回退 | 字体不进包（版权），改为在 `fonts/README.md` 写清族名、游戏目录来源与 `install-zzz-fonts.ps1` 的安装/卸载方式 |

## 二、新增

- **浅色专用 ZZZ 背景视频**：`/fairy-zzz/assets/zzz-logo-bg.mp4` 插进中间栏（文字区域）内，不再是整窗固定层，滚动手感不变；宿主鲸鱼 `canvas[data-home-whale]` 在浅色下隐藏。
- **角落印章层叠变量** `--fz3-corner-z`（默认 `30`）：右下角 NOW LOADING 邦布印章压得住正文、任务条与输入卡片，又压不住宿主菜单与弹层。想调只改这一行，不必重打包。
- **`fonts/README.md` 补「本机来源」段**：四款字体的族名对照（`SDK_SC_Web / SDK_TW_Web / SDK_JP_Web / SDK_US_Web`）、游戏目录路径、校验与卸载命令。

## 三、升级方式

**A. 覆盖（最省事）**：换掉 `node_modules/dsh-fairy-zzz/client.js` → 刷新页面即生效，不用重启 DSH。

**B. 装包**：`plugins/dsh-fairy-zzz-1.0.7.tgz` 走 profile 的 `dsh.profile.bundles`，重装后重启。

**C. 本地 tgz（自持版本）**：把附件 `dsh-fairy-zzz-1.0.7.tgz` 放到 `%USERPROFILE%\.dsh\plugins\`，
profile 依赖写 `file:` 指向它，再 `pnpm install --no-frozen-lockfile` —— lockfile 会记住 tgz 的
integrity，以后重装安全。**不要**再手改 `node_modules` 里的 `client.js`：`pnpm install` 会按 tgz
整份还原，手改会蒸发且 lockfile 停在旧版本。眼徽补丁 `dsh-fairy-eye-tweak-1.0.1.tgz` 同理，
两者都挂在本仓库的 Release 上。

**字体（可选，单独一步）**：

```powershell
powershell -ExecutionPolicy Bypass -File .\install-zzz-fonts.ps1 `
  -Source "D:\ZenlessZoneZero Game\ZenlessZoneZero_Data\StreamingAssets\MiHoYoSDKRes\HttpServerResources\font"
# 卸载：加 -Uninstall
```

装完刷新页面，`F12 → getComputedStyle(document.body).fontFamily` 里应能看到 `SDK_SC_Web` 排在最前。

## 四、已知限制

- **字体不随仓库分发**：`SDK_*` 四款字体的权利归发行方，仓库只提供安装脚本与说明，请仅在本机自用。
- `zh-cn.ttf` 覆盖 6813 个汉字（≈ GB2312 全集），生僻字仍会回落到 `Microsoft YaHei UI`，属预期回退，不是缺字。
- 层叠变量默认 `30` 是「高于正文/任务条/输入卡片、低于菜单弹层」的中间值；宿主若哪天调整了菜单层级，改 `--fz3-corner-z` 即可，不必动 JS。
- 浅色与深色两套配色都只在 `html[data-fz3-theme]` 上生效，宿主结构类名（`_centerCol` / `_sidebarCol` / `_newSession` 等）一旦改名，浅色接管会失效——这属于已知的上游耦合。

## 五、校验

```text
client.js   sha256 见本页末尾与本仓库 CHANGELOG 的 Release 附件
```

---

## English summary

v1.0.7 is a light-mode pass over the v1.0.6 skin: the greeting now gets a real frosted backdrop (self-drawn gradient + `blur(30px)`), the host's whale canvas is replaced by the ZZZ logo video inside the center column, body/bubble text moves to `#999999` in light mode and `#B0B0B0` in dark, the leftover "theme check" card and the `FZBADGE` debug logger are removed, and the corner NOW LOADING stamp gains a `--fz3-corner-z` variable (default `30`) so it sits above content but under host menus. Fonts are still not shipped — `fonts/README.md` documents the four `SDK_*` families and `install-zzz-fonts.ps1` installs them per-user.
