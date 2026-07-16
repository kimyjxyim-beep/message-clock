# Jinzhu Windows Desktop Pet Overlay

这是独立于网页时钟的 Electron 透明桌面宠物。它复用仓库 `assets/jinzhu/` 的多帧 PNG，不创建全屏透明拦截层。

## 开发版

```powershell
cd desktop-overlay
npm install
npm start
```

## 打包版

```powershell
npm run dist
```

portable 输出：

`desktop-overlay/dist/Jinzhu-Desktop-Pet-1.0.1-portable.exe`

普通用户双击 `.exe` 即可运行，不需要 Node.js、npm 或 PowerShell。程序会把素材打包进 resources，并把位置、心情、饱腹度和亲密度保存到 Windows 用户数据目录。

系统托盘支持显示/隐藏、暂停走动、切换置顶和退出；也可以右键托盘图标选择退出。

## 桌面时钟是另一层

这个 `.exe` 只启动金主透明 Overlay，不会自动修改 Windows 桌面背景。桌面时钟需要安装 Lively Wallpaper，并在 Lively 中添加以下网页地址：

`https://kimyjxyim-beep.github.io/message-clock/?wallpaper=1`

建议同时运行：

1. Lively Wallpaper：显示翻页时钟、日期、天气、留言板和天色。
2. Jinzhu Desktop Pet：显示可拖动、可互动、可置顶的金主。

托盘菜单里的“打开桌面时钟网页”可打开壁纸地址，但不会代替 Lively 设置壁纸。

## 资源诊断

启动时会记录是否为 packaged、`process.resourcesPath`、实际 idle 图片路径、文件是否存在、素材数量和图片 load/error 结果。右键托盘图标选择“打开诊断日志”即可查看。图片加载失败时会隐藏 `<img>`，不会显示破图图标或 alt 文字。

状态和诊断保存在 `%LOCALAPPDATA%\JinzhuDesktopPet`。1.0.1 不再复用旧版可能被锁定或损坏的 Roaming Cache；在不完整显卡运行库环境中也会关闭 Electron GPU 加速，避免透明窗口启动时崩溃。

如果 Windows SmartScreen 提示“未知发布者”，原因是当前构建没有购买代码签名证书。确认文件来自本项目后，可以选择“更多信息 → 仍要运行”；正式公开分发时建议使用代码签名证书。

网页和壁纸模式地址见仓库根目录 README。当前仓库没有提交 `.exe`，`dist/` 和 `node_modules/` 已被 `.gitignore` 排除。
