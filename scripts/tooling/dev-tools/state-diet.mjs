#!/usr/bin/env node
/**
 * CONTRACT: scripts/tooling/dev-tools/state-diet.mjs
 * ROLE: moves the STATE.md chronicle into docs/history/state.md
 * CONSUMES:
 *   node:fs — read and write STATE.md and its archive
 *   node:path — join paths
 *   node:url — find the repo root
 * INVARIANTS:
 *   — the STATE.md head keeps only "now"; history moves below the marker
 */

// scripts/tooling/dev-tools/state-diet.mjs — move the STATE.md chronicle (below the marker) into
// docs/history/state.md (newest archive on top). UTF-8/EOL-safe (node ops only).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("../../../", import.meta.url))
const MARKER = "<!-- ARCHIVE:BELOW -->"
const statePath = join(ROOT, "STATE.md")

const content = readFileSync(statePath, "utf8")
const lines = content.split("\n")
const idx = lines.findIndex((l) => l.trim() === MARKER)
if (idx < 0) {
  console.error(`state:diet: no "${MARKER}" line in STATE.md — refusing (no silent rewrite).`)
  process.exit(1)
}
const head = lines.slice(0, idx + 1).join("\n") // head INCLUDING the marker line
const chronicle = lines.slice(idx + 1).join("\n").trim()
if (!chronicle) {
  console.log("state:diet: chronicle empty — nothing to move.")
  process.exit(0)
}
const histDir = join(ROOT, "docs", "history")
mkdirSync(histDir, { recursive: true })
const histPath = join(histDir, "state.md")
const stamp = new Date().toISOString().slice(0, 10)
const prev = existsSync(histPath) ? readFileSync(histPath, "utf8") : ""
writeFileSync(histPath, `## Archive ${stamp}\n${chronicle}\n\n${prev}`, "utf8")
writeFileSync(statePath, head + "\n", "utf8")
console.log(`state:diet: moved ${chronicle.length} chars -> ${histPath}`)
