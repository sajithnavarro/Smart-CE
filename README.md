# ISES · Central de Escritos — Calculadora de ajustes de factura

Herramienta informativa para calcular el ajuste de una factura de energía sobre el **110 %** de la meta individual del ciclo y estimar el cargo adicional, la **contribución del 20 % sobre la penalización** y la **penalización final**, según el tipo de usuario y su **clasificación tarifaria: subsidio o contribución**.

## Subsidio y contribución

La calculadora aplica los casos del «Programa transitorio de ahorro de energía», con la corrección sobre los estratos 5 y 6:

| Caso | Usuarios | Factor | Porcentaje adicional |
| --- | --- | --- | --- |
| 1 · Subsidio | Estratos 1, 2 y 3 | 1,30 | 30 % |
| 2 · Contribución | Estratos 5 y 6 | 1,50 | 50 % |
| 2 · Contribución | Comercial e industrial | 1,70 | 70 % |

- El factor se liquida solo sobre el consumo que supera el **110 %** de la meta del ciclo.
- **Subsidio (estratos 1, 2 y 3):** el subsidio en `$/kWh` se descuenta **primero** de la tarifa regulada y el **30 %** se aplica sobre la **tarifa después del subsidio**, nunca sobre la tarifa completa. La calculadora pide ese subsidio en el campo «Subsidio aplicado ($/kWh)», visible solo para este perfil.
- **Estrato 4:** la presentación del programa no lo clasifica como subsidio ni como contribución. La calculadora conserva el factor **1,50** que ya traía y lo muestra como «sin subsidio ni contribución» para no confundirlo con los casos del programa. Es el mismo factor de los estratos 5 y 6.
- Cada resultado indica la clasificación, el porcentaje adicional y el nombre del monto (aporte por subsidio, contribución adicional o ajuste adicional).

### Liquidación del subsidio (caso de la presentación)

```
Paso 1  Tarifa después del subsidio = 873,6862 − 182,1255 = 691,5607 $/kWh
Paso 2  Adicional por kWh           = 691,5607 × 0,30     = 207,46821 $/kWh
Paso 3  Aporte adicional            = 231,12 kWh × 207,46821 = $ 47.950,05
```

- Se usa el **30 % adicional (0,30)**, no el factor completo (1,30).
- La web muestra estos tres pasos en la tarjeta **«Liquidación paso a paso»** y en la sección **«Subsidio y contribución»**.
- Si el subsidio es igual o mayor que la tarifa, la validación impide calcular (la tarifa neta no puede ser negativa).

### Excedente sobre el 110 %

Es la **única base del cobro adicional**: la energía que supera el **110 %** de la meta del ciclo. El consumo se divide en tres tramos:

| Tramo | Rango | ¿Genera cobro? |
| --- | --- | --- |
| Meta del ciclo (MIC) | de 0 a `meta diaria × días` | No |
| Franja neutral | del 100 % al 110 % de la MIC | No |
| Excedente | por encima del 110 % de la MIC | Sí, con el porcentaje adicional del perfil |

```
MIC       = meta diaria × días del ciclo
Límite    = MIC × 1,10
Excedente = max(0, consumo facturado − límite)
```

- El excedente **nunca es negativo**: si el consumo no supera el límite, vale 0 y no hay cobro adicional ni contribución del 20 %.
- El porcentaje adicional se aplica **solo** al excedente, nunca al consumo total. Ejemplo del caso base: meta 173,10 kWh, límite 190,41 kWh, consumo 421,53 kWh → excedente `421,53 − 190,41 = 231,12 kWh`.

### Contribución del 20 % sobre la penalización

La presentación, caso 2, aplica el 20 % **sobre el cobro adicional**, no sobre el valor total del consumo:

| Concepto | Base | Quién paga | Tasa |
| --- | --- | --- | --- |
| Cobro adicional | `excedente × tarifa × (factor − 1)` | Según el factor del programa | 30 % / 50 % / 70 % |
| Contribución del 20 % | Cobro adicional | Estratos 5 y 6, comercial e industrial | 20 % |
| Penalización final | Cobro adicional + contribución | Quien paga la contribución | × 1,20 |

- Se calcula automáticamente al elegir un perfil con contribución y aparece en la tarjeta **«Contribución del 20 % sobre la penalización»**.
- La contribución se **suma** al cobro adicional en la tarjeta **«Penalización final»**: `penalización final = cobro adicional + contribución del 20 %`, equivalente a `cobro adicional × 1,20`.
- Los estratos 1, 2 y 3 no la pagan (son usuarios subsidiados). El estrato 4 tampoco aporta. Si no hay excedente, no hay cobro adicional y la penalización final es $ 0.
- Ejercicio 2 del material (comercial e industrial, F 1,70): `168 kWh × $ 800 × 0,70 = $ 94.080`; `$ 94.080 × 1,20 = $ 112.896`. Con el factor 1,50 de los estratos 5 y 6 el mismo ejercicio da `168 × 800 × 0,50 = $ 67.200`; `× 1,20 = $ 80.640`.
- La tasa vive en una sola constante (`TASA_CONTRIBUCION` en `js/calculo.js`) y `calcularContribucion20()` acepta una tasa alternativa, por si el programa cambia el porcentaje.
- La penalización final se calcula con `calcularPenalizacionFinal(aporte, contribución)`, que redondea a 2 decimales y descarta valores negativos.

## Estructura del proyecto

