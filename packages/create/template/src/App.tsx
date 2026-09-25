import { Button, Count, Facts, Heading, Keys, List, ListRow, Rise, Seal, Serif, Stage, State, Surface, Text, useToast, type StateKind } from "@halation/react"
import { useEffect, useState } from "react"
import { NewTaskDialog } from "./NewTaskDialog.tsx"
import { project } from "./project.ts"

type Task = { id: number; title: string; detail: string; status: "done" | "doing" | "todo" }

const STATUS: Record<Task["status"], { kind: StateKind; label: string }> = {
  done: { kind: "done", label: "Done" },
  doing: { kind: "running", label: "In progress" },
  todo: { kind: "draft", label: "Not started" },
}

const light = project.phenomenon[0].toUpperCase() + project.phenomenon.slice(1)

const FIRST_TASKS: Task[] = [
  { id: 1, title: "Name the project", detail: "It lives in src/project.ts", status: "done" },
  { id: 2, title: "Choose the light behind the opening", detail: `${light}, following the visitor's time of day`, status: "done" },
  { id: 3, title: "Write the first real page", detail: "Replace this one in src/App.tsx", status: "doing" },
  { id: 4, title: "Check the house rules", detail: "pnpm lint reads src and says what to fix", status: "todo" },
]

export function App() {
  const toast = useToast()
  const [tasks, setTasks] = useState(FIRST_TASKS)
  const [adding, setAdding] = useState(false)
  const done = tasks.filter((t) => t.status === "done").length

  // N adds a task from anywhere on the page, unless you're typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || adding) return
      const target = e.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return
      e.preventDefault()
      setAdding(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [adding])

  const addTask = (title: string) => {
    setTasks((all) => [...all, { id: Date.now(), title, detail: "Added just now", status: "todo" }])
    toast({ title: "Task added", description: title, type: "success" })
  }

  const markDone = (task: Task) => {
    setTasks((all) => all.map((t) => (t.id === task.id ? { ...t, status: "done" } : t)))
    toast({ title: "Marked done", description: task.title, type: "success" })
  }

  return (
    <>
      <Stage phenomenon={project.phenomenon} daylight className="hero">
        <Rise className="hero-copy" data-quiet="">
          <Heading level={1} data-press={project.phenomenon === "foil" ? "" : undefined}>
            <Serif>{project.name}</Serif> starts here
          </Heading>
          <Text size="body-lg" tone="muted" className="lead">
            A React app with Halation already in place: the styles, the components, and the rules that keep every page consistent. Edit src/App.tsx and this page changes as you save.
          </Text>
          <div className="actions">
            <Button variant="ink" shape="pill" size="lg" onClick={() => setAdding(true)}>
              Add a task
            </Button>
            <Button shape="pill" size="lg" onClick={() => document.getElementById("checklist")?.scrollIntoView({ behavior: "smooth" })}>
              Go to the checklist
            </Button>
          </div>
        </Rise>
      </Stage>

      <main className="page">
        <section id="checklist" className="checklist" aria-labelledby="checklist-title">
          <div className="section-head">
            <Heading level={2} size="title-2" id="checklist-title">
              Getting started
            </Heading>
            <Text size="body-sm" tone="muted">
              <Count value={done} /> of {tasks.length} done
            </Text>
          </div>
          <Surface elevation="raised" padding="none">
            <List>
              {tasks.map((task) => (
                <ListRow
                  key={task.id}
                  title={task.title}
                  detail={task.detail}
                  trailing={
                    <div className="row-end">
                      {task.status === "done" ? null : (
                        <Button variant="ghost" size="sm" onClick={() => markDone(task)}>
                          Mark done
                        </Button>
                      )}
                      <State kind={STATUS[task.status].kind}>{STATUS[task.status].label}</State>
                    </div>
                  }
                />
              ))}
            </List>
          </Surface>
          <Text size="caption" tone="muted">
            Press <Keys keys={["N"]} /> to add a task from anywhere on the page.
          </Text>
        </section>

        <aside className="about" aria-labelledby="about-title">
          <Heading level={2} size="title-3" id="about-title">
            About this project
          </Heading>
          <Facts
            items={[
              ["Name", project.name],
              ["Light", light],
              ["Built with", "React, Vite and Halation"],
              ["House rules", "Checked by pnpm lint"],
            ]}
          />
        </aside>
      </main>

      <footer className="footer">
        <Seal name={project.name} size={32} />
        <Text size="caption" tone="muted">
          This seal is drawn from the project's name. Hold <Keys keys={["Alt", "Shift"]} /> and click it to see how the page is put together.
        </Text>
      </footer>

      <NewTaskDialog open={adding} onOpenChange={setAdding} onAdd={addTask} />
    </>
  )
}
