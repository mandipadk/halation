#!/usr/bin/env node
import { main } from "../src/cli.js"

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code
  },
  (error) => {
    process.stderr.write(`Halation hit an unexpected error: ${error?.stack ?? error}\nPlease report it with the command you ran.\n`)
    process.exitCode = 1
  },
)
