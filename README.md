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
| Color principal | variable `--primary` en `styles.css` (en `:root`) — ahora `#FA4040` |
| Nombre / título | sección `HERO` y el `<title>` en `portafolio.html` |
| Tus empleos | bloques `<!-- Empleo -->` en `portafolio.html` |
| Tus proyectos | bloques `<!-- Proyecto -->` en `portafolio.html` |
| Formulario de contacto | el `action="https://formspree.io/..."` en `portafolio.html` |

## Pendiente de rellenar con tus datos reales

Esto aún viene de la plantilla original y conviene reemplazarlo:

- **Currículum (Download Resume):** sigue apuntando a `https://resume.nihal.com.np/...`
- **Experiencia:** las empresas siguen siendo "Leapfrog Technology / Trayt Health"
- **Proyectos:** Pacman, Flappy Bird, Pursue, Mailer (y sus enlaces de GitHub)
- **Open Source** y **Educación** ("Kantipur Engineering College")
- El texto de **About Me** (bio de la plantilla)
