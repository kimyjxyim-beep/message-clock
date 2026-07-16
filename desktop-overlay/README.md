# 金主 Windows 桌面宠物 Overlay

这是独立于网页壁纸的 Electron 透明窗口 MVP。它复用仓库 `assets/jinzhu/` 的多帧 PNG，不是全屏透明层，因此不会挡住其他应用的点击。

## 启动

在 Windows 安装 Node.js 后：

```powershell
cd desktop-overlay
npm install
npm start
```

托盘菜单可以显示/隐藏、暂停走动、切换置顶和退出。拖动金主可放到任意桌面位置；位置、心情、饱腹和亲密度保存到 Electron 的用户数据目录。

## Lively Wallpaper

在 Lively 中加载：

`https://kimyjxyim-beep.github.io/message-clock/?wallpaper=1`

该模式保留时钟、日期、天气、留言板和天色，但隐藏网页宠物与互动控件，避免和桌面 Overlay 重复。
