# Portafolio — Andres Madrid

Portafolio con forma de escritorio de PC: cada icono abre una ventana que se
arrastra, se minimiza y se cierra. HTML, CSS y JavaScript puro — sin Node.js,
sin compilación, sin dependencias.

Publicado en **https://andresmadrid.vercel.app**.

## Archivos

| Archivo | Qué contiene |
|---|---|
| [`index.html`](index.html) | Arranque, escritorio, lanzador móvil, barra de tareas, portal y perfil en texto |
| [`styles.css`](styles.css) | Los estilos (chrome biselado, ventanas, iconos, impresión del CV) |
| [`script.js`](script.js) | La lógica (ventanas, idiomas, reloj, GitHub, portal, arranque, sonidos) |
| [`desktop.json`](desktop.json) | El escritorio publicado. Vacío = valores de fábrica. Lo reemplaza el portal |
| [`og.png`](og.png) | Imagen de 1200×630 para la vista previa al compartir el enlace |

> Deben quedar **en la misma carpeta**. El archivo se llama `index.html` a
> propósito: es el nombre que buscan Vercel, GitHub Pages y Netlify en la raíz.
> Si lo renombras, la web da 404.

## Cómo usarlo

- **Ver:** doble clic en `index.html`. Para que `desktop.json` se pueda leer
  hace falta un servidor: abriendo con `file://` esa petición falla y sale el
  escritorio de fábrica.
- **Previsualizar con servidor:** `.claude/launch.json` levanta uno en
  `http://localhost:4173`.
- **Publicar:** sube los archivos a cualquier hosting estático.

## Lo que ve una visita

1. **Pantalla de arranque** tipo BIOS, en cada visita. Unos dos segundos; se
   salta con cualquier tecla, clic o toque. Dice cuántos repos hay si GitHub
   responde a tiempo.
2. **Ventana de bienvenida**, solo la primera vez: quién eres y tres atajos
   (Proyectos, Sobre mí, Contacto). Se vuelve a abrir desde **Inicio →
   Bienvenida**. En el teléfono no sale: allí el lanzador ya explica cada cosa.
3. **El escritorio** (o el lanzador, en el teléfono).

## El escritorio

Cada icono es un elemento con un **tipo**, y **cada ventana se ve distinta por
dentro**:

| Tipo | Aspecto de la ventana |
|---|---|
| `txt` | Visor de texto: fondo negro, monoespaciado, titular en rojo |
| `folder` | Explorador con pestañas: una por subcarpeta, más "Todo" |
| `link` | No abre ventana: va a la dirección en otra pestaña |
| `app: projects` | Explorador con una pestaña por lenguaje, más "Todo" y "Con web" |
| `app: skills` | Panel de propiedades: grupos con lista de componentes |
| `app: education` | Vista de lista con columnas y cabecera fija |
| `app: cv` | Hoja de currículum generada con tus datos, con "Guardar como PDF" |
| `app: contact` | Cuadro de diálogo con icono y campos hundidos |
| `app: social` | Entorno de red: iconos grandes |
| `app: mypc` | Mi PC: datos del sistema y unidades que abren secciones |
| `app: trash` | Papelera: tus repos de GitHub archivados o bifurcados |

Al abrir un proyecto sale su **ficha**: arriba la imagen que GitHub genera para
cada repo, y debajo descripción, lenguaje, estrellas, fecha del último cambio y
los botones de código y web. La imagen se renueva sola cuando haces push.

Todas las ventanas llevan **barra de estado** abajo. Se arrastran por la barra de
título, se redimensionan por la esquina, se minimizan y se maximizan. **Recuerdan
su posición y tamaño** entre visitas (en `localStorage`).

**Teclado y lectores de pantalla:** cada ventana es un diálogo con su título,
el foco entra al abrirla y vuelve al icono al cerrarla, y **Esc** cierra lo que
esté arriba (panel, menú Inicio o ventana).

**Reloj:** siempre `America/Bogota`, no la hora del visitante (constante `TZ`).

**Sonidos:** el altavoz de la bandeja los enciende. Apagados por defecto; se
generan con Web Audio, sin archivos.

**Botón de LinkedIn:** en la barra de tareas, junto a Inicio.

## En el teléfono

