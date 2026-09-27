import "./home.css"
import { Behave } from "./Behave.tsx"
import { Hero } from "./Hero.tsx"
import { Light } from "./Light.tsx"
import { Rules } from "./Rules.tsx"
import { Footer, Start } from "./Sections.tsx"
import { Signed } from "./Signed.tsx"
import { Worlds } from "./Worlds.tsx"

/** The marketing page. Each section shows one thing, in its own composition. */
export function Home() {
  return (
    <div className="home">
      <Hero />
      <Light />
      <Rules />
      <Worlds />
      <Behave />
      <Signed />
      <Start />
      <Footer />
    </div>
  )
}
