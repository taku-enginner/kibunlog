export const MOOD_THRESHOLDS = { best: 9, good: 7, neutral: 5, bad: 3 } as const

export const moodConfig: Record<number, { emoji: string; label: string; bg: string; color: string }> = {
  10: { emoji: '🤩', label: '最高',       bg: '#a5d6a7', color: '#1b5e20' },
  9:  { emoji: '😄', label: 'すごく良い',  bg: '#c8e6c9', color: '#2e7d32' },
  8:  { emoji: '😊', label: '良い',       bg: '#d4edda', color: '#155724' },
  7:  { emoji: '🙂', label: 'まあ良い',    bg: '#e8f5e9', color: '#388e3c' },
  6:  { emoji: '😐', label: '普通',       bg: '#fff9c4', color: '#856404' },
  5:  { emoji: '😶', label: '微妙',       bg: '#fff3cd', color: '#946d00' },
  4:  { emoji: '😟', label: 'ちょい辛',    bg: '#ffe0b2', color: '#c84a00' },
  3:  { emoji: '😣', label: 'いまいち',    bg: '#f8d7da', color: '#721c24' },
  2:  { emoji: '😖', label: 'しんどい',    bg: '#f5c6cb', color: '#491217' },
  1:  { emoji: '😵', label: '限界',       bg: '#ef9a9a', color: '#311111' },
}

export const moodOptions = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(level => ({ level, ...moodConfig[level] }))

export function moodEmoji(level: number): string {
  const { best, good, neutral, bad } = MOOD_THRESHOLDS
  if (level >= best) return '😆'
  if (level >= good) return '😊'
  if (level >= neutral) return '😐'
  if (level >= bad) return '😣'
  return '😵'
}

export function moodLabel(level: number): string {
  const { best, good, neutral, bad } = MOOD_THRESHOLDS
  if (level >= best) return '最高'
  if (level >= good) return '良い'
  if (level >= neutral) return '普通'
  if (level >= bad) return 'いまいち'
  return 'しんどい'
}

// 個別エントリ・棒グラフ等の vivid カラー（null は灰色）
export function moodLevelColor(level: number | null): string {
  if (level == null) return '#ccc'
  const { best, good, neutral, bad } = MOOD_THRESHOLDS
  if (level >= best) return '#1b5e20'
  if (level >= good) return '#28a745'
  if (level >= neutral) return '#ffc107'
  if (level >= bad) return '#dc3545'
  return '#491217'
}
