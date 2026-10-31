# 🌈 学习乐园

给 3–6 岁孩子用的学习小网页，家庭自用、不上架、不商用。
纯静态网页（HTML + CSS + JavaScript），没有后端、不登录、不上传任何数据；做成了 PWA，可以添加到 iPad 主屏幕全屏打开，断网也能用。

五个模块（都已有第一版，内容会继续打磨）：

| 模块 | 活动 |
| --- | --- |
| 🀄 中文 | 拼音点读（声母 / 韵母）、识字卡（70 个常用字 + 配图 + 读音）、听音找字、笔顺描红（hanzi-writer，手指 / Apple Pencil 都能写） |
| 🔤 英文 | 字母点读（大小写 + 示例词）、字母发音、CVC 拼读、单词配图卡（6 类）、听音选图 |
| 🔢 数学 | 认数字、数数（手指点数）、比大小、认形状、10 以内加减法 |
| 🤖 编程 | 网格迷宫 10 关：点选或拖动方向箭头排成指令，按“开始”让小动物走；第 7 关起引入“重复 N 次”积木 |
| 📖 圣经 | 5 个故事绘本（创造天地、挪亚方舟、约拿、大卫与歌利亚、耶稣爱小孩，幼儿语言重讲 + 语音朗读）、背金句小游戏（13 句，中文和合本 / 英文 KJV） |

iPad 横屏体验最好，iPhone 横屏、竖屏也做了适配。

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
  math/data.json        数学内容：物品、形状、每轮题数
  chinese/index.js      中文模块（拼音、识字卡、听音找字、笔顺描红）
  chinese/data.json     中文内容：声母、韵母、识字卡
  english/index.js      英文模块（字母、发音、拼读、单词卡、听音选图）
  english/data.json     英文内容：字母、CVC 单词、单词分类
  coding/index.js       编程模块（网格迷宫）
  coding/levels.json    关卡数据
  bible/index.js        圣经模块（故事绘本、背金句）
  bible/stories.json    故事内容（每页 emoji 场景 + 文字 + 结尾经文）
  bible/verses.json     金句（和合本 + KJV）
vendor/hanzi-writer/    笔顺库 hanzi-writer（MIT）+ 所用汉字的笔画数据（Arphic 公共许可），全部本地打包
icons/                  图标（icon.svg 为源文件，PNG 由脚本生成）
tools/build.js          生成 sw-assets.js（缓存清单 + 版本号）
tools/make-icons.js     由 icon.svg 生成 PNG 图标
```

## 自己加内容
- 每个模块的内容都在它自己目录下的 JSON 里，照着现有格式增删即可：
  - 数学 `modules/math/data.json`：物品、形状；`roundLength` 每轮题数，`countMax` 数数上限。
  - 中文 `modules/chinese/data.json`：声母 / 韵母（`say` 是用来朗读的同音字）、识字卡。新增识字卡的字时，把对应的 `字.json` 笔画数据放进 `vendor/hanzi-writer/data/`（可从 npm 包 `hanzi-writer-data` 复制），描红才能用。
  - 英文 `modules/english/data.json`：字母（`sound` 是给语音读的近似发音，可按效果调整）、CVC 拼读单词、单词分类。
  - 编程 `modules/coding/levels.json`：关卡（网格大小、起点终点、障碍、可用积木、积木格数、提示语）。
  - 圣经 `modules/bible/stories.json`、`verses.json`：故事页和金句。
- 每次改完文件，提交前在电脑上运行一次 `node tools/build.js`，更新离线缓存清单和版本号（忘了也没关系，只是新文件要联网才能第一次加载）。

## 技术说明
- 不依赖任何外部 CDN；以后引入的第三方库（如笔顺描红用的 hanzi-writer）也会打包到仓库里。
- 图片全部使用 emoji 或自绘 SVG，没有任何版权卡通形象。
- 答错不扣分、没有红叉，只有温和的“再试一次”。
