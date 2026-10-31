# 🌈 学习乐园

给 3–6 岁孩子用的学习小网页，家庭自用、不上架、不商用。
纯静态网页（HTML + CSS + JavaScript），没有后端、不登录、不上传任何数据；做成了 PWA，可以添加到 iPad 主屏幕全屏打开，断网也能用。

五个模块：中文 🀄 · 英文 🔤 · 数学 🔢 · 编程 🤖 · 圣经 📖
（目前 **数学** 已完成，其余四个为“准备中”占位页，会逐个补上。）

## 在 iPad 上怎么用

1. **部署到 GitHub Pages**（只需做一次）
   - 打开仓库页面 → `Settings` → 左侧 `Pages`。
   - `Build and deployment` → `Source` 选 **Deploy from a branch**。
   - `Branch` 选 **master**（如果代码还在别的分支，先把它合并到 master），文件夹选 `/ (root)`，点 `Save`。
   - 等 1–2 分钟，网址是：`https://dhx65521.github.io/hello-world/`
2. **在 iPad 上打开**
   - 用 **Safari**（必须是 Safari，其它浏览器不能添加全屏 App）打开上面的网址。
   - 点一下屏幕任意位置，再点“数学”，应该能听到语音。
3. **添加到主屏幕**
   - 点 Safari 地址栏旁边的 **分享按钮**（方框加向上箭头）。
   - 往下找，点 **“添加到主屏幕”** → 右上角 **“添加”**。
   - 主屏幕上会出现 🌈 **学习乐园** 图标，以后从这里打开就是全屏、没有地址栏。
4. **离线使用**
   - 第一次打开后，所有文件会自动缓存到 iPad 上。之后没有网络也能正常玩。
   - 更新了内容后：联网状态下打开 App，进入家长区点 **“检查更新”** 即可。

### 建议的 iPad 设置
- **横屏**使用体验最好。
- 设置 → 辅助功能 → **引导式访问** 打开后，孩子就不能退出 App 乱按其他东西（三击顶部按钮进入/退出）。
- 如果觉得中文语音不好听：设置 → 辅助功能 → 朗读内容 → 声音 → 中文 → 下载“婷婷（增强）”。
- 如果没有声音：检查侧边静音开关 / 控制中心的静音，以及音量。

## 家长区
首页右上角 ⚙️ **长按 3 秒** 进入。可以：
- 查看每个活动玩了几轮、答对多少、得了多少星星；
- 设置每次使用时长（默认 10 分钟，到时间会温和提示休息，家长长按 3 秒可继续）；
- 调整语音速度、试听中英文；
- 清空进度；检查更新。

## 目录结构

```
index.html              入口页面
manifest.webmanifest    PWA 清单（名称、图标、全屏）
sw.js / sw-assets.js    Service Worker 离线缓存（sw-assets.js 由脚本生成）
css/style.css           全部样式
js/
  app.js                启动、路由、首页
  registry.js           模块注册表（首页 5 个图标的顺序）
  ui.js                 界面小工具（建元素、页面骨架、长按、随机）
  speech.js             语音（Web Speech API，zh-CN / en-US，语速可调）
  sound.js              音效（Web Audio 实时合成，无音频文件）
  rewards.js            星星、鼓励语、星星特效、总结页
  quiz.js               通用答题引擎（出题 → 点选 → 反馈 → 总结）
  storage.js            localStorage 读写
  timer.js              使用时长与休息提醒
  parent.js             家长区
modules/
  math/index.js         数学模块（认数字、数数、比大小、认形状、加减法）
  math/data.json        数学内容数据：物品、形状、每轮题数
  chinese/ english/ coding/ bible/   其余模块（待做）
icons/                  图标（icon.svg 为源文件，PNG 由脚本生成）
tools/build.js          生成 sw-assets.js（缓存清单 + 版本号）
tools/make-icons.js     由 icon.svg 生成 PNG 图标
```

## 自己加内容
- 数学的物品、形状在 `modules/math/data.json` 里，按现有格式增删即可；`roundLength` 是每轮题数，`countMax` 是数数上限。
- 每次改完文件，提交前在电脑上运行一次 `node tools/build.js`，更新离线缓存清单和版本号（忘了也没关系，只是新文件要联网才能第一次加载）。

## 技术说明
- 不依赖任何外部 CDN；以后引入的第三方库（如笔顺描红用的 hanzi-writer）也会打包到仓库里。
- 图片全部使用 emoji 或自绘 SVG，没有任何版权卡通形象。
- 答错不扣分、没有红叉，只有温和的“再试一次”。
