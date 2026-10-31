// 圣经模块：下一阶段实现。这里先放一个“正在建设中”的占位页。
import { h, screen, bigButton } from '../../js/ui.js';
import { sayZh } from '../../js/speech.js';

export default {
  id: 'bible',
  name: '圣经',
  icon: '📖',
  color: 'var(--c-bible)',
  activities: [],
  mount({ goHome }) {
    const ui = screen({ title: '📖 圣经', onBack: goHome });
    ui.body.append(h('div', { class: 'wip' },
      h('div', { class: 'big-emoji' }, '🚧'),
      h('div', { class: 'text' }, '这里还在准备中'),
      bigButton('🏠 先玩别的', goHome),
    ));
    sayZh('这里还在准备中，先玩别的吧！');
  },
};
