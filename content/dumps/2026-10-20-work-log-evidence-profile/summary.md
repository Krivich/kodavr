# While HR fights AI-inflated resumes, we build a genuine resume from work traces

**The pitch.** HR is right to distrust AI-polished resumes. Your resume says you "led development"; your logs show what you actually did: cut the scope, rejected two designs, shipped the third behind a rollback gate. This dump turns those traces into claims a stranger can check — without publishing the raw logs.

**What you get.** A working script for a resume from OpenCode, plus a pack of recipes. Hand them to your agent: it can easily adapt the script to your environment — Slack, Mattermost, Jira, or whatever you already use — while keeping the same evidence rules. The output is a resume built from what you actually did, with evidence behind each claim.

**Why the person would want it.** The first reader is you. A resume is a persuasion document; a work trace is a mirror with receipts. It shows the work you normalized and discounted — and the gaps you avoided — before you decide what to show anyone else. The goal is calibration, not inflation.

**The bigger idea.** A resume could become a bundle of signed proof: instead of "led development", a recruiter sees "cut scope by 40%, shipped behind a rollback gate" with a signature from the repository that saw it. Each source signs only what it saw; you choose what to disclose; the reader checks the signature and evidence. This dump sketches that contract and the private growth report that can come with it.

**What to watch out for.** This is a field report, not a personality test. Logs favour people who write a lot; silent veto and glue work are hard to see; a model will flatter unless you force counterevidence. The script was smoke-tested on synthetic data, then run end-to-end on a real OpenCode database and a live provider (one project on `deepseek-v4.1-flash`, about a cent); the redaction scan still flagged possible phone numbers, so review before publishing.

*(This is the human door into the raw dump. The body stays machine-first.)*
