import "@halation/react/styles.css"
import "./app.css"
import { HalationProvider } from "@halation/react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import { project } from "./project.ts"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HalationProvider name={project.name}>
      <App />
    </HalationProvider>
  </StrictMode>,
)
