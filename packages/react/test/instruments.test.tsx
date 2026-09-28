import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AccentForge, Dial, Lens, LightTable, LitTabs, ShortcutRecorder, Sundial } from "../src/index.ts"

afterEach(cleanup)

describe("lens", () => {
  const groups = [
    { name: "Copies", items: [{ id: "work", title: "Claude Work", detail: "Copy of Claude" }] },
    { name: "Actions", items: [{ id: "dup", title: "Duplicate Claude Work", keys: ["⌘", "D"] }, { id: "new", title: "New copy" }] },
  ]
  it("narrows to what matches, and opens the chosen one", async () => {
    const onSelect = vi.fn(), onOpenChange = vi.fn()
    render(<Lens open onOpenChange={onOpenChange} groups={groups} onSelect={onSelect} />)
    const input = screen.getByRole("combobox")
    fireEvent.change(input, { target: { value: "dup" } })
    expect(screen.getAllByRole("option")).toHaveLength(1)
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "dup" })))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
  it("moves the selection with the arrow keys", () => {
    render(<Lens open onOpenChange={() => {}} groups={groups} />)
    const input = screen.getByRole("combobox")
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true")
    expect(input.getAttribute("aria-activedescendant")).toBe("hl-lens-dup")
  })
  it("says so when nothing matches", () => {
    render(<Lens open onOpenChange={() => {}} groups={groups} />)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } })
    expect(screen.getByText("Nothing matches “zzz”.")).toBeTruthy()
  })
})

describe("shortcut recorder", () => {
  it("records a shortcut held down, then saves it", () => {
    const onValueChange = vi.fn()
    render(<ShortcutRecorder value={["⌃", "⌥", "1"]} onValueChange={onValueChange} label="Switches to Claude Work" />)
    const b = screen.getByRole("button")
    fireEvent.click(b)
    fireEvent.keyDown(b, { key: "Alt", code: "AltLeft" })
    fireEvent.keyDown(b, { key: "p", code: "KeyP" })
    fireEvent.keyUp(b, { key: "p", code: "KeyP" })
    expect(onValueChange).toHaveBeenCalledWith(["⌥", "P"])
  })
  it("refuses a shortcut that's taken, and says why", async () => {
    const onValueChange = vi.fn(), onMessage = vi.fn()
    render(<ShortcutRecorder value={["⌃", "⌥", "1"]} onValueChange={onValueChange} onMessage={onMessage} label="Switches to Claude Work" />)
    const b = screen.getByRole("button")
    fireEvent.click(b)
    fireEvent.keyDown(b, { key: "Meta", code: "MetaLeft" })
    fireEvent.keyDown(b, { key: "q", code: "KeyQ" })
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith({ text: "⌘Q quits the app you’re in. Pick another.", tone: "problem" }))
    fireEvent.keyUp(b, { key: "q", code: "KeyQ" })
    expect(onValueChange).not.toHaveBeenCalled()
  })
  it("refuses a key with no modifier", () => {
    const onMessage = vi.fn()
    render(<ShortcutRecorder value={["⌃", "1"]} onMessage={onMessage} label="Switches to Claude Work" />)
    const b = screen.getByRole("button")
    fireEvent.click(b)
    fireEvent.keyDown(b, { key: "p", code: "KeyP" })
    fireEvent.keyUp(b, { key: "p", code: "KeyP" })
    expect(onMessage).toHaveBeenLastCalledWith(expect.objectContaining({ tone: "problem" }))
  })
})

describe("sundial", () => {
  it("steps by a quarter hour with the arrow keys, and reads the time", () => {
    const onValueChange = vi.fn()
    render(<Sundial value={21 * 60 + 30} onValueChange={onValueChange} label="Quiet hours begin at" sunrise={408} sunset={1142} />)
    const s = screen.getByRole("slider")
    expect(s.getAttribute("aria-valuetext")).toBe("9:30 pm, night")
    fireEvent.keyDown(s, { key: "ArrowRight" })
    expect(onValueChange).toHaveBeenCalledWith(21 * 60 + 45)
    fireEvent.keyDown(s, { key: "PageDown" })
    expect(onValueChange).toHaveBeenLastCalledWith(20 * 60 + 30)
  })
})

describe("lit tabs", () => {
  it("selects a tab and shows its panel", () => {
    render(<LitTabs aria-label="Sections" items={[{ value: "a", label: "Overview", content: "All of it" }, { value: "b", label: "Copies", content: "Each copy" }]} />)
    fireEvent.click(screen.getByRole("tab", { name: "Copies" }))
    expect(screen.getByRole("tab", { name: "Copies" }).getAttribute("aria-selected")).toBe("true")
    expect(screen.getByText("Each copy")).toBeTruthy()
  })
})

describe("dial", () => {
  it("steps and stays inside its range", () => {
    const onValueChange = vi.fn()
    const { rerender } = render(<Dial value={60} onValueChange={onValueChange} label="Intensity" sound={false} />)
    const s = screen.getByRole("slider")
    fireEvent.keyDown(s, { key: "ArrowUp" })
    expect(onValueChange).toHaveBeenCalledWith(65)
    rerender(<Dial value={100} onValueChange={onValueChange} label="Intensity" sound={false} />)
    fireEvent.keyDown(s, { key: "ArrowUp" })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(s.getAttribute("aria-valuetext")).toBe("100 percent")
  })
})

describe("accent forge", () => {
  it("skips over purple, and says why", () => {
    const onHueChange = vi.fn()
    render(<AccentForge hue={258} onHueChange={onHueChange} />)
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" })
    expect(onHueChange).toHaveBeenCalledWith(345)
    expect(screen.getByText("Halation keeps accents out of purple, so the ring stops at its edge.")).toBeTruthy()
  })
  it("measures every pair it derives", () => {
    render(<AccentForge hue={37} />)
    expect(screen.getAllByText(/to 1, passes/)).toHaveLength(4)
  })
})

describe("light table", () => {
  it("lays down what's dropped as prints", async () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test")
    const onFiles = vi.fn()
    const { container } = render(<LightTable onFiles={onFiles} initial={[{ src: "data:,", name: "Harbor.jpg", caption: "Sample print" }]} />)
    expect(screen.getByText("1 print")).toBeTruthy()
    const file = new File(["x"], "Summer 1998.jpg", { type: "image/jpeg" })
    await act(async () => {
      fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [file] } })
    })
    expect(onFiles).toHaveBeenCalledWith([file])
    expect(screen.getByText("2 prints")).toBeTruthy()
    expect(screen.getByAltText("Summer 1998.jpg")).toBeTruthy()
    create.mockRestore()
  })
})
