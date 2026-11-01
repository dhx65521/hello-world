// 植物各生长阶段的 SVG（自绘），按种子类型略有不同。
function leaf(x, y, w, h, rot, color = '#5FBF63') {
  return `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${h}" fill="${color}" transform="rotate(${rot} ${x} ${y})"/>`;
}
function fruits(seed, positions) {
  return positions.map(([x, y, s]) => `<text x="${x}" y="${y}" font-size="${s}" text-anchor="middle" dominant-baseline="central">${seed.emoji}</text>`).join('');
}
function flowers(color, positions) {
  return positions.map(([x, y, r]) => `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="${r * 0.4}" fill="#FFB347"/></g>`).join('');
}

/** stage 0..4 */
export function plantSvg(seed, stage) {
  const kind = seed.kind || 'bush';
  let body = '';
  if (stage === 0) {
    body = `<ellipse cx="50" cy="80" rx="14" ry="5" fill="#7A4A2A" opacity=".5"/><ellipse cx="50" cy="78" rx="5" ry="3.5" fill="#B07A45"/>`;
  } else if (stage === 1) {
    body = `<g class="sway"><path d="M50 82 Q50 70 50 62" stroke="#4FA64F" stroke-width="4" fill="none" stroke-linecap="round"/>${leaf(42, 64, 9, 5, -30)}${leaf(58, 64, 9, 5, 30)}</g>`;
  } else {
    const tall = kind === 'tall', vine = kind === 'vine', low = kind === 'low';
    const top = tall ? 22 : vine ? 60 : low ? 56 : 40;
    let stem = vine
      ? `<path d="M20 80 Q35 60 50 78 Q65 95 82 72" stroke="#4FA64F" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : `<path d="M50 84 Q50 ${top + 20} 50 ${top}" stroke="#4FA64F" stroke-width="${tall ? 5 : 4}" fill="none" stroke-linecap="round"/>`;
    let leaves = vine
      ? leaf(26, 66, 10, 6, -20) + leaf(44, 70, 10, 6, 15) + leaf(62, 86, 10, 6, -10) + leaf(78, 66, 10, 6, 25)
      : low
        ? leaf(36, 70, 11, 6, -25) + leaf(64, 70, 11, 6, 25) + leaf(40, 60, 10, 6, -45) + leaf(60, 60, 10, 6, 45)
        : leaf(38, 70, 11, 6, -30) + leaf(62, 70, 11, 6, 30) + leaf(40, 54, 11, 6, -40) + leaf(60, 54, 11, 6, 40) + (tall ? leaf(42, 38, 10, 5, -35) + leaf(58, 38, 10, 5, 35) : '');
    let extra = '';
    if (stage === 3) {
      extra = tall && seed.id === 'sunflower'
        ? `<circle cx="50" cy="24" r="14" fill="${seed.flower}"/><circle cx="50" cy="24" r="7" fill="#7A4A2A"/>`
        : flowers(seed.flower, vine ? [[30, 60, 5], [70, 62, 5]] : low ? [[36, 62, 5], [64, 62, 5], [50, 54, 5]] : [[38, 48, 5], [62, 48, 5], [50, 36, 5]]);
    } else if (stage === 4) {
      extra = fruits(seed, vine ? [[30, 72, 26], [72, 80, 26]] : low ? [[34, 72, 20], [66, 72, 20], [50, 58, 20]] : tall ? [[36, 44, 20], [64, 44, 20], [50, 28, 22]] : [[36, 60, 20], [64, 60, 20], [50, 44, 20]]);
      if (seed.id === 'sunflower') extra = fruits(seed, [[50, 24, 34], [36, 50, 22]]);
    }
    body = `<g class="sway">${stem}${leaves}${extra}</g>`;
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="plant-svg">${body}</svg>`;
}
