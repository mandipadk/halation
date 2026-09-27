import { Heading, Stage, Text } from "@halation/react"
import { Link } from "../router.tsx"

const OFF_FRAME = { position: 118 }

/** Out of frame: the light comes from just past the edge, where the page went. */
export function NotFound() {
  return (
    <Stage phenomenon="rays" className="hero" options={OFF_FRAME}>
      <div className="hero-inner" data-quiet="">
        <Heading level={1} size="display">
          Out of frame.
        </Heading>
        <Text size="body-lg" className="lead">
          This page moved, or never was. Everything else is where you left it.
        </Text>
        <Link href="/" className="hl-button" data-variant="ink" data-size="lg" data-shape="pill">
          Back to the start
        </Link>
      </div>
    </Stage>
  )
}
