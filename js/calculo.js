/* =========================================================================
   ISES · Central de Escritos — Lógica de ajustes de factura
   Cálculo, validación, resultados y panel en vivo.
   ========================================================================= */

/* ---------------------- Utilidades numéricas ---------------------- */
function parseNumero(txt) {
  if (txt === null || txt === undefined) return NaN;

  /* Limpia espacios (incluidos NBSP), símbolos de moneda y unidades. */
  let s = String(txt).trim()
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/COP/gi, '')
    .replace(/kWh/gi, '')
    .replace(/\$/g, '')
    .replace(/%/g, '');

  if (s === '') return NaN;

  /* Separa el signo para validar solo la parte numérica. */
  let signo = '';
  if (s[0] === '+' || s[0] === '-') {
    signo = s[0];
    s = s.slice(1);
    if (s === '') return NaN;
  }

  /* Un grupo de miles válido tiene exactamente 3 dígitos. */
  const gruposMilesValidos = function (partes) {
    return /^\d{1,3}$/.test(partes[0]) && partes.slice(1).every(function (p) { return /^\d{3}$/.test(p); });
  };
  const decimalValido = function (entero, decimal) {
    if (entero === '' && decimal === '') return NaN;
    if (entero === '') entero = '0';
    if (!/^\d+$/.test(entero) || !/^\d*$/.test(decimal)) return NaN;
    return entero + (decimal === '' ? '' : '.' + decimal);
  };

  const tieneComa = s.includes(',');
  const tienePunto = s.includes('.');
  let normalizado;

  if (tieneComa && tienePunto) {
    /* El último separador es el decimal; el otro es de miles.
       Ej.: 1.234,56 -> 1234.56   |   1,234.56 -> 1234.56 */
    const comaEsDecimal = s.lastIndexOf(',') > s.lastIndexOf('.');
    const separadorDecimal = comaEsDecimal ? ',' : '.';
    const separadorMiles = comaEsDecimal ? '.' : ',';
    const pos = s.lastIndexOf(separadorDecimal);
    const entero = s.slice(0, pos);
    const decimal = s.slice(pos + 1);
    const grupos = entero.split(separadorMiles);

    if (grupos.length > 1 && !gruposMilesValidos(grupos)) return NaN;
    if (grupos.length === 1 && !/^\d+$/.test(entero)) return NaN;
    normalizado = decimalValido(grupos.join(''), decimal);
  } else if (tieneComa) {
    const partes = s.split(',');
    if (partes.length > 2) {
      /* Varios separadores solo pueden ser de miles (1,234,567). */
      if (!gruposMilesValidos(partes)) return NaN;
      normalizado = partes.join('');
    } else {
      /* En formato colombiano la coma es decimal (5,77). */
      normalizado = decimalValido(partes[0], partes[1]);
    }
  } else if (tienePunto) {
    const partes = s.split('.');
    if (partes.length > 2) {
      /* Varios puntos solo pueden ser de miles (1.234.567). */
      if (!gruposMilesValidos(partes)) return NaN;
      normalizado = partes.join('');
    } else if (!/^0+$/.test(partes[0]) && /^\d{1,3}$/.test(partes[0]) && partes[1].length === 3) {
      /* Un punto seguido de 3 dígitos se interpreta como miles (1.200).
         Sin este caso, 1.200 se convertía en 1,2 y el cobro salía en $0.
         Con 4 o más dígitos enteros se prefiere el punto decimal (1234.567). */
      normalizado = partes[0] + partes[1];
    } else {
      /* Punto decimal (5.77, 190.41, 1234.567). */
      normalizado = decimalValido(partes[0], partes[1]);
    }
  } else {
    normalizado = s;
  }

  /* Solo se acepta un número completo; evita que parseFloat acepte basura final. */
  if (typeof normalizado !== 'string') return NaN;
  normalizado = signo + normalizado;
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(normalizado)) return NaN;
  return parseFloat(normalizado);
}

/* Redondeo a la precisión que se muestra en la factura (2 decimales).
   Evita que errores de coma flotante generen excedentes de 4e-16 kWh. */
function redondear(v, decimales) {
  const f = Math.pow(10, decimales);
  return Math.round((v + Number.EPSILON) * f) / f;
}
function fmtKwh(v) {
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
/* Las tarifas se muestran con 2 decimales para que la multiplicación
   que ve el usuario coincida con el valor liquidado. */
function fmtPeso(v) {
  return fmtPesoDecimal(v);
}
function fmtPesoDecimal(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
/* Valores intermedios con hasta 5 decimales, igual que en la liquidación
   de la factura (873,6862 · 691,5607 · 207,46821). */
function fmtPesoPreciso(v) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 5 }).format(v);
}
function fmtDecimal(v, dec) {
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
}
function fmtNumPreciso(v) {
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 5 }).format(v);
}
function fmtFactor(v) {
  return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function fmt0(v) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v);
}
/* Porcentaje adicional que representa el factor: 1,30 → 30 %. */
function fmtPct(v) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(v) + ' %';
}
function numFactor(v) {
  return '×' + v.toFixed(2).replace('.', ',');
}
function icon(name) { return '<i data-lucide="' + name + '"></i>'; }
function renderIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}
function el(id) { return document.getElementById(id); }
function val(id) { const e = el(id); return e ? e.value : ''; }

/* ---------------------- Tipos de usuario ----------------------
   Fuente: presentación «Programa transitorio de ahorro de energía»,
   con la corrección de la usuaria sobre los estratos 5 y 6.
   · Caso 1 — Subsidio: estratos 1, 2 y 3 → F = 1,30 (30 % adicional).
   · Caso 2 — Contribución:
       – estratos 5 y 6 → F = 1,50 (50 % adicional), igual que el estrato 4.
       – comercial e industrial → F = 1,70 (70 % adicional).
   · Estrato 4: la presentación no lo clasifica como subsidio ni como
     contribución. Se conserva el factor 1,50 que ya traía la calculadora
     para no alterar su liquidación; la interfaz lo advierte al usuario. */
const CLASES = {
  subsidio: {
    id: 'subsidio',
    nombre: 'Subsidio',
    detalle: 'Estratos 1, 2 y 3',
    icono: 'arrow-down-circle',
    nota: 'El usuario recibe subsidio. Primero se descuenta el subsidio de la tarifa regulada y el 30 % adicional se aplica sobre la tarifa resultante, nunca sobre la tarifa completa.'
  },
  neutro: {
    id: 'neutro',
    nombre: 'Sin subsidio ni contribución',
    detalle: 'Estrato 4 (no clasificado en la presentación)',
    icono: 'minus-circle',
    nota: 'La presentación no clasifica el estrato 4 como subsidio ni como contribución. Se mantiene el factor 1,50 vigente en la calculadora.'
  },
  contribucion: {
    id: 'contribucion',
    nombre: 'Contribución',
    detalle: 'Estratos 5 y 6 · Comercial e Industrial',
    icono: 'arrow-up-circle',
    nota: 'El usuario aporta contribución. Sobre el excedente se aplica el porcentaje adicional de su perfil y, sobre ese cobro, el 20 % que da la penalización final.'
  }
};

