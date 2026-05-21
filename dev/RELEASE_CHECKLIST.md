# SoriGraph Release Checklist

## Preflight

- Confirm `CSXS/manifest.xml` host range still targets AE 2020+.
- Run `node --check panel/js/app.js`.
- Run `node --check panel/js/csinterface.js`.
- Run the full `QA_CHECKLIST.md` matrix.
- Confirm no unused runtime dependencies are listed in `package.json`.

## Versioning

- Bump `package.json` version.
- Keep `APP_VERSION` in `panel/js/app.js` aligned with `package.json`.
- Bump the `panel/index.html` cache query for changed JS/CSS files.
- Add a short changelog note for fixes and compatibility changes.

## Packaging

- Remove dev-only files from the distributable package if you do not want to ship them.
- Keep `node_modules/sweetalert2` because the panel loads SweetAlert locally.
- Do not include unused packages in `node_modules`.
- Include `CSXS`, `panel`, `public`, `package.json`, and `package-lock.json`.
- Test the packaged folder from a clean CEP extensions directory.

## Compatibility Notes

- CEP uses local file access and Node integration because the panel stores presets and loads local assets.
- The panel should not require internet access.
- AE 2020 uses an older Chromium build, so retest wheel scrolling and submenu placement after layout changes.

## Release Smoke Test

- Install the packaged build into the Adobe CEP extensions folder.
- Relaunch After Effects.
- Open Window > Extensions > SoriGraph.
- Create a custom library, save a preset, export it, relaunch AE, and confirm it persists.
- Apply a curve to selected keyframes and undo once.

