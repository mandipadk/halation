import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react"

const listeners = new Set<() => void>()

export function navigate(to: string) {
  if (to === location.pathname + location.hash) return
  history.pushState(null, "", to)
  listeners.forEach((l) => l())
  if (!to.includes("#")) window.scrollTo({ top: 0 })
  // A new page takes focus, as a page load would: the link clicked doesn't keep it.
  requestAnimationFrame(() => document.getElementById("main")?.focus({ preventScroll: true }))
}

export function usePath() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const update = () => setPath(location.pathname)
    listeners.add(update)
    addEventListener("popstate", update)
    return () => {
      listeners.delete(update)
      removeEventListener("popstate", update)
    }
  }, [])
  return path
}

/** A link that stays in the app. */
export function Link({ href = "/", onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e)
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || !href.startsWith("/")) return
        e.preventDefault()
        navigate(href)
      }}
      {...rest}
    />
  )
}