/* Etiqueta del monto según la clasificación tarifaria. */
function etiquetaAporte(clase, larga) {
  if (clase === 'contribucion') return larga ? 'Cobro adicional estimado' : 'Cobro adicional';
  if (clase === 'subsidio') return larga ? 'Aporte adicional por subsidio, estimado' : 'Aporte adicional (subsidio)';
  return larga ? 'Ajuste adicional estimado' : 'Ajuste adicional';
}

/* Un paso de la liquidación: número, título, cuenta y resultado. */
function pasoLiq(n, titulo, cuenta, resultado) {
  return '<div class="paso">' +
    '<span class="paso__num">' + n + '</span>' +
    '<div class="paso__body">' +
    '<p class="paso__title">' + titulo + '</p>' +
    '<p class="paso__formula mono">' + cuenta + ' = <b>' + resultado + '</b></p>' +
    '</div></div>';
}

const TIPOS = [
  { id: 'e123', name: 'Estratos 1, 2 y 3', sub: 'Reciben subsidio', f: 1.3, clase: 'subsidio', ic: 'house' },
  { id: 'e4', name: 'Estrato 4', sub: 'Sin subsidio ni contribución', f: 1.5, clase: 'neutro', ic: 'home' },
  { id: 'e56', name: 'Estratos 5 y 6', sub: 'Aportan contribución', f: 1.5, clase: 'contribucion', ic: 'building-2' },
  { id: 'ci', name: 'Comercial e Industrial', sub: 'Aportan contribución', f: 1.7, clase: 'contribucion', ic: 'factory' }
];

/* Etiquetas largas para resultados, copia e impresión. */
const TIPO_NOMBRE = {
  e123: 'Residencial estratos 1, 2 y 3 (subsidio)',
  e4: 'Residencial estrato 4 (sin subsidio ni contribución)',
  e56: 'Residencial estratos 5 y 6 (contribución)',
  ci: 'Comercial / Industrial (contribución)'
};

const TIPO_MAP = {};
TIPOS.forEach(function (t) {
  TIPO_MAP[t.id] = {
    factor: t.f,
    clase: t.clase,
    claseNombre: CLASES[t.clase].nombre,
    claseDetalle: CLASES[t.clase].detalle,
    claseIcono: CLASES[t.clase].icono,
    claseNota: CLASES[t.clase].nota,
    porcentaje: redondear((t.f - 1) * 100, 2),
    nombre: TIPO_NOMBRE[t.id]
  };
});

function obtenerTipoSeleccionado() {
  const sel = document.querySelector('#types input[name="tipo"]:checked');
  if (!sel) return null;
  return TIPO_MAP[sel.value] || TIPO_MAP.e123;
}

/* ---------------------- Cálculo puro ---------------------- */
function calcularAjuste(metaDiaria, dias, consumo, tarifa, factor, subsidio) {
  /* Meta y límite sin redondeos intermedios: el excedente es
     consumo − (meta diaria × días × 1,10). Solo se descarta el ruido de
     coma flotante (< 1e-9 kWh) para que un consumo igual al límite no
     genere un excedente fantasma; no altera ningún valor real. */
  const metaCiclo = metaDiaria * dias;
  const limite110 = metaCiclo * 1.10;
  const dif = consumo - limite110;
  const excedente = dif > 1e-9 ? dif : 0;
  const hayExcedente = excedente > 0;

  /* Liquidación del adicional (Caso 1 · subsidio):
       1) tarifa después del subsidio = tarifa regulada − subsidio
       2) adicional por kWh            = tarifa después del subsidio × (factor − 1)
       3) cobro adicional              = excedente × adicional por kWh
     El porcentaje adicional NUNCA se aplica sobre la tarifa completa:
     se aplica sobre la tarifa neta, ya descontado el subsidio. */
  const subsidioKwh = Math.max(0, Number(subsidio) || 0);
  const tarifaNeta = Math.max(0, redondear(tarifa - subsidioKwh, 4));
  const tarifaResultante = tarifaNeta * factor;
  const diferenciaTarif = tarifaNeta * (factor - 1);
  const cobroAdicional = redondear(excedente * diferenciaTarif, 2);

  return {
    metaCiclo, limite110, excedente, hayExcedente,
    subsidioKwh, tarifaNeta, tarifaResultante, diferenciaTarif, cobroAdicional
  };
}

/* ---------------------- Contribución del 20 % sobre la penalización -------
   Presentación, caso 2: el cobro adicional es
       excedente × tarifa × (factor − 1)
   y sobre ese valor se aplica el 20 % para obtener la penalización final:
       cobro adicional × 1,20
   El factor depende de la clasificación: 1,50 (50 %) para los estratos 5 y 6
   y 1,70 (70 %) para el comercial y el industrial.
   Ejemplo del material (perfil comercial e industrial, F 1,70):
       168 kWh × $ 800 × 0,70 = $ 94.080
       $ 94.080 × 1,20      = $ 112.896
   Con el factor 1,50 de los estratos 5 y 6 el mismo ejemplo da $ 80.640.
   Solo la pagan los estratos 5 y 6, el comercial y el industrial.
   Los estratos 1 a 4 no pagan este 20 %. */
const TASA_CONTRIBUCION = 20;

function calcularContribucion20(penalizacion, clase, tasa) {
  const t = (tasa === null || tasa === undefined) ? TASA_CONTRIBUCION : tasa;
  const base = redondear(Math.max(0, Number(penalizacion) || 0), 2);
  const aplica = clase === 'contribucion';
  const monto = aplica ? redondear(base * t / 100, 2) : 0;
  return { aplica, tasa: t, base, monto };
}

/* Penalización final = cobro adicional + contribución del 20 %.
   Para los estratos 1 a 4 la contribución es 0, así que la penalización
   final coincide con el cobro adicional. */
function calcularPenalizacionFinal(aporte, contribucion) {
  const a = Math.max(0, Number(aporte) || 0);
  const c = Math.max(0, Number(contribucion) || 0);
  return redondear(a + c, 2);
}

let ultimoCalculo = null;
let toastTimeout;

/* ---------------------- Helpers de render ---------------------- */
function brow(iconName, etiqueta, valor, clase) {
  return '<div class="brow ' + (clase || '') + '">' +
    '<span class="brow__icon">' + icon(iconName) + '</span>' +
    '<span class="brow__label">' + etiqueta + '</span>' +
    '<span class="brow__value">' + valor + '</span>' +
    '</div>';
}
function barra(tipo, iconName, label, valor, pct) {
  return '<div class="bar bar--' + tipo + '">' +
    '<div class="bar__head"><span class="i-flex">' + icon(iconName) + label + '</span>' +
    '<span class="mono">' + fmtKwh(valor) + ' kWh</span></div>' +
    '<div class="bar__track"><div class="bar__fill" data-w="' + pct + '"></div></div>' +
    '</div>';
}
function lineaPanel(etiqueta, valor) {
  return '<div class="panel__row"><span>' + etiqueta + '</span><span>' + valor + '</span></div>';
}

function setTextoDataB(clave, texto) {
  document.querySelectorAll('[data-b="' + clave + '"]').forEach(function (n) { n.textContent = texto; });
}

