// 头像：12 个自绘 SVG（6 个人物 + 6 个动物），用参数生成，没有版权问题。
const FACE = (skin, hair, hairColor, shirt, extra = '') => `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="48" fill="${shirt}22"/>
  <path d="M18 100 Q50 70 82 100 Z" fill="${shirt}"/>
  <circle cx="50" cy="46" r="26" fill="${skin}"/>
  ${hair === 'short' ? `<path d="M24 44 Q26 18 50 18 Q74 18 76 44 Q66 30 50 32 Q34 30 24 44 Z" fill="${hairColor}"/>` : ''}
  ${hair === 'long' ? `<path d="M22 70 Q18 20 50 18 Q82 20 78 70 L70 68 Q72 40 50 36 Q28 40 30 68 Z" fill="${hairColor}"/>` : ''}
  ${hair === 'bun' ? `<circle cx="50" cy="20" r="11" fill="${hairColor}"/><path d="M24 44 Q26 20 50 20 Q74 20 76 44 Q66 30 50 32 Q34 30 24 44 Z" fill="${hairColor}"/>` : ''}
  ${hair === 'curly' ? `<circle cx="30" cy="34" r="11" fill="${hairColor}"/><circle cx="42" cy="24" r="12" fill="${hairColor}"/><circle cx="58" cy="24" r="12" fill="${hairColor}"/><circle cx="70" cy="34" r="11" fill="${hairColor}"/>` : ''}
  ${hair === 'bob' ? `<path d="M22 58 Q18 18 50 18 Q82 18 78 58 L72 58 Q74 36 50 34 Q26 36 28 58 Z" fill="${hairColor}"/>` : ''}
  ${hair === 'spiky' ? `<path d="M26 42 L30 20 L38 34 L46 14 L54 34 L62 16 L70 34 L74 20 L76 42 Q50 30 26 42 Z" fill="${hairColor}"/>` : ''}
  <circle cx="40" cy="47" r="3.2" fill="#3A2E28"/><circle cx="60" cy="47" r="3.2" fill="#3A2E28"/>
  <circle cx="33" cy="56" r="4" fill="#FF9BAE" opacity=".5"/><circle cx="67" cy="56" r="4" fill="#FF9BAE" opacity=".5"/>
  <path d="M42 58 Q50 66 58 58" stroke="#3A2E28" stroke-width="3" fill="none" stroke-linecap="round"/>
  ${extra}
</svg>`;

