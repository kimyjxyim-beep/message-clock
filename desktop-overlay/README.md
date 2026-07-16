# 金主 Windows 桌面宠物 Overlay

这是独立于网页壁纸的 Electron 透明窗口 MVP。它复用仓库 `assets/jinzhu/` 的多帧 PNG，不是全屏透明层，因此不会挡住其他应用的点击。

## 启动

在 Windows 安装 Node.js 后：

```powershell
cd desktop-overlay
npm install
npm start
```

## 打包版

维护者在仓库目录执行 `npm install` 后运行 `npm run dist`。生成的免安装版本位于 `desktop-overlay/dist/Jinzhu-Desktop-Pet-1.0.0-portable.exe`，普通用户直接双击即可运行，不需要再安装 Node.js、npm 或打开 PowerShell。便携版会把金主图片放进程序资源，并将位置、心情、饱腹和亲密度保存到 Windows 用户数据目录。

首次运行若 Windows SmartScreen 显示“未知发布者”，是因为此版本未购买代码签名证书，并不代表程序必然有问题；可在确认文件来自本仓库后选择“更多信息 → 仍要运行”，或使用杀毒软件扫描后再运行。正式公开分发时建议签名证书。

托盘菜单可显示/隐藏、暂停走动、切换置顶和退出；也可直接右键托盘图标选择“退出”。

托盘菜单可以显示/隐藏、暂停走动、切换置顶和退出。拖动金主可放到任意桌面位置；位置、心情、饱腹和亲密度保存到 Electron 的用户数据目录。

## Lively Wallpaper

在 Lively 中加载：

`https://kimyjxyim-beep.github.io/message-clock/?wallpaper=1`

该模式保留时钟、日期、天气、留言板和天色，但隐藏网页宠物与互动控件，避免和桌面 Overlay 重复。
