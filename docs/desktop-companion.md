# Desktop companion

The normal desktop and isolated Electron demo start one Alice companion window
from `apps/desktop/src/app-window.ts`. It shares the Electron main process and
adds a renderer, with no additional Guardian, Alice, UTA or remote connection.
Closing the main window destroys the companion; minimizing the main window
leaves the companion available. The menu/tray can restore the main window.

The first version uses a maintainer-supplied character and a generated speech bubble in
`ui/public/companion/`. Its local speech is decorative, never a claim about an
Agent's execution status. Single click cycles through short lines, double click
opens the main window, and right click opens the native menu. The tray remains
available after hiding Alice. Position, size and visibility are machine-local
launcher preferences in Electron userData `companion.json`.

Interaction follows MeteorNOX's Whale Widget (MIT attribution ships in
`ui/public/companion/NOTICE.md`): bottom-anchored 0.88Y/1.05X press transform,
220ms `cubic-bezier(.34,1.56,.64,1)`, 3-DIP drag threshold, 300ms mirror,
160ms CSS-ease snapping, 10% side and 15% bottom snap zones, no top snap.
The replacement speech bubble has a connected lower-right tail, rather than
the original thought dots. It scales/fades in as one image over 200ms from its
tail; text follows at 120ms. This visual revision is distinct from the upstream
staggered thought-dot animation.
The bubble sits 80% of the character stage width to the left, with its top at
26% of stage height minus 55 DIPs. It forms an above-left composition with clear
space around the bow, rather than sitting directly beside the face.
Symmetric transparent window gutters preserve the artwork size
and prevent clipping; mirroring puts the bubble on the opposite side. Alpha
hit testing still targets only the character, not the additional empty space.
System reduced-motion disables the transitions. Transparent pixels pass input
through to the desktop. Keyboard Space/Enter speaks; Escape dismisses speech;
Shift+F10 opens the menu.

The native window uses a dedicated narrow preload, sender/frame-checked IPC,
context isolation, no renderer Node APIs, a local-only CSP, and blocked
navigation/popups. Windows uses a transparent toolbar window; macOS makes the
companion visible across Spaces without transforming the app's Dock identity.
Geometry uses Electron DIPs and monitor work areas, including negative monitor
coordinates. Removing a monitor or changing display metrics brings the window
back into a remaining work area. `OPENALICE_DISABLE_COMPANION=1` is a launcher
kill switch.

Assets are copied by the existing UI public-assets build into the packaged
`Resources/runtime/ui/dist/companion` directory. Package assertions require
the images, renderer, attribution and compiled preload.

## Verification

```bash
pnpm -F @traderalice/guardian-runtime build
pnpm electron:tsc
pnpm -F @traderalice/desktop exec electron ../../dist/electron/companion-preview.js --smoke
pnpm test:owner:desktop
pnpm electron:smoke:demo
```

The companion smoke creates a disposable Electron profile without a backend.
It checks real preload/PNG decode, alpha, press/release, speech and mirroring,
and saves native renderer captures in its printed temporary directory. Omitting
`--smoke` leaves the preview running. The native Desktop Package Smoke workflow
runs this acceptance on macOS and Windows; package/workspace acceptance remains
separate. Real display composition, cross-monitor drag and click-through still
need native desktop interaction in addition to renderer captures.
