# Portafolio — Andres Madrid

Portafolio con forma de escritorio de PC: cada icono abre una ventana que se
arrastra, se minimiza y se cierra. HTML, CSS y JavaScript puro — sin Node.js,
sin compilación, sin dependencias.

## Archivos

| Archivo | Qué contiene |
|---|---|
| [`index.html`](index.html) | El escritorio, la barra de tareas y el panel de administración |
| [`styles.css`](styles.css) | Los estilos (chrome biselado, ventanas, iconos) |
| [`script.js`](script.js) | La lógica (ventanas, idiomas, reloj, GitHub, portal) |
| `desktop.json` | *Opcional.* Tu escritorio publicado. Lo genera el portal |

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
| `app: contact` | Cuadro de diálogo con icono y campos hundidos |
| `app: social` | Entorno de red: iconos grandes |

Al abrir un proyecto desde la carpeta sale su **ficha**, con descripción,
lenguaje, estrellas, fecha del último cambio y los botones de código y web.

Todas las ventanas llevan **barra de estado** abajo, que dice cuántos elementos
hay, la dirección del repo o el correo, según el caso.

Las ventanas se arrastran por la barra de título, se redimensionan por la
esquina de abajo a la derecha, se minimizan a la barra de tareas y se maximizan.
En móvil ocupan casi toda la pantalla: arrastrar ventanitas con el dedo no
funciona bien.

**Reloj:** siempre `America/Bogota`, no la hora del visitante. Está en la
constante `TZ` de `script.js`.

**Botón de LinkedIn:** el de la barra de tareas, junto a Inicio. La dirección
está en el `href` de `#linkedin-btn` y en la constante `LINKEDIN`.

## Portal de administración

Se abre desde **Inicio → Panel de administración**. Clave por defecto:
`pixel-f1`.

Tres pestañas:

- **Iconos** — crear, editar, borrar y ordenar elementos. Para meter algo dentro
  de una carpeta, elígela en *Dentro de*. Al borrar una carpeta, sus hijos suben
  al escritorio en vez de desaparecer.
- **Fondo** — color liso, degradado o imagen por URL. Se ve al instante. También
  enciende o apaga el caza TIE y la Estrella de la Muerte.
- **Proyectos** — marca qué repos de GitHub salen en la carpeta Proyectos. Sin
  nada marcado, salen todos.

Abajo, tres botones:

| Botón | Qué hace | Quién lo ve |
|---|---|---|
| **Guardar** | Escribe la config en `localStorage` | Solo tú, en ese navegador |
| **Descargar desktop.json** | Baja el archivo | Todos, **cuando lo subas al repo** |
| **Restablecer** | Borra tus cambios locales y vuelve al escritorio de fábrica | — |

Para publicar tus cambios: *Descargar desktop.json*, deja el archivo junto a
`index.html` y súbelo al repositorio.

**Aviso de seguridad:** la clave solo evita que un curioso abra el panel. No es
seguridad real — `script.js` es público y cualquiera puede leerlo, o abrir el
panel desde las herramientas de desarrollo. Es aceptable porque el panel no
puede cambiar lo que ven las visitas: para eso hace falta subir `desktop.json`
a tu repositorio, y eso solo lo puedes hacer tú. No uses ahí una clave que
reutilices en otra cuenta.

Cambiar la clave: en la consola del navegador ejecuta `await hashText("nueva")`
y pega el resultado en la constante `ADMIN_HASH` de `script.js`.

## Proyectos automáticos

La ventana **Proyectos** pide tus repos a la API pública de GitHub y arma la
lista sola: ignora forks y archivados, y los ordena por el último push. La
respuesta se guarda 1 hora en `localStorage` para no gastar el límite (60
peticiones/hora sin token).

Para que un repo se vea bien: ponle **descripción**, **topics** y, si está
desplegado, la **Website** (aparece como botón *Ver web*).

> Solo lee repos **públicos**. Al ser un sitio estático, cualquier token que
> pongas en `script.js` quedaría a la vista de todo el mundo — para ver repos
> privados haría falta un backend.

## Personalizar a mano

| Quieres cambiar… | Dónde, en `script.js` |
|---|---|
| Cuenta de GitHub | `GITHUB_USER` |
| Correo de contacto | `EMAIL` |
| Perfil de LinkedIn | `LINKEDIN` (y el `href` de `#linkedin-btn`) |
| Zona horaria del reloj | `TZ` |
| Habilidades | `SKILLS` |
| Educación | `EDUCATION` |
| Redes | `SOCIAL` |
| Escritorio de fábrica | `DEFAULT_DESKTOP` |
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
originales. A 16x16 salían el doble de gruesos.

`pixelSvg()` los convierte en SVG uniendo los píxeles seguidos del mismo color:
si no, serían 1024 nodos por icono. El tamaño sale del propio dibujo, así
conviven rejillas de distinto tamaño. El CSS los pinta con
`image-rendering: pixelated`, para que no se difuminen al ampliarlos.

## Idiomas

El botón `EN`/`ES` de la bandeja cambia entre español e inglés. La elección se
guarda en `localStorage`.

**El HTML manda en español.** Al cargar, `harvestBaseLang()` copia al
diccionario lo escrito en `index.html`, así editas el texto en el HTML y se ve
tal cual. El **inglés** sale de `I18N.en` y hay que mantenerlo a mano.

Para traducir algo nuevo: `data-i18n="clave"` en el HTML y la clave en
`I18N.en`. Variantes: `data-i18n-title` y `data-i18n-aria`.

Los elementos que creas desde el portal llevan nombre y texto en los dos
idiomas; si dejas el inglés vacío, se usa el español.

## Star Wars

Cada 18-44 s cruza un caza TIE en horizontal disparando rayos, o aparece la
Estrella de la Muerte, se queda quieta 6,5 s y explota. Se apaga solo si el
sistema pide reducir movimiento, y también desde el portal.

Ajustes en `script.js`: `TIE_SIZE`, `DS_SIZE`, `TIE_SPEED`, `DS_STATIC_MS`.

## Formulario de contacto

No hay servidor detrás ni servicio externo. Al enviar se abre el cliente de
correo del visitante con destinatario, asunto y cuerpo ya escritos; solo tiene
que pulsar enviar en su propia aplicación. El mensaje te llega desde su correo
real, así puedes responder directo.

Si el visitante no tiene cliente de correo configurado no se abre nada, por eso
bajo el botón sale siempre tu dirección. Y si el mensaje pasa de 1800
caracteres de URL, avisa en vez de abrir un correo cortado a medias: varios
clientes truncan los `mailto:` largos sin decir nada.

## Si editas y no ves el cambio

El navegador guarda `styles.css` y `script.js` en caché, y Live Server recarga
la página pero no siempre vuelve a pedir esos archivos. Por eso llevan un `?v=`
en `index.html`:

```html
<link rel="stylesheet" href="styles.css?v=12" />
<script src="script.js?v=12"></script>
```

**Sube ese número** cuando cambies CSS o JS y no veas el cambio. Alternativa:
`Ctrl+F5`, o DevTools (`Ctrl+Shift+J`) → Network → *Disable cache*.

## Pendiente

- **Currículum:** no hay botón de CV. Cuando tengas el PDF, súbelo a la carpeta
  y crea un elemento de tipo `link` desde el portal apuntando a él.
- **Diseño anterior:** el portafolio de una sola página con secciones sigue en
  el historial de git, en el commit `dac7e1a`. Para recuperarlo:
  `git checkout dac7e1a -- index.html styles.css script.js`
