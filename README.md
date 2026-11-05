# Portafolio — Andres Madrid

Portafolio con forma de escritorio de PC: cada icono abre una ventana que se
arrastra, se minimiza y se cierra. HTML, CSS y JavaScript puro — sin
compilación ni npm. Del lado del servidor hay dos piezas: **Supabase** guarda el
escritorio publicado y lo reparte en vivo, y una función de Vercel
(`api/contact.js`) envía el formulario de contacto.

Publicado en **https://andresmadrid.vercel.app**.

## Archivos

| Archivo | Qué contiene |
|---|---|
| [`index.html`](index.html) | Arranque, escritorio, lanzador móvil, barra de tareas y perfil en texto |
| [`admin.html`](admin.html) | Panel privado: gestor freelance, bandeja, monitor de webs y administración de la web |
| [`admin.css`](admin.css) | Estilos del panel y de la hoja de cotización |
| [`admin.js`](admin.js) | Administración de la web y arranque del panel |
| [`gestor.js`](gestor.js) | Tablero, proyectos, cotizaciones, entregas, clientes, bandeja y sitios |
| [`styles.css`](styles.css) | Los estilos (chrome biselado, ventanas, iconos, impresión del CV) |
| [`script.js`](script.js) | La lógica (ventanas, idiomas, reloj, GitHub, config, arranque, sonidos). También la carga el panel |
| [`supabase/schema.sql`](supabase/schema.sql) | Tablas, reglas de seguridad y tiempo real (Supabase). Se puede volver a ejecutar |
| [`supabase/monitor-cron.sql`](supabase/monitor-cron.sql) | Cron de 5 minutos del monitor de webs |
| [`desktop.json`](desktop.json) | Respaldo si Supabase no responde. Vacío = valores de fábrica |
| [`og.png`](og.png) | Imagen de 1200×630 para la vista previa al compartir el enlace |
| [`amd.svg`](amd.svg), `amd*.png` | Logo AMD en píxeles: pestaña, panel, cotización, correo (Gmail no muestra SVG) e iconos de la app |
| [`admin.webmanifest`](admin.webmanifest), [`sw.js`](sw.js) | El panel como app en la pantalla de inicio y sus avisos push |
| [`api/contact.js`](api/contact.js) | Recibe el formulario: lo guarda en la Bandeja y lo envía a tu correo |
| [`api/monitor.js`](api/monitor.js) | Revisa las webs y avisa por correo si se caen o vuelven |
| [`api/_lib.js`](api/_lib.js) | Correo (Brevo), base de datos y plantilla de correo compartidos |

> Deben quedar **en la misma carpeta**. El archivo se llama `index.html` a
> propósito: es el nombre que buscan Vercel, GitHub Pages y Netlify en la raíz.
> Si lo renombras, la web da 404.

## Cómo usarlo

- **Ver:** doble clic en `index.html`. El escritorio publicado viene de
  Supabase, así que se ve igual que en la web (si hay internet).
- **Previsualizar con servidor:** `.claude/launch.json` levanta uno en
  `http://localhost:4173`.
- **Publicar:** sube los archivos a cualquier hosting estático. El envío
  directo del formulario necesita Vercel (por `api/`); en otro hosting el
  formulario usa el plan B.
- **En local** la ruta `/api/contact` no tiene claves: el formulario pasa al
  plan B, como debe.

## Lo que ve una visita

1. **Pantalla de arranque** tipo BIOS. Completa (unos dos segundos) solo la
   primera visita; en las siguientes, medio segundo (`BOOT_QUICK_MS`,
   `localStorage['boot-seen']`). Se salta con cualquier tecla, clic o toque.
   Dice cuántos repos hay si GitHub responde a tiempo.
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

**Botones de LinkedIn y Contacto:** en la barra de tareas, junto a Inicio.

**Tarjeta de presentación:** arriba a la derecha del escritorio (`#hello` en
`index.html`): nombre, puesto, una frase y los botones Ver proyectos, Contactar
y CV. Se oculta en pantallas pequeñas (allí está el lanzador).

## En el teléfono

