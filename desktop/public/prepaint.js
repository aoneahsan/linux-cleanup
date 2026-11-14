/* Pre-paint, loaded synchronously from <head> (the CSP forbids inline scripts).
   The ONE axis registry (mirrors src/theme/axes.ts; axes.test.ts keeps them equal).
   The sanctioned strata-storage exception: physical key "linux-cleanup-app:<axis>", value JSON .value. */
(function () {
  var A = {"theme":["system","light","dark"],"palette":["survey","coral","violet"],"radius":["none","small","medium","large"],"density":["compact","comfortable","spacious"],"type-scale":["small","medium","large"],"motion":["system","full","reduced"],"sound":["off","on"]};
  var r = document.documentElement;
  for (var axis in A) {
    try {
      var raw = localStorage.getItem('linux-cleanup-app:' + axis);
      var v = raw && JSON.parse(raw).value;
      if (A[axis].indexOf(v) > -1) r.setAttribute('data-' + axis, v);
    } catch (e) { /* storage blocked: keep the defaults on <html> */ }
  }
  var t = r.getAttribute('data-theme');
  r.setAttribute('data-appearance', t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t);
  if (window.__TAURI_INTERNALS__) r.setAttribute('data-tauri', '');
})();
