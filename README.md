# drudger

CLI for managing Obsidian job records. Meant for use as an skill tool by OpenClaw so it can track job applications reiliably. Most vibe coded thing I've done but hopefully the tests aren't total trash lol.

Install the latest release:

```bash
curl -fsSL https://raw.githubusercontent.com/DogPawHat/drudger/main/install.sh | bash
```

Install a specific version:

```bash
DRUDGER_VERSION=v0.1.2 curl -fsSL https://raw.githubusercontent.com/DogPawHat/drudger/main/install.sh | bash
```

By default, the installer writes to `~/.local/bin/drudger`.

Manual install:

1. Download the matching binary and `sha256sums.txt` from Releases.
2. Verify checksum.
3. Move the binary to `~/.local/bin/drudger` and make it executable.

Uninstall:

```bash
rm -f ~/.local/bin/drudger
```

Install the drudger skill into an agent skills folder:

```bash
curl -fsSL https://raw.githubusercontent.com/DogPawHat/drudger/main/install-skill.sh | bash
```

Install into a custom skills directory:

```bash
curl -fsSL https://raw.githubusercontent.com/DogPawHat/drudger/main/install-skill.sh | bash -s -- /path/to/agent/skills
```

To install dependencies:

```bash
bun install
```

Run tests:

```bash
bun test
```

Build single-file executable:

```bash
bun run build
```

Compile + smoke test the binary:

```bash
bun run test:binary
```

CLI help:

```bash
./bin/drudger --help
./bin/drudger help add
./bin/drudger exists --help
```