/* ---------------------- Validación ---------------------- */
function leerYValidar() {
  const metaDiaria = parseNumero(val('meta'));
  const dias = parseNumero(val('dias'));
  const consumo = parseNumero(val('consumo'));
  const tarifa = parseNumero(val('tarifa'));
  const tipo = obtenerTipoSeleccionado();
  const esSubsidio = !!(tipo && tipo.clase === 'subsidio');
  /* El subsidio solo aplica a los estratos 1, 2 y 3; en los demás perfiles
     el campo está oculto y se liquida con subsidio 0. */
  const subsidio = esSubsidio ? parseNumero(val('subsidio')) : 0;

  const errores = [];
  const malos = [];
  if (isNaN(metaDiaria) || metaDiaria <= 0) { errores.push('La meta diaria debe ser un número mayor que 0.'); malos.push('meta'); }
  if (isNaN(dias) || dias <= 0 || !Number.isInteger(dias)) { errores.push('Los días facturados deben ser un número entero mayor que 0.'); malos.push('dias'); }
  if (isNaN(consumo) || consumo < 0) { errores.push('El consumo facturado debe ser un número mayor o igual a 0.'); malos.push('consumo'); }
  if (isNaN(tarifa) || tarifa <= 0) { errores.push('La tarifa regulada debe ser un número mayor que 0.'); malos.push('tarifa'); }
  if (esSubsidio && (isNaN(subsidio) || subsidio < 0)) {
    errores.push('El subsidio por kWh debe ser un número mayor o igual a 0.');
    malos.push('subsidio');
  } else if (esSubsidio && !isNaN(tarifa) && subsidio >= tarifa) {
    errores.push('El subsidio por kWh debe ser menor que la tarifa regulada: la tarifa después del subsidio no puede ser negativa.');
    malos.push('subsidio');
  }
  if (!tipo) { errores.push('Seleccione un tipo de usuario.'); }

  ['meta', 'dias', 'consumo', 'tarifa', 'subsidio'].forEach(function (id) {
    const f = el(id);
    if (!f) return;
    if (malos.indexOf(id) !== -1) f.setAttribute('aria-invalid', 'true');
    else f.removeAttribute('aria-invalid');
  });

  return { metaDiaria, dias, consumo, tarifa, subsidio, tipo, errores, malos };
}

/* ---------------------- Contador animado del monto ---------------------- */
let objetivoHero = 0;
const _montos = new WeakMap();

function cancelarMonto(el) {
  const st = _montos.get(el);
  if (st && st.raf) cancelAnimationFrame(st.raf);
}
function fijarMonto(el, texto, valor) {
  if (!el) return;
  const st = _montos.get(el) || { valor: 0, raf: 0 };
  cancelarMonto(el);
  st.valor = valor;
  st.raf = 0;
  _montos.set(el, st);
  el.textContent = texto;
}
function animarMonto(el, objetivo, duracion) {
  if (!el) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st = _montos.get(el) || { valor: 0, raf: 0 };
  const desde = st.valor;

  if (reduce || !duracion || desde === objetivo) {
    fijarMonto(el, fmtPesoDecimal(objetivo), objetivo);
    return;
  }

  cancelarMonto(el);
  const inicio = performance.now();
  const paso = function (ahora) {
    const t = Math.min((ahora - inicio) / duracion, 1);
    const e = 1 - Math.pow(1 - t, 3); /* easeOutCubic */
    const v = desde + (objetivo - desde) * e;
    st.valor = v;
    el.textContent = fmtPesoDecimal(v);
    if (t < 1) st.raf = requestAnimationFrame(paso);
    else fijarMonto(el, fmtPesoDecimal(objetivo), objetivo);
  };
  st.raf = requestAnimationFrame(paso);
  _montos.set(el, st);
}

/* ---------------------- Panel en vivo (hero + pasos) ---------------------- */
function actualizarEnVivo() {
  const d = leerYValidar();
  const heroFill = el('heroFill');
  const heroMark = el('heroMark');
  const heroState = el('heroState');

  if (d.errores.length) {
    ['cobro', 'lim', 'exc', 'mc', 'meta', 'dias', 'dif', 'consumoHero'].forEach(function (k) { setTextoDataB(k, '—'); });
    fijarMonto(el('heroAmount'), '—', 0);
    if (heroFill) { heroFill.style.width = '0%'; heroFill.classList.remove('is-over'); }
    if (heroMark) heroMark.style.left = '0%';
    if (heroState) heroState.innerHTML = icon('minus') + 'Sin datos';
    return;
  }

  const r = calcularAjuste(d.metaDiaria, d.dias, d.consumo, d.tarifa, d.tipo.factor, d.subsidio);

  const cobroLive = r.hayExcedente ? r.cobroAdicional : 0;
  const solLive = calcularContribucion20(cobroLive, d.tipo.clase);
  setTextoDataB('cobro', fmtPesoDecimal(cobroLive));
  objetivoHero = calcularPenalizacionFinal(cobroLive, solLive.monto);
  animarMonto(el('heroAmount'), objetivoHero, 650);
  setTextoDataB('lim', fmtKwh(r.limite110) + ' kWh');
  setTextoDataB('exc', fmtKwh(r.excedente) + ' kWh');
  setTextoDataB('mc', fmtKwh(r.metaCiclo) + ' kWh');
  setTextoDataB('meta', fmtKwh(d.metaDiaria));
  setTextoDataB('dias', String(d.dias));
  setTextoDataB('dif', fmtPeso(r.diferenciaTarif) + '/kWh');
  setTextoDataB('consumoHero', fmtKwh(d.consumo) + ' kWh');

  if (heroState) {
    if (r.hayExcedente) heroState.innerHTML = icon('alert-circle') + 'Con ajuste';
    else heroState.innerHTML = icon('check-circle') + 'Sin ajuste';
  }

  if (heroFill && heroMark) {
    const trackMax = Math.max(r.limite110 / 0.8, d.consumo / 0.96, 1);
    const fillPct = Math.min((d.consumo / trackMax) * 100, 100);
    heroFill.style.width = fillPct + '%';
    heroFill.classList.toggle('is-over', d.consumo > r.limite110);
    heroMark.style.left = Math.min((r.limite110 / trackMax) * 100, 100) + '%';
  }
}

/* ---------------------- Resultados ---------------------- */
function mostrarError(errores) {
  const box = el('errorBox');
  if (!box) return;
  box.innerHTML = icon('alert-triangle') + '<div>' + errores.join('<br>') + '</div>';
  box.classList.add('is-visible');
  renderIcons();
}
function ocultarError() {
  const box = el('errorBox');
  if (box) box.classList.remove('is-visible');
}

