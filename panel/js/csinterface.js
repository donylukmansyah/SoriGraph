/* Minimal CEP bridge for this panel. */
(function () {
  "use strict";

  function CSInterface() {}

  CSInterface.prototype.evalScript = function (script, callback) {
    if (window.__adobe_cep__ && window.__adobe_cep__.evalScript) {
      window.__adobe_cep__.evalScript(script, callback || function () {});
      return;
    }

    console.warn("CEP evalScript is not available. Running in browser preview mode.");
    if (callback) {
      callback(JSON.stringify({
        ok: false,
        message: "After Effects bridge is only available inside CEP."
      }));
    }
  };

  CSInterface.prototype.getSystemPath = function (name) {
    if (window.__adobe_cep__ && window.__adobe_cep__.getSystemPath) {
      return window.__adobe_cep__.getSystemPath(name);
    }
    return "";
  };

  window.CSInterface = window.CSInterface || CSInterface;
})();
