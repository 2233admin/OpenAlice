# Windows SignPath onboarding

Status: active. Related issue: none yet. Owner guides:
[[docs/windows-code-signing.md]], [[docs/development-workflow.md]],
[[docs/managed-workspace-runtime.md]].

Scope: SignPath Foundation test signing and eventual Windows Electron release
signing. macOS Developer ID/notarization and native CLI archives are unchanged.

Decisions:

- Begin with a standalone, non-publishing Windows NSIS installer test-signing
  workflow. This keeps a self-signed artifact out of the release candidate set.
- Use GitHub-hosted build artifacts as SignPath's trusted origin and a ZIP-root
  configuration with ProductName/ProductVersion restrictions.
- Preserve the current signed macOS/unsigned Windows release behavior until a
  production certificate exists and the signed Windows bytes pass update-feed,
  blockmap, upgrade, and publication checks.

Ordered work:

- [x] Inspect the current Windows package and release candidate order.
- [x] Prepare the SignPath artifact configuration and reviewed test workflow.
- [x] Validate XML well-formedness, workflow syntax, repository tooling tests,
  and root typecheck. Account-side schema validation now also passes.
- [x] Accept the OSS organization invitation and verify the existing project,
  GitHub.com trusted build system, CI submitter, and valid `test-signing` policy.
  Rotate the CI token into the GitHub `SIGNPATH_API_TOKEN` secret.
- [x] Create `windows-installer` from the checked-in XML; SignPath reports
  `VALID` on 2026-10-11. Pin the existing test certificate for CI verification.
- [x] Configure repository variables and enable the test workflow on `dev`.
- [ ] Run the GitHub-hosted self-signed test and verify the returned installer.
- [ ] Publish and review Code signing and privacy policy statements plus team
  roles on public home/download/release surfaces.
- [ ] Send the tested request/build/policy links to SignPath for production
  certificate review.
- [ ] Integrate production signing in the Windows release path; regenerate and
  verify update metadata from signed bytes and prove the installed upgrade path.

Completion requires a production-signed Windows installer published only after
the same exact-byte acceptance as the other desktop assets. Do not close this
plan on a self-signed test alone.
