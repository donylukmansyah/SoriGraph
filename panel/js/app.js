(function () {
  "use strict";

  var PRIMARY = "#7A43F5";
  var STORAGE_KEY = "sori.flow.state.v1";
  var STORAGE_FILE = "sori-presets.json";
  var MIN_Y = -0.8;
  var MAX_Y = 1.8;
  var GRAPH_PAD_MIN = 6;
  var GRAPH_PAD_MAX = 28;
  var SNAP_STEP = 0.025;
  var MAX_AE_SPEED = 0;
  var APP_VERSION = "1.0.0";

  var cs = new CSInterface();
  var storageRecoveryNotice = "";
  var storageRecovered = false;
  var runtime = {
    hostVersion: 0,
    legacyCep: false
  };
  var state = {
    graphMode: "value",
    curve: [0, 1, 1, 0],
    previousCurve: null,
    selectedPresetId: "flow-snap",
    activeLibraryId: "default",
    modeState: {},
    libraries: [],
    direction: "both",
    copiedEase: null,
    splitterHeight: null,
    splitterWidth: null,
    presetScale: 1
  };

  var els = {};
  var graph = {
    rect: null,
    drag: null,
    dpr: 1,
    animRafId: null,
    ghostFadeId: null,
    layoutMode: null
  };

  var DEFAULT_PRESETS = [
    preset("linear", "linear", [0, 0, 1, 1]),
    preset("easeIn", "easeIn", [0.42, 0, 1, 1]),
    preset("easeOut", "easeOut", [0, 0, 0.58, 1]),
    preset("ease", "Easy Ease / F9", [0.25, 0.1, 0.25, 1]),
    preset("flow-snap", "Snap / Extreme", [0, 1, 1, 0]),
    preset("sineIn", "sineIn", [0.47, 0, 0.745, 0.715]),
    preset("sineOut", "sineOut", [0.39, 0.575, 0.565, 1]),
    preset("sine", "sine", [0.445, 0.05, 0.55, 0.95]),
    preset("quadIn", "quadIn", [0.55, 0.085, 0.68, 0.53]),
    preset("quadOut", "quadOut", [0.25, 0.46, 0.45, 0.94]),
    preset("quad", "quad", [0.455, 0.03, 0.515, 0.955]),
    preset("cubicIn", "cubicIn", [0.55, 0.055, 0.675, 0.19]),
    preset("cubicOut", "cubicOut", [0.215, 0.61, 0.355, 1]),
    preset("cubic", "cubic", [0.645, 0.045, 0.355, 1]),
    preset("quartIn", "quartIn", [0.895, 0.03, 0.685, 0.22]),
    preset("quartOut", "quartOut", [0.165, 0.84, 0.44, 1]),
    preset("quart", "quart", [0.77, 0, 0.175, 1]),
    preset("quintIn", "quintIn", [0.755, 0.05, 0.855, 0.06]),
    preset("quintOut", "quintOut", [0.23, 1, 0.32, 1]),
    preset("quint", "quint", [0.86, 0, 0.07, 1]),
    preset("expoIn", "expoIn", [0.95, 0.05, 0.795, 0.035]),
    preset("expoOut", "expoOut", [0.19, 1, 0.22, 1]),
    preset("expo", "expo", [1, 0, 0, 1]),
    preset("circIn", "circIn", [0.6, 0.04, 0.98, 0.335]),
    preset("circOut", "circOut", [0.075, 0.82, 0.165, 1]),
    preset("circ", "circ", [0.785, 0.135, 0.15, 0.86]),
    preset("backIn", "backIn", [0.6, -0.28, 0.735, 0.045]),
    preset("backOut", "backOut", [0.175, 0.885, 0.32, 1.275]),
    preset("back", "back", [0.68, -0.55, 0.265, 1.55])
  ];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    // Dynamically load JSX to ensure the latest changes on disk are evaluated in AE
    try {
      var extensionPath = cs.getSystemPath(SystemPath.EXTENSION);
      var jsxPath = extensionPath + "/panel/jsx/main.jsx";
      cs.evalScript('$.evalFile("' + jsxPath.replace(/\\/g, '/') + '")');
    } catch (e) {
      console.warn("Failed to dynamically load JSX on init:", e);
    }

    cacheElements();
    detectRuntime();
    bootIcons();
    loadState();
    wireEvents();
    updateGraphModeUI();
    updateCurvePreview();
    applyPresetScale();
    renderLibraries();
    renderPresets();
    selectPreset(state.selectedPresetId, false);
    restoreEaseClipboard();
    updateEaseTransferButton();
    resizeCanvas();
    draw();
    window.setTimeout(resizeCanvas, 60);
    if (storageRecovered && storageRecoveryNotice) {
      saveState();
      window.setTimeout(function () {
        toast("warning", storageRecoveryNotice);
      }, 250);
    }
  }

  function cacheElements() {
    els.appShell = document.querySelector(".app-shell");
    els.brandLink = document.getElementById("brandLink");
    els.graphPane = document.getElementById("graphPane");
    els.libraryPane = document.getElementById("libraryPane");
    els.graphStage = document.getElementById("graphStage");
    els.canvas = document.getElementById("graphCanvas");
    els.ghostCanvas = document.getElementById("ghostCanvas");
    els.handle1 = document.getElementById("handle1");
    els.handle2 = document.getElementById("handle2");
    els.snapBadge = document.getElementById("snapBadge");
    els.snapHandle1 = document.getElementById("snapHandle1");
    els.snapHandle2 = document.getElementById("snapHandle2");
    els.valueBtn = document.getElementById("valueBtn");
    els.techCoords = document.getElementById("techCoords");
    els.statusText = document.getElementById("statusText");
    els.statusDot = document.querySelector(".status-dot");
    els.valueRow = document.querySelector(".value-row");
    els.controlsContainer = document.querySelector(".controls-container");
    els.bottomBar = document.querySelector(".bottom-bar");
    els.applyBtn = document.getElementById("applyBtn");
    els.saveBtn = document.getElementById("saveBtn");
    els.flipBtn = document.getElementById("flipBtn");
    els.resetBtn = document.getElementById("resetBtn");
    els.readBtn = document.getElementById("readBtn");
    els.copyEaseBtn = document.getElementById("copyEaseBtn");
    els.pasteEaseBtn = document.getElementById("pasteEaseBtn");
    els.splitter = document.getElementById("splitter");
    els.librarySelect = document.getElementById("librarySelect");
    els.presetGrid = document.getElementById("presetGrid");
    els.newLibraryBtn = document.getElementById("newLibraryBtn");
    els.importBtn = document.getElementById("importBtn");
    els.exportBtn = document.getElementById("exportBtn");
    els.deleteLibraryBtn = document.getElementById("deleteLibraryBtn");
    els.importFile = document.getElementById("importFile");
    els.controlsAnchor = document.createComment("graph-controls-anchor");
    if (els.controlsContainer && els.controlsContainer.parentNode) {
      els.controlsContainer.parentNode.insertBefore(els.controlsAnchor, els.controlsContainer);
    }
  }

  function bootIcons() {
    /* Icons are now inline SVGs in index.html — no Lucide runtime needed.
       This function is kept as a no-op for compatibility. */
  }

  function detectRuntime() {
    var hostVersion = 0;
    var userAgent = navigator.userAgent || "";
    var chromeMatch = userAgent.match(/Chrom(?:e|ium)\/(\d+)/i);
    var chromeMajor = chromeMatch ? Number(chromeMatch[1]) : 0;

    try {
      if (cs && cs.getHostEnvironment) {
        var host = cs.getHostEnvironment();
        var version = host && (host.appVersion || host.version || "");
        hostVersion = parseFloat(version) || 0;
      }
    } catch (error) {}

    runtime.hostVersion = hostVersion;
    runtime.legacyCep = (hostVersion > 0 && hostVersion < 18) || (chromeMajor > 0 && chromeMajor <= 74);
    document.body.classList.toggle("legacy-cep", runtime.legacyCep);
  }

  function wireEvents() {
    window.addEventListener("resize", resizeCanvas);

    // ResizeObserver: catches ALL panel size changes in AE (timeline drag, panel dock, etc.)
    // Falls back to polling for legacy CEP (AE 2020 / Chromium 61)
    if (typeof ResizeObserver !== "undefined" && els.appShell) {
      var ro = new ResizeObserver(function () {
        resizeCanvas();
      });
      ro.observe(els.appShell);
    } else if (els.appShell) {
      var lastW = 0, lastH = 0;
      setInterval(function () {
        var w = els.appShell.offsetWidth;
        var h = els.appShell.offsetHeight;
        if (w !== lastW || h !== lastH) {
          lastW = w;
          lastH = h;
          resizeCanvas();
        }
      }, 200);
    }
    document.addEventListener("mousedown", function () {
      document.body.classList.remove("using-keyboard");
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Tab") {
        document.body.classList.add("using-keyboard");
      }
    });
    if (els.brandLink) {
      els.brandLink.addEventListener("click", openBrandSite);
    }
    els.graphStage.addEventListener("mousedown", stageMouseDown);
    els.handle1.addEventListener("mousedown", handleMouseDown);
    els.handle2.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", documentMouseMove);
    document.addEventListener("mouseup", documentMouseUp);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Shift" && graph.drag) {
        els.snapBadge.classList.add("visible");
      }

      // Check for Ctrl+C or Ctrl+V clipboard operations (with modifiers)
      if ((event.ctrlKey || event.metaKey) && !isTypingOrPopupActive()) {
        if (event.key === "c" || event.key === "C") {
          event.preventDefault();
          copyEase();
          return;
        } else if (event.key === "v" || event.key === "V") {
          event.preventDefault();
          pasteEase();
          return;
        }
      }

      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || isTypingOrPopupActive()) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        applyCurve();
      } else if (event.key === "[") {
        event.preventDefault();
        navigatePreset(-1);
      } else if (event.key === "]") {
        event.preventDefault();
        navigatePreset(1);
      } else if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        readCurve();
      } else if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        copyEase();
      } else if (event.key === "v" || event.key === "V") {
        event.preventDefault();
        pasteEase();
      }
    });
    document.addEventListener("keyup", function (event) {
      if (event.key === "Shift") {
        els.snapBadge.classList.remove("visible");
      }
    });

    els.valueBtn.addEventListener("click", editValues);
    els.applyBtn.addEventListener("click", applyCurve);
    els.saveBtn.addEventListener("click", saveCurrentPreset);
    els.flipBtn.addEventListener("click", flipCurve);
    els.resetBtn.addEventListener("click", resetToSelectedPreset);
    els.readBtn.addEventListener("click", readCurve);
    els.copyEaseBtn.addEventListener("click", copyEase);
    els.pasteEaseBtn.addEventListener("click", pasteEase);

    els.librarySelect.addEventListener("change", function () {
      state.activeLibraryId = els.librarySelect.value;
      saveState();
      renderPresets();
      syncLockedLibraryButtons();
    });

    els.newLibraryBtn.addEventListener("click", createLibrary);
    els.importBtn.addEventListener("click", chooseImportLibrary);
    els.importFile.addEventListener("change", importLibrary);
    els.exportBtn.addEventListener("click", exportLibrary);
    els.deleteLibraryBtn.addEventListener("click", deleteLibrary);

    els.splitter.addEventListener("mousedown", startResize);
    els.presetGrid.addEventListener("wheel", handlePresetGridWheel, false);

    // Scroll fallback for older CEP (Chromium 61/74).
    // Some AE 2020 CEF builds fail to move nested overflow panes natively.
    var scrollTarget = els.presetGrid;
    function handleWheelScroll(e) {
      if (isPresetZoomWheel(e)) {
        handlePresetGridWheel(e);
        return;
      }

      var delta = 0;
      if (typeof e.deltaY === "number" && e.deltaY !== 0) {
        delta = e.deltaY;
        if (e.deltaMode === 1) {
          delta *= 16;
        } else if (e.deltaMode === 2) {
          delta *= Math.max(scrollTarget.clientHeight, 1);
        }
      } else if (typeof e.wheelDelta === "number" && e.wheelDelta !== 0) {
        delta = -e.wheelDelta;
      } else if (typeof e.detail === "number" && e.detail !== 0) {
        delta = e.detail * 16;
      }

      if (delta) {
        scrollTarget.scrollTop += delta;
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function addWheelFallback(target) {
      if (!target) {
        return;
      }
      target.addEventListener("wheel", handleWheelScroll, false);
      target.addEventListener("mousewheel", handleWheelScroll, false);
      target.addEventListener("DOMMouseScroll", handleWheelScroll, false);
    }

    addWheelFallback(scrollTarget);
    addWheelFallback(els.libraryPane);
  }

  function openBrandSite(event) {
    var url = "https://www.soriscp.com/";
    if (event) {
      event.preventDefault();
    }
    try {
      if (window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser) {
        window.cep.util.openURLInDefaultBrowser(url);
        return;
      }
    } catch (error) {}
    window.open(url, "_blank");
  }

  function isPresetZoomWheel(event) {
    return !!(event && (event.ctrlKey || event.metaKey) && closestElement(event.target, ".preset-grid"));
  }

  function handlePresetGridWheel(event) {
    if (!isPresetZoomWheel(event)) {
      return;
    }

    var delta = getWheelDelta(event);
    if (!delta) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) {
      event.stopImmediatePropagation();
    }

    var step = event.shiftKey ? 0.03 : 0.08;
    var nextScale = state.presetScale + (delta < 0 ? step : -step);
    setPresetScale(nextScale, true);
  }

  function getWheelDelta(event) {
    if (typeof event.deltaY === "number" && event.deltaY !== 0) {
      if (event.deltaMode === 1) {
        return event.deltaY * 16;
      }
      if (event.deltaMode === 2) {
        return event.deltaY * Math.max(els.presetGrid.clientHeight, 1);
      }
      return event.deltaY;
    }
    if (typeof event.wheelDelta === "number" && event.wheelDelta !== 0) {
      return -event.wheelDelta;
    }
    if (typeof event.detail === "number" && event.detail !== 0) {
      return event.detail * 16;
    }
    return 0;
  }

  function closestElement(node, selector) {
    while (node && node !== document) {
      if (node.matches && node.matches(selector)) {
        return node;
      }
      if (node.msMatchesSelector && node.msMatchesSelector(selector)) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function setPresetScale(nextScale, shouldSave) {
    state.presetScale = clamp(nextScale, 0.7, 1.5);
    applyPresetScale();
    if (shouldSave) {
      saveState();
      updateStatus("PRESET SIZE " + Math.round(state.presetScale * 100) + "%", "editing");
    }
  }

  function applyPresetScale() {
    var graphScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--graph-scale")) || 1;
    var scale = clamp((state.presetScale || 1) * graphScale, 0.64, 1.5);
    document.documentElement.style.setProperty("--preset-card-min", Math.round(68 * scale) + "px");
    document.documentElement.style.setProperty("--preset-card-height", Math.round(72 * scale) + "px");
    document.documentElement.style.setProperty("--preset-svg-height", Math.round(44 * scale) + "px");
    document.documentElement.style.setProperty("--preset-card-radius", Math.round(12 * scale) + "px");
    document.documentElement.style.setProperty("--preset-card-pad-y", Math.max(4, Math.round(6 * scale)) + "px");
    document.documentElement.style.setProperty("--preset-card-pad-x", Math.max(3, Math.round(4 * scale)) + "px");
    document.documentElement.style.setProperty("--preset-label-size", Math.max(8.5, roundTo(10 * scale, 1)) + "px");
    document.documentElement.style.setProperty("--preset-grid-gap", Math.max(5, Math.round(8 * scale)) + "px");
    syncPresetGridClearance();
  }

  function syncPresetGridClearance() {
    if (!els.bottomBar) {
      return;
    }

    var barHeight = els.bottomBar.getBoundingClientRect().height || 42;
    var graphScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--graph-scale")) || 1;
    var breathingRoom = Math.max(6, Math.round(8 * graphScale * (state.presetScale || 1)));
    document.documentElement.style.setProperty("--preset-grid-bottom-pad", Math.ceil(barHeight + breathingRoom) + "px");
  }

  function loadState() {
    state.libraries = [
      {
        id: "default",
        name: "default",
        mode: "value",
        locked: true,
        presets: clonePresets(DEFAULT_PRESETS)
      }
    ];
    state.modeState = {
      value: {
        activeLibraryId: "default",
        selectedPresetId: "flow-snap",
        curve: [0, 1, 1, 0]
      }
    };

    try {
      var saved = readPersistedState();
      state.activeLibraryId = saved.activeLibraryId || "default";
      state.selectedPresetId = saved.selectedPresetId || "flow-snap";
      state.direction = saved.direction || "both";
      state.graphMode = saved.graphMode || "value";
      if (saved.curve instanceof Array && saved.curve.length === 4) {
        state.curve = cleanCurve(saved.curve);
      }
      if (saved.libraries instanceof Array) {
        for (var i = 0; i < saved.libraries.length; i += 1) {
          if (saved.libraries[i] && saved.libraries[i].id !== "default") {
            state.libraries.push(normalizeLibrary(saved.libraries[i]));
          }
        }
      }
      if (typeof saved.splitterHeight === "number") {
        state.splitterHeight = saved.splitterHeight > 100 ? clamp((saved.splitterHeight / 400) * 100, 20, 80) : saved.splitterHeight;
      }
      if (typeof saved.splitterWidth === "number") {
        state.splitterWidth = saved.splitterWidth > 100 ? clamp((saved.splitterWidth / 300) * 100, 20, 80) : saved.splitterWidth;
      }
      if (typeof saved.presetScale === "number") {
        state.presetScale = clamp(saved.presetScale, 0.7, 1.5);
      }
    } catch (error) {}

    state.curve = cleanCurve(state.curve || [0, 1, 1, 0]);

    if (!findLibrary(state.activeLibraryId)) {
      state.activeLibraryId = "default";
    }
  }

  function saveState() {
    var customLibraries = [];
    for (var i = 0; i < state.libraries.length; i += 1) {
      if (!state.libraries[i].locked) {
        customLibraries.push(state.libraries[i]);
      }
    }

    writePersistedState({
      activeLibraryId: state.activeLibraryId,
      selectedPresetId: state.selectedPresetId,
      graphMode: state.graphMode || "value",
      direction: state.direction,
      curve: state.curve,
      libraries: customLibraries,
      splitterHeight: state.splitterHeight,
      splitterWidth: state.splitterWidth,
      presetScale: state.presetScale
    });
  }

  function defaultModeState() {
    return {
      value: {
        activeLibraryId: "default",
        selectedPresetId: "flow-snap",
        curve: [0, 1, 1, 0]
      }
    };
  }

  function normalizeGraphMode(mode) {
    return "value";
  }

  function normalizeModeState(saved) {
    return {
      value: {
        activeLibraryId: (saved && saved.value && saved.value.activeLibraryId) || "default",
        selectedPresetId: (saved && saved.value && saved.value.selectedPresetId) || "flow-snap",
        curve: (saved && saved.value && saved.value.curve instanceof Array && saved.value.curve.length === 4) ? cleanCurve(saved.value.curve) : [0, 1, 1, 0]
      }
    };
  }

  function rememberModeState() {
    state.modeState = {
      value: {
        activeLibraryId: state.activeLibraryId,
        selectedPresetId: state.selectedPresetId,
        curve: cleanCurve(state.curve)
      }
    };
    return state.modeState;
  }

  function restoreModeState(mode) {
    state.graphMode = "value";
    state.curve = cleanCurve(state.curve || [0, 1, 1, 0]);
  }

  function defaultLibraryIdForMode(mode) {
    return "default";
  }

  function defaultPresetIdForMode(mode) {
    return "flow-snap";
  }

  function defaultCurveForMode(mode) {
    return [0, 1, 1, 0];
  }

  function libraryMode(library) {
    return "value";
  }

  function isCurrentModeLibrary(library) {
    return true;
  }

  function readPersistedState() {
    var raw = "";
    var filePath = getStorageFilePath();

    if (filePath) {
      try {
        raw = require("fs").readFileSync(filePath, "utf8");
        var fileState = parsePersistedState(raw, {
          kind: "file",
          filePath: filePath
        });
        if (fileState) {
          return fileState;
        }
      } catch (error) {}
    }

    raw = localStorage.getItem(STORAGE_KEY) || "{}";
    return parsePersistedState(raw, {
      kind: "localStorage"
    }) || {};
  }

  function parsePersistedState(raw, source) {
    try {
      return JSON.parse(raw || "{}");
    } catch (error) {
      recoverCorruptStorage(raw, source, error);
    }

    return null;
  }

  function recoverCorruptStorage(raw, source, error) {
    if (!raw) {
      return;
    }

    if (source && source.kind === "file" && source.filePath) {
      backupCorruptStorageFile(source.filePath);
      storageRecoveryNotice = "Preset file was backed up and repaired.";
      storageRecovered = true;
    } else if (source && source.kind === "localStorage") {
      backupCorruptLocalStorage(raw);
      storageRecoveryNotice = "Preset cache was backed up and repaired.";
      storageRecovered = true;
    }

    console.warn("Recovered corrupt sori preset storage", error);
  }

  function backupCorruptStorageFile(filePath) {
    try {
      var fs = require("fs");
      var path = require("path");
      if (!fs.existsSync(filePath)) {
        return;
      }
      var parsed = path.parse(filePath);
      var backupPath = path.join(parsed.dir, parsed.name + ".corrupt-" + timestampForFile() + parsed.ext);
      fs.copyFileSync(filePath, backupPath);
    } catch (error) {
      console.warn("Could not back up corrupt sori presets file", error);
    }
  }

  function backupCorruptLocalStorage(raw) {
    try {
      localStorage.setItem(STORAGE_KEY + ".corrupt." + timestampForFile(), raw);
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("Could not back up corrupt sori preset cache", error);
    }
  }

  function timestampForFile() {
    var date = new Date();
    function pad(value) {
      return value < 10 ? "0" + value : String(value);
    }
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      "-",
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join("");
  }

  function writePersistedState(payload) {
    var serialized = JSON.stringify(payload, null, 2);
    localStorage.setItem(STORAGE_KEY, serialized);

    var filePath = getStorageFilePath();
    if (!filePath) {
      return;
    }

    try {
      var fs = require("fs");
      var path = require("path");
      ensureDir(path.dirname(filePath));
      fs.writeFile(filePath, serialized, "utf8", function (err) {
        if (err) {
          console.warn("Could not save sori presets file", err);
        }
      });
    } catch (error) {
      console.warn("Could not save sori presets file", error);
    }
  }

  function getStorageFilePath() {
    if (typeof require !== "function") {
      return "";
    }

    try {
      var path = require("path");
      var base = "";

      if (typeof process !== "undefined" && process.env) {
        base = process.env.APPDATA || process.env.HOME || process.env.USERPROFILE || "";
      }

      if (!base && cs && cs.getSystemPath) {
        base = cs.getSystemPath("userData") || "";
      }

      return base ? path.join(base, "sori", STORAGE_FILE) : "";
    } catch (error) {
      return "";
    }
  }

  function ensureDir(dirPath) {
    var fs = require("fs");
    var path = require("path");
    if (!dirPath || fs.existsSync(dirPath)) {
      return;
    }
    ensureDir(path.dirname(dirPath));
    try {
      fs.mkdirSync(dirPath);
    } catch (error) {
      if (!fs.existsSync(dirPath)) {
        throw error;
      }
    }
  }

  function renderLibraries() {
    els.librarySelect.innerHTML = "";
    if (!findLibrary(state.activeLibraryId) || !isCurrentModeLibrary(findLibrary(state.activeLibraryId))) {
      state.activeLibraryId = defaultLibraryIdForMode(state.graphMode);
    }
    for (var i = 0; i < state.libraries.length; i += 1) {
      var lib = state.libraries[i];
      if (!isCurrentModeLibrary(lib)) {
        continue;
      }
      var option = document.createElement("option");
      option.value = lib.id;
      option.textContent = lib.name;
      els.librarySelect.appendChild(option);
    }
    els.librarySelect.value = state.activeLibraryId;
    syncLockedLibraryButtons();
  }

  function syncLockedLibraryButtons() {
    var library = findLibrary(state.activeLibraryId);
    var isLocked = library && library.locked;
    els.exportBtn.disabled = !!isLocked;
    els.deleteLibraryBtn.disabled = !!isLocked;
  }

  function updateGraphModeUI() {
    if (els.valueBtn) {
      els.valueBtn.title = "Edit bezier values";
    }
  }

  function renderPresets() {
    var library = findLibrary(state.activeLibraryId);
    els.presetGrid.innerHTML = "";

    if (!library) {
      return;
    }

    for (var i = 0; i < library.presets.length; i += 1) {
      els.presetGrid.appendChild(createPresetNode(library.presets[i], library.locked));
    }
  }

  function createPresetNode(item, locked) {
    var button = document.createElement("button");
    button.className = "preset" + (item.id === state.selectedPresetId ? " selected" : "");
    button.type = "button";
    button.title = item.name + " - " + formatCurve(item.curve);
    button.dataset.id = item.id;
    button.innerHTML = miniCurveSvg(item.curve) + "<span class=\"preset-label\"></span>";
    button.querySelector(".preset-label").textContent = item.name;
    button.addEventListener("click", function () {
      selectPreset(item.id, true);
    });
    button.addEventListener("dblclick", function (event) {
      event.preventDefault();
      selectPreset(item.id, true);
      window.setTimeout(applyCurve, runtime.legacyCep ? 260 : 180);
    });

    if (!locked) {
      var actions = document.createElement("span");
      actions.className = "preset-actions";
      actions.title = "Preset actions";
      actions.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="12" r="2"/></svg>';
      actions.addEventListener("click", function (event) {
        event.stopPropagation();
        openPresetMenu(event, item.id);
      });
      button.appendChild(actions);
    }

    button.addEventListener("contextmenu", function (event) {
      if (locked) {
        return;
      }
      event.preventDefault();
      openPresetMenu(event, item.id);
    });

    return button;
  }

  function updateStatus(text, stateClass) {
    if (els.statusText) {
      els.statusText.textContent = text.toUpperCase();
    }
    if (els.statusDot) {
      els.statusDot.classList.remove("ready", "editing", "applying", "success", "error");
      if (stateClass) {
        els.statusDot.classList.add(stateClass);
      }
    }
  }

  function selectPreset(id, animate) {
    var item = findPreset(id);
    if (!item) {
      item = findPreset(defaultPresetIdForMode(state.graphMode)) || findPresetInLibrary(findLibrary(defaultLibraryIdForMode(state.graphMode)), defaultPresetIdForMode(state.graphMode));
    }
    if (!item) {
      return;
    }

    state.selectedPresetId = item.id;
    updateStatus(item.name, "ready");
    if (animate) {
      animateCurve(item.curve);
    } else {
      state.curve = cleanCurve(item.curve);
      updateValueText();
      draw();
    }

    saveState();
    updatePresetSelection();
    updateCurvePreview();
  }

  function updatePresetSelection() {
    var nodes = document.querySelectorAll(".preset");
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].classList.toggle("selected", nodes[i].dataset.id === state.selectedPresetId);
    }
  }

  function resizeCanvas() {
    syncResponsiveLayout();
    var rect = els.graphStage.getBoundingClientRect();
    graph.rect = rect;
    graph.dpr = runtime.legacyCep ? Math.min(window.devicePixelRatio || 1, 1.25) : (window.devicePixelRatio || 1);
    resizeOneCanvas(els.canvas, rect, graph.dpr);
    resizeOneCanvas(els.ghostCanvas, rect, graph.dpr);
    draw();
  }

  function syncResponsiveLayout() {
    var mode = isVerticalLayout() ? "vertical" : "horizontal";
    if (graph.layoutMode !== mode) {
      if (mode === "vertical") {
        if (typeof state.splitterHeight === "number") {
          els.graphPane.style.flexBasis = state.splitterHeight + "%";
        } else {
          els.graphPane.style.flexBasis = "";
        }
      } else {
        if (typeof state.splitterWidth === "number") {
          els.graphPane.style.flexBasis = state.splitterWidth + "%";
        } else {
          els.graphPane.style.flexBasis = "";
        }
      }
    }
    graph.layoutMode = mode;
    syncGraphStageSize();
  }

  function syncGraphStageSize() {
    if (!els.graphPane || !els.graphStage) {
      return;
    }

    var paneRect = els.graphPane.getBoundingClientRect();
    var collapsed = paneRect.height <= 4;
    syncCollapsedControls(collapsed);

    var fixedHeight = 0;
    var children = els.graphPane.children;

    for (var i = 0; i < children.length; i += 1) {
      if (children[i] !== els.graphStage) {
        fixedHeight += children[i].getBoundingClientRect().height;
      }
    }

    var stageHeight = Math.max(0, paneRect.height - fixedHeight);
    var size = Math.max(0, Math.min(paneRect.width, stageHeight));

    els.graphStage.style.width = size + "px";
    els.graphStage.style.height = size + "px";
    els.graphStage.style.flexBasis = size + "px";
    els.graphStage.style.maxWidth = size + "px";
    els.graphStage.style.alignSelf = "";
    els.graphStage.style.margin = "auto";
    els.graphStage.style.setProperty("--graph-pad", graphPad({ width: size, height: size }) + "px");

    // Keep the AE 2020 small-panel controls readable while preserving the large layout.
    var scaleSource = size || Math.min(paneRect.width || 280, paneRect.height || 280);
    var scale = clamp(scaleSource / 300, 0.92, 1.0);
    document.documentElement.style.setProperty("--graph-scale", scale.toFixed(3));
    applyPresetScale();

    els.graphPane.classList.toggle("graph-collapsed", collapsed);

    if (els.controlsContainer) {
      els.controlsContainer.classList.toggle("mini-controls", paneRect.width < 225);
    }

    if (els.appShell) {
      els.appShell.classList.toggle("controls-docked", collapsed);
    }
  }

  function syncCollapsedControls(collapsed) {
    if (!els.appShell || !els.controlsAnchor || !els.controlsContainer) {
      return;
    }

    if (collapsed && els.controlsContainer.parentNode !== els.appShell) {
      els.appShell.appendChild(els.controlsContainer);
    } else if (!collapsed && els.controlsContainer.parentNode === els.appShell) {
      var parent = els.controlsAnchor.parentNode;
      if (parent) {
        parent.insertBefore(els.controlsContainer, els.controlsAnchor.nextSibling);
      }
    }
  }

  function graphPad(rect) {
    var size = Math.min(rect.width || 0, rect.height || 0);
    // Scale padding proportionally: 8% for tiny, 6% for normal
    var ratio = size < 120 ? 0.08 : 0.06;
    return clamp(Math.round(size * ratio), GRAPH_PAD_MIN, GRAPH_PAD_MAX);
  }

  function resizeOneCanvas(canvas, rect, dpr) {
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round((rect.height + 120) * dpr));
    canvas.style.width = rect.width + "px";
    canvas.style.height = (rect.height + 120) + "px";
    canvas.style.top = "-60px";
  }



  function draw(ghostOpacity, skipValueText) {
    drawCanvas(els.ghostCanvas, state.previousCurve, true);
    if (typeof ghostOpacity === "number") {
      els.ghostCanvas.style.opacity = ghostOpacity;
    }
    drawCanvas(els.canvas, state.curve, false);
    positionHandles();
    if (!skipValueText) {
      updateValueText();
    } else {
      updateCurvePreview();
    }
  }

  function drawCanvas(canvas, curve, ghost) {
    var ctx = canvas.getContext("2d");
    var rect = graph.rect || els.graphStage.getBoundingClientRect();
    var dpr = graph.dpr || 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height + 120);
    ctx.translate(0, 60);

    if (!ghost) {
      drawGrid(ctx, rect);
    }

    if (!curve) {
      return;
    }

    // Classic Value Graph Mode
    var p0 = curveToScreen([0, 0]);
    var p1 = curveToScreen([curve[0], curve[1]]);
    var p2 = curveToScreen([curve[2], curve[3]]);
    var p3 = curveToScreen([1, 1]);

    // Scale stroke widths for small graphs
    var stageSize = Math.min(rect.width || 0, rect.height || 0);
    var scale = stageSize < 80 ? 0.6 : (stageSize < 120 ? 0.78 : 1);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (!ghost) {
      ctx.strokeStyle = "rgba(122, 67, 245, 0.45)";
      ctx.lineWidth = 1.2 * scale;
      var dashSize = Math.max(2, Math.round(4 * scale));
      ctx.setLineDash([dashSize, dashSize]);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = ghost ? "rgba(122, 67, 245, 0.22)" : "rgba(122, 67, 245, 0.95)";
    ctx.lineWidth = ghost ? (2 * scale) : (2.8 * scale);
    ctx.shadowBlur = (ghost || runtime.legacyCep) ? 0 : Math.round(14 * scale);
    ctx.shadowColor = ghost ? "transparent" : "rgba(122, 67, 245, 0.45)";
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (!ghost) {
      var dotR = Math.max(2, 3.5 * scale);
      drawPoint(ctx, p0, dotR, "rgba(122, 67, 245, 0.9)");
      drawPoint(ctx, p3, dotR, "rgba(122, 67, 245, 0.9)");
    }
  }

  function drawPoint(ctx, point, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGrid(ctx, rect) {
    var pad = graphPad(rect);
    var w = Math.max(1, rect.width - pad * 2);
    var h = Math.max(1, rect.height - pad * 2);
    var size = Math.min(rect.width || 0, rect.height || 0);

    // Adapt grid density based on graph size
    var divisions = size < 80 ? 2 : (size < 120 ? 3 : 5);
    var gridOpacity = size < 80 ? 0.05 : 0.08;
    var diagOpacity = size < 80 ? 0.08 : 0.15;
    var lineWidth = size < 80 ? 0.5 : 1;

    // 1. Draw adaptive grid
    ctx.strokeStyle = "rgba(255, 255, 255, " + gridOpacity + ")";
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    
    // Vertical grid lines
    for (var i = 1; i < divisions; i++) {
      var x = Math.floor(pad + (i / divisions) * w) + 0.5;
      ctx.moveTo(x, pad);
      ctx.lineTo(x, pad + h);
    }
    
    // Horizontal grid lines
    for (var j = 1; j < divisions; j++) {
      var y = Math.floor(pad + (j / divisions) * h) + 0.5;
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + w, y);
    }
    ctx.stroke();

    // 2. Draw diagonal reference line
    ctx.strokeStyle = "rgba(255, 255, 255, " + diagOpacity + ")";
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(pad, pad + h);
    ctx.lineTo(pad + w, pad);
    ctx.stroke();
  }

  /* drawSnapLines removed — yellow snap handle system replaced by
     integrated control-line rendering inside each graph mode. */

  function positionHandles() {
    var p1 = curveToScreen([state.curve[0], state.curve[1]]);
    var p2 = curveToScreen([state.curve[2], state.curve[3]]);

    els.handle1.style.left = p1.x + "px";
    els.handle1.style.top = p1.y + "px";
    els.handle2.style.left = p2.x + "px";
    els.handle2.style.top = p2.y + "px";

    els.snapHandle1.style.display = "none";
    els.snapHandle2.style.display = "none";

    var active = graph.drag && graph.drag.index === 0 ? p1 : p2;

    if (graph.drag) {
      els.snapBadge.textContent = "snap";
    }

    positionSnapBadge(active);
  }

  function positionSnapBadge(active) {
    var rect = graph.rect || els.graphStage.getBoundingClientRect();
    var stageWidth = rect.width || els.graphStage.offsetWidth || 1;
    var stageHeight = rect.height || els.graphStage.offsetHeight || 1;
    var badgeHeight = els.snapBadge.offsetHeight || 20;
    var edgeGap = 10;
    var yOffset = 22;
    var top = clamp(active.y, edgeGap + yOffset, stageHeight - edgeGap + yOffset - badgeHeight);
    var placeLeft = active.x > stageWidth * 0.62;

    els.snapBadge.style.left = active.x + "px";
    els.snapBadge.style.top = top + "px";
    els.snapBadge.classList.remove("snap-side-right", "snap-side-left");
    els.snapBadge.classList.add(placeLeft ? "snap-side-left" : "snap-side-right");
  }

  function curveToScreen(point) {
    var rect = graph.rect || els.graphStage.getBoundingClientRect();
    var pad = graphPad(rect);
    var w = Math.max(1, rect.width - pad * 2);
    var h = Math.max(1, rect.height - pad * 2);

    return {
      x: pad + point[0] * w,
      y: pad + (1 - point[1]) * h
    };
  }



  function screenToCurve(clientX, clientY) {
    var rect = graph.rect || els.graphStage.getBoundingClientRect();
    var pad = graphPad(rect);
    var w = Math.max(1, rect.width - pad * 2);
    var h = Math.max(1, rect.height - pad * 2);
    var x = (clientX - rect.left - pad) / w;
    var y = 1 - ((clientY - rect.top - pad) / h);

    return [
      clamp(x, 0, 1),
      clamp(y, MIN_Y, MAX_Y)
    ];
  }

  function handleMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
    var index = event.currentTarget === els.handle1 ? 0 : 1;
    beginHandleDrag(index, event);
  }

  /* snapHandleMouseDown removed — yellow snap handle drag system no longer used. */

  function stageMouseDown(event) {
    if (event.target !== els.graphStage && event.target !== els.canvas && event.target !== els.ghostCanvas) {
      return;
    }
    var rect = graph.rect || els.graphStage.getBoundingClientRect();
    var point = screenToCurve(event.clientX, event.clientY);
    var d1 = distance(point, [state.curve[0], state.curve[1]]);
    var d2 = distance(point, [state.curve[2], state.curve[3]]);

    beginHandleDrag(d1 <= d2 ? 0 : 1, event);
    documentMouseMove(event);
  }

  function beginHandleDrag(index, event) {
    var curX = state.curve[index === 0 ? 0 : 2];
    var curY = state.curve[index === 0 ? 1 : 3];
    graph.drag = {
      index: index,
      targetX: curX,
      targetY: curY,
      currentX: curX,
      currentY: curY,
      rafId: null
    };
    state.previousCurve = null;
    updateStatus("EDITING EASE", "editing");
    if (index === 0) {
      els.handle1.classList.add("dragging");
    } else {
      els.handle2.classList.add("dragging");
    }
    startDragLoop();
  }

  function documentMouseMove(event) {
    if (!graph.drag) {
      return;
    }

    var point = screenToCurve(event.clientX, event.clientY);
    if (event.shiftKey) {
      point = snapPoint(point, graph.drag.index);
    }
    graph.drag.targetX = point[0];
    graph.drag.targetY = point[1];
  }

  function startDragLoop() {
    var SMOOTH = runtime.legacyCep ? 0.55 : 0.38;
    var THRESHOLD = 0.0008;

    function loop() {
      if (!graph.drag) {
        return;
      }

      var dx = graph.drag.targetX - graph.drag.currentX;
      var dy = graph.drag.targetY - graph.drag.currentY;

      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) {
        graph.drag.currentX = graph.drag.targetX;
        graph.drag.currentY = graph.drag.targetY;
      } else {
        graph.drag.currentX += dx * SMOOTH;
        graph.drag.currentY += dy * SMOOTH;
      }

      setHandle(graph.drag.index, [graph.drag.currentX, graph.drag.currentY]);
      graph.drag.rafId = requestAnimationFrame(loop);
    }

    graph.drag.rafId = requestAnimationFrame(loop);
  }

  function documentMouseUp() {
    if (!graph.drag) {
      return;
    }

    if (graph.drag.rafId) {
      cancelAnimationFrame(graph.drag.rafId);
    }

    setHandle(graph.drag.index, [graph.drag.targetX, graph.drag.targetY]);

    els.handle1.classList.remove("dragging");
    els.handle2.classList.remove("dragging");
    els.snapBadge.classList.remove("visible");
    graph.drag = null;
    state.selectedPresetId = "";
    updateStatus("CUSTOM EASE", "editing");
    updatePresetSelection();
    draw();
    updateCurvePreview();
    saveState();
  }

  function setHandle(index, point) {
    state.curve[index === 0 ? 0 : 2] = roundTo(point[0], 4);
    state.curve[index === 0 ? 1 : 3] = roundTo(point[1], 4);
    state.curve = cleanCurve(state.curve);
    draw();
  }

  function snapPoint(point, index) {
    var anchor = index === 0 ? [0, 0] : [1, 1];
    var dx = point[0] - anchor[0];
    var dy = point[1] - anchor[1];
    var len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0.0001) {
      var angle = Math.atan2(dy, dx);
      var snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      point = [
        anchor[0] + Math.cos(snappedAngle) * len,
        anchor[1] + Math.sin(snappedAngle) * len
      ];
    }

    point[0] = snapNear(point[0], [0, 0.5, 1], 0.07);
    point[1] = snapNear(point[1], [MIN_Y, -0.5, 0, 0.5, 1, 1.5, MAX_Y], 0.07);

    return [
      snapStep(clamp(point[0], 0, 1), SNAP_STEP),
      snapStep(clamp(point[1], MIN_Y, MAX_Y), SNAP_STEP)
    ];
  }

  function snapStep(value, step) {
    return roundTo(Math.round(value / step) * step, 3);
  }

  function snapNear(value, stops, threshold) {
    var best = value;
    var bestDistance = threshold;
    for (var i = 0; i < stops.length; i += 1) {
      var dist = Math.abs(value - stops[i]);
      if (dist <= bestDistance) {
        best = stops[i];
        bestDistance = dist;
      }
    }
    return best;
  }

  function editValues() {
    popup({
      title: "Edit bezier values",
      input: "text",
      inputValue: formatCurve(state.curve),
      inputPlaceholder: "0.00, 1.00, 1.00, 0.00",
      showCancelButton: true,
      confirmButtonText: "OK",
      preConfirm: function (value) {
        var parsed = parseCurve(value);
        if (!parsed) {
          Swal.showValidationMessage("Use four numbers, example: 0.00, 1.00, 1.00, 0.00");
          return false;
        }
        return parsed;
      }
    }).then(function (result) {
      if (result.isConfirmed) {
        state.selectedPresetId = "";
        animateCurve(result.value);
        saveState();
        updatePresetSelection();
      }
    });
  }

  function applyCurve() {
    var direction = getDirection();
    var payload = {
      curve: state.curve,
      direction: direction,
      maxSpeed: MAX_AE_SPEED,
      presetId: state.selectedPresetId
    };

    els.applyBtn.disabled = true;
    els.applyBtn.textContent = "APPLYING";
    updateStatus("APPLYING...", "applying");

    evalAe("SORI.applyCurve(" + jsString(JSON.stringify(payload)) + ")", function (response) {
      els.applyBtn.disabled = false;
      els.applyBtn.textContent = "APPLY";
      var parsed = parseAeResponse(response);
      if (!parsed.ok && parsed.message && parsed.message.indexOf("Separate Dimensions") !== -1) {
        promptSeparateDimensions(applyCurve);
      } else {
        toast(parsed.ok ? "success" : "error", parsed.message || "No response from After Effects.");
      }
      updateStatus(parsed.ok ? "EASE APPLIED" : "ERROR", parsed.ok ? "success" : "error");
      window.setTimeout(function () {
        if (els.statusText && (els.statusText.textContent === "EASE APPLIED" || els.statusText.textContent === "ERROR")) {
          var item = findPreset(state.selectedPresetId);
          updateStatus(item ? item.name : "CUSTOM EASE", "ready");
        }
      }, 1800);
    });
  }

  function readCurve() {
    evalAe("SORI.readCurve()", function (response) {
      var parsed = parseAeResponse(response);
      if (!parsed.ok) {
        if (parsed.message && parsed.message.indexOf("Separate Dimensions") !== -1) {
          promptSeparateDimensions(readCurve);
        } else {
          toast("error", parsed.message || "Could not read keyframe easing.");
        }
        return;
      }

      if (parsed.data && parsed.data.curve) {
        state.selectedPresetId = "";
        animateCurve(parsed.data.curve);
        updatePresetSelection();
        toast("success", "Read selected keyframe easing.");
      }
    });
  }

  function saveCurrentPreset() {
    var library = findLibrary(state.activeLibraryId);
    if (!library) {
      return;
    }

    if (library.locked) {
      popup({
        title: "Create new library",
        text: "Create a new library first.",
        input: "text",
        inputPlaceholder: "Library name",
        showCancelButton: true,
        confirmButtonText: "OK",
        preConfirm: function (value) {
          value = String(value || "").trim();
          if (!value) {
            Swal.showValidationMessage("Enter a library name.");
            return false;
          }
          return value;
        }
      }).then(function (result) {
        if (result.isConfirmed) {
          var newLibrary = addLibrary(result.value);
          state.activeLibraryId = newLibrary.id;
          renderLibraries();
          promptPresetName(newLibrary);
        }
      });
      return;
    }

    promptPresetName(library);
  }

  function promptPresetName(library) {
    popup({
      title: "Save preset",
      input: "text",
      inputPlaceholder: "Preset name",
      showCancelButton: true,
      confirmButtonText: "Save",
      preConfirm: function (value) {
        value = String(value || "").trim();
        if (!value) {
          Swal.showValidationMessage("Enter a preset name.");
          return false;
        }
        return value;
      }
    }).then(function (result) {
      if (!result.isConfirmed) {
        return;
      }

      var item = preset(
        uniqueId("preset"), 
        result.value, 
        state.curve
      );
      library.presets.push(item);
      state.selectedPresetId = item.id;
      saveState();
      renderPresets();
      toast("success", "Preset saved.");
    });
  }

  function createLibrary() {
    popup({
      title: "Create new Library",
      text: "Enter a name for the library",
      input: "text",
      showCancelButton: true,
      confirmButtonText: "OK",
      preConfirm: function (value) {
        value = String(value || "").trim();
        if (!value) {
          Swal.showValidationMessage("Enter a library name.");
          return false;
        }
        return value;
      }
    }).then(function (result) {
      if (result.isConfirmed) {
        var library = addLibrary(result.value);
        state.activeLibraryId = library.id;
        saveState();
        renderLibraries();
        renderPresets();
      }
    });
  }

  function addLibrary(name, presets) {
    var library = {
      id: uniqueId("library"),
      name: name,
      mode: state.graphMode,
      locked: false,
      presets: presets || []
    };
    state.libraries.push(library);
    return library;
  }

  function deleteLibrary() {
    var library = findLibrary(state.activeLibraryId);
    if (!library || library.locked) {
      toast("info", "Default library cannot be deleted.");
      return;
    }

    popup({
      title: "Delete library?",
      text: "This removes the library and all custom presets inside it.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete"
    }).then(function (result) {
      if (!result.isConfirmed) {
        return;
      }

      state.libraries = state.libraries.filter(function (item) {
        return item.id !== library.id;
      });
      state.activeLibraryId = defaultLibraryIdForMode(state.graphMode);
      saveState();
      renderLibraries();
      renderPresets();
    });
  }

  function renameLibrary() {
    var library = findLibrary(state.activeLibraryId);
    if (!library || library.locked) {
      toast("info", "Default library cannot be renamed.");
      return;
    }

    popup({
      title: "Rename library",
      input: "text",
      inputValue: library.name,
      showCancelButton: true,
      confirmButtonText: "OK",
      preConfirm: function (value) {
        value = String(value || "").trim();
        if (!value) {
          Swal.showValidationMessage("Enter a library name.");
          return false;
        }
        return value;
      }
    }).then(function (result) {
      if (!result.isConfirmed) {
        return;
      }
      library.name = result.value;
      saveState();
      renderLibraries();
      toast("success", "Library renamed.");
    });
  }

  function clearLibrary() {
    var library = findLibrary(state.activeLibraryId);
    if (!library || library.locked) {
      toast("info", "Default library cannot be cleared.");
      return;
    }

    if (!library.presets.length) {
      toast("info", "This library is already empty.");
      return;
    }

    popup({
      title: "Clear library?",
      text: "This removes all presets in this library.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "OK",
      cancelButtonText: "Cancel"
    }).then(function (result) {
      if (!result.isConfirmed) {
        return;
      }
      library.presets = [];
      state.selectedPresetId = "";
      saveState();
      renderPresets();
      updatePresetSelection();
      updateCurvePreview();
      draw();
      toast("success", "Library cleared.");
    });
  }

  function deletePreset(id) {
    var library = findLibrary(state.activeLibraryId);
    if (!library || library.locked) {
      return;
    }

    var item = findPresetInLibrary(library, id);
    if (!item) {
      return;
    }

    popup({
      title: "Delete preset?",
      html: "<strong>" + escapeHtml(item.name) + "</strong><br><span>" + escapeHtml(formatCurve(item.curve)) + "</span><br><br>This cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "OK",
      cancelButtonText: "Cancel"
    }).then(function (result) {
      if (result.isConfirmed) {
        removePreset(library, id);
      }
    });
  }

  function removePreset(library, id) {
    library.presets = library.presets.filter(function (item) {
      return item.id !== id;
    });
    if (state.selectedPresetId === id) {
      state.selectedPresetId = library.presets[0] ? library.presets[0].id : "";
      if (library.presets[0]) {
        state.curve = library.presets[0].curve.slice();
      }
    }
    saveState();
    renderPresets();
    updatePresetSelection();
    updateCurvePreview();
    draw();
    toast("success", "Preset deleted.");
  }

  function renamePreset(id) {
    var library = findLibrary(state.activeLibraryId);
    var item = library && findPresetInLibrary(library, id);
    if (!item || library.locked) {
      return;
    }

    popup({
      title: "Rename preset",
      input: "text",
      inputValue: item.name,
      showCancelButton: true,
      confirmButtonText: "OK",
      preConfirm: function (value) {
        value = String(value || "").trim();
        if (!value) {
          Swal.showValidationMessage("Enter a preset name.");
          return false;
        }
        return value;
      }
    }).then(function (result) {
      if (!result.isConfirmed) {
        return;
      }
      item.name = result.value;
      saveState();
      renderPresets();
      toast("success", "Preset renamed.");
    });
  }

  function editPresetValue(id) {
    var library = findLibrary(state.activeLibraryId);
    var item = library && findPresetInLibrary(library, id);
    if (!item || library.locked) {
      return;
    }

    var titleText = "Edit preset value";
    var inputVal = formatCurve(item.curve);
    var placeholderText = "0.00, 1.00, 1.00, 0.00";

    popup({
      title: titleText,
      input: "text",
      inputValue: inputVal,
      inputPlaceholder: placeholderText,
      showCancelButton: true,
      confirmButtonText: "OK",
      preConfirm: function (value) {
        var parsed = parseCurve(value);
        if (!parsed) {
          Swal.showValidationMessage("Use four numbers, example: 0.00, 1.00, 1.00, 0.00");
          return false;
        }
        return parsed;
      }
    }).then(function (result) {
      if (!result.isConfirmed) {
        return;
      }
      item.curve = result.value;
      state.selectedPresetId = item.id;
      animateCurve(item.curve);
      saveState();
      renderPresets();
      toast("success", "Preset updated.");
    });
  }

  function selectLibrary(id) {
    var library = findLibrary(id);
    if (!library) {
      return;
    }
    state.activeLibraryId = library.id;
    if (library.presets.length) {
      state.selectedPresetId = library.presets[0].id;
      animateCurve(library.presets[0].curve);
    } else {
      state.selectedPresetId = "";
      updatePresetSelection();
    }
    saveState();
    renderLibraries();
    renderPresets();
  }

  function openPresetMenu(event, id) {
    closePresetMenu();

    var library = findLibrary(state.activeLibraryId);
    var item = library && findPresetInLibrary(library, id);
    if (!library || !item || library.locked) {
      return;
    }

    var rawLabel = "Bezier value";

    var menu = document.createElement("div");
    menu.className = "preset-menu";
    menu.innerHTML = [
      "<button type=\"button\" data-action=\"edit\"><span>Edit value</span></button>",
      "<button type=\"button\" data-action=\"rename\"><span>Rename</span></button>",
      "<button type=\"button\" data-action=\"delete\" class=\"danger\"><span>Delete</span></button>",
      "<div class=\"preset-menu-separator\"></div>",
      menuSubmenu("Copy value as", [
        "<button type=\"button\" data-action=\"copy-raw\"><span>" + rawLabel + "</span></button>",
        "<button type=\"button\" data-action=\"copy-css\"><span>CSS cubic-bezier</span></button>",
        "<button type=\"button\" data-action=\"copy-json\"><span>JSON preset</span></button>"
      ]),
      menuSubmenu("Manage library", [
        "<button type=\"button\" data-action=\"new-library\"><span>New</span></button>",
        "<button type=\"button\" data-action=\"import-library\"><span>Import</span></button>",
        "<button type=\"button\" data-action=\"export-library\"><span>Export</span></button>",
        "<button type=\"button\" data-action=\"kbar-export\"><span>KBar export</span></button>",
        "<button type=\"button\" data-action=\"rename-library\"><span>Rename</span></button>",
        "<button type=\"button\" data-action=\"clear-library\"><span>Clear</span></button>",
        "<button type=\"button\" data-action=\"delete-library\" class=\"danger\"><span>Delete</span></button>"
      ]),
      menuSubmenu("Select library", buildLibraryMenuItems())
    ].join("");

    menu.addEventListener("click", function (menuEvent) {
      var action = menuEvent.target && menuEvent.target.closest ? menuEvent.target.closest("button[data-action]") : null;
      if (!action) {
        return;
      }
      var type = action.getAttribute("data-action");
      var targetLibraryId = action.getAttribute("data-library-id");
      closePresetMenu();
      if (type === "edit") {
        editPresetValue(id);
      } else if (type === "rename") {
        renamePreset(id);
      } else if (type === "delete") {
        deletePreset(id);
      } else if (type === "copy-raw") {
        copyPresetValue(item, "raw");
      } else if (type === "copy-css") {
        copyPresetValue(item, "css");
      } else if (type === "copy-json") {
        copyPresetValue(item, "json");
      } else if (type === "new-library") {
        createLibrary();
      } else if (type === "import-library") {
        chooseImportLibrary();
      } else if (type === "export-library") {
        exportLibrary();
      } else if (type === "kbar-export") {
        copyKbarExport(item);
      } else if (type === "rename-library") {
        renameLibrary();
      } else if (type === "clear-library") {
        clearLibrary();
      } else if (type === "delete-library") {
        deleteLibrary();
      } else if (type === "select-library" && targetLibraryId) {
        selectLibrary(targetLibraryId);
      }
    });

    document.body.appendChild(menu);
    positionPresetMenu(menu, event);

    window.setTimeout(function () {
      document.addEventListener("mousedown", closePresetMenuOnce);
      document.addEventListener("keydown", closePresetMenuOnEscape);
    }, 0);
  }

  function positionPresetMenu(menu, event) {
    var margin = 8;
    var rect = menu.getBoundingClientRect();
    var x = event.clientX || margin;
    var y = event.clientY || margin;

    // Flip left if not enough room on the right
    if (x + rect.width > window.innerWidth - margin) {
      x -= rect.width;
    }
    
    // Flip up if not enough room below
    if (y + rect.height > window.innerHeight - margin) {
      y -= rect.height;
    }

    x = clamp(x, margin, Math.max(margin, window.innerWidth - rect.width - margin));
    y = clamp(y, margin, Math.max(margin, window.innerHeight - rect.height - margin));
    menu.style.left = x + "px";
    menu.style.top = y + "px";

    positionPresetSubmenus(menu);
  }

  function positionPresetSubmenus(menu) {
    var margin = 8;
    var gap = 6;
    var menuRect = menu.getBoundingClientRect();
    var viewportW = window.innerWidth;
    var viewportH = window.innerHeight;
    var rows = menu.querySelectorAll(".preset-menu-row");
    for (var i = 0; i < rows.length; i += 1) {
      rows[i].classList.remove("submenu-left", "submenu-right", "submenu-clamped", "submenu-stacked");
      var submenu = rows[i].querySelector(".preset-submenu");
      if (!submenu) {
        continue;
      }

      var rowRect = rows[i].getBoundingClientRect();
      var maxWidth = Math.max(132, viewportW - margin * 2);
      var preferredWidth = Math.min(182, maxWidth);
      var width = preferredWidth;
      var submenuHeight = (submenu.querySelectorAll("button").length * 30) + 10;
      var compactMaxHeight = viewportH < 620 ? 136 : 170;
      var maxHeight = Math.max(78, Math.min(compactMaxHeight, viewportH - margin * 2));
      var visibleHeight = Math.min(submenuHeight, maxHeight);
      var rightX = rowRect.right + gap;
      var rightRoom = viewportW - margin - rightX;
      var leftRoom = rowRect.left - margin - gap;
      var canOpenRight = rightRoom >= width;
      var canOpenLeft = leftRoom >= width;
      var x;
      var y;

      if (canOpenRight) {
        x = rightX;
        rows[i].classList.add("submenu-right");
      } else if (canOpenLeft) {
        x = rowRect.left - width - gap;
        rows[i].classList.add("submenu-left");
      } else if (Math.max(rightRoom, leftRoom) >= 132) {
        if (rightRoom >= leftRoom) {
          width = Math.min(preferredWidth, Math.max(132, rightRoom));
          x = rightX;
          rows[i].classList.add("submenu-right");
        } else {
          width = Math.min(preferredWidth, Math.max(132, leftRoom));
          x = rowRect.left - width - gap;
          rows[i].classList.add("submenu-left");
        }
        rows[i].classList.add("submenu-clamped");
      } else {
        width = Math.min(maxWidth, Math.max(132, menuRect.width));
        x = clamp(menuRect.left, margin, Math.max(margin, viewportW - width - margin));
        y = rowRect.top - visibleHeight - gap;
        if (y < margin && rowRect.bottom + gap + visibleHeight <= viewportH - margin) {
          y = rowRect.bottom + gap;
        }
        if (y + visibleHeight > viewportH - margin) {
          y = rowRect.top - visibleHeight - gap;
        }
        y = clamp(y, margin, Math.max(margin, viewportH - visibleHeight - margin));
        rows[i].classList.add("submenu-clamped");
        rows[i].classList.add("submenu-stacked");
      }

      if (typeof y === "undefined") {
        x = clamp(x, margin, Math.max(margin, viewportW - width - margin));
        y = rowRect.top - 5;
        if (y + visibleHeight > viewportH - margin) {
          y = rowRect.top - visibleHeight - gap;
        }
        if (y < margin && rowRect.bottom + gap + visibleHeight <= viewportH - margin) {
          y = rowRect.bottom + gap;
        }
        y = clamp(y, margin, Math.max(margin, viewportH - visibleHeight - margin));
      }

      submenu.style.setProperty("--submenu-left", (x - rowRect.left) + "px");
      submenu.style.setProperty("--submenu-top", (y - rowRect.top) + "px");
      submenu.style.setProperty("--submenu-width", width + "px");
      submenu.style.setProperty("--submenu-max-height", maxHeight + "px");
    }
  }

  function menuSubmenu(label, items) {
    return [
      "<div class=\"preset-menu-row\">",
      "<button type=\"button\" class=\"has-submenu\"><span>" + escapeHtml(label) + "</span><span class=\"menu-chevron\">›</span></button>",
      "<div class=\"preset-submenu\">",
      items.join(""),
      "</div>",
      "</div>"
    ].join("");
  }

  function buildLibraryMenuItems() {
    var items = [];
    for (var i = 0; i < state.libraries.length; i += 1) {
      var library = state.libraries[i];
      if (!isCurrentModeLibrary(library)) {
        continue;
      }
      var selected = library.id === state.activeLibraryId ? "<span class=\"menu-check\">✓</span>" : "";
      items.push("<button type=\"button\" data-action=\"select-library\" data-library-id=\"" + escapeHtml(library.id) + "\"><span>" + escapeHtml(library.name) + "</span>" + selected + "</button>");
    }
    return items.length ? items : ["<button type=\"button\" disabled><span>No libraries</span></button>"];
  }

  function copyPresetValue(item, mode) {
    var label = "Bezier value copied.";
    var value = formatCurve(item.curve);
    if (mode === "css") {
      var coords = item.curve.map(function (number) {
        return roundTo(number, 4);
      }).join(", ");
      value = "cubic-bezier(" + coords + ")";
      label = "CSS cubic-bezier copied.";
    } else if (mode === "json") {
      value = JSON.stringify({
        name: item.name,
        curve: item.curve.map(function (number) {
          return roundTo(number, 4);
        })
      }, null, 2);
      label = "JSON preset copied.";
    }
    copyText(value, label);
  }

  function copyKbarExport(item) {
    var payload = JSON.stringify({
      curve: item.curve,
      direction: getDirection(),
      maxSpeed: MAX_AE_SPEED
    });
    var script = [
      "if (typeof SORI !== \"undefined\" && SORI.applyCurve) {",
      "  SORI.applyCurve(" + JSON.stringify(payload) + ");",
      "} else {",
      "  alert(\"Open the sori panel once before running this KBar command.\");",
      "}"
    ].join("\n");
    copyText(script, "KBar script copied.");
  }

  function copyText(value, successMessage) {
    if (copyTextWithTextarea(value)) {
      toast("success", successMessage);
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () {
        toast("success", successMessage);
      }).catch(function () {
        popup({
          title: "Copy failed",
          text: "Could not copy to clipboard.",
          icon: "error"
        });
      });
      return;
    }

    popup({
      title: "Copy failed",
      text: "Could not copy to clipboard.",
      icon: "error"
    });
  }

  function copyTextWithTextarea(value) {
    var textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    var copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }
    document.body.removeChild(textarea);
    return copied;
  }

  function isTypingOrPopupActive() {
    var active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
      return true;
    }
    return !!document.querySelector(".swal2-container");
  }

  function closePresetMenuOnce(event) {
    var menu = document.querySelector(".preset-menu");
    if (menu && event && menu.contains(event.target)) {
      return;
    }
    closePresetMenu();
  }

  function closePresetMenuOnEscape(event) {
    if (event.key === "Escape") {
      closePresetMenu();
    }
  }

  function closePresetMenu() {
    var menu = document.querySelector(".preset-menu");
    if (menu && menu.parentNode) {
      menu.parentNode.removeChild(menu);
    }
    document.removeEventListener("mousedown", closePresetMenuOnce);
    document.removeEventListener("keydown", closePresetMenuOnEscape);
  }

  function chooseImportLibrary() {
    if (hasCepFs()) {
      importLibraryWithCepDialog();
      return;
    }

    els.importFile.value = "";
    els.importFile.click();
  }

  function importLibrary(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      try {
        installImportedLibrary(parseImport(reader.result, file.name));
      } catch (error) {
        popup({
          title: "Import failed",
          text: error.message || "The selected file is not a supported preset library.",
          icon: "error"
        });
      }
    };
    reader.readAsText(file);
  }

  function importLibraryWithCepDialog() {
    try {
      var result = window.cep.fs.showOpenDialogEx(false, false, "Import SoriGraph preset library", "", ["sorigraph", "sori", "json", "flow", "txt"]);
      if (!result || result.err || !result.data || !result.data.length) {
        return;
      }

      var filePath = result.data[0];
      var read = window.cep.fs.readFile(filePath);
      if (!read || read.err) {
        throw new Error("Could not read selected file.");
      }

      installImportedLibrary(parseImport(read.data, filePath.split(/[\\/]/).pop()));
    } catch (error) {
      popup({
        title: "Import failed",
        text: error.message || "The selected file is not a supported preset library.",
        icon: "error"
      });
    }
  }

  function installImportedLibrary(imported) {
    imported.mode = state.graphMode;
    imported.name = uniqueLibraryName(imported.name || "imported");
    state.libraries.push(imported);
    state.activeLibraryId = imported.id;
    if (imported.presets.length) {
      state.selectedPresetId = imported.presets[0].id;
      state.curve = imported.presets[0].curve.slice();
    }
    saveState();
    renderLibraries();
    renderPresets();
    updatePresetSelection();
    updateCurvePreview();
    draw();
    toast("success", "Imported " + imported.presets.length + " preset" + (imported.presets.length === 1 ? "" : "s") + ".");
  }

  function exportLibrary() {
    var library = findLibrary(state.activeLibraryId);
    if (!library) {
      return;
    }

    if (!library.presets.length) {
      toast("info", "This library has no presets to export.");
      return;
    }

    var filename = "sorigraph-" + sanitizeFileName(library.name || "library") + ".sorigraph";
    var data = JSON.stringify(buildExportPayload(library), null, 2);

    if (hasCepFs() && exportWithCepDialog(filename, data)) {
      return;
    }

    if (window.showSaveFilePicker) {
      exportWithBrowserSavePicker(filename, data);
      return;
    }

    exportWithBrowserDownload(filename, data);
  }

  function buildExportPayload(library) {
    return {
      schema: "sorigraph.preset-library",
      version: 1,
      app: "SoriGraph",
      appVersion: APP_VERSION,
      graphMode: state.graphMode,
      exportedAt: new Date().toISOString(),
      direction: state.direction,
      selectedPresetId: state.selectedPresetId || null,
      currentCurve: state.curve.map(function (value) {
        return roundTo(value, 4);
      }),
      library: {
        name: library.name,
        mode: libraryMode(library),
        presets: library.presets.map(function (item) {
          return {
            id: item.id,
            name: item.name,
            curve: item.curve.map(function (value) {
              return roundTo(value, 4);
            })
          };
        })
      }
    };
  }

  function exportWithCepDialog(filename, data) {
    try {
      var result = window.cep.fs.showSaveDialogEx("Export SoriGraph preset library", "", ["sorigraph", "sori"], filename, "SoriGraph preset library");
      if (!result || result.err || !result.data) {
        return true;
      }

      var targetPath = result.data instanceof Array ? result.data[0] : result.data;
      if (!targetPath) {
        return true;
      }
      if (!/\.sorigraph$/i.test(targetPath) && !/\.sori$/i.test(targetPath) && !/\.json$/i.test(targetPath)) {
        targetPath += ".sorigraph";
      }

      var written = window.cep.fs.writeFile(targetPath, data);
      if (written && written.err) {
        throw new Error("Could not write export file.");
      }

      toast("success", "Exported " + targetPath.split(/[\\/]/).pop());
      return true;
    } catch (error) {
      popup({
        title: "Export failed",
        text: error.message || "Could not export this library.",
        icon: "error"
      });
      return true;
    }
  }

  function exportWithBrowserSavePicker(filename, data) {
    window.showSaveFilePicker({
      suggestedName: filename,
      types: [{
        description: "SoriGraph preset library",
        accept: {
          "application/json": [".sorigraph", ".sori", ".json"]
        }
      }]
    }).then(function (handle) {
      return handle.createWritable();
    }).then(function (writable) {
      return writable.write(data).then(function () {
        return writable.close();
      });
    }).then(function () {
      toast("success", "Exported " + filename);
    }).catch(function (error) {
      if (error && error.name === "AbortError") {
        return;
      }
      popup({
        title: "Export failed",
        text: error.message || "Could not save export file.",
        icon: "error"
      });
    });
  }

  function exportWithBrowserDownload(filename, data) {
    var link = document.createElement("a");
    var url = "";
    var isBlob = data.length > 750000;

    if (isBlob) {
      var blob = new Blob([data], {
        type: "application/json;charset=utf-8"
      });
      url = URL.createObjectURL(blob);
    } else {
      url = "data:application/json;charset=utf-8," + encodeURIComponent(data);
    }

    link.href = url;
    link.download = filename;
    link.setAttribute("download", filename);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (isBlob) {
      window.setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 250);
    }
    toast("success", "Exported " + filename);
  }

  function flipCurve() {
    var target = [
      roundTo(1 - state.curve[2], 4),
      roundTo(1 - state.curve[3], 4),
      roundTo(1 - state.curve[0], 4),
      roundTo(1 - state.curve[1], 4)
    ];
    state.selectedPresetId = "";
    animateCurve(cleanCurve(target));
    updatePresetSelection();
    saveState();
  }

  function resetToSelectedPreset() {
    var item = findPreset(state.selectedPresetId) || findPreset("flow-snap");
    if (item) {
      animateCurve(item.curve);
    }
  }

  function animateCurve(target) {
    // Cancel any in-flight animation so rapid clicks don't conflict
    if (graph.animRafId) {
      cancelAnimationFrame(graph.animRafId);
      graph.animRafId = null;
    }
    if (graph.ghostFadeId) {
      cancelAnimationFrame(graph.ghostFadeId);
      graph.ghostFadeId = null;
    }

    // Use current (possibly mid-animation) position as start — seamless blending
    var start = state.curve.slice();
    target = cleanCurve(target);
    state.previousCurve = runtime.legacyCep ? null : start.slice();
    els.ghostCanvas.style.opacity = runtime.legacyCep ? "0" : "0.36";
    var started = performance.now();
    var duration = runtime.legacyCep ? 520 : 420;

    function frame(now) {
      var t = clamp((now - started) / duration, 0, 1);
      var eased = runtime.legacyCep ? easeInOutCubic(t) : easeOutQuart(t);
      state.curve = mixCurve(start, target, eased);
      
      draw(undefined, runtime.legacyCep);

      if (t < 1) {
        graph.animRafId = requestAnimationFrame(frame);
      } else {
        graph.animRafId = null;
        state.curve = target.slice();
        draw();
        saveState();
        if (runtime.legacyCep) {
          graph.ghostFadeId = null;
          state.previousCurve = null;
          els.ghostCanvas.style.opacity = "0.36";
          draw();
        } else {
          fadeOutGhost();
        }
      }
    }

    graph.animRafId = requestAnimationFrame(frame);
  }

  function fadeOutGhost() {
    if (graph.ghostFadeId) {
      cancelAnimationFrame(graph.ghostFadeId);
    }

    var fadeStart = performance.now();
    var fadeDuration = runtime.legacyCep ? 220 : 320;

    function fadeFrame(now) {
      var t = clamp((now - fadeStart) / fadeDuration, 0, 1);
      var eased = easeOutCubic(t);
      var opacity = (1 - eased) * 0.36;
      els.ghostCanvas.style.opacity = String(opacity);

      if (t < 1) {
        graph.ghostFadeId = requestAnimationFrame(fadeFrame);
      } else {
        graph.ghostFadeId = null;
        state.previousCurve = null;
        els.ghostCanvas.style.opacity = "0.36";
        draw();
      }
    }

    graph.ghostFadeId = requestAnimationFrame(fadeFrame);
  }

  function startResize(event) {
    event.preventDefault();
    var vertical = isVerticalLayout();
    var shell = document.querySelector(".app-shell");
    var shellRect = document.querySelector(".app-shell").getBoundingClientRect();
    var start = vertical ? event.clientY : event.clientX;
    var initial = vertical ? els.graphPane.getBoundingClientRect().height : els.graphPane.getBoundingClientRect().width;
    var splitterSize = vertical ? els.splitter.getBoundingClientRect().height : els.splitter.getBoundingClientRect().width;
    var snapDistance = 34;
    var current = initial;
    var targetOnRelease = null;
    var frameId = null;

    shell.classList.add("is-resizing");

    function move(moveEvent) {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(function () {
        var delta = (vertical ? moveEvent.clientY : moveEvent.clientX) - start;
        var next = initial + delta;
        var total = vertical ? shellRect.height : shellRect.width;
        
        // Portrait vertical layout: prevent drag from going below the bottom bar (APPLY menu)
        var bottomBarHeight = (vertical && els.bottomBar) ? els.bottomBar.getBoundingClientRect().height : 0;
        var min = vertical ? 0 : 190;
        var max = vertical ? Math.max(0, total - bottomBarHeight - splitterSize) : Math.max(min, total - splitterSize - 160);
        
        next = clamp(next, min, max);
        if (vertical && next < snapDistance) {
          next = 0;
        } else if (vertical && max - next < snapDistance) {
          next = max;
        }
        current = next;
        targetOnRelease = vertical && (next === 0 || next === max) ? next : null;
        
        // Use exact pixel basis during dragging so it tracks the cursor perfectly!
        els.graphPane.style.flexBasis = next + "px";
        resizeCanvas();
      });
    }

    function up() {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      var total = vertical ? shellRect.height : shellRect.width;
      var bottomBarHeight = (vertical && els.bottomBar) ? els.bottomBar.getBoundingClientRect().height : 0;
      var availableTotal = vertical ? (total - bottomBarHeight) : total;

      if (vertical && targetOnRelease !== null) {
        var currentPct = (current / availableTotal) * 100;
        var targetPct = (targetOnRelease / availableTotal) * 100;
        animatePaneBasis(currentPct, targetPct, function () {
          shell.classList.remove("is-resizing");
          if (vertical) {
            state.splitterHeight = targetPct;
          } else {
            state.splitterWidth = targetPct;
          }
          saveState();
        });
      } else {
        shell.classList.remove("is-resizing");
        var pct = (current / availableTotal) * 100;
        
        // Seamlessly switch to percentage on release so responsiveness is maintained!
        els.graphPane.style.flexBasis = pct + "%";
        
        resizeCanvas();
        if (vertical) {
          state.splitterHeight = pct;
        } else {
          state.splitterWidth = pct;
        }
        saveState();
      }
    }

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  function animatePaneBasis(from, to, done) {
    var started = performance.now();
    var duration = runtime.legacyCep ? 110 : 150;

    function frame(now) {
      var t = clamp((now - started) / duration, 0, 1);
      var eased = easeOutCubic(t);
      var next = Math.round(lerp(from, to, eased) * 10) / 10;
      els.graphPane.style.flexBasis = next + "%";
      resizeCanvas();
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        els.graphPane.style.flexBasis = to + "%";
        resizeCanvas();
        if (done) {
          done();
        }
      }
    }

    requestAnimationFrame(frame);
  }

  var DIRECTIONS = ["both", "out", "in"];
  var DIRECTION_LABELS = { both: "Both", out: "Out", in: "In" };

  function openDirectionMenu() {
    var current = getDirection();
    popup({
      title: "Ease direction",
      html: [
        "<div class=\"direction-choice\">",
        directionChoiceButton("both", current),
        directionChoiceButton("out", current),
        directionChoiceButton("in", current),
        "</div>"
      ].join(""),
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "Cancel",
      didOpen: function () {
        resizeCanvas();
        var buttons = document.querySelectorAll(".direction-choice button");
        for (var i = 0; i < buttons.length; i += 1) {
          buttons[i].addEventListener("click", function () {
            setDirection(this.getAttribute("data-direction"));
            Swal.close();
          });
        }
      },
      didClose: function () {
        resizeCanvas();
      }
    });
  }

  function directionChoiceButton(direction, current) {
    var label = DIRECTION_LABELS[direction] || direction;
    var active = direction === current ? " active" : "";
    return "<button type=\"button\" class=\"" + active + "\" data-direction=\"" + direction + "\">" + label + "</button>";
  }

  function setDirection(direction) {
    if (DIRECTIONS.indexOf(direction) === -1) {
      direction = "both";
    }
    state.direction = direction;
    updateCurvePreview();
    saveState();
  }

  function updateCurvePreview() {
    if (!els.curvePreviewBtn) {
      return;
    }
    var dirLabel = DIRECTION_LABELS[state.direction] || "Both";
    var geometry = miniCurveGeometry(state.curve);
    var svg = els.curvePreviewBtn.querySelector("svg");
    var path;
    var circles;

    els.curvePreviewBtn.title = "Ease: " + dirLabel;
    if (!svg) {
      els.curvePreviewBtn.innerHTML = miniCurveSvg(state.curve);
      return;
    }

    path = svg.querySelector("path");
    circles = svg.querySelectorAll("circle");
    if (path) {
      path.setAttribute("d", geometry.path);
    }
    if (circles[0]) {
      circles[0].setAttribute("cx", geometry.p0.x);
      circles[0].setAttribute("cy", geometry.p0.y);
    }
    if (circles[1]) {
      circles[1].setAttribute("cx", geometry.p3.x);
      circles[1].setAttribute("cy", geometry.p3.y);
    }
  }

  function getDirection() {
    return state.direction || "both";
  }

  function navigatePreset(delta) {
    var library = findLibrary(state.activeLibraryId);
    if (!library || library.presets.length === 0) {
      return;
    }

    // Find current index in library
    var currentIndex = -1;
    for (var i = 0; i < library.presets.length; i += 1) {
      if (library.presets[i].id === state.selectedPresetId) {
        currentIndex = i;
        break;
      }
    }

    // Calculate next index with wrapping
    var nextIndex;
    if (currentIndex === -1) {
      // No preset selected, start from first or last
      nextIndex = delta > 0 ? 0 : library.presets.length - 1;
    } else {
      nextIndex = (currentIndex + delta + library.presets.length) % library.presets.length;
    }

    var targetPreset = library.presets[nextIndex];
    selectPreset(targetPreset.id, true);

    // Scroll the selected preset into view
    var presetNode = els.presetGrid.querySelector("[data-id='" + targetPreset.id + "']");
    if (presetNode) {
      try {
        presetNode.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (error) {
        presetNode.scrollIntoView(false);
      }
    }
  }

  function evalAe(script, callback) {
    cs.evalScript(script, callback);
  }

  function parseAeResponse(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      return {
        ok: false,
        message: String(response || "Unknown After Effects response.")
      };
    }
  }

  function popup(options) {
    return Swal.fire(Object.assign({
      customClass: {
        popup: "sorigraph-popup",
        confirmButton: "sorigraph-confirm",
        cancelButton: "sorigraph-cancel"
      },
      buttonsStyling: true,
      confirmButtonColor: PRIMARY,
      cancelButtonColor: "#2d2d2d",
      // Refresh canvas when popup opens and closes to prevent graph distortion
      didOpen: function () {
        resizeCanvas();
      },
      didClose: function () {
        resizeCanvas();
      }
    }, options));
  }

  function toast(icon, title) {
    Swal.fire({
      toast: true,
      position: "top",
      icon: icon,
      title: title,
      showConfirmButton: false,
      timer: 1800,
      timerProgressBar: true,
      customClass: {
        popup: "sorigraph-toast"
      }
    });
  }

  function promptSeparateDimensions(retryCallback) {
    popup({
      icon: "warning",
      title: "Separate Dimensions?",
      text: "Would you like to automatically separate dimensions and try again?",
      showCancelButton: true,
      confirmButtonText: "Yes, Separate",
      cancelButtonText: "Cancel"
    }).then(function (result) {
      if (result.isConfirmed) {
        updateStatus("SEPARATING...", "applying");
        evalAe("SORI.separateSelectedProperties()", function (response) {
          var parsed = parseAeResponse(response);
          if (parsed.ok) {
            toast("success", "Dimensions separated successfully!");
            // Re-run the action after a small delay to let AE refresh selection
            window.setTimeout(retryCallback, 250);
          } else {
            popup({
              icon: "error",
              title: "Could not separate",
              text: parsed.message || "Failed to separate dimensions. Please separate manually.",
              confirmButtonText: "OK"
            });
            updateStatus("ERROR", "error");
          }
        });
      } else {
        var item = findPreset(state.selectedPresetId);
        updateStatus(item ? item.name : "CUSTOM EASE", "ready");
      }
    });
  }

  function hasCepFs() {
    return !!(window.cep && window.cep.fs && window.cep.fs.showOpenDialogEx && window.cep.fs.showSaveDialogEx);
  }

  function parseImport(raw, fallbackName) {
    var data;
    var presets = [];
    var name = libraryNameFromFile(fallbackName);

    try {
      data = JSON.parse(raw);
    } catch (error) {
      data = parseTextPresets(raw);
    }

    if (data && (data.schema === "sori.preset-library" || data.schema === "sorigraph.preset-library") && data.library) {
      name = data.library.name || name;
      if (data.graphMode) {
        state.graphMode = normalizeGraphMode(data.graphMode);
      }
      presets = data.library.presets || [];
      if (data.direction && DIRECTIONS.indexOf(data.direction) !== -1) {
        state.direction = data.direction;
      }
    } else if (data instanceof Array) {
      presets = data;
    } else if (data && data.libraries instanceof Array && data.libraries[0]) {
      name = data.libraries[0].name || name;
      presets = data.libraries[0].presets || [];
    } else if (data && data.presets instanceof Array) {
      name = data.name || name;
      presets = data.presets;
    } else {
      throw new Error("No presets found in file.");
    }

    presets = presets.map(function (item, index) {
      var curve = item.curve || item.value || item.values || item.bezier || item;
      curve = parseCurveArray(curve);
      if (!curve) {
        throw new Error("Preset " + (index + 1) + " does not contain four valid numbers.");
      }
      return preset(uniqueId("preset"), item.name || ("preset " + (index + 1)), curve);
    });

    if (!presets.length) {
      throw new Error("No valid bezier presets found.");
    }

    return normalizeLibrary({
      id: uniqueId("library"),
      name: name,
      mode: state.graphMode,
      locked: false,
      presets: presets
    });
  }

  function uniqueLibraryName(baseName) {
    baseName = String(baseName || "library").trim() || "library";
    var used = {};
    for (var i = 0; i < state.libraries.length; i += 1) {
      if (isCurrentModeLibrary(state.libraries[i])) {
        used[state.libraries[i].name.toLowerCase()] = true;
      }
    }

    if (!used[baseName.toLowerCase()]) {
      return baseName;
    }

    var index = 2;
    var candidate = baseName + " " + index;
    while (used[candidate.toLowerCase()]) {
      index += 1;
      candidate = baseName + " " + index;
    }
    return candidate;
  }

  function libraryNameFromFile(fileName) {
    fileName = String(fileName || "imported").split(/[\\/]/).pop();
    return fileName
      .replace(/\.sorigraph$/i, "")
      .replace(/\.sori$/i, "")
      .replace(/\.sori\.json$/i, "")
      .replace(/\.(json|flow|txt)$/i, "")
      .trim() || "imported";
  }

  function parseTextPresets(raw) {
    var lines = String(raw || "").split(/\r?\n/);
    var output = [];
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i].trim();
      if (!line) {
        continue;
      }
      var parts = line.split(":");
      var name = parts.length > 1 ? parts[0].trim() : "preset " + (output.length + 1);
      var values = parseCurve(parts.length > 1 ? parts.slice(1).join(":") : line);
      if (values) {
        output.push({
          name: name,
          curve: values
        });
      }
    }
    return output;
  }

  function parseCurve(value) {
    var numbers = String(value || "").match(/-?\d*\.?\d+/g);
    if (!numbers || numbers.length !== 4) {
      return null;
    }
    return parseCurveArray(numbers);
  }

  function parseCurveArray(values) {
    if (!(values instanceof Array) || values.length !== 4) {
      return null;
    }

    var curve = [];
    for (var i = 0; i < values.length; i += 1) {
      var number = Number(values[i]);
      if (!isFinite(number)) {
        return null;
      }
      curve.push(number);
    }

    return cleanCurve(curve);
  }

  function cleanCurve(curve) {
    return [
      roundTo(clamp(Number(curve[0]) || 0, 0, 1), 4),
      roundTo(clamp(Number(curve[1]) || 0, MIN_Y, MAX_Y), 4),
      roundTo(clamp(Number(curve[2]) || 0, 0, 1), 4),
      roundTo(clamp(Number(curve[3]) || 0, MIN_Y, MAX_Y), 4)
    ];
  }

  function miniCurveSvg(curve) {
    var geometry = miniCurveGeometry(curve);

    return [
      "<svg viewBox=\"0 0 " + geometry.width + " " + geometry.height + "\" aria-hidden=\"true\">",
      "<path d=\"" + geometry.path + "\"></path>",
      "<circle cx=\"" + geometry.p0.x + "\" cy=\"" + geometry.p0.y + "\" r=\"1.6\"></circle>",
      "<circle cx=\"" + geometry.p3.x + "\" cy=\"" + geometry.p3.y + "\" r=\"1.6\"></circle>",
      "<circle class=\"preset-hover-dot\" r=\"2.2\" style=\"offset-path: path('" + geometry.path + "');\"></circle>",
      "</svg>"
    ].join("");
  }

  function miniCurveGeometry(curve) {
    var width = 54;
    var height = 42;
    var pad = 4;
    var p0 = miniPoint([0, 0], width, height, pad);
    var p1 = miniPoint([curve[0], curve[1]], width, height, pad);
    var p2 = miniPoint([curve[2], curve[3]], width, height, pad);
    var p3 = miniPoint([1, 1], width, height, pad);
    var path = "M" + p0.x + " " + p0.y + " C" + p1.x + " " + p1.y + " " + p2.x + " " + p2.y + " " + p3.x + " " + p3.y;

    return {
      width: width,
      height: height,
      path: path,
      p0: p0,
      p3: p3
    };
  }

  function miniPoint(point, width, height, pad) {
    var usableW = width - pad * 2;
    var usableH = height - pad * 2;
    return {
      x: roundTo(pad + point[0] * usableW, 2),
      y: roundTo(pad + (1 - clamp(point[1], -0.3, 1.3)) * usableH, 2)
    };
  }

  function formatCurve(curve) {
    return curve.map(function (value) {
      return Number(value).toFixed(2);
    }).join(", ");
  }

  function updateValueText() {
    var formatted = formatCurve(state.curve);
    els.valueBtn.textContent = formatted;
    if (els.techCoords) {
      els.techCoords.textContent = formatted;
    }
    if (!graph.drag) {
      updateCurvePreview();
    }
  }

  function findLibrary(id) {
    for (var i = 0; i < state.libraries.length; i += 1) {
      if (state.libraries[i].id === id) {
        return state.libraries[i];
      }
    }
    return null;
  }

  function findPreset(id) {
    for (var i = 0; i < state.libraries.length; i += 1) {
      for (var j = 0; j < state.libraries[i].presets.length; j += 1) {
        if (state.libraries[i].presets[j].id === id) {
          return state.libraries[i].presets[j];
        }
      }
    }
    return null;
  }

  function findPresetInLibrary(library, id) {
    if (!library) {
      return null;
    }

    for (var i = 0; i < library.presets.length; i += 1) {
      if (library.presets[i].id === id) {
        return library.presets[i];
      }
    }
    return null;
  }

  function preset(id, name, curve) {
    return {
      id: id,
      name: name,
      curve: curve ? cleanCurve(curve) : null
    };
  }

  function normalizeLibrary(library) {
    var out = {
      id: library.id || uniqueId("library"),
      name: library.name || "library",
      mode: normalizeGraphMode(library.mode),
      locked: !!library.locked,
      presets: []
    };

    var presets = library.presets || [];
    for (var i = 0; i < presets.length; i += 1) {
      if (presets[i]) {
        out.presets.push(preset(presets[i].id || uniqueId("preset"), presets[i].name || "preset", presets[i].curve));
      }
    }

    return out;
  }

  function clonePresets(items) {
    return items.map(function (item) {
      return preset(item.id, item.name, item.curve);
    });
  }

  function mixCurve(a, b, t) {
    return [
      roundTo(lerp(a[0], b[0], t), 4),
      roundTo(lerp(a[1], b[1], t), 4),
      roundTo(lerp(a[2], b[2], t), 4),
      roundTo(lerp(a[3], b[3], t), 4)
    ];
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }




  function getVisualX(curve) {
    var x1 = curve[0];
    var x2 = curve[2];
    var visX1 = x1 * 0.5;
    var visX2 = 1.0 - (1.0 - x2) * 0.5;
    return [visX1, visX2];
  }

  function solveBezierTForX(curve, x) {
    var low = 0;
    var high = 1;
    var t = x;
    for (var i = 0; i < 28; i += 1) {
      t = (low + high) / 2;
      if (cubicBezierValue(t, 0, curve[0], curve[2], 1) < x) {
        low = t;
      } else {
        high = t;
      }
    }
    return t;
  }

  function cubicBezierValue(t, p0, p1, p2, p3) {
    var mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
  }

  function cubicBezierDerivative(t, p0, p1, p2, p3) {
    var mt = 1 - t;
    return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function distance(a, b) {
    var dx = a[0] - b[0];
    var dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function roundTo(value, digits) {
    var power = Math.pow(10, digits);
    return Math.round(value * power) / power;
  }

  function uniqueId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.round(Math.random() * 1e7).toString(36);
  }

  function jsString(value) {
    return "'" + String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r/g, "\\r").replace(/\n/g, "\\n") + "'";
  }

  function sanitizeFileName(value) {
    return String(value || "sori-library").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").toLowerCase();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function copyEase() {
    evalAe("SORI.copyEaseSelection()", function (response) {
      var parsed = parseAeResponse(response);
      if (!parsed.ok) {
        if (parsed.message && parsed.message.indexOf("Separate Dimensions") !== -1) {
          promptSeparateDimensions(copyEase);
        } else {
          toast("error", parsed.message || "Select a keyframe to copy ease.");
        }
        return;
      }

      if (!parsed.data || !parsed.data.items || !parsed.data.items.length) {
        toast("error", "Select a keyframe to copy ease.");
        return;
      }

      var items = normalizeCopiedEaseItems(parsed.data.items);
      var curve = items[0].curve;
      state.copiedEase = {
        curve: curve,
        items: items,
        count: items.length,
        direction: state.direction || "both",
        copiedAt: Date.now()
      };
      persistEaseClipboard();
      updateEaseTransferButton();
      toast("success", parsed.message || ("Copied " + items.length + " ease" + (items.length === 1 ? "" : "s") + "."));
    });
  }

  function pasteEase() {
    var clipboard = getEaseClipboard();
    if (!clipboard || !clipboard.curve) {
      state.copiedEase = null;
      updateEaseTransferButton();
      toast("info", "Copy an ease first.");
      return;
    }

    var items = normalizeCopiedEaseItems(clipboard.items || [{ curve: clipboard.curve }]);
    if (!items.length) {
      state.copiedEase = null;
      updateEaseTransferButton();
      toast("info", "Copy an ease first.");
      return;
    }

    updateEaseTransferButton();

    var payload = {
      items: items,
      direction: clipboard.direction || state.direction || "both",
      maxSpeed: MAX_AE_SPEED
    };

    evalAe("SORI.pasteEaseSelection(" + jsString(JSON.stringify(payload)) + ")", function (response) {
      var parsed = parseAeResponse(response);
      if (!parsed.ok && parsed.message && parsed.message.indexOf("Separate Dimensions") !== -1) {
        promptSeparateDimensions(pasteEase);
      } else {
        toast(parsed.ok ? "success" : "error", parsed.message || "No response from After Effects.");
      }
    });
  }

  function hasCopiedEase() {
    var clipboard = getEaseClipboard();
    return !!(clipboard && clipboard.curve);
  }

  function getEaseClipboard() {
    if (state.copiedEase && state.copiedEase.curve) {
      return state.copiedEase;
    }
    return restoreEaseClipboard();
  }

  function restoreEaseClipboard() {
    try {
      var raw = localStorage.getItem("sori.clipboard");
      if (!raw) {
        return null;
      }
      var clipboard = JSON.parse(raw);
      if (clipboard && clipboard.curve) {
        clipboard.items = normalizeCopiedEaseItems(clipboard.items || [{ curve: clipboard.curve }]);
        if (!clipboard.items.length) {
          return null;
        }
        clipboard.curve = clipboard.items[0].curve.slice();
        clipboard.count = clipboard.items.length;
        state.copiedEase = clipboard;
        return clipboard;
      }
    } catch (error) {}
    return null;
  }

  function persistEaseClipboard() {
    try {
      localStorage.setItem("sori.clipboard", JSON.stringify(state.copiedEase));
    } catch (error) {}
  }

  function updateEaseTransferButton() {
    if (!els.copyEaseBtn || !els.pasteEaseBtn) {
      return;
    }

    var clipboard = getEaseClipboard();
    var canPaste = !!(clipboard && clipboard.curve);
    var count = clipboard && clipboard.count ? clipboard.count : 0;
    els.copyEaseBtn.title = "Copy selected keyframe ease";
    els.copyEaseBtn.setAttribute("aria-label", els.copyEaseBtn.title);
    els.copyEaseBtn.innerHTML = copyEaseIcon();

    els.pasteEaseBtn.classList.toggle("has-ease", canPaste);
    els.pasteEaseBtn.disabled = !canPaste;
    els.pasteEaseBtn.title = canPaste ? ("Paste " + count + " copied ease" + (count === 1 ? "" : "s") + " to selected keyframes") : "Copy an ease first";
    els.pasteEaseBtn.setAttribute("aria-label", els.pasteEaseBtn.title);
    els.pasteEaseBtn.innerHTML = pasteEaseIcon();
  }

  function normalizeCopiedEaseItems(items) {
    var output = [];
    if (!(items instanceof Array)) {
      return output;
    }
    for (var i = 0; i < items.length; i += 1) {
      if (items[i] && items[i].curve) {
        output.push(Object.assign({}, items[i], {
          curve: cleanCurve(items[i].curve)
        }));
      }
    }
    return output;
  }

  function copyEaseIcon() {
    return "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"9\" width=\"11\" height=\"11\" rx=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h9a2 2 0 0 1 2 2v1\"/></svg>";
  }

  function pasteEaseIcon() {
    return "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><rect x=\"8\" y=\"2\" width=\"8\" height=\"4\" rx=\"1\"/><path d=\"M9 14h6\"/><path d=\"m12 11 3 3-3 3\"/></svg>";
  }



  function isVerticalLayout() {
    return window.matchMedia("(orientation: portrait), (max-width: 430px)").matches;
  }
})();
