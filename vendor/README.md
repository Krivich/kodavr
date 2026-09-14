# vendor/ — committed third-party artifacts

## `ignition-ssg-0.0.4.tgz`

The Ignition SSG engine is **not published to npm**, so a `file:../ignition/...`
dependency only resolves on the machine where that sibling checkout happens to
exist. On a clean clone it makes `npm ci` fail — which is exactly the P3b
blocker this directory closes.

We commit the engine tarball here and point `package.json` at
`file:vendor/ignition-ssg-0.0.4.tgz`, so the dependency resolves **inside the
repo** and a clean checkout can install and build with no external setup.

### Refreshing the vendored tarball

When Ignition produces a new release tarball:

1. Build/pack it from the engine checkout (it ships `ignition-ssg-<version>.tgz`).
2. Copy it in: `vendor/ignition-ssg-<version>.tgz`.
3. Update the `ignition-ssg` dependency in `package.json` to the new path.
4. Run `npm install` to refresh `package-lock.json` (its `resolved` field must
   stay `file:vendor/...`).
5. Run `npm test` and `npm run build`; commit the tarball, `package.json` and
   `package-lock.json` together.

Do not edit files under `node_modules/`; they are generated from this tarball.
