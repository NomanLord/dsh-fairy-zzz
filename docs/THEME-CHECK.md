# 主题校验 + 自动切换：浅色下品牌名 / 用量气泡不再白字（2026-11-22）

## 结论

浅色下「H.D.D.System」和用量气泡看不清，是**两套问题叠在一起**：

1. **皮肤的主题标记会卡住**。`data-fz3-theme` 原来先信 `theme.getTheme()`，那个快照偶尔比真实 DOM 慢一拍；一旦卡在 `dark`，浅色界面里品牌名继续用 `#f2f5ff` 白字、气泡继续走深色规则 → 白底白字。
2. **气泡文字本身没有真正按主题分色**。`client.js` 里第 836 行有一句
   `.fz3-bubble-head,.fz3-bubble-k,.fz3-bubble-v...{color:#fff!important}`，
   后面虽然补过 `#9aa0aa`，但那是**灰字**：白底上实测对比度只有 **2.05:1**（WCAG 正文要求 4.5:1），所以「不是白字也看不清」。

这次不是再补一条颜色，而是把「判定 → 切换 → 校验 → 兜底」做成一条链：

- 主题判定改看**宿主真实设计令牌**（`--dsw-alias-bg-base` / `--dsw-alias-label-primary`），失配自动切；
- 品牌名 / 气泡改成两套 CSS 变量（浅色深字、深色白字），放在 CSS **最后**，压过前面所有历史补丁；
- 运行时每 500ms 校验一次主题、每 2 秒做一次**对比度自检**，低于阈值自动改成可读色；
- 设置页「Fairy」里多了一行「主题校验」，显示当前皮肤 / 宿主主题、最低对比度和「通过 / 已修正」，带「重新校验」按钮。

## 一、改了什么

只动皮肤插件 `dsh-fairy-zzz/client.js`
（`%USERPROFILE%\.dsh\profiles\<profile>\node_modules\dsh-fairy-zzz\client.js`）。

| # | 位置 | 内容 |
|---|---|---|
| 1 | CSS 末尾（设置面板深色块之后） | 新增「主题校验：最终配色层」：`html[data-fz3-theme="light"]` / `"dark"` 各定义一套 `--fz3-brand-*` / `--fz3-bubble-*`，品牌名、气泡标题、键名、数值、明细、峰谷时钟全部只引用变量 |
| 2 | `guard('theme-watch')` 整段重写 | 宿主令牌优先的主题判定、失配自动切换、颜色解析 / 亮度 / 对比度工具、自检与自动修正、`window.__fz3ThemeCheck()` 诊断接口 |
| 3 | 设置页「外观」行下面 | 新增「主题校验」行：状态徽标（通过 / 已修正 / 待校验）、当前皮肤 / 宿主主题、最低对比度、「重新校验」按钮 |
| 4 | `onCoreDown` / `onCoreMove` | 修掉「默认开启拖拽时，新会话页单击眼徽打不开用量气泡」：新会话页只锁拖动，不再吞掉单击 |
| 5 | `ThemeToggle` | 监听 `fz3:theme-report`，宿主自动切浅色 / 深色时太阳 / 月亮图标跟着变 |

### 为什么颜色要放在 CSS 最后

这个 `client.js` 的 CSS 里，气泡颜色被改过至少四轮：

- 第 634 行：浅色白底；
- 第 836 行：黑底 + 全部 `#fff!important`；
- 第 1703 行：键黑、值灰；
- 第 1858 / 1918 / 1934 行：又一轮白底 / 黑底。

同一组选择器互相 `!important`，谁在后面谁赢。新增的最终层统一带 `html[data-fz3-theme]` 前缀、放在 2288 行之前（CSS 模板末尾）、源顺序最后，所以稳定压过前面所有规则；以后再加补丁也不用改它们。

## 二、主题校验怎么判定（新的 `resolve()` 顺序）

| 顺序 | 信号 | 说明 |
|---|---|---|
| 1 | 用户强制 `light` / `dark` | 设置页「外观」或侧栏太阳 / 月亮按钮。永远优先，**不自动改** |
| 2 | 宿主令牌亮度 | `--dsw-alias-bg-base` 亮 → 浅色，暗 → 深色；拿不到再看 `--dsw-alias-label-primary` 的反向关系。这两个值由宿主外观决定（皮肤 `overrideTokens` 也按宿主 active colorScheme 取值），是最接近「实际画出来」的信号 |
| 3 | `theme.getTheme().active.colorScheme` | 主题服务的快照，作为令牌取不到时的后备 |
| 4 | `body[data-ds-dark-theme]` / `html[data-theme]` | 宿主设计系统属性 |
| 5 | 保持上一次的值 | 不瞎猜，避免首屏闪白 / 闪黑 |

判定结果写到两个属性上，方便排查：

- `html[data-fz3-theme="light|dark"]`：皮肤用哪套颜色；
- `html[data-fz3-theme-src="preference|host-token|theme-service|host-attr|keep"]`：这次是谁说了算；
- `html[data-fz3-theme-switch="dark→light"]`：最近一次自动切换方向；
- `html[data-fz3-contrast="pass|fixed"]`：最近一次自检结果。

### 自动切换的触发

- `ctx.on('theme/change')`：宿主主题服务变化；
- `MutationObserver` 盯 `<html>` 的 `style / class / data-theme / data-color-scheme / data-fz3-theme` 和 `<body>` 的 `data-ds-dark-theme / class / style / data-theme`（260ms 去抖）；
- `matchMedia('(prefers-color-scheme: light)')`；
- 500ms 常驻轮询（只做字符串比较，开销可忽略）；
- 首屏补 5 次重试：60 / 180 / 420 / 900 / 1800ms，覆盖「插件比宿主先执行」。

