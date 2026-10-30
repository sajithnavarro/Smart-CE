'use strict';

/* =========================================================================
   Pruebas de la lógica de cálculo de ISES · Central de Escritos.
   Ejecutar con:  node --test tests/calculo.test.js
   ========================================================================= */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ruta = path.join(__dirname, '..', 'js', 'calculo.js');
const fuente = fs.readFileSync(ruta, 'utf8');
const inicio = fuente.indexOf('function parseNumero');
const fin = fuente.indexOf('let ultimoCalculo');

if (inicio === -1 || fin === -1 || fin <= inicio) {
  throw new Error('No se pudo extraer la lógica pura de js/calculo.js');
}

const contexto = {};
vm.createContext(contexto);
/* Las declaraciones const (CLASES, TIPOS, TIPO_MAP) no se cuelgan del objeto
   global del contexto; se exportan explícitamente para poder verificarlas. */
vm.runInContext(
  fuente.slice(inicio, fin) +
  ';globalThis.__expo = { CLASES: CLASES, TIPOS: TIPOS, TIPO_MAP: TIPO_MAP, etiquetaAporte: etiquetaAporte,' +
  ' TASA_CONTRIBUCION: TASA_CONTRIBUCION, calcularContribucion20: calcularContribucion20,' +
  ' calcularPenalizacionFinal: calcularPenalizacionFinal };',
  contexto
);

const parseNumero = contexto.parseNumero;
const redondear = contexto.redondear;
const calcularAjuste = contexto.calcularAjuste;
const expo = contexto.__expo;

const casiIgual = (a, b, tolerancia = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tolerancia, 'Se esperaba ' + b + ' y se obtuvo ' + a);

test('parseNumero acepta formatos colombianos, punto decimal y miles', () => {
  const casos = [
    ['5,77', 5.77],
    ['5.77', 5.77],
    ['1.200', 1200],
    ['1200', 1200],
    ['1,200', 1.2],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234.567', 1234567],
    ['1,234,567', 1234567],
    ['$ 780', 780],
    ['780 COP', 780],
    ['230 kWh', 230],
    ['0.500', 0.5],
    ['12.345', 12345],
    ['1234.567', 1234.567],
    [' 190,41 ', 190.41],
    ['-5,5', -5.5],
    ['+5,5', 5.5],
    ['-1.200', -1200],
    ['5,', 5],
    ['.5', 0.5]
  ];

  for (const [entrada, esperado] of casos) {
    casiIgual(parseNumero(entrada), esperado);
  }
});

test('parseNumero rechaza entradas inválidas', () => {
  for (const entrada of ['', '   ', 'abc', '5,77abc', '1..200', '1.2.3', '1,2,3', '1.234.56', ',', undefined, null]) {
    assert.ok(Number.isNaN(parseNumero(entrada)), 'Debía ser NaN: ' + JSON.stringify(entrada));
  }
});

test('calcularAjuste reproduce el caso base y los tres factores', () => {
  const base = calcularAjuste(5.77, 30, 230, 780, 1.3);
  casiIgual(base.metaCiclo, 173.1);
  casiIgual(base.limite110, 190.41);
  casiIgual(base.excedente, 39.59);
  assert.equal(base.hayExcedente, true);
  casiIgual(base.cobroAdicional, 9264.06);

  casiIgual(calcularAjuste(5.77, 30, 230, 780, 1.5).cobroAdicional, 15440.1);
  casiIgual(calcularAjuste(5.77, 30, 230, 780, 1.7).cobroAdicional, 21616.14);
});

test('calcularAjuste cobra solo el excedente sobre el 110 %', () => {
  const bajo = calcularAjuste(5.77, 30, 100, 780, 1.3);
  assert.equal(bajo.hayExcedente, false);
  casiIgual(bajo.cobroAdicional, 0);

  const entreMetaY110 = calcularAjuste(5.77, 30, 180, 780, 1.3);
  assert.equal(entreMetaY110.hayExcedente, false);
  casiIgual(entreMetaY110.cobroAdicional, 0);

  const justoEnElLimite = calcularAjuste(4.1, 28, 126.28, 780, 1.3);
  assert.equal(justoEnElLimite.hayExcedente, false);
  casiIgual(justoEnElLimite.excedente, 0);

  const unCentesimoArriba = calcularAjuste(4.1, 28, 126.29, 780, 1.3);
  assert.equal(unCentesimoArriba.hayExcedente, true);
  casiIgual(unCentesimoArriba.excedente, 0.01);
  casiIgual(unCentesimoArriba.cobroAdicional, 2.34);
});