const ANIMAL = {
  rabbit: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#FFE3EA"/>
    <ellipse cx="36" cy="22" rx="9" ry="22" fill="#fff"/><ellipse cx="64" cy="22" rx="9" ry="22" fill="#fff"/><ellipse cx="36" cy="24" rx="4" ry="15" fill="#FFB7C5"/><ellipse cx="64" cy="24" rx="4" ry="15" fill="#FFB7C5"/>
    <circle cx="50" cy="56" r="28" fill="#fff"/><circle cx="40" cy="52" r="3.5" fill="#3A2E28"/><circle cx="60" cy="52" r="3.5" fill="#3A2E28"/>
    <ellipse cx="50" cy="62" rx="4" ry="3" fill="#FF8FA3"/><path d="M50 65 L50 70 M44 72 Q50 76 56 72" stroke="#3A2E28" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
  cat: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#FFF0C8"/>
    <path d="M24 44 L26 14 L46 30 Z" fill="#F7B267"/><path d="M76 44 L74 14 L54 30 Z" fill="#F7B267"/>
    <circle cx="50" cy="56" r="28" fill="#F7B267"/><circle cx="40" cy="52" r="3.5" fill="#3A2E28"/><circle cx="60" cy="52" r="3.5" fill="#3A2E28"/>
    <path d="M47 62 L53 62 L50 66 Z" fill="#E07A5F"/><path d="M50 66 Q44 72 40 68 M50 66 Q56 72 60 68" stroke="#3A2E28" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M20 58 L36 60 M20 66 L36 64 M80 58 L64 60 M80 66 L64 64" stroke="#3A2E28" stroke-width="2" stroke-linecap="round"/></svg>`,
  dog: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#E6F2FF"/>
    <ellipse cx="26" cy="46" rx="11" ry="20" fill="#8C5E3C"/><ellipse cx="74" cy="46" rx="11" ry="20" fill="#8C5E3C"/>
    <circle cx="50" cy="54" r="28" fill="#D9A46C"/><ellipse cx="50" cy="64" rx="14" ry="11" fill="#F5E2C8"/>
    <circle cx="40" cy="48" r="3.5" fill="#3A2E28"/><circle cx="60" cy="48" r="3.5" fill="#3A2E28"/>
    <ellipse cx="50" cy="60" rx="5" ry="4" fill="#3A2E28"/><path d="M44 70 Q50 75 56 70" stroke="#3A2E28" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
  panda: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#E3F7D9"/>
    <circle cx="28" cy="30" r="11" fill="#3A2E28"/><circle cx="72" cy="30" r="11" fill="#3A2E28"/>
    <circle cx="50" cy="54" r="28" fill="#fff"/><ellipse cx="39" cy="50" rx="8" ry="10" fill="#3A2E28" transform="rotate(-15 39 50)"/><ellipse cx="61" cy="50" rx="8" ry="10" fill="#3A2E28" transform="rotate(15 61 50)"/>
    <circle cx="40" cy="50" r="3" fill="#fff"/><circle cx="60" cy="50" r="3" fill="#fff"/>
    <ellipse cx="50" cy="64" rx="5" ry="4" fill="#3A2E28"/><path d="M44 71 Q50 75 56 71" stroke="#3A2E28" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
  fox: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#FFE8D6"/>
    <path d="M22 50 L24 12 L48 30 Z" fill="#F08A4B"/><path d="M78 50 L76 12 L52 30 Z" fill="#F08A4B"/>
    <path d="M22 50 Q50 20 78 50 Q78 80 50 84 Q22 80 22 50 Z" fill="#F08A4B"/><path d="M34 60 Q50 90 66 60 Q50 70 34 60 Z" fill="#fff"/>
    <circle cx="40" cy="52" r="3.5" fill="#3A2E28"/><circle cx="60" cy="52" r="3.5" fill="#3A2E28"/><ellipse cx="50" cy="70" rx="4.5" ry="3.5" fill="#3A2E28"/></svg>`,
  chick: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="48" fill="#FFF6C8"/>
    <circle cx="50" cy="56" r="28" fill="#FFD93D"/><path d="M44 28 Q50 16 56 28" stroke="#FFB300" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="40" cy="52" r="3.5" fill="#3A2E28"/><circle cx="60" cy="52" r="3.5" fill="#3A2E28"/>
    <path d="M44 62 L56 62 L50 70 Z" fill="#F08A4B"/><circle cx="32" cy="62" r="4" fill="#FF9BAE" opacity=".6"/><circle cx="68" cy="62" r="4" fill="#FF9BAE" opacity=".6"/></svg>`,
};

export const AVATARS = [
  { id: 'girl1', name: '小女孩', svg: FACE('#FFD9B8', 'long', '#4A2E1E', '#FF8FA3') },
  { id: 'boy1', name: '小男孩', svg: FACE('#F5CBA7', 'short', '#2E2320', '#5AA9E6') },
  { id: 'girl2', name: '丸子头', svg: FACE('#FFE0C2', 'bun', '#3A2E28', '#C9A7FF') },
  { id: 'boy2', name: '卷发', svg: FACE('#D9A77A', 'curly', '#2E2320', '#8FD694') },
  { id: 'girl3', name: '短发', svg: FACE('#F2C9A0', 'bob', '#7A4A2E', '#FFD56B') },
  { id: 'boy3', name: '刺猬头', svg: FACE('#FFD9B8', 'spiky', '#C4813A', '#FF9F68') },
  { id: 'rabbit', name: '小兔', svg: ANIMAL.rabbit },
  { id: 'cat', name: '小猫', svg: ANIMAL.cat },
  { id: 'dog', name: '小狗', svg: ANIMAL.dog },
  { id: 'panda', name: '熊猫', svg: ANIMAL.panda },
  { id: 'fox', name: '狐狸', svg: ANIMAL.fox },
  { id: 'chick', name: '小鸡', svg: ANIMAL.chick },
];
export const avatarSvg = (id) => (AVATARS.find((a) => a.id === id) || AVATARS[0]).svg;