function pintarResultados(d) {
  const r = calcularAjuste(d.metaDiaria, d.dias, d.consumo, d.tarifa, d.tipo.factor, d.subsidio);
  const factor = d.tipo.factor;
  const aporte = r.hayExcedente ? r.cobroAdicional : 0;
  const sol = calcularContribucion20(aporte, d.tipo.clase);
  const penalizacionFinal = calcularPenalizacionFinal(aporte, sol.monto);

  ultimoCalculo = {
    metaDiaria: d.metaDiaria, dias: d.dias, consumo: d.consumo, tarifa: d.tarifa, factor: factor,
    metaCiclo: r.metaCiclo, limite110: r.limite110, excedente: r.excedente, hayExcedente: r.hayExcedente,
    tarifaResultante: r.tarifaResultante, diferenciaTarif: r.diferenciaTarif, cobroAdicional: r.cobroAdicional,
    aporte: aporte, penalizacionFinal: penalizacionFinal,
    subsidio: r.subsidioKwh, tarifaNeta: r.tarifaNeta,
    tipoNombre: d.tipo.nombre,
    clase: d.tipo.clase, claseNombre: d.tipo.claseNombre, claseDetalle: d.tipo.claseDetalle,
    claseNota: d.tipo.claseNota, porcentaje: d.tipo.porcentaje,
    contribucion20: sol
  };

  /* Tarjeta principal */
  const cobro = el('cobroFinal');
  if (cobro) {
    cobro.className = 'result ' + (r.hayExcedente ? 'result--due' : 'result--ok');
    cobro.innerHTML =
      '<div class="result__top"><span class="result__label">' + etiquetaAporte(d.tipo.clase, true) + '</span>' +
      '<span class="result__chips">' +
      '<span class="chip chip--' + d.tipo.clase + '">' + icon(d.tipo.claseIcono) + d.tipo.claseNombre + '</span>' +
      '<span class="chip ' + (r.hayExcedente ? 'chip--due' : 'chip--ok') + '">' +
      icon(r.hayExcedente ? 'alert-circle' : 'check-circle') + (r.hayExcedente ? 'Con ajuste' : 'Sin ajuste') + '</span>' +
      '</span></div>' +
      '<p class="result__amount">' + fmtPesoDecimal(aporte) + '</p>' +
      '<p class="result__note">' + (r.hayExcedente
        ? 'Corresponde al consumo que superó el límite del 110 % del ciclo, con el porcentaje adicional de su clasificación (' + fmtPct(d.tipo.porcentaje) + ').'
        : 'Su consumo no superó el límite del 110 % del ciclo.') + '</p>' +
      (sol.aplica && r.hayExcedente
        ? '<div class="result__total"><span>Penalización final · cobro + contribución ' + fmtPct(sol.tasa) + '</span><b>' + fmtPesoDecimal(penalizacionFinal) + '</b></div>'
        : '');
  }

  /* Desglose */
  const flujo = el('flujoResultado');
  if (flujo) {
    let h = '';
    h += brow('target', 'Meta individual del ciclo', fmtKwh(r.metaCiclo) + ' kWh', '');
    h += brow('gauge', 'Límite del 110 %', fmtKwh(r.limite110) + ' kWh', '');
    h += brow('zap', 'Consumo facturado', fmtKwh(d.consumo) + ' kWh', '');
    if (r.hayExcedente) h += brow('alert-circle', 'Excedente sobre el 110 %', fmtKwh(r.excedente) + ' kWh', 'brow--due');
    else h += brow('check-circle', 'Excedente sobre el 110 %', '0,00 kWh', 'brow--ok');
    h += brow('tag', 'Tipo de usuario', d.tipo.nombre, '');
    h += brow(d.tipo.claseIcono, 'Clasificación tarifaria', d.tipo.claseNombre, 'brow--clase-' + d.tipo.clase);
    h += brow('banknote', 'Tarifa regulada', fmtPesoPreciso(d.tarifa) + '/kWh', '');
    if (r.subsidioKwh > 0) {
      h += brow('arrow-down-circle', 'Subsidio por kWh', '− ' + fmtPesoPreciso(r.subsidioKwh) + '/kWh', 'brow--clase-subsidio');
      h += brow('gauge', 'Tarifa después del subsidio', fmtPesoPreciso(r.tarifaNeta) + '/kWh', '');
    }
    h += brow('percent', 'Factor de ajuste', numFactor(factor) + ' · ' + fmtPct(d.tipo.porcentaje), '');
    if (r.hayExcedente) {
      h += brow('trending-up', 'Adicional por kWh', fmtPesoPreciso(r.diferenciaTarif) + '/kWh', '');
      h += brow('calculator', 'Tarifa resultante', fmtPesoPreciso(r.tarifaResultante) + '/kWh', '');
    }
    flujo.innerHTML = h;
  }

  /* Barras */
  const barras = el('graficoBarras');
  if (barras) {
    const max = Math.max(r.metaCiclo, r.limite110, d.consumo) * 1.05 || 1;
    const pct = function (v) { return (v / max) * 100; };
    let h = '';
    h += barra('meta', 'target', 'Meta del ciclo', r.metaCiclo, pct(r.metaCiclo));
    h += barra('limit', 'gauge', 'Límite 110 %', r.limite110, pct(r.limite110));
    const clase = d.consumo > r.limite110 ? 'consumo is-over' : 'consumo';
    h += barra(clase, 'zap', 'Consumo facturado', d.consumo, pct(d.consumo));
    if (r.hayExcedente) h += barra('exc', 'alert-circle', 'Excedente sobre el 110 %', r.excedente, pct(r.excedente));
    barras.innerHTML = h;
    requestAnimationFrame(function () {
      barras.querySelectorAll('.bar__fill').forEach(function (f) { f.style.width = f.dataset.w + '%'; });
    });
  }

  /* Resumen */
  const resumen = el('resumenFinal');
  if (resumen) {
    let h = '';
    h += lineaPanel('Meta diaria', fmtKwh(d.metaDiaria) + ' kWh/día');
    h += lineaPanel('Días facturados', String(d.dias));
    h += lineaPanel('Meta del ciclo', fmtKwh(r.metaCiclo) + ' kWh');
    h += lineaPanel('Límite 110 %', fmtKwh(r.limite110) + ' kWh');
    h += lineaPanel('Consumo facturado', fmtKwh(d.consumo) + ' kWh');
    h += lineaPanel('Excedente sobre el 110 %', fmtKwh(r.excedente) + ' kWh');
    h += lineaPanel('Tipo de usuario', d.tipo.nombre);
    h += lineaPanel('Clasificación', d.tipo.claseNombre);
    h += lineaPanel('Factor', numFactor(factor));
    h += lineaPanel('Porcentaje adicional', fmtPct(d.tipo.porcentaje));
    h += lineaPanel('Tarifa regulada', fmtPesoPreciso(d.tarifa) + '/kWh');
    if (r.subsidioKwh > 0) {
      h += lineaPanel('Subsidio por kWh', '− ' + fmtPesoPreciso(r.subsidioKwh) + '/kWh');
      h += lineaPanel('Tarifa después del subsidio', fmtPesoPreciso(r.tarifaNeta) + '/kWh');
    }
    if (r.hayExcedente) {
      h += lineaPanel('Adicional por kWh', fmtPesoPreciso(r.diferenciaTarif) + '/kWh');
      h += lineaPanel('Tarifa resultante', fmtPesoPreciso(r.tarifaResultante) + '/kWh');
    }
    if (sol.aplica) {
      h += lineaPanel('Cobro adicional (penalización)', fmtPesoDecimal(aporte));
      h += lineaPanel('Contribución del ' + fmtPct(sol.tasa) + ' sobre la penalización', fmtPesoDecimal(sol.monto));
      h += '<div class="panel__total"><span>PENALIZACIÓN FINAL</span><span>' + fmtPesoDecimal(penalizacionFinal) + '</span></div>';
    } else {
      h += '<div class="panel__total"><span>' + etiquetaAporte(d.tipo.clase, false).toUpperCase() + '</span><span>' + fmtPesoDecimal(aporte) + '</span></div>';
    }
    resumen.innerHTML = h;
  }

  /* Liquidación paso a paso */
  const pasosBox = el('pasosDetalle');
  if (pasosBox) {
    let lista = '';
    let nota = '';
    let n = 1;
    const etiquetaMonto = etiquetaAporte(d.tipo.clase, false);
    if (r.subsidioKwh > 0) {
      lista += pasoLiq(n++, 'Tarifa después del subsidio',
        fmtNumPreciso(d.tarifa) + ' − ' + fmtNumPreciso(r.subsidioKwh),
        fmtNumPreciso(r.tarifaNeta) + ' $/kWh');
    }
    const baseTexto = r.subsidioKwh > 0 ? 'sobre la tarifa después del subsidio' : 'sobre la tarifa regulada';
    lista += pasoLiq(n++, 'Adicional por kWh · ' + fmtPct(d.tipo.porcentaje) + ' ' + baseTexto,
      fmtNumPreciso(r.tarifaNeta) + ' × ' + fmtDecimal(factor - 1, 2),
      fmtNumPreciso(r.diferenciaTarif) + ' $/kWh');
    lista += pasoLiq(n++, etiquetaMonto + ' sobre el excedente',
      fmtDecimal(r.excedente, 2) + ' kWh × ' + fmtNumPreciso(r.diferenciaTarif),
      fmtPesoDecimal(r.cobroAdicional));

    if (r.subsidioKwh > 0) {
      nota = '<p class="paso__nota paso__nota--warn">' + icon('alert-triangle') +
        ' <b>Control clave:</b> utilice el ' + fmtPct(d.tipo.porcentaje) +
        ' adicional —' + fmtDecimal(factor - 1, 2) + '—, no el factor completo ' +
        fmtFactor(factor) + '. El porcentaje se aplica sobre la tarifa <b>ya descontado el subsidio</b>, nunca sobre la tarifa regulada completa.</p>';
    } else if (d.tipo.clase === 'contribucion') {
      nota = '<p class="paso__nota">' + icon('info') +
        ' El ' + fmtPct(d.tipo.porcentaje) + ' se aplica sobre la tarifa regulada completa. La <b>contribución del ' +
        fmtPct(sol.tasa) + '</b> se calcula sobre ese cobro adicional: es la penalización final.</p>';
    } else {
      nota = '<p class="paso__nota">' + icon('info') +
        ' El estrato 4 no recibe subsidio ni aporta contribución: el ' + fmtPct(d.tipo.porcentaje) +
        ' se aplica directamente sobre la tarifa regulada.</p>';
    }
    pasosBox.innerHTML = '<div class="pasos">' + lista + '</div>' + nota;
  }

  /* Subsidio o contribución */
  const claseBox = el('claseDetalle');
  if (claseBox) {
    let h = '';
    h += '<div class="clase clase--' + d.tipo.clase + '">' +
      '<span class="clase__icon">' + icon(d.tipo.claseIcono) + '</span>' +
      '<span class="clase__body">' +
      '<span class="clase__name">' + d.tipo.claseNombre + '</span>' +
      '<span class="clase__sub">' + d.tipo.claseDetalle + '</span>' +
      '</span>' +
      '<span class="clase__pct">' + fmtPct(d.tipo.porcentaje) + '</span>' +
      '</div>';
    h += '<div class="breakdown">';
    h += brow('zap', 'Excedente sobre el 110 %', fmtKwh(r.excedente) + ' kWh', r.hayExcedente ? 'brow--due' : 'brow--ok');
    h += brow('banknote', 'Tarifa regulada', fmtPesoPreciso(d.tarifa) + '/kWh', '');
    if (r.subsidioKwh > 0) {
      h += brow('arrow-down-circle', 'Subsidio por kWh', '− ' + fmtPesoPreciso(r.subsidioKwh) + '/kWh', 'brow--clase-subsidio');
      h += brow('gauge', 'Tarifa después del subsidio', fmtPesoPreciso(r.tarifaNeta) + '/kWh', '');
    }
    h += brow('percent', 'Porcentaje adicional aplicado', fmtPct(d.tipo.porcentaje), '');
    h += brow('calculator', etiquetaAporte(d.tipo.clase, false), r.hayExcedente ? fmtPesoDecimal(r.cobroAdicional) : '$ 0', r.hayExcedente ? 'brow--due' : 'brow--ok');
    h += '</div>';
    h += '<p class="clase__nota">' + d.tipo.claseNota + '</p>';
    claseBox.innerHTML = h;
  }

  /* Contribución del 20 % sobre la penalización */
  const solBox = el('solidaridadDetalle');
  if (solBox) {
    let h = '';
    if (sol.aplica && r.hayExcedente) {
      h += '<div class="sol sol--aplica">' +
        '<span class="sol__icon">' + icon('piggy-bank') + '</span>' +
        '<span class="sol__body">' +
        '<span class="sol__name">Sí aplica · 20 % sobre el cobro adicional</span>' +
        '<span class="sol__sub">Estratos 5 y 6 · Comercial e Industrial</span>' +
        '</span>' +
        '<span class="sol__pct">' + fmtPct(sol.tasa) + '</span>' +
        '</div>';
      h += '<div class="breakdown">';
      h += brow('receipt', 'Cobro adicional (penalización)', fmtPesoDecimal(aporte), '');
      h += brow('percent', 'Tasa de contribución', fmtPct(sol.tasa), '');
      h += brow('piggy-bank', 'Contribución del 20 %', fmtPesoDecimal(sol.monto), 'brow--clase-contribucion');
      h += '</div>';
      h += '<p class="sol__nota">El 20 % se aplica sobre el <strong>cobro adicional</strong>, no sobre el valor del consumo: ' +
        fmtPesoDecimal(aporte) + ' × 0,20 = ' + fmtPesoDecimal(sol.monto) + '. La <strong>penalización final</strong> es ' +
        fmtPesoDecimal(aporte) + ' + ' + fmtPesoDecimal(sol.monto) + ' = ' + fmtPesoDecimal(penalizacionFinal) + '.</p>';
    } else if (sol.aplica) {
      h += '<div class="sol sol--neutro">' +
        '<span class="sol__icon">' + icon('minus-circle') + '</span>' +
        '<span class="sol__body">' +
        '<span class="sol__name">Sin excedente: no hay cobro adicional</span>' +
        '<span class="sol__sub">Estratos 5 y 6 · Comercial e Industrial</span>' +
        '</span>' +
        '<span class="sol__pct">$ 0</span>' +
        '</div>';
      h += '<p class="sol__nota">El consumo no superó el límite del 110 %, así que no se genera cobro adicional ni la contribución del 20 % sobre él. La penalización final es <strong>$ 0</strong>.</p>';
    } else if (d.tipo.clase === 'subsidio') {
      h += '<div class="sol sol--exento">' +
        '<span class="sol__icon">' + icon('shield-check') + '</span>' +
        '<span class="sol__body">' +
        '<span class="sol__name">No paga la contribución del 20 %</span>' +
        '<span class="sol__sub">Estratos 1, 2 y 3 · usuarios subsidiados</span>' +
        '</span>' +
        '<span class="sol__pct">Exento</span>' +
        '</div>';
      h += '<p class="sol__nota">Los estratos 1, 2 y 3 no pagan la contribución del 20 %. En su factura el subsidio se descuenta de la tarifa regulada y el <strong>30 % adicional</strong> se liquida sobre esa tarifa neta, solo por el excedente.</p>';
    } else {
      h += '<div class="sol sol--neutro">' +
        '<span class="sol__icon">' + icon('minus-circle') + '</span>' +
        '<span class="sol__body">' +
        '<span class="sol__name">No paga la contribución del 20 %</span>' +
        '<span class="sol__sub">Estrato 4 · sin subsidio ni contribución</span>' +
        '</span>' +
        '<span class="sol__pct">No aplica</span>' +
        '</div>';
      h += '<p class="sol__nota">El estrato 4 no paga la contribución del 20 % ni recibe subsidio. Solo se liquida el ajuste por excedente.</p>';
    }
    solBox.innerHTML = h;
  }

  /* Penalización final = cobro adicional + contribución del 20 % */
  const totalBox = el('totalDetalle');
  if (totalBox) {
    let h = '<div class="total' + (sol.aplica && r.hayExcedente ? ' total--con' : '') + '">';
    h += '<div class="total__row"><span>Cobro adicional (penalización)</span><span>' + fmtPesoDecimal(aporte) + '</span></div>';
    h += '<div class="total__row ' + (sol.aplica && r.hayExcedente ? 'total__row--con' : 'total__row--muted') + '"><span>Contribución del ' + fmtPct(sol.tasa) + ' sobre la penalización</span><span>' + (sol.aplica ? fmtPesoDecimal(sol.monto) : 'No aplica') + '</span></div>';
    h += '<div class="total__final"><span>Penalización final</span><span class="total__amount">' + fmtPesoDecimal(penalizacionFinal) + '</span></div>';
    h += '</div>';
    h += '<p class="total__nota">' + (sol.aplica
      ? (r.hayExcedente
        ? 'Penalización final = cobro adicional + contribución del 20 %: ' + fmtPesoDecimal(aporte) + ' + ' + fmtPesoDecimal(sol.monto) + ' = ' + fmtPesoDecimal(penalizacionFinal) + '. Equivale a multiplicar el cobro adicional por 1,20.'
        : 'Su clasificación paga la contribución del 20 %, pero no hubo cobro adicional: la penalización final es <b>$ 0</b>.')
      : 'Su clasificación no paga la contribución del 20 %, así que la penalización final coincide con el cobro adicional.') + '</p>';
    totalBox.innerHTML = h;
  }

  /* Explicación */
  const explicacion = el('explicacion');
  if (explicacion) {
    let e = '';
    e += '<p>Con una meta diaria de <strong>' + fmtKwh(d.metaDiaria) + ' kWh/día</strong> y un ciclo de <strong>' + d.dias + ' días</strong>, la meta individual del ciclo es de <strong>' + fmtKwh(r.metaCiclo) + ' kWh</strong>.</p>';
    e += '<p>El 110 % de esa meta corresponde a <strong>' + fmtKwh(r.limite110) + ' kWh</strong>.</p>';
    if (r.hayExcedente) {
      e += '<p>El consumo facturado fue de <strong>' + fmtKwh(d.consumo) + ' kWh</strong>, por lo que existe un excedente sobre el 110 % de <strong>' + fmtKwh(r.excedente) + ' kWh</strong>.</p>';
      e += '<p>Su clasificación tarifaria es <strong>' + d.tipo.claseNombre + '</strong> (' + d.tipo.claseDetalle + '), por lo que se aplica un factor de <strong>' + fmtFactor(factor) + '</strong>, equivalente a un <strong>' + fmtPct(d.tipo.porcentaje) + '</strong> adicional sobre la tarifa.</p>';
      if (r.subsidioKwh > 0) {
        e += '<p>Primero se descuenta el subsidio de la tarifa regulada: <strong>' + fmtPesoPreciso(d.tarifa) + '</strong> − <strong>' + fmtPesoPreciso(r.subsidioKwh) + '</strong> = <strong>' + fmtPesoPreciso(r.tarifaNeta) + '/kWh</strong>. El ' + fmtPct(d.tipo.porcentaje) + ' se aplica sobre esa tarifa neta, <strong>no</strong> sobre la tarifa completa: ' + fmtNumPreciso(r.tarifaNeta) + ' × ' + fmtDecimal(factor - 1, 2) + ' = <strong>' + fmtNumPreciso(r.diferenciaTarif) + '/kWh</strong>.</p>';
        e += '<p>El excedente es de <strong>' + fmtKwh(r.excedente) + ' kWh</strong>, así que el aporte adicional es <strong>' + fmtKwh(r.excedente) + ' × ' + fmtNumPreciso(r.diferenciaTarif) + ' = ' + fmtPesoDecimal(r.cobroAdicional) + '</strong>.</p>';
      } else {
        e += '<p>La tarifa resultante es de <strong>' + fmtPesoPreciso(r.tarifaResultante) + '/kWh</strong> y el adicional por kWh es de <strong>' + fmtPesoPreciso(r.diferenciaTarif) + '/kWh</strong>.</p>';
        e += '<p>Por lo tanto, el ' + (d.tipo.clase === 'contribucion' ? 'cobro adicional' : 'ajuste adicional') + ' corresponde a <strong>' + fmtPesoDecimal(r.cobroAdicional) + '</strong>.</p>';
      }
    } else {
      e += '<p>El consumo facturado fue de <strong>' + fmtKwh(d.consumo) + ' kWh</strong>, que <strong>no supera</strong> el límite del 110 % (' + fmtKwh(r.limite110) + ' kWh). No existe excedente sobre el 110 %.</p>';
      if (d.consumo > r.metaCiclo) {
        e += '<p>Aunque el consumo <strong>sí superó la meta del ciclo</strong> (' + fmtKwh(r.metaCiclo) + ' kWh), <strong>no superó el 110 %</strong>, por lo que no se genera ajuste adicional.</p>';
      }
      const verbo = d.tipo.clase === 'contribucion' ? 'cobro adicional' : 'ajuste adicional';
      e += '<p>Su clasificación tarifaria es <strong>' + d.tipo.claseNombre + '</strong> (' + d.tipo.claseDetalle + '). Al no superar el límite, no se genera ' + verbo + ': el valor es <strong>$ 0</strong>.</p>';
    }
    if (sol.aplica) {
      e += r.hayExcedente
        ? '<p>Sobre ese cobro adicional se aplica la <strong>contribución del ' + fmtPct(sol.tasa) + '</strong>: <strong>' + fmtPesoDecimal(aporte) + ' × 0,20 = ' + fmtPesoDecimal(sol.monto) + '</strong>. No se calcula sobre el valor total del consumo.</p>'
        : '<p>Como no hubo cobro adicional, la <strong>contribución del ' + fmtPct(sol.tasa) + '</strong> es <strong>$ 0</strong>.</p>';
    } else {
      e += '<p>Su clasificación no paga la <strong>contribución del ' + fmtPct(sol.tasa) + '</strong> sobre la penalización.</p>';
    }
    e += '<p>La <strong>penalización final</strong> es <strong>' + fmtPesoDecimal(penalizacionFinal) + '</strong>' +
      (sol.aplica
        ? (r.hayExcedente
          ? ': ' + fmtPesoDecimal(aporte) + ' de cobro adicional + ' + fmtPesoDecimal(sol.monto) + ' de contribución del 20 % (equivale a multiplicar el cobro por 1,20).'
          : ': su clasificación paga el 20 %, pero al no haber cobro adicional el monto es $ 0.')
        : ' (solo el cobro adicional: su clasificación no paga el 20 %).') +
      '</p>';
    explicacion.innerHTML = e;
  }
}