test('calcularAjuste interpreta correctamente las cifras con miles', () => {
  const consumo1200 = calcularAjuste(5.77, 30, parseNumero('1.200'), 780, 1.3);
  casiIgual(consumo1200.excedente, 1009.59);
  casiIgual(consumo1200.cobroAdicional, 236244.06);

  const meta1200 = calcularAjuste(parseNumero('1.200'), 30, 50000, 780, 1.3);
  casiIgual(meta1200.metaCiclo, 36000);
  casiIgual(meta1200.limite110, 39600);
  casiIgual(meta1200.cobroAdicional, 2433600);
});

test('calcularAjuste respeta la fórmula excedente × tarifa × (factor − 1)', () => {
  const r = calcularAjuste(5.77, 30, 230, 780.5, 1.3);
  casiIgual(r.cobroAdicional, redondear(r.excedente * 780.5 * (1.3 - 1), 2));
  casiIgual(r.cobroAdicional, 9270);
});

test('el borde del 110 % no produce falsos positivos por coma flotante', () => {
  let revisados = 0;

  for (let m = 1; m <= 6000; m++) {
    const meta = m / 100;
    for (const dias of [1, 2, 15, 28, 29, 30, 31, 35, 60]) {
      const base = calcularAjuste(meta, dias, 0, 780, 1.3);
      const enElLimite = calcularAjuste(meta, dias, base.limite110, 780, 1.3);
      assert.equal(enElLimite.hayExcedente, false, 'Falso positivo con meta=' + meta + ' días=' + dias);
      casiIgual(enElLimite.excedente, 0);

      const arriba = calcularAjuste(meta, dias, redondear(base.limite110 + 0.01, 2), 780, 1.3);
      assert.equal(arriba.hayExcedente, true, 'No detectó excedente con meta=' + meta + ' días=' + dias);
      revisados++;
    }
  }

  assert.ok(revisados > 50000, 'Se esperaban más de 50.000 combinaciones');
});

test('fuzz: invariantes numéricas en 20.000 combinaciones', () => {
  let semilla = 123456789;
  const aleatorio = () => {
    semilla = (semilla * 1664525 + 1013904223) >>> 0;
    return semilla / 4294967296;
  };
  const factores = [1.3, 1.5, 1.7];

  for (let i = 0; i < 20000; i++) {
    const meta = redondear(0.1 + aleatorio() * 100, 2);
    const dias = 1 + Math.floor(aleatorio() * 60);
    const consumo = redondear(aleatorio() * 5000, 2);
    const tarifa = redondear(100 + aleatorio() * 1900, 2);
    const factor = factores[Math.floor(aleatorio() * factores.length)];
    const r = calcularAjuste(meta, dias, consumo, tarifa, factor);

    assert.ok(Number.isFinite(r.metaCiclo) && r.metaCiclo > 0);
    assert.ok(Number.isFinite(r.limite110) && r.limite110 > 0);
    assert.ok(Number.isFinite(r.excedente) && r.excedente >= 0);
    assert.ok(Number.isFinite(r.cobroAdicional) && r.cobroAdicional >= 0);
    assert.ok(r.limite110 >= r.metaCiclo);
    assert.equal(r.hayExcedente, r.excedente > 0);
    casiIgual(r.cobroAdicional, redondear(r.excedente * tarifa * (factor - 1), 2), 0.02);
  }
});

test('redondear trabaja a dos decimales', () => {
  casiIgual(redondear(173.09999999999998, 2), 173.1);
  casiIgual(redondear(190.40999999999997, 2), 190.41);
  casiIgual(redondear(2.675, 2), 2.68);
});

/* ------------------------- Subsidio y contribución -------------------------
   Fuente: «Programa transitorio de ahorro de energía», con la corrección de
   la usuaria sobre los estratos 5 y 6.
   Caso 1 · Subsidio: estratos 1, 2 y 3 → F = 1,30 (30 % adicional).
   Caso 2 · Contribución: estratos 5 y 6 → F = 1,50 (50 % adicional);
                          comercial e industrial → F = 1,70 (70 % adicional).
   -------------------------------------------------------------------------- */

