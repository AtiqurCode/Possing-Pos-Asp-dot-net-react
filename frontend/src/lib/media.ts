/** Resolve product image URL for both Vite proxy and Docker nginx. */
export function mediaUrl(path?: string | null) {
  if (!path) return null
  if (path.startsWith('http')) return path
  const apiBase = import.meta.env.VITE_API_URL as string | undefined
  if (apiBase) {
    try {
      const origin = new URL(apiBase, window.location.origin).origin
      return `${origin}${path}`
    } catch {
      return path
    }
  }
  return path
}