```
smart-ce/
├── index.html            # Marcado y estructura de la página
├── assets/
│   └── img/
│       └── logo-central-de-escritos-ises.png # Símbolo ISES (PNG con transparencia) — usado en la interfaz
├── css/
│   └── style.css         # Sistema de diseño completo (tokens, componentes, estados, responsive)
├── js/
│   ├── calculo.js        # Lógica de negocio: cálculo, validación, resultados y panel en vivo
│   └── main.js           # Interfaz: tema, navegación, menú móvil y animaciones de entrada
└── README.md
```

La separación es intencional: `calculo.js` contiene la lógica del dominio (sin decisiones de presentación más allá del render de resultados) y `main.js` el comportamiento de la interfaz.

## Cómo usar

1. Abra `index.html` directamente en cualquier navegador moderno. No requiere servidor ni compilación.
2. Reemplace los valores de ejemplo por los de su factura y presione **Calcular ajuste**.
3. Junto al campo «Meta diaria (kWh)» toca el ícono de tabla para abrir la **tabla flotante de metas de referencia** del programa (columnas R, U y Total general). Selecciona cualquier valor numérico para aplicarlo a la meta diaria y recalcular al instante; el modal se cierra solo y aparece un aviso (toast) confirmando la aplicación. Clic fuera, el botón X o la tecla Escape también cierran el modal.

Los valores precargados reproducen el caso de la presentación —tarifa `873,6862`, subsidio `182,1255`, consumo `421,53`— y arrojan un aporte de **$ 47.950,05**.

Los scripts se cargan como `<script src>` normales (no módulos ES), por lo que funcionan también desde `file://`.

## Sistema de diseño

- **Tipografía:** `Sora` para interfaz y titulares, `IBM Plex Mono` para cifras (con `tabular-nums`).
- **Color:** identidad verde de ISES. El verde se usa como color de marca (botones, acentos, iconos, gráficos) y en superficies; el texto se mantiene oscuro en modo claro y claro en modo oscuro.
- **Tokens:** todas las decisiones viven como variables CSS en `:root` y en `[data-theme="dark"]` (superficies, texto, bordes, marca, estados, radios y sombras).
- **Componentes:** botones, tarjetas, campos, selector segmentado, chips, panel de resumen, avisos, estado vacío y toast comparten el mismo lenguaje visual y sus estados (hover, foco, activo, deshabilitado).
- **Responsive:** un solo diseño que se adapta; en móvil el menú colapsa y las rejillas pasan a una columna.
- **Accesibilidad:** foco visible, etiquetas y `aria-*`, contraste suficiente, información no dependiente solo del color y respeto por `prefers-reduced-motion`.

## Dependencias (CDN)

- **Lucide** — única librería externa de interfaz (iconos).
- **Google Fonts** — tipografías.

No se usa ninguna otra librería: el gráfico de barras es **SVG/CSS propio**, y las animaciones de entrada usan `IntersectionObserver`.

## Estados de la interfaz

- **Vacío:** la columna de resultados explica cómo empezar antes del primer cálculo.
- **Error:** validación por campo, con mensaje claro y sin jerga técnica.
- **Éxito / resultado:** desglose paso a paso, gráfico comparativo, resumen y explicación redactada.

## Notas

- Los resultados son estimados y no reemplazan la factura oficial.
- El tema claro/oscuro se detecta del sistema, se puede alternar y se recuerda en `localStorage`.
- El cálculo es local; no se envían datos a ningún servidor.

## Criterios numéricos

- **Formatos aceptados:** `5,77` y `5.77` se leen como 5,77; `1.200` y `1200` se leen como 1.200. Con ambos separadores (`1.234,56` o `1,234.56`) el último se toma como decimal.
- **Precisión:** no hay redondeos intermedios en la meta ni en el límite; solo el cobro adicional y los montos finales se redondean a 2 decimales. Un umbral de 1e-9 kWh descarta el ruido de coma flotante cuando el consumo es igual al límite.
- **Fórmula:** `excedente = max(0, consumo − meta_diaria × días × 1,10) (sin redondear)`; `tarifa_neta = tarifa − subsidio`; `cobro = excedente × tarifa_neta × (factor − 1)`; `penalización final = cobro + 20 % del cobro` (solo estratos 5 y 6, comercial e industrial). Los resultados se redondean a 2 decimales.
- **Subsidio:** `calcularAjuste()` recibe un sexto parámetro opcional `subsidio` (por defecto `0`), de modo que la contribución y los cálculos anteriores conservan exactamente su resultado.
- **Factor por clasificación:** subsidio (estratos 1–3) `1,30` → 30 %; contribución estratos 5 y 6 `1,50` → 50 %; contribución comercial e industrial `1,70` → 70 %; estrato 4 `1,50` → 50 % (valor conservado, no definido en la presentación).
- **Alcance:** no se aplica el límite del CRO ni otras particularidades tarifarias; por eso el resultado es una estimación.

## Pruebas

La lógica de cálculo tiene una batería de pruebas con el runner nativo de Node:

```bash
node --test tests/calculo.test.js
```

Incluye formatos numéricos, el caso base, los cuatro perfiles, la clasificación de subsidio y contribución, la liquidación del subsidio paso a paso (873,6862 / 182,1255 / 421,53), la contribución del 20 % sobre la penalización (ejercicio 2 con F 1,70: $ 94.080 → $ 112.896; con F 1,50: $ 67.200 → $ 80.640), la penalización final, el borde del 110 %, más de 50.000 combinaciones de borde y 20.000 casos aleatorios con invariantes numéricas.
