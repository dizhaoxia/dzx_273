export const COLLABORATOR_COLORS = [
  '#f97316',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
];

const USER_NAMES = [
  '狐狸',
  '小熊猫',
  '水獭',
  '雪狐',
  '企鹅',
  '海豚',
  '猫头鹰',
  '考拉',
  '树懒',
  '小浣熊',
];

function stringToHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
  const char = str.charCodeAt(i);
  hash = (hash << 5) - hash + char;
  hash = hash & hash;
}
  return Math.abs(hash);
}

export function getColorForId(userId: string, existingColors: string[] = []): string {
  const idx = stringToHashCode(userId) % COLLABORATOR_COLORS.length;
  let color = COLLABORATOR_COLORS[idx];

  if (existingColors.includes(color)) {
    color = COLLABORATOR_COLORS.find((c) => !existingColors.includes(c)) || color;
  }

  return color;
}

export function getRandomName(): string {
  return USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)];
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
