import { Button, Dialog, Field, Input } from "@halation/react"
import { useState, type FormEvent } from "react"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (title: string) => void
}

/** A dialog is its own view, so its one main action is ink. */
export function NewTaskDialog({ open, onOpenChange, onAdd }: Props) {
  const [title, setTitle] = useState("")
  const [error, setError] = useState<string>()

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) setError(undefined)
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = title.trim()
    if (!name) {
      setError("Give the task a name first, for example “Write the pricing page”.")
      return
    }
    onAdd(name)
    setTitle("")
    close(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Popup
        title="Add a task"
        description="It goes to the end of the checklist."
        actions={
          <>
            <Dialog.Close render={<Button variant="ghost" />}>Cancel</Dialog.Close>
            <Button variant="ink" type="submit" form="new-task">
              Add task
            </Button>
          </>
        }
      >
        <form id="new-task" onSubmit={submit} noValidate>
          <Field label="Task" error={error}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Write the pricing page" autoFocus />
          </Field>
        </form>
      </Dialog.Popup>
    </Dialog.Root>
  )
}