## 三、对比度自检 + 自动修正

自检目标（元素不可见 / 没文字时自动跳过）：

| 选择器 | 名称 | 阈值 |
|---|---|---|
| `.fz3-sb-text b` / `.fz3-brandname b` | 侧栏品牌名 / 品牌名 | 大字号 3:1 |
| `.fz3-sb-text i` | 品牌副标 | 4.5:1 |
| `.fz3-bubble-head` | 气泡标题 | 4.5:1 |
| `.fz3-bubble-k` | 气泡键名 | 4.5:1 |
| `.fz3-bubble-v` / `.fz3-bubble-v b` | 气泡数值 | 4.5:1 |
| `.fz3-bubble-sub` | 气泡明细 | 4.5:1 |
| `.fz3-peak-clock` | 峰谷时钟 | 4.5:1 |

做法：

1. 取 `getComputedStyle` 的实际前景色；背景沿祖先链找到第一个不透明底色（气泡就是白卡 / 黑卡本身），半透明色按 alpha 合成；
2. 按 WCAG 相对亮度算对比度；
3. 低于阈值 → 按背景亮度选 `#0f1730`（浅底）或 `#f2f5ff`（深底），内联 `color` + `text-shadow:none!important`，并打上 `data-fz3-contrast-fix="1"`；
4. 主题一变，先撤掉所有内联兜底，交给新 CSS——不会留下「上一套主题的补丁色」；
5. 自检节奏：主题变化后 120ms、每次点击后 260ms、每 2 秒兜底一次；报告通过 `fz3:theme-report` 事件派发给设置页。

### 控制台 / 设置页接口

```js
__fz3ThemeCheck()
// → { theme:'light', source:'host-token', host:'light', ok:true, minRatio:13.83,
//     items:[{ selector, label, color, background, ratio, min, ok, fixed }], message:'通过：最低对比度 13.8:1（light）' }
```

`window.__fz3ThemeReport` 保留最近一次报告。

## 四、设置页入口

「设置 → Fairy」里「外观」行下面新增一行：

> **主题校验**
> 皮肤 浅色 · 宿主 浅色 · 通过：最低对比度 13.8:1（light）· 自动跟随
> `通过` `重新校验`

- 徽标三种状态：`待校验`（灰）/ `通过`（绿）/ `已修正`（橙）；
- 强制浅色 / 深色时显示「手动指定优先」，此时即使宿主是反方向也不会自动改，方便对照；
- 想看实时结果，点「重新校验」即可（和 `__fz3ThemeCheck()` 同一份逻辑）。

## 五、验证（真页面，1562×978，headless Edge + CDP）

| 场景 | 结果 |
|---|---|
| 宿主深色 → 设置里点「浅色」 | 皮肤 500ms 内 `dark→light`，`src=host-token`，品牌名 `rgb(15,23,48)`，13.83:1 |
| 浅色 + 打开用量气泡 | 白卡 `#fff`，标题 13.7:1、键名 10.24:1、数值 18.34:1、峰谷 6.61:1，最低 **6.6:1** |
| 宿主浅色 → 点「深色」 | 皮肤 `light→dark`，品牌名 19.28:1，气泡最低 11.27:1 |
| 人为把气泡数值改成 `#fff` 再校验 | 自动改回 `rgb(11,20,40)`，报告「已自动修正 1 处低对比度文字」 |
| 人为把 `data-fz3-theme` 改成 `dark` | 200ms 内自动恢复 `light`（不再卡住） |
| 新会话页 + 默认开启拖拽，单击眼徽 | 用量气泡正常打开（修复前打不开） |
| 侧栏太阳 / 月亮图标 | 宿主自动切换后 `data-mode` 跟着变（light / dark） |

截图（仓库 `screenshots/`）：

- `01-boot.png`：开机动画；
- `02-greet.png`：新会话页标题与眼徽；
- `03-eye-states.png`：浅色 / 深色同一区域的眼徽；
- `04-settings.png`：设置页「外观」与「主题校验」行。

校验：`node --check` 通过；CSS 括号 587/587 配平（新增 18 条规则）。

## 六、怎么生效

皮肤 `client.js` 是页面加载时现取的，所以：

1. 在 DSH 窗口按 **Ctrl+R** 刷新；
2. 打开「设置 → Fairy」，应能看到「主题校验 → 通过」；
3. 切到浅色，品牌名和用量气泡应该都是深字白卡。

## 七、回退

```powershell
# 仓库内回退到上一版 client.js
git checkout HEAD~1 -- client.js
# 再按安装方式覆盖到插件目录（或重新 install_bundle）
```

刷新即可。v1.0.3 原版 `client.js` 哈希 `E293B7CA…C3EEBC18`（236114 字节）；
本版 `43286023…E19507F`（254902 字节）。

## 八、相关文件

| 文件 | 用途 |
|---|---|
| `client.js` | 皮肤本体（配色层、`theme-watch`、对比度自检、设置行都在这里） |
| `docs/THEME-CHECK.md` | 本文档 |
| `screenshots/01-boot.png` … `04-settings.png` | README 用截图（已裁掉个人信息） |
| `licenses/` | 第三方素材的 Apache-2.0 许可证、NOTICE 与商标说明 |

