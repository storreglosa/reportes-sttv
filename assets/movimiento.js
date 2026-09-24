/* Movilidad Valledupar · motor de movimiento (sin dependencias).
   Principio: el HTML se ve completo sin este archivo. El estado oculto solo
   existe bajo html.js-mov, que se añade aquí, y solo si el navegador puede
   revelarlo después (IntersectionObserver). Con movimiento reducido el CSS no
   oculta nada que se desplace y aquí no se reproduce nada automáticamente. */
(function () {
  "use strict";
  var d = document, h = d.documentElement;
  var reducido = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("IntersectionObserver" in window)) return;          // todo queda visible
  h.classList.add("js-mov");

  /* --- Titulares palabra por palabra. Respeta los elementos internos (el
         acento en <em>): solo parte los nodos de texto. */
  function partir(el) {
    var i = 0;
    (function recorrer(nodo) {
      Array.prototype.slice.call(nodo.childNodes).forEach(function (hijo) {
        if (hijo.nodeType === 3) {
          var trozos = hijo.textContent.split(/(\s+)/), frag = d.createDocumentFragment();
          trozos.forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(d.createTextNode(t)); return; }
            var s = d.createElement("span"); s.className = "pal"; s.style.setProperty("--i", i++);
            s.textContent = t; frag.appendChild(s);
          });
          nodo.replaceChild(frag, hijo);
        } else if (hijo.nodeType === 1 && !hijo.classList.contains("pal")) {
          if (hijo.tagName === "EM") {                         // el acento entra como una pieza
            var e = hijo; e.classList.add("pal"); e.style.setProperty("--i", i++);
          } else recorrer(hijo);
        }
      });
    })(el);
  }
  d.querySelectorAll("[data-palabras]").forEach(partir);

  /* --- Escalonado de hermanos: [data-escalona] numera a sus hijos [data-sube]. */
  d.querySelectorAll("[data-escalona]").forEach(function (g) {
    g.querySelectorAll(":scope > [data-sube]").forEach(function (c, i) { c.style.setProperty("--i", Math.min(i, 6)); });
  });

  /* --- Revelado al entrar en pantalla. */
  var observados = d.querySelectorAll("[data-palabras],[data-sube],[data-zoom],[data-dibuja],[data-huella],[data-cuenta]");
  var io = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target; el.classList.add("visible"); io.unobserve(el);
      if (el.hasAttribute("data-cuenta")) contar(el);
      el.dispatchEvent(new CustomEvent("mov:visible"));
    });
  }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
  // Umbral 0 a propósito: con un porcentaje (p. ej. 18 %), un bloque más alto
  // que la pantalla dividida por ese porcentaje nunca llegaría a revelarse y su
  // contenido quedaría oculto para siempre en un celular.
  observados.forEach(function (el) { io.observe(el); });
  // Red de seguridad: nada se queda oculto por un observador que no disparó.
  function revelarTodo() { observados.forEach(function (el) { el.classList.add("visible"); }); }
  window.addEventListener("beforeprint", revelarTodo);
  setTimeout(function () {
    observados.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add("visible");
    });
  }, 2500);

  /* --- Contadores. El valor real ya está en el HTML: el conteo arranca de
         cero solo en pantalla y termina exactamente en el texto original. */
  function contar(el) {
    if (reducido) return;
    var final = el.textContent, objetivo = parseFloat(final.replace(/\./g, "").replace(",", "."));
    if (!isFinite(objetivo) || objetivo === 0) return;
    var t0 = null, dur = 900;
    el.setAttribute("aria-label", final);
    function paso(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(2, -10 * p);
      el.textContent = p < 1 ? Math.round(objetivo * e).toLocaleString("es-CO") : final;
      if (p < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }

  /* --- Pausa global (WCAG 2.2.2): detiene franjas y carrusel. */
  d.querySelectorAll("[data-pausa]").forEach(function (b) {
    b.addEventListener("click", function () {
      var p = h.classList.toggle("mov-pausado");
      b.setAttribute("aria-pressed", p ? "true" : "false");
      b.querySelector("[data-texto]").textContent = p ? "Reanudar movimiento" : "Pausar movimiento";
      d.dispatchEvent(new CustomEvent("mov:pausa", { detail: p }));
    });
  });

  /* --- Franjas en bucle: se duplica el tramo una vez (el clon no se lee en
         voz alta) y se detienen fuera de pantalla. */
  d.querySelectorAll("[data-franja]").forEach(function (f) {
    var pista = f.querySelector(".pista"), tramo = pista && pista.querySelector(".tramo");
    if (!tramo) return;
    var clon = tramo.cloneNode(true); clon.setAttribute("aria-hidden", "true");
    clon.querySelectorAll("a,button").forEach(function (a) { a.setAttribute("tabindex", "-1"); });
    pista.appendChild(clon);
    new IntersectionObserver(function (e) { f.classList.toggle("fuera", !e[0].isIntersecting); }).observe(f);
  });

  /* --- Carrusel: fundido cruzado, barras de progreso, anterior / siguiente,
         pausa con mouse, foco, pestaña oculta, fuera de pantalla o pausa global. */
  d.querySelectorAll("[data-carrusel]").forEach(function (c) {
    var laminas = c.querySelectorAll(".lamina"), barras = c.querySelectorAll(".progreso button");
    if (laminas.length < 2) return;
    c.classList.add("con-js");
    var actual = 0, intervalo = 6500, progreso = 0, ultimoT = null, dentro = false, foco = false, visible = true;
    function detenido() { return reducido || dentro || foco || !visible || d.hidden || h.classList.contains("mov-pausado"); }
    function mostrar(i) {
      actual = (i + laminas.length) % laminas.length; progreso = 0;
      laminas.forEach(function (l, j) {
        l.classList.toggle("activa", j === actual); l.setAttribute("aria-hidden", j === actual ? "false" : "true");
        l.querySelectorAll("a").forEach(function (a) { a.tabIndex = j === actual ? 0 : -1; });
      });
      barras.forEach(function (b, j) {
        b.setAttribute("aria-current", j === actual ? "true" : "false");
        b.querySelector("i").style.transform = "scaleX(" + (j < actual ? 1 : 0) + ")";
      });
      var titular = laminas[actual].querySelector("[data-palabras]");
      if (titular) { titular.classList.remove("visible"); void titular.offsetWidth; titular.classList.add("visible"); }
    }
    // El progreso solo avanza mientras nada lo detiene: pausar conserva la barra
    // donde quedó, sin cuentas de tiempo que se desincronicen.
    function tic(t) {
      if (ultimoT !== null && !detenido()) {
        progreso += (t - ultimoT) / intervalo;
        barras[actual].querySelector("i").style.transform = "scaleX(" + Math.min(1, progreso) + ")";
        if (progreso >= 1) mostrar(actual + 1);
      }
      ultimoT = t; requestAnimationFrame(tic);
    }
    c.addEventListener("pointerenter", function () { dentro = true; });
    c.addEventListener("pointerleave", function () { dentro = false; });
    c.addEventListener("focusin", function () { foco = true; });
    c.addEventListener("focusout", function (e) { if (!c.contains(e.relatedTarget)) foco = false; });
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(c);
    barras.forEach(function (b, j) { b.addEventListener("click", function () { mostrar(j); }); });
    var ant = c.querySelector("[data-anterior]"), sig = c.querySelector("[data-siguiente]");
    if (ant) ant.addEventListener("click", function () { mostrar(actual - 1); });
    if (sig) sig.addEventListener("click", function () { mostrar(actual + 1); });
    mostrar(0);
    if (!reducido) requestAnimationFrame(tic);
  });

  /* --- Índice flotante con la sección en pantalla. */
  d.querySelectorAll("[data-indice]").forEach(function (ind) {
    var boton = ind.querySelector("button"), lista = ind.querySelector("ol"), etiqueta = ind.querySelector(".actual");
    var enlaces = Array.prototype.slice.call(ind.querySelectorAll("ol a"));
    function abrir(si) { if (si) ind.setAttribute("data-abierto", ""); else ind.removeAttribute("data-abierto");
      boton.setAttribute("aria-expanded", si ? "true" : "false"); }
    boton.addEventListener("click", function () { abrir(!ind.hasAttribute("data-abierto")); if (ind.hasAttribute("data-abierto")) (enlaces.filter(function (a) { return a.getAttribute("aria-current") === "true"; })[0] || enlaces[0]).focus(); });
    lista.addEventListener("click", function (e) { if (e.target.closest("a")) abrir(false); });
    d.addEventListener("keydown", function (e) { if (e.key === "Escape" && ind.hasAttribute("data-abierto")) { abrir(false); boton.focus(); } });
    d.addEventListener("click", function (e) { if (!ind.contains(e.target)) abrir(false); });
    var secciones = enlaces.map(function (a) { return d.getElementById(a.hash.slice(1)); }).filter(Boolean);
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        enlaces.forEach(function (a) { var si = a.hash.slice(1) === en.target.id; a.setAttribute("aria-current", si ? "true" : "false"); if (si) etiqueta.textContent = a.textContent; });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    secciones.forEach(function (s) { spy.observe(s); });
  });
})();
