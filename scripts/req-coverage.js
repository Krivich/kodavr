#!/usr/bin/env node
/**
 * CONTRACT: scripts/req-coverage.js
 * ROLE: reconciles requirement IDs between REQUIREMENTS.md and the tests
 * CONSUMES:
 *   node:fs — read the registry and the test files
 *   node:path — join paths
 *   node:url — find the repo root
 * INVARIANTS:
 *   — a ✅ row without a test, or a test ID absent from the registry, exits 1
 */

// scripts/req-coverage.js — reconcile requirement IDs between REQUIREMENTS.md and tests.
// Exit 1 on: an ID used in a test but absent from the registry; a ✅ row with no test.
// Prefix/suffix are project-specific: set PREFIX and TESTS_DIR below.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const PREFIX = "KDV" // ← your registry prefix
const TESTS_DIR = join(ROOT, "tests")

const registry = readFileSync(join(ROOT, "REQUIREMENTS.md"), "utf8")
// Group codes may contain digits (e.g. KDV-A11Y), so the class is [A-Z0-9].
const rows = [...registry.matchAll(new RegExp(`^-\\s*(✅|🟧|⬜|❓)\\s*\\*\\*(${PREFIX}-[A-Z0-9]+-\\d+)\\*\\*`, "gm"))]
  .map((m) => ({ status: m[1], id: m[2] }))

// The tests directory may not exist yet on a fresh project — treat it as "no tests".
const files = []
if (existsSync(TESTS_DIR)) {
  ;(function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      // Playwright specs (`*.e2e.js`) are registry tests too — they carry the
      // requirement ID as the first word of the test title exactly like vitest.
      else if (/\.(test|spec|e2e)\.[cm]?[jt]s$/.test(name)) files.push(p)
    }
  })(TESTS_DIR)
}

const tested = new Set()
for (const f of files) {
  for (const m of readFileSync(f, "utf8").matchAll(new RegExp(`${PREFIX}-[A-Z0-9]+-\\d+`, "g"))) tested.add(m[0])
}

const known = new Set(rows.map((r) => r.id))
const problems = []
for (const id of [...tested].sort()) if (!known.has(id)) problems.push(`test uses unknown ID: ${id}`)
for (const r of rows) if (r.status === "✅" && !tested.has(r.id)) problems.push(`✅ without a test: ${r.id}`)

if (problems.length) {
  console.error("req-coverage FAILED:\n  " + problems.join("\n  "))
  process.exit(1)
}
console.log(`req-coverage OK (${rows.length} rows, ${tested.size} IDs tested)`)
