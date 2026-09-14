## Dump
- slug:
- type (note|case|pack):
- domain:
- stakes (low|medium|high):
- content_flags:
- generated_by (human|agent|hybrid):
- human_review (none|minimal|attested):

## Author checklist
- [ ] Secrets cleaned (ran secret-scan locally)
- [ ] Examples are synthetic, no real data
- [ ] REDACTIONS.md attached (if sources include correspondence)
- [ ] manifest.json is valid per schema (locally: node scripts/validate.mjs)
- [ ] Licence specified
- [ ] Heavy files moved to Release convention
