import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Button, Count, Facts, HalationProvider, Heading, Keys, List, ListRow, Seal, SegmentedControl, Serif, Stage, State, Switch, Text, Value } from "../src/index.ts"

afterEach(cleanup)

describe("text", () => {
  it("uses the named text styles", () => {
    render(<Text size="caption" tone="muted">Hi</Text>)
    expect(screen.getByText("Hi").className).toBe("hl-text-caption hl-tone-muted")
  })
  it("gives headings a style by level, with a serif phrase", () => {
    render(<Heading level={1}>Every app. <Serif>Twice.</Serif></Heading>)
    const h = screen.getByRole("heading", { level: 1 })
    expect(h.className).toBe("hl-text-display-xl")
    expect(h.querySelector(".hl-serif")?.textContent).toBe("Twice.")
  })
  it("sets values with a quieter unit", () => {
    render(<Value unit="MB">412</Value>)
    expect(screen.getByText("MB").tagName).toBe("SMALL")
  })
})

describe("button", () => {
  it("marks its variant and shape", () => {
    render(<Button variant="ink" shape="pill" size="lg">Go</Button>)
    const b = screen.getByRole("button", { name: "Go" })
    expect(b.dataset.variant).toBe("ink")
    expect(b.dataset.shape).toBe("pill")
    expect(b.dataset.size).toBe("lg")
    expect(b.getAttribute("type")).toBe("button")
  })
  it("swaps its label in place when busy and when done", () => {
    const { rerender } = render(<Button busyLabel="Saving" doneLabel="Saved">Save</Button>)
    const labels = () => [...document.querySelectorAll(".hl-button-label > span")].map((s) => [s.textContent, s.hasAttribute("data-hidden")])
    expect(labels()).toEqual([["Save", false], ["Saving", true], ["Saved", true]])
    rerender(<Button busy busyLabel="Saving" doneLabel="Saved">Save</Button>)
    expect(labels()).toEqual([["Save", true], ["Saving", false], ["Saved", true]])
    rerender(<Button done busyLabel="Saving" doneLabel="Saved">Save</Button>)
    expect(labels()).toEqual([["Save", true], ["Saving", true], ["Saved", false]])
    expect(screen.getByRole("button").hasAttribute("data-done")).toBe(true)
  })
})

describe("the rules' own components", () => {
  it("shows a state as a word and a glyph, never a dot", () => {
    render(<State kind="running">Running</State>)
    const s = screen.getByText("Running")
    expect(s.dataset.kind).toBe("running")
    expect(s.querySelector("svg")).not.toBeNull()
  })
  it("sets facts as a definition list", () => {
    render(<Facts items={[["Size", "412 MB"], ["Copy of", "Claude"]]} />)
    expect(document.querySelectorAll("dl.hl-facts dt")).toHaveLength(2)
    expect(document.body.textContent).not.toMatch(/·/)
  })
  it("puts each key of a combination on its own cap", () => {
    render(<Keys keys={["⌘", "D"]} />)
    expect(document.querySelectorAll(".hl-keys kbd")).toHaveLength(2)
    expect(document.querySelector(".hl-keys .hl-visually-hidden")?.textContent).toBe("⌘ D")
  })
  it("lists rows with a selected state", () => {
    render(<List><ListRow title="Claude Work" detail="Copy of Claude" selected /></List>)
    expect(screen.getByRole("listitem").hasAttribute("data-selected")).toBe(true)
  })
})

describe("controls", () => {
  it("switches", () => {
    render(<Switch label="Open at login" />)
    const s = screen.getByRole("switch")
    expect(s.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(s)
    expect(s.getAttribute("aria-checked")).toBe("true")
  })
  it("picks one segment", () => {
    let picked = ""
    render(<SegmentedControl aria-label="Size" defaultValue="m" onValueChange={(v) => (picked = v)} options={[{ value: "s", label: "Small" }, { value: "m", label: "Medium" }]} />)
    fireEvent.click(screen.getByRole("button", { name: "Small" }))
    expect(picked).toBe("s")
  })
  it("rolls a count with its full value readable", () => {
    render(<Count value={12480} />)
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("12,480")
  })
})

describe("stage and signature", () => {
  it("mounts a phenomenon host behind its content, even without WebGL", () => {
    render(<Stage phenomenon="caustics"><h1 data-quiet="">Clear</h1></Stage>)
    const stage = document.querySelector(".hl-stage")!
    expect(stage.getAttribute("data-phenomenon")).toBe("caustics")
    expect(stage.querySelector(".hl-phenomenon")).not.toBeNull()
  })
  it("draws the same seal for the same name", () => {
    render(<><Seal name="Parallex" /><Seal name="Parallex" /></>)
    const [a, b] = screen.getAllByRole("button", { name: "Parallex, seal" })
    expect(a.innerHTML).toBe(b.innerHTML)
  })
  it("wraps an app, marks the root the focus pull softens, and sets the character", async () => {
    await act(async () => {
      render(<HalationProvider name="Test" accent="jade" tempo="calm" signature={{ greeting: false }}><p>App</p></HalationProvider>)
    })
    expect(document.querySelector("[data-hl-root]")?.textContent).toBe("App")
    expect(document.documentElement.dataset.accent).toBe("jade")
    expect(document.documentElement.dataset.tempo).toBe("calm")
    expect(document.querySelector(".hl-lit-edge")).not.toBeNull()
  })
})