function calcular(opts) {
  opts = opts || {};
  const d = leerYValidar();

  if (d.errores.length) {
    mostrarError(d.errores);
    el('resultados').hidden = true;
    el('resultsEmpty').hidden = false;
    ['copy', 'printBtn'].forEach(function (id) { const b = el(id); if (b) b.disabled = true; });
    if (!opts.silent) {
      const foco = el(d.malos[0]) || el('errorBox');
      if (foco) foco.focus({ preventScroll: true });
    }
    return;
  }

  ocultarError();
  pintarResultados(d);

  el('resultsEmpty').hidden = true;
  el('resultados').hidden = false;
  ['copy', 'printBtn'].forEach(function (id) { const b = el(id); if (b) b.disabled = false; });
  actualizarEnVivo();
  renderIcons();

  /* Rango del slider de consumo */
  const range = el('consumoRange');
  if (range) {
    const lim = ultimoCalculo.limite110;
    range.max = Math.ceil(Math.max(lim * 1.5, d.consumo * 1.2, 100));
    /* El slider debe reflejar el consumo escrito, aunque supere el máximo anterior. */
    range.value = Math.min(d.consumo, parseFloat(range.max));
    pintarRango(range);
  }

  if (!opts.silent) {
    const dest = el('resultados');
    if (dest) dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function hayResultados() {
  const r = el('resultados');
  return r && !r.hidden;
}
function refrescar() {
  actualizarEnVivo();
  if (hayResultados()) calcular({ silent: true });
}

/* ---------------------- Sliders ---------------------- */
function pintarRango(range) {
  const min = parseFloat(range.min) || 0;
  const max = parseFloat(range.max) || 100;
  const v = parseFloat(range.value) || 0;
  const pct = max > min ? ((v - min) / (max - min)) * 100 : 0;
  range.style.setProperty('--fill', pct + '%');
}

/* ---------------------- Acciones ---------------------- */
function copiarResumen() {
  if (!ultimoCalculo) return;
  const c = ultimoCalculo;
  const texto =
    'ISES - RESUMEN DEL AJUSTE DE FACTURA\n' +
    '----------------------------------------\n' +
    'Meta diaria: ' + fmtKwh(c.metaDiaria) + ' kWh/día\n' +
    'Días facturados: ' + c.dias + '\n' +
    'Meta del ciclo: ' + fmtKwh(c.metaCiclo) + ' kWh\n' +
    'Límite 110 %: ' + fmtKwh(c.limite110) + ' kWh\n' +
    'Consumo facturado: ' + fmtKwh(c.consumo) + ' kWh\n' +
    'Excedente sobre el 110 %: ' + fmtKwh(c.excedente) + ' kWh\n' +
    'Tipo de usuario: ' + c.tipoNombre + '\n' +
    'Clasificación: ' + c.claseNombre + ' (' + c.claseDetalle + ')\n' +
    'Factor: ' + fmtFactor(c.factor) + '\n' +
    'Porcentaje adicional: ' + fmtPct(c.porcentaje) + '\n' +
    'Tarifa regulada: ' + fmtPesoPreciso(c.tarifa) + '/kWh\n' +
    (c.subsidio > 0
      ? 'Subsidio por kWh: − ' + fmtPesoPreciso(c.subsidio) + '/kWh\n' +
        'Tarifa después del subsidio: ' + fmtPesoPreciso(c.tarifaNeta) + '/kWh\n'
      : '') +
    'Adicional por kWh (' + fmtPct(c.porcentaje) + '): ' + fmtPesoPreciso(c.diferenciaTarif) + '/kWh\n' +
    (c.hayExcedente ? 'Tarifa resultante: ' + fmtPesoPreciso(c.tarifaResultante) + '/kWh\n' : '') +
    '----------------------------------------\n' +
    'COBRO ADICIONAL (PENALIZACIÓN): ' + fmtPesoDecimal(c.aporte) + '\n' +
    'Cálculo: ' + fmtDecimal(c.excedente, 2) + ' kWh × $ ' + fmtNumPreciso(c.diferenciaTarif) + '/kWh\n' +
    (c.contribucion20.aplica && c.hayExcedente
      ? 'Contribución del 20 % sobre la penalización: ' + fmtPesoDecimal(c.contribucion20.monto) + '\n' +
        'PENALIZACIÓN FINAL (cobro × 1,20): ' + fmtPesoDecimal(c.penalizacionFinal) + '\n'
      : 'Contribución del 20 %: no aplica\n' +
        'PENALIZACIÓN FINAL: ' + fmtPesoDecimal(c.penalizacionFinal) + '\n') +
    '----------------------------------------';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto)
      .then(function () { mostrarToast('Resumen copiado al portapapeles', 'ok'); })
      .catch(function () { copiarFallback(texto); });
  } else {
    copiarFallback(texto);
  }
}
function copiarFallback(texto) {
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); mostrarToast('Resumen copiado al portapapeles', 'ok'); }
  catch (e) { mostrarToast('No se pudo copiar', 'err'); }
  document.body.removeChild(ta);
}
function imprimir() { window.print(); }

