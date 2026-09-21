# KODAVR 🤖⚙️
Share raw experience. Let agents do the explaining.

Building something costs 1x. Packaging it so someone else can reuse it
costs 10x — the documentation, the generalised examples, the private
context to strip, the upkeep. Kodavr fixes that asymmetry: publish a
"dump" — a raw field report with a machine-readable contract — and the
reader's agent adapts it to their context. Share gears, not text.

## What is a dump?
You built something — a script, a workflow, a hack that finally worked.
Instead of writing "a proper article" (10x the effort of building it),
you tell your agent:
"I just finished something potentially very interesting for others.
Let them judge and learn if they want. Write it up as a dump."
Your agent writes the body and the manifest. You open a PR.
One prompt — no article writing, no polishing.

## For machines
curl -s https://kodavr.xyz/index.json | jq '.dumps[] | select(.stakes=="low")'
Protocol: /.well-known/kodavr.json · Feeds: /feeds/all.atom

## For humans
Read Kodavr through your own agent — prompt: Study https://kodavr.xyz/index.json and follow its schema. Read articles to me and act like a magazine I can talk to.

## For authors
CONTRIBUTING.md · One PR = one dump · CI rejects junk before merge.

Built on Ignition. Licences: MIT (code), CC-BY-4.0 (content).

## What it is
A static registry of dumps. Authors commit raw experience
under `content/dumps/<slug>/`; CI validates them and the build
publishes a machine-first surface (`/index.json`, per-dump manifests, Atom
feeds, sitemap) plus an HTML projection for humans. No backend, no database,
no accounts — one static artifact. The specification is `docs/SPEC.md`.

## Development

### Install
```bash
npm install
```

### Build
```bash
npm run build          # controller + Ignition SSG -> output/public
```

### Serve / preview
```bash
npm run serve          # serve output/public (default http://localhost:8080)
npm run preview        # build, then serve
```

### Test
```bash
npm test                   # unit + integration (vitest)
npm run test:e2e           # browser tests (Playwright)
npm run req                # reconcile requirement IDs with REQUIREMENTS.md
node scripts/tooling/quality-gates/validate.mjs  # content/PR validation, same checks as CI
```

## Repository layout
```
README.md · CONTRIBUTING.md · LICENSE (MIT) · LICENSE-CONTENT.md (CC-BY-4.0)
docs/SPEC.md               specification
docs/decisions.md          ADRs and operational runbook
content/dumps/<slug>/      dumps: manifest.json + raw.md (mandatory)
scripts/                   external controller (build, validate, machine files)
input/                     Ignition working area (templates, controllers, datasets)
.github/workflows/         validate.yml, deploy.yml
static/                    published as-is (logo, styles, site.js)
output/public/             build artifact (not committed)
```

## Licence
Platform code is MIT (`LICENSE`); dump content defaults to CC-BY-4.0
(`LICENSE-CONTENT.md`) unless a dump's manifest states otherwise.
