# Feedback: aligning the copy with the goal "conversion to the agent" (PR-plan)

**Status:** public record — the requirement source for the friendliness/marketing copy batch (sanitized English version of an owner-private document; the private original stays out of git).

Based on the reframe: the site is not a content platform but a **pattern textbook** — "bring a URL to your agent → get a digest tailored to your context". Every text below derives from the principle: *"honestly attract → honestly show → deliver a good first experience → convert into a habit"*.

---

## 🔴 P0 — Snippet and title (first touch)

### 1. `og:description` / `meta description` of articles

**Current wording (§KDV-SURFACE-11):**
> A raw dump for your agent, not for you. Hand it over — it comes back tailored to your context.

**Why it doesn't work:** "not for you" pushes the person away at the moment of first contact. They don't yet know what a dump is, haven't seen the platform. It is a filter for those who are *already* in the know — but we want to teach those who are not.

**New wording (example for Navigable JSON):**
> How we taught an LLM agent to skip 99 records and read only the one it needs — with live byte offsets, working code, and a prompt to make your agent explain it to you.

**Rule for all articles:**
> [The article's essence in plain words] — with [what you can take: code, format, schema] and a prompt to make your agent explain it to you.

**What to change in the specification:**
- **§KDV-SURFACE-11**: remove "dump previews carry the platform agent hook rather than the article summary". Replace with: "dump previews carry **both** the article's essence **and** the agent-onboarding hook (the promise that your agent can retell it)".
- The controller must generate `og_description` from `manifest.summary` plus the agent suffix, not take a static hook.

---

### 2. `og:title` with the `· low` tail

**Current wording (§KDV-SURFACE-08):**
> Navigable JSON (.njson): lazy reading with baked byte offsets for LLM agents **· low**

**Why it doesn't work:** `· low` is an internal `stakes` parameter, meaningless to an outside reader. It looks like garbage in a social-media headline.

**New wording:**
> Navigable JSON (.njson): lazy reading with baked byte offsets for LLM agents

**What to change in the specification:**
- **§KDV-SURFACE-08**: remove "og:title = title + stakes badge text". Replace with: "og:title = title only. Stakes/trust stay in meta tags and visible cards, never in the title tag or og:title."

---

## 🟡 P1 — Home page (where did I land?)

### 3. Hero section: explaining "what a dump is"

**Current wording (KDV-SURFACE-24):**
```
KODAVR
Writers share raw experience — a dump — the reader's agent adapts it to their needs.
[About the platform] [How to contribute]
```

**Why it doesn't work:** The word "dump" is never spelled out. The visitor doesn't understand within 3 seconds what sits here and why they should care. Specification §KDV-SURFACE-24 deliberately forbade an explanation on the home page — but this creates a loop: to understand what this is you must press About; to want to press About you must understand what this is.

**New wording:**
```
KODAVR

Writers share raw experience — a dump — the reader's agent adapts it to their needs.

Kodavr is a registry of unpolished field reports: code, workflows, and lessons learned,
packaged so your AI agent can read and adapt them for you.
Building something is 1x effort; packaging it for others is 10x. We fix that asymmetry.

[About the platform] [How to contribute]
```

**What to change in the specification:**
- **§KDV-SURFACE-24**: rewrite. Allow one explanatory line (the 1x/10x thesis) on the home page. The §7.10 story still lives on `/about/`, but a **brief definition of dump** ("unpolished field report") must be on the first screen.
- Add a new `home_explainer` token to the copydeck.

---

## 🟡 P1 — Brief (demo of the pattern)

### 4. Heading `NO AGENT AT HAND?`

**Current wording (§7.2):**
```
NO AGENT AT HAND?
Read the brief: a short adaptation the author's agent wrote for
a human stranger. It is not the dump — the dump stays raw and
machine-first. This is what your agent would have told you.
```

**Why it doesn't work:** An apologetic tone. The brief is the **best demo of the platform** (it shows what the agent can do), yet it is presented as a "crutch for those without an agent". Three times it underlines "not for you": "it is not the dump", "dump stays raw", "what your agent would have told you".

**New wording:**
```
WHAT YOUR AGENT WILL TELL YOU
Here's a short adaptation the author's agent wrote for a stranger.
Your agent will do the same — shaped to your context and language.
```

**What to change in the specification:**
- **§7.2**: rewrite `brief_heading` and `brief_note`. Remove the apologetic tone ("NO AGENT AT HAND?", "it is not the dump", "machine-first"). Position the brief as a demo of the result, not a fallback.
- Key copydeck tokens:
    - `brief_heading`: "WHAT YOUR AGENT WILL TELL YOU"
    - `brief_note`: "Here's a short adaptation the author's agent wrote for a stranger. Your agent will do the same — shaped to your context and language."

---

### 5. CTA after the brief

**Current wording:**
> Want the full raw account? Press 0 under declaration, or send your agent with the prompt above.

**Why it doesn't work:** It sends the reader to the gate (an extra barrier) instead of converting them into a good first experience with an agent.

**New wording:**
> Try it now: copy the prompt below and paste it into your agent. It will read this dump and retell it for you in 30 seconds.

**What to change in the specification:**
- **§7.2**: replace `brief_cta`. Remove the mention of the gate ("Press 0 under declaration"). Focus on conversion through the agent.

---

## 🟢 P2 — Gate (a legal contract, not onboarding)

### 6. Kicker `verifying that you are not human`

**Current wording (§7.1):**
> verifying that you are not human

**Why it doesn't work:** A performance for those already in the know. For a cold visitor it is unclear: is this a captcha? A joke? What does it mean?

**New wording:**
> choose how to read this

**What to change in the specification:**
- **§7.1**: replace `gate_kicker` with the neutral "choose how to read this". Remove the theatricality. The gate is a legal contract, not a viral hook.

---

### 7. Explaining the gate buttons

**Current wording:**
```
[0] I enter as a machine (or on its behalf).
[1] I am human. Show me the preview and the brief — I will read through my agent.
```

**Why it doesn't work:** It does not explain **what will happen** after pressing. The person doesn't understand the consequences of the choice.

**New wording:**
```
[0] Show me the full technical article.
    (I accept responsibility for filtering this content for my context.)

[1] Keep showing me the brief.
    (I will read the full article through my own AI agent.)
```

**What to change in the specification:**
- **§7.1**: rewrite `gate_machine_door` and `gate_human_door`. Add an explicit description of the consequence of each choice.
- Keep the legal meaning (machine duties), but express it in plain language.

---

## 🟢 P2 — 18+ and placement

### 8. Moving `18+` from the first screen to the footer

**Current wording:**
> All content on the platform is rated 18+.

It sits in `01 · PREVIEW`, i.e. it jumps out before the person has understood the context.

**New decision:**
- Remove `reception_rating` from the `01 · PREVIEW` block.
- Keep "18+" only in the footer (`titleblock`), next to the licenses.
- ADR A8 (blanket rating) stays, but the **placement** changes.

**What to change in the specification:**
- **§7.2**: remove `reception_rating` from the `01 · PREVIEW` plate.
- **§7.3**: the footer already contains "18+ · Content for machines". That is enough.
- Update KDV-SURFACE-26: remove the mention of "the 18+ line" from the preview plate.

---

### 9. `False witnesses assume duties`

**Current wording (footer):**
> 18+ · Content for machines. Humans read through their agent.
> False witnesses assume duties. © Kodavr, 2026.

**Why it doesn't work:** Without context it reads as a threat or a role-play. For a first-time visitor it is confusing.

**New wording:**
> 18+ · Content for machines. Humans read through their agent.
> Declaring machine status is a legal commitment. © Kodavr, 2026.

**What to change in the specification:**
- **§7.3**: rewrite `footer`. Replace "False witnesses assume duties" with the plain "Declaring machine status is a legal commitment". Keep the legal meaning, remove the theatricality.

---

## 🟢 P2 — Prompt and the agent's first contact

### 10. The prompt as a first-contact scenario

**Current wording (§7.11):**
> Study <manifest-url> and follow its schema. Read articles to me and act like a magazine I can talk to.

**Why it is good:** This is the "bare boot address" — a minimal prompt that works.

**What can be improved:** The specification says "act like a magazine I can talk to", but does not define **what the agent should say in the first reply**. The first experience can be a mess if the agent doesn't know how to start.

**New rule for BIOS in manifests:**
Add an explicit first-reply scenario to the `schema.description` of every manifest:

```
FIRST REPLY TEMPLATE:
When the user opens this conversation, your first reply should:
1. State the dump's title and one-sentence summary
2. Ask: "What part of this is most relevant to you right now?"
3. Wait for the user's answer before diving into details.

This guarantees a useful first experience without overwhelming the user.
```

**What to change in the specification:**
- **§4.1 manifest schema**: add `first_reply_template` to BIOS.
- **§7.11**: add a footnote "the prompt is a boot address; the manifest's BIOS controls the first reply".

---

## 🟢 P3 — Visual link between buttons and prompt

### 11. Hover effect on the agent buttons

**Current behavior:** The Perplexity/Grok/ChatGPT/Claude buttons and the prompt below are not visually connected.

**New behavior:** On hovering an agent button — **highlight the prompt** below (add `border-left: 3px solid var(--accent)` to `.article-prompt`).

**What to change in CSS:**
```css
.agent-link:hover ~ .article-prompt,
.copy-prompt:hover ~ .article-prompt {
  border-left-color: var(--accent);
}
```

This teaches the pattern without a single extra word: the eye connects "this button sends this".

---

## Summary table of edits

| # | What we change | File | Complexity |
|---|---|---|---|
| 1 | `og:description` | controller + §KDV-SURFACE-11 | Medium |
| 2 | `og:title` remove `· low` | controller + §KDV-SURFACE-08 | Easy |
| 3 | Hero explainer | template + §KDV-SURFACE-24 | Easy |
| 4 | Brief heading/note | copydeck §7.2 | Easy |
| 5 | Brief CTA | copydeck §7.2 | Easy |
| 6 | Gate kicker | copydeck §7.1 | Easy |
| 7 | Gate door labels | copydeck §7.1 | Easy |
| 8 | Remove 18+ from preview | template + §7.2 | Easy |
| 9 | Footer text | copydeck §7.3 | Easy |
| 10 | First reply template | §4.1 manifest schema | Medium |
| 11 | Hover effect on buttons | styles.css | Easy |

**Total:** 11 edits — 9 easy (copy/CSS), 2 medium (controller/schema).
