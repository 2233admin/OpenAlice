# Shared client connection

Status: In progress. Owner guides: `docs/cli-supervisor.md`, `docs/remote-access.md`, `docs/managed-workspace-runtime.md`, `docs/ui-interaction-and-motion.md`, `docs/testing.md`. No issue currently owns this work.

## Goal and boundaries

One local CLI process has one active Machine/AliceProject target. Its TUI and locally served Web GUI are two views of that same connection. The shared relay authority, not either view, owns SSH tunnels, candidate verification, target generation, and disconnect. The selected backend owns its AliceProject; connecting or switching never takes over, starts, or stops a remote Runtime. Electron stays on its current integrated IPC path until a later increment explicitly implements separated mode.

## Selected interaction model

- Bare `openalice` keeps the TUI as its terminal face and starts the same loopback relay used by the Web GUI. Opening Web from the TUI uses the relay origin. TUI selection and Web Settings selection update one target, and both views follow the change. An explicit `openalice relay` remains a browser-only entry to the same controller implementation, not a second controller inside one process.
- The Web Settings chooser remains a dialog with Machine and Project columns; stopped Projects are visible but not connectable. On narrow screens the columns stack and the dialog scrolls. Status changes are announced accessibly and target changes retire browser caches/sockets before reload.
- TUI remains responsible for lifecycle commands such as starting a stopped Project. The shared controller only discovers, connects, verifies, switches, and disconnects. Failed candidates leave the prior target live. CLI exit closes its own tunnel but not a backend Runtime.
- Electron later hosts this controller in its main process for separated mode, serving the local Web GUI over loopback. Integrated mode keeps `app://` and IPC. Switching to separated mode must probe the remote candidate before stopping Electron-owned local children and releasing their Project; switching back must prepare local ownership before changing the window transport. Remote pages receive no backend-specific native IPC capabilities.

Implementation discovery: `WebRelay` already owns the verified target transaction and HTTP transport. The first CLI increment reuses that same instance from the TUI and exposes a local presenter subscription and explicit disconnect; extracting a second target manager now would add another state boundary without helping Electron. Split the class only if Electron's implementation needs an independently hosted transport.

## Work

- [x] Make `WebRelay` the reusable target authority, with presenter subscriptions, explicit disconnect, and injectable inventory dependencies.
- [x] Make the CLI TUI and Web GUI use one relay instance. Retire the TUI's production SSH tunnel path and route its Web-open action through the stable relay origin.
- [x] Keep browser Settings and the TUI synchronized when either switches or the tunnel drops; cover target changes and cross-tab behavior with focused tests.
- [x] Verify source/native CLI builds, complete relevant tests, actual local Web/TUI surfaces, and a non-mutating connection to the registered Railway Linux `Main Cloud` Runtime. Do not use takeover, start, stop, update, or transfer on that host. CLI owner suite: 771 passed; disposable SSH system lane passed; real TUI/Web relay connected, switched, and disconnected from `Main Cloud` while its remote Runtime remained running.
- [x] Record the stable CLI boundary in owner docs and the Electron integration contract for the later increment. Implement Electron switching only after this CLI boundary is accepted.

Completion of this increment: one CLI process can switch from TUI or Web, both display the same selected target, browser traffic follows that target, and the previous backend remains running. The plan remains active for the later Electron increment; delete it and its index entry when that increment is accepted.
