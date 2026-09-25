import { Field as BaseField } from "@base-ui/react/field"
import { Input as BaseInput } from "@base-ui/react/input"
import type { ComponentProps, ReactNode } from "react"
import { cx } from "./cx.ts"
import { AlertIcon } from "./icons.tsx"

/**
 * A labelled control with an optional description and error. Errors say
 * what went wrong and how to fix it.
 */
export function Field({ label, description, error, invalid, className, children, ...rest }: { label: ReactNode; description?: ReactNode; error?: ReactNode; invalid?: boolean; children: ReactNode; className?: string } & Omit<ComponentProps<typeof BaseField.Root>, "children" | "className">) {
  return (
    <BaseField.Root className={cx("hl-field", className)} invalid={invalid ?? Boolean(error)} {...rest}>
      <BaseField.Label className="hl-label">{label}</BaseField.Label>
      {children}
      {description && !error ? <BaseField.Description className="hl-description">{description}</BaseField.Description> : null}
      {error ? (
        <BaseField.Error className="hl-error" match={true}>
          <AlertIcon />
          {error}
        </BaseField.Error>
      ) : null}
    </BaseField.Root>
  )
}

export function Input({ className, ...rest }: Omit<ComponentProps<typeof BaseInput>, "className"> & { className?: string }) {
  return <BaseInput className={cx("hl-input", className)} {...rest} />
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <BaseField.Control render={<textarea className={cx("hl-textarea", className)} {...rest} />} />
}