test('los tipos de usuario siguen los casos del programa', () => {
  const porId = {};
  expo.TIPOS.forEach((t) => { porId[t.id] = t; });

  assert.deepEqual(Object.keys(porId).sort(), ['ci', 'e123', 'e4', 'e56']);

  assert.equal(porId.e123.clase, 'subsidio');
  casiIgual(porId.e123.f, 1.3);

  assert.equal(porId.e56.clase, 'contribucion');
  casiIgual(porId.e56.f, 1.5);

  assert.equal(porId.ci.clase, 'contribucion');
  casiIgual(porId.ci.f, 1.7);

  /* La presentación no clasifica el estrato 4; se conserva el factor vigente. */
  assert.equal(porId.e4.clase, 'neutro');
  casiIgual(porId.e4.f, 1.5);
});

test('cada clasificación expone nombre, detalle y porcentaje adicional', () => {
  const sub = expo.TIPO_MAP.e123;
  assert.equal(sub.claseNombre, 'Subsidio');
  assert.equal(sub.claseDetalle, 'Estratos 1, 2 y 3');
  casiIgual(sub.factor, 1.3);
  casiIgual(sub.porcentaje, 30);

  /* Estratos 5 y 6: mismo factor que el estrato 4 (corrección de la usuaria). */
  const con = expo.TIPO_MAP.e56;
  assert.equal(con.claseNombre, 'Contribución');
  assert.equal(con.claseDetalle, 'Estratos 5 y 6 · Comercial e Industrial');
  casiIgual(con.factor, 1.5);
  casiIgual(con.porcentaje, 50);

  const ci = expo.TIPO_MAP.ci;
  assert.equal(ci.claseNombre, 'Contribución');
  casiIgual(ci.factor, 1.7);
  casiIgual(ci.porcentaje, 70);

  const neutro = expo.TIPO_MAP.e4;
  assert.equal(neutro.claseNombre, 'Sin subsidio ni contribución');
  casiIgual(neutro.porcentaje, 50);
});

test('subsidio y contribución liquidan sobre el excedente con su propio factor', () => {
  const args = [5.77, 30, 230, 780];

  const sub = calcularAjuste(args[0], args[1], args[2], args[3], expo.TIPO_MAP.e123.factor);
  casiIgual(sub.cobroAdicional, 9264.06);

  /* 39,59 kWh × 780 × 0,50 = 15.440,10 */
  const con56 = calcularAjuste(args[0], args[1], args[2], args[3], expo.TIPO_MAP.e56.factor);
  casiIgual(con56.cobroAdicional, 15440.1);

  /* 39,59 kWh × 780 × 0,70 = 21.616,14 */
  const conCI = calcularAjuste(args[0], args[1], args[2], args[3], expo.TIPO_MAP.ci.factor);
  casiIgual(conCI.cobroAdicional, 21616.14);
  assert.ok(conCI.cobroAdicional > con56.cobroAdicional);

  assert.ok(con56.cobroAdicional > sub.cobroAdicional);
});

test('etiquetaAporte nombra el monto según la clasificación', () => {
  assert.equal(expo.etiquetaAporte('subsidio', false), 'Aporte adicional (subsidio)');
  assert.equal(expo.etiquetaAporte('contribucion', false), 'Cobro adicional');
  assert.equal(expo.etiquetaAporte('neutro', false), 'Ajuste adicional');
  assert.equal(expo.etiquetaAporte('contribucion', true), 'Cobro adicional estimado');
  assert.equal(expo.etiquetaAporte('neutro', true), 'Ajuste adicional estimado');
});

/* --------------------- Contribución del 20 % sobre la penalización --------
   Presentación, caso 2: el 20 % se aplica sobre el cobro adicional.
   Ejercicio 2: 168 × 800 × 0,70 = 94.080; 94.080 × 1,20 = 112.896.
   -------------------------------------------------------------------------- */

test('la contribución es del 20 % del cobro adicional y solo aplica a contribución', () => {
  assert.equal(expo.TASA_CONTRIBUCION, 20);

  const con = expo.calcularContribucion20(94080, 'contribucion');
  assert.equal(con.aplica, true);
  assert.equal(con.tasa, 20);
  casiIgual(con.base, 94080);
  casiIgual(con.monto, 18816);

  for (const clase of ['subsidio', 'neutro']) {
    const r = expo.calcularContribucion20(94080, clase);
    assert.equal(r.aplica, false);
    casiIgual(r.monto, 0);
    casiIgual(r.base, 94080);
  }
});

