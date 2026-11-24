"use strict";
/*
 * Patrimonio — versión de prueba sin conexiones bancarias.
 * Todo se guarda CIFRADO (AES-256-GCM) en el teléfono. La llave sale de tu código
 * con PBKDF2-SHA256 (600,000 iteraciones) y solo vive en memoria mientras la app está abierta.
 * Nada se envía a ningún servidor.
 */
(() => {
  // ───────────────────────── Constantes ─────────────────────────
  const ITERACIONES = 600000;
  const BLOQUEO_MS = 2 * 60 * 1000; // se bloquea tras 2 min en segundo plano
  const DIAS_RECORDAR_RESPALDO = 7;

  const TIPOS = {
    efectivo: { nombre: "Efectivo y bancos", clase: "activo" },
    inversiones: { nombre: "Inversiones", clase: "activo" },
    retiro: { nombre: "Retiro", clase: "activo" },
    cripto: { nombre: "Cripto", clase: "activo" },
    inmuebles: { nombre: "Inmuebles", clase: "activo" },
    vehiculos: { nombre: "Vehículos", clase: "activo" },
    empresas: { nombre: "Empresas", clase: "activo" },
    otros_activos: { nombre: "Otros activos", clase: "activo" },
    tarjetas: { nombre: "Tarjetas de crédito", clase: "pasivo" },
    hipotecas: { nombre: "Hipotecas", clase: "pasivo" },
    prestamos: { nombre: "Préstamos", clase: "pasivo" },
    otras_deudas: { nombre: "Otras deudas", clase: "pasivo" },
  };
  const MONEDAS = ["USD", "COP"];

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ───────────────────────── Estado ─────────────────────────
  let llave = null; // CryptoKey, solo en memoria
  let sal = null; // Uint8Array
  let datos = null; // datos descifrados, solo en memoria
  let vista = "resumen";
  let ocultoDesde = 0;
  let intentosFallidos = 0;
  let esperaHasta = 0;

  // ───────────────────────── Utilidades ─────────────────────────
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const hoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const nuevoId = () => crypto.randomUUID();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const desdeB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  function dinero(valor, moneda, decimales = 0) {
    return new Intl.NumberFormat("es-US", {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(valor);
  }
  function fechaCorta(iso) {
    const [a, m, d] = iso.split("-").map(Number);
    return new Date(a, m - 1, d).toLocaleDateString("es-US", { day: "numeric", month: "short", year: "numeric" });
  }
  function aviso(texto) {
    const el = $("#aviso");
    el.textContent = texto;
    el.classList.remove("oculto");
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => el.classList.add("oculto"), 2600);
  }
  function leerNumero(texto) {
    // Acepta "1,234.56" y "1234,56"
    let t = String(texto).trim().replace(/[^\d.,-]/g, "");
    if (t.includes(",") && t.includes(".")) t = t.replace(/,/g, "");
    else if (t.includes(",")) t = /,\d{1,2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }

  // ───────────────────────── Almacén (IndexedDB) ─────────────────────────
  const almacen = {
    db: null,
    abrir() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((ok, mal) => {
        const r = indexedDB.open("patrimonio", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => ok((this.db = r.result));
        r.onerror = () => mal(r.error);
      });
    },
    async obtener(k) {
      const db = await this.abrir();
      return new Promise((ok, mal) => {
        const r = db.transaction("kv").objectStore("kv").get(k);
        r.onsuccess = () => ok(r.result);
        r.onerror = () => mal(r.error);
      });
    },
    async guardar(k, v) {
      const db = await this.abrir();
      return new Promise((ok, mal) => {
        const t = db.transaction("kv", "readwrite");
        t.objectStore("kv").put(v, k);
        t.oncomplete = () => ok();
        t.onerror = () => mal(t.error);
      });
    },
    async borrar(k) {
      const db = await this.abrir();
      return new Promise((ok) => {
        const t = db.transaction("kv", "readwrite");
        t.objectStore("kv").delete(k);
        t.oncomplete = () => ok();
      });
    },
  };

  // ───────────────────────── Cifrado ─────────────────────────
  async function derivarLlave(codigo, salBytes) {
    const base = await crypto.subtle.importKey("raw", enc.encode(codigo), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salBytes, iterations: ITERACIONES, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }
  async function cifrar(k, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(obj)));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function descifrar(k, iv, ct) {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: desdeB64(iv) }, k, desdeB64(ct));
    return JSON.parse(dec.decode(pt));
  }

  function datosVacios() {
    return { version: 1, ajustes: { monedaBase: "USD", tasaCOP: 4000, ultimoRespaldo: null }, cuentas: [] };
  }

  async function guardarDatos() {
    const { iv, ct } = await cifrar(llave, datos);
    await almacen.guardar("boveda", { v: 1, sal: b64(sal), iv, ct });
  }

  async function crearBoveda(codigo) {
    sal = crypto.getRandomValues(new Uint8Array(16));
    llave = await derivarLlave(codigo, sal);
    if (!datos) datos = datosVacios();
    await guardarDatos();
  }

  async function abrirBoveda(codigo) {
    const b = await almacen.obtener("boveda");
    const s = desdeB64(b.sal);
    const k = await derivarLlave(codigo, s);
    datos = await descifrar(k, b.iv, b.ct); // falla si el código es incorrecto
    sal = s;
    llave = k;
  }

  function bloquear() {
    llave = null;
    datos = null;
    cerrarHoja();
    pintarBloqueo();
  }

  // ───────────────────────── Cálculos ─────────────────────────
  function convertir(valor, de, a) {
    if (de === a) return valor;
    const tasa = datos.ajustes.tasaCOP || 1;
    if (de === "USD" && a === "COP") return valor * tasa;
    if (de === "COP" && a === "USD") return valor / tasa;
    return valor;
  }
  function valorActual(c) {
    if (!c.valores.length) return 0;
    return [...c.valores].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1).valor;
  }
  function valorEnFecha(c, fecha) {
    let v = null;
    for (const e of [...c.valores].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      if (e.fecha <= fecha) v = e.valor;
    }
    return v ?? 0;
  }
  const signo = (c) => (TIPOS[c.tipo]?.clase === "pasivo" ? -1 : 1);

  function totales() {
    const base = datos.ajustes.monedaBase;
    let activos = 0;
    let pasivos = 0;
    for (const c of datos.cuentas) {
      const v = convertir(valorActual(c), c.moneda, base);
      if (signo(c) > 0) activos += v;
      else pasivos += v;
    }
    return { activos, pasivos, neto: activos - pasivos };
  }

  function historialNeto() {
    const base = datos.ajustes.monedaBase;
    const fechas = [...new Set(datos.cuentas.flatMap((c) => c.valores.map((v) => v.fecha)))].sort();
    return fechas.map((f) => ({
      fecha: f,
      neto: datos.cuentas.reduce((s, c) => s + signo(c) * convertir(valorEnFecha(c, f), c.moneda, base), 0),
    }));
  }

  // ───────────────────────── Íconos ─────────────────────────
  const ICONO = {
    resumen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
    cuentas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    candado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  };

  // ───────────────────────── Pantalla de bloqueo ─────────────────────────
  // Teclado numérico propio: evita un error de iOS que a veces no muestra el teclado
  // en apps instaladas en la pantalla de inicio.
  const tecladoHTML = () => `
    <div class="teclado" id="teclado">
      ${["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => `<button class="tecla" data-d="${d}">${d}</button>`).join("")}
      <button class="tecla tenue" data-d="borrar" aria-label="Borrar">⌫</button>
      <button class="tecla" data-d="0">0</button>
      <button class="tecla tenue" data-d="limpiar" aria-label="Limpiar">C</button>
    </div>`;
  function conectarTeclado(campo) {
    $$(".tecla").forEach(
      (t) =>
        (t.onclick = () => {
          const c = $(campo);
          if (t.dataset.d === "borrar") c.value = c.value.slice(0, -1);
          else if (t.dataset.d === "limpiar") c.value = "";
          else if (c.value.length < 64) c.value += t.dataset.d;
          $("#err").textContent = "";
        }),
    );
  }
  // Cambia el campo de solo lectura por uno nuevo que sí acepta el teclado del sistema.
  function cambiarATecladoSistema(id, autocompletar) {
    const viejo = $(`#${id}`);
    const nuevoCampo = document.createElement("input");
    Object.assign(nuevoCampo, { id, type: "password", autocomplete: autocompletar, value: "" });
    viejo.replaceWith(nuevoCampo);
    $("#teclado")?.classList.add("oculto");
    $("#cambiar-teclado")?.classList.add("oculto");
    $("#err").textContent = "Toca el campo y escribe tu código.";
  }

  async function pintarBloqueo() {
    document.querySelector(".nav")?.remove();
    const existe = await almacen.obtener("boveda");
    const app = $("#app");
    if (!existe) {
      let primero = null;
      app.innerHTML = `
        <div class="bloqueo">
          <img src="iconos/icono-192.png" alt="" />
          <h1>Patrimonio</h1>
          <p class="tenue" id="instruccion">Crea un código de al menos 6 números. Protege tus datos, que se guardan cifrados en este teléfono.</p>
          <input id="c1" type="password" autocomplete="off" readonly aria-label="Código" />
          <div class="error" id="err"></div>
          ${tecladoHTML()}
          <button class="btn" id="crear">Continuar</button>
          <button class="btn secundario" id="cambiar-teclado">Prefiero un código con letras</button>
          <div class="nota"><strong>Importante:</strong> si olvidas este código no hay forma de recuperar los datos. Nadie puede abrirlos sin él.</div>
          <button class="btn secundario" id="restaurar">Restaurar desde un respaldo</button>
          <input type="file" id="archivo" accept="application/json,.json" class="oculto" />
        </div>`;
      conectarTeclado("#c1");
      $("#cambiar-teclado").onclick = () => cambiarATecladoSistema("c1", "new-password");
      $("#crear").onclick = async () => {
        const valor = $("#c1").value;
        if (primero === null) {
          if (valor.length < 6) return ($("#err").textContent = "El código debe tener al menos 6 caracteres.");
          primero = valor;
          $("#c1").value = "";
          $("#instruccion").textContent = "Escribe el mismo código otra vez para confirmarlo.";
          $("#crear").textContent = "Crear y entrar";
          return;
        }
        if (valor !== primero) {
          primero = null;
          $("#c1").value = "";
          $("#instruccion").textContent = "Crea un código de al menos 6 números.";
          $("#crear").textContent = "Continuar";
          return ($("#err").textContent = "Los códigos no coinciden. Empieza de nuevo.");
        }
        $("#crear").disabled = true;
        $("#crear").textContent = "Protegiendo…";
        await crearBoveda(valor);
        pedirAlmacenamientoPersistente();
        entrar();
      };
      $("#restaurar").onclick = () => $("#archivo").click();
      $("#archivo").onchange = (e) => restaurarRespaldo(e.target.files[0], true);
      return;
    }
    app.innerHTML = `
      <div class="bloqueo">
        <img src="iconos/icono-192.png" alt="" />
        <h1>Patrimonio</h1>
        <p class="tenue">Escribe tu código para abrir.</p>
        <input id="cod" type="password" autocomplete="off" readonly aria-label="Código" />
        <div class="error" id="err"></div>
        ${tecladoHTML()}
        <button class="btn" id="abrir">Abrir</button>
        <button class="btn secundario" id="cambiar-teclado">Mi código tiene letras: usar teclado</button>
        <button class="btn peligro" id="empezar">Olvidé mi código: empezar de cero</button>
      </div>`;
    conectarTeclado("#cod");
    $("#cambiar-teclado").onclick = () => cambiarATecladoSistema("cod", "current-password");
    $("#empezar").onclick = async () => {
      if (!confirm("Sin el código no se pueden abrir los datos guardados. Empezar de cero BORRA todo lo de este teléfono. ¿Continuar?")) return;
      if (!confirm("Última confirmación: ¿borrar todo y crear un código nuevo? Si tienes un respaldo podrás restaurarlo con su código.")) return;
      await almacen.borrar("boveda");
      pintarBloqueo();
    };
    const intentar = async () => {
      const ahora = Date.now();
      if (ahora < esperaHasta) {
        $("#err").textContent = `Espera ${Math.ceil((esperaHasta - ahora) / 1000)} segundos.`;
        return;
      }
      $("#abrir").disabled = true;
      $("#abrir").textContent = "Abriendo…";
      try {
        await abrirBoveda($("#cod").value);
        intentosFallidos = 0;
        entrar();
      } catch {
        intentosFallidos++;
        if (intentosFallidos >= 5) esperaHasta = Date.now() + 30000 * 2 ** (intentosFallidos - 5);
        $("#err").textContent = "Código incorrecto.";
        $("#abrir").disabled = false;
        $("#abrir").textContent = "Abrir";
        $("#cod").value = "";
      }
    };
    $("#abrir").onclick = intentar;
    $("#cod").onkeydown = (e) => e.key === "Enter" && intentar();
  }

  function pedirAlmacenamientoPersistente() {
    navigator.storage?.persist?.().catch(() => {});
  }

  // ───────────────────────── App principal ─────────────────────────
  function entrar() {
    vista = "resumen";
    pintarNav();
    pintar();
  }

  function pintarNav() {
    document.querySelector(".nav")?.remove();
    const nav = document.createElement("nav");
    nav.className = "nav";
    nav.innerHTML = ["resumen", "cuentas", "ajustes"]
      .map((v) => `<button data-v="${v}">${ICONO[v]}${v[0].toUpperCase() + v.slice(1)}</button>`)
      .join("");
    document.body.appendChild(nav);
    $$("button", nav).forEach((b) => (b.onclick = () => ((vista = b.dataset.v), pintar())));
  }

  function pintar() {
    $$(".nav button").forEach((b) => b.classList.toggle("activo", b.dataset.v === vista));
    $(".flotante")?.remove();
    if (vista === "resumen") pintarResumen();
    else if (vista === "cuentas") pintarCuentas();
    else pintarAjustes();
    window.scrollTo(0, 0);
  }

  function cabeza(titulo) {
    return `<div class="cabeza"><h1>${titulo}</h1><button class="icono-btn" id="candado" aria-label="Bloquear">${ICONO.candado}</button></div>`;
  }
  function conectarCandado() {
    $("#candado").onclick = bloquear;
  }

  // ── Resumen
  function pintarResumen() {
    const base = datos.ajustes.monedaBase;
    const t = totales();
    const hist = historialNeto();
    let cambio = "";
    if (hist.length >= 2) {
      const hace30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const ref = [...hist].reverse().find((h) => h.fecha <= hace30) ?? hist[0];
      const d = t.neto - ref.neto;
      const pct = ref.neto !== 0 ? (d / Math.abs(ref.neto)) * 100 : 0;
      cambio = `<div class="${d >= 0 ? "sube" : "baja"} num">${d >= 0 ? "▲" : "▼"} ${dinero(Math.abs(d), base)} (${pct.toFixed(1)}%) <span class="tenue">desde ${fechaCorta(ref.fecha)}</span></div>`;
    }

    const porTipo = {};
    for (const c of datos.cuentas) {
      if (signo(c) < 0) continue;
      porTipo[c.tipo] = (porTipo[c.tipo] || 0) + convertir(valorActual(c), c.moneda, base);
    }
    const dist = Object.entries(porTipo)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    const sinRespaldo =
      datos.cuentas.length > 0 &&
      (!datos.ajustes.ultimoRespaldo ||
        Date.now() - Date.parse(datos.ajustes.ultimoRespaldo) > DIAS_RECORDAR_RESPALDO * 864e5);

    $("#app").innerHTML = `
      ${cabeza("Resumen")}
      <div class="contenedor">
        ${sinRespaldo ? `<button class="btn secundario" id="ir-respaldo">Hace más de ${DIAS_RECORDAR_RESPALDO} días sin respaldo · Respaldar ahora</button>` : ""}
        <div class="tarjeta">
          <div class="etiqueta">Patrimonio neto</div>
          <div class="cifra-grande">${dinero(t.neto, base)}</div>
          ${cambio}
          ${hist.length >= 2 ? graficaSVG(hist, base) : `<p class="tenue">La gráfica aparece cuando registres valores en al menos dos fechas.</p>`}
        </div>
        <div class="dos">
          <div class="tarjeta"><div class="etiqueta">Activos</div><div class="num sube">${dinero(t.activos, base)}</div></div>
          <div class="tarjeta"><div class="etiqueta">Deudas</div><div class="num baja">${dinero(t.pasivos, base)}</div></div>
        </div>
        ${
          dist.length
            ? `<div class="tarjeta"><div class="etiqueta">Distribución de activos</div><div class="dist">${dist
                .map(
                  ([tipo, v]) => `<div class="dist-fila"><div class="fila"><span>${esc(TIPOS[tipo].nombre)}</span><span class="num tenue">${dinero(v, base)} · ${((v / t.activos) * 100).toFixed(1)}%</span></div><div class="barra"><i data-ancho="${((v / t.activos) * 100).toFixed(2)}"></i></div></div>`,
                )
                .join("")}</div></div>`
            : ""
        }
        ${datos.cuentas.length === 0 ? `<div class="vacio">Aún no tienes cuentas.<br/><button class="btn" id="primera">Agregar mi primera cuenta</button></div>` : ""}
      </div>`;
    // El ancho se fija desde JS para cumplir la política de seguridad (sin estilos en línea).
    $$(".barra > i").forEach((i) => (i.style.width = `${i.dataset.ancho}%`));
    conectarCandado();
    $("#primera") && ($("#primera").onclick = () => hojaCuenta());
    $("#ir-respaldo") && ($("#ir-respaldo").onclick = respaldar);
  }

  function graficaSVG(hist, base) {
    const W = 340;
    const H = 160;
    const pad = { i: 4, d: 4, a: 10, b: 22 };
    const xs = hist.map((h) => Date.parse(h.fecha));
    const ys = hist.map((h) => h.neto);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    let y0 = Math.min(...ys);
    let y1 = Math.max(...ys);
    if (y0 === y1) {
      y0 -= 1;
      y1 += 1;
    }
    const margen = (y1 - y0) * 0.1;
    y0 -= margen;
    y1 += margen;
    const X = (x) => pad.i + ((x - x0) / (x1 - x0 || 1)) * (W - pad.i - pad.d);
    const Y = (y) => pad.a + (1 - (y - y0) / (y1 - y0)) * (H - pad.a - pad.b);
    const pts = hist.map((h) => `${X(Date.parse(h.fecha)).toFixed(1)},${Y(h.neto).toFixed(1)}`);
    const area = `M${pts[0]} L${pts.join(" L")} L${X(x1).toFixed(1)},${H - pad.b} L${X(x0).toFixed(1)},${H - pad.b}Z`;
    return `<svg class="grafica" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolución del patrimonio neto">
      <line class="guia" x1="0" x2="${W}" y1="${H - pad.b}" y2="${H - pad.b}"/>
      <path class="area" d="${area}"/>
      <polyline class="linea" points="${pts.join(" ")}"/>
      <text class="eje" x="${pad.i}" y="${H - 6}">${esc(fechaCorta(hist[0].fecha))}</text>
      <text class="eje" x="${W - pad.d}" y="${H - 6}" text-anchor="end">${esc(fechaCorta(hist.at(-1).fecha))}</text>
    </svg><div class="fila tenue"><span>Mín. ${dinero(Math.min(...ys), base)}</span><span>Máx. ${dinero(Math.max(...ys), base)}</span></div>`;
  }

  // ── Cuentas
  function pintarCuentas() {
    const base = datos.ajustes.monedaBase;
    const grupos = Object.keys(TIPOS)
      .map((tipo) => ({ tipo, cuentas: datos.cuentas.filter((c) => c.tipo === tipo) }))
      .filter((g) => g.cuentas.length);
    $("#app").innerHTML = `
      ${cabeza("Cuentas")}
      <div class="contenedor">
        ${
          grupos.length
            ? grupos
                .map((g) => {
                  const total = g.cuentas.reduce((s, c) => s + convertir(valorActual(c), c.moneda, base), 0);
                  return `<div class="grupo-titulo"><span class="etiqueta">${esc(TIPOS[g.tipo].nombre)}</span><span class="tenue num">${dinero(total, base)}</span></div>
                <div class="lista">${g.cuentas
                  .sort((a, b) => convertir(valorActual(b), b.moneda, base) - convertir(valorActual(a), a.moneda, base))
                  .map((c) => {
                    const ult = [...c.valores].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
                    return `<button class="item" data-id="${esc(c.id)}"><div class="fila"><span class="nombre">${esc(c.nombre)}</span><span class="num">${dinero(valorActual(c), c.moneda)}</span></div>
                      <div class="fila tenue"><span>${ult ? "Actualizado " + esc(fechaCorta(ult.fecha)) : "Sin valor"}</span><span>${c.moneda !== base ? "≈ " + dinero(convertir(valorActual(c), c.moneda, base), base) : ""}</span></div></button>`;
                  })
                  .join("")}</div>`;
                })
                .join("")
            : `<div class="vacio">Agrega tus cuentas, inversiones, propiedades y deudas con el botón +.</div>`
        }
      </div>`;
    conectarCandado();
    $$(".item").forEach((b) => (b.onclick = () => hojaDetalle(b.dataset.id)));
    const f = document.createElement("button");
    f.className = "flotante";
    f.setAttribute("aria-label", "Agregar cuenta");
    f.textContent = "+";
    f.onclick = () => hojaCuenta();
    document.body.appendChild(f);
  }

  // ── Hojas (modales)
  function abrirHoja(html) {
    $("#hoja-contenido").innerHTML = html;
    $("#hoja").classList.remove("oculto");
  }
  function cerrarHoja() {
    $("#hoja").classList.add("oculto");
    $("#hoja-contenido").innerHTML = "";
  }
  $("#hoja").addEventListener("click", (e) => e.target.id === "hoja" && cerrarHoja());

  const opcionesTipo = (sel) =>
    `<optgroup label="Activos">${Object.entries(TIPOS)
      .filter(([, t]) => t.clase === "activo")
      .map(([k, t]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${t.nombre}</option>`)
      .join("")}</optgroup><optgroup label="Deudas">${Object.entries(TIPOS)
      .filter(([, t]) => t.clase === "pasivo")
      .map(([k, t]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${t.nombre}</option>`)
      .join("")}</optgroup>`;
  const opcionesMoneda = (sel) => MONEDAS.map((m) => `<option ${m === sel ? "selected" : ""}>${m}</option>`).join("");

  function hojaCuenta(id) {
    const c = id ? datos.cuentas.find((x) => x.id === id) : null;
    abrirHoja(`
      <h2>${c ? "Editar cuenta" : "Nueva cuenta"}</h2>
      <label for="n">Nombre</label><input id="n" maxlength="60" value="${c ? esc(c.nombre) : ""}" placeholder="Ej. Chase ahorros, Casa, Tesla" />
      <label for="t">Tipo</label><select id="t">${opcionesTipo(c?.tipo ?? "efectivo")}</select>
      <label for="m">Moneda</label><select id="m">${opcionesMoneda(c?.moneda ?? datos.ajustes.monedaBase)}</select>
      ${
        c
          ? ""
          : `<div class="dos"><div><label for="v">Valor actual</label><input id="v" inputmode="decimal" placeholder="0" /></div>
             <div><label for="f">Fecha</label><input id="f" type="date" value="${hoy()}" max="${hoy()}" /></div></div>
             <p class="tenue">Para deudas escribe el saldo que debes, en positivo.</p>`
      }
      <div class="error" id="err-h"></div>
      <button class="btn" id="ok">${c ? "Guardar" : "Agregar"}</button>
      <button class="btn secundario" id="cancelar">Cancelar</button>`);
    $("#cancelar").onclick = cerrarHoja;
    $("#ok").onclick = async () => {
      const nombre = $("#n").value.trim();
      if (!nombre) return ($("#err-h").textContent = "Escribe un nombre.");
      if (c) {
        Object.assign(c, { nombre, tipo: $("#t").value, moneda: $("#m").value });
      } else {
        const valor = leerNumero($("#v").value || "0");
        if (Number.isNaN(valor) || valor < 0) return ($("#err-h").textContent = "Valor inválido.");
        datos.cuentas.push({
          id: nuevoId(),
          nombre,
          tipo: $("#t").value,
          moneda: $("#m").value,
          valores: [{ fecha: $("#f").value || hoy(), valor }],
        });
      }
      await guardarDatos();
      cerrarHoja();
      aviso(c ? "Cuenta actualizada" : "Cuenta agregada");
      pintar();
    };
  }

  function hojaDetalle(id) {
    const c = datos.cuentas.find((x) => x.id === id);
    if (!c) return;
    const hist = [...c.valores].sort((a, b) => b.fecha.localeCompare(a.fecha));
    abrirHoja(`
      <h2>${esc(c.nombre)}</h2>
      <div class="tenue">${esc(TIPOS[c.tipo].nombre)} · ${c.moneda}</div>
      <div class="cifra-grande">${dinero(valorActual(c), c.moneda, 2)}</div>
      <div class="dos"><div><label for="v">Nuevo valor</label><input id="v" inputmode="decimal" placeholder="0" /></div>
        <div><label for="f">Fecha</label><input id="f" type="date" value="${hoy()}" max="${hoy()}" /></div></div>
      <div class="error" id="err-h"></div>
      <button class="btn" id="act">Actualizar valor</button>
      <div class="etiqueta separado">Historial</div>
      <div id="hist">${hist
        .map(
          (h, i) => `<div class="historial-fila"><span>${esc(fechaCorta(h.fecha))}</span><span class="num">${dinero(h.valor, c.moneda, 2)} ${hist.length > 1 ? `<button class="mini" data-i="${i}" aria-label="Borrar registro">Borrar</button>` : ""}</span></div>`,
        )
        .join("")}</div>
      <button class="btn secundario" id="editar">Editar cuenta</button>
      <button class="btn peligro" id="eliminar">Eliminar cuenta</button>`);
    $("#act").onclick = async () => {
      const valor = leerNumero($("#v").value);
      const fecha = $("#f").value || hoy();
      if (Number.isNaN(valor) || valor < 0) return ($("#err-h").textContent = "Escribe un valor válido.");
      const existente = c.valores.find((x) => x.fecha === fecha);
      if (existente) existente.valor = valor;
      else c.valores.push({ fecha, valor });
      await guardarDatos();
      cerrarHoja();
      aviso("Valor actualizado");
      pintar();
    };
    $$(".mini").forEach(
      (b) =>
        (b.onclick = async () => {
          const reg = hist[Number(b.dataset.i)];
          if (!confirm(`¿Borrar el registro del ${fechaCorta(reg.fecha)}?`)) return;
          c.valores = c.valores.filter((x) => x !== reg);
          await guardarDatos();
          hojaDetalle(id);
          pintar();
        }),
    );
    $("#editar").onclick = () => hojaCuenta(id);
    $("#eliminar").onclick = async () => {
      if (!confirm(`¿Eliminar "${c.nombre}" y todo su historial?`)) return;
      datos.cuentas = datos.cuentas.filter((x) => x.id !== id);
      await guardarDatos();
      cerrarHoja();
      aviso("Cuenta eliminada");
      pintar();
    };
  }

  // ── Ajustes
  function pintarAjustes() {
    const a = datos.ajustes;
    $("#app").innerHTML = `
      ${cabeza("Ajustes")}
      <div class="contenedor">
        <div class="tarjeta">
          <div class="etiqueta">Monedas</div>
          <label for="base">Moneda principal</label><select id="base">${opcionesMoneda(a.monedaBase)}</select>
          <label for="tasa">Pesos colombianos por 1 dólar</label><input id="tasa" inputmode="decimal" value="${a.tasaCOP}" />
          <button class="btn secundario" id="guardar-monedas">Guardar</button>
        </div>
        <div class="tarjeta">
          <div class="etiqueta">Respaldo</div>
          <p class="tenue">${a.ultimoRespaldo ? "Último respaldo: " + esc(new Date(a.ultimoRespaldo).toLocaleString("es-US")) : "Aún no has hecho un respaldo."}<br/>El respaldo va cifrado con tu código. Guárdalo en Google Drive desde el menú Compartir.</p>
          <button class="btn" id="respaldar">Respaldar ahora</button>
          <button class="btn secundario" id="restaurar">Restaurar desde respaldo</button>
          <input type="file" id="archivo" accept="application/json,.json" class="oculto" />
        </div>
        <div class="tarjeta">
          <div class="etiqueta">Seguridad</div>
          <button class="btn secundario" id="cambiar">Cambiar código</button>
          <button class="btn secundario" id="csv">Exportar a CSV (sin cifrar)</button>
          <button class="btn peligro" id="borrar">Borrar todos los datos de este teléfono</button>
        </div>
        <p class="tenue centrado">Patrimonio · versión de prueba 1.3<br/>Tus datos nunca salen del teléfono salvo en los respaldos que tú hagas.</p>
      </div>`;
    conectarCandado();
    $("#guardar-monedas").onclick = async () => {
      const tasa = leerNumero($("#tasa").value);
      if (!(tasa > 0)) return aviso("Tasa inválida");
      a.monedaBase = $("#base").value;
      a.tasaCOP = tasa;
      await guardarDatos();
      aviso("Guardado");
    };
    $("#respaldar").onclick = respaldar;
    $("#restaurar").onclick = () => $("#archivo").click();
    $("#archivo").onchange = (e) => restaurarRespaldo(e.target.files[0], false);
    $("#cambiar").onclick = hojaCambiarCodigo;
    $("#csv").onclick = exportarCSV;
    $("#borrar").onclick = async () => {
      if (!confirm("Esto borra TODO de este teléfono. ¿Hiciste un respaldo?")) return;
      if (prompt('Escribe BORRAR para confirmar') !== "BORRAR") return;
      await almacen.borrar("boveda");
      llave = datos = sal = null;
      pintarBloqueo();
    };
  }

  // ───────────────────────── Respaldos ─────────────────────────
  async function compartirOBajar(nombre, contenido, tipo) {
    const archivo = new File([contenido], nombre, { type: tipo });
    if (navigator.canShare?.({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo] }); // sin título: Drive lo guardaría como un .txt extra
        return true;
      } catch (e) {
        if (e.name === "AbortError") return false;
      }
    }
    const url = URL.createObjectURL(archivo);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  }

  async function respaldar() {
    const copia = { ...datos, ajustes: { ...datos.ajustes, ultimoRespaldo: new Date().toISOString() } };
    const { iv, ct } = await cifrar(llave, copia);
    const contenido = JSON.stringify({ app: "patrimonio", tipo: "respaldo", v: 1, creado: new Date().toISOString(), sal: b64(sal), iv, ct });
    const ok = await compartirOBajar(`patrimonio-respaldo-${hoy()}.json`, contenido, "application/json");
    if (ok) {
      datos.ajustes.ultimoRespaldo = copia.ajustes.ultimoRespaldo;
      await guardarDatos();
      aviso("Respaldo listo");
      pintar();
    }
  }

  async function restaurarRespaldo(archivo, sinBoveda) {
    if (!archivo) return;
    let r;
    try {
      r = JSON.parse(await archivo.text());
      if (r.app !== "patrimonio" || r.tipo !== "respaldo") throw new Error();
    } catch {
      return aviso("Ese archivo no es un respaldo de Patrimonio");
    }
    abrirHoja(`
      <h2>Restaurar respaldo</h2>
      <p class="tenue">Respaldo del ${esc(new Date(r.creado).toLocaleString("es-US"))}. Escribe el código que usabas cuando lo creaste.</p>
      <label for="cr">Código del respaldo</label><input id="cr" type="password" />
      ${sinBoveda ? "" : `<div class="nota">Esto <strong>reemplaza</strong> todos los datos actuales de este teléfono.</div>`}
      <div class="error" id="err-h"></div>
      <button class="btn" id="ok">Restaurar</button>
      <button class="btn secundario" id="cancelar">Cancelar</button>`);
    $("#cancelar").onclick = cerrarHoja;
    $("#ok").onclick = async () => {
      $("#ok").disabled = true;
      $("#ok").textContent = "Descifrando…";
      try {
        const s = desdeB64(r.sal);
        const k = await derivarLlave($("#cr").value, s);
        const restaurados = await descifrar(k, r.iv, r.ct);
        datos = restaurados;
        if (sinBoveda || !llave) {
          sal = s;
          llave = k;
        }
        await guardarDatos(); // queda cifrado con el código actual
        cerrarHoja();
        aviso("Respaldo restaurado");
        entrar();
      } catch {
        $("#err-h").textContent = "Código incorrecto para este respaldo.";
        $("#ok").disabled = false;
        $("#ok").textContent = "Restaurar";
      }
    };
  }

  function hojaCambiarCodigo() {
    abrirHoja(`
      <h2>Cambiar código</h2>
      <label for="act">Código actual</label><input id="act" type="password" autocomplete="current-password" />
      <label for="n1">Nuevo código</label><input id="n1" type="password" autocomplete="new-password" />
      <label for="n2">Repite el nuevo código</label><input id="n2" type="password" autocomplete="new-password" />
      <div class="nota">Los respaldos anteriores seguirán abriéndose con el código viejo.</div>
      <div class="error" id="err-h"></div>
      <button class="btn" id="ok">Cambiar</button>
      <button class="btn secundario" id="cancelar">Cancelar</button>`);
    $("#cancelar").onclick = cerrarHoja;
    $("#ok").onclick = async () => {
      const n1 = $("#n1").value;
      if (n1.length < 6) return ($("#err-h").textContent = "Mínimo 6 caracteres.");
      if (n1 !== $("#n2").value) return ($("#err-h").textContent = "Los códigos nuevos no coinciden.");
      $("#ok").disabled = true;
      try {
        const b = await almacen.obtener("boveda");
        await descifrar(await derivarLlave($("#act").value, desdeB64(b.sal)), b.iv, b.ct);
      } catch {
        $("#ok").disabled = false;
        return ($("#err-h").textContent = "El código actual no es correcto.");
      }
      await crearBoveda(n1);
      cerrarHoja();
      aviso("Código cambiado");
    };
  }

  function exportarCSV() {
    if (!confirm("El CSV NO va cifrado: cualquiera que lo abra verá tus cifras. ¿Continuar?")) return;
    const filas = [["cuenta", "tipo", "clase", "moneda", "fecha", "valor"]];
    for (const c of datos.cuentas)
      for (const v of c.valores) filas.push([c.nombre, TIPOS[c.tipo].nombre, TIPOS[c.tipo].clase, c.moneda, v.fecha, v.valor]);
    const csv = filas.map((f) => f.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    compartirOBajar(`patrimonio-${hoy()}.csv`, "﻿" + csv, "text/csv");
  }

  // ───────────────────────── Privacidad y bloqueo automático ─────────────────────────
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      ocultoDesde = Date.now();
      document.body.classList.add("privado");
    } else {
      document.body.classList.remove("privado");
      if (llave && Date.now() - ocultoDesde > BLOQUEO_MS) bloquear();
    }
  });

  // ───────────────────────── Inicio ─────────────────────────
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  if (!window.crypto?.subtle) {
    $("#app").innerHTML = `<div class="bloqueo"><h1>Patrimonio</h1><p class="tenue">Abre esta app desde una dirección segura (https) en Safari.</p></div>`;
  } else {
    pintarBloqueo();
  }

  // Solo para pruebas automáticas
  window.__patrimonio = { totales: () => datos && totales(), historialNeto: () => datos && historialNeto(), leerNumero };
})();
