import { test } from "node:test"
import assert from "node:assert/strict"
import { apca, fromHex, inGamut, toCss, toGamut, toHex, wcag } from "./color.ts"

const close = (a: number, b: number, eps: number) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`)

test("hex round trips through OKLCH", () => {
  for (const hex of ["#ff6b3d", "#0a0a0a", "#ffffff", "#000000", "#6cc792", "#e2b54c", "#639aff"]) {
    assert.equal(toHex(fromHex(hex)), hex)
  }
})

test("known OKLCH values", () => {
  const white = fromHex("#ffffff")
  close(white.l, 1, 1e-4)
  close(white.c, 0, 1e-4)
  const red = fromHex("#ff0000") // oklch(62.8% 0.2577 29.23)
  close(red.l, 0.628, 1e-3)
  close(red.c, 0.2577, 1e-3)
  close(red.h, 29.23, 0.05)
})

test("WCAG 2 contrast", () => {
  close(wcag(fromHex("#000000"), fromHex("#ffffff")), 21, 1e-4)
  close(wcag(fromHex("#777777"), fromHex("#ffffff")), 4.48, 0.01)
})

test("APCA matches the reference implementation", () => {
  close(apca(fromHex("#888888"), fromHex("#ffffff")), 63.056, 0.01)
  close(apca(fromHex("#ffffff"), fromHex("#888888")), -68.541, 0.01)
  close(apca(fromHex("#000000"), fromHex("#aaaaaa")), 58.146, 0.01)
  close(apca(fromHex("#aaaaaa"), fromHex("#000000")), -56.242, 0.01)
})

test("gamut mapping keeps hue and lightness", () => {
  const wild = { l: 0.7, c: 0.4, h: 40 }
  assert.equal(inGamut(wild), false)
  const mapped = toGamut(wild)
  assert.ok(inGamut(mapped, "srgb") || Math.abs(mapped.c) < 0.4)
  close(mapped.l, 0.7, 0.02)
  close(mapped.h, 40, 1)
  assert.match(toCss({ l: 0.7, c: 0.19, h: 40 }), /^oklch\(70% 0\.19 40\)$/)
})