test('la base de la contribución es el cobro adicional, redondeado a 2 decimales', () => {
  const r = expo.calcularContribucion20(926001.2377459, 'contribucion');
  casiIgual(r.base, 926001.24);
  casiIgual(r.monto, redondear(r.base * 0.2, 2));

  const cero = expo.calcularContribucion20(0, 'contribucion');
  casiIgual(cero.base, 0);
  casiIgual(cero.monto, 0);

  const negativos = expo.calcularContribucion20(-5000, 'contribucion');
  casiIgual(negativos.base, 0);
  casiIgual(negativos.monto, 0);
});

test('la tasa de la contribución es parametrizable', () => {
  const r = expo.calcularContribucion20(100000, 'contribucion', 10);
  casiIgual(r.base, 100000);
  casiIgual(r.monto, 10000);
  assert.equal(r.tasa, 10);
});

test('el ejercicio 2 del material reproduce el cobro y la penalización final', () => {
  /* MID 4 kWh/día · 30 días · consumo 300 kWh · tarifa 800 · F 1,7 · 20 %
     Corresponde al perfil comercial e industrial. */
  const r = calcularAjuste(4, 30, 300, 800, 1.7);
  casiIgual(r.metaCiclo, 120);
  casiIgual(r.limite110, 132);
  casiIgual(r.excedente, 168);
  casiIgual(r.diferenciaTarif, 560);
  casiIgual(r.cobroAdicional, 94080);

  const c = expo.calcularContribucion20(r.cobroAdicional, 'contribucion');
  casiIgual(c.monto, 18816);
  casiIgual(expo.calcularPenalizacionFinal(r.cobroAdicional, c.monto), 112896);
});

test('el ejercicio 2 con el factor 1,50 de los estratos 5 y 6', () => {
  /* Mismo ejercicio, pero con el factor corregido para 5 y 6:
     168 × 800 × 0,50 = 67.200; 67.200 × 1,20 = 80.640. */
  const r = calcularAjuste(4, 30, 300, 800, expo.TIPO_MAP.e56.factor);
  casiIgual(r.excedente, 168);
  casiIgual(r.diferenciaTarif, 400);
  casiIgual(r.cobroAdicional, 67200);

  const c = expo.calcularContribucion20(r.cobroAdicional, 'contribucion');
  casiIgual(c.monto, 13440);
  casiIgual(expo.calcularPenalizacionFinal(r.cobroAdicional, c.monto), 80640);
});

test('la contribución no se calcula sobre el consumo total', () => {
  const r = calcularAjuste(5.77, 30, 421.53, 873.6862, 1.7);
  const c = expo.calcularContribucion20(r.cobroAdicional, 'contribucion');

  casiIgual(c.base, r.cobroAdicional);
  casiIgual(c.monto, redondear(r.cobroAdicional * 0.2, 2));
  assert.notEqual(redondear(c.monto, 2), redondear(421.53 * 873.6862 * 0.2, 2));
});

/* --------------------- Liquidación del subsidio ---------------------------
   Caso de la presentación (estratos 1, 2 y 3):
       873,6862 − 182,1255 = 691,5607
       691,5607 × 0,30     = 207,46821
       231,12 × 207,46821  = 47.950,05
   El 30 % se aplica sobre la tarifa DESPUÉS del subsidio.
   -------------------------------------------------------------------------- */

test('el subsidio reproduce el caso de la presentación, paso a paso', () => {
  const r = calcularAjuste(5.77, 30, 421.53, 873.6862, 1.3, 182.1255);

  casiIgual(r.metaCiclo, 173.1);
  casiIgual(r.limite110, 190.41);
  casiIgual(r.excedente, 231.12);

  /* Paso 1: tarifa después del subsidio. */
  casiIgual(r.subsidioKwh, 182.1255);
  casiIgual(r.tarifaNeta, 691.5607, 1e-6);

  /* Paso 2: adicional por kWh = tarifa neta × 30 %. */
  casiIgual(r.diferenciaTarif, 207.46821, 1e-6);

  /* Paso 3: excedente × adicional por kWh. */
  casiIgual(r.cobroAdicional, 47950.05, 0.01);
});

