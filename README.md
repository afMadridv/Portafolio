# Portafolio — Andres Madrid

Portafolio personal en HTML, CSS y JavaScript puro. No necesita Node.js, ni
compilación, ni dependencias: se abre directo en el navegador y se edita a mano.

## Archivos

| Archivo | Qué contiene |
|---|---|
| [`portafolio.html`](portafolio.html) | La estructura y el contenido (textos, secciones) |
| [`styles.css`](styles.css) | Todos los estilos (colores, tipografía, animaciones) |
| [`script.js`](script.js) | La lógica (tema claro/oscuro, menú, animaciones al hacer scroll) |

> Los tres archivos deben quedar **en la misma carpeta** para que funcionen juntos.

## Cómo usarlo

- **Ver:** doble clic en `portafolio.html` (se abre en tu navegador).
- **Editar:** abre los archivos con cualquier editor de texto. El contenido está en
  HTML plano, con comentarios en español (`<!-- ... -->` / `/* ... */`) que marcan
  cada sección.
- **Publicar:** sube los tres archivos a cualquier hosting estático (GitHub Pages,
  Netlify, Vercel…). Para que sea la página principal, renombra `portafolio.html`
  a `index.html`.

## Personalizar

| Quieres cambiar… | Dónde |
|---|---|
| Color principal | `--primary`: en `:root` (claro, `#C81E1E`) y en `html.dark` (oscuro, `#FA4040`) |
| Aspecto del tema claro | bloque `TEMA CLARO` al final de `styles.css` |
| Nombre / título | sección `HERO` y el `<title>` en `portafolio.html` |
| Tus empleos | bloques `<!-- Empleo -->` en `portafolio.html` |
| Tus proyectos | nada: se cargan solos desde GitHub (ver abajo) |
| Cuenta de GitHub | `data-github-user` en `#projects-grid` (`portafolio.html`) |
| Tipografía del saludo | variable `--font-display` en `styles.css` |
| Formulario de contacto | el `action="https://formspree.io/..."` en `portafolio.html` |

## Proyectos automáticos

La sección **Projects** ya no se escribe a mano: `script.js` pide tus repos a la
API pública de GitHub y arma las tarjetas solo. Muestra hasta 9 repos, ordenados
por el último push, ignorando forks y archivados. La respuesta se guarda 1 hora
en `localStorage` para no gastar el límite (60 peticiones/hora sin token).

Para que un repo se vea bien: ponle **descripción**, **topics** y, si está
desplegado, la **Website** (aparece como botón "Live").

> Solo lee repos **públicos**. Al ser un sitio estático, cualquier token que
> pongas en `script.js` quedaría a la vista de todo el mundo — para ver repos
> privados haría falta un backend.

## Portal: elegir qué proyectos salen

El punto gris del pie de página abre el portal. Clave por defecto: `pixel-f1`.

Dentro marcas los repos que quieres publicar. Se ven **6** y el resto queda tras
el botón "Ver más". Sin nada marcado, salen todos.

Dos botones:

| Botón | Qué hace | Quién lo ve |
|---|---|---|
| **Guardar** | Escribe la selección en `localStorage` | Solo tú, en ese navegador |
| **Descargar projects.json** | Baja el archivo | Todos, **cuando lo subas al repo** |

Para publicar la selección: pulsa *Descargar projects.json*, deja el archivo
junto a `portafolio.html` y súbelo. El sitio lo lee al cargar.

**Aviso de seguridad:** la clave solo evita que un curioso abra el panel. No es
seguridad real — `script.js` es público y cualquiera puede leer su contenido, o
abrir el panel desde las herramientas de desarrollo. Es aceptable porque el panel
no puede cambiar lo que ven las visitas: para eso hace falta subir
`projects.json` a tu repositorio, y eso solo lo puedes hacer tú. No metas nada
sensible en esa clave ni la reutilices de otra cuenta.

Cambiar la clave: en la consola del navegador ejecuta `await hashText("nueva")` y
pega el resultado en la constante `ADMIN_HASH` de `script.js`.

## Detalles

- **Idiomas:** el botón del globo (junto al de tema) cambia entre español e
  inglés. La elección se guarda en `localStorage`.

  **El HTML manda en español.** Al cargar, `harvestBaseLang()` copia al
  diccionario lo que está escrito en `portafolio.html`. Así editas el texto en
  el HTML y se ve tal cual, sin tocar `script.js`. El **inglés** sí sale del
  diccionario `I18N.en` y hay que actualizarlo a mano cuando cambies un texto.

  Para traducir algo nuevo: ponle `data-i18n="clave"` en el HTML y añade esa
  clave a `I18N.en`. Variantes: `data-i18n-ph` (placeholders) y
  `data-i18n-aria` (`aria-label`).
- **Star Wars:** cada 18-44 s cruza un caza TIE en horizontal disparando rayos,
  o aparece la Estrella de la Muerte, se queda quieta 6,5 s y explota. Se apaga
  solo si el sistema pide reducir movimiento. Está en `#sw-fx`
  (`portafolio.html`) y `initSpaceFx()`. Tamaños en `TIE_SIZE` y `DS_SIZE`; el
  tiempo quieta, en `DS_STATIC_MS`.

## Si editas y no ves el cambio

El navegador guarda `styles.css` y `script.js` en caché, y Live Server recarga
la página pero no siempre vuelve a pedir esos archivos. Por eso llevan un
`?v=` en `portafolio.html`:

```html
<link rel="stylesheet" href="styles.css?v=5" />
<script src="script.js?v=5"></script>
```

**Sube ese número** cuando cambies CSS o JS y no veas el cambio. Alternativa
rápida: `Ctrl+F5`, o abrir DevTools (`F12`) → pestaña Network → marcar
*Disable cache* y dejar DevTools abierto mientras trabajas.
- **Tipografía:** `Silkscreen` en el saludo, los títulos de sección y el logo.
  El resto del texto sigue en `Geist Mono`.
- **Previsualizar con servidor:** `.claude/launch.json` levanta uno en
  `http://localhost:4173`. Hace falta para que `projects.json` se pueda leer:
  abriendo el HTML con doble clic (`file://`) esa petición falla y salen todos
  los repos.

## Pendiente

- **Currículum:** el botón "Descargar CV" está comentado en el HERO, dentro de
  `portafolio.html`. Cuando tengas tu CV en PDF, súbelo a esta carpeta como
  `cv-andres-madrid.pdf` y descomenta ese bloque. La clave `hero.resume` ya
  existe en `I18N` (español e inglés).
- **Publicar en GitHub Pages:** Pages sirve `index.html` y tu archivo se llama
  `portafolio.html`. Si lo renombras, quita la línea `index.html` del
  `.gitignore` (está ahí de cuando era una copia temporal).

## Ya no queda nada de la plantilla original

- ~~**Proyectos**~~ — se cargan desde tu cuenta de GitHub.
- ~~**Contacto → GitHub / LinkedIn**~~ — apuntan a tus cuentas.
- ~~**Educación**~~ — descripciones distintas, tildes corregidas y etiqueta de
  estado (En curso / Finalizado).
- ~~**Experiencia**~~ — la sección de empleos de la plantilla ya no está.
- ~~**Sobre mí**~~ — texto tuyo (construcción, mantenimiento eléctrico,
  insolvencia y conciliación).
- ~~**Currículum**~~ — fuera el PDF de la plantilla.
