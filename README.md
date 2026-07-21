# message-clock / 金主

这个仓库同时保存网页时钟和 Windows 桌面宠物的源码，但目前仍是一个 repo，未执行拆分。

## 1. 网页时钟（GitHub Pages）

普通浏览器访问：

<https://kimyjxyim-beep.github.io/message-clock/>

网页层包含翻页时钟、日期、天气、留言板、动态天色和网页内金主互动。

## 2. Lively Wallpaper 壁纸模式

在 Lively Wallpaper 中加载：

<https://kimyjxyim-beep.github.io/message-clock/?wallpaper=1>

这个模式保留时钟、天气、留言板和天色氛围，隐藏网页宠物互动控件，适合与独立桌面宠物 Overlay 同时使用。

## 3. Windows Desktop Pet Overlay

源码位置：`desktop-overlay/`

它是独立的 Electron 透明小窗口，负责金主在 Windows 桌面上的走动、点击、拖动、睡觉、托盘控制和本地状态保存。

开发运行：

```powershell
cd desktop-overlay
npm install
npm start
```

生成 Windows portable 版本：

```powershell
npm run dist
```

输出到：`desktop-overlay/dist/Jinzhu-Desktop-Pet-1.2.1-portable.exe`

Windows 专用动作位于 `assets/jinzhu-desktop/`。进食使用不含饭碗的新帧，猫嘴直接对准生活区的独立橙色饭碗；点击藤篮窝后会播放准备、起跳、腾空、落窝及蜷缩睡眠帧，并停在缩小后的上层软垫上。

喝水使用独立的 `drink-1.png` 至 `drink-5.png`，身体保持在蓝色水碗左侧，只有嘴部接近水面；喝水期间橙色饭碗暂时隐藏，避免猫和两个碗重叠。

Windows 版包含两个互相独立的透明小窗口：金主活动窗口，以及可拖动并记住位置的生活区。生活区使用 `assets/jinzhu-home/` 内三个独立透明素材：下层拱门猫屋、上层开放藤篮的 `home-basket.png`，以及可分别点击的 `food-bowl.png` 和 `water-bowl.png`。点击窝、饭碗或水碗后，金主会实际走到对应位置，再睡觉、吃饭或喝水。

金主路线只使用 Electron `screen.getAllDisplays()` 返回的 Windows `workArea`，不会读取 Lively 页面、时钟、天气卡或留言板 DOM，也不会把网页元素当成碰撞墙。移动看门狗每次行走后检查三秒位移；若少于 2px，会取消目标、反向脱离并选择新目标。

请注意：双击 Windows Overlay `.exe` 只会启动透明桌面宠物，不会修改 Windows 壁纸。完整桌面体验需要同时运行两层：Lively Wallpaper 负责时钟背景，portable `.exe` 负责可以出现在其他窗口上方的金主。

`desktop-overlay/dist/` 和 `desktop-overlay/node_modules/` 已加入 `.gitignore`。构建产物不会提交到 Git；当前 Git 历史没有追踪 `.exe`。这样可以避免仓库被 70MB 以上的二进制和重复构建产物膨胀。需要发布时，可把 portable `.exe` 放到 GitHub Releases 或其他发行渠道。

## 将来拆分成独立 repo（本次不执行）

建议拆成两个仓库：

1. `message-clock`：只保留 GitHub Pages 网页、天气、天色和网页素材。
2. `jinzhu-desktop-pet`：保留 Electron Overlay、打包配置和 Windows 发布流程。

拆分时，Overlay 可以通过 release 下载网页所需的素材，或将素材复制进自己的 `resources/assets`；网页 repo 继续独立部署。拆分前应先确定版本号、素材授权、发布渠道和两边的更新流程。
