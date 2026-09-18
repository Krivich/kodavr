# Redactions

`sources` includes `chat-log`, so this file is mandatory.

- **No personal data, secrets, tokens or credentials** were present in the dump; nothing had to be removed for privacy.
- **Editorial note (not a privacy redaction).** The working draft framed the pattern as a "Trojan horse"; that framing was replaced with neutral wording ("a familiar, trusted standard" / "standard as carrier"), because the Trojan-horse image reads as malicious and does not match the intent.
- **Honesty narrowing.** The draft claimed the pattern was "successfully tested" on several named models. That was cut back to what was actually observed: a reasoning model used it in a per-dump discussion, tool-capable agents use it, and one official chat proved passive. The claim that safety filters "don't trigger" was narrowed to "the polite fallback reduces false positives".
- **No private URLs or internal paths** are included; the artifact URLs point at public `kodavr.xyz` endpoints.
