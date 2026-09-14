# Kodavr manifesto: raw experience your agent reads for you

Kodavr is a registry of raw experience — "dumps" — published together with a machine-readable contract. The author writes down what actually happened without polishing it; the reader's agent adapts the material to the reader's own context. This dump is the format's first example and the record of why the repository exists, so it is deliberately self-referential: the specification that spawned this repository is treated as an artifact of the repository and listed below.

A dump is created in one prompt. You tell your agent: "I just finished something potentially very interesting for others. Let them judge and learn if they want. Write it up as a dump." The agent writes the body and the manifest; you open a pull request. That is the entire publication flow — no article, no editing, no 10x packaging cost.

## 1. The problem: the 1x/10x asymmetry

Making a thing costs 1x. Packaging the thing so that another person can reuse it costs 10x: write the documentation, generalise the examples, remove the private context, keep it updated. Almost everyone pays the first cost and almost no one pays the second, so 90% of useful experience dies in local folders — a working script, a hard-won workaround, a checklist that only its author understands. The asymmetry is not laziness; the packaging work is simply never repaid, because a polished write-up has to anticipate readers the author will never meet.

Kodavr breaks the asymmetry instead of asking authors to absorb it. The author pays 1x to make the thing and a second 1x to dump it raw; the expensive adaptation — deciding what applies to this particular reader, on this particular stack, today — is carried by the consumer through their agent. The registry never has to guess the reader's context, because it stores the raw material and the contract needed to adapt it.

## 2. The insight: raw dump + machine-readable contract + adaptation on the reader's side

The insight has three parts, and dropping any one of them collapses the format back into ordinary blogging.

First, the body is a **raw dump**: the author's own account of what they did, in their own voice, with the dead ends left in. Polish is expensive and lossy; raw material preserves the details that let a reader judge for themselves.

Second, the dump carries a **machine-readable contract**: a manifest with a stable slug, a schema-checked set of fields (type, domain, stakes, content flags, trust level, provenance) and a small set of published JSON surfaces — an index, per-dump manifests, Atom feeds. A machine can decide whether to read the body before reading it, which is exactly the decision a human skimming a blog cannot automate.

Third, the **adaptation happens on the reader's side**. The registry does not deliver a finished answer; it delivers raw material plus enough metadata for the reader's agent to filter it, attribute it, and reshape it for the reader's situation. The author ships a mechanism, not a plea: the contract is held by schema grammar and gates, not by asking everyone to be careful.

## 3. Decision register

A condensed register of the decisions that shape the project (the full ADR lives in §0 of the specification):

| # | Decision | Why |
|---|---|---|
| A1 | Monorepo: content, engine and CI in one repository | Git is the transport and the backend; one pipeline and one moderation point |
| A2 | Ignition as the static site engine | Its principles match the philosophy: write, debug and forget; no server to run |
| A3 | Publication is a pull request; merge is publication; Issues are the discussion | No backend to build, and provenance plus an audit log come for free |
| A4 | Machine-first: index, manifests, feeds and sitemap are the primary interface; HTML is a projection | The target consumer is the reader's agent, not a browser |
| A5 | No client-side search | Machines already have the index; adding search is YAGNI until thousands of humans browse without agents |
| A6 | An inverted gate with a reception block instead of direct reading | Transfers the editorial duty to the reader's agent and gives the project its hook |
| A7 | The gate is declarative, not technical | Public statics cannot be locked; the product is a declaration and a contract, not a lock |
| A9 | MIT for the engine, CC-BY-4.0 for the content | Maximise distribution of the format; the moat is the network, not the code |
| A10 | Heavy binaries live in GitHub Releases by tag convention | A light repository and fast CI |
| A12 | Categories are not designed up front; they emerge from the dumps | Shelves before goods is a storefront mistake |
| A13 | The first dump is the manifesto and the only launch starter; the second slot waits for a real community PR | Dogfooding the format; no fabricated filler, cross-domain packs arrive with their authors |

## 4. Naming pitfalls

The name **Kodavr** walks straight into a trap: it reads like *cadaver*. The project acknowledges the trap and reframes it — not a corpse, but a dissected mechanism. The mark itself stays deliberately plain — a wordmark "K" — so the mechanism idea lives in the name and the copy rather than in the glyph. Reframing beats renaming: the association is memorable and the meaning is defensible.

**Search-YAGNI** is the second pitfall. It is tempting to add client-side search because a storefront is expected to have one. But the raw material is consumed by agents, and machines already have a cheap, exact way to query the registry — the index. Search is deferred until thousands of humans visit without an agent; building it earlier would be inventing a shelf for goods that do not exist yet.

**Centaur versus minotaur** is the third. Two stock images describe human–AI collaboration: the centaur, a human upper body on a beast, and the minotaur, a beast body with a human head. The centaur picture means an augmented human still fully in control of a tool; the minotaur picture means the machine does the work while the human only names the goal. Kodavr needs neither as a slogan. Its contract is more precise: the author supplies raw material and provenance, the reader's agent performs the adaptation and keeps the source. That is neither "AI as a feature" nor "human as a prompt" — it is a division of labour written down as a schema.

## 5. Artifacts

- [docs/SPEC.md](/docs/SPEC.md) — the full specification that spawned this repository; the sections referenced above are its §0 register and §10 starter content.
- [static/logo.svg](/static/logo.svg) — the Kodavr wordmark described in the naming section.
- [manifest.schema.json](/content/dumps/2026-09-14-kodavr-manifesto/manifest.schema.json) — the manifest schema: a JSON Schema derived from §4.1, listing the required fields and the closed vocabularies a dump must satisfy.

## 6. What worked, what did not

What worked: keeping every contract in one machine-readable place; treating the specification itself as the first artifact of the repository; and refusing to polish the raw dump, which kept the account honest and cheap to write. The self-reference is not decoration — it is the cheapest possible proof that the format can carry its own story.

What did not work: attempting to lock the human surface technically. Public statics cannot be locked, and an early version of the gate assumed otherwise. The fix was to make the gate a declaration and a contract — the reader's agent honours it — instead of a mechanism that tries to enforce it. The remaining risk is the opposite one: a contract that nobody reads is only prose, so the validation pipeline has to hold the schema, the vocabularies and the links with code rather than with wording.