test('el subsidio se descuenta antes del porcentaje y reduce el cobro', () => {
  const sinSubsidio = calcularAjuste(5.77, 30, 421.53, 873.6862, 1.3, 0);
  const conSubsidio = calcularAjuste(5.77, 30, 421.53, 873.6862, 1.3, 182.1255);

  casiIgual(conSubsidio.tarifaNeta, sinSubsidio.tarifaNeta - 182.1255, 1e-6);
  assert.ok(conSubsidio.cobroAdicional < sinSubsidio.cobroAdicional);

  /* La base del porcentaje es la tarifa neta, no la tarifa completa. */
  casiIgual(conSubsidio.diferenciaTarif, redondear(conSubsidio.tarifaNeta * 0.3, 5), 1e-6);
  assert.notEqual(
    redondear(conSubsidio.diferenciaTarif, 6),
    redondear(873.6862 * 0.3, 6)
  );
});

test('sin subsidio el resultado es idéntico al de la versión anterior', () => {
  const sinParametro = calcularAjuste(5.77, 30, 230, 780, 1.7);
  const conCero = calcularAjuste(5.77, 30, 230, 780, 1.7, 0);

  casiIgual(sinParametro.subsidioKwh, 0);
  casiIgual(sinParametro.tarifaNeta, 780);
  casiIgual(sinParametro.cobroAdicional, 21616.14);
  assert.deepEqual(sinParametro, conCero);
});

test('un subsidio igual o mayor que la tarifa no produce tarifas negativas', () => {
  const r = calcularAjuste(5.77, 30, 421.53, 873.6862, 1.3, 1000);
  casiIgual(r.tarifaNeta, 0);
  casiIgual(r.diferenciaTarif, 0);
  casiIgual(r.cobroAdicional, 0);
});

/* ----------------------- Penalización final -----------------------------
   Penalización final = cobro adicional + contribución del 20 %.
   -------------------------------------------------------------------------- */

test('la penalización final suma el cobro adicional y la contribución', () => {
  const r = calcularAjuste(5.77, 30, 421.53, 873.6862, 1.7);
  const c = expo.calcularContribucion20(r.cobroAdicional, 'contribucion');
  const final = expo.calcularPenalizacionFinal(r.cobroAdicional, c.monto);

  assert.ok(c.monto > 0);
  casiIgual(final, redondear(r.cobroAdicional + c.monto, 2));
  casiIgual(final, redondear(r.cobroAdicional * 1.2, 2), 0.01);
});

test('sin contribución la penalización final es el cobro adicional', () => {
  const r = calcularAjuste(5.77, 30, 421.53, 873.6862, 1.3, 182.1255);
  const c = expo.calcularContribucion20(r.cobroAdicional, 'subsidio');
  const final = expo.calcularPenalizacionFinal(r.cobroAdicional, c.monto);

  casiIgual(c.monto, 0);
  casiIgual(final, r.cobroAdicional);
});

test('sin excedente la penalización final es $ 0', () => {
  /* Consumo por debajo del límite del 110 % (190,41 kWh). */
  const r = calcularAjuste(5.77, 30, 150, 780, 1.7);
  const c = expo.calcularContribucion20(r.cobroAdicional, 'contribucion');
  const final = expo.calcularPenalizacionFinal(r.cobroAdicional, c.monto);

  casiIgual(r.cobroAdicional, 0);
  casiIgual(c.monto, 0);
  casiIgual(final, 0);
});

test('la penalización final se redondea a 2 decimales y no admite negativos', () => {
  assert.equal(expo.calcularPenalizacionFinal(21616.14, 4323.23), 25939.37);
  assert.equal(expo.calcularPenalizacionFinal(10.005, 0.005), 10.01);
  assert.equal(expo.calcularPenalizacionFinal(-50, 20), 20);
  assert.equal(expo.calcularPenalizacionFinal(NaN, undefined), 0);
});

test('meta y límite no se redondean: el excedente conserva toda la precisión', () => {
  /* 4,123 × 30 = 123,69 y × 1,10 = 136,059 (no 136,06). */
  const r = calcularAjuste(4.123, 30, 200, 780, 1.3);
  casiIgual(r.metaCiclo, 123.69);
  casiIgual(r.limite110, 136.059);
  casiIgual(r.excedente, 63.941);
  casiIgual(r.cobroAdicional, redondear(63.941 * 780 * 0.3, 2));
});
