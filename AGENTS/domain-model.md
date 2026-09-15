# domain-model — glossary of kodavr

> The project's single glossary, two clearly separated layers. The section grows as work proceeds;
> new terms are accumulated here, not invented anew.

## Part A. Runtime product terms

<Terms that the product's agent/user sees: canon + translations. If you change terminology in
prompts/schemas — sync this glossary in the same commit.>

- **dump** — the unit of content, addressed to an agent. The word lives only in agent-facing
  text: the prompt itself, `index.json`, manifests, machine-readable fields.
- **article / this content** — the same thing as seen by a *human* visitor, who may have arrived
  from a search engine or a friend's link and may never have heard "dump". Human-facing copy
  (gate, reception, lane, the machine panel) never says "dump": it politely explains how to see
  what the visitor wanted. **Rule:** if a string is read by a human, use *article*/*content*;
  if it is read by an agent, *dump* is the canon.

## Part B. Our development terms

<The working language of those who write the code: short definitions. These terms are not in the
product agent's system message.>

## Sources and where the truth is (do not duplicate)

- Runtime terms — the live system prompt/schemas (aggregate them here).
- Development terms — this file.
