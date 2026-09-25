import { Avatar as BaseAvatar } from "@base-ui/react/avatar"
import { useEffect, useRef, type ComponentProps } from "react"
import { cx } from "./cx.ts"
import { rise } from "@halation/core/motion"

export function Avatar({ src, name, className }: { src?: string; name: string; className?: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
  return (
    <BaseAvatar.Root className={cx("hl-avatar", className)}>
      {src ? <BaseAvatar.Image src={src} alt={name} /> : null}
      <BaseAvatar.Fallback>{initials}</BaseAvatar.Fallback>
    </BaseAvatar.Root>
  )
}

/** A still placeholder. It doesn't shimmer: nothing moves while idle (rule R14). */
export function Skeleton({ width, height = 12, className, style, ...rest }: { width?: number | string; height?: number | string } & ComponentProps<"span">) {
  return <span className={cx("hl-skeleton", className)} style={{ width, height, ...style }} aria-hidden {...rest} />
}

/** A number whose digits roll to each new value, right to left. */
export function Count({ value, format = (n: number) => n.toLocaleString(), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const text = format(value)
  return (
    <span className={cx("hl-count", className)} role="status" aria-label={text}>
      {[...text].map((ch, i) =>
        /\d/.test(ch) ? (
          <span className="hl-count-digit" key={`${text.length}-${i}`} aria-hidden>
            <span className="hl-count-reel" style={{ transform: `translateY(${-Number(ch) * 10}%)`, transitionDelay: `${(text.length - i) * 18}ms` }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={`${text.length}-${i}`} aria-hidden>
            {ch}
          </span>
        ),
      )}
    </span>
  )
}

/** Content arrives in reading order out of a soft blur, once, when it's first seen. */
export function Rise({ as: Tag = "div", className, children, ...rest }: { as?: "div" | "section" | "header" | "main" } & ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const items = el.querySelectorAll<HTMLElement>(":scope > *")
    items.forEach((i) => (i.style.opacity = "0.1"))
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      items.forEach((i) => (i.style.opacity = ""))
      rise(items)
      observer.disconnect()
    }, { threshold: 0.2 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  )
}
