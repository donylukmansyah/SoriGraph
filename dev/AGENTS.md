# SoriGraph - Agent Instructions

This repository is an Adobe After Effects CEP extension.

## Development & Environment
- **Platform:** Adobe After Effects 2020+. CEP extension architecture.
- **Node.js:** Enabled via CEP. The panel must run without internet access.
- **Data Storage:** Presets are stored at `%APPDATA%\sori\sori-presets.json`.

## Maintenance & Release
- **Syntax Check:** Run `node --check panel/js/app.js` and `node --check panel/js/csinterface.js` to verify syntax before any major changes or releases.
- **Versioning:**
    - `package.json` version and `panel/js/app.js` `APP_VERSION` must be kept in sync.
    - Update the cache query parameter in `panel/index.html` whenever JS/CSS files are modified.
- **Packaging:** Ensure `node_modules/sweetalert2` is included, as the panel relies on it being available locally.
- **Dependencies:** The panel must not require internet access. Keep `node_modules` minimal, only including required dependencies.

## Testing Quirks
- **Compatibility:** Test layout and behavior across AE 2020, 2022, and 2025+ as older Chromium versions in AE 2020 may behave differently with CSS/layout.
- **Storage:** Refer to `QA_CHECKLIST.md` for storage corruption recovery testing (`%APPDATA%\sori\sori-presets.json`).
- **Shortcuts:**
    - `Enter`: Apply curve.
    - `[` / `]`: Navigate presets.
    - `R`: Read keyframe values.