function mostrarToast(msg, tipo) {
  const t = el('toast');
  if (!t) return;
  const ic = tipo === 'err' ? 'x' : (tipo === 'ok' ? 'check' : 'info');
  t.innerHTML = icon(ic) + '<span></span>';
  t.querySelector('span').textContent = msg;
  t.classList.toggle('toast--ok', tipo === 'ok');
  t.classList.toggle('toast--err', tipo === 'err');
  t.classList.add('is-visible');
  renderIcons();
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(function () { t.classList.remove('is-visible'); }, 2600);
}

/* Aplica una meta de referencia tocada desde el modal de metas de referencia.
   Escribe el valor en el campo "Meta diaria (kWh)", lo marca como válido, lo enfoca y
   recalcula en vivo (panel hero y resultados si están visibles). */
function aplicarMetaRef(valor, meta) {
  const input = el('meta');
  if (!input) return;
  input.value = valor;
  input.removeAttribute('aria-invalid');
  input.focus({ preventScroll: true });
  refrescar();
  mostrarToast('Meta aplicada: ' + meta + ' → ' + valor + ' kWh/día', 'ok');
  renderIcons();
}

/* ---------------------- Exponer al DOM ---------------------- */
window.calcular = calcular;
window.aplicarMetaRef = aplicarMetaRef;
window.copiarResumen = copiarResumen;
window.imprimir = imprimir;
window.mostrarToast = mostrarToast;

