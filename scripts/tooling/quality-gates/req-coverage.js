#!/usr/bin/env node
/**
 * CONTRACT: scripts/tooling/quality-gates/req-coverage.js
 * ROLE: reconciles requirement IDs between REQUIREMENTS.md and the tests, and enforces the flow-impact hook on every row
 * EXPORTS:
 *   checkFlow — flow: problems for every row, against a frozen legacy exemption anchor
 *   LEGACY — the frozen { count, sha256 } anchor of the grandfathered `flow: legacy` set
 * CONSUMES:
 *   ../workflow-map/workflow-arrows-lint.mjs — the PROCESSES palette (one truth)
 *   node:crypto — sha256 of the sorted legacy ID set (the frozen anchor)
 *   node:fs — read the registry and the tests
 *   node:path — join paths
 *   node:url — find the repo root and detect the entry point
 * INVARIANTS:
 *   — a ✅ row without a test, or a test ID absent from the registry, exits 1
 *   — every row carries a valid flow: (`<process>[,…]` | none | legacy)
 *   — the `flow: legacy` set must match LEGACY exactly, so it cannot silently grow
 */

// scripts/tooling/quality-gates/req-coverage.js — reconcile requirement IDs between REQUIREMENTS.md and tests.
// Exit 1 on: an ID used in a test but absent from the registry; a ✅ row with no test;
// a row without a valid `flow:` field; the frozen `flow: legacy` exemption set changing.
// The exemption set is anchored in code (LEGACY count + sha256), not a file, so a new
// row cannot dodge the hook by writing `legacy` — that changes the set and fails loudly.
// Prefix/suffix are project-specific: set PREFIX and TESTS_DIR below.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { PROCESSES } from "../workflow-map/workflow-arrows-lint.mjs"

const ROOT = fileURLToPath(new URL("../../../", import.meta.url))
const PREFIX = "KDV" // ← your registry prefix
const TESTS_DIR = join(ROOT, "tests")

// LEGACY — the frozen anchor of the grandfathered `flow: legacy` set (rows that
// predate the hook). `count` = number of such rows; `sha256` = hex digest of the
// sorted legacy IDs joined by "\n". Changing this set is a deliberate, reviewable
// act: edit the constant only when the change is intentional.
export const LEGACY = {
  count: 208,
  sha256: "97c7be2609f74241f5bc402013ee93daae8473032fd5809b4b8f133ee06754de",
}

// Group codes may contain digits (e.g. KDV-A11Y), so the class is [A-Z0-9].
// One grammar for both the coverage pass and the flow pass (one truth per row).
const ROW = new RegExp(`^-\\s*(✅|🟧|⬜|❓)\\s*\\*\\*(${PREFIX}-[A-Z0-9]+-\\d+)\\*\\*[^\\n]*`, "gm")
// The optional flow: field. It MUST be delimited — preceded by `(` or `;` (the
// reference block's separators) — so prose that merely mentions "flow:" (or a
// `workflow:` token) is never mistaken for the field. The capture stops at `;`
// (reference separator) and `)` (when the field is the last reference).
const FLOW = /[(;]\s*flow:\s*([^;)]+)/
const FLOW_NONE = "none"
const FLOW_LEGACY = "legacy"

// isValidFlow(value, allowed) → true for `none`, `legacy`, or a comma-separated
// list of palette process names (case-sensitive, trimmed). The keywords never mix
// with names or each other: `none, Publish` is invalid because `none` is not a
// palette name and the keyword branch short-circuits only for the bare keyword.
function isValidFlow(value, allowed) {
  if (value === FLOW_NONE || value === FLOW_LEGACY) return true
  const names = value.split(",").map((s) => s.trim()).filter(Boolean)
  return names.length > 0 && names.every((n) => allowed.has(n))
}

// checkFlow(registryText, processNames, frozen) → the flow-impact problems
// ([] = clean). EVERY row must carry a valid `flow:`; the rows declaring
// `flow: legacy` are the grandfathered exemption set, which must match the frozen
// anchor `{ count, sha256 }` exactly — otherwise a new row could dodge by writing
// `legacy`. Pure over its arguments (sha256 via node:crypto).
export function checkFlow(registryText, processNames, frozen) {
  const allowed = new Set(processNames)
  const problems = []
  const legacyIds = []
  for (const m of registryText.matchAll(ROW)) {
    const id = m[2]
    const fm = m[0].match(FLOW)
    if (!fm) {
      problems.push(`requirement ${id} has no flow: field (name a process, 'none', or 'legacy')`)
      continue
    }
    const value = fm[1].trim()
    if (!isValidFlow(value, allowed)) {
      problems.push(
        `requirement ${id} has an unknown flow: '${value}' (allowed: ${[...allowed, FLOW_NONE, FLOW_LEGACY].join(", ")})`,
      )
      continue
    }
    if (value === FLOW_LEGACY) legacyIds.push(id)
  }
  legacyIds.sort()
  const digest = createHash("sha256").update(legacyIds.join("\n")).digest("hex")
  if (legacyIds.length !== frozen.count || digest !== frozen.sha256) {
    problems.push(
      `the flow: legacy exemption set changed (frozen ${frozen.count}/${frozen.sha256.slice(0, 8)}…, ` +
        `now ${legacyIds.length}/${digest.slice(0, 8)}…) — a new requirement must name a process or 'none'; ` +
        `if the change is intentional, update LEGACY in req-coverage.js`,
    )
  }
  return problems
}

function main() {
  const registry = readFileSync(join(ROOT, "REQUIREMENTS.md"), "utf8")
  const rows = [...registry.matchAll(ROW)].map((m) => ({ status: m[1], id: m[2] }))

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

  problems.push(...checkFlow(registry, PROCESSES.map((p) => p.name), LEGACY))

  if (problems.length) {
    console.error("req-coverage FAILED:\n  " + problems.join("\n  "))
    process.exit(1)
  }
  console.log(`req-coverage OK (${rows.length} rows, ${tested.size} IDs tested)`)
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) main()
