// The share card: every page's preview drawn with its own light, its seal
// and its words. Renders into a 1200 by 630 canvas (in the browser, or at
// build time with a canvas implementation).

import { hash, sequence, sealSvg } from "./seal.js"

export async function drawShareCard(canvas, { name, line = "Signed in light.", accent = "#ff6b3d", sans = "Geist", serif = "Instrument Serif" }) {
  if (document.fonts) await document.fonts.ready
  canvas.width = 1200
  canvas.height = 630
  const g = canvas.getContext("2d")
  const r = sequence(hash(name))
  const across = 0.2 + r() * 0.6
  g.fillStyle = "#0b0b0b"
  g.fillRect(0, 0, 1200, 630)
  g.save()
  g.globalCompositeOperation = "lighter"
  g.filter = "blur(22px)"
  const sx = 1200 * across
  for (let i = 0; i < 16; i++) {
    const a = Math.PI / 2 + (r() - 0.5) * 1.5
    const len = 520 + r() * 260
    const w = 20 + r() * 50
    const grad = g.createLinearGradient(sx, -40, sx + Math.cos(a) * len, -40 + Math.sin(a) * len)
    grad.addColorStop(0, `rgba(255,244,236,${0.1 + r() * 0.12})`)
    grad.addColorStop(1, "rgba(255,244,236,0)")
    g.fillStyle = grad
    g.beginPath()
    g.moveTo(sx - 6, -40)
    g.lineTo(sx + 6, -40)
    g.lineTo(sx + Math.cos(a) * len + Math.sin(a) * w, -40 + Math.sin(a) * len - Math.cos(a) * w)
    g.lineTo(sx + Math.cos(a) * len - Math.sin(a) * w, -40 + Math.sin(a) * len + Math.cos(a) * w)
    g.closePath()
    g.fill()
  }
  g.restore()
  const img = new Image()
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sealSvg(name, 128).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '))
  await img.decode()
  g.save()
  g.shadowColor = accent
  g.shadowBlur = 36
  g.drawImage(img, 88, 250, 128, 128)
  g.restore()
  g.fillStyle = "#fafafa"
  g.font = `600 104px ${sans}`
  g.letterSpacing = "-4px"
  g.fillText(name, 250, 345)
  g.font = `italic 400 44px '${serif}'`
  g.letterSpacing = "0px"
  g.fillStyle = "rgba(250,250,250,0.72)"
  g.fillText(line, 256, 402)
  return canvas
}