/* ---------------------- Inicialización ---------------------- */
(function initTipos() {
  const cont = el('types');
  if (cont) {
    cont.innerHTML = TIPOS.map(function (t) {
      const c = CLASES[t.clase];
      return '<label class="seg__item seg__item--' + t.clase + '">' +
        '<input type="radio" name="tipo" value="' + t.id + '" class="sr-only seg__input"' + (t.id === 'e123' ? ' checked' : '') + '>' +
        '<span class="seg__body">' +
        '<span class="seg__icon seg__icon--' + t.clase + '">' + icon(t.ic) + '</span>' +
        '<span class="seg__text">' +
        '<span class="seg__title">' + t.name + '<span class="seg__tag seg__tag--' + t.clase + '">' + c.nombre + '</span></span>' +
        '<span class="seg__sub">' + t.sub + '</span>' +
        '</span>' +
        '<span class="seg__factor">' + numFactor(t.f) + ' · ' + fmtPct((t.f - 1) * 100) + '</span>' +
        '<span class="seg__check">' + icon('check-circle-2') + '</span>' +
        '</span></label>';
    }).join('');
  }

  const cards = el('typeCards');
  if (cards) {
    cards.innerHTML = TIPOS.map(function (t) {
      const c = CLASES[t.clase];
      return '<button type="button" class="profile profile--' + t.clase + (t.id === 'e123' ? ' is-active' : '') + '" data-type="' + t.id + '">' +
        '<span class="profile__top"><span class="profile__icon">' + icon(t.ic) + '</span>' +
        '<span class="profile__badge">' + icon('check-circle-2') + '</span></span>' +
        '<span class="profile__name">' + t.name + '</span>' +
        '<span class="profile__sub">' + t.sub + '</span>' +
        '<span class="profile__factor">' + numFactor(t.f) + '<span>· ' + fmtPct((t.f - 1) * 100) + '</span></span>' +
        '<span class="clase__tag clase__tag--' + t.clase + '">' + c.nombre + '</span>' +
        '</button>';
    }).join('');
    cards.querySelectorAll('.profile').forEach(function (card) {
      card.addEventListener('click', function () { seleccionarTipo(card.dataset.type); });
    });
  }

  renderIcons();
})();

