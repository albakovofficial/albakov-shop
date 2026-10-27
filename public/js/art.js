/* Студийные заглушки для товаров без фото: силуэт изделия на тёмном фоне.
   Как только в админке загружено фото, показывается оно. */
(function (root) {
  var SHAPES = {
    coat: '<path d="M112 74 L138 62 L150 104 L162 62 L188 74 L232 100 L248 300 L226 305 L210 168 L214 352 L86 352 L90 168 L74 305 L52 300 L68 100 Z"/><path d="M138 62 L150 104 L162 62 M150 104 L150 352" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2"/><circle cx="140" cy="150" r="3" fill="rgba(0,0,0,.35)"/><circle cx="140" cy="190" r="3" fill="rgba(0,0,0,.35)"/><circle cx="160" cy="150" r="3" fill="rgba(0,0,0,.35)"/><circle cx="160" cy="190" r="3" fill="rgba(0,0,0,.35)"/>',
    knit: '<path d="M114 72 Q150 92 186 72 L232 96 L254 286 L230 292 L208 150 L210 312 L90 312 L92 150 L70 292 L46 286 L68 96 Z"/><path d="M92 300 L208 300 M230 280 L252 276 M70 280 L48 276" stroke="rgba(0,0,0,.25)" stroke-width="6" fill="none"/><path d="M118 74 Q150 96 182 74" stroke="rgba(0,0,0,.25)" stroke-width="5" fill="none"/>',
    shirt: '<path d="M116 70 L138 62 L150 80 L162 62 L184 70 L230 96 L250 284 L228 290 L208 150 L210 320 L90 320 L92 150 L72 290 L50 284 L70 96 Z"/><path d="M138 62 L150 92 L162 62 M150 92 L150 320" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="2"/>',
    tee: '<path d="M112 76 Q150 96 188 76 L240 100 L258 150 L222 162 L210 138 L212 316 L88 316 L90 138 L78 162 L42 150 L60 100 Z"/><path d="M116 78 Q150 100 184 78" stroke="rgba(0,0,0,.25)" stroke-width="4" fill="none"/>',
    trousers: '<path d="M98 64 L202 64 L216 352 L166 352 L150 142 L134 352 L84 352 Z"/><path d="M98 80 L202 80" stroke="rgba(0,0,0,.25)" stroke-width="3"/><path d="M122 84 L114 352 M178 84 L186 352" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/>',
    dress: '<path d="M124 58 L140 58 Q150 74 160 58 L176 58 L184 128 L178 160 L232 350 L68 350 L122 160 L116 128 Z"/><path d="M118 156 L182 156" stroke="rgba(0,0,0,.25)" stroke-width="3"/>',
    bag: '<path d="M112 140 Q112 70 150 70 Q188 70 188 140" fill="none" stroke-width="9" stroke="currentColor"/><path d="M78 140 L222 140 L236 326 L64 326 Z"/><path d="M78 160 L222 160" stroke="rgba(0,0,0,.25)" stroke-width="2"/>'
  };
  function shade(hex, k) {
    var n = parseInt(String(hex || '#3a3632').slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function f(c) { return Math.max(0, Math.min(255, Math.round(c * k))); }
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  function art(spec, w, h) {
    spec = spec || { kind: 'tee', tone: '#3a3632' };
    var tone = spec.tone || '#3a3632', shape = SHAPES[spec.kind] || SHAPES.tee;
    var hi = '#f8f6f2', lo = '#e4e0d8';
    try { var cs = getComputedStyle(document.documentElement); hi = cs.getPropertyValue('--art-hi').trim() || hi; lo = cs.getPropertyValue('--art-lo').trim() || lo; } catch (e) {}
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice">' +
      '<defs><radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="' + hi + '"/><stop offset="1" stop-color="' + lo + '"/></radialGradient>' +
      '<linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + shade(tone, 1.25) + '"/><stop offset="1" stop-color="' + shade(tone, 0.78) + '"/></linearGradient></defs>' +
      '<rect width="300" height="400" fill="url(#g)"/>' +
      '<ellipse cx="150" cy="364" rx="96" ry="9" fill="rgba(20,20,22,.14)"/>' +
      '<g fill="url(#t)" color="' + shade(tone, 0.9) + '" transform="translate(0,6)">' + shape + '</g></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  root.Art = { make: art };
})(this);
