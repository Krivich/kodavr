# Human guide — talking to someone who does not know Kodavr

Use these words, not the schema's. Translate on the fly into the human's
language. You may quote this file (reworded to their language) when they seem
new or unsure. Never paste the specification at them.

## The one-breath explanation

> Kodavr is a public registry of "dumps" — raw field reports of experience that
> people share without polishing. A reader doesn't read a dump directly; their
> AI agent adapts it to them. We add yours to kodavr.xyz by opening a **pull
> request** — a proposal to add something to the site. When it's merged, it's
> live. You don't have to write or format anything; I do that part.

## What the human actually has to do

Almost nothing. You (the agent) draft everything. The human:

1. Says what experience to share (or asks you to find it).
2. Answers a couple of plain questions (sensitive? money/health/law? language?).
3. Reads your proposal and says **yes / change something / cancel**.

They never need to know git, branches, slugs, manifests or CI — you handle it.

## What happens after "yes"

1. You create one small folder with a few files.
2. You run Kodavr's own checker and fix anything red.
3. You push a branch and open a pull request ("please add this").
4. GitHub runs automated checks; a bad proposal cannot merge.
5. The site owner reviews (always for a first-time author, then possibly
   auto-merge on green).
6. Merge = published. The author's GitHub account is credited automatically.

No account to create, no database, no server.

## Glossary — say the left column, not the right

| Human words | Kodavr / git term |
|---|---|
| the write-up | `raw.md` |
| a short friendly brief for people | `summary.md` |
| the info card / labels | `manifest.json` |
| the short name of the package | `slug` |
| a short note / a full case / a reusable package | `type: note \| case \| pack` |
| how sensitive / risky it is | `stakes` |
| machine warnings (contains code, opinion, medical, …) | `content_flags` |
| how trustworthy / how tested | `trust_level` |
| who wrote it (me, you, or both) | `generated_by` |
| whether you reviewed it | `human_review` |
| the list of things removed for privacy | `REDACTIONS.md` |
| pull request (GitHub) / merge request (GitLab) | PR / MR |
| the main line of the project | `main` / base branch |

## Plain answers to the awkward questions

- **Will my name be on it?** Your GitHub handle is credited automatically; no
  real name, email or phone goes into the dump.
- **What if I regret it later?** It can be withdrawn — the dump gets a
  `withdrawn` status and its body is replaced with a short note saying why. The
  URL stays stable.
- **Does it have to be polished?** No. Raw is the point; the reader's agent does
  the adapting.
- **I want to share something from my work.** Fine — but use made-up examples,
  describe the real risk honestly, and never publish secrets or personal data.
- **What about money / health / legal / security?** That counts as high
  sensitivity: it's allowed, but we add a machine warning and an explicit
  disclaimer that readers' agents must honor.
- **Why do you also want a short brief?** People who don't have an AI agent
  reach a dump only through that brief — it's the one page written for a human.
- **Why tell you how "sensitive" it is?** So other people's agents can warn
  their users or refuse to apply it. Honesty here protects everyone; hiding risk
  is grounds for withdrawal.
- **Do I need a GitHub account?** To open the pull request under your name, yes
  (a free one). If you'd rather not, the owner can help or you can use mine if
  you authorize it.
