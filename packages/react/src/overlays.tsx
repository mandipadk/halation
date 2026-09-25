import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { Drawer as BaseDrawer } from "@base-ui/react/drawer"
import { Menu as BaseMenu } from "@base-ui/react/menu"
import { Popover as BasePopover } from "@base-ui/react/popover"
import { Select as BaseSelect } from "@base-ui/react/select"
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip"
import type { ComponentProps, ReactElement, ReactNode } from "react"
import { cx } from "./cx.ts"
import { CheckIcon, ChevronIcon } from "./icons.tsx"
import { Keys } from "./keys.tsx"

/* Menu: grows out of the control that opened it ("unfold"). */
export const Menu = {
  Root: BaseMenu.Root,
  Trigger: BaseMenu.Trigger,
  Popup({ className, children, side = "bottom", align = "start", sideOffset = 6 }: { className?: string; children: ReactNode; side?: "top" | "bottom" | "left" | "right"; align?: "start" | "center" | "end"; sideOffset?: number }) {
    return (
      <BaseMenu.Portal>
        <BaseMenu.Positioner side={side} align={align} sideOffset={sideOffset}>
          <BaseMenu.Popup className={cx("hl-popup", className)} style={{ minWidth: 200 }}>
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    )
  },
  Item({ icon, keys, tone, className, children, ...rest }: { icon?: ReactNode; keys?: string[]; tone?: "critical" } & Omit<ComponentProps<typeof BaseMenu.Item>, "className"> & { className?: string }) {
    return (
      <BaseMenu.Item className={cx("hl-menu-item", className)} data-tone={tone} {...rest}>
        {icon}
        {children}
        {keys ? <Keys keys={keys} /> : null}
      </BaseMenu.Item>
    )
  },
  Separator() {
    return <BaseMenu.Separator className="hl-menu-separator" />
  },
  Group: BaseMenu.Group,
  GroupLabel({ className, ...rest }: Omit<ComponentProps<typeof BaseMenu.GroupLabel>, "className"> & { className?: string }) {
    return <BaseMenu.GroupLabel className={cx("hl-menu-group-label", className)} {...rest} />
  },
}

export const Popover = {
  Root: BasePopover.Root,
  Trigger: BasePopover.Trigger,
  Popup({ title, description, className, children, side = "bottom", align = "center", sideOffset = 8 }: { title?: ReactNode; description?: ReactNode; className?: string; children?: ReactNode; side?: "top" | "bottom" | "left" | "right"; align?: "start" | "center" | "end"; sideOffset?: number }) {
    return (
      <BasePopover.Portal>
        <BasePopover.Positioner side={side} align={align} sideOffset={sideOffset}>
          <BasePopover.Popup className={cx("hl-popup hl-popover", className)}>
            {title ? <BasePopover.Title className="hl-popover-title">{title}</BasePopover.Title> : null}
            {description ? <BasePopover.Description className="hl-popover-description">{description}</BasePopover.Description> : null}
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    )
  },
  Close: BasePopover.Close,
}

/** Tooltips wait 500 ms the first time, then open at once while you move between them. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <BaseTooltip.Provider delay={500} closeDelay={0} timeout={300}>
      {children}
    </BaseTooltip.Provider>
  )
}

export function Tooltip({ content, keys, children, side = "top" }: { content: ReactNode; keys?: string[]; children: ReactElement; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={8}>
          <BaseTooltip.Popup className="hl-popup hl-tooltip">
            {content}
            {keys ? <Keys keys={keys} /> : null}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}

/** A select with a simple list of options. */
export function Select<T extends string>({ options, value, defaultValue, onValueChange, placeholder = "Choose", "aria-label": label, className }: { options: { value: T; label: ReactNode }[]; value?: T; defaultValue?: T; onValueChange?: (value: T) => void; placeholder?: ReactNode; "aria-label"?: string; className?: string }) {
  return (
    <BaseSelect.Root value={value} defaultValue={defaultValue} onValueChange={(v) => onValueChange?.(v as T)} items={options}>
      <BaseSelect.Trigger className={cx("hl-select-trigger", className)} aria-label={label}>
        <BaseSelect.Value placeholder={placeholder} />
        <BaseSelect.Icon>
          <ChevronIcon />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false}>
          <BaseSelect.Popup className="hl-popup hl-select-popup">
            <BaseSelect.List>
              {options.map((o) => (
                <BaseSelect.Item key={o.value} value={o.value} className="hl-select-item">
                  <BaseSelect.ItemText>{o.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="hl-select-item-indicator">
                    <CheckIcon />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}

/**
 * A dialog with the focus pull: the page behind (the element marked
 * data-hl-root, which the HalationProvider adds) softens while the dialog
 * comes into focus.
 */
export const Dialog = {
  Root: BaseDialog.Root,
  Trigger: BaseDialog.Trigger,
  Close: BaseDialog.Close,
  Popup({ title, description, actions, className, children }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string; children?: ReactNode }) {
    return (
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="hl-backdrop" />
        <BaseDialog.Popup className={cx("hl-dialog", className)}>
          <BaseDialog.Title className="hl-dialog-title">{title}</BaseDialog.Title>
          {description ? <BaseDialog.Description className="hl-dialog-description">{description}</BaseDialog.Description> : null}
          {children}
          {actions ? <div className="hl-dialog-actions">{actions}</div> : null}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    )
  },
}

/** A sheet you can pull away; a flick is enough (Base UI's drawer). */
export const Sheet = {
  Root({ side = "bottom", ...rest }: { side?: "bottom" | "right" } & Omit<ComponentProps<typeof BaseDrawer.Root>, "className"> & { className?: string }) {
    return <BaseDrawer.Root swipeDirection={side === "right" ? "right" : "down"} {...rest} />
  },
  Trigger: BaseDrawer.Trigger,
  Close: BaseDrawer.Close,
  Popup({ title, description, side = "bottom", className, children }: { title: ReactNode; description?: ReactNode; side?: "bottom" | "right"; className?: string; children?: ReactNode }) {
    return (
      <BaseDrawer.Portal>
        <BaseDrawer.Backdrop className="hl-sheet-backdrop" />
        <BaseDrawer.Viewport className="hl-sheet-viewport" data-side={side}>
          <BaseDrawer.Popup className={cx("hl-sheet", className)}>
            {side === "bottom" ? <span className="hl-sheet-handle" aria-hidden /> : null}
            <BaseDrawer.Content>
              <BaseDrawer.Title className="hl-dialog-title">{title}</BaseDrawer.Title>
              {description ? <BaseDrawer.Description className="hl-dialog-description">{description}</BaseDrawer.Description> : null}
              {children}
            </BaseDrawer.Content>
          </BaseDrawer.Popup>
        </BaseDrawer.Viewport>
      </BaseDrawer.Portal>
    )
  },
}
