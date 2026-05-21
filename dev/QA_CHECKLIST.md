# SoriGraph QA Checklist

Use this before sharing a build. Keep the UI unchanged unless a test exposes a real bug.

## After Effects Matrix

- AE 2020 / 17.x: launch panel, resize, scroll presets, open context menu, hover every submenu.
- AE 2022-2024: repeat the AE 2020 checks.
- AE 2025-2026: repeat the AE 2020 checks.

## Panel Sizes

- 220 px wide: graph stays usable, Apply is visible, preset grid scrolls.
- 260 px wide: direction preview row stays centered and compact.
- 320 px wide: default panel layout has no clipped buttons.
- 460-500 px wide: preset grid uses 4 columns when space allows.
- Tall and short panels: preset list scrolls with mouse wheel in AE 2020.

## Core Workflow

- Select a composition with animated Opacity, Scale, Position, Rotation, and separated dimensions.
- Select one or more keyframes, click Apply, then undo once.
- Read selected keyframe values, then Apply them again.
- Test directions: In, Out, Both.
- Test default locked library: saving should ask for a new library.
- Test custom library: create, rename, clear, delete, cancel delete, and delete confirm.

## Menu And Popup QA

- Right-click/three-dot preset menu in a narrow panel.
- Hover Copy value as, Manage library, and Select library; submenu should stay close to the row.
- Copy Bezier value, CSS cubic-bezier, JSON preset, and KBar export.
- Confirm alert popups use the dark SoriGraph theme.
- Warning/delete icon should feel compact, not oversized.

## Import Export

- Import `test-fixtures/sori-import-sample.txt`.
- Export that library as `.sorigraph` or `.sori`.
- Re-import the exported file into a clean library.
- Import at least one real Flow export (e.g. `.flow` files) and verify it parses curve `.value` correctly.

## Storage Recovery

- Back up `%APPDATA%\sori\sori-presets.json`.
- Temporarily replace it with invalid JSON.
- Relaunch the panel: it should create a `.corrupt-YYYYMMDD-HHMMSS.json` backup and recover.
- Restore the original file after the test.

## Keyboard Shortcuts

- Enter applies the current curve when no dialog/input is active.
- `[` selects the previous preset.
- `]` selects the next preset.
- `R` reads selected keyframe values.

