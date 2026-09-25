import { Slider as BaseSlider } from "@base-ui/react/slider"
import { Tabs as BaseTabs } from "@base-ui/react/tabs"
import { Toggle } from "@base-ui/react/toggle"
import { ToggleGroup } from "@base-ui/react/toggle-group"
import type { ComponentProps, ReactNode } from "react"
import { cx } from "./cx.ts"

export function Slider({ className, ...rest }: Omit<ComponentProps<typeof BaseSlider.Root>, "className"> & { className?: string }) {
  return (
    <BaseSlider.Root className={cx("hl-slider", className)} {...rest}>
      <BaseSlider.Control>
        <BaseSlider.Track className="hl-slider-track">
          <BaseSlider.Indicator className="hl-slider-indicator" />
          <BaseSlider.Thumb className="hl-slider-thumb" />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}

/** One choice out of a few, side by side. */
export function SegmentedControl<T extends string>({ options, value, defaultValue, onValueChange, className, "aria-label": label }: { options: { value: T; label: ReactNode }[]; value?: T; defaultValue?: T; onValueChange?: (value: T) => void; className?: string; "aria-label"?: string }) {
  return (
    <ToggleGroup
      className={cx("hl-segmented", className)}
      aria-label={label}
      value={value === undefined ? undefined : [value]}
      defaultValue={defaultValue === undefined ? undefined : [defaultValue]}
      onValueChange={(next) => next[0] !== undefined && onValueChange?.(next[0] as T)}
    >
      {options.map((o) => (
        <Toggle key={o.value} value={o.value} className="hl-segment">
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}

/** Tabs whose indicator glides between them (the in-out curve). */
export const Tabs = {
  Root: BaseTabs.Root,
  List({ className, children, ...rest }: Omit<ComponentProps<typeof BaseTabs.List>, "className"> & { className?: string }) {
    return (
      <BaseTabs.List className={cx("hl-tabs-list", className)} {...rest}>
        {children}
        <BaseTabs.Indicator className="hl-tabs-indicator" />
      </BaseTabs.List>
    )
  },
  Tab({ className, ...rest }: Omit<ComponentProps<typeof BaseTabs.Tab>, "className"> & { className?: string }) {
    return <BaseTabs.Tab className={cx("hl-tab", className)} {...rest} />
  },
  Panel({ className, ...rest }: Omit<ComponentProps<typeof BaseTabs.Panel>, "className"> & { className?: string }) {
    return <BaseTabs.Panel className={cx("hl-tabs-panel", className)} {...rest} />
  },
}
