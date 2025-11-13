let counter = 0

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID()
    } catch {
      // fall back to counter-based id
    }
  }

  counter += 1
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${counter}-${rand}`
}
