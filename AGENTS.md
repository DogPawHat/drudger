Default to using Bun instead of Node.js.
Use Bun's package manager to install dependencies instead of npm
Read docs/BUN.md for bun conventions when editing .ts files
Type of package: cli bundled as a single-file executable. see https://bun.com/docs/bundler/executables.md#single-file-executable for details.

## Release process (agents)

1. Run quality checks before tagging:
   - `bun test`
   - `bun run test:binary`
2. Ensure release-ready changes are committed to the target branch.
3. Create a semver tag on that commit (for example `v0.1.3`).
4. Push the branch and the tag:
   - `git push origin <branch>`
   - `git push origin <tag>`
5. Tag push triggers `.github/workflows/release.yml`, which:
   - installs dependencies with Bun,
   - runs tests,
   - builds Linux/macOS x64+arm64 binaries,
   - generates `sha256sums.txt`,
   - publishes a GitHub Release with assets.
6. Verify release artifacts after completion:
   - `gh release view <tag> --repo DogPawHat/drudger`
   - optional install check: `DRUDGER_VERSION=<tag> curl -fsSL https://raw.githubusercontent.com/DogPawHat/drudger/main/install.sh | bash`
