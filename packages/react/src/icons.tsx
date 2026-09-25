import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement>
const base = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true }

export const CheckIcon = (p: IconProps) => (
  <svg viewBox="0 0 12 12" strokeWidth={1.8} {...base} {...p}>
    <path d="m2.5 6.3 2.2 2.2 4.8-5" />
  </svg>
)
export const PlayIcon = (p: IconProps) => (
  <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden {...p}>
    <path d="M3.5 2.2v7.6a.5.5 0 0 0 .77.42l5.9-3.8a.5.5 0 0 0 0-.84l-5.9-3.8a.5.5 0 0 0-.77.42Z" />
  </svg>
)
export const WrenchIcon = (p: IconProps) => (
  <svg viewBox="0 0 12 12" strokeWidth={1.5} {...base} {...p}>
    <path d="M7.6 1.8a2.6 2.6 0 0 0-3 3.4L1.8 8a1.2 1.2 0 0 0 1.7 1.7l2.8-2.8a2.6 2.6 0 0 0 3.4-3L8.3 5.3 6.9 5.1 6.7 3.7Z" />
  </svg>
)
export const StopIcon = (p: IconProps) => (
  <svg viewBox="0 0 12 12" strokeWidth={1.5} {...base} {...p}>
    <path d="M4.2 1.5h3.6l2.7 2.7v3.6l-2.7 2.7H4.2L1.5 7.8V4.2Z" />
    <path d="m4.6 4.6 2.8 2.8M7.4 4.6 4.6 7.4" />
  </svg>
)
export const PencilIcon = (p: IconProps) => (
  <svg viewBox="0 0 12 12" strokeWidth={1.5} {...base} {...p}>
    <path d="M7.9 2.1 9.9 4.1 4.4 9.6 2 10l.4-2.4Z" />
  </svg>
)
export const InfoIcon = (p: IconProps) => (
  <svg viewBox="0 0 12 12" strokeWidth={1.5} {...base} {...p}>
    <circle cx="6" cy="6" r="4.6" />
    <path d="M6 5.4v3M6 3.6h.01" />
  </svg>
)
export const AlertIcon = (p: IconProps) => (
  <svg viewBox="0 0 16 16" strokeWidth={1.6} {...base} {...p}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 4.8v3.6M8 11h.01" />
  </svg>
)
export const ChevronIcon = (p: IconProps) => (
  <svg viewBox="0 0 16 16" strokeWidth={1.6} {...base} {...p}>
    <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
  </svg>
)
export const CloseIcon = (p: IconProps) => (
  <svg viewBox="0 0 16 16" strokeWidth={1.6} {...base} {...p}>
    <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
  </svg>
)
