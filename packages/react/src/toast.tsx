import { Toast as BaseToast } from "@base-ui/react/toast"
import { useCallback, type ReactNode } from "react"
import { Button } from "./button.tsx"
import { AlertIcon, CheckIcon, InfoIcon } from "./icons.tsx"

/** Hosts toasts: they stack with depth and fan out when you point at them. */
export function ToastProvider({ children, timeout = 6000 }: { children: ReactNode; timeout?: number }) {
  return (
    <BaseToast.Provider timeout={timeout}>
      {children}
      <BaseToast.Portal>
        <BaseToast.Viewport className="hl-toast-viewport">
          <ToastList />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  )
}

function ToastList() {
  const { toasts } = BaseToast.useToastManager()
  return toasts.map((toast) => (
    <BaseToast.Root key={toast.id} toast={toast} className="hl-toast">
      <BaseToast.Content className="hl-toast-content">
        <span className="hl-toast-glyph" aria-hidden>
          {toast.type === "success" ? <CheckIcon /> : toast.type === "error" ? <AlertIcon /> : <InfoIcon />}
        </span>
        <div>
          <BaseToast.Title className="hl-toast-title" />
          <BaseToast.Description className="hl-toast-description" />
        </div>
        <BaseToast.Close render={<Button variant="ghost" size="sm">Dismiss</Button>} />
      </BaseToast.Content>
    </BaseToast.Root>
  ))
}

/** Adds toasts: toast({ title, description, type: "success" | "error" }). */
export function useToast() {
  const manager = BaseToast.useToastManager()
  return useCallback((options: { title: ReactNode; description?: ReactNode; type?: "success" | "error" | "info"; timeout?: number }) => manager.add(options), [manager])
}