/* El campo de subsidio solo tiene sentido en los estratos 1, 2 y 3. */
function actualizarCampoSubsidio() {
  const g = el('subsidioGroup');
  if (!g) return;
  const tipo = obtenerTipoSeleccionado();
  const esSubsidio = !!(tipo && tipo.clase === 'subsidio');
  g.classList.toggle('is-hidden', !esSubsidio);
  const f = el('subsidio');
  if (f) f.disabled = !esSubsidio;
}

function seleccionarTipo(id) {
  const radio = document.querySelector('#types input[name="tipo"][value="' + id + '"]');
  if (radio) radio.checked = true;
  document.querySelectorAll('#typeCards .profile').forEach(function (c) {
    c.classList.toggle('is-active', c.dataset.type === id);
  });
  actualizarCampoSubsidio();
  refrescar();
}

(function initInteracciones() {
  /* Enter calcula */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') {
      calcular();
    }
  });

  /* Sincronización slider ↔ campo (consumo) */
  const input = el('consumo');
  const range = el('consumoRange');
  if (input && range) {
    input.addEventListener('input', function () {
      const v = parseNumero(input.value);
      if (!isNaN(v) && v >= 0) range.value = Math.min(v, parseFloat(range.max) || v);
      pintarRango(range);
      refrescar();
    });
    range.addEventListener('input', function () {
      input.value = range.value;
      pintarRango(range);
      refrescar();
    });
    pintarRango(range);
  }

  /* Cambio de perfil desde el selector segmentado */
  const tipos = el('types');
  if (tipos) {
    tipos.addEventListener('change', function (e) {
      if (!e.target || e.target.name !== 'tipo') return;
      actualizarCampoSubsidio();
      refrescar();
    });
  }

  /* Campos restantes */
  ['meta', 'dias', 'tarifa', 'subsidio'].forEach(function (id) {
    const f = el(id);
    if (f) f.addEventListener('input', refrescar);
  });

  /* Restablecer */
  const reset = el('resetBtn');
  if (reset) {
    reset.addEventListener('click', function () {
      el('meta').value = '5,77';
      el('dias').value = '30';
      el('consumo').value = '421,53';
      el('tarifa').value = '873,6862';
      el('subsidio').value = '182,1255';
      seleccionarTipo('e123');
      ['meta', 'dias', 'consumo', 'tarifa', 'subsidio'].forEach(function (id) { el(id).removeAttribute('aria-invalid'); });
      ocultarError();
      el('resultados').hidden = true;
      el('resultsEmpty').hidden = false;
      ['copy', 'printBtn'].forEach(function (id) { const b = el(id); if (b) b.disabled = true; });
      actualizarEnVivo();
      mostrarToast('Valores restablecidos', 'ok');
    });
  }
})();

/* ---------------------- Modal de tarifas de referencia (tabla flotante) ---------------------- */
(function initModalTarifas() {
  const overlay = el('modalTarifas');
  const btnAbrir = el('btnAbrirTarifas');
  const backdrop = overlay ? overlay.querySelector('[data-cerrar-modal]') : null;
  if (!overlay || !btnAbrir || !backdrop) return;

  let ultimoEnfocado = null;

  function abrirModal() {
    ultimoEnfocado = document.activeElement;
    overlay.dataset.open = 'true';
    overlay.setAttribute('aria-hidden', 'false');
    const primeraCelda = overlay.querySelector('.tarifa-cell');
    if (primeraCelda) primeraCelda.focus({ preventScroll: true });
    renderIcons();
  }
  function cerrarModal() {
    overlay.dataset.open = 'false';
    overlay.setAttribute('aria-hidden', 'true');
    if (ultimoEnfocado) ultimoEnfocado.focus({ preventScroll: true });
  }

  btnAbrir.addEventListener('click', abrirModal);

  /* Cierre por clic fuera del recuadro + tocar una celda: aplicar meta y cerrar */
  overlay.addEventListener('click', function (e) {
    /* Clic fuera del recuadro: cerrar */
    if (e.target === overlay || e.target === backdrop) { cerrarModal(); return; }
    const cell = e.target.closest('.tarifa-cell');
    if (cell) {
      e.preventDefault();
      aplicarMetaRef(cell.dataset.valor, cell.dataset.tarifa || '');
      cerrarModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.dataset.open === 'true') cerrarModal();
  });
})();

/* Estado inicial en vivo */
actualizarCampoSubsidio();
actualizarEnVivo();

/* El monto del hero vuelve a contar desde cero cada vez que la tarjeta entra en pantalla */
(function initContadorHero() {
  const elMonto = el('heroAmount');
  if (!elMonto) return;

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  const tarjeta = elMonto.closest('.meter-card') || elMonto;
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      const st = _montos.get(elMonto) || { valor: 0, raf: 0 };
      cancelarMonto(elMonto);
      st.valor = 0;
      st.raf = 0;
      _montos.set(elMonto, st);
      elMonto.textContent = '$ 0';
      animarMonto(elMonto, objetivoHero, 1200);
    });
  }, { rootMargin: '-12% 0px -12% 0px', threshold: 0 });

  io.observe(tarjeta);
})();
