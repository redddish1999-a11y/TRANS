/**
 * 3 个随机单词作为 Room ID（如 tiger-blue-sky）
 * 易读、易口头传达
 */
const WORDS = [
  'tiger', 'blue', 'sky', 'river', 'storm', 'cloud', 'forest', 'moon',
  'sun', 'star', 'wave', 'fire', 'snow', 'wind', 'leaf', 'rock',
  'bird', 'fish', 'wolf', 'bear', 'deer', 'hawk', 'lion', 'fox',
  'amber', 'coral', 'ivory', 'jade', 'pearl', 'ruby', 'sage', 'mist',
  'dawn', 'dusk', 'echo', 'flame', 'frost', 'glow', 'haze', 'ice',
  'nova', 'opal', 'quartz', 'reef', 'storm', 'tide', 'vine', 'zen',
]

export function generateRoomId() {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)]
  return [pick(), pick(), pick()].join('-')
}

export function validateRoomId(id) {
  if (typeof id !== 'string') return false
  const parts = id.toLowerCase().trim().split('-')
  if (parts.length !== 3) return false
  return parts.every((p) => WORDS.includes(p))
}

export function normalizeRoomId(id) {
  return id.toLowerCase().trim()
}
