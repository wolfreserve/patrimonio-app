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
    efectivo: { clase: "activo" },
    inversiones: { clase: "activo" },
    retiro: { clase: "activo" },
    cripto: { clase: "activo" },
    inmuebles: { clase: "activo" },
    vehiculos: { clase: "activo" },
    empresas: { clase: "activo" },
    otros_activos: { clase: "activo" },
    tarjetas: { clase: "pasivo" },
    hipotecas: { clase: "pasivo" },
    prestamos: { clase: "pasivo" },
    otras_deudas: { clase: "pasivo" },
  };
  const MONEDAS = ["USD", "COP"];

  // ───────────────────────── Idiomas ─────────────────────────
  // Inglés por defecto. La preferencia no es un dato sensible: se guarda sin cifrar
  // para poder mostrar la pantalla de bloqueo en el idioma correcto.
  const TEXTOS = {
    en: {
      locale: "en-US",
      "tipo.efectivo": "Cash & banks", "tipo.inversiones": "Investments", "tipo.retiro": "Retirement",
      "tipo.cripto": "Crypto", "tipo.inmuebles": "Real estate", "tipo.vehiculos": "Vehicles",
      "tipo.empresas": "Businesses", "tipo.otros_activos": "Other assets", "tipo.tarjetas": "Credit cards",
      "tipo.hipotecas": "Mortgages", "tipo.prestamos": "Loans", "tipo.otras_deudas": "Other debts",
      "clase.activo": "asset", "clase.pasivo": "liability",
      borrar: "Delete", limpiar: "Clear", codigo: "Code",
      tocaCampo: "Tap the field and type your code.",
      crearInstr: "Create a code of at least 6 digits. It protects your data, which is stored encrypted on this phone.",
      continuar: "Continue", preferirLetras: "I prefer a code with letters",
      importante: "Important:", avisoOlvido: "if you forget this code there is no way to recover your data. Nobody can open it without it.",
      restaurarDesde: "Restore from a backup", minimo6: "The code must be at least 6 characters.",
      repetirInstr: "Type the same code again to confirm it.", crearEntrar: "Create and enter",
      crearInstrCorta: "Create a code of at least 6 digits.", noCoinciden: "The codes don't match. Start over.",
      protegiendo: "Protecting…", abrirInstr: "Enter your code to open.", abrir: "Open",
      tieneLetras: "My code has letters: use keyboard", olvide: "I forgot my code: start over",
      confirmaOlvido1: "Without the code, saved data can't be opened. Starting over DELETES everything on this phone. Continue?",
      confirmaOlvido2: "Final confirmation: delete everything and create a new code? If you have a backup you can restore it with its code.",
      espera: "Wait {s} seconds.", abriendo: "Opening…", incorrecto: "Incorrect code.",
      resumen: "Summary", cuentas: "Accounts", ajustes: "Settings", bloquear: "Lock",
      desde: "since {f}", sinRespaldoN: "More than {n} days without a backup · Back up now",
      patrimonioNeto: "Net worth", graficaVacia: "The chart appears once you record values on at least two dates.",
      activos: "Assets", deudas: "Debts", distribucion: "Asset allocation",
      sinCuentas: "You don't have any accounts yet.", primeraCuenta: "Add my first account",
      graficaAria: "Net worth over time", min: "Min.", max: "Max.",
      "rango.1M": "1M", "rango.3M": "3M", "rango.6M": "6M", "rango.YTD": "YTD", "rango.1Y": "1Y", "rango.ALL": "ALL",
      "periodo.1M": "Past month", "periodo.3M": "Past 3 months", "periodo.6M": "Past 6 months", "periodo.YTD": "Year to date", "periodo.1Y": "Past year", "periodo.ALL": "All time",
      maximo: "High", minimo: "Low", unSoloPunto: "Update your values on different dates to see your trend.",
      actualizado: "Updated {f}", sinValor: "No value",
      cuentasVacio: "Add your accounts, investments, properties and debts with the + button.",
      agregarCuenta: "Add account", editarCuenta: "Edit account", nuevaCuenta: "New account",
      nombre: "Name", ejemploNombre: "E.g. Chase savings, House, Tesla", tipo: "Type", moneda: "Currency",
      valorActual: "Current value", fecha: "Date", notaDeudas: "For debts, enter the balance you owe as a positive number.",
      guardar: "Save", agregar: "Add", cancelar: "Cancel", escribeNombre: "Enter a name.", valorInvalido: "Invalid value.",
      cuentaActualizada: "Account updated", cuentaAgregada: "Account added",
      nuevoValor: "New value", actualizarValor: "Update value", historial: "History", borrarRegistro: "Delete entry",
      eliminarCuenta: "Delete account", escribeValor: "Enter a valid value.", valorActualizado: "Value updated",
      confirmaBorrarRegistro: "Delete the entry from {f}?", confirmaEliminar: 'Delete "{n}" and all its history?',
      cuentaEliminada: "Account deleted",
      monedas: "Currencies", monedaPrincipal: "Main currency", tasa: "Colombian pesos per 1 US dollar",
      respaldo: "Backup", ultimoRespaldo: "Last backup: {f}", sinRespaldo: "You haven't made a backup yet.",
      notaRespaldo: "The backup is encrypted with your code. Save it to Google Drive from the Share menu.",
      respaldarAhora: "Back up now", restaurar: "Restore from backup", seguridad: "Security",
      cambiarCodigo: "Change code", exportarCSV: "Export to CSV (not encrypted)",
      borrarTodo: "Delete all data on this phone", idioma: "Language",
      pie: "Patrimonio · test version {v}<br/>Your data never leaves this phone except in backups you make.",
      tasaInvalida: "Invalid rate", guardado: "Saved",
      confirmaBorrarTodo: "This deletes EVERYTHING on this phone. Did you make a backup?",
      escribeBORRAR: "Type DELETE to confirm", palabraBorrar: "DELETE",
      respaldoListo: "Backup ready", noEsRespaldo: "That file is not a Patrimonio backup",
      restaurarTitulo: "Restore backup", restaurarInstr: "Backup from {f}. Enter the code you used when you created it.",
      codigoRespaldo: "Backup code", reemplaza: "This <strong>replaces</strong> all current data on this phone.",
      descifrando: "Decrypting…", respaldoRestaurado: "Backup restored", codigoRespaldoIncorrecto: "Incorrect code for this backup.",
      restaurarBtn: "Restore", codigoActual: "Current code", codigoNuevo: "New code", repiteNuevo: "Repeat the new code",
      notaRespaldosViejos: "Previous backups will still open with the old code.", cambiar: "Change",
      minimo6Corto: "At least 6 characters.", nuevosNoCoinciden: "The new codes don't match.",
      actualNoCorrecto: "The current code is not correct.", codigoCambiado: "Code changed",
      confirmaCSV: "The CSV is NOT encrypted: anyone who opens it will see your numbers. Continue?",
      csvCabecera: ["account", "type", "class", "currency", "date", "value"],
      necesitaHttps: "Open this app from a secure (https) address in Safari.",
    },
    es: {
      locale: "es-US",
      "tipo.efectivo": "Efectivo y bancos", "tipo.inversiones": "Inversiones", "tipo.retiro": "Retiro",
      "tipo.cripto": "Cripto", "tipo.inmuebles": "Inmuebles", "tipo.vehiculos": "Vehículos",
      "tipo.empresas": "Empresas", "tipo.otros_activos": "Otros activos", "tipo.tarjetas": "Tarjetas de crédito",
      "tipo.hipotecas": "Hipotecas", "tipo.prestamos": "Préstamos", "tipo.otras_deudas": "Otras deudas",
      "clase.activo": "activo", "clase.pasivo": "pasivo",
      borrar: "Borrar", limpiar: "Limpiar", codigo: "Código",
      tocaCampo: "Toca el campo y escribe tu código.",
      crearInstr: "Crea un código de al menos 6 números. Protege tus datos, que se guardan cifrados en este teléfono.",
      continuar: "Continuar", preferirLetras: "Prefiero un código con letras",
      importante: "Importante:", avisoOlvido: "si olvidas este código no hay forma de recuperar los datos. Nadie puede abrirlos sin él.",
      restaurarDesde: "Restaurar desde un respaldo", minimo6: "El código debe tener al menos 6 caracteres.",
      repetirInstr: "Escribe el mismo código otra vez para confirmarlo.", crearEntrar: "Crear y entrar",
      crearInstrCorta: "Crea un código de al menos 6 números.", noCoinciden: "Los códigos no coinciden. Empieza de nuevo.",
      protegiendo: "Protegiendo…", abrirInstr: "Escribe tu código para abrir.", abrir: "Abrir",
      tieneLetras: "Mi código tiene letras: usar teclado", olvide: "Olvidé mi código: empezar de cero",
      confirmaOlvido1: "Sin el código no se pueden abrir los datos guardados. Empezar de cero BORRA todo lo de este teléfono. ¿Continuar?",
      confirmaOlvido2: "Última confirmación: ¿borrar todo y crear un código nuevo? Si tienes un respaldo podrás restaurarlo con su código.",
      espera: "Espera {s} segundos.", abriendo: "Abriendo…", incorrecto: "Código incorrecto.",
      resumen: "Resumen", cuentas: "Cuentas", ajustes: "Ajustes", bloquear: "Bloquear",
      desde: "desde {f}", sinRespaldoN: "Hace más de {n} días sin respaldo · Respaldar ahora",
      patrimonioNeto: "Patrimonio neto", graficaVacia: "La gráfica aparece cuando registres valores en al menos dos fechas.",
      activos: "Activos", deudas: "Deudas", distribucion: "Distribución de activos",
      sinCuentas: "Aún no tienes cuentas.", primeraCuenta: "Agregar mi primera cuenta",
      graficaAria: "Evolución del patrimonio neto", min: "Mín.", max: "Máx.",
      "rango.1M": "1M", "rango.3M": "3M", "rango.6M": "6M", "rango.YTD": "Año", "rango.1Y": "1A", "rango.ALL": "Todo",
      "periodo.1M": "Último mes", "periodo.3M": "Últimos 3 meses", "periodo.6M": "Últimos 6 meses", "periodo.YTD": "En lo que va del año", "periodo.1Y": "Último año", "periodo.ALL": "Desde el inicio",
      maximo: "Máximo", minimo: "Mínimo", unSoloPunto: "Actualiza tus valores en fechas distintas para ver tu tendencia.",
      actualizado: "Actualizado {f}", sinValor: "Sin valor",
      cuentasVacio: "Agrega tus cuentas, inversiones, propiedades y deudas con el botón +.",
      agregarCuenta: "Agregar cuenta", editarCuenta: "Editar cuenta", nuevaCuenta: "Nueva cuenta",
      nombre: "Nombre", ejemploNombre: "Ej. Chase ahorros, Casa, Tesla", tipo: "Tipo", moneda: "Moneda",
      valorActual: "Valor actual", fecha: "Fecha", notaDeudas: "Para deudas escribe el saldo que debes, en positivo.",
      guardar: "Guardar", agregar: "Agregar", cancelar: "Cancelar", escribeNombre: "Escribe un nombre.", valorInvalido: "Valor inválido.",
      cuentaActualizada: "Cuenta actualizada", cuentaAgregada: "Cuenta agregada",
      nuevoValor: "Nuevo valor", actualizarValor: "Actualizar valor", historial: "Historial", borrarRegistro: "Borrar registro",
      eliminarCuenta: "Eliminar cuenta", escribeValor: "Escribe un valor válido.", valorActualizado: "Valor actualizado",
      confirmaBorrarRegistro: "¿Borrar el registro del {f}?", confirmaEliminar: '¿Eliminar "{n}" y todo su historial?',
      cuentaEliminada: "Cuenta eliminada",
      monedas: "Monedas", monedaPrincipal: "Moneda principal", tasa: "Pesos colombianos por 1 dólar",
      respaldo: "Respaldo", ultimoRespaldo: "Último respaldo: {f}", sinRespaldo: "Aún no has hecho un respaldo.",
      notaRespaldo: "El respaldo va cifrado con tu código. Guárdalo en Google Drive desde el menú Compartir.",
      respaldarAhora: "Respaldar ahora", restaurar: "Restaurar desde respaldo", seguridad: "Seguridad",
      cambiarCodigo: "Cambiar código", exportarCSV: "Exportar a CSV (sin cifrar)",
      borrarTodo: "Borrar todos los datos de este teléfono", idioma: "Idioma",
      pie: "Patrimonio · versión de prueba {v}<br/>Tus datos nunca salen del teléfono salvo en los respaldos que tú hagas.",
      tasaInvalida: "Tasa inválida", guardado: "Guardado",
      confirmaBorrarTodo: "Esto borra TODO de este teléfono. ¿Hiciste un respaldo?",
      escribeBORRAR: "Escribe BORRAR para confirmar", palabraBorrar: "BORRAR",
      respaldoListo: "Respaldo listo", noEsRespaldo: "Ese archivo no es un respaldo de Patrimonio",
      restaurarTitulo: "Restaurar respaldo", restaurarInstr: "Respaldo del {f}. Escribe el código que usabas cuando lo creaste.",
      codigoRespaldo: "Código del respaldo", reemplaza: "Esto <strong>reemplaza</strong> todos los datos actuales de este teléfono.",
      descifrando: "Descifrando…", respaldoRestaurado: "Respaldo restaurado", codigoRespaldoIncorrecto: "Código incorrecto para este respaldo.",
      restaurarBtn: "Restaurar", codigoActual: "Código actual", codigoNuevo: "Nuevo código", repiteNuevo: "Repite el nuevo código",
      notaRespaldosViejos: "Los respaldos anteriores seguirán abriéndose con el código viejo.", cambiar: "Cambiar",
      minimo6Corto: "Mínimo 6 caracteres.", nuevosNoCoinciden: "Los códigos nuevos no coinciden.",
      actualNoCorrecto: "El código actual no es correcto.", codigoCambiado: "Código cambiado",
      confirmaCSV: "El CSV NO va cifrado: cualquiera que lo abra verá tus cifras. ¿Continuar?",
      csvCabecera: ["cuenta", "tipo", "clase", "moneda", "fecha", "valor"],
      necesitaHttps: "Abre esta app desde una dirección segura (https) en Safari.",
    },
  };
  const VERSION_APP = "1.5";
  let idioma = (() => {
    try {
      return localStorage.getItem("idioma") === "es" ? "es" : "en";
    } catch {
      return "en";
    }
  })();
  function t(clave, vars = {}) {
    let s = TEXTOS[idioma][clave] ?? TEXTOS.en[clave] ?? clave;
    if (typeof s !== "string") return s;
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }
  const nombreTipo = (k) => t(`tipo.${k}`);
  function cambiarIdioma(nuevo) {
    idioma = nuevo === "es" ? "es" : "en";
    try {
      localStorage.setItem("idioma", idioma);
    } catch {
      /* sin almacenamiento: solo dura esta sesión */
    }
    document.documentElement.lang = idioma;
  }
  document.documentElement.lang = idioma;

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
  const isoLocal = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hoy = () => isoLocal(new Date());
  const nuevoId = () => crypto.randomUUID();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const desdeB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  function dinero(valor, moneda, decimales = 0) {
    return new Intl.NumberFormat(t("locale"), {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(valor);
  }
  function fechaCorta(iso) {
    const [a, m, d] = iso.split("-").map(Number);
    return new Date(a, m - 1, d).toLocaleDateString(t("locale"), { day: "numeric", month: "short", year: "numeric" });
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
      <button class="tecla tenue" data-d="borrar" aria-label="${t("borrar")}">⌫</button>
      <button class="tecla" data-d="0">0</button>
      <button class="tecla tenue" data-d="limpiar" aria-label="${t("limpiar")}">C</button>
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
    $("#err").textContent = t("tocaCampo");
  }

  const botonIdioma = () =>
    `<button class="btn secundario" id="boton-idioma">${idioma === "en" ? "Español" : "English"}</button>`;
  function conectarBotonIdioma() {
    $("#boton-idioma").onclick = () => {
      cambiarIdioma(idioma === "en" ? "es" : "en");
      pintarBloqueo();
    };
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
          <p class="tenue" id="instruccion">${t("crearInstr")}</p>
          <input id="c1" type="password" autocomplete="off" readonly aria-label="${t("codigo")}" />
          <div class="error" id="err"></div>
          ${tecladoHTML()}
          <button class="btn" id="crear">${t("continuar")}</button>
          <button class="btn secundario" id="cambiar-teclado">${t("preferirLetras")}</button>
          <div class="nota"><strong>${t("importante")}</strong> ${t("avisoOlvido")}</div>
          <button class="btn secundario" id="restaurar">${t("restaurarDesde")}</button>
          ${botonIdioma()}
          <input type="file" id="archivo" accept="application/json,.json" class="oculto" />
        </div>`;
      conectarTeclado("#c1");
      $("#cambiar-teclado").onclick = () => cambiarATecladoSistema("c1", "new-password");
      $("#crear").onclick = async () => {
        const valor = $("#c1").value;
        if (primero === null) {
          if (valor.length < 6) return ($("#err").textContent = t("minimo6"));
          primero = valor;
          $("#c1").value = "";
          $("#instruccion").textContent = t("repetirInstr");
          $("#crear").textContent = t("crearEntrar");
          return;
        }
        if (valor !== primero) {
          primero = null;
          $("#c1").value = "";
          $("#instruccion").textContent = t("crearInstrCorta");
          $("#crear").textContent = t("continuar");
          return ($("#err").textContent = t("noCoinciden"));
        }
        $("#crear").disabled = true;
        $("#crear").textContent = t("protegiendo");
        await crearBoveda(valor);
        pedirAlmacenamientoPersistente();
        entrar();
      };
      $("#restaurar").onclick = () => $("#archivo").click();
      $("#archivo").onchange = (e) => restaurarRespaldo(e.target.files[0], true);
      conectarBotonIdioma();
      return;
    }
    app.innerHTML = `
      <div class="bloqueo">
        <img src="iconos/icono-192.png" alt="" />
        <h1>Patrimonio</h1>
        <p class="tenue">${t("abrirInstr")}</p>
        <input id="cod" type="password" autocomplete="off" readonly aria-label="${t("codigo")}" />
        <div class="error" id="err"></div>
        ${tecladoHTML()}
        <button class="btn" id="abrir">${t("abrir")}</button>
        <button class="btn secundario" id="cambiar-teclado">${t("tieneLetras")}</button>
        <button class="btn peligro" id="empezar">${t("olvide")}</button>
        ${botonIdioma()}
      </div>`;
    conectarBotonIdioma();
    conectarTeclado("#cod");
    $("#cambiar-teclado").onclick = () => cambiarATecladoSistema("cod", "current-password");
    $("#empezar").onclick = async () => {
      if (!confirm(t("confirmaOlvido1"))) return;
      if (!confirm(t("confirmaOlvido2"))) return;
      await almacen.borrar("boveda");
      pintarBloqueo();
    };
    const intentar = async () => {
      const ahora = Date.now();
      if (ahora < esperaHasta) {
        $("#err").textContent = t("espera", { s: Math.ceil((esperaHasta - ahora) / 1000) });
        return;
      }
      $("#abrir").disabled = true;
      $("#abrir").textContent = t("abriendo");
      try {
        await abrirBoveda($("#cod").value);
        intentosFallidos = 0;
        entrar();
      } catch {
        intentosFallidos++;
        if (intentosFallidos >= 5) esperaHasta = Date.now() + 30000 * 2 ** (intentosFallidos - 5);
        $("#err").textContent = t("incorrecto");
        $("#abrir").disabled = false;
        $("#abrir").textContent = t("abrir");
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
      .map((v) => `<button data-v="${v}">${ICONO[v]}${t(v)}</button>`)
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
    return `<div class="cabeza"><h1>${titulo}</h1><button class="icono-btn" id="candado" aria-label="${t("bloquear")}">${ICONO.candado}</button></div>`;
  }
  function conectarCandado() {
    $("#candado").onclick = bloquear;
  }

  // ── Resumen
  const RANGOS = ["1M", "3M", "6M", "YTD", "1Y", "ALL"];
  const COLOR_SUBE = "#34d399";
  const COLOR_BAJA = "#f87171";
  let rango = "ALL";

  function inicioRango(r) {
    const d = new Date();
    if (r === "1M") d.setMonth(d.getMonth() - 1);
    else if (r === "3M") d.setMonth(d.getMonth() - 3);
    else if (r === "6M") d.setMonth(d.getMonth() - 6);
    else if (r === "YTD") d.setMonth(0, 1);
    else if (r === "1Y") d.setFullYear(d.getFullYear() - 1);
    else return null;
    return isoLocal(d);
  }

  /** Serie del patrimonio neto para el periodo: un punto por cada fecha con cambios, más hoy. */
  function serieRango(r) {
    const h = hoy();
    let pts = historialNeto().filter((p) => p.fecha <= h);
    if (!pts.length) return [];
    if (pts.at(-1).fecha < h) pts.push({ fecha: h, neto: pts.at(-1).neto });
    const ini = inicioRango(r);
    if (ini) {
      const antes = pts.filter((p) => p.fecha < ini);
      const dentro = pts.filter((p) => p.fecha >= ini);
      if (antes.length && dentro[0]?.fecha !== ini) dentro.unshift({ fecha: ini, neto: antes.at(-1).neto });
      pts = dentro;
    }
    return pts;
  }

  const porcentaje = (v, base) => (base !== 0 ? ((v - base) / Math.abs(base)) * 100 : null);
  function textoCambio(v, inicio, moneda) {
    const d = v - inicio;
    const pct = porcentaje(v, inicio);
    const flecha = d > 0 ? "▲" : d < 0 ? "▼" : "•";
    return `${flecha} ${dinero(Math.abs(d), moneda)}${pct === null ? "" : ` (${d >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(2)}%)`}`;
  }

  function pintarResumen() {
    const base = datos.ajustes.monedaBase;
    rango = datos.ajustes.rango || rango;
    const tot = totales();

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
      ${cabeza(t("resumen"))}
      <div class="contenedor">
        ${sinRespaldo ? `<button class="btn secundario" id="ir-respaldo">${t("sinRespaldoN", { n: DIAS_RECORDAR_RESPALDO })}</button>` : ""}
        ${
          datos.cuentas.length
            ? `<div class="tarjeta hero">
          <div class="etiqueta">${t("patrimonioNeto")}</div>
          <div class="cifra-grande" id="h-valor">${dinero(tot.neto, base)}</div>
          <div class="h-cambio num" id="h-cambio"></div>
          <div class="g-caja" id="g-caja"></div>
          <div class="rangos" role="tablist">${RANGOS.map((r) => `<button class="rango ${r === rango ? "activo" : ""}" data-r="${r}" role="tab">${t(`rango.${r}`)}</button>`).join("")}</div>
          <div class="g-stats" id="g-stats"></div>
        </div>`
            : ""
        }
        <div class="dos">
          <div class="tarjeta"><div class="etiqueta">${t("activos")}</div><div class="num sube">${dinero(tot.activos, base)}</div></div>
          <div class="tarjeta"><div class="etiqueta">${t("deudas")}</div><div class="num baja">${dinero(tot.pasivos, base)}</div></div>
        </div>
        ${
          dist.length
            ? `<div class="tarjeta"><div class="etiqueta">${t("distribucion")}</div><div class="dist">${dist
                .map(
                  ([tipo, v]) => `<div class="dist-fila"><div class="fila"><span>${esc(nombreTipo(tipo))}</span><span class="num tenue">${dinero(v, base)} · ${((v / tot.activos) * 100).toFixed(1)}%</span></div><div class="barra"><i data-ancho="${((v / tot.activos) * 100).toFixed(2)}"></i></div></div>`,
                )
                .join("")}</div></div>`
            : ""
        }
        ${datos.cuentas.length === 0 ? `<div class="vacio">${t("sinCuentas")}<br/><button class="btn" id="primera">${t("primeraCuenta")}</button></div>` : ""}
      </div>`;
    // El ancho se fija desde JS para cumplir la política de seguridad (sin estilos en línea).
    $$(".barra > i").forEach((i) => (i.style.width = `${i.dataset.ancho}%`));
    conectarCandado();
    $("#primera") && ($("#primera").onclick = () => hojaCuenta());
    $("#ir-respaldo") && ($("#ir-respaldo").onclick = respaldar);
    if (datos.cuentas.length) {
      $$(".rango").forEach(
        (b) =>
          (b.onclick = async () => {
            rango = b.dataset.r;
            $$(".rango").forEach((x) => x.classList.toggle("activo", x === b));
            pintarHero(false);
            datos.ajustes.rango = rango;
            await guardarDatos();
          }),
      );
      pintarHero(true);
    }
  }

  /** Total, cambio del periodo, gráfica y máximos/mínimos. */
  function pintarHero(animarNumero) {
    const base = datos.ajustes.monedaBase;
    const serie = serieRango(rango);
    const actual = totales().neto;
    const inicio = serie[0]?.neto ?? actual;
    const sube = actual >= inicio;
    const valorEl = $("#h-valor");
    const cambioEl = $("#h-cambio");
    const ponerCambio = (v, etiqueta, colorSube) => {
      cambioEl.className = `h-cambio num ${colorSube ? "sube" : "baja"}`;
      cambioEl.innerHTML = `${esc(textoCambio(v, inicio, base))} <span class="tenue">${esc(etiqueta)}</span>`;
    };
    const normal = () => {
      valorEl.textContent = dinero(actual, base);
      ponerCambio(actual, t(`periodo.${rango}`), sube);
    };
    if (animarNumero) contarHasta(valorEl, actual, base);
    else valorEl.textContent = dinero(actual, base);
    ponerCambio(actual, t(`periodo.${rango}`), sube);

    const valores = serie.map((p) => p.neto);
    $("#g-stats").innerHTML =
      serie.length > 1
        ? `<div><span class="tenue">${t("maximo")}</span><span class="num">${dinero(Math.max(...valores), base)}</span></div>
           <div><span class="tenue">${t("minimo")}</span><span class="num">${dinero(Math.min(...valores), base)}</span></div>`
        : `<p class="tenue">${t("unSoloPunto")}</p>`;

    dibujarGrafica($("#g-caja"), serie, base, sube ? COLOR_SUBE : COLOR_BAJA, (p) => {
      if (!p) return normal();
      valorEl.textContent = dinero(p.neto, base);
      ponerCambio(p.neto, fechaCorta(p.fecha), p.neto >= inicio);
    });
  }

  function contarHasta(el, destino, moneda) {
    const inicio = performance.now();
    const dur = 900;
    const paso = (ahora) => {
      const x = Math.min(1, (ahora - inicio) / dur);
      const e = 1 - Math.pow(1 - x, 3);
      el.textContent = dinero(destino * e, moneda);
      if (x < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  /** Curva suave que nunca se pasa de los valores reales (monótona, Fritsch–Carlson). */
  function rutaSuave(P) {
    const n = P.length;
    if (n < 2) return "";
    if (n === 2) return `M${P[0][0]},${P[0][1]}L${P[1][0]},${P[1][1]}`;
    const dx = [];
    const m = [];
    for (let i = 0; i < n - 1; i++) {
      dx.push(P[i + 1][0] - P[i][0]);
      m.push(dx[i] ? (P[i + 1][1] - P[i][1]) / dx[i] : 0);
    }
    const tg = [m[0]];
    for (let i = 1; i < n - 1; i++) tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
    tg.push(m[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) {
        tg[i] = 0;
        tg[i + 1] = 0;
        continue;
      }
      const a = tg[i] / m[i];
      const b = tg[i + 1] / m[i];
      const h = a * a + b * b;
      if (h > 9) {
        const k = 3 / Math.sqrt(h);
        tg[i] = k * a * m[i];
        tg[i + 1] = k * b * m[i];
      }
    }
    let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const c1x = P[i][0] + dx[i] / 3;
      const c1y = P[i][1] + (tg[i] * dx[i]) / 3;
      const c2x = P[i + 1][0] - dx[i] / 3;
      const c2y = P[i + 1][1] - (tg[i + 1] * dx[i]) / 3;
      d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${P[i + 1][0].toFixed(1)},${P[i + 1][1].toFixed(1)}`;
    }
    return d;
  }

  function dibujarGrafica(caja, serie, moneda, color, alDeslizar) {
    if (!caja || !serie.length) return;
    const pts = serie.length === 1 ? [serie[0], { ...serie[0] }] : serie;
    const W = Math.max(260, caja.clientWidth || 320);
    const H = 210;
    const arriba = 18;
    const abajo = 26;
    const xs = pts.map((p) => Date.parse(`${p.fecha}T00:00:00`));
    const x0 = xs[0];
    const x1 = xs.at(-1);
    const derecha = 18; // espacio para que el punto final y su pulso no se corten
    const ancho = W - derecha;
    const X = (i) => (x1 === x0 ? (i === 0 ? 0 : ancho) : ((xs[i] - x0) / (x1 - x0)) * ancho);
    const vals = pts.map((p) => p.neto);
    let y0 = Math.min(...vals);
    let y1 = Math.max(...vals);
    if (y0 === y1) {
      const holgura = Math.abs(y0) * 0.05 || 1;
      y0 -= holgura;
      y1 += holgura;
    }
    const margen = (y1 - y0) * 0.12;
    y0 -= margen;
    y1 += margen;
    const Y = (v) => arriba + (1 - (v - y0) / (y1 - y0)) * (H - arriba - abajo);
    const P = pts.map((p, i) => [X(i), Y(p.neto)]);
    const linea = rutaSuave(P);
    const piso = H - abajo;
    const area = `${linea}L${P.at(-1)[0].toFixed(1)},${piso}L0,${piso}Z`;
    const yInicio = Y(pts[0].neto);
    const guias = [0.25, 0.5, 0.75].map((f) => {
      const v = y1 - (y1 - y0) * f;
      return { y: Y(v), v };
    });
    const [ux, uy] = P.at(-1);
    const fechaMedia = pts.length > 2 ? pts[Math.floor(pts.length / 2)].fecha : null;

    caja.innerHTML = `
      <svg class="g-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("graficaAria")}">
        <defs>
          <linearGradient id="g-relleno" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${color}" stop-opacity="0.38"/>
            <stop offset="0.55" stop-color="${color}" stop-opacity="0.10"/>
            <stop offset="1" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="g-trazo" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="${color}" stop-opacity="0.55"/>
            <stop offset="1" stop-color="${color}" stop-opacity="1"/>
          </linearGradient>
          <filter id="g-brillo" x="-10%" y="-60%" width="120%" height="220%">
            <feGaussianBlur stdDeviation="5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        ${guias
          .map(
            (g) => `<line class="g-guia" x1="0" x2="${W}" y1="${g.y.toFixed(1)}" y2="${g.y.toFixed(1)}"/>`,
          )
          .join("")}
        <line class="g-base" x1="0" x2="${W}" y1="${yInicio.toFixed(1)}" y2="${yInicio.toFixed(1)}"/>
        <path class="g-area" d="${area}" fill="url(#g-relleno)"/>
        <path class="g-linea" d="${linea}" stroke="url(#g-trazo)" filter="url(#g-brillo)"/>
        <circle class="g-pulso" cx="${ux}" cy="${uy}" r="5" fill="${color}">
          <animate attributeName="r" values="5;16" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.45;0" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${ux}" cy="${uy}" r="4.5" fill="${color}" stroke="#11141c" stroke-width="2"/>
        <g class="g-cursor oculto" id="g-cursor">
          <line id="g-cursor-linea" x1="0" x2="0" y1="${arriba - 6}" y2="${piso}"/>
          <circle id="g-cursor-punto" r="6" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
        </g>
        <text class="g-eje" x="6" y="${H - 6}">${esc(fechaCorta(pts[0].fecha))}</text>
        ${fechaMedia ? `<text class="g-eje" x="${W / 2}" y="${H - 6}" text-anchor="middle">${esc(fechaCorta(fechaMedia))}</text>` : ""}
        <text class="g-eje" x="${W - 6}" y="${H - 6}" text-anchor="end">${esc(fechaCorta(pts.at(-1).fecha))}</text>
        <rect class="g-tactil" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
      </svg>`;

    // Animación: la línea se dibuja de izquierda a derecha y el área aparece.
    const lineaEl = $(".g-linea", caja);
    const largo = lineaEl.getTotalLength?.() || 0;
    if (largo) {
      lineaEl.style.strokeDasharray = `${largo}`;
      lineaEl.style.strokeDashoffset = `${largo}`;
      requestAnimationFrame(() => requestAnimationFrame(() => caja.classList.add("g-lista")));
    } else caja.classList.add("g-lista");

    // Deslizar el dedo: muestra el valor y el cambio en cada fecha.
    const tactil = $(".g-tactil", caja);
    const cursor = $("#g-cursor", caja);
    const cLinea = $("#g-cursor-linea", caja);
    const cPunto = $("#g-cursor-punto", caja);
    const mover = (e) => {
      const caja2 = tactil.getBoundingClientRect();
      const x = ((e.clientX - caja2.left) / caja2.width) * W;
      let k = 0;
      for (let i = 1; i < P.length; i++) if (Math.abs(P[i][0] - x) < Math.abs(P[k][0] - x)) k = i;
      cursor.classList.remove("oculto");
      cLinea.setAttribute("x1", P[k][0]);
      cLinea.setAttribute("x2", P[k][0]);
      cPunto.setAttribute("cx", P[k][0]);
      cPunto.setAttribute("cy", P[k][1]);
      alDeslizar(pts[k]);
    };
    const soltar = () => {
      cursor.classList.add("oculto");
      alDeslizar(null);
    };
    tactil.addEventListener("pointerdown", (e) => {
      tactil.setPointerCapture?.(e.pointerId);
      mover(e);
    });
    tactil.addEventListener("pointermove", (e) => (e.buttons || e.pointerType !== "mouse" ? mover(e) : null));
    tactil.addEventListener("pointerup", soltar);
    tactil.addEventListener("pointercancel", soltar);
    tactil.addEventListener("pointerleave", soltar);
  }

  // La gráfica se vuelve a dibujar si cambia el ancho de la pantalla (por ejemplo al girar el teléfono).
  let esperaRedimension;
  window.addEventListener("resize", () => {
    clearTimeout(esperaRedimension);
    esperaRedimension = setTimeout(() => datos && vista === "resumen" && $("#g-caja") && pintarHero(false), 150);
  });

  // ── Cuentas
  function pintarCuentas() {
    const base = datos.ajustes.monedaBase;
    const grupos = Object.keys(TIPOS)
      .map((tipo) => ({ tipo, cuentas: datos.cuentas.filter((c) => c.tipo === tipo) }))
      .filter((g) => g.cuentas.length);
    $("#app").innerHTML = `
      ${cabeza(t("cuentas"))}
      <div class="contenedor">
        ${
          grupos.length
            ? grupos
                .map((g) => {
                  const total = g.cuentas.reduce((s, c) => s + convertir(valorActual(c), c.moneda, base), 0);
                  return `<div class="grupo-titulo"><span class="etiqueta">${esc(nombreTipo(g.tipo))}</span><span class="tenue num">${dinero(total, base)}</span></div>
                <div class="lista">${g.cuentas
                  .sort((a, b) => convertir(valorActual(b), b.moneda, base) - convertir(valorActual(a), a.moneda, base))
                  .map((c) => {
                    const ult = [...c.valores].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
                    return `<button class="item" data-id="${esc(c.id)}"><div class="fila"><span class="nombre">${esc(c.nombre)}</span><span class="num">${dinero(valorActual(c), c.moneda)}</span></div>
                      <div class="fila tenue"><span>${ult ? esc(t("actualizado", { f: fechaCorta(ult.fecha) })) : t("sinValor")}</span><span>${c.moneda !== base ? "≈ " + dinero(convertir(valorActual(c), c.moneda, base), base) : ""}</span></div></button>`;
                  })
                  .join("")}</div>`;
                })
                .join("")
            : `<div class="vacio">${t("cuentasVacio")}</div>`
        }
      </div>`;
    conectarCandado();
    $$(".item").forEach((b) => (b.onclick = () => hojaDetalle(b.dataset.id)));
    const f = document.createElement("button");
    f.className = "flotante";
    f.setAttribute("aria-label", t("agregarCuenta"));
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
    `<optgroup label="${t("activos")}">${Object.entries(TIPOS)
      .filter(([, x]) => x.clase === "activo")
      .map(([k]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${nombreTipo(k)}</option>`)
      .join("")}</optgroup><optgroup label="${t("deudas")}">${Object.entries(TIPOS)
      .filter(([, x]) => x.clase === "pasivo")
      .map(([k]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${nombreTipo(k)}</option>`)
      .join("")}</optgroup>`;
  const opcionesMoneda = (sel) => MONEDAS.map((m) => `<option ${m === sel ? "selected" : ""}>${m}</option>`).join("");

  function hojaCuenta(id) {
    const c = id ? datos.cuentas.find((x) => x.id === id) : null;
    abrirHoja(`
      <h2>${c ? t("editarCuenta") : t("nuevaCuenta")}</h2>
      <label for="n">${t("nombre")}</label><input id="n" maxlength="60" value="${c ? esc(c.nombre) : ""}" placeholder="${t("ejemploNombre")}" />
      <label for="t">${t("tipo")}</label><select id="t">${opcionesTipo(c?.tipo ?? "efectivo")}</select>
      <label for="m">${t("moneda")}</label><select id="m">${opcionesMoneda(c?.moneda ?? datos.ajustes.monedaBase)}</select>
      ${
        c
          ? ""
          : `<div class="dos"><div><label for="v">${t("valorActual")}</label><input id="v" inputmode="decimal" placeholder="0" /></div>
             <div><label for="f">${t("fecha")}</label><input id="f" type="date" value="${hoy()}" max="${hoy()}" /></div></div>
             <p class="tenue">${t("notaDeudas")}</p>`
      }
      <div class="error" id="err-h"></div>
      <button class="btn" id="ok">${c ? t("guardar") : t("agregar")}</button>
      <button class="btn secundario" id="cancelar">${t("cancelar")}</button>`);
    $("#cancelar").onclick = cerrarHoja;
    $("#ok").onclick = async () => {
      const nombre = $("#n").value.trim();
      if (!nombre) return ($("#err-h").textContent = t("escribeNombre"));
      if (c) {
        Object.assign(c, { nombre, tipo: $("#t").value, moneda: $("#m").value });
      } else {
        const valor = leerNumero($("#v").value || "0");
        if (Number.isNaN(valor) || valor < 0) return ($("#err-h").textContent = t("valorInvalido"));
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
      aviso(c ? t("cuentaActualizada") : t("cuentaAgregada"));
      pintar();
    };
  }

  function hojaDetalle(id) {
    const c = datos.cuentas.find((x) => x.id === id);
    if (!c) return;
    const hist = [...c.valores].sort((a, b) => b.fecha.localeCompare(a.fecha));
    abrirHoja(`
      <h2>${esc(c.nombre)}</h2>
      <div class="tenue">${esc(nombreTipo(c.tipo))} · ${c.moneda}</div>
      <div class="cifra-grande">${dinero(valorActual(c), c.moneda, 2)}</div>
      <div class="dos"><div><label for="v">${t("nuevoValor")}</label><input id="v" inputmode="decimal" placeholder="0" /></div>
        <div><label for="f">${t("fecha")}</label><input id="f" type="date" value="${hoy()}" max="${hoy()}" /></div></div>
      <div class="error" id="err-h"></div>
      <button class="btn" id="act">${t("actualizarValor")}</button>
      <div class="etiqueta separado">${t("historial")}</div>
      <div id="hist">${hist
        .map(
          (h, i) => `<div class="historial-fila"><span>${esc(fechaCorta(h.fecha))}</span><span class="num">${dinero(h.valor, c.moneda, 2)} ${hist.length > 1 ? `<button class="mini" data-i="${i}" aria-label="${t("borrarRegistro")}">${t("borrar")}</button>` : ""}</span></div>`,
        )
        .join("")}</div>
      <button class="btn secundario" id="editar">${t("editarCuenta")}</button>
      <button class="btn peligro" id="eliminar">${t("eliminarCuenta")}</button>`);
    $("#act").onclick = async () => {
      const valor = leerNumero($("#v").value);
      const fecha = $("#f").value || hoy();
      if (Number.isNaN(valor) || valor < 0) return ($("#err-h").textContent = t("escribeValor"));
      const existente = c.valores.find((x) => x.fecha === fecha);
      if (existente) existente.valor = valor;
      else c.valores.push({ fecha, valor });
      await guardarDatos();
      cerrarHoja();
      aviso(t("valorActualizado"));
      pintar();
    };
    $$(".mini").forEach(
      (b) =>
        (b.onclick = async () => {
          const reg = hist[Number(b.dataset.i)];
          if (!confirm(t("confirmaBorrarRegistro", { f: fechaCorta(reg.fecha) }))) return;
          c.valores = c.valores.filter((x) => x !== reg);
          await guardarDatos();
          hojaDetalle(id);
          pintar();
        }),
    );
    $("#editar").onclick = () => hojaCuenta(id);
    $("#eliminar").onclick = async () => {
      if (!confirm(t("confirmaEliminar", { n: c.nombre }))) return;
      datos.cuentas = datos.cuentas.filter((x) => x.id !== id);
      await guardarDatos();
      cerrarHoja();
      aviso(t("cuentaEliminada"));
      pintar();
    };
  }

  // ── Ajustes
  function pintarAjustes() {
    const a = datos.ajustes;
    $("#app").innerHTML = `
      ${cabeza(t("ajustes"))}
      <div class="contenedor">
        <div class="tarjeta">
          <div class="etiqueta">${t("idioma")} · Language</div>
          <select id="idioma" aria-label="${t("idioma")}"><option value="en" ${idioma === "en" ? "selected" : ""}>English</option><option value="es" ${idioma === "es" ? "selected" : ""}>Español</option></select>
        </div>
        <div class="tarjeta">
          <div class="etiqueta">${t("monedas")}</div>
          <label for="base">${t("monedaPrincipal")}</label><select id="base">${opcionesMoneda(a.monedaBase)}</select>
          <label for="tasa">${t("tasa")}</label><input id="tasa" inputmode="decimal" value="${a.tasaCOP}" />
          <button class="btn secundario" id="guardar-monedas">${t("guardar")}</button>
        </div>
        <div class="tarjeta">
          <div class="etiqueta">${t("respaldo")}</div>
          <p class="tenue">${a.ultimoRespaldo ? esc(t("ultimoRespaldo", { f: new Date(a.ultimoRespaldo).toLocaleString(t("locale")) })) : t("sinRespaldo")}<br/>${t("notaRespaldo")}</p>
          <button class="btn" id="respaldar">${t("respaldarAhora")}</button>
          <button class="btn secundario" id="restaurar">${t("restaurar")}</button>
          <input type="file" id="archivo" accept="application/json,.json" class="oculto" />
        </div>
        <div class="tarjeta">
          <div class="etiqueta">${t("seguridad")}</div>
          <button class="btn secundario" id="cambiar">${t("cambiarCodigo")}</button>
          <button class="btn secundario" id="csv">${t("exportarCSV")}</button>
          <button class="btn peligro" id="borrar">${t("borrarTodo")}</button>
        </div>
        <p class="tenue centrado">${t("pie", { v: VERSION_APP })}</p>
      </div>`;
    conectarCandado();
    $("#idioma").onchange = (e) => {
      cambiarIdioma(e.target.value);
      pintarNav();
      pintar();
    };
    $("#guardar-monedas").onclick = async () => {
      const tasa = leerNumero($("#tasa").value);
      if (!(tasa > 0)) return aviso(t("tasaInvalida"));
      a.monedaBase = $("#base").value;
      a.tasaCOP = tasa;
      await guardarDatos();
      aviso(t("guardado"));
    };
    $("#respaldar").onclick = respaldar;
    $("#restaurar").onclick = () => $("#archivo").click();
    $("#archivo").onchange = (e) => restaurarRespaldo(e.target.files[0], false);
    $("#cambiar").onclick = hojaCambiarCodigo;
    $("#csv").onclick = exportarCSV;
    $("#borrar").onclick = async () => {
      if (!confirm(t("confirmaBorrarTodo"))) return;
      if ((prompt(t("escribeBORRAR")) || "").trim().toUpperCase() !== t("palabraBorrar")) return;
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
      aviso(t("respaldoListo"));
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
      return aviso(t("noEsRespaldo"));
    }
    abrirHoja(`
      <h2>${t("restaurarTitulo")}</h2>
      <p class="tenue">${esc(t("restaurarInstr", { f: new Date(r.creado).toLocaleString(t("locale")) }))}</p>
      <label for="cr">${t("codigoRespaldo")}</label><input id="cr" type="password" />
      ${sinBoveda ? "" : `<div class="nota">${t("reemplaza")}</div>`}
      <div class="error" id="err-h"></div>
      <button class="btn" id="ok">${t("restaurarBtn")}</button>
      <button class="btn secundario" id="cancelar">${t("cancelar")}</button>`);
    $("#cancelar").onclick = cerrarHoja;
    $("#ok").onclick = async () => {
      $("#ok").disabled = true;
      $("#ok").textContent = t("descifrando");
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
        aviso(t("respaldoRestaurado"));
        entrar();
      } catch {
        $("#err-h").textContent = t("codigoRespaldoIncorrecto");
        $("#ok").disabled = false;
        $("#ok").textContent = t("restaurarBtn");
      }
    };
  }

  function hojaCambiarCodigo() {
    abrirHoja(`
      <h2>${t("cambiarCodigo")}</h2>
      <label for="act">${t("codigoActual")}</label><input id="act" type="password" autocomplete="current-password" />
      <label for="n1">${t("codigoNuevo")}</label><input id="n1" type="password" autocomplete="new-password" />
      <label for="n2">${t("repiteNuevo")}</label><input id="n2" type="password" autocomplete="new-password" />
      <div class="nota">${t("notaRespaldosViejos")}</div>
      <div class="error" id="err-h"></div>
      <button class="btn" id="ok">${t("cambiar")}</button>
      <button class="btn secundario" id="cancelar">${t("cancelar")}</button>`);
    $("#cancelar").onclick = cerrarHoja;
    $("#ok").onclick = async () => {
      const n1 = $("#n1").value;
      if (n1.length < 6) return ($("#err-h").textContent = t("minimo6Corto"));
      if (n1 !== $("#n2").value) return ($("#err-h").textContent = t("nuevosNoCoinciden"));
      $("#ok").disabled = true;
      try {
        const b = await almacen.obtener("boveda");
        await descifrar(await derivarLlave($("#act").value, desdeB64(b.sal)), b.iv, b.ct);
      } catch {
        $("#ok").disabled = false;
        return ($("#err-h").textContent = t("actualNoCorrecto"));
      }
      await crearBoveda(n1);
      cerrarHoja();
      aviso(t("codigoCambiado"));
    };
  }

  function exportarCSV() {
    if (!confirm(t("confirmaCSV"))) return;
    const filas = [t("csvCabecera")];
    for (const c of datos.cuentas)
      for (const v of c.valores) filas.push([c.nombre, nombreTipo(c.tipo), t(`clase.${TIPOS[c.tipo].clase}`), c.moneda, v.fecha, v.valor]);
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
    $("#app").innerHTML = `<div class="bloqueo"><h1>Patrimonio</h1><p class="tenue">${t("necesitaHttps")}</p></div>`;
  } else {
    pintarBloqueo();
  }

  // Solo para pruebas automáticas
  window.__patrimonio = { totales: () => datos && totales(), historialNeto: () => datos && historialNeto(), leerNumero };
})();