En pantallas de 640 px o menos el escritorio se cambia por un **lanzador**: los
mismos elementos en lista, cada uno con una línea que dice qué hay dentro ("7
proyectos de GitHub", "Directo a mi correo"). Las ventanas se abren a
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

## Panel (admin.html)

Se abre desde **Inicio → Panel de administración**, en otra pestaña, y se entra
con una cuenta de **Supabase**. Solo los correos de `site_admins` entran. La
marca del panel y de los correos es **AM Developer** (constante `BRAND` en
`api/_lib.js` y texto en `admin.html`/`gestor.js`).

| Sección | Qué hace |
|---|---|
| **Proyectos** | Tablero Pendiente / En marcha / Terminado; se arrastran las tarjetas. Detalle con cliente, valor, fecha, entregables (el % sale solo) y pagos |
| **Bandeja** | Lo que llega por el formulario de Contacto. Seguimiento de cada mensaje: estado (Nuevo, Contactado, En seguimiento, Ganado, Descartado), fecha para volver a escribir y notas. Responder, o crear cliente y proyecto |
| **Presupuestos** | Cotizaciones por horas o a precio fijo, con la hoja al lado y **Guardar como PDF** |
| **Entregas** | Fechas de proyectos y entregables, de la más cercana a la más lejana |
| **Clientes** | Datos de cada cliente y su saldo |
| **Sitios** | Monitor de tus webs: estado, tiempo de respuesta e historial de caídas |
| **Formatos** | Guía de los formatos de cotización y de correo |
| **Web del portafolio** | Lo de abajo: iconos, fondo, proyectos, habilidades y educación |

**Facturado** es lo cobrado este mes (pagos registrados). **Por cobrar** es el
saldo de lo que está en marcha o terminado. Con el panel abierto llegan avisos en
vivo (mensajes y caídas); con **Activar avisos** también como notificación del
navegador. Con el panel cerrado avisa el correo.

### Monitor de webs

`api/monitor.js` revisa las webs de **Sitios** cada 5 minutos, llamado por un cron
de Supabase. Una web está caída si no responde en 8 s o da error 5xx **dos veces
seguidas**; entonces llega un correo `[CAÍDA]`, y otro `[RESUELTO]` cuando vuelve
con el tiempo que estuvo caída. **Revisar ahora** lo lanza a mano.

### Web del portafolio

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

Mientras editas, los cambios se ven solo en tu pantalla. Abajo:

| Botón | Qué hace |
|---|---|
| **Publicar** | Guarda en Supabase: todos lo ven al instante |
| **Copia (desktop.json)** | Baja la config como archivo, de respaldo |
| **Restablecer** | Publica el escritorio de fábrica para todos |
| **Cerrar sesión** | Sale de tu cuenta en ese navegador |

> **Borrador de antes:** si en un navegador guardaste algo con el portal viejo
> (que solo guardaba en ese navegador), el panel lo avisa arriba: **Cargarlo**
> lo pone en el panel para que lo revises y lo publiques; **Descartar** lo
> borra.

Restablecer publica `{}`, que significa "lo que traiga el código". Así, si el
código añade iconos nuevos, aparecen solos. Si publicas una config completa,
esa queda fija hasta que la cambies.

## Servidor (Supabase)

Proyecto `mfhyxbekkiugplawbddt`. Una sola fila de la tabla `site_config`
(`id = 'desktop'`) guarda toda la config del escritorio en JSON.

| Quién | Qué puede hacer |
|---|---|
| Cualquier visita | Leer la fila (y recibir los cambios en vivo) |
| Correos de la tabla `site_admins` con sesión iniciada | Publicar |
| Nadie desde la web | Borrar la fila, ver o tocar `site_admins` |

Lo hacen cumplir las reglas **RLS** de la base de datos, no el JavaScript: aunque
alguien abra el panel desde la consola, Supabase rechaza el cambio.

**De dónde sale lo que se pinta**, en orden:

1. Supabase (una petición REST al cargar; la pantalla de arranque tapa la espera,
   3 s como mucho).
2. La última versión vista en ese navegador (`desktop-cache`), si no hay red.
3. [`desktop.json`](desktop.json), si Supabase está vacío o caído.
4. `DEFAULT_DESKTOP` de `script.js`.

Después del arranque se carga `supabase-js` (jsDelivr, versión fija y con
SRI) y se suscribe a los cambios de la fila. Al volver a la pestaña también se
vuelve a pedir, por si se perdió algún aviso. La ventana de Contacto no se
repinta, para no borrar un mensaje a medio escribir.

### Montarlo (una vez)

1. Supabase → **SQL Editor** → pega [`supabase/schema.sql`](supabase/schema.sql)
   → **Run**. Crea las tablas, las reglas, el tiempo real y te pone
   (`admin_am@portafolio.com`) como admin. Se puede volver a ejecutar sin romper nada.
2. **Authentication → Users → Add user → Create new user**: tu correo, una
   contraseña y **Auto Confirm User** marcado.
3. **Authentication → Sign In / Providers**: desactiva **Allow new users to sign
   up**. Solo existirán los usuarios que crees tú.

Otro admin: `insert into public.site_admins (email) values ('otro@correo.com');`
y créale el usuario como en el paso 2.

**Claves:** la `sb_publishable_…` está en `script.js` a propósito: está hecha
para ir en la web y solo permite lo que dejan las reglas RLS. La **secreta**
(`sb_secret_…` o `service_role`) salta esas reglas: nunca en el código ni en el
repo.

## Proyectos automáticos

La ventana **Proyectos** pide tus repos a la API pública de GitHub y arma la
lista sola, ordenada por el último push. Los forks y los archivados no salen ahí:
van a la **Papelera**. La respuesta se guarda 1 hora en `localStorage` para no
gastar el límite (60 peticiones/hora sin token).

Para que un repo se vea bien: ponle **descripción**, **topics** y, si está
desplegado, la **Website** (aparece como botón *Ver web*).

El repo de perfil (`afMadridv/afMadridv`, solo trae el README de GitHub) no sale.

### Destacados y caso de estudio

En el portal, pestaña **Proyectos**, cada repo tiene:

- **★ Destacado**: sale primero en todas las listas, en el CV y en una pestaña
  **Destacados** que es la que se ve al abrir Proyectos (`config.projects.featured`).
- **Caso de estudio**: Mi rol, Problema, Solución y Resultado, en español e
  inglés (`config.projects.cases`). En la ficha salen como bloques, más un bloque
  **Stack** con el lenguaje y los topics de GitHub.

### Videos de los proyectos

En el portal, pestaña **Proyectos**, cada repo tiene un campo de video: pega un
enlace de **YouTube** (watch, youtu.be, shorts), **Vimeo** o un archivo
`.mp4/.webm/.ogg` y pulsa **Publicar**. El repo sale con el icono de claqueta,
en una pestaña **Con video**, y su ficha se abre más grande con el reproductor
arriba. Hasta que el visitante pulsa ▶ solo se ve la imagen del repo: no se
carga nada de YouTube (que además va por `youtube-nocookie.com`).

Se guardan en `config.projects.videos` (`{ "repo": "url" }`); `videoSource()` en
`script.js` valida el enlace. La CSP de `vercel.json` permite `frame-src` de
YouTube y Vimeo y `media-src https:`.

**Subir el archivo desde el PC:** botón **⇪ Subir video desde el PC** bajo cada
repo. Sube el `.mp4/.webm/.ogg` (máx. **50 MB**, límite del plan gratis de
Supabase) al bucket `project-videos` de Supabase Storage y rellena el campo con
su URL pública; luego pulsa **Publicar**. Solo el admin puede subir o borrar
(políticas en `supabase/schema.sql`). Los archivos reemplazados no se borran
solos: se limpian desde Supabase → Storage. Para videos largos, mejor YouTube
"no listado".

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
| Correo de contacto | `EMAIL` (y `CONTACT_TO` en Vercel para el envío directo) |
| Perfil de LinkedIn | `LINKEDIN` (y el `href` de `#linkedin-btn`) |
| Zona horaria del reloj | `TZ` |
| PDF del currículum | `CV_URL` |
| Habilidades y educación de fábrica | `SKILLS`, `EDUCATION` (o desde el portal) |
| Redes | `SOCIAL` |
| Escritorio de fábrica | `DEFAULT_DESKTOP` |
| Duración del arranque | `BOOT_LINE_MS` |
| Sonidos | `SOUNDS` (frecuencias en Hz) |
| Iconos disponibles | `PIXELS` (dibujos de 48x48 en texto) |
| Colores de los iconos | `PAL` |
| Colores del chrome | `:root` en `styles.css` |

### Dibujar un icono

Los iconos son rejillas de **48x48**, la medida de los iconos grandes de los
escritorios de los 90. Se escriben como texto: una letra por píxel, según la
paleta `PAL`. El punto es transparente y las filas pueden quedarse cortas — lo
que falta se rellena como transparente. No hace falta ningún editor de imágenes:

```js
folder: [
  "................................................",
  "................................................",
  "...kkkkkkkkkkkkkkk..............................",
  "..kooYYYYYYYYYYYYYok............................",
  // …hasta 48 filas
],
```

En el escritorio se pintan a 48px: un píxel del dibujo, un píxel de pantalla.
Los de 16x16 (el altavoz de la bandeja) no se ofrecen en el portal.

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

Cada 45-90 s (el primero a los 20 s; `FX_FIRST_MS`, `FX_GAP_MIN`, `FX_GAP_RANGE`) cruza un caza TIE en horizontal disparando rayos, o aparece la
Estrella de la Muerte, se queda quieta 6,5 s y explota. Se apaga solo si el
sistema pide reducir movimiento, y también desde el portal.

## Formulario de contacto

El visitante elige un motivo (**Cotizar**, **Colaborar**, **Empleo** u **Otra cosa**),
que pide sus datos extra, pulsa **Enviar mensaje** y no sale del portafolio.
[`api/contact.js`](api/contact.js) lo guarda en la **Bandeja** del panel y lo envía
a tu correo con [Brevo](https://www.brevo.com). Si el correo falla, el mensaje sigue
en la Bandeja con el motivo del fallo; **Probar correo**, en la Bandeja, envía una
prueba y muestra el error exacto del proveedor. Sin npm ni compilación.

### El correo que recibes

Formato exclusivo de la marca (`brandEmail()` en `api/_lib.js`): tarjeta blanca con
cabecera oscura, etiqueta y color según el motivo, ficha de datos, el mensaje
resaltado y los botones **Responder** y **Abrir bandeja**. El asunto lleva el motivo
(`[Cotización] Tienda en línea — Laura Pérez`) y *Responder* le contesta a quien
escribió.

| Motivo | Color | Datos extra |
|---|---|---|
| Cotización | Rojo | — |
| Colaboración | Verde | En qué, enlace |
| Empleo | Morado | Empresa, vacante |
| Contacto | Gris | — |

### Activarlo (una vez)

En Vercel → **Settings → Environment Variables** (Production y Preview), y luego **Redeploy**:

| Variable | Valor |
|---|---|
| `BREVO_API_KEY` | Brevo → SMTP & API → API Keys |
| `BREVO_SENDER` | Correo remitente verificado en Brevo → Senders |
| `CONTACT_TO` | Correo que recibe (opcional) |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API Keys → secret. Guarda mensajes y revisa webs |
| `MONITOR_SECRET` | Contraseña larga inventada, la misma de `monitor-cron.sql` |

> Estas claves van **solo** en Vercel. La secreta de Supabase se salta todas las
> reglas: nunca en `script.js`, ni en el repo, ni en un chat.

En Brevo, desactiva **Authorized IPs** si está activa: Vercel cambia de IP.
`RESEND_API_KEY` sigue de respaldo si no hay clave de Brevo.

Después pega `supabase/schema.sql` en el SQL Editor, y
`supabase/monitor-cron.sql` con tu `MONITOR_SECRET` en lugar del marcador.

### Plan B

Si el envío directo falla — sin la clave, sin conexión, en local o con el
servidor caído — la ventana lo dice y ofrece mandarlo con el correo del
visitante, ya escrito:

| Opción | Qué hace |
|---|---|
| **Gmail** | Abre el redactor de Gmail en otra pestaña, con todo escrito |
| **Outlook / Hotmail** | Lo mismo en Outlook web |
| **App de correo del equipo** | `mailto:` para Outlook de escritorio, Correo, Thunderbird… |
| **Copiar el mensaje** | Lo copia con destinatario y asunto, para pegarlo donde quiera |

### Spam y privacidad

- **Campo trampa** invisible (`website`) y un mínimo de 2,5 s entre abrir la
  ventana y enviar: si un bot cae, recibe "ok" y no se manda nada.
- **Mismo origen:** la función solo acepta envíos desde el propio sitio.
- **Freno:** 5 mensajes cada 10 minutos por IP (aproximado: va en memoria).
- **Sin cookies.** No hace falta aviso de cookies. Los mensajes quedan en la
  Bandeja privada (solo el admin los lee). Lo que el sitio guarda en `localStorage` (idioma, sonido,
  posición de ventanas, última copia del escritorio y, solo para ti, la sesión
  del portal) es funcional, no rastreo.

## Legal

Carpeta **Legal** en el escritorio, con cuatro archivos en español e inglés:
*Tratamiento de datos*, *Términos de uso*, *Ejercer mis derechos* (habeas data,
plazos de la Ley 1581 de 2012) y *Marco legal*. El aviso bajo el formulario de
Contacto enlaza a la política: enviar el mensaje es la autorización.

Los textos están en `LEGAL_ITEMS` de `script.js`. Si cambias algo, actualiza
`LEGAL_DATE`. `normalizeConfig()` los añade siempre, aunque la config publicada
sea anterior a ellos.

> Son una base razonable para un portafolio personal en Colombia, no asesoría
> legal. Si el sitio empieza a guardar datos o vender servicios, revísalos con un
> abogado.

## Seguridad

| Capa | Qué hay |
|---|---|
| Claves | `RESEND_API_KEY` solo en Vercel. En el código solo va la clave *publishable* de Supabase, hecha para ser pública. Ningún secreto en el historial de git |
| Base de datos | RLS: todos leen la fila del escritorio; solo los correos de `site_admins` publican. La web anónima no tiene permisos de escritura ni puede llamar `is_site_admin`. El autor se guarda como id, no como correo |
| Portal | Supabase Auth (contraseñas con bcrypt, límites de intentos de Supabase). La comprobación real está en la base de datos, no en la interfaz |
| Formulario | Validación de tipo y tamaño en el servidor, HTML escapado en el correo, campo trampa, tiempo mínimo, mismo origen y 5 envíos / 10 min por IP |
| Navegador | Cabeceras en [`vercel.json`](vercel.json): CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. HTTPS y HSTS los pone Vercel. Los enlaces solo abren `http`, `https` o `mailto` (`safeUrl()`) |
| Dependencias | Sin npm. `supabase-js` va con versión fija y SRI: si el archivo de jsDelivr cambiara, el navegador no lo ejecuta |

**Si añades un recurso de otro dominio** (una fuente, una API, un script), añádelo a la
`Content-Security-Policy` de `vercel.json` o el navegador lo bloqueará.

**Pendiente en el panel de Supabase:** Authentication → desactivar *Allow new users to
sign up*, y activar *Leaked password protection* si tu plan lo incluye.

## Peso

`script.js` pesa unos 215 KB sin comprimir (la mayor parte son los dibujos de
los iconos en texto), pero Vercel lo sirve con Brotli, que lo reduce mucho. Minificarlo ahorraría poco
más y obligaría a añadir un paso de compilación, así que el código sigue legible
y editable a mano.

## Si editas y no ves el cambio

El navegador guarda `styles.css` y `script.js` en caché, y Live Server recarga
la página pero no siempre vuelve a pedir esos archivos. Por eso llevan un `?v=`
en `index.html`:

```html
<link rel="stylesheet" href="styles.css?v=25" />
<script src="script.js?v=26"></script>
```

**Sube ese número** cuando cambies CSS o JS y no veas el cambio. Alternativa:
`Ctrl+F5`, o DevTools (`Ctrl+Shift+J`) → Network → *Disable cache*.

## Panel como app y avisos push

El panel se instala en la pantalla de inicio (`admin.webmanifest`) y avisa con la app
cerrada de cada mensaje del formulario y de cada web caída o recuperada (`sw.js`,
`api/_push.js`). No usa dependencias: el cifrado y la firma salen del módulo `crypto`.

Necesita en Vercel `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`. Genera el par en tu equipo:

```bash
node -e "const c=require('crypto').createECDH('prime256v1');c.generateKeys();console.log('VAPID_PUBLIC_KEY='+c.getPublicKey('base64url'));console.log('VAPID_PRIVATE_KEY='+c.getPrivateKey('base64url'))"
```

La privada nunca va al repositorio. En iPhone y iPad los avisos solo funcionan con el
panel añadido a la pantalla de inicio desde Safari (iOS 16.4 o superior).

## Diseño anterior

El portafolio de una sola página sigue en el historial de git, en el commit
`dac7e1a`. Para recuperarlo:
`git checkout dac7e1a -- index.html styles.css script.js`
