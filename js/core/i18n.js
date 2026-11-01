// 界面文字：中文 / English。t('key', {n: 1}) 取文字；name(obj) 取数据里的名字（name / nameEn）。
import { setting, setSetting } from './store.js';

const DICT = {
  zh: {
    appName: '数学小农场',
    // 通用
    cancel: '取消', ok: '好的', back: '返回', home: '回家', coins: '金币', great: '太好了', no: '不要',
    // 首次设置
    welcome: '欢迎来到数学小农场', familyNamePrompt: '给这个家庭档案起个名字', familyPlaceholder: '比如：我们家',
    localOnly: '只在这台设备上保存，不会上传到任何地方。', next: '下一步 ➡️', needName: '先起个名字吧',
    setPin: '设置家长密码（4 位数字）', pinWhy: '进入家长区、修改设置时需要。', confirmPin: '再输入一次确认', pinMismatch: '两次不一样，再来一次',
    enterPin: '请输入 4 位密码', enterParentPin: '请输入家长密码', wrongPin: '密码不对',
    // 孩子
    whoPlays: '{family} · 谁来玩？', years: '{n} 岁', newFriend: '新朋友', noKids: '还没有小朋友，先添加一个吧 👇', editProfile: '修改资料',
    name: '名字', age: '年龄', avatar: '头像', save: '✅ 保存', letsPlay: '✅ 好了，开始玩！', enterName: '先输入名字',
    // 主界面
    doMath: '做数学 赚金币', shop: '种子商店', bag: '仓库', parentArea: '家长区（长按）',
    leftToday: '今天还可以玩 {n} 次', noneLeftToday: '今天的次数用完了',
    needCare: '有 {n} 块地需要照顾 👀', tapToPlant: '点一块地开始种东西吧 🌱', emptyPlot: '这块地空着，点一下可以种种子', plantSomething: '🌱 种点什么',
    ripeNow: '成熟啦，快收获！', weedy: '长草了，点几下拔掉', thirsty: '口渴了，要浇水', hasBug: '有虫子！', growing: '正在长大… 还要 {time}',
    harvest: '✨ 收获', water: '💧 浇水', pullWeed: '🌿 拔草 ({n})', spray: '🧴 杀虫 ({n})', fertilize: '💩 施肥 ({n})',
    removePlant: '把{seed}铲掉？', seedNotReturned: '种子不会退回。', remove: '铲掉', yieldInfo: '{stage} · 产量 {n} 个',
    bugNeedSpray: '有虫子！需要杀虫剂，去商店买一瓶吧', whatToPlant: '种什么？', noSeeds: '还没有种子', goBuySeeds: '去商店买一些种子吧。做数学题可以赚金币。', goShop: '🏪 去商店',
    planted: '种下了{seed}，记得浇水 💧', harvested: '收获了 {n} 个{seed}，放进仓库了 🎒', unlockedSeed: '解锁了新种子：{seed}！', checkShop: '去商店看看吧。',
    dailyUsedUp: '今天的数学挑战已经用完啦', dailyUsedUpHint: '每天可以玩 {n} 次，明天再来吧。需要的话请家长来解锁一次。', parentUnlock: '🔑 家长解锁一次', tomorrow: '好的，明天再来',
    unlockOnce: '家长解锁一次', unlockedRound: '已解锁一次，去玩吧！',
    // 数学
    math: '🧮 数学', preparing: '准备中…', loadFail: '加载失败，请联网后重试。', unclear: '{text}？再写清楚一点 ✏️',
    correct: '✅ 对啦！ +{n}', tryAgain: '再想一想，再写一次 ✏️', answerIs: '答案是 {n}，记住了吗？', score: '答对 {c} · 答题 {a}',
    timeUp: '时间到！', answered: '答题', right: '答对', wrong: '答错', coinsLabel: '🪙 金币', nowHave: '现在一共有 🪙 {n}', again: '🔁 再来一局', goHome: '🏠 回家',
    quitRound: '要结束这一局吗？', coinsKept: '已经赚到的金币会保留。', end: '结束', keepGoing: '继续做题',
    countdown: '{time} 倒计时', mathIntro: '答对一题 +{n} 🪙，答错不扣，可以再写一次。两位数写两格，一位数写一格就行。', start: '▶ 开始！',
    padTitle: '✍️ 把答案写在这里，写完停一下就会自动判断',
    // 商店
    shopTitle: '🏪 种子商店', tabSeeds: '🌱 种子', tabItems: '🧰 道具', tabSell: '🧺 卖果实',
    unlockAt: '收获 {n} 次解锁（已 {x} 次）', seedMeta: '⏱ {time} · 产 {y} 个 · 卖 {s}/个', own: '已有 ×{n}', buy: '🪙 {n} 买', each: '每个 🪙 {n}', have: '有 ×{n}',
    sellOne: '卖 1 个', sellAll: '全部卖 🪙 {n}', noCrops: '仓库里还没有果实。种点东西，收获后拿来卖吧！',
    shopWelcome: ['欢迎光临！今天想种点什么？', '新鲜的种子，快来看看！', '做数学题赚的金币，可以在这里花哦。'],
    shopBuy: ['谢谢惠顾！', '好眼光！', '记得浇水哦～', '拿好啦！'], shopPoor: ['金币不够啦，去做几道数学题吧！', '再攒一攒金币～'],
    shopSell: ['真新鲜！这些我收了。', '长得真好，谢谢！', '叮当～金币到账！'], shopLocked: ['这个要多收获几次才能买哦。'],
    // 仓库
    bagTitle: '🎒 我的仓库', coinsCount: '{n} 枚金币', harvestedTimes: '收获过 {n} 次', seeds: '🌱 种子', noSeedsBag: '还没有种子，去商店买一些吧。',
    items: '🧰 道具', noItems: '还没有道具。', crops: '🧺 果实', noCropsBag: '还没有收获的果实。', goSell: '💰 去卖果实',
    mathRecord: '🧮 做题记录', rounds: '玩过的局数', rightOverAnswered: '答对 / 答题', bestRound: '一局最多赚到', totalEarned: '累计赚到',
    // 家长区
    parent: '家长区', kids: '👧 小朋友', kidLine: '{name}（{age} 岁）', kidStat: '🪙 {c} · 做题 {r} 局 · 答对 {x}/{y} · 今天 {d} 次',
    deleteKid: '删除 {name} 的全部记录？', deleteKidHint: '金币、农场、做题记录都会清掉，不能恢复。', delete: '删除', addKid: '＋ 添加小朋友',
    language: '🌐 语言 / Language', roundLength: '⏱️ 数学每局时长', minutes: '{n} 分钟', reward: '🪙 答对奖励',
    rewardHint: '答错不扣金币，可以再写一次；第二次答对也有奖励，再错就显示答案进入下一题。',
    dailyLimit: '📅 每天挑战次数', unlimited: '不限', times: '{n} 次', dailyHint: '每个小朋友每天最多开始这么多局数学。用完后孩子会看到提示，家长输入密码可以临时多解锁一次。',
    farmTime: '🧪 农场时间（测试模式）', normal: '正常', faster: '快 {n} 倍', farmTimeHint: '正常模式下番茄 1 小时成熟、火龙果 2 天；测试模式用来快速推演。',
    saveData: '💾 存档', exportSave: '📤 导出存档', importSave: '📥 导入存档', saveHint: '导出一个 JSON 文件（可存到“文件”或用隔空投送发到另一台设备），在另一台设备上导入即可搬家。',
    importOk: '导入成功', importFail: '导入失败：', reset: '⚠️ 重置', resetAll: '清空全部数据（账户和所有小朋友）', resetConfirm: '再点一次确认清空',
    about: 'ℹ️ 关于', aboutLine: '数学小农场 v{v} · 家庭自用 · 纯本地运行', checkUpdate: '🔄 检查更新',
    // 小龄模式
    whichIs: '哪个是 {n}？', whichIsSpoken: '下面哪个是数字 {n}？', copyDigit: '照着写 {n}', copyDigitSpoken: '照着写数字 {n}', listen: '🔊 再听一遍',
    tryAgainPick: '再想一想，再选一次 👆', tryAgainSpoken: '再试一次', thatIs: '这个是 {n}', wellDone: '真棒！', isThis: '是这个，{n}', littleIntro: '听一听，选出正确的数字；或者照着写数字。答对一题 +{n} 🪙，答错可以再来一次。',
    // 家长区：数学模式与语音
    mathMode: '🧮 数学模式', modeAuto: '按年龄（5 岁以下听选 / 描写）', modeLittle: '听选 + 描写', modeBig: '手写算式',
    voice: '🗣️ 语音', voiceHint: '用 iPad 自带的朗读声音。想要更自然的声音：设置 › 辅助功能 › 朗读内容 › 声音 › 中文 / 英语，下载带“增强”或“高级”的声音（如婷婷、Ava），下载后回到这里选中它。Siri 的声音不对网页开放。',
    voiceTest: '试听', noVoices: '这个语言没有可用的声音', speechRate: '语速', slow: '慢', normalRate: '适中', fast: '正常',
    // 时间
    sec: '{n} 秒', min: '{n} 分钟', hour: '{n} 小时', hourMin: '{h} 小时 {m} 分', dayHour: '{d} 天 {h} 小时',
  },
  en: {
    appName: 'Math Farm',
    cancel: 'Cancel', ok: 'OK', back: 'Back', home: 'Home', coins: 'coins', great: 'Great!', no: 'No',
    welcome: 'Welcome to Math Farm', familyNamePrompt: 'Name this family profile', familyPlaceholder: 'e.g. Our Family',
    localOnly: 'Saved only on this device. Nothing is uploaded.', next: 'Next ➡️', needName: 'Please enter a name',
    setPin: 'Set a parent PIN (4 digits)', pinWhy: 'Needed for the parent area and settings.', confirmPin: 'Enter it again to confirm', pinMismatch: "They don't match, try again",
    enterPin: 'Enter 4-digit PIN', enterParentPin: 'Enter parent PIN', wrongPin: 'Wrong PIN',
    whoPlays: "{family} · Who's playing?", years: 'age {n}', newFriend: 'New friend', noKids: 'No kids yet. Add one below 👇', editProfile: 'Edit profile',
    name: 'Name', age: 'Age', avatar: 'Avatar', save: '✅ Save', letsPlay: "✅ Let's play!", enterName: 'Please enter a name',
    doMath: 'Do Math, Earn Coins', shop: 'Seed Shop', bag: 'Backpack', parentArea: 'Parent area (long press)',
    leftToday: '{n} left today', noneLeftToday: 'No rounds left today',
    needCare: '{n} plot(s) need care 👀', tapToPlant: 'Tap a plot to start planting 🌱', emptyPlot: 'This plot is empty. Tap to plant.', plantSomething: '🌱 Plant something',
    ripeNow: 'Ripe! Harvest it!', weedy: 'Weeds! Tap to pull them', thirsty: 'Thirsty, needs water', hasBug: 'A bug!', growing: 'Growing… {time} left',
    harvest: '✨ Harvest', water: '💧 Water', pullWeed: '🌿 Pull weeds ({n})', spray: '🧴 Spray ({n})', fertilize: '💩 Fertilize ({n})',
    removePlant: 'Dig up the {seed}?', seedNotReturned: 'The seed will not be returned.', remove: 'Dig up', yieldInfo: '{stage} · yields {n}',
    bugNeedSpray: 'A bug! You need pesticide. Buy some at the shop.', whatToPlant: 'What to plant?', noSeeds: 'No seeds yet', goBuySeeds: 'Buy seeds at the shop. Do math to earn coins.', goShop: '🏪 Go to shop',
    planted: 'Planted {seed}. Remember to water it 💧', harvested: 'Harvested {n} {seed}, put in your backpack 🎒', unlockedSeed: 'New seed unlocked: {seed}!', checkShop: 'Check the shop.',
    dailyUsedUp: "Today's math rounds are used up", dailyUsedUpHint: 'You can play {n} round(s) a day. Come back tomorrow, or ask a parent to unlock one more.', parentUnlock: '🔑 Parent unlock', tomorrow: 'OK, tomorrow',
    unlockOnce: 'Parent: unlock one round', unlockedRound: 'One more round unlocked!',
    math: '🧮 Math', preparing: 'Loading…', loadFail: 'Failed to load. Please connect to the internet and retry.', unclear: '{text}? Please write more clearly ✏️',
    correct: '✅ Correct! +{n}', tryAgain: 'Think again and write once more ✏️', answerIs: 'The answer is {n}. Remember it!', score: 'Correct {c} · Answered {a}',
    timeUp: "Time's up!", answered: 'Answered', right: 'Correct', wrong: 'Wrong', coinsLabel: '🪙 Coins', nowHave: 'You now have 🪙 {n}', again: '🔁 Play again', goHome: '🏠 Home',
    quitRound: 'End this round?', coinsKept: 'Coins you earned are kept.', end: 'End', keepGoing: 'Keep going',
    countdown: '{time} countdown', mathIntro: '+{n} 🪙 per correct answer. No penalty for mistakes, you get a second try. Two digits: use both boxes; one digit: one box.', start: '▶ Start!',
    padTitle: '✍️ Write the answer here. Pause and it checks automatically.',
    shopTitle: '🏪 Seed Shop', tabSeeds: '🌱 Seeds', tabItems: '🧰 Tools', tabSell: '🧺 Sell crops',
    unlockAt: 'Unlocks after {n} harvests ({x} so far)', seedMeta: '⏱ {time} · yields {y} · sells {s} each', own: 'You have ×{n}', buy: '🪙 {n} Buy', each: '🪙 {n} each', have: 'Have ×{n}',
    sellOne: 'Sell 1', sellAll: 'Sell all 🪙 {n}', noCrops: 'No crops in your backpack yet. Grow something and sell it here!',
    shopWelcome: ['Welcome! What will you plant today?', 'Fresh seeds, come and see!', 'Spend the coins you earned doing math here.'],
    shopBuy: ['Thank you!', 'Good choice!', 'Remember to water it!', 'Here you go!'], shopPoor: ['Not enough coins. Go do some math!', 'Save up a few more coins~'],
    shopSell: ['So fresh! I will take these.', 'Beautiful crops, thanks!', 'Cha-ching! Coins added.'], shopLocked: ['Harvest a few more times to unlock this one.'],
    bagTitle: '🎒 My Backpack', coinsCount: '{n} coins', harvestedTimes: 'Harvested {n} times', seeds: '🌱 Seeds', noSeedsBag: 'No seeds yet. Buy some at the shop.',
    items: '🧰 Tools', noItems: 'No tools yet.', crops: '🧺 Crops', noCropsBag: 'No harvested crops yet.', goSell: '💰 Sell crops',
    mathRecord: '🧮 Math record', rounds: 'Rounds played', rightOverAnswered: 'Correct / Answered', bestRound: 'Best round', totalEarned: 'Total earned',
    parent: 'Parent Area', kids: '👧 Kids', kidLine: '{name} (age {age})', kidStat: '🪙 {c} · {r} rounds · correct {x}/{y} · today {d}',
    deleteKid: 'Delete all data for {name}?', deleteKidHint: 'Coins, farm and records will be erased. This cannot be undone.', delete: 'Delete', addKid: '＋ Add a kid',
    language: '🌐 语言 / Language', roundLength: '⏱️ Math round length', minutes: '{n} min', reward: '🪙 Reward per correct answer',
    rewardHint: 'No coin penalty for mistakes; the child gets a second try. A correct second try is still rewarded; a second mistake shows the answer.',
    dailyLimit: '📅 Daily challenge limit', unlimited: 'Unlimited', times: '{n}×', dailyHint: 'Max math rounds each kid can start per day. When used up, a parent can enter the PIN to unlock one more.',
    farmTime: '🧪 Farm time (test mode)', normal: 'Normal', faster: '{n}× faster', farmTimeHint: 'Normally tomatoes take 1 hour and dragon fruit 2 days; test mode speeds things up.',
    saveData: '💾 Save data', exportSave: '📤 Export', importSave: '📥 Import', saveHint: 'Export a JSON file (save to Files or AirDrop it) and import it on another device to move your data.',
    importOk: 'Imported', importFail: 'Import failed: ', reset: '⚠️ Reset', resetAll: 'Erase everything (account and all kids)', resetConfirm: 'Tap again to confirm',
    about: 'ℹ️ About', aboutLine: 'Math Farm v{v} · family use · runs fully offline', checkUpdate: '🔄 Check for updates',
    whichIs: 'Which one is {n}?', whichIsSpoken: 'Which one is the number {n}?', copyDigit: 'Copy the number {n}', copyDigitSpoken: 'Write the number {n}', listen: '🔊 Listen again',
    tryAgainPick: 'Think again and pick once more 👆', tryAgainSpoken: 'Try again', thatIs: 'This is {n}', wellDone: 'Well done!', isThis: 'It is this one, {n}', littleIntro: 'Listen and pick the right number, or copy the number. +{n} 🪙 per correct answer; you get a second try.',
    mathMode: '🧮 Math mode', modeAuto: 'By age (under 5: listen & pick / copy)', modeLittle: 'Listen & pick / copy', modeBig: 'Handwritten sums',
    voice: '🗣️ Voice', voiceHint: 'Uses the built-in system voices. For a more natural voice: Settings › Accessibility › Spoken Content › Voices › download an “Enhanced” or “Premium” voice (e.g. Ava, Tingting), then pick it here. Siri voices are not available to web apps.',
    voiceTest: 'Test', noVoices: 'No voice available for this language', speechRate: 'Speed', slow: 'Slow', normalRate: 'Medium', fast: 'Normal',
    sec: '{n} s', min: '{n} min', hour: '{n} h', hourMin: '{h} h {m} min', dayHour: '{d} d {h} h',
  },
};

export const lang = () => (setting('lang') === 'en' ? 'en' : 'zh');
export function setLang(l) { setSetting('lang', l); document.documentElement.lang = l === 'en' ? 'en' : 'zh-CN'; }
export function t(key, params = {}) {
  let s = DICT[lang()][key] ?? DICT.zh[key] ?? key;
  if (Array.isArray(s)) return s;
  for (const [k, v] of Object.entries(params)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return s;
}
/** 数据对象的名字：{ name, nameEn } */
export const name = (obj) => (lang() === 'en' ? (obj?.nameEn || obj?.name) : obj?.name) || '';
export const desc = (obj) => (lang() === 'en' ? (obj?.descEn || obj?.desc) : obj?.desc) || '';
export const pickLine = (key) => { const arr = t(key); return arr[Math.floor(Math.random() * arr.length)]; };
