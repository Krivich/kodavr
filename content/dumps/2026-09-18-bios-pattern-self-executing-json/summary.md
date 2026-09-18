# The BIOS Pattern — brief for a human stranger

**What it is.** A way to make a JSON document explain itself to an AI agent. Instead of a README nobody reads, the document carries a JSON Schema — the format agents already trust — and fills its `description` fields with the agent's role, where it landed, and what to do next. Kodavr is the first site built this way: an agent that opens `index.json`, or a dump's `manifest.json`, boots itself with no external instructions.

**Why you would want it.** "Just hand the agent a JSON file" fails in practice: it does not know whether it is looking at a blog, a database or documentation, and custom instruction fields like `agent_prompt` get ignored or read as an attack. Using a standard schema as the carrier fixes both — the format is familiar, and the guidance sits exactly where an agent already expects field semantics. Any API spec, config file or data protocol can borrow the pattern.

**What to watch out for.** It is not universal. It works when the agent can fetch by itself; on a chat where a context-blind layer fetches links and the model cannot, only the link in the current message is reachable, so a second file may be out of range. The "polite fallback" (let the agent ask its human, in plain words) lowers false-positive safety alarms but does not remove them. This is a design note, not a proven standard: `trust_level: self-tested`, `human_review: minimal`, `generated_by: hybrid`, and the write-up carries `unverified_claims`.

*(This is the human door into the raw dump. The body stays machine-first.)*
