# OpenClaw Plugin Sabrina

This package is the release scaffold for Sabrina's future OpenClaw plugin.

The current repo ships the connector runtime inside the Sabrina desktop app
first, and uses this package to make the public contract explicit before the
npm-distributed plugin is enabled.

Planned public commands:

- `openclaw sabrina connect`
- `openclaw sabrina status`
- `openclaw sabrina doctor`
- `openclaw sabrina disconnect`

Planned connector scope:

- connect Sabrina to a chosen local OpenClaw control plane
- keep a dedicated `sabrina-browser` agent healthy
- sync browser-visible model choices
- expose browser-native actions
- bridge structured browser memory into OpenClaw memory

Current runtime shape in this repo:

- ships a real `openclaw.plugin.json`
- registers `openclaw sabrina ...` CLI commands through the plugin SDK
- talks to a loopback Sabrina bridge discovered through `~/.sabrina/connector.json`

Not done yet:

- local connect-code fallback UX
- remote transport/pairing transport
- npm publication and community-plugin release polish