En pantallas de 640 px o menos el escritorio se cambia por un **lanzador**: los
mismos elementos en lista, cada uno con una línea que dice qué hay dentro ("7
proyectos de GitHub", "Gmail, Outlook o copiar"). Las ventanas se abren a
pantalla completa con botón **Atrás**, y el botón atrás del teléfono también las
cierra en vez de salir del portafolio.

La segunda línea sale del campo `sub` de cada elemento en `DEFAULT_DESKTOP`; si
no lo tiene, se calcula según el tipo.

## Currículum

El icono **CV_Andres.pdf** abre una hoja generada con tus mismos datos: el texto
de Sobre mí, las habilidades, la educación y hasta 6 proyectos. Si cambias algo
en el portal, el CV cambia solo.

**Guardar como PDF** abre el diálogo de impresión con solo el CV (el resto de la
página no se imprime) y propone el nombre "CV - Andres Madrid".

Si prefieres un PDF hecho a mano: súbelo junto a `index.html` y pon su nombre en
la constante `CV_URL` de `script.js`. La ventana ofrecerá también descargarlo.

## Portal de administración

Se abre desde **Inicio → Panel de administración**. La clave **no está escrita
en ningún archivo** a propósito: el repositorio es público.

Cinco pestañas:

- **Iconos** — crear, editar, borrar y ordenar elementos. Para meter algo dentro
  de una carpeta, elígela en *Dentro de*. Al borrar una carpeta, sus hijos suben
  al escritorio en vez de desaparecer.
- **Fondo** — color liso, degradado o imagen por URL. Se ve al instante. También
  enciende o apaga el caza TIE y la Estrella de la Muerte.
- **Proyectos** — qué repos salen en Proyectos. Sin nada marcado, salen todos.
- **Habilidades** — grupos con sus tecnologías, separadas por coma.
- **Educación** — un bloque por estudio, en español e inglés.

Habilidades y educación salen en su ventana, en el CV y en la pantalla de
arranque.

Abajo, tres botones:

| Botón | Qué hace | Quién lo ve |
|---|---|---|
| **Guardar** | Escribe la config en `localStorage` | Solo tú, en ese navegador |
| **Descargar desktop.json** | Baja el archivo | Todos, **cuando lo subas al repo** |
| **Restablecer** | Borra tus cambios locales y vuelve al escritorio de fábrica | — |

Para publicar tus cambios: *Descargar desktop.json*, reemplaza el
`desktop.json` del repositorio por ese y súbelo.

> Si guardaste algo en el portal antes de que existieran Mi PC, la Papelera o el
> CV, tu navegador sigue mostrando tu versión guardada. Pulsa **Restablecer**
> para ver los iconos nuevos.

**Aviso de seguridad:** la clave solo evita que un curioso abra el panel. No es
seguridad real — `script.js` es público y cualquiera puede leerlo, o abrir el
panel desde las herramientas de desarrollo. Es aceptable porque el panel no
puede cambiar lo que ven las visitas: para eso hace falta subir `desktop.json`
a tu repositorio, y eso solo lo puedes hacer tú. No uses ahí una clave que
reutilices en otra cuenta.

Cambiar la clave: en la consola del navegador ejecuta `await hashText("nueva")`
y pega el resultado en la constante `ADMIN_HASH` de `script.js`. No escribas la
clave en ningún archivo del repositorio.

## Proyectos automáticos

La ventana **Proyectos** pide tus repos a la API pública de GitHub y arma la
lista sola, ordenada por el último push. Los forks y los archivados no salen ahí:
van a la **Papelera**. La respuesta se guarda 1 hora en `localStorage` para no
gastar el límite (60 peticiones/hora sin token).

Para que un repo se vea bien: ponle **descripción**, **topics** y, si está
desplegado, la **Website** (aparece como botón *Ver web*).

> Solo lee repos **públicos**. Al ser un sitio estático, cualquier token que
> pongas en `script.js` quedaría a la vista de todo el mundo — para ver repos
> privados haría falta un backend.

## Buscadores y enlaces compartidos

- **Vista previa al compartir:** etiquetas Open Graph y Twitter en el `<head>`,
  con `og.png` de imagen. Al pegar el enlace en LinkedIn, WhatsApp o X sale una
  tarjeta con imagen, título y descripción. Si cambias el diseño, vuelve a hacer
  la captura a 1200×630 y reemplaza `og.png`.
- **Perfil en texto:** `index.html` trae un `<article id="seo-profile">` con tu
  perfil, habilidades, educación, proyectos y contacto. Está oculto a la vista
  pero lo leen buscadores y lectores de pantalla, y **se ve si el navegador no
  tiene JavaScript** (en vez de un escritorio vacío). La lista de proyectos la
  pone al día `script.js` con GitHub.
- **Datos estructurados:** un bloque JSON-LD de tipo `Person` con tu nombre,
  puesto, ciudad y perfiles.

Si cambias tu texto, habilidades o estudios, actualiza también ese `<article>`:
es HTML fijo.

## Analítica

Vercel Web Analytics, sin cookies. `initAnalytics()` carga su script solo en la
web publicada, no en local.

**Hay que activarla una vez:** en vercel.com → proyecto `portafolio` →
**Analytics** → **Enable**. Hasta entonces la ruta `/_vercel/insights/script.js`
da 404 en la consola; es inofensivo.

## Personalizar a mano

| Quieres cambiar… | Dónde, en `script.js` |
|---|---|
| Cuenta de GitHub | `GITHUB_USER` |
| Correo de contacto | `EMAIL` |
| Perfil de LinkedIn | `LINKEDIN` (y el `href` de `#linkedin-btn`) |
| Zona horaria del reloj | `TZ` |
| PDF del currículum | `CV_URL` |
| Habilidades y educación de fábrica | `SKILLS`, `EDUCATION` (o desde el portal) |
| Redes | `SOCIAL` |
| Escritorio de fábrica | `DEFAULT_DESKTOP` |
| Duración del arranque | `BOOT_LINE_MS` |
| Sonidos | `SOUNDS` (frecuencias en Hz) |
| Iconos disponibles | `PIXELS` (dibujos de 32x32 en texto) |
| Colores de los iconos | `PAL` |
| Colores del chrome | `:root` en `styles.css` |

### Dibujar un icono

Los iconos son rejillas de **32x32**, la medida de los iconos de escritorio de
los 90. Se escriben como texto: una letra por píxel, según la paleta `PAL`. El
punto es transparente y las filas pueden quedarse cortas — lo que falta se
rellena como transparente. No hace falta ningún editor de imágenes:

```js
folder: [
  "................................",
  "....kkkkkkkkkk..................",
  "...kWWWWWWWWWWk.................",
  "...kWYYYYYYYYYk.................",
  "...kWYYYYYYYYYkkkkkkkkkkkkkkk...",
  "...kWYYYYYYYYYYYYYYYYYYYYYYYYk..",
  // …hasta 32 filas
],
```

A 32x32 los píxeles quedan finos al pintarlos a 40px, como los iconos
originales. Los de 16x16 (el altavoz de la bandeja) no se ofrecen en el portal.

`pixelSvg()` los convierte en SVG uniendo los píxeles seguidos del mismo color:
si no, serían 1024 nodos por icono. El CSS los pinta con
`image-rendering: pixelated`, para que no se difuminen al ampliarlos.

## Cursores

El puntero también es de píxeles, en rejilla de **16x16** (`CURSORS`). Cada
píxel se pinta a 2x, así el cursor mide 32x32: por encima de ese tamaño hay
plataformas que lo ignoran. Van a PNG, no a SVG, porque Safari no admite
cursores SVG.

| Cursor | Dónde sale |
|---|---|
| Flecha | Todo, por herencia desde `<html>` |
| Mano | Enlaces, botones, iconos, pestañas, casillas |
| Cursor de texto | Campos de texto y áreas de texto |
| Diagonal | El tirador de redimensionar de las ventanas |
| Reloj de arena | Mientras cargan los repos de GitHub (`body.is-busy`) |

## Idiomas

El botón `EN`/`ES` de la bandeja cambia entre español e inglés. La elección se
guarda en `localStorage`.

**El HTML manda en español.** Al cargar, `harvestBaseLang()` copia al
diccionario lo escrito en `index.html`, así editas el texto en el HTML y se ve
tal cual. El **inglés** sale de `I18N.en` y hay que mantenerlo a mano.

Para traducir algo nuevo: `data-i18n="clave"` en el HTML y la clave en
`I18N.en`. Variantes: `data-i18n-title` y `data-i18n-aria`.

## Star Wars

Cada 18-44 s cruza un caza TIE en horizontal disparando rayos, o aparece la
Estrella de la Muerte, se queda quieta 6,5 s y explota. Se apaga solo si el
sistema pide reducir movimiento, y también desde el portal.

## Formulario de contacto

No hay servidor detrás ni servicio externo. El visitante escribe el mensaje,
pulsa **Enviar mensaje** y elige con qué correo mandarlo:

| Opción | Qué hace |
|---|---|
| **Gmail** | Abre el redactor de Gmail en otra pestaña, con todo escrito |
| **Outlook / Hotmail** | Lo mismo en Outlook web |
| **App de correo del equipo** | `mailto:` para Outlook de escritorio, Correo, Thunderbird… |
| **Copiar el mensaje** | Lo copia con destinatario y asunto, para pegarlo donde quiera |

**Por qué no un solo botón con `mailto:`:** solo funciona si el visitante tiene
una app de correo instalada; casi todo el mundo usa Gmail u Outlook en el
navegador.

## Peso

`script.js` pesa unos 130 KB sin comprimir, pero Vercel lo sirve con Brotli: por
la red viajan unos 24 KB (y `styles.css`, unos 7 KB). Minificarlo ahorraría poco
más y obligaría a añadir un paso de compilación, así que el código sigue legible
y editable a mano.

## Si editas y no ves el cambio

El navegador guarda `styles.css` y `script.js` en caché, y Live Server recarga
la página pero no siempre vuelve a pedir esos archivos. Por eso llevan un `?v=`
en `index.html`:

```html
<link rel="stylesheet" href="styles.css?v=15" />
<script src="script.js?v=15"></script>
```

**Sube ese número** cuando cambies CSS o JS y no veas el cambio. Alternativa:
`Ctrl+F5`, o DevTools (`Ctrl+Shift+J`) → Network → *Disable cache*.

## Diseño anterior

El portafolio de una sola página sigue en el historial de git, en el commit
`dac7e1a`. Para recuperarlo:
`git checkout dac7e1a -- index.html styles.css script.js`
