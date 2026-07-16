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

`desktop-overlay/dist/Jinzhu-Desktop-Pet-1.0.0-portable.exe`

普通用户双击 `.exe` 即可运行，不需要 Node.js、npm 或 PowerShell。程序会把素材打包进 resources，并把位置、心情、饱腹度和亲密度保存到 Windows 用户数据目录。

系统托盘支持显示/隐藏、暂停走动、切换置顶和退出；也可以右键托盘图标选择退出。

如果 Windows SmartScreen 提示“未知发布者”，原因是当前构建没有购买代码签名证书。确认文件来自本项目后，可以选择“更多信息 → 仍要运行”；正式公开分发时建议使用代码签名证书。

网页和壁纸模式地址见仓库根目录 README。当前仓库没有提交 `.exe`，`dist/` 和 `node_modules/` 已被 `.gitignore` 排除。
