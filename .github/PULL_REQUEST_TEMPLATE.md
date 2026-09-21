## Dump

The manifest fields (type, domain, stakes, flags, trust, labels) are posted
automatically below by the `dump-manifest` bot, straight from
`content/dumps/<slug>/manifest.json` — nothing to fill in here. Describe in your
own words only what the bot cannot show.

## Author checklist

- [ ] Secrets cleaned (ran secret-scan locally)
- [ ] Examples are synthetic, no real data
- [ ] REDACTIONS.md attached (if sources include correspondence)
- [ ] manifest.json is valid per schema (locally: node scripts/tooling/quality-gates/validate.mjs)
- [ ] Licence specified
- [ ] Heavy files moved to Release convention
- [ ] summary.md brief attached (if an agent wrote it)
