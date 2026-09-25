import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox"
import { Radio as BaseRadio } from "@base-ui/react/radio"
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group"
import { Switch as BaseSwitch } from "@base-ui/react/switch"
import type { ComponentProps, ReactNode } from "react"
import { cx } from "./cx.ts"
import { CheckIcon } from "./icons.tsx"

export function Checkbox({ label, className, ...rest }: { label?: ReactNode } & Omit<ComponentProps<typeof BaseCheckbox.Root>, "className"> & { className?: string }) {
  const box = (
    <BaseCheckbox.Root className={cx("hl-checkbox", className)} {...rest}>
      <BaseCheckbox.Indicator>
        <CheckIcon />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
  return label ? (
    <label className="hl-choice">
      {box}
      {label}
    </label>
  ) : (
    box
  )
}

export function RadioGroup({ className, ...rest }: Omit<ComponentProps<typeof BaseRadioGroup>, "className"> & { className?: string }) {
  return <BaseRadioGroup className={cx("hl-radio-group", className)} {...rest} />
}

export function Radio({ label, className, ...rest }: { label?: ReactNode } & Omit<ComponentProps<typeof BaseRadio.Root>, "className"> & { className?: string }) {
  const dot = <BaseRadio.Root className={cx("hl-radio", className)} {...rest} />
  return label ? (
    <label className="hl-choice">
      {dot}
      {label}
    </label>
  ) : (
    dot
  )
}

/** A switch whose thumb springs across (the "settle" move). */
export function Switch({ label, className, ...rest }: { label?: ReactNode } & Omit<ComponentProps<typeof BaseSwitch.Root>, "className"> & { className?: string }) {
  const control = (
    <BaseSwitch.Root className={cx("hl-switch", className)} {...rest}>
      <BaseSwitch.Thumb className="hl-switch-thumb" />
    </BaseSwitch.Root>
  )
  return label ? (
    <label className="hl-choice">
      {control}
      {label}
    </label>
  ) : (
    control
  )
}
