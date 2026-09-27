import { Button, Colophon, Facts, Field, Grain, Heading, Input, Seal, ShareCard, Stage, Text, darkroom, useDarkroom } from "@halation/react"
import { batch, drawSeal, playChime, score } from "@halation/core/signature"
import { useMemo, useState } from "react"
import { PageHead } from "../parts/Demo.tsx"

const CHARACTER = { light: "Rays", lens: "Editorial", tempo: "Crisp", form: "Soft", stock: "Ink", accent: "Vermilion" }

export function Signature() {
  const [name, setName] = useState("Parallex")
  const clean = name.trim() || "Halation"
  const foil = useMemo(() => ({ drawMark: drawSeal(clean) }), [clean])
  return (
    <div className="wrap">
      <PageHead kicker="Signature" title={<>Signed in light.</>}>
        Something built with Halation is recognizable without a logo in the corner. Every piece of its signature is generated from one thing: its name. Type one.
      </PageHead>
      <div className="grid-2" style={{ alignItems: "center", paddingBottom: 56 }}>
        <div className="stack" style={{ gap: 20 }}>
          <Field label="Project name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Facts items={[["Seal", <Seal name={clean} size={40} chime />], ["Film batch", batch(clean)]]} />
          <div className="row">
            <Button variant="ink" onClick={() => playChime(score(clean, "crisp"))}>
              Play its chime
            </Button>
            <DarkroomButton />
          </div>
          <Text size="caption" tone="muted">
            Each slit in the seal is a note, so the chime is the mark, heard.
          </Text>
        </div>
        <Stage phenomenon="foil" options={foil} mode="dark" style={{ aspectRatio: "1", borderRadius: "var(--radius-3xl)" }} aria-label="The seal, pressed in foil" />
      </div>

      <section className="section">
        <div className="grid-2" style={{ alignItems: "center" }}>
          <div className="section-head">
            <Heading level={2} size="title-1">
              The lit edge
            </Heading>
            <Text tone="muted">One pixel of the project's light along the top of every page, brightest where its light comes from, moving with the sun. Look at the top of this window.</Text>
          </div>
          <div className="section-head">
            <Heading level={2} size="title-1">
              The share card
            </Heading>
            <ShareCard name={clean} accent="#ff6b3d" className="card" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid-2" style={{ alignItems: "center" }}>
          <div className="section-head">
            <Heading level={2} size="title-1">
              The colophon
            </Heading>
            <Text tone="muted">Credits every project carries, generated from the same checks that ran on the page.</Text>
          </div>
          <Colophon name={clean} character={CHARACTER} />
        </div>
      </section>

      <section className="section" style={{ paddingBottom: 96 }}>
        <div className="grid-2" style={{ alignItems: "center" }}>
          <div className="section-head">
            <Heading level={2} size="title-1">
              The grain
            </Heading>
            <Text tone="muted">Film grain seeded by the name, so even the texture is the project's own.</Text>
          </div>
          <div style={{ position: "relative", height: 220, borderRadius: "var(--radius-2xl)", overflow: "hidden", background: "var(--color-surface)" }}>
            <Grain name={clean} opacity={0.5} />
          </div>
        </div>
      </section>
    </div>
  )
}

function DarkroomButton() {
  const open = useDarkroom()
  return <Button onClick={() => (open ? darkroom.leave() : darkroom.enter())}>{open ? "Leave the darkroom" : "Enter the darkroom"}</Button>
}
