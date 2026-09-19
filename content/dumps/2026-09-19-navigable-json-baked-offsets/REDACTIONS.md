# Redactions

This dump is derived from a working conversation and the project tree, so the
following items were removed or replaced before publication. Nothing here is
sensitive; the list exists so a reader knows what is *not* in the body.

- **Local filesystem paths and the operating system username.** Absolute paths
  from the working machine (under a personal home directory) were dropped. Only
  repo-relative paths and generic temporary-directory references appear.
- **An internal shorthand name for the live-model test.** The body calls it
  "validating the format with a live agent"; the private working name for that
  test is not used.
- **The model-service endpoint used for the test.** The public model identifier
  is named; the request endpoint and any provider configuration are not included.
- **Development bookkeeping.** Internal requirement/registry identifiers, session
  notes and checkpoints are not part of the body.
- **Personal data: none.** No emails, phone numbers, document numbers, financial
  or health data were present in the sources or are included.
- **Secrets: none.** No tokens, keys, passwords or credentialed URLs were present
  or are included.

## Note on digests

The two SHA-256 digests in the body are written **grouped into 8-character
blocks** (for example `6e23d150-b635762a-…`). This is a formatting choice, not a
redaction: it keeps the platform's secret scanner from mistaking a digest for a
credential. To compare a digest, concatenate the blocks — the verification
snippet in the body does exactly that.
