# 字体（可选）

皮肤自带的品牌字体 `HDD Brand` 已经打包在 [`assets/brand-heavy.ttf`](../assets/brand-heavy.ttf)，通过 `@font-face` 加载，**不需要安装**。

界面正文使用下面这些系统字体：

| 字体名 | 文件 | 用途 |
|---|---|---|
| `SDK_SC_Web` | `zh-cn.ttf` | 简体中文正文 / 界面 |
| `SDK_TW_Web` | `zh-tw.ttf` | 繁体中文回退 |
| `SDK_JP_Web` | `ja-jp.ttf` | 用量气泡粗体 |
| `SDK_US_Web` | `en-us.ttf` | 英文回退 |

皮肤的字体栈是：

```text
"SDK_SC_Web", "SDK_TW_Web", "SDK_JP_Web", "Microsoft YaHei UI", system-ui, sans-serif
```

没装这些字体时会自动回退到 **Microsoft YaHei UI**，功能不受影响，只是字形和截图略有差别。

## 安装字体包

1. 打开本仓库的 [Releases](../../../releases)，下载 `dsh-fairy-zzz-fonts.zip`；
2. 解压得到 `dsh-fairy-zzz-fonts/` 文件夹；
3. 右键 `install-fonts.ps1` → **使用 PowerShell 运行**；或：

   ```powershell
   cd <解压目录>\dsh-fairy-zzz-fonts
   powershell -ExecutionPolicy Bypass -File .\install-fonts.ps1
   ```

4. 完全退出 DSH 再重新打开（或注销/重新登录 Windows），字体才会重新加载。

脚本只装到当前用户：

```text
%LOCALAPPDATA%\Microsoft\Windows\Fonts
```

并写入 `HKCU` 字体注册表，不需要管理员，也不改系统字体目录。

也可以手动安装：把 `SDK-SC`、`SDK-TW`、`SDK-JP`、`SDK-US` 里的 `.ttf` 右键 → 安装。

## 本机来源（2026-11-23）

本机的四个字体直接取自游戏安装目录，没有走 Release 附件：

```text
D:\ZenlessZoneZero Game\ZenlessZoneZero_Data\StreamingAssets\MiHoYoSDKRes\HttpServerResources\font
  zh-cn.ttf -> SDK_SC_Web
  zh-tw.ttf -> SDK_TW_Web
  ja-jp.ttf -> SDK_JP_Web (Bold)
  en-us.ttf -> SDK_US_Web
```

安装脚本（可重复执行，`-Uninstall` 可卸载）：

```powershell
powershell -ExecutionPolicy Bypass -File C:\自动化测试学习区\install-zzz-fonts.ps1
```

脚本会校验哈希后复制到 `%LOCALAPPDATA%\Microsoft\Windows\Fonts`、写 `HKCU` 注册表、
`AddFontResourceW` 并广播 `WM_FONTCHANGE`，不需要管理员。

## 验证

重启 DSH 后按 `F12` → Console：

```js
getComputedStyle(document.body).fontFamily
```

能看到 `SDK_SC_Web` 排在前面即可。

## 卸载

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall-fonts.ps1
```

然后重启 DSH。

## 版权说明

`SDK_SC_Web / SDK_TW_Web / SDK_JP_Web / SDK_US_Web` 的版权归各自字体厂商/发行方所有，**不在本仓库的 MIT 许可范围内**。字体包只作为可选的 Release 附件提供，请仅用于个人本机，不要商用或再次分发；如果权利人提出异议，请删除字体包。
