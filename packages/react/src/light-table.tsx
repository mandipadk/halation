import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react"
import { cx } from "./cx.ts"

export type Print = { src: string; name: string; caption?: string }

/** Grain for a print, seeded by its name, so each has a batch of its own. */
function grain(canvas: HTMLCanvasElement | null, name: string) {
  const g = canvas?.getContext("2d")
  if (!canvas || !g) return
  const image = g.createImageData(canvas.width, canvas.height)
  let s = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  for (let i = 0; i < image.data.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0
    const v = 70 + (s / 4294967296) * 110
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v
    image.data[i + 3] = 255
  }
  g.putImageData(image, 0, 0)
}

function PrintOn({ print, index, developing }: { print: Print; index: number; developing: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => grain(canvas.current, print.name), [print.name])
  const spread = Math.min(index, 4)
  const tilt = ((print.name.length * 37 + index * 53) % 100) / 10 - 5
  return (
    <figure className="hl-print" data-developing={developing ? "" : undefined} style={{ ["--r" as string]: `${tilt.toFixed(1)}deg`, ["--dx" as string]: `${(spread % 2 ? 1 : -1) * spread * 34}px`, ["--dy" as string]: `${(spread % 3) * 14 - 14}px` }}>
      <img src={print.src} alt={print.name} />
      <canvas ref={canvas} width={300} height={225} aria-hidden="true" />
      <figcaption>
        <span>{print.name}</span>
        <span>{print.caption}</span>
      </figcaption>
    </figure>
  )
}

const size = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`)

/**
 * Light table: a drop zone that behaves like one. It backlights where a file
 * hovers, and dropped photos land as prints that develop on their own grain.
 */
export function LightTable({
  onFiles,
  accept = "image/*",
  initial = [],
  keep = 5,
  children,
  className,
}: {
  onFiles?: (files: File[]) => void
  accept?: string
  /** Prints already on the table. */
  initial?: Print[]
  /** How many prints stay on the table before the oldest is lifted off. */
  keep?: number
  /** What the table says, bottom left: "Drop a photo" by default. */
  children?: ReactNode
  className?: string
}) {
  const [prints, setPrints] = useState<(Print & { key: number; fresh: boolean })[]>(() => initial.map((p, i) => ({ ...p, key: i, fresh: false })))
  const [over, setOver] = useState(false)
  const table = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const next = useRef(initial.length)

  const lay = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"))
    onFiles?.(files)
    if (!images.length) return
    const added = images.slice(0, 4).map((f) => ({ src: URL.createObjectURL(f), name: f.name, caption: size(f.size), key: next.current++, fresh: true }))
    setPrints((p) => [...p, ...added].slice(-keep))
    setTimeout(() => setPrints((p) => p.map((x) => ({ ...x, fresh: false }))), 2000)
  }
  const aim = (e: DragEvent) => {
    const b = table.current!.getBoundingClientRect()
    table.current!.style.setProperty("--x", `${e.clientX - b.left}px`)
    table.current!.style.setProperty("--y", `${e.clientY - b.top}px`)
  }
  return (
    <div
      ref={table}
      className={cx("hl-lighttable", className)}
      data-over={over ? "" : undefined}
      tabIndex={0}
      role="button"
      aria-label="Drop photos here, or press to choose one"
      onClick={() => input.current?.click()}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        input.current?.click()
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        setOver(true)
        aim(e)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        aim(e)
      }}
      onDragLeave={(e) => {
        if (!table.current?.contains(e.relatedTarget as Node)) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        lay([...e.dataTransfer.files])
      }}
    >
      {prints.map((p, i) => (
        <PrintOn key={p.key} print={p} index={i} developing={p.fresh} />
      ))}
      <p className="hl-lighttable-say">
        <span>
          {children ?? (
            <>
              <b>Drop a photo</b> anywhere on the table, or click to choose one
            </>
          )}
        </span>
        <span>
          {prints.length} print{prints.length === 1 ? "" : "s"}
        </span>
      </p>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => {
          lay([...(e.target.files ?? [])])
          e.target.value = ""
        }}
      />
    </div>
  )
}
