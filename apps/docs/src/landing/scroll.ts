import { useEffect, useRef, useState } from "react"

/**
 * Whether an element has come into view, once. Sequences start from this and
 * play through a single time; nothing on the page loops while nobody's looking.
 */
export function useSeen<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        setSeen(true)
        io.disconnect()
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, seen] as const
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches
