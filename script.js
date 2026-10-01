/* =========================================================
   PORTAFOLIO — ESCRITORIO
   Cada icono abre una ventana. El contenido del escritorio
   (iconos, carpetas, archivos y fondo) vive en una config que
   se puede editar desde el portal de administración.

   De dónde sale la config, de más a menos prioritario:
     1. Supabase      -> lo publicado desde el portal. Lo ven
                         todos y llega en vivo a quien tenga
                         la página abierta (supabase/schema.sql)
     2. desktop.json  -> respaldo si Supabase no responde
     3. DEFAULT_DESKTOP -> lo que trae el código
   ========================================================= */

/* Se ejecuta en el <head>, antes de pintar nada: activa la pantalla
   de arranque. Sin JavaScript la clase no llega y no se ve. */
document.documentElement.classList.add("boot-on");

const TZ = "America/Bogota";
const EMAIL = "mvandres08@gmail.com";
const GITHUB_USER = "afMadridv";
const LINKEDIN =
  "https://www.linkedin.com/in/andr%C3%A9s-felipe-madrid-villar-9987693a8/";

/* Supabase. La clave "publishable" está hecha para ir en la web:
   solo deja hacer lo que permiten las reglas RLS de
   supabase/schema.sql (leer todos, publicar solo tú).
   La clave secreta (sb_secret_… / service_role) NUNCA va aquí. */
const SUPABASE_URL = "https://mfhyxbekkiugplawbddt.supabase.co";
const SUPABASE_KEY = "sb_publishable_jRkmQGoUTw182zPQu7lBhw_soW0SQJv";
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js";
const SUPABASE_JS_SRI = "sha384-Rj26LVGvoeRVR6+mwQmFfcR3QOBEwT+ZmuCWpuiqeTzJpCs0ER4ITAWGb4Hiy3Ok";
const CFG_TABLE = "site_config";
const CFG_ROW = "desktop";

const CFG_CACHE_KEY = "desktop-cache"; // última config publicada, por si no hay red
const CFG_KEY = "desktop-cfg"; // borrador del portal de antes de Supabase
const GH_CACHE_KEY = "gh-repos";
const GH_CACHE_TTL = 60 * 60 * 1000; // 1 hora
const LANG_KEY = "lang";
const DEFAULT_LANG = "es";

let lang = DEFAULT_LANG;
let config = null;
let allRepos = [];
let trashRepos = []; // forks y archivados: salen en la Papelera
let reposError = false;
let bootRunning = false;

/* =========================================================
   ICONOS DE PÍXELES
   Rejilla de 32x32, la medida de los iconos de escritorio de
   los 90. Cada icono se escribe como texto: una letra por
   píxel, según la paleta de abajo. Para cambiar un dibujo no
   hay que tocar código ni abrir un editor de imágenes.

   El punto "." es transparente. Las filas pueden quedarse
   cortas: lo que falta se rellena como transparente.
   ========================================================= */
const PAL = {
  ".": null,
  k: "#000000", // contorno
  D: "#2e2e2e", // sombra dura
  d: "#585858", // gris oscuro
  K: "#6e6e6e", // gris hundido
  g: "#808080", // gris medio
  G: "#a8a8a8", // gris claro
  c: "#c6c6c6", // gris del chrome
  C: "#e4e4e4", // casi blanco
  w: "#ffffff", // blanco
  b: "#000080", // azul barra de título
  B: "#0a3fd0", // azul
  s: "#2f6fb0", // azul medio
  S: "#6aa8e0", // azul claro
  n: "#b8dcff", // azul pálido
  o: "#a06f00", // ocre (sombra de carpeta)
  y: "#e8b23c", // amarillo carpeta
  Y: "#ffd977", // amarillo claro
  W: "#fff0c0", // amarillo muy claro
  q: "#8a0f0f", // rojo oscuro
  r: "#cc1f1f", // rojo
  R: "#ff6b6b", // rojo claro
  e: "#127c12", // verde
  E: "#5cc45c", // verde claro
  p: "#d6d6e8", // plata azulada
  t: "#128080", // verde azulado
  m: "#f0c9a0", // piel
};

const PIXELS = {
  /* Ventana de información, como el icono "Info" de la referencia */
  info: [
    "................................",
    "................................",
    "................................",
    "....kkkkkkkkkkkkkkkkkkkkkk......",
    "....kCCCCCCCCCCCCCCCCCCCCk......",
    "....kCbbbbbbbbbbbbbbbbbbCkD.....",
    "....kCbwwbbbbbbbbbbbbbbbCkD.....",
    "....kCbwwbbbbbbbbbbbbbbbCkD.....",
    "....kCbbbbbbbbbbbbbbbbbbCkD.....",
    "....kCCCCCCCCCCCCCCCCCCCCkD.....",
    "....kCwwwwwwwwwwwwwwwwwwCkD.....",
    "....kCwbbbbbbbbbbbbbwwwwCkD.....",
    "....kCwwwwwwwwwwwwwwwwwwCkD.....",
    "....kCwggggggggggggggwwwCkD.....",
    "....kCwwwwwwwwwwwwwwwwwwCkD.....",
    "....kCwggggggggggggwwwwwCkD.....",
    "....kCwwwwwwwwwwwwwwwwwwCkD.....",
    "....kCwgggggggggwwwwwwwwCkD.....",
    "....kCwwwwwwwwwwwwwwwwwwCkD.....",
    "....kCCCCCCCCCCCCCCCCCCCCkD.....",
    "....kkkkkkkkkkkkkkkkkkkkkkD.....",
    ".....DDDDDDDDDDDDDDDDDDDDDD.....",
    "..........kkkkkkkkkk............",
    "..........kCCCCCCCCkD...........",
    ".........kkkkkkkkkkkkD..........",
    ".........kCCCCCCCCCCkD..........",
    ".........kkkkkkkkkkkkD..........",
    "..........DDDDDDDDDDDD..........",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Documento de texto */
  txt: [
    "................................",
    "................................",
    "......kkkkkkkkkkkkkkkk..........",
    "......kwwwwwwwwwwwwwwkk.........",
    "......kwwwwwwwwwwwwwwkCk........",
    "......kwwwwwwwwwwwwwwkCCk.......",
    "......kwwwwwwwwwwwwwwkCCCk......",
    "......kwwwwwwwwwwwwwwkkkkkk.....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwbbbbbbbbbbbwwwwwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwggggggggggggggwwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwggggggggggggggwwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwgggggggggggggggwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwggggggggggggggwwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwggggggggggwwwwwwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwggggggggggggggwwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwggggggggwwwwwwwwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kkkkkkkkkkkkkkkkkkkkkD....",
    ".......DDDDDDDDDDDDDDDDDDDDD....",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Carpeta cerrada, como el icono "Archivos" de la referencia */
  folder: [
    "................................",
    "................................",
    "................................",
    "................................",
    "....kkkkkkkkkk..................",
    "...kWWWWWWWWWWk.................",
    "...kWYYYYYYYYYk.................",
    "...kWYYYYYYYYYkkkkkkkkkkkkkkk...",
    "...kWYYYYYYYYYYYYYYYYYYYYYYYYk..",
    "...kWYYYYYYYYYYYYYYYYYYYYYYYYkD.",
    "...kWYyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...koooooooooooooooooooooooooekD",
    "...kkkkkkkkkkkkkkkkkkkkkkkkkkkD.",
    "....DDDDDDDDDDDDDDDDDDDDDDDDDD..",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Carpeta abierta */
  folderOpen: [
    "................................",
    "................................",
    "................................",
    "................................",
    "....kkkkkkkkkk..................",
    "...kWWWWWWWWWWk.................",
    "...kWYYYYYYYYYk.................",
    "...kWYYYYYYYYYkkkkkkkkkkkkkkk...",
    "...kWYYYYYYYYYYYYYYYYYYYYYYYYk..",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kWyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "...kkkkkkkkkkkkkkkkkkkkkkkkkkkD.",
    "..kWWWWWWWWWWWWWWWWWWWWWWWWWWk..",
    "..kYYYYYYYYYYYYYYYYYYYYYYYYYYkD.",
    "...kYYYYYYYYYYYYYYYYYYYYYYYYYkD.",
    "...kyyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "....kyyyyyyyyyyyyyyyyyyyyyyyykD.",
    "....kyyyyyyyyyyyyyyyyyyyyyyyykD.",
    ".....kyyyyyyyyyyyyyyyyyyyyyyykD.",
    ".....kyyyyyyyyyyyyyyyyyyyyyyykD.",
    "......kyyyyyyyyyyyyyyyyyyyyyykD.",
    "......kooooooooooooooooooooooekD",
    "......kkkkkkkkkkkkkkkkkkkkkkkkD.",
    ".......DDDDDDDDDDDDDDDDDDDDDDD..",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* GitHub: gato blanco sobre disco oscuro */
  github: [
    "................................",
    "................................",
    "..........kkkkkkkkkk............",
    ".......kkkkDDDDDDDDkkkk.........",
    ".....kkDDDDDDDDDDDDDDDDkk.......",
    "....kDDDDDDDDDDDDDDDDDDDDk......",
    "...kDDDDDDDDDDDDDDDDDDDDDDk.....",
    "..kDDDwDDDDDDDDDDDDDDwDDDDDk....",
    "..kDDwwwDDDDDDDDDDDDwwwDDDDkD...",
    ".kDDwwwwwDDDDDDDDDDwwwwwDDDDkD..",
    ".kDDwwwwwwwwwwwwwwwwwwwwwDDDkD..",
    ".kDDDwwwwwwwwwwwwwwwwwwwwwDDkD..",
    ".kDDwwwwwwwwwwwwwwwwwwwwwwwDkD..",
    ".kDwwwwkkkwwwwwwwwkkkwwwwwwwkD..",
    ".kDwwwwkkkwwwwwwwwkkkwwwwwwwkD..",
    ".kDwwwwwwwwwwwwwwwwwwwwwwwwwkD..",
    ".kDDwwwwwwwwwkkwwwwwwwwwwwwDkD..",
    ".kDDwwwwwwwwwwwwwwwwwwwwwwwDkD..",
    "..kDDwwwwwwwwwwwwwwwwwwwwDDkD...",
    "..kDDDwwwwwwwwwwwwwwwwwwDDDkD...",
    "...kDDwwwwwDDDDDDwwwwwwwwDDkD...",
    "....kDDwwwwwDDDDwwwwwwwwDDkD....",
    ".....kkDwwwwwDDwwwwwwwwDkkD.....",
    ".......kkkwwwwwwwwwwwkkkD.......",
    "..........kkkkkkkkkkD...........",
    "...........DDDDDDDDD............",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Sobre de correo: solapa en V solo en la mitad de arriba */
  mail: [
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "....kkkkkkkkkkkkkkkkkkkkkkkk....",
    "....kwwwwwwwwwwwwwwwwwwwwwwkD...",
    "....kGwwwwwwwwwwwwwwwwwwwwGkD...",
    "....kwGwwwwwwwwwwwwwwwwwwGwkD...",
    "....kwwGwwwwwwwwwwwwwwwwGwwkD...",
    "....kwwwGwwwwwwwwwwwwwwGwwwkD...",
    "....kwwwwGwwwwwwwwwwwwGwwwwkD...",
    "....kwwwwwGwwwwwwwwwwGwwwwwkD...",
    "....kwwwwwwGwwwwwwwwGwwwwwwkD...",
    "....kwwwwwwwGwwwwwwGwwwwwwwkD...",
    "....kwwwwwwwwGwwwwGwwwwwwwwkD...",
    "....kwwwwwwwwwGGGGwwwwwwwwwkD...",
    "....kwwwwwwwwwwwwwwwwwwwwwwkD...",
    "....kwwwwwwwwwwwwwwwwwwwwwwkD...",
    "....kwwwrrrrrrrrrrwwwwwwwwwkD...",
    "....kwwwwwwwwwwwwwwwwwwwwwwkD...",
    "....kwwwggggggggggggggwwwwwkD...",
    "....kwwwwwwwwwwwwwwwwwwwwwwkD...",
    "....kwwwggggggggggwwwwwwwwwkD...",
    "....kwwwwwwwwwwwwwwwwwwwwwwkD...",
    "....kkkkkkkkkkkkkkkkkkkkkkkkD...",
    ".....DDDDDDDDDDDDDDDDDDDDDDDD...",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Sobre enviado: el de "mail" con una insignia verde con visto */
  sent: [
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "..kkkkkkkkkkkkkkkkkkkkkkkk......",
    "..kwwwwwwwwwwwwwwwwwwwwwwkD.....",
    "..kGwwwwwwwwwwwwwwwwwwwwGkD.....",
    "..kwGwwwwwwwwwwwwwwwwwwGwkD.....",
    "..kwwGwwwwwwwwwwwwwwwwGwwkD.....",
    "..kwwwGwwwwwwwwwwwwwwGwwwkD.....",
    "..kwwwwGwwwwwwwwwwwwGwwwwkD.....",
    "..kwwwwwGwwwwwwwwwwGwwwwwkD.....",
    "..kwwwwwwGwwwwwwwwGwwwwwwkD.....",
    "..kwwwwwwwGwwwwwwGwwwwwwwkD.....",
    "..kwwwwwwwwGwwwwGwwwwwwwwkD.....",
    "..kwwwwwwwwwGGGGwwwwwwwwwkD.....",
    "..kwwwwwwwwwwwwwwwwwwwkkkkkk....",
    "..kwwwwwwwwwwwwwwwwwkkEEeeeekk..",
    "..kwwwrrrrrrrrrrwwwkEEeeeeeeeek.",
    "..kwwwwwwwwwwwwwwwwkEeeeeeeeeek.",
    "..kwwwggggggggggggkeeeeeeeeeewek",
    "..kwwwwwwwwwwwwwwwkeeeeeeeeewwek",
    "..kwwwggggggggggwwkeeweeeeewweek",
    "..kwwwwwwwwwwwwwwwkeewweeewweeek",
    "..kkkkkkkkkkkkkkkkkeeewwewweeeek",
    "...DDDDDDDDDDDDDDDkeeeewwweeeeek",
    "...................keeeeweeeeek.",
    "...................keeeeeeeeeek.",
    "....................kkeeeeeekk..",
    "......................kkkkkk....",
    "................................",
  ],

  /* Globo terráqueo */
  globe: [
    "................................",
    "................................",
    "..........kkkkkkkkkk............",
    ".......kkkkssssssssskkkk........",
    ".....kkssssnsssssssnsssskk......",
    "....ksssssnssssssssnssssssk.....",
    "...ksssssnsssssssssnsssssssk....",
    "..ksssssnssssssssssnssssssssk...",
    "..kssssnsssssssssssnsssssssskD..",
    ".ksssnssssssssssssssnsssssssskD.",
    ".kssnsssssssssssssssnssssssssskD",
    ".kwwwwwwwwwwwwwwwwwwwwwwwwwwwkD.",
    ".kssnsssssssssssssssnssssssssskD",
    ".ksssnssssssssssssssnsssssssskD.",
    ".kssssnsssssssssssssnsssssssskD.",
    ".kssssnsssssssssssssnsssssssskD.",
    ".kwwwwwwwwwwwwwwwwwwwwwwwwwwwkD.",
    ".kssssnsssssssssssssnsssssssskD.",
    "..kssssnssssssssssssnsssssssskD.",
    "..ksssssnssssssssssnssssssssskD.",
    "...ksssssnsssssssssnsssssssskD..",
    "....ksssssnssssssssnssssssskD...",
    ".....kkssssnsssssssnsssskkD.....",
    ".......kkkkssssssssskkkkD.......",
    "..........kkkkkkkkkkD...........",
    "...........DDDDDDDDD............",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Birrete: tabla en rombo arriba, copa debajo y borla a un lado */
  edu: [
    "................................",
    "................................",
    "................................",
    "................................",
    "...............kk...............",
    "..............krrk..............",
    "............kkrrrrkk............",
    "..........kkrrrrrrrrkk..........",
    "........kkrrrrrrrrrrrrkk........",
    "......kkrrrrrrrrrrrrrrrrkk......",
    "....kkrrrrrrrrrrrrrrrrrrrrkk....",
    "..kkrrrrrrrrrrrrrrrrrrrrrrrrkk..",
    ".krrrrrrrrrrrrrrrrrrrrrrrrrrrrk.",
    ".kqqqqqqqqqqqqqqqqqqqqqqqqqqqqkD",
    "..kkqqqqqqqqqqqqqqqqqqqqqqqqkkD.",
    "....kkqqqqqqqqqqqqqqqqqqqqkkD...",
    "......kkqqqqqqqqqqqqqqqqkkkD....",
    "......kq..kkqqqqqqqqkk...kD.....",
    "......kq....kkqqqqkk.....D......",
    "......kq......kkkk.......D......",
    "......kq..kkkkkkkkkkkk..........",
    "......kq..kqqqqqqqqqqkD.........",
    "......kq..kqqqqqqqqqqkD.........",
    "......kq...kqqqqqqqqkD..........",
    "......kqq...kkkkkkkkD...........",
    ".....kqqqk...DDDDDDD............",
    ".....kqqqk......................",
    ".....kqqqk......................",
    "......kkk.......................",
    "................................",
    "................................",
    "................................",
  ],

  /* Engranaje: dientes marcados y hueco central */
  tools: [
    "................................",
    "................................",
    "........kkkk........kkkk........",
    "........kCCk........kCCk........",
    "........kCCk........kCCk........",
    "........kCCk........kCCk........",
    ".....kkkkCCkkkkkkkkkkCCkkkk.....",
    "....kCCCCCCCCCCCCCCCCCCCCCCk....",
    "...kCCCCCCCCCCCCCCCCCCCCCCCCk...",
    "kkkkCCCCCCCCCCCCCCCCCCCCCCCCkkkk",
    "kCCCCCCCCCCCkkkkkkCCCCCCCCCCCCCk",
    "kCCCCCCCCCkkGGGGGGkkCCCCCCCCCCCk",
    "kCCCCCCCCkGGGGGGGGGGkCCCCCCCCCCk",
    "kCCCCCCCkGGGGwwwwGGGGkCCCCCCCCCk",
    "kCCCCCCCkGGGwwwwwwGGGkCCCCCCCCCk",
    "kCCCCCCCkGGGwwrrwwGGGkCCCCCCCCCk",
    "kCCCCCCCkGGGwwrrwwGGGkCCCCCCCCCk",
    "kCCCCCCCkGGGwwwwwwGGGkCCCCCCCCCk",
    "kCCCCCCCkGGGGwwwwGGGGkCCCCCCCCCk",
    "kCCCCCCCCkGGGGGGGGGGkCCCCCCCCCCk",
    "kCCCCCCCCCkkGGGGGGkkCCCCCCCCCCCk",
    "kCCCCCCCCCCCkkkkkkCCCCCCCCCCCCCk",
    "kkkkCCCCCCCCCCCCCCCCCCCCCCCCkkkk",
    "...kCCCCCCCCCCCCCCCCCCCCCCCCkD..",
    "....kCCCCCCCCCCCCCCCCCCCCCCkD...",
    ".....kkkkCCkkkkkkkkkkCCkkkkD....",
    "........kCCk........kCCkD.......",
    "........kCCk........kCCkD.......",
    "........kCCk........kCCkD.......",
    "........kkkkD.......kkkkD.......",
    "................................",
    "................................",
  ],

  /* Enlace: página con flecha */
  link: [
    "................................",
    "................................",
    "....kkkkkkkkkkkkkkkkkkkkkk......",
    "....kwwwwwwwwwwwwwwwwwwwwkD.....",
    "....kwwwwwwwwwwwwwwwwwwwwkD.....",
    "....kwwwwwwwwwwwwwwrrrrrrkD.....",
    "....kwwwwwwwwwwwwwwwwwwrrkD.....",
    "....kwwwwwwwwwwwwwwwwwrwrkD.....",
    "....kwwggggggggwwwwwwrwwrkD.....",
    "....kwwwwwwwwwwwwwwrwwwwrkD.....",
    "....kwwggggggggwwwrwwwwwrkD.....",
    "....kwwwwwwwwwwwrwwwwwwrrkD.....",
    "....kwwgggggggwrwwwwwwwwwkD.....",
    "....kwwwwwwwwwrwwwwwwwwwwkD.....",
    "....kwwggggggrwwwwwwwwwwwkD.....",
    "....kwwwwwwwrwwwwwwwwwwwwkD.....",
    "....kwwgggggwwwwwwwwwwwwwkD.....",
    "....kwwwwwwwwwwwwwwwwwwwwkD.....",
    "....kwwgggggggggggwwwwwwwkD.....",
    "....kwwwwwwwwwwwwwwwwwwwwkD.....",
    "....kwwggggggggggwwwwwwwwkD.....",
    "....kwwwwwwwwwwwwwwwwwwwwkD.....",
    "....kwwggggggggwwwwwwwwwwkD.....",
    "....kwwwwwwwwwwwwwwwwwwwwkD.....",
    "....kkkkkkkkkkkkkkkkkkkkkkD.....",
    ".....DDDDDDDDDDDDDDDDDDDDDD.....",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Persona */
  user: [
    "................................",
    "................................",
    "................................",
    "............kkkkkk..............",
    "..........kkmmmmmmkk............",
    ".........kmmmmmmmmmmk...........",
    "........kmmmmmmmmmmmmk..........",
    "........kmmmmmmmmmmmmkD.........",
    "........kmmmmmmmmmmmmkD.........",
    ".........kmmmmmmmmmmkD..........",
    "..........kkmmmmmmkkD...........",
    "............kkkkkkD.............",
    "...........kkkkkkkk.............",
    ".........kkssssssssskk..........",
    "........ksssssssssssssk.........",
    ".......ksssssssssssssssk........",
    "......kssssssssssssssssskD......",
    "......ksssssssssssssssssskD.....",
    ".....kssssssssssssssssssskD.....",
    ".....kssssssssssssssssssskD.....",
    ".....kssssssssssssssssssskD.....",
    ".....kssssssssssssssssssskD.....",
    ".....kssssssssssssssssssskD.....",
    ".....kssssssssssssssssssskD.....",
    ".....kkkkkkkkkkkkkkkkkkkkkD.....",
    "......DDDDDDDDDDDDDDDDDDDD......",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Ordenador de sobremesa */
  pc: [
    "................................",
    "................................",
    "..kkkkkkkkkkkkkkkkkkkkkkkkkk....",
    "..kCCCCCCCCCCCCCCCCCCCCCCCCkD...",
    "..kCkkkkkkkkkkkkkkkkkkkkkkCkD...",
    "..kCkssssssssssssssssssssskCkD..",
    "..kCkssssssssssssssssssssskCkD..",
    "..kCksssssssnnnsssssssssssskCkD.",
    "..kCkssssssnsssnssssssssssskCkD.",
    "..kCksssssnsssssnsssssssssskCkD.",
    "..kCkssssnsssssssnssssssssskCkD.",
    "..kCkssssssssssssssssssssskCkD..",
    "..kCkssssssssssssssssssssskCkD..",
    "..kCkkkkkkkkkkkkkkkkkkkkkkCkD...",
    "..kCCCCCCCCCCCCCCCCCCCCCCCCkD...",
    "..kkkkkkkkkkkkkkkkkkkkkkkkkkD...",
    "...DDDDDDDkCCCCCCkDDDDDDDDDD....",
    "..........kCCCCCCkD.............",
    "..........kCCCCCCkD.............",
    ".....kkkkkkkkkkkkkkkkkk.........",
    ".....kCCCCCCCCCCCCCCCCkD........",
    ".....kCkkkkkkkkkkkkkkCkD........",
    ".....kCkgggggggggggkkCkD........",
    ".....kCkkkkkkkkkkkkkkCkD........",
    ".....kCCCCCCCCCCCCCCCCkD........",
    ".....kkkkkkkkkkkkkkkkkkD........",
    "......DDDDDDDDDDDDDDDDDD........",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Imagen / foto */
  image: [
    "................................",
    "................................",
    "................................",
    "...kkkkkkkkkkkkkkkkkkkkkkkkkk...",
    "...kwwwwwwwwwwwwwwwwwwwwwwwwkD..",
    "...kwnnnnnnnnnnnnnnnnnnnnnnwkD..",
    "...kwnnnnYYnnnnnnnnnnnnnnnnwkD..",
    "...kwnnnYYYYnnnnnnnnnnnnnnnwkD..",
    "...kwnnnnYYnnnnnnnnnnnnnnnnwkD..",
    "...kwnnnnnnnnnnnnnnnnnnnnnnwkD..",
    "...kwnnnnnnnnnnnnnnnnknnnnnwkD..",
    "...kwnnnnnnnnnnnnnnnkEknnnnwkD..",
    "...kwnnnnnnnnnnnnnnkEEEknnnwkD..",
    "...kwnnnnnnnnnnnnnkEEEEEknnwkD..",
    "...kwnnnnnnnnnnnnkEEEEEEEknwkD..",
    "...kwnnnnnnknnnnkEEEEEEEEEkwkD..",
    "...kwnnnnnkEknnkEEEEEEEEEEEkkD..",
    "...kwnnnnkEEEkkEEEEEEEEEEEEEkD..",
    "...kwnnnkEEEEEEEEEEEEEEEEEEEkD..",
    "...kwnnkEEEEEEEEEEEEEEEEEEEEkD..",
    "...kwnkEEEEEEEEEEEEEEEEEEEEEkD..",
    "...kwkEEEEEEEEEEEEEEEEEEEEEEkD..",
    "...kkkkkkkkkkkkkkkkkkkkkkkkkkD..",
    "....DDDDDDDDDDDDDDDDDDDDDDDDDD..",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Disquete */
  disk: [
    "................................",
    "................................",
    "...kkkkkkkkkkkkkkkkkkkkkkkkkk...",
    "...kdddddddddddddddddddddddDkD..",
    "...kdkkkkkkkkkkkkkkkkkkkkkdDkD..",
    "...kdkCCCCCCCCCCCCCCCCCCCkdDkD..",
    "...kdkCCCCkkkkkkkkkkCCCCCkdDkD..",
    "...kdkCCCCkGGGGGGGGkCCCCCkdDkD..",
    "...kdkCCCCkGGGGGGGGkCCCCCkdDkD..",
    "...kdkCCCCkGGGGGGGGkCCCCCkdDkD..",
    "...kdkCCCCkkkkkkkkkkCCCCCkdDkD..",
    "...kdkCCCCCCCCCCCCCCCCCCCkdDkD..",
    "...kdkkkkkkkkkkkkkkkkkkkkkdDkD..",
    "...kdddddddddddddddddddddddDkD..",
    "...kddddddddddddddddddddddddkD..",
    "...kdkkkkkkkkkkkkkkkkkkkkkkdkD..",
    "...kdkwwwwwwwwwwwwwwwwwwwwkdkD..",
    "...kdkwwwwwwwwwwwwwwwwwwwwkdkD..",
    "...kdkwwGGGGGGGGGGGGGGGGwwkdkD..",
    "...kdkwwwwwwwwwwwwwwwwwwwwkdkD..",
    "...kdkwwGGGGGGGGGGGGGGGGwwkdkD..",
    "...kdkwwwwwwwwwwwwwwwwwwwwkdkD..",
    "...kdkwwGGGGGGGGGGGGGGGGwwkdkD..",
    "...kdkwwwwwwwwwwwwwwwwwwwwkdkD..",
    "...kdkkkkkkkkkkkkkkkkkkkkkkdkD..",
    "...kkkkkkkkkkkkkkkkkkkkkkkkkkD..",
    "....DDDDDDDDDDDDDDDDDDDDDDDDDD..",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Disco compacto */
  cd: [
    "................................",
    "................................",
    "..........kkkkkkkkkk............",
    ".......kkkkppppppppkkkk.........",
    ".....kkppppppppppppppppkk.......",
    "....kppppppppppppppppppppk......",
    "...kppppppRRRRppppEEppppppk.....",
    "..kppppRRRRRRRRppEEEEpppppppk...",
    "..kpppRRRRppppppppEEEEppppppkD..",
    ".kpppppppppkkkkkkppppEEpppppkD..",
    ".kpppppppkkwwwwwwkkpppppppppkD..",
    ".kppppppkwwwwwwwwwwkppppppppkD..",
    ".kpppppkwwwwwwwwwwwwkpppppppkD..",
    ".kpppppkwwwwwwwwwwwwkpppppppkD..",
    ".kpppppkwwwwwwwwwwwwkpppppppkD..",
    ".kppppppkwwwwwwwwwwkppppppppkD..",
    ".kpppppppkkwwwwwwkkpppppppppkD..",
    ".kppppSSpppkkkkkkppppYYYYppkD...",
    "..kppSSSSppppppppppYYYYYYppkD...",
    "..kpppSSSSpppppppppppYYYYppkD...",
    "...kppppSSppppppppppppYYppkD....",
    "....kppppppppppppppppppppkD.....",
    ".....kkppppppppppppppppkkD......",
    ".......kkkkppppppppkkkkD........",
    "..........kkkkkkkkkkD...........",
    "...........DDDDDDDDD............",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Tira de película */
  video: [
    "................................",
    "................................",
    "................................",
    "...kkkkkkkkkkkkkkkkkkkkkkkkkk...",
    "...kDDDDDDDDDDDDDDDDDDDDDDDDkD..",
    "...kDwwDDwwDDwwDDwwDDwwDDwwDkD..",
    "...kDwwDDwwDDwwDDwwDDwwDDwwDkD..",
    "...kDDDDDDDDDDDDDDDDDDDDDDDDkD..",
    "...kDDDDDDDDDDDDDDDDDDDDDDDDkD..",
    "...kDDGGGGGGGGGGGGGGGGGGGGDDkD..",
    "...kDDGGGGGGGGGGGGGGGGGGGGDDkD..",
    "...kDDGGGGGGkkkkGGGGGGGGGGDDkD..",
    "...kDDGGGGGkkkkkkGGGGGGGGGDDkD..",
    "...kDDGGGGkkkkkkkkGGGGGGGGDDkD..",
    "...kDDGGGGGkkkkkkGGGGGGGGGDDkD..",
    "...kDDGGGGGGkkkkGGGGGGGGGGDDkD..",
    "...kDDGGGGGGGGGGGGGGGGGGGGDDkD..",
    "...kDDGGGGGGGGGGGGGGGGGGGGDDkD..",
    "...kDDDDDDDDDDDDDDDDDDDDDDDDkD..",
    "...kDDDDDDDDDDDDDDDDDDDDDDDDkD..",
    "...kDwwDDwwDDwwDDwwDDwwDDwwDkD..",
    "...kDwwDDwwDDwwDDwwDDwwDDwwDkD..",
    "...kDDDDDDDDDDDDDDDDDDDDDDDDkD..",
    "...kkkkkkkkkkkkkkkkkkkkkkkkkkD..",
    "....DDDDDDDDDDDDDDDDDDDDDDDDDD..",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],

  /* Documento PDF (currículum), papelera y altavoz de la bandeja */
  pdf: [
    "................................",
    "................................",
    "......kkkkkkkkkkkkkkkk..........",
    "......kwwwwwwwwwwwwwwkk.........",
    "......kwwwwwwwwwwwwwwkCk........",
    "......kwwwwwwwwwwwwwwkCCk.......",
    "......kwwwwwwwwwwwwwwkCCCk......",
    "......kwwwwwwwwwwwwwwkkkkkk.....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwggggggggggggggwwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwggggggggggggwwwwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwgggggggggggggggwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "...qqqqqqqqqqqqqqqqqqqqwwwkD....",
    "...rrrrwwrrwwrrwwwrrrrrwwwkD....",
    "...rrrrwrwrwrwrwrrrrrrrwwwkD....",
    "...rrrrwwrrwrwrwwrrrrrrwwwkD....",
    "...rrrrwrrrwrwrwrrrrrrrwwwkD....",
    "...rrrrwrrrwwrrwrrrrrrrwwwkD....",
    "...qqqqqqqqqqqqqqqqqqqqwwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kwwggggggggggwwwwwwwkD....",
    "......kwwwwwwwwwwwwwwwwwwwkD....",
    "......kkkkkkkkkkkkkkkkkkkkkD....",
    ".......DDDDDDDDDDDDDDDDDDDDD....",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],
  trash: [
    "................................",
    "................................",
    "................................",
    "...........kkkkkkkkkk...........",
    "...........kCCCCCCCCk...........",
    "....kkkkkkkkkkkkkkkkkkkkkkkk....",
    "....kwCCCCCCCCCCCCCCCCCCCCGkD...",
    "....kGGGGGGGGGGGGGGGGGGGGGGkD...",
    "....kkkkkkkkkkkkkkkkkkkkkkkkD...",
    ".....kwCCGCCCGCCCGCCCGCCCGkD....",
    ".....kwCCGCCCGCCCGCCCGCCCGkD....",
    ".....kwCCGCCCGCCCGCCCGCCCGkD....",
    ".....kwCCGCCCGCCCGCCCGCCCGkD....",
    ".....kwCCGCCCGCCCGCCCGCCCGkD....",
    "......kwCGCCCGCCCGCCCGCCGkD.....",
    "......kwCGCCCGCCCGCCCGCCGkD.....",
    "......kwCGCCCGCCCGCCCGCCGkD.....",
    "......kwCGCCCGCCCGCCCGCCGkD.....",
    "......kwCGCCCGCCCGCCCGCCGkD.....",
    ".......kwGCCCGCCCGCCCGCGkD......",
    ".......kwGCCCGCCCGCCCGCGkD......",
    ".......kwGCCCGCCCGCCCGCGkD......",
    ".......kwGCCCGCCCGCCCGCGkD......",
    ".......kkkkkkkkkkkkkkkkkkD......",
    "........DDDDDDDDDDDDDDDDDD......",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
  ],
  sound: [
    "................",
    "......k.........",
    ".....kk.........",
    "....kwk....k....",
    "kkkkwwk.....k...",
    "kwwwwwk...k..k..",
    "kwwwwwk....k.k..",
    "kwwwwwk....k.k..",
    "kwwwwwk...k..k..",
    "kkkkwwk.....k...",
    "....kwk....k....",
    ".....kk.........",
    "......k.........",
    "................",
    "................",
    "................",
  ],
  mute: [
    "................",
    "......k.........",
    ".....kk.........",
    "....kwk.........",
    "kkkkwwk...r...r.",
    "kwwwwwk....r.r..",
    "kwwwwwk.....r...",
    "kwwwwwk....r.r..",
    "kwwwwwk...r...r.",
    "kkkkwwk.........",
    "....kwk.........",
    ".....kk.........",
    "......k.........",
    "................",
    "................",
    "................",
  ],
};

/* =========================================================
   CURSORES
   Mismo sistema de dibujo que los iconos, pero en 16x16: el
   navegador ignora los cursores de más de 32px en algunas
   plataformas, y cada píxel se pinta a 2x -> 32x32 justos.

   Van a PNG y no a SVG porque Safari no admite cursores SVG.
   ========================================================= */
const CURSOR_ZOOM = 2;

const CURSORS = {
  /* Flecha: la punta es el píxel (0,0) */
  arrow: [
    "k...............",
    "kk..............",
    "kwk.............",
    "kwwk............",
    "kwwwk...........",
    "kwwwwk..........",
    "kwwwwwk.........",
    "kwwwwwwk........",
    "kwwwwwwwk.......",
    "kwwwwwwwwk......",
    "kwwwwwkkkkk.....",
    "kwwkwwk.........",
    "kwk.kwwk........",
    "kk..kwwk........",
    "k....kwwk.......",
    ".....kkkk.......",
  ],

  /* Mano: la punta del índice es el píxel (6,0) */
  hand: [
    "......kk........",
    ".....kwwk.......",
    ".....kwwk.......",
    ".....kwwk.......",
    ".....kwwk.......",
    ".....kwwkkk.....",
    ".....kwwkwwkk...",
    ".....kwwkwwkwwk.",
    "..kk.kwwkwwkwwk.",
    ".kwwkkwwwwwwwwk.",
    ".kwwwwwwwwwwwwk.",
    "..kwwwwwwwwwwwk.",
    "...kwwwwwwwwwwk.",
    "....kwwwwwwwwk..",
    "....kwwwwwwwwk..",
    ".....kkkkkkkkk..",
  ],

  /* Cursor de texto: el centro es el píxel (6,7) */
  text: [
    "................",
    "...kkkkkkk......",
    "...kwwwwwk......",
    "...kkkwkkk......",
    ".....kwk........",
    ".....kwk........",
    ".....kwk........",
    ".....kwk........",
    ".....kwk........",
    ".....kwk........",
    ".....kwk........",
    ".....kwk........",
    "...kkkwkkk......",
    "...kwwwwwk......",
    "...kkkkkkk......",
    "................",
  ],

  /* Redimensionar en diagonal: el centro es el píxel (8,8) */
  resize: [
    "................",
    ".kkkkkkkk.......",
    ".kwwwwwwk.......",
    ".kwwwwwk........",
    ".kwwwwk.........",
    ".kwwkwk.........",
    ".kwk.kwk........",
    ".kk...kwk.......",
    ".......kwk...kk.",
    "........kwk.kwwk",
    ".........kwkkwwk",
    "..........kwwwwk",
    ".........kwwwwwk",
    "........kwwwwwwk",
    ".......kkkkkkkkk",
    "................",
  ],

  /* Reloj de arena, mientras cargan los repos */
  busy: [
    "................",
    "..kkkkkkkkkk....",
    "..kwwwwwwwwk....",
    "..kwrrrrrrwk....",
    "...kwrrrrwk.....",
    "....kwrrwk......",
    ".....kwwk.......",
    ".....kwwk.......",
    ".....kwwk.......",
    ".....kwwk.......",
    "....kwwwwk......",
    "...kwrrrrwk.....",
    "..kwrrrrrrwk....",
    "..kwwwwwwwwk....",
    "..kkkkkkkkkk....",
    "................",
  ],
};

/* Pasa un dibujo a PNG en data: URI, sin suavizado */
function cursorPng(rows) {
  const n = Math.max(rows.length, ...rows.map((r) => r.length));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n * CURSOR_ZOOM;
  const g = canvas.getContext("2d");
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = PAL[row[x]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x * CURSOR_ZOOM, y * CURSOR_ZOOM, CURSOR_ZOOM, CURSOR_ZOOM);
    }
  });
  return canvas.toDataURL("image/png");
}

/* Inyecta las reglas. El cursor se hereda, así que basta con
   ponerlo en <html> y corregir los elementos que piden otro. */
function initCursors() {
  const mk = (rows, hx, hy) =>
    'url("' + cursorPng(rows) + '") ' + hx * CURSOR_ZOOM + " " + hy * CURSOR_ZOOM;

  let arrow, hand, text, resize, busy;
  try {
    arrow = mk(CURSORS.arrow, 0, 0);
    hand = mk(CURSORS.hand, 6, 0);
    text = mk(CURSORS.text, 6, 7);
    resize = mk(CURSORS.resize, 8, 8);
    busy = mk(CURSORS.busy, 7, 7);
  } catch (e) {
    return; // sin canvas se queda el cursor del sistema
  }

  const css = document.createElement("style");
  css.textContent =
    "html { cursor: " + arrow + ", default; }\n" +
    "a, button, summary, select, option, label.check, .repo-row," +
    ".d-icon, .folder-item, .etab, .tab, .mini, .tb-btn, .tray-btn," +
    ".win-btn, .btn, .start-list button, input[type=checkbox]," +
    "input[type=color], .input.color, select.input" +
    " { cursor: " + hand + ", pointer; }\n" +
    "input:not([type=checkbox]):not([type=color]), textarea" +
    " { cursor: " + text + ", text; }\n" +
    ".win-grip { cursor: " + resize + ", nwse-resize; }\n" +
    "body.is-busy, body.is-busy * { cursor: " + busy + ", wait; }\n";
  document.head.appendChild(css);
}

/* Convierte la rejilla en SVG. Une los píxeles seguidos del
   mismo color en un solo <rect>: si no, serían 1024 nodos por
   icono. El tamaño sale del propio dibujo, así conviven
   rejillas de 16 y de 32. */
const ICON_CACHE = {};

function pixelSvg(rows) {
  const size = Math.max(rows.length, ...rows.map((r) => r.length));
  let out =
    '<svg viewBox="0 0 ' + size + " " + size +
    '" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (!PAL[ch]) {
        x++;
        continue;
      }
      let len = 1;
      while (x + len < row.length && row[x + len] === ch) len++;
      out +=
        '<rect x="' + x + '" y="' + y + '" width="' + len +
        '" height="1" fill="' + PAL[ch] + '"/>';
      x += len;
    }
  });
  return out + "</svg>";
}

function iconSvg(key) {
  const name = PIXELS[key] ? key : "txt";
  if (!ICON_CACHE[name]) ICON_CACHE[name] = pixelSvg(PIXELS[name]);
  return ICON_CACHE[name];
}

// Los de 16x16 son de la bandeja: no se ofrecen para el escritorio
const ICON_KEYS = Object.keys(PIXELS).filter((k) => PIXELS[k].length >= 32);




/* =========================================================
   CONTENIDO DE FÁBRICA
   SKILLS y EDUCATION son los valores iniciales: desde el portal
   se editan y quedan en la config (config.skills, config.education).
   SOCIAL se cambia aquí.

   CV_URL: si subes tu currículum en PDF junto a index.html,
   pon aquí su nombre ("cv-andres-madrid.pdf") y la ventana del
   CV ofrecerá descargarlo. Vacío = se genera desde tus datos y
   se guarda con "Guardar como PDF".
   ========================================================= */
const CV_URL = "";

const SKILLS = [
  { es: "Frontend", en: "Frontend", items: ["JavaScript", "HTML/CSS"] },
  { es: "Backend", en: "Backend", items: ["Java", "Python"] },
  { es: "Bases de datos", en: "Databases", items: ["MySQL", "PostgreSQL"] },
  {
    es: "Herramientas",
    en: "Tools",
    items: ["GitHub", "Git", "Figma", "Claude", "VS Code", "Vercel"],
  },
];

const EDUCATION = [
  {
    title: { es: "Ingeniería de Sistemas", en: "Systems Engineering" },
    place: { es: "Universidad de la Costa", en: "Universidad de la Costa" },
    when: { es: "2025 - Presente", en: "2025 - Present" },
    state: { es: "En curso", en: "In progress" },
  },
  {
    title: {
      es: "Técnico en Desarrollo de Software y Aplicaciones Móviles",
      en: "Technician in Software and Mobile App Development",
    },
    place: {
      es: "Corporación Bolivariana del Norte",
      en: "Corporación Bolivariana del Norte",
    },
    when: { es: "2022 - 2024", en: "2022 - 2024" },
    state: { es: "Finalizado", en: "Completed" },
  },
];

const SOCIAL = [
  { label: "GitHub", url: "https://github.com/" + GITHUB_USER, icon: "github" },
  { label: "LinkedIn", url: LINKEDIN, icon: "globe" },
  { label: EMAIL, url: "mailto:" + EMAIL, icon: "mail" },
];

/* =========================================================
   ESCRITORIO POR DEFECTO
   ========================================================= */
const DEFAULT_DESKTOP = {
  wallpaper: { type: "color", value: "#000000", value2: "#2a0d0d", url: "" },
  showFx: true,
  projects: { selected: [] },
  skills: SKILLS,
  education: EDUCATION,
  // "sub" es la segunda línea en el lanzador del teléfono
  items: [
    {
      id: "about",
      type: "txt",
      icon: "info",
      name: { es: "Sobre mí.txt", en: "About me.txt" },
      sub: { es: "Quién soy y qué hago", en: "Who I am and what I do" },
      text: {
        es:
          "ANDRES MADRID\nDesarrollador de Software\n\n" +
          "Diseño sistemas escalables, seguros y eficientes, con experiencia\n" +
          "entregando soluciones en entornos altamente regulados:\n" +
          "construcción, mantenimiento eléctrico e insolvencia y conciliación.\n\n" +
          "Optimizo el rendimiento de los sistemas y acompaño a los equipos\n" +
          "para elevar su nivel técnico.\n\n" +
          "Santa Marta, Colombia.",
        en:
          "ANDRES MADRID\nSoftware Developer\n\n" +
          "I design scalable, secure and efficient systems, with experience\n" +
          "delivering solutions in highly regulated environments:\n" +
          "construction, electrical maintenance, and insolvency and conciliation.\n\n" +
          "I optimize system performance and support teams in raising their\n" +
          "technical level.\n\n" +
          "Santa Marta, Colombia.",
      },
    },
    {
      id: "projects",
      type: "app",
      app: "projects",
      icon: "folder",
      name: { es: "Proyectos", en: "Projects" },
    },
    {
      id: "skills",
      type: "app",
      app: "skills",
      icon: "tools",
      name: { es: "Habilidades", en: "Skills" },
    },
    {
      id: "education",
      type: "app",
      app: "education",
      icon: "edu",
      name: { es: "Educación", en: "Education" },
    },
    {
      id: "cv",
      type: "app",
      app: "cv",
      icon: "pdf",
      name: { es: "CV_Andres.pdf", en: "CV_Andres.pdf" },
    },
    {
      id: "contact",
      type: "app",
      app: "contact",
      icon: "mail",
      name: { es: "Contacto", en: "Contact" },
    },
    {
      id: "social",
      type: "app",
      app: "social",
      icon: "globe",
      name: { es: "Redes", en: "Links" },
    },
    {
      id: "mypc",
      type: "app",
      app: "mypc",
      icon: "pc",
      name: { es: "Mi PC", en: "My Computer" },
    },
    {
      id: "trash",
      type: "app",
      app: "trash",
      icon: "trash",
      name: { es: "Papelera", en: "Recycle Bin" },
    },
  ],
};

/* =========================================================
   IDIOMAS
   El HTML manda en español: harvestBaseLang() copia al
   diccionario lo escrito en index.html antes de traducir.
   El inglés sale de I18N.en y se mantiene a mano.
   ========================================================= */
const I18N = {
  es: {
    "meta.title": "Andres Madrid | Desarrollador de Software",
    "ui.start": "Inicio",
    "ui.linkedin": "Abrir mi perfil de LinkedIn",
    "ui.clock": "Hora de Colombia (America/Bogota)",
    "ui.admin": "Panel de administración",
    "ui.openLinkedin": "Abrir LinkedIn",
    "ui.closeAll": "Cerrar todas las ventanas",
    "ui.hint": "Doble clic en un icono para abrirlo",

    "win.min": "Minimizar",
    "win.max": "Maximizar",
    "win.close": "Cerrar",

    "app.projects.loading": "Cargando proyectos desde GitHub…",
    "app.projects.error":
      "No se pudieron cargar los proyectos. Míralos en github.com/" + GITHUB_USER,
    "app.projects.empty": "Todavía no hay repos públicos.",
    "app.projects.nodesc": "Sin descripción todavía.",
    "app.projects.code": "Ver código",
    "app.projects.live": "Ver web",
    "app.projects.updated": "Último cambio",
    "app.projects.count": "{n} proyectos",

    "app.skills.title": "Habilidades",
    "app.edu.title": "Educación",
    "app.social.title": "Encuéntrame aquí",

    "tab.all": "Todo",
    "tab.live": "Con web",
    "st.files": "{n} elementos",
    "st.items": "{n} elementos",
    "st.chars": "caracteres",
    "st.skills": "{n} tecnologías en {g} grupos",
    "col.title": "Título",
    "col.place": "Centro",
    "col.when": "Años",
    "col.state": "Estado",
    "col.lang": "Lenguaje",
    "col.stars": "Estrellas",

    "win.back": "Atrás",
    "ui.welcome": "Bienvenida",
    "ui.sound.on": "Sonido: encendido",
    "ui.sound.off": "Sonido: apagado",

    "boot.sub": "Portafolio BIOS v1.4 · Santa Marta, CO",
    "boot.mem": "Detectando memoria",
    "boot.skills": "Cargando habilidades",
    "boot.repos": "Montando /proyectos",
    "boot.reposN": "{n} repos (GitHub)",
    "boot.reposWait": "conectando con GitHub…",
    "boot.reposErr": "GitHub no responde",
    "boot.clock": "Sincronizando reloj",
    "boot.desk": "Iniciando escritorio",

    "app.welcome.hi": "Hola, soy Andres Madrid",
    "app.welcome.text":
      "Desarrollador de software en Santa Marta, Colombia. Esto es mi portafolio con forma de escritorio: doble clic en un icono para abrirlo.",
    "app.welcome.projects": "Ver proyectos",
    "app.welcome.about": "Sobre mí",
    "app.welcome.contact": "Contactar",
    "app.welcome.dont": "No volver a mostrar",
    "st.welcome": "Primera visita · se cierra con Esc · vuelve desde Inicio",

    "app.cv.save": "Guardar como PDF",
    "app.cv.download": "Descargar PDF",
    "app.cv.role": "Desarrollador de Software",
    "app.cv.profile": "Perfil",
    "app.cv.skills": "Habilidades",
    "app.cv.education": "Educación",
    "app.cv.projects": "Proyectos",
    "st.cv": "Vista previa · \"Guardar como PDF\" lo descarga",

    "app.mypc.system": "Sistema",
    "app.mypc.os": "Sistema operativo",
    "app.mypc.user": "Usuario",
    "app.mypc.place": "Ubicación",
    "app.mypc.time": "Hora local",
    "app.mypc.repos": "Proyectos públicos",
    "app.mypc.mem": "Memoria",
    "app.mypc.drives": "Unidades",
    "app.mypc.driveA": "A: Currículum",
    "app.mypc.driveC": "C: Proyectos",
    "app.mypc.driveD": "D: Documentos",
    "st.mypc": "Doble clic en una unidad para abrirla",

    "app.trash.empty":
      "La papelera está vacía. Aquí aparecen los repos de GitHub archivados o bifurcados.",
    "app.projects.shotAlt": "Vista previa de {name} en GitHub",

    "sub.folder": "{n} elementos",
    "sub.link": "Enlace",
    "sub.txt": "Archivo de texto",
    "sub.projects": "{n} proyectos de GitHub",
    "sub.loading": "Cargando…",
    "sub.skills": "Lenguajes y herramientas",
    "sub.education": "Estudios",
    "sub.contact": "Directo a mi correo",
    "sub.social": "GitHub y LinkedIn",
    "sub.cv": "Ver y guardar como PDF",
    "sub.mypc": "Sistema y unidades",
    "sub.trash": "{n} repos archivados",

    "admin.sk.name.es": "Grupo (español)",
    "admin.sk.name.en": "Grupo (inglés)",
    "admin.sk.items": "Tecnologías, separadas por coma",
    "admin.ed.title.es": "Título (español)",
    "admin.ed.title.en": "Título (inglés)",
    "admin.ed.place": "Centro",
    "admin.ed.when.es": "Años (español)",
    "admin.ed.when.en": "Años (inglés)",
    "admin.ed.state.es": "Estado (español)",
    "admin.ed.state.en": "Estado (inglés)",
    "admin.remove": "Quitar",

    "app.contact.title": "Escríbeme",
    "app.contact.hint":
      "Escribe tu mensaje y me llega directo al correo. Te respondo a la dirección que pongas.",
    "app.contact.name": "Nombre",
    "app.contact.name.ph": "Tu nombre",
    "app.contact.email": "Tu email",
    "app.contact.email.ph": "para poder responderte",
    "app.contact.subject": "Asunto",
    "app.contact.subject.ph": "Asunto del mensaje",
    "app.contact.message": "Mensaje",
    "app.contact.message.ph": "Cuéntame",
    "app.contact.send": "Enviar mensaje",
    "app.contact.choose": "¿Con qué correo lo envías?",
    "app.contact.via.web": "Se abre en otra pestaña con todo escrito",
    "app.contact.via.app": "App de correo del equipo",
    "app.contact.via.app.sub": "Outlook de escritorio, Correo, Thunderbird…",
    "app.contact.via.copy": "Copiar el mensaje",
    "app.contact.via.copy.sub": "Y pegarlo en cualquier correo",
    "app.contact.back": "← Volver a editar",
    "app.contact.to": "Para",
    "app.contact.opened":
      "Se abrió {app} en otra pestaña con todo escrito. Solo pulsa Enviar. ¿No se abrió? Revisa si el navegador bloqueó la ventana.",
    "app.contact.appHint":
      "Si no se abrió nada, este equipo no tiene app de correo: usa Gmail u Outlook.",
    "app.contact.copied": "Copiado. Pégalo en un correo nuevo a {mail}.",
    "app.contact.copyFail":
      "No se pudo copiar automáticamente: el texto está seleccionado abajo, cópialo con Ctrl+C.",
    "app.contact.toolong":
      "El mensaje es muy largo para la app de correo. Usa Gmail, Outlook o cópialo y mándalo a {mail}.",
    "app.contact.privacy": "Solo uso tus datos para responderte. Sin cookies ni listas de correo.",
    "app.contact.you": "Tú",
    "app.contact.sending": "Enviando mensaje…",
    "app.contact.done": "¡Mensaje enviado!",
    "app.contact.doneText":
      "Gracias, {name}. Ya está en mi bandeja: te respondo a {email} lo antes posible.",
    "app.contact.another": "Escribir otro",
    "app.contact.close": "Cerrar",
    "app.contact.invalid": "Revisa este campo: falta o no es válido.",
    "app.contact.fail.off": "El envío directo no está disponible ahora mismo.",
    "app.contact.fail.network": "No hubo conexión con el servidor.",
    "app.contact.fail.server": "El servidor de correo no respondió.",
    "app.contact.fail.busy": "Se enviaron muchos mensajes seguidos desde aquí.",
    "app.contact.planB": "Mándalo con tu correo: ya va todo escrito.",
    "app.contact.greet": "Hola, Andrés:",
    "app.contact.sentFrom": "Escrito en el formulario de {site}",

    "folder.empty": "Esta carpeta está vacía.",

    "admin.title": "Panel de administración",
    "admin.gate": "Entra con tu cuenta de Supabase. Lo que publiques lo ven todos al instante.",
    "admin.email": "Correo",
    "admin.pass": "Contraseña",
    "admin.enter": "Entrar",
    "admin.checking": "Comprobando…",
    "admin.badlogin": "Correo o contraseña incorrectos.",
    "admin.notadmin": "Esta cuenta no tiene permiso para publicar.",
    "admin.offline": "No se pudo conectar con Supabase. Revisa la conexión.",
    "admin.logout": "Cerrar sesión",
    "admin.legacy": "Este navegador tiene un escritorio guardado de antes, que solo veías tú.",
    "admin.legacy.load": "Cargarlo",
    "admin.legacy.drop": "Descartar",
    "admin.legacy.loaded": "Cargado. Pulsa Publicar para que lo vean todos.",
    "admin.tab.items": "Iconos",
    "admin.tab.look": "Fondo",
    "admin.tab.repos": "Proyectos",
    "admin.items.hint":
      "Los elementos con carpeta padre salen dentro de esa carpeta, no en el escritorio.",
    "admin.items.add": "+ Nuevo elemento",
    "admin.items.none": "No hay elementos. Añade el primero.",
    "admin.f.name.es": "Nombre (español)",
    "admin.f.name.en": "Nombre (inglés)",
    "admin.f.type": "Tipo",
    "admin.f.icon": "Icono",
    "admin.f.parent": "Dentro de",
    "admin.f.app": "Contenido especial",
    "admin.f.url": "Dirección (URL)",
    "admin.f.text.es": "Texto (español)",
    "admin.f.text.en": "Texto (inglés)",
    "admin.f.save": "Guardar elemento",
    "admin.f.cancel": "Cancelar",
    "admin.f.desktop": "El escritorio",
    "admin.wp.type": "Tipo de fondo",
    "admin.wp.color": "Color",
    "admin.wp.color2": "Segundo color",
    "admin.wp.url": "Dirección de la imagen",
    "admin.wp.fx": "Mostrar el caza TIE y la Estrella de la Muerte",
    "admin.wp.hint": "El fondo cambia al instante aquí. Pulsa Publicar abajo para que lo vean todos.",
    "admin.repos.hint":
      "Marca los repos que quieres mostrar en Proyectos. Sin nada marcado, salen todos.",
    "admin.repos.wait": "Los repos aún no han cargado.",
    "admin.reset": "Restablecer",
    "admin.export": "Copia (desktop.json)",
    "admin.save": "Publicar",
    "admin.saving": "Publicando…",
    "admin.saved": "Publicado: ya lo ven todos.",
    "admin.saveFail": "No se pudo publicar: {msg}",
    "admin.resetAsk":
      "¿Volver al escritorio de fábrica? Se publica para todos al instante.",
    "admin.count": "{n} elementos · {r} repos marcados",
    "admin.exported":
      "Descargado. Es una copia de seguridad: lo publicado vive en Supabase.",

    "aria.lang": "Cambiar idioma",
    "aria.close": "Cerrar",
  },

  en: {
    "meta.title": "Andres Madrid | Software Developer",
    "ui.start": "Start",
    "ui.linkedin": "Open my LinkedIn profile",
    "ui.clock": "Colombia time (America/Bogota)",
    "ui.admin": "Admin panel",
    "ui.openLinkedin": "Open LinkedIn",
    "ui.closeAll": "Close all windows",
    "ui.hint": "Double-click an icon to open it",

    "win.min": "Minimize",
    "win.max": "Maximize",
    "win.close": "Close",

    "app.projects.loading": "Loading projects from GitHub…",
    "app.projects.error":
      "Projects could not be loaded. See them at github.com/" + GITHUB_USER,
    "app.projects.empty": "No public repos yet.",
    "app.projects.nodesc": "No description yet.",
    "app.projects.code": "View code",
    "app.projects.live": "View site",
    "app.projects.updated": "Last change",
    "app.projects.count": "{n} projects",

    "app.skills.title": "Skills",
    "app.edu.title": "Education",
    "app.social.title": "Find me here",

    "tab.all": "All",
    "tab.live": "Live",
    "st.files": "{n} items",
    "st.items": "{n} items",
    "st.chars": "characters",
    "st.skills": "{n} technologies in {g} groups",
    "col.title": "Title",
    "col.place": "School",
    "col.when": "Years",
    "col.state": "State",
    "col.lang": "Language",
    "col.stars": "Stars",

    "win.back": "Back",
    "ui.welcome": "Welcome",
    "ui.sound.on": "Sound: on",
    "ui.sound.off": "Sound: off",
    "aria.sound": "Sound",

    "boot.skip": "Press any key to skip",
    "boot.sub": "Portfolio BIOS v1.4 · Santa Marta, CO",
    "boot.mem": "Detecting memory",
    "boot.skills": "Loading skills",
    "boot.repos": "Mounting /projects",
    "boot.reposN": "{n} repos (GitHub)",
    "boot.reposWait": "connecting to GitHub…",
    "boot.reposErr": "GitHub is not responding",
    "boot.clock": "Syncing clock",
    "boot.desk": "Starting desktop",

    "launcher.role": "Software developer · Santa Marta, Colombia",
    "launcher.hint": "Tap an item to open it",

    "app.welcome.hi": "Hi, I'm Andres Madrid",
    "app.welcome.text":
      "Software developer in Santa Marta, Colombia. This is my portfolio shaped like a desktop: double-click an icon to open it.",
    "app.welcome.projects": "See projects",
    "app.welcome.about": "About me",
    "app.welcome.contact": "Contact",
    "app.welcome.dont": "Don't show again",
    "st.welcome": "First visit · closes with Esc · reopen from Start",

    "app.cv.save": "Save as PDF",
    "app.cv.download": "Download PDF",
    "app.cv.role": "Software Developer",
    "app.cv.profile": "Profile",
    "app.cv.skills": "Skills",
    "app.cv.education": "Education",
    "app.cv.projects": "Projects",
    "st.cv": "Preview · \"Save as PDF\" downloads it",

    "app.mypc.system": "System",
    "app.mypc.os": "Operating system",
    "app.mypc.user": "User",
    "app.mypc.place": "Location",
    "app.mypc.time": "Local time",
    "app.mypc.repos": "Public projects",
    "app.mypc.mem": "Memory",
    "app.mypc.drives": "Drives",
    "app.mypc.driveA": "A: Résumé",
    "app.mypc.driveC": "C: Projects",
    "app.mypc.driveD": "D: Documents",
    "st.mypc": "Double-click a drive to open it",

    "app.trash.empty":
      "The recycle bin is empty. Archived or forked GitHub repos show up here.",
    "app.projects.shotAlt": "Preview of {name} on GitHub",

    "sub.folder": "{n} items",
    "sub.link": "Link",
    "sub.txt": "Text file",
    "sub.projects": "{n} GitHub projects",
    "sub.loading": "Loading…",
    "sub.skills": "Languages and tools",
    "sub.education": "Studies",
    "sub.contact": "Straight to my inbox",
    "sub.social": "GitHub and LinkedIn",
    "sub.cv": "View and save as PDF",
    "sub.mypc": "System and drives",
    "sub.trash": "{n} archived repos",

    "admin.tab.skills": "Skills",
    "admin.tab.edu": "Education",
    "admin.sk.hint":
      "Each group shows as a block in the Skills window, the résumé and the boot screen. Separate technologies with commas.",
    "admin.sk.add": "+ Group",
    "admin.sk.name.es": "Group (Spanish)",
    "admin.sk.name.en": "Group (English)",
    "admin.sk.items": "Technologies, comma-separated",
    "admin.ed.hint": "Each entry shows as a row in the Education window and the résumé.",
    "admin.ed.add": "+ Entry",
    "admin.ed.title.es": "Title (Spanish)",
    "admin.ed.title.en": "Title (English)",
    "admin.ed.place": "School",
    "admin.ed.when.es": "Years (Spanish)",
    "admin.ed.when.en": "Years (English)",
    "admin.ed.state.es": "Status (Spanish)",
    "admin.ed.state.en": "Status (English)",
    "admin.remove": "Remove",

    "app.contact.title": "Write to me",
    "app.contact.hint":
      "Write your message and it lands straight in my inbox. I'll reply to the address you give.",
    "app.contact.name": "Name",
    "app.contact.name.ph": "Your name",
    "app.contact.email": "Your email",
    "app.contact.email.ph": "so I can reply",
    "app.contact.subject": "Subject",
    "app.contact.subject.ph": "Subject of your message",
    "app.contact.message": "Message",
    "app.contact.message.ph": "Tell me about it",
    "app.contact.send": "Send message",
    "app.contact.choose": "Which mail do you want to send it with?",
    "app.contact.via.web": "Opens in a new tab, fully written",
    "app.contact.via.app": "Mail app on this computer",
    "app.contact.via.app.sub": "Outlook desktop, Mail, Thunderbird…",
    "app.contact.via.copy": "Copy the message",
    "app.contact.via.copy.sub": "And paste it into any mail",
    "app.contact.back": "← Back to editing",
    "app.contact.to": "To",
    "app.contact.opened":
      "{app} opened in a new tab, fully written. Just hit Send. Didn't open? Check whether the browser blocked the window.",
    "app.contact.appHint":
      "If nothing opened, this computer has no mail app: use Gmail or Outlook.",
    "app.contact.copied": "Copied. Paste it into a new mail to {mail}.",
    "app.contact.copyFail":
      "Could not copy automatically: the text is selected below, copy it with Ctrl+C.",
    "app.contact.toolong":
      "The message is too long for the mail app. Use Gmail, Outlook or copy it and send it to {mail}.",
    "app.contact.privacy": "I only use your details to reply. No cookies, no mailing lists.",
    "app.contact.you": "You",
    "app.contact.sending": "Sending message…",
    "app.contact.done": "Message sent!",
    "app.contact.doneText":
      "Thanks, {name}. It's in my inbox: I'll reply to {email} as soon as I can.",
    "app.contact.another": "Write another",
    "app.contact.close": "Close",
    "app.contact.invalid": "Check this field: it's missing or not valid.",
    "app.contact.fail.off": "Direct sending isn't available right now.",
    "app.contact.fail.network": "Couldn't reach the server.",
    "app.contact.fail.server": "The mail server didn't respond.",
    "app.contact.fail.busy": "Too many messages were sent from here in a row.",
    "app.contact.planB": "Send it with your own mail: it's all written.",
    "app.contact.greet": "Hi Andrés,",
    "app.contact.sentFrom": "Written in the form at {site}",

    "folder.empty": "This folder is empty.",

    "admin.title": "Admin panel",
    "admin.gate": "Sign in with your Supabase account. Whatever you publish shows for everyone instantly.",
    "admin.email": "Email",
    "admin.pass": "Password",
    "admin.enter": "Sign in",
    "admin.checking": "Checking…",
    "admin.badlogin": "Wrong email or password.",
    "admin.notadmin": "This account isn't allowed to publish.",
    "admin.offline": "Couldn't reach Supabase. Check your connection.",
    "admin.logout": "Sign out",
    "admin.legacy": "This browser has a desktop saved earlier that only you could see.",
    "admin.legacy.load": "Load it",
    "admin.legacy.drop": "Discard",
    "admin.legacy.loaded": "Loaded. Press Publish so everyone sees it.",
    "admin.tab.items": "Icons",
    "admin.tab.look": "Wallpaper",
    "admin.tab.repos": "Projects",
    "admin.items.hint":
      "Items with a parent folder show inside that folder, not on the desktop.",
    "admin.items.add": "+ New item",
    "admin.items.none": "No items yet. Add the first one.",
    "admin.f.name.es": "Name (Spanish)",
    "admin.f.name.en": "Name (English)",
    "admin.f.type": "Type",
    "admin.f.icon": "Icon",
    "admin.f.parent": "Inside",
    "admin.f.app": "Built-in content",
    "admin.f.url": "Address (URL)",
    "admin.f.text.es": "Text (Spanish)",
    "admin.f.text.en": "Text (English)",
    "admin.f.save": "Save item",
    "admin.f.cancel": "Cancel",
    "admin.f.desktop": "The desktop",
    "admin.wp.type": "Wallpaper type",
    "admin.wp.color": "Color",
    "admin.wp.color2": "Second color",
    "admin.wp.url": "Image address",
    "admin.wp.fx": "Show the TIE fighter and the Death Star",
    "admin.wp.hint": "The wallpaper changes here right away. Press Publish below so everyone sees it.",
    "admin.repos.hint":
      "Tick the repos you want inside Projects. With none ticked, all of them show.",
    "admin.repos.wait": "Repos have not loaded yet.",
    "admin.reset": "Reset",
    "admin.export": "Backup (desktop.json)",
    "admin.save": "Publish",
    "admin.saving": "Publishing…",
    "admin.saved": "Published: everyone sees it now.",
    "admin.saveFail": "Couldn't publish: {msg}",
    "admin.resetAsk":
      "Go back to the factory desktop? It's published for everyone instantly.",
    "admin.count": "{n} items · {r} repos ticked",
    "admin.exported":
      "Downloaded. It's a backup: the published desktop lives in Supabase.",

    "aria.lang": "Change language",
    "aria.close": "Close",
  },
};

function t(key, vars) {
  let str = (I18N[lang] && I18N[lang][key]) || I18N[DEFAULT_LANG][key] || key;
  if (vars) {
    Object.keys(vars).forEach((k) => {
      str = str.split("{" + k + "}").join(vars[k]);
    });
  }
  return str;
}

/* Devuelve el texto en el idioma activo de un {es, en} */
function L(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] || value[DEFAULT_LANG] || "";
}

function harvestBaseLang() {
  const base = I18N[DEFAULT_LANG];
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    base[el.dataset.i18n] = el.textContent.trim().replace(/\s+/g, " ");
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    base[el.dataset.i18nTitle] = el.title;
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    base[el.dataset.i18nAria] = el.getAttribute("aria-label");
  });
  base["meta.title"] = document.title;
}

function applyLang(next) {
  lang = I18N[next] ? next : DEFAULT_LANG;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (e) {}

  document.documentElement.lang = lang;
  document.title = t("meta.title");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });

  const other = lang === "es" ? "EN" : "ES";
  const code = document.getElementById("lang-code");
  if (code) code.textContent = other;

  renderDesktop();
  renderStartMenu();
  renderLauncher();
  repaintOpenWindows();
  tickClock();
  if (document.getElementById("sound-ico").firstChild) paintSoundButton();
}

/* =========================================================
   CONFIG
   ========================================================= */
function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_DESKTOP));
}

/* Rellena lo que falte para que una config vieja o a medias
   no rompa el escritorio */
function normalizeConfig(raw) {
  const base = cloneDefaults();
  if (!raw || typeof raw !== "object") return base;

  const out = {
    wallpaper: Object.assign(base.wallpaper, raw.wallpaper || {}),
    showFx: raw.showFx !== false,
    projects: { selected: [] },
    items: Array.isArray(raw.items) && raw.items.length ? raw.items : base.items,
    skills: base.skills,
    education: base.education,
  };
  if (raw.projects && Array.isArray(raw.projects.selected)) {
    out.projects.selected = raw.projects.selected;
  }
  const obj = (v) => (v && typeof v === "object" ? v : { es: String(v || "") });
  out.items = out.items
    .filter((it) => it && it.id && it.type)
    .map((it) => ({
      id: String(it.id),
      type: it.type,
      app: it.app || null,
      icon: PIXELS[it.icon] ? it.icon : "txt",
      url: it.url || "",
      parent: it.parent || null,
      name: obj(it.name),
      text: obj(it.text),
      sub: it.sub ? obj(it.sub) : null,
    }));
  if (Array.isArray(raw.skills) && raw.skills.length) {
    out.skills = raw.skills
      .filter((g) => g && Array.isArray(g.items))
      .map((g) => ({
        es: String(g.es || ""),
        en: String(g.en || g.es || ""),
        items: g.items.map(String).filter(Boolean),
      }));
  }
  if (Array.isArray(raw.education) && raw.education.length) {
    out.education = raw.education
      .filter((e) => e && e.title)
      .map((e) => ({
        title: obj(e.title),
        place: obj(e.place),
        when: obj(e.when),
        state: obj(e.state),
      }));
  }
  return out;
}

/* Borrador que guardaba el portal en este navegador antes de
   Supabase. Ya no se usa para pintar: el portal ofrece publicarlo. */
function legacyDraft() {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) || "null");
    return raw ? normalizeConfig(raw) : null;
  } catch (e) {
    return null;
  }
}

async function publishedConfig() {
  try {
    const res = await fetch("desktop.json", { cache: "no-cache" });
    if (!res.ok) return null;
    return normalizeConfig(await res.json());
  } catch (e) {
    return null; // aún no existe el archivo: normal
  }
}

/* "{}" o vacío en Supabase = escritorio de fábrica */
const isBlank = (data) => !data || typeof data !== "object" || !Object.keys(data).length;

/* Lo publicado en Supabase, por REST: una petición, sin librería,
   para no retrasar el arranque. Devuelve el JSON tal cual,
   o undefined si no hubo respuesta. */
async function fetchRemoteData() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/" + CFG_TABLE + "?id=eq." + CFG_ROW + "&select=data",
      { headers: { apikey: SUPABASE_KEY }, cache: "no-store", signal: ctrl.signal }
    );
    if (!res.ok) return undefined;
    const rows = await res.json();
    return rows.length ? rows[0].data || {} : {};
  } catch (e) {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

function cacheRemoteData(data) {
  try {
    localStorage.setItem(CFG_CACHE_KEY, JSON.stringify(data || {}));
  } catch (e) {}
}

function cachedRemoteData() {
  try {
    const raw = localStorage.getItem(CFG_CACHE_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch (e) {
    return undefined;
  }
}

/* Del JSON publicado a una config lista para pintar */
async function configFromData(data) {
  if (!isBlank(data)) return normalizeConfig(data);
  return (await publishedConfig()) || cloneDefaults();
}

/* ---------------------------------------------------------
   Cliente de Supabase (supabase-js desde jsDelivr, con SRI).
   Se carga después del arranque: lo necesitan el tiempo real
   y el inicio de sesión del portal, no la primera pintada.
   --------------------------------------------------------- */
let sbClient = null;
let sbLoading = null;

function getSupabase() {
  if (sbClient) return Promise.resolve(sbClient);
  if (!sbLoading) {
    sbLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SUPABASE_JS;
      s.integrity = SUPABASE_JS_SRI;
      s.crossOrigin = "anonymous";
      s.onload = () => {
        try {
          sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
          });
          resolve(sbClient);
        } catch (e) {
          reject(e);
        }
      };
      s.onerror = () => {
        sbLoading = null; // se podrá reintentar
        s.remove();
        reject(new Error("supabase-js no cargó"));
      };
      document.head.appendChild(s);
    });
  }
  return sbLoading;
}

/* JSON con las claves ordenadas: Postgres (jsonb) devuelve las
   claves en otro orden, y así dos configs iguales comparan igual */
function stableJson(v) {
  if (Array.isArray(v)) return "[" + v.map(stableJson).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableJson(v[k])).join(",") + "}";
  }
  return JSON.stringify(v === undefined ? null : v);
}

/* Huella de la última versión publicada que vio esta pestaña. Solo
   se aplica lo que llega si es distinto: así no se pisan cambios
   del portal aún sin publicar cada vez que se vuelve a la pestaña. */
let lastRemote = null;

/* Cambia la config por otra y repinta lo que dependa de ella,
   sin tocar lo que el visitante esté escribiendo en Contacto */
function applyConfig(next) {
  if (stableJson(next) === stableJson(normalizeConfig(config))) return false;
  const before = new Set(config.items.map((it) => it.id));
  config = next;
  applyWallpaper();
  renderDesktop();
  renderStartMenu();
  renderLauncher();
  // Ventanas de elementos que ya no existen: se cierran
  [...openWins.keys()].forEach((id) => {
    if (before.has(id) && !itemById(id)) closeWin(id);
  });
  repaintOpenWindows({ keepForms: true });
  if (!document.getElementById("admin-overlay").hidden && !document.getElementById("admin-panel-body").hidden) {
    adminUnlocked();
  }
  return true;
}

/* Llega una versión publicada (al cargar, en vivo o al volver a la pestaña) */
async function receiveRemote(data) {
  if (data === undefined) return;
  cacheRemoteData(data);
  const next = await configFromData(data);
  const mark = stableJson(next);
  if (mark === lastRemote) return;
  lastRemote = mark;
  applyConfig(next);
}

async function refreshRemote() {
  receiveRemote(await fetchRemoteData());
}

/* Tiempo real: Supabase avisa de cada cambio en la fila del
   escritorio y aquí se aplica sin recargar la página */
async function startLiveConfig() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshRemote(); // lo que pasó en segundo plano
  });
  try {
    const sb = await getSupabase();
    sb.channel("site-config")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CFG_TABLE, filter: "id=eq." + CFG_ROW },
        (payload) => {
          if (payload.new && "data" in payload.new) receiveRemote(payload.new.data);
          else refreshRemote();
        }
      )
      .subscribe((status) => {
        // Al (re)conectar se pide la versión actual por si algo se perdió
        if (status === "SUBSCRIBED") refreshRemote();
      });
  } catch (e) {
    // Sin supabase-js (bloqueado o sin red): queda lo cargado al inicio
  }
}

/* Publica la config para todos. Necesita sesión de admin.
   Devuelve la config tal como la verán las visitas. */
async function publishData(data) {
  const sb = await getSupabase();
  const { error } = await sb.from(CFG_TABLE).upsert({ id: CFG_ROW, data: data });
  if (error) throw error;
  cacheRemoteData(data);
  const next = await configFromData(data);
  lastRemote = stableJson(next); // el aviso en vivo de este cambio ya no hace nada
  return next;
}

/* =========================================================
   FONDO
   ========================================================= */
function applyWallpaper() {
  const d = document.getElementById("desktop");
  const wp = config.wallpaper;
  d.style.backgroundImage = "none";
  d.style.backgroundColor = "#000";

  if (wp.type === "gradient") {
    d.style.backgroundImage =
      "linear-gradient(160deg, " + wp.value + " 0%, " + wp.value2 + " 100%)";
  } else if (wp.type === "image" && wp.url) {
    // Las comillas se escapan para que una URL rara no rompa el CSS
    d.style.backgroundImage = 'url("' + wp.url.replace(/["\\]/g, encodeURIComponent) + '")';
  } else {
    d.style.backgroundColor = wp.value || "#000";
  }

  document.getElementById("sw-fx").hidden = !config.showFx;
}

/* =========================================================
   ESCRITORIO E ICONOS
   ========================================================= */
function childrenOf(parentId) {
  return config.items.filter((it) => (it.parent || null) === (parentId || null));
}

function itemById(id) {
  return config.items.find((it) => it.id === id) || null;
}

function makeIconButton(item, cls) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = cls;
  btn.dataset.id = item.id;

  const img = document.createElement("span");
  img.className = cls === "d-icon" ? "d-icon-img" : "";
  img.innerHTML = iconSvg(item.icon);
  btn.appendChild(img);

  const label = document.createElement("span");
  label.className = cls === "d-icon" ? "d-icon-label" : "";
  label.textContent = L(item.name);
  btn.appendChild(label);

  // Doble clic como en un escritorio; un toque basta en móvil
  let lastTap = 0;
  btn.addEventListener("dblclick", () => openItem(item));
  btn.addEventListener("click", (e) => {
    if (e.detail === 0) return openItem(item); // teclado (Enter/Espacio)
    const now = Date.now();
    if (isTouch() || now - lastTap < 400) openItem(item);
    lastTap = now;
  });
  return btn;
}

function isTouch() {
  return window.matchMedia("(hover: none)").matches;
}

function renderDesktop() {
  const grid = document.getElementById("icon-grid");
  grid.innerHTML = "";
  childrenOf(null).forEach((item) => {
    grid.appendChild(makeIconButton(item, "d-icon"));
  });
  markOpenIcons();
}

function markOpenIcons() {
  document.querySelectorAll(".d-icon").forEach((el) => {
    el.classList.toggle("is-open", openWins.has(el.dataset.id));
  });
}

/* =========================================================
   GESTOR DE VENTANAS
   ========================================================= */
const openWins = new Map(); // id -> { el, item, btn, opener }
let zTop = 10;
let cascade = 0;
let winSeq = 0; // para ids únicos de título (aria-labelledby)

const POS_KEY = "win-pos";

function isMobile() {
  return window.matchMedia("(max-width: 640px)").matches;
}

/* Posición y tamaño de cada ventana, para que al volver el
   escritorio esté como se dejó. En móvil no: ahí las ventanas
   ocupan toda la pantalla. */
function loadPositions() {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

function savePosition(id, el) {
  if (isMobile() || el.classList.contains("is-max")) return;
  const all = loadPositions();
  all[id] = {
    x: el.offsetLeft,
    y: el.offsetTop,
    w: el.offsetWidth,
    h: el.offsetHeight,
  };
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(all));
  } catch (e) {}
}

/* Lo que se puede enfocar dentro de una ventana */
const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function activeWinId() {
  let top = null;
  openWins.forEach((w, id) => {
    if (w.el.classList.contains("is-active") && !w.el.classList.contains("is-min")) top = id;
  });
  return top;
}

function openItem(item) {
  if (item.type === "link") {
    if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (openWins.has(item.id)) {
    const w = openWins.get(item.id);
    w.el.classList.remove("is-min");
    focusWin(item.id);
    return;
  }
  createWindow(item);
}

function createWindow(item) {
  const el = document.createElement("section");
  el.className = "win";
  el.dataset.id = item.id;

  // Posición guardada, o en cascada; nunca fuera de la pantalla
  const saved = loadPositions()[item.id];
  const vw = window.innerWidth;
  const vh = window.innerHeight - 40; // menos la barra de tareas
  let w = Math.min(item.w || 560, vw - 40);
  let h = Math.min(item.h || 420, vh - 80);
  let x, y;
  if (saved && !isMobile()) {
    w = Math.min(saved.w, vw - 16);
    h = Math.min(saved.h, vh - 16);
    x = Math.min(Math.max(8, saved.x), vw - w - 8);
    y = Math.min(Math.max(8, saved.y), vh - h - 8);
  } else if (item.center) {
    x = Math.round((vw - w) / 2);
    y = Math.max(8, Math.round((vh - h) / 2.4));
  } else {
    const off = (cascade % 6) * 26;
    cascade++;
    x = Math.max(8, 48 + off);
    y = Math.max(8, 32 + off);
  }
  el.style.width = w + "px";
  el.style.height = h + "px";
  el.style.left = x + "px";
  el.style.top = y + "px";

  // Accesibilidad: cada ventana es un diálogo no modal con título
  const titleId = "wt-" + ++winSeq;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-labelledby", titleId);
  el.tabIndex = -1;

  el.innerHTML =
    '<div class="win-bar">' +
    '<button type="button" class="win-back">←</button>' +
    '<span class="win-ico" aria-hidden="true"></span>' +
    '<span class="win-title" id="' + titleId + '"></span>' +
    '<span class="win-controls">' +
    '<button type="button" class="win-btn" data-act="min">_</button>' +
    '<button type="button" class="win-btn" data-act="max">□</button>' +
    '<button type="button" class="win-btn" data-act="close">✕</button>' +
    "</span></div>" +
    '<div class="win-body"></div>' +
    '<div class="win-status" role="status"></div>' +
    '<div class="win-grip" aria-hidden="true"></div>';

  el.querySelector(".win-ico").innerHTML = iconSvg(item.icon);
  el.querySelector(".win-title").textContent = L(item.name);
  [["min", "win.min"], ["max", "win.max"], ["close", "win.close"]].forEach(([act, key]) => {
    const b = el.querySelector('[data-act="' + act + '"]');
    b.title = t(key);
    b.setAttribute("aria-label", t(key));
  });
  const back = el.querySelector(".win-back");
  back.setAttribute("aria-label", t("win.back"));
  back.appendChild(document.createTextNode(" " + t("win.back")));

  document.getElementById("windows").appendChild(el);

  // Botón en la barra de tareas
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tb-btn is-down";
  btn.innerHTML = '<span class="tb-ico"></span><span></span>';
  btn.querySelector(".tb-ico").innerHTML = iconSvg(item.icon);
  btn.querySelector(".tb-ico").style.cssText = "width:14px;height:14px;flex-shrink:0";
  btn.querySelector(".tb-ico svg").style.cssText = "width:100%;height:100%;display:block";
  btn.lastElementChild.textContent = L(item.name);
  btn.addEventListener("click", () => toggleWin(item.id));
  document.getElementById("task-buttons").appendChild(btn);

  // Quién abrió la ventana: al cerrarla, el foco vuelve ahí
  const opener = document.activeElement;
  openWins.set(item.id, { el, item, btn, opener });

  // Controles
  el.querySelector('[data-act="close"]').addEventListener("click", () => requestClose(item.id));
  back.addEventListener("click", () => requestClose(item.id));
  el.querySelector('[data-act="min"]').addEventListener("click", () => minimizeWin(item.id));
  el.querySelector('[data-act="max"]').addEventListener("click", () => {
    el.classList.toggle("is-max");
  });
  el.addEventListener("pointerdown", () => focusWin(item.id), true);
  el.addEventListener("focusin", () => {
    if (!el.classList.contains("is-active")) focusWin(item.id);
  });

  makeDraggable(el, () => savePosition(item.id, el));
  makeResizable(el, () => savePosition(item.id, el));
  renderWindowBody(item, el.querySelector(".win-body"));

  focusWin(item.id);
  markOpenIcons();
  playSound("open");

  // En móvil la ventana ocupa la pantalla: el botón Atrás del
  // teléfono debe cerrarla, no salir del portafolio
  if (isMobile()) {
    try {
      history.pushState({ win: item.id }, "");
    } catch (e) {}
  }

  // El foco entra en la ventana: primer control, o la ventana
  const first = el.querySelector(".win-body " + FOCUSABLE.split(", ").join(", .win-body "));
  (first || el).focus({ preventScroll: true });
}

/* Cierre pedido por la persona (botón, Esc). En móvil pasa por el
   historial para que el botón Atrás del teléfono quede en su sitio. */
function requestClose(id) {
  if (isMobile() && history.state && history.state.win === id) {
    history.back(); // el popstate la cierra
    return;
  }
  closeWin(id);
}

function focusWin(id) {
  const w = openWins.get(id);
  if (!w) return;
  zTop++;
  w.el.style.zIndex = zTop;
  openWins.forEach((other, otherId) => {
    other.el.classList.toggle("is-active", otherId === id);
    other.btn.classList.toggle("is-down", otherId === id && !other.el.classList.contains("is-min"));
  });
}

function toggleWin(id) {
  const w = openWins.get(id);
  if (!w) return;
  const hidden = w.el.classList.contains("is-min");
  if (hidden) {
    w.el.classList.remove("is-min");
    focusWin(id);
  } else if (w.el.classList.contains("is-active")) {
    minimizeWin(id);
  } else {
    focusWin(id);
  }
}

function minimizeWin(id) {
  const w = openWins.get(id);
  if (!w) return;
  w.el.classList.add("is-min");
  w.el.classList.remove("is-active");
  w.btn.classList.remove("is-down");
}

function closeWin(id) {
  const w = openWins.get(id);
  if (!w) return;
  const hadFocus = w.el.contains(document.activeElement);
  w.el.remove();
  w.btn.remove();
  openWins.delete(id);
  markOpenIcons();
  playSound("close");

  // Si el foco estaba dentro, vuelve a quien abrió la ventana; si
  // ya no existe, a la ventana que quede arriba o al primer icono
  if (hadFocus) {
    let next = w.opener && document.contains(w.opener) ? w.opener : null;
    if (!next) {
      let top = null;
      let z = -1;
      openWins.forEach((o) => {
        const oz = Number(o.el.style.zIndex) || 0;
        if (!o.el.classList.contains("is-min") && oz > z) {
          z = oz;
          top = o.el;
        }
      });
      next = top || document.querySelector(".d-icon, .launch-row");
    }
    if (next) next.focus({ preventScroll: true });
  }
}

function closeAllWins() {
  [...openWins.keys()].forEach(closeWin);
}

/* Vuelve a pintar títulos y contenido (al cambiar de idioma o
   llegar una config nueva). keepForms deja quieta la ventana de
   Contacto, para no borrar un mensaje a medio escribir. */
function repaintOpenWindows(opts) {
  const keepForms = !!(opts && opts.keepForms);
  openWins.forEach((w) => {
    const fresh = itemById(w.item.id) || w.item;
    w.item = fresh;
    w.el.querySelector(".win-title").textContent = L(fresh.name);
    w.btn.lastElementChild.textContent = L(fresh.name);
    [["min", "win.min"], ["max", "win.max"], ["close", "win.close"]].forEach(([act, key]) => {
      const b = w.el.querySelector('[data-act="' + act + '"]');
      b.title = t(key);
      b.setAttribute("aria-label", t(key));
    });
    const back = w.el.querySelector(".win-back");
    back.lastChild.textContent = " " + t("win.back");
    back.setAttribute("aria-label", t("win.back"));
    if (keepForms && fresh.app === "contact") return;
    renderWindowBody(fresh, w.el.querySelector(".win-body"));
  });
}

/* ----- Arrastrar por la barra de título ----- */
function makeDraggable(el, onEnd) {
  const bar = el.querySelector(".win-bar");
  let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;

  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".win-btn, .win-back")) return; // los botones no arrastran
    if (el.classList.contains("is-max")) return;
    if (window.matchMedia("(max-width: 640px)").matches) return;
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    ox = el.offsetLeft; oy = el.offsetTop;
    bar.setPointerCapture(e.pointerId);
  });

  bar.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const maxX = window.innerWidth - 60;
    const maxY = window.innerHeight - 60;
    el.style.left = Math.min(maxX, Math.max(-el.offsetWidth + 60, ox + e.clientX - sx)) + "px";
    el.style.top = Math.min(maxY, Math.max(0, oy + e.clientY - sy)) + "px";
  });

  const stop = (e) => {
    if (!dragging) return;
    dragging = false;
    try { bar.releasePointerCapture(e.pointerId); } catch (err) {}
    if (onEnd) onEnd();
  };
  bar.addEventListener("pointerup", stop);
  bar.addEventListener("pointercancel", stop);
}

/* ----- Redimensionar con el tirador ----- */
function makeResizable(el, onEnd) {
  const grip = el.querySelector(".win-grip");
  let sx = 0, sy = 0, ow = 0, oh = 0, sizing = false;

  grip.addEventListener("pointerdown", (e) => {
    sizing = true;
    sx = e.clientX; sy = e.clientY;
    ow = el.offsetWidth; oh = el.offsetHeight;
    grip.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });

  grip.addEventListener("pointermove", (e) => {
    if (!sizing) return;
    el.style.width = Math.max(260, ow + e.clientX - sx) + "px";
    el.style.height = Math.max(140, oh + e.clientY - sy) + "px";
  });

  const stop = (e) => {
    if (!sizing) return;
    sizing = false;
    try { grip.releasePointerCapture(e.pointerId); } catch (err) {}
    if (onEnd) onEnd();
  };
  grip.addEventListener("pointerup", stop);
  grip.addEventListener("pointercancel", stop);
}

/* =========================================================
   CONTENIDO DE LAS VENTANAS
   Cada tipo se ve distinto por dentro:
     txt        visor de texto, fondo negro
     folder     explorador con pestañas y rejilla de iconos
     projects   explorador con una pestaña por lenguaje
     repo       ficha de proyecto
     skills     panel de propiedades con barras
     education  vista de lista con columnas
     contact    cuadro de diálogo
     social     entorno de red, iconos grandes
   ========================================================= */

/* Atajo para crear un nodo con clase y texto */
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

/* Botón-enlace con icono */
function linkBtn(href, label, iconKey) {
  const a = document.createElement("a");
  a.className = "btn";
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  if (iconKey) {
    const ico = el("span", "btn-ico");
    ico.innerHTML = iconSvg(iconKey);
    a.appendChild(ico);
  }
  a.appendChild(document.createTextNode(label));
  return a;
}

/* Fila de pestañas reutilizable. tabs = [{ id, label, icon, fill }] */
function tabbedView(body, tabs, statusFor) {
  const row = el("div", "tabs-row");
  const pane = el("div", "explorer-pane");
  row.setAttribute("role", "tablist");
  pane.setAttribute("role", "tabpanel");

  function show(tab) {
    [...row.children].forEach((b) => {
      const on = b.dataset.tab === tab.id;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    pane.innerHTML = "";
    tab.fill(pane);
    setStatus(body, statusFor ? statusFor(tab) : "");
  }

  tabs.forEach((tab) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "etab";
    b.dataset.tab = tab.id;
    b.setAttribute("role", "tab");
    if (tab.icon) {
      const ico = el("span", "etab-ico");
      ico.innerHTML = iconSvg(tab.icon);
      b.appendChild(ico);
    }
    b.appendChild(document.createTextNode(tab.label));
    b.addEventListener("click", () => show(tab));
    row.appendChild(b);
  });

  body.appendChild(row);
  body.appendChild(pane);
  if (tabs.length) show(tabs[0]);
}

/* Rejilla de iconos dentro de un explorador */
function iconGridInto(pane, entries) {
  if (!entries.length) {
    pane.appendChild(el("p", "folder-empty", t("folder.empty")));
    return;
  }
  const grid = el("div", "folder-grid");
  entries.forEach((entry) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "folder-item";
    const ico = el("span", "fi-ico");
    ico.innerHTML = iconSvg(entry.icon);
    b.appendChild(ico);
    b.appendChild(el("span", "fi-label", entry.label));
    let last = 0;
    b.addEventListener("dblclick", entry.open);
    b.addEventListener("click", (e) => {
      if (e.detail === 0) return entry.open();
      const now = Date.now();
      if (isTouch() || now - last < 400) entry.open();
      last = now;
    });
    grid.appendChild(b);
  });
  pane.appendChild(grid);
}

function setStatus(body, text) {
  const win = body.closest(".win");
  if (!win) return;
  const bar = win.querySelector(".win-status");
  if (bar) bar.textContent = text || "";
}

/* Manda el formulario de contacto a la función de Vercel
   (api/contact.js). Devuelve { ok: true } o { ok: false, reason }
   con reason = invalid | busy | off | server | network.
   En local no hay función: responde 404 y se va al plan B. */
async function postContact(payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true };
    if (res.status === 400 && data.field) return { ok: false, reason: "invalid", field: data.field };
    if (res.status === 429) return { ok: false, reason: "busy" };
    if ([404, 405, 501, 503].includes(res.status)) return { ok: false, reason: "off" };
    return { ok: false, reason: "server" };
  } catch (e) {
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

function renderWindowBody(item, body) {
  body.innerHTML = "";
  body.className = "win-body";
  setStatus(body, "");

  if (item.type === "txt") {
    body.classList.add("body-txt");
    const text = L(item.text);
    // La primera línea hace de titular, como en un visor de texto
    const lines = text.split("\n");
    const head = el("h1", "txt-head", lines[0] || L(item.name));
    body.appendChild(head);
    body.appendChild(el("div", "txt-body", lines.slice(1).join("\n").trim()));
    setStatus(body, L(item.name) + " · " + text.length + " " + t("st.chars"));
    return;
  }

  if (item.type === "folder") {
    body.classList.add("body-explorer");
    const kids = childrenOf(item.id);
    const subfolders = kids.filter((k) => k.type === "folder");

    const entryOf = (kid) => ({
      icon: kid.icon,
      label: L(kid.name),
      open: () => openItem(kid),
    });

    const tabs = [
      {
        id: "all",
        label: t("tab.all"),
        icon: "folderOpen",
        fill: (pane) => iconGridInto(pane, kids.map(entryOf)),
        count: kids.length,
      },
    ];
    subfolders.forEach((sub) => {
      const inside = childrenOf(sub.id);
      tabs.push({
        id: sub.id,
        label: L(sub.name),
        icon: "folder",
        fill: (pane) => iconGridInto(pane, inside.map(entryOf)),
        count: inside.length,
      });
    });

    tabbedView(body, tabs, (tab) => t("st.files", { n: tab.count }));
    return;
  }

  if (item.type === "app") {
    const render = APPS[item.app];
    if (render) render(body, item);
    else body.appendChild(el("p", "muted", item.app || "?"));
    return;
  }

  body.appendChild(el("p", "muted", L(item.name)));
}

const APPS = {
  /* ----- Proyectos: explorador con una pestaña por lenguaje ----- */
  projects(body) {
    body.classList.add("body-explorer");

    if (reposError) {
      body.appendChild(el("p", "folder-empty", t("app.projects.error")));
      return;
    }
    if (!allRepos.length) {
      body.appendChild(el("p", "folder-empty", t("app.projects.loading")));
      return;
    }

    const list = visibleRepos();
    if (!list.length) {
      body.appendChild(el("p", "folder-empty", t("app.projects.empty")));
      return;
    }

    const entryOf = (repo) => ({
      icon: repo.homepage ? "globe" : "github",
      label: repo.name,
      open: () => openRepo(repo),
    });

    const tabs = [
      {
        id: "all",
        label: t("tab.all"),
        icon: "folderOpen",
        fill: (pane) => iconGridInto(pane, list.map(entryOf)),
        count: list.length,
      },
    ];

    // Una pestaña por lenguaje, de más usado a menos, máximo 4
    const byLang = {};
    list.forEach((r) => {
      const k = r.language || "—";
      (byLang[k] = byLang[k] || []).push(r);
    });
    Object.keys(byLang)
      .filter((k) => k !== "—")
      .sort((a, b) => byLang[b].length - byLang[a].length)
      .slice(0, 4)
      .forEach((k) => {
        tabs.push({
          id: "lang-" + k,
          label: k,
          icon: "github",
          fill: (pane) => iconGridInto(pane, byLang[k].map(entryOf)),
          count: byLang[k].length,
        });
      });

    // Y una con los que tienen web publicada
    const live = list.filter((r) => r.homepage);
    if (live.length) {
      tabs.push({
        id: "live",
        label: t("tab.live"),
        icon: "globe",
        fill: (pane) => iconGridInto(pane, live.map(entryOf)),
        count: live.length,
      });
    }

    tabbedView(body, tabs, (tab) => t("st.files", { n: tab.count }));
  },

  /* ----- Habilidades: panel de propiedades con barras ----- */
  skills(body) {
    body.classList.add("body-props");

    // Sin barras de nivel: no tengo un porcentaje real que enseñar,
    // así que es una lista de componentes, no un medidor inventado.
    config.skills.forEach((group) => {
      const box = el("fieldset", "group");
      box.appendChild(el("legend", "", L(group)));
      const list = el("div", "comp-list");
      group.items.forEach((s) => {
        const row = el("div", "comp-row");
        const mark = el("span", "comp-mark");
        mark.innerHTML = iconSvg("disk");
        row.appendChild(mark);
        row.appendChild(el("span", "", s));
        list.appendChild(row);
      });
      box.appendChild(list);
      body.appendChild(box);
    });

    const total = config.skills.reduce((n, g) => n + g.items.length, 0);
    setStatus(body, t("st.skills", { n: total, g: config.skills.length }));
  },

  /* ----- Educación: vista de lista con columnas ----- */
  education(body) {
    body.classList.add("body-list");

    const table = document.createElement("table");
    table.className = "listview";
    table.innerHTML =
      "<thead><tr>" +
      "<th>" + t("col.title") + "</th>" +
      "<th>" + t("col.place") + "</th>" +
      "<th>" + t("col.when") + "</th>" +
      "<th>" + t("col.state") + "</th>" +
      "</tr></thead>";

    const tb = document.createElement("tbody");
    config.education.forEach((e) => {
      const tr = document.createElement("tr");
      const first = document.createElement("td");
      const ico = el("span", "cell-ico");
      ico.innerHTML = iconSvg("edu");
      first.appendChild(ico);
      first.appendChild(document.createTextNode(L(e.title)));
      tr.appendChild(first);
      [L(e.place), L(e.when), L(e.state)].forEach((v) => {
        tr.appendChild(el("td", "", v));
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    body.appendChild(table);
    setStatus(body, t("st.items", { n: config.education.length }));
  },

  /* ----- Redes: entorno de red, iconos grandes ----- */
  social(body) {
    body.classList.add("body-net");
    const pane = el("div", "explorer-pane");
    iconGridInto(
      pane,
      SOCIAL.map((s) => ({
        icon: s.icon,
        label: s.label,
        open: () => window.open(s.url, "_blank", "noopener,noreferrer"),
      }))
    );
    body.appendChild(pane);
    setStatus(body, t("st.items", { n: SOCIAL.length }));
  },

  /* ----- Contacto: cuadro de diálogo ----- */
  /* Envía directo a tu correo por api/contact.js. Si eso falla
     (sin conexión, sin configurar o en local), pasa al plan B:
     "Enviar con…", como el "Abrir con" de Windows, con el
     correo ya escrito en Gmail, Outlook o la app del equipo. */
  contact(body) {
    body.classList.add("body-dialog");
    const openedAt = Date.now();

    const head = el("div", "dlg-head");
    const ico = el("span", "dlg-ico");
    ico.innerHTML = iconSvg("mail");
    head.appendChild(ico);
    head.appendChild(el("p", "", t("app.contact.hint")));
    body.appendChild(head);

    /* ---------- 1) Formulario ---------- */
    const form = document.createElement("form");
    const LIMIT = { name: 80, email: 120, subject: 120, message: 4000 };
    const AUTO = { name: "name", email: "email", subject: "off", message: "off" };

    const mkField = (id, labelKey, phKey, tag) => {
      const wrap = el("div", "field");
      const lab = el("label", "", t(labelKey));
      lab.htmlFor = "cf-" + id;
      const input = document.createElement(tag || "input");
      input.className = "input";
      input.id = "cf-" + id;
      input.name = id;
      input.required = true;
      input.maxLength = LIMIT[id];
      input.autocomplete = AUTO[id];
      input.placeholder = t(phKey);
      if (id === "email") input.type = "email";
      if (tag === "textarea") input.rows = 5;
      wrap.appendChild(lab);
      wrap.appendChild(input);
      return wrap;
    };

    const row = el("div", "field-row");
    row.appendChild(mkField("name", "app.contact.name", "app.contact.name.ph"));
    row.appendChild(mkField("email", "app.contact.email", "app.contact.email.ph"));
    form.appendChild(row);
    form.appendChild(mkField("subject", "app.contact.subject", "app.contact.subject.ph"));
    const msgField = mkField("message", "app.contact.message", "app.contact.message.ph", "textarea");
    const counter = el("span", "char-count");
    msgField.appendChild(counter);
    form.appendChild(msgField);
    const msgInput = msgField.querySelector("textarea");
    const paintCount = () => {
      counter.textContent = msgInput.value.length + " / " + LIMIT.message;
      counter.classList.toggle("is-near", msgInput.value.length > LIMIT.message * 0.9);
    };
    msgInput.addEventListener("input", paintCount);
    paintCount();

    // Trampa para bots: un campo que nadie ve y una persona deja vacío
    const trap = document.createElement("input");
    trap.type = "text";
    trap.name = "website";
    trap.tabIndex = -1;
    trap.autocomplete = "off";
    trap.className = "hp";
    trap.setAttribute("aria-hidden", "true");
    form.appendChild(trap);

    const formStatus = el("p", "form-status is-warn");
    formStatus.hidden = true;
    form.appendChild(formStatus);

    const foot = el("div", "dlg-foot");
    foot.appendChild(el("p", "form-note", t("app.contact.privacy")));
    const send = el("button", "btn btn-primary", t("app.contact.send"));
    send.type = "submit";
    foot.appendChild(send);
    form.appendChild(foot);

    /* ---------- 2) Enviando: el sobre viaja de tu PC a mi buzón ---------- */
    const sending = el("div", "send-progress");
    sending.setAttribute("role", "status");
    const trip = el("div", "send-trip");
    const ends = (icon, label) => {
      const end = el("div", "trip-end");
      const pic = el("span", "trip-ico");
      pic.innerHTML = iconSvg(icon);
      end.appendChild(pic);
      end.appendChild(el("span", "", label));
      return end;
    };
    trip.appendChild(ends("pc", t("app.contact.you")));
    const lane = el("div", "trip-lane");
    const flyer = el("span", "trip-flyer");
    flyer.innerHTML = iconSvg("mail");
    lane.appendChild(flyer);
    trip.appendChild(lane);
    trip.appendChild(ends("user", "Andrés"));
    sending.appendChild(trip);
    sending.appendChild(el("p", "send-label", t("app.contact.sending")));
    const bar = el("div", "progress");
    bar.appendChild(el("div", "progress-fill"));
    sending.appendChild(bar);

    /* ---------- 3) Enviado ---------- */
    const done = el("div", "send-done");
    const doneIco = el("span", "done-ico");
    doneIco.innerHTML = iconSvg("sent");
    done.appendChild(doneIco);
    done.appendChild(el("h3", "done-title", t("app.contact.done")));
    const doneText = el("p", "done-text");
    done.appendChild(doneText);
    const doneActions = el("div", "dlg-actions");
    const again = el("button", "btn", t("app.contact.another"));
    again.type = "button";
    const closeBtn = el("button", "btn btn-primary", t("app.contact.close"));
    closeBtn.type = "button";
    doneActions.appendChild(again);
    doneActions.appendChild(closeBtn);
    done.appendChild(doneActions);

    /* ---------- 4) Plan B: "Enviar con…" ---------- */
    const chooser = el("div", "send-chooser");
    const fail = el("p", "send-fail");
    chooser.appendChild(fail);
    chooser.appendChild(el("p", "send-q", t("app.contact.choose")));
    const list = el("div", "send-list");
    chooser.appendChild(list);

    const status = el("p", "form-status");
    status.hidden = true;
    chooser.appendChild(status);

    const copyBox = document.createElement("textarea");
    copyBox.className = "input copy-box";
    copyBox.readOnly = true;
    copyBox.rows = 5;
    copyBox.hidden = true;
    chooser.appendChild(copyBox);

    const back = el("button", "btn", t("app.contact.back"));
    back.type = "button";
    chooser.appendChild(el("div", "dlg-actions")).appendChild(back);

    let msg = null; // { subject, body } para el plan B

    const say = (text, warn) => {
      status.hidden = false;
      status.classList.toggle("is-warn", !!warn);
      status.textContent = text;
    };

    // Compose web con todo relleno, en otra pestaña: el visitante
    // no pierde el portafolio y solo tiene que pulsar Enviar.
    const openWeb = (url, name) => {
      window.open(url, "_blank", "noopener,noreferrer");
      say(t("app.contact.opened", { app: name }));
    };

    const q = encodeURIComponent;
    const OPTIONS = [
      {
        icon: "mail",
        label: "Gmail",
        sub: t("app.contact.via.web"),
        run: () =>
          openWeb(
            "https://mail.google.com/mail/?view=cm&fs=1&to=" + q(EMAIL) +
              "&su=" + q(msg.subject) + "&body=" + q(msg.body),
            "Gmail"
          ),
      },
      {
        icon: "globe",
        label: "Outlook / Hotmail",
        sub: t("app.contact.via.web"),
        run: () =>
          openWeb(
            "https://outlook.live.com/mail/0/deeplink/compose?to=" + q(EMAIL) +
              "&subject=" + q(msg.subject) + "&body=" + q(msg.body),
            "Outlook"
          ),
      },
      {
        icon: "pc",
        label: t("app.contact.via.app"),
        sub: t("app.contact.via.app.sub"),
        run: () => {
          const href =
            "mailto:" + q(EMAIL) + "?subject=" + q(msg.subject) + "&body=" + q(msg.body);
          // Windows corta los mailto: largos sin avisar
          if (href.length > 1800) {
            say(t("app.contact.toolong", { mail: EMAIL }), true);
            return;
          }
          window.location.href = href;
          say(t("app.contact.appHint"));
        },
      },
      {
        icon: "disk",
        label: t("app.contact.via.copy"),
        sub: t("app.contact.via.copy.sub"),
        run: async () => {
          const text =
            t("app.contact.to") + ": " + EMAIL + "\n" +
            t("app.contact.subject") + ": " + msg.subject + "\n\n" + msg.body;
          try {
            await navigator.clipboard.writeText(text);
            copyBox.hidden = true;
            say(t("app.contact.copied", { mail: EMAIL }));
          } catch (e) {
            // Sin permiso de portapapeles: se deja el texto a mano
            copyBox.value = text;
            copyBox.hidden = false;
            copyBox.select();
            say(t("app.contact.copyFail"), true);
          }
        },
      },
    ];

    OPTIONS.forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "send-opt";
      const ico = el("span", "send-ico");
      ico.innerHTML = iconSvg(opt.icon);
      b.appendChild(ico);
      const txt = el("span", "send-txt");
      txt.appendChild(el("strong", "", opt.label));
      txt.appendChild(el("span", "", opt.sub));
      b.appendChild(txt);
      b.addEventListener("click", () => opt.run());
      list.appendChild(b);
    });

    /* ---------- Cambio de paso ---------- */
    const panels = { form, sending, done, chooser };
    const show = (name) => {
      head.hidden = name !== "form";
      Object.keys(panels).forEach((k) => (panels[k].hidden = k !== name));
      body.scrollTop = 0;
    };
    show("form");

    // Texto del plan B: saludo, mensaje y firma, en el idioma del visitante
    const plainBody = (d) =>
      t("app.contact.greet") + "\n\n" + d.message + "\n\n" +
      "— — —\n" + d.name + "\n" + d.email + "\n" +
      t("app.contact.sentFrom", { site: location.host || "andresmadrid.vercel.app" });

    let busy = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); // la validación nativa ya pasó
      if (busy) return;
      busy = true;
      const fd = new FormData(form);
      const data = {
        name: String(fd.get("name") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        subject: String(fd.get("subject") || "").trim(),
        message: String(fd.get("message") || "").trim(),
      };
      msg = { subject: data.subject, body: plainBody(data) };
      formStatus.hidden = true;
      show("sending");

      // El sobre se ve viajar al menos un momento, aunque el servidor vuele
      const [result] = await Promise.all([
        postContact(
          Object.assign({}, data, {
            website: String(fd.get("website") || ""),
            lang: lang,
            elapsed: Date.now() - openedAt,
          })
        ),
        new Promise((r) => setTimeout(r, 1100)),
      ]);
      busy = false;
      if (!form.isConnected) return; // la ventana se cerró o se repintó

      if (result.ok) {
        doneText.textContent = t("app.contact.doneText", { name: data.name.split(/\s+/)[0], email: data.email });
        form.reset();
        paintCount();
        show("done");
        playSound("sent");
        closeBtn.focus();
        return;
      }
      if (result.field) {
        show("form");
        formStatus.textContent = t("app.contact.invalid");
        formStatus.hidden = false;
        const bad = form.querySelector('[name="' + result.field + '"]');
        if (bad) bad.focus();
        return;
      }
      fail.textContent = t("app.contact.fail." + result.reason) + " " + t("app.contact.planB");
      status.hidden = true;
      copyBox.hidden = true;
      show("chooser");
      playSound("error");
      list.querySelector("button").focus();
    });

    again.addEventListener("click", () => {
      show("form");
      form.querySelector("input").focus();
    });
    closeBtn.addEventListener("click", () => {
      const win = body.closest(".win");
      if (win) requestClose(win.dataset.id);
    });
    back.addEventListener("click", () => {
      show("form");
      form.querySelector("input").focus();
    });

    Object.keys(panels).forEach((k) => body.appendChild(panels[k]));
    setStatus(body, EMAIL);
  },

  /* ----- Ficha de un proyecto ----- */
  repo(body, item) {
    body.classList.add("body-txt", "body-repo");
    const repo = allRepos.concat(trashRepos).find((r) => r.name === item.repoName);
    if (!repo) {
      body.appendChild(el("p", "muted", t("app.projects.empty")));
      return;
    }

    // Imagen que GitHub genera para cada repo. El número cambia con
    // el último push, así la imagen se renueva cuando cambia el repo.
    const img = document.createElement("img");
    img.className = "repo-shot";
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 1200;
    img.height = 600;
    img.alt = t("app.projects.shotAlt", { name: repo.name });
    img.src =
      "https://opengraph.githubassets.com/" +
      (Date.parse(repo.pushed_at) || 1) + "/" +
      repo.full_name;
    img.addEventListener("error", () => img.remove());
    body.appendChild(img);

    body.appendChild(el("h1", "txt-head", repo.name));
    body.appendChild(
      el("div", "txt-body", repo.description || t("app.projects.nodesc"))
    );

    const facts = el("dl", "facts");
    const add = (k, v) => {
      facts.appendChild(el("dt", "", k));
      facts.appendChild(el("dd", "", v));
    };
    if (repo.language) add(t("col.lang"), repo.language);
    add(t("col.stars"), String(repo.stargazers_count || 0));
    if (repo.pushed_at) {
      add(
        t("app.projects.updated"),
        new Date(repo.pushed_at).toLocaleDateString(
          lang === "es" ? "es-CO" : "en-GB"
        )
      );
    }
    if (repo.topics && repo.topics.length) add("topics", repo.topics.join(", "));
    body.appendChild(facts);

    const links = el("div", "repo-links");
    links.appendChild(linkBtn(repo.html_url, t("app.projects.code"), "github"));
    if (repo.homepage) {
      links.appendChild(linkBtn(repo.homepage, t("app.projects.live"), "globe"));
    }
    body.appendChild(links);

    setStatus(body, repo.html_url.replace("https://", ""));
  },

  /* ----- Bienvenida: quién soy y qué hacer, en la primera visita ----- */
  welcome(body) {
    body.classList.add("body-dialog", "body-welcome");

    const head = el("div", "dlg-head");
    const ico = el("span", "dlg-ico welcome-ico");
    ico.innerHTML = iconSvg("user");
    head.appendChild(ico);
    const txt = el("div");
    txt.appendChild(el("p", "welcome-hi", t("app.welcome.hi")));
    txt.appendChild(el("p", "", t("app.welcome.text")));
    head.appendChild(txt);
    body.appendChild(head);

    // Tres atajos grandes: lo que un reclutador busca primero
    const grid = el("div", "welcome-grid");
    [
      ["projects", "folder", "app.welcome.projects"],
      ["about", "info", "app.welcome.about"],
      ["contact", "mail", "app.welcome.contact"],
    ].forEach(([id, icon, key]) => {
      const target = itemById(id) || config.items.find((it) => it.app === id);
      if (!target) return;
      const b = el("button", "btn welcome-btn");
      b.type = "button";
      const i = el("span", "welcome-btn-ico");
      i.innerHTML = iconSvg(icon);
      b.appendChild(i);
      b.appendChild(document.createTextNode(t(key)));
      b.addEventListener("click", () => {
        closeWin("welcome");
        openItem(target);
      });
      grid.appendChild(b);
    });
    body.appendChild(grid);

    // Marcado de fábrica: cerrar ya cuenta como "visto"
    const lab = el("label", "check");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    lab.appendChild(cb);
    lab.appendChild(el("span", "", t("app.welcome.dont")));
    body.appendChild(lab);
    const remember = () => {
      try {
        if (cb.checked) localStorage.setItem(WELCOME_KEY, "1");
        else localStorage.removeItem(WELCOME_KEY);
      } catch (e) {}
    };
    cb.addEventListener("change", remember);
    remember();

    setStatus(body, t("st.welcome"));
  },

  /* ----- Currículum: documento generado con tus datos ----- */
  cv(body) {
    body.classList.add("body-doc");

    const bar = el("div", "doc-toolbar");
    const print = el("button", "btn btn-primary", t("app.cv.save"));
    print.type = "button";
    print.addEventListener("click", printCv);
    bar.appendChild(print);
    if (CV_URL) {
      const dl = linkBtn(CV_URL, t("app.cv.download"), "pdf");
      dl.setAttribute("download", "");
      bar.appendChild(dl);
    }
    body.appendChild(bar);

    const paper = el("div", "doc-paper");
    buildCv(paper);
    body.appendChild(paper);
    setStatus(body, t("st.cv"));
  },

  /* ----- Mi PC: datos del sistema y unidades que abren secciones ----- */
  mypc(body) {
    body.classList.add("body-props");

    const sys = el("fieldset", "group");
    sys.appendChild(el("legend", "", t("app.mypc.system")));
    const dl = el("dl", "props-dl");
    const add = (k, v) => {
      dl.appendChild(el("dt", "", k));
      dl.appendChild(el("dd", "", v));
    };
    add(t("app.mypc.os"), "Portafolio OS 1.4");
    add(t("app.mypc.user"), "Andres Madrid");
    add(t("app.mypc.place"), "Santa Marta, Colombia");
    add(t("app.mypc.time"), document.getElementById("clock-time").textContent + " (" + TZ + ")");
    add(t("app.mypc.repos"), allRepos.length ? String(visibleRepos().length) : "…");
    add(t("app.mypc.mem"), "640K OK");
    sys.appendChild(dl);
    body.appendChild(sys);

    // Unidades: cada una abre una parte del portafolio
    const drives = el("fieldset", "group");
    drives.appendChild(el("legend", "", t("app.mypc.drives")));
    const pane = el("div", "comp-list drives");
    iconGridInto(
      pane,
      [
        ["cv", "disk", "app.mypc.driveA"],
        ["projects", "folder", "app.mypc.driveC"],
        ["about", "txt", "app.mypc.driveD"],
      ]
        .map(([id, icon, key]) => {
          const target = itemById(id) || config.items.find((it) => it.app === id);
          return target ? { icon: icon, label: t(key), open: () => openItem(target) } : null;
        })
        .filter(Boolean)
    );
    drives.appendChild(pane);
    body.appendChild(drives);
    setStatus(body, t("st.mypc"));
  },

  /* ----- Papelera: forks y repos archivados de GitHub ----- */
  trash(body) {
    body.classList.add("body-explorer");
    const pane = el("div", "explorer-pane");
    if (!trashRepos.length) {
      pane.appendChild(el("p", "folder-empty", t("app.trash.empty")));
    } else {
      iconGridInto(
        pane,
        trashRepos.map((r) => ({ icon: "github", label: r.name, open: () => openRepo(r) }))
      );
    }
    body.appendChild(pane);
    setStatus(body, t("st.files", { n: trashRepos.length }));
  },
};

/* =========================================================
   CURRÍCULUM
   Se arma con los mismos datos del escritorio: si cambias
   habilidades o educación en el portal, el CV cambia solo.
   ========================================================= */
function buildCv(root) {
  root.innerHTML = "";
  const about = itemById("about");
  const aboutLines = about ? L(about.text).split("\n") : [];

  const head = el("header", "cv-head");
  head.appendChild(el("h1", "cv-name", "Andres Madrid"));
  head.appendChild(el("p", "cv-role", t("app.cv.role")));
  const contact = el("p", "cv-contact");
  contact.textContent =
    "Santa Marta, Colombia · " + EMAIL +
    " · linkedin.com/in/andrés-felipe-madrid-villar · github.com/" + GITHUB_USER;
  head.appendChild(contact);
  root.appendChild(head);

  const section = (titleKey) => {
    const s = el("section", "cv-sec");
    s.appendChild(el("h2", "", t(titleKey)));
    root.appendChild(s);
    return s;
  };

  // Perfil: el texto de Sobre mí sin las dos líneas de título
  const profile = aboutLines.slice(2).join("\n").trim().replace(/\n(?!\n)/g, " ");
  if (profile) {
    const s = section("app.cv.profile");
    profile.split(/\n\n+/).forEach((p) => s.appendChild(el("p", "", p.trim())));
  }

  const sk = section("app.cv.skills");
  const skl = el("ul", "cv-skills");
  config.skills.forEach((g) => {
    const li = el("li");
    li.appendChild(el("strong", "", L(g) + ": "));
    li.appendChild(document.createTextNode(g.items.join(", ")));
    skl.appendChild(li);
  });
  sk.appendChild(skl);

  const ed = section("app.cv.education");
  config.education.forEach((e) => {
    const row = el("div", "cv-row");
    const left = el("div");
    left.appendChild(el("strong", "", L(e.title)));
    left.appendChild(el("span", "", L(e.place)));
    row.appendChild(left);
    row.appendChild(el("span", "cv-when", L(e.when) + " · " + L(e.state)));
    ed.appendChild(row);
  });

  const repos = visibleRepos().slice(0, 6);
  if (repos.length) {
    const pr = section("app.cv.projects");
    repos.forEach((r) => {
      const row = el("div", "cv-proj");
      row.appendChild(el("strong", "", r.name));
      if (r.language) row.appendChild(el("span", "cv-lang", r.language));
      row.appendChild(el("p", "", r.description || t("app.projects.nodesc")));
      row.appendChild(el("span", "cv-url", (r.homepage || r.html_url).replace(/^https?:\/\//, "")));
      pr.appendChild(row);
    });
  }
}

/* "Guardar como PDF": imprime solo una copia del CV. El título de la
   página se cambia un momento para que el PDF se guarde con ese nombre. */
function printCv() {
  const root = document.getElementById("print-root");
  buildCv(root);
  const oldTitle = document.title;
  document.title = "CV - Andres Madrid";
  document.documentElement.classList.add("is-printing");
  const done = () => {
    document.documentElement.classList.remove("is-printing");
    document.title = oldTitle;
    root.innerHTML = "";
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

/* Abre la ficha de un repo como ventana propia */
function openRepo(repo) {
  openItem({
    id: "repo:" + repo.name,
    type: "app",
    app: "repo",
    repoName: repo.name,
    icon: repo.homepage ? "globe" : "github",
    name: { es: repo.name, en: repo.name },
    text: {},
  });
}


/* =========================================================
   PROYECTOS DESDE GITHUB
   API pública, sin token: 60 peticiones/hora por IP. Nunca
   metas un token aquí, este archivo lo puede leer cualquiera.
   ========================================================= */
function visibleRepos() {
  const sel = config.projects.selected;
  if (!sel || !sel.length) return allRepos;
  return sel.map((n) => allRepos.find((r) => r.name === n)).filter(Boolean);
}

async function loadRepos() {
  try {
    const cached = JSON.parse(localStorage.getItem(GH_CACHE_KEY) || "null");
    // La caché vieja no tenía "trash": entonces se vuelve a pedir
    if (
      cached && cached.user === GITHUB_USER && Array.isArray(cached.trash) &&
      Date.now() - cached.at < GH_CACHE_TTL
    ) {
      allRepos = cached.data;
      trashRepos = cached.trash;
      return;
    }
  } catch (e) {}

  try {
    const res = await fetch(
      "https://api.github.com/users/" + GITHUB_USER + "/repos?per_page=100&sort=updated"
    );
    if (!res.ok) throw new Error("GitHub " + res.status);
    const data = await res.json();
    allRepos = data
      .filter((r) => !r.fork && !r.archived)
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
    // Forks y archivados no salen en Proyectos: van a la Papelera
    trashRepos = data.filter((r) => r.fork || r.archived);
    try {
      localStorage.setItem(
        GH_CACHE_KEY,
        JSON.stringify({ user: GITHUB_USER, at: Date.now(), data: allRepos, trash: trashRepos })
      );
    } catch (e) {}
  } catch (e) {
    reposError = true;
  }
}

/* =========================================================
   RELOJ DE COLOMBIA
   Siempre America/Bogota, no la hora del visitante.
   ========================================================= */
function tickClock() {
  const now = new Date();
  const locale = lang === "es" ? "es-CO" : "en-GB";

  document.getElementById("clock-time").textContent = new Intl.DateTimeFormat(
    locale,
    { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: true }
  ).format(now);

  document.getElementById("clock-date").textContent = new Intl.DateTimeFormat(
    locale,
    { timeZone: TZ, day: "2-digit", month: "short" }
  ).format(now);
}

/* =========================================================
   MENÚ INICIO
   ========================================================= */
function renderStartMenu() {
  const list = document.getElementById("start-list");
  list.innerHTML = "";

  const row = (label, iconKey, onClick) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    const ico = el("span");
    ico.innerHTML = iconSvg(iconKey);
    b.appendChild(ico.firstChild);
    b.appendChild(document.createTextNode(label));
    b.addEventListener("click", () => {
      hideStart();
      onClick();
    });
    li.appendChild(b);
    list.appendChild(li);
  };

  childrenOf(null).forEach((item) => {
    row(L(item.name), item.icon, () => openItem(item));
  });

  const sep = document.createElement("li");
  sep.className = "start-sep";
  list.appendChild(sep);

  row(t("ui.welcome"), "info", () => openItem(WELCOME_ITEM));
  row(t("ui.openLinkedin"), "globe", () =>
    window.open(LINKEDIN, "_blank", "noopener,noreferrer")
  );
  row(t("ui.closeAll"), "pc", closeAllWins);
  row(t("ui.admin"), "disk", openAdmin);
}

function showStart() {
  document.getElementById("start-menu").hidden = false;
  document.getElementById("start-btn").classList.add("is-down");
  document.getElementById("start-btn").setAttribute("aria-expanded", "true");
}

function hideStart() {
  document.getElementById("start-menu").hidden = true;
  document.getElementById("start-btn").classList.remove("is-down");
  document.getElementById("start-btn").setAttribute("aria-expanded", "false");
}

/* =========================================================
   PORTAL DE ADMINISTRACIÓN
   Se entra con una cuenta de Supabase (correo y contraseña).
   La seguridad real está en la base de datos: las reglas RLS
   de supabase/schema.sql solo dejan publicar a los correos de
   la tabla site_admins. Sin eso, aunque alguien abriera este
   panel desde la consola, Supabase rechazaría el cambio.
   ========================================================= */
let editingId = null;

function showAdminGate(message) {
  document.getElementById("admin-gate").hidden = false;
  document.getElementById("admin-panel-body").hidden = true;
  document.getElementById("admin-error").textContent = message || "";
  document.getElementById("admin-pass").value = "";
  const email = document.getElementById("admin-email");
  (email.value ? document.getElementById("admin-pass") : email).focus();
}

/* ¿La sesión abierta es de alguien que puede publicar? */
async function isSiteAdmin(sb) {
  const { data, error } = await sb.rpc("is_site_admin");
  return !error && data === true;
}

async function openAdmin() {
  document.getElementById("admin-overlay").hidden = false;
  showAdminGate(t("admin.checking"));
  try {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    if (data.session && (await isSiteAdmin(sb))) return adminUnlocked();
    showAdminGate("");
  } catch (e) {
    showAdminGate(t("admin.offline"));
  }
}

function closeAdmin() {
  document.getElementById("admin-overlay").hidden = true;
}

function adminUnlocked() {
  document.getElementById("admin-gate").hidden = true;
  document.getElementById("admin-panel-body").hidden = false;
  document.getElementById("admin-legacy").hidden = !legacyDraft();
  fillIconSelect();
  renderAdminItems();
  renderAdminRepos();
  renderSkillsEditor();
  renderEduEditor();
  fillWallpaperForm();
  updateAdminCount();
}

function adminSay(text, warn) {
  const box = document.getElementById("admin-count");
  box.textContent = text;
  box.classList.toggle("is-warn", !!warn);
}

function updateAdminCount() {
  document.getElementById("admin-count").classList.remove("is-warn");
  document.getElementById("admin-count").textContent = t("admin.count", {
    n: config.items.length,
    r: config.projects.selected.length,
  });
}

function fillIconSelect() {
  const sel = document.getElementById("f-icon");
  sel.innerHTML = "";
  ICON_KEYS.forEach((k) => {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = k;
    sel.appendChild(o);
  });
}

function fillParentSelect(exceptId) {
  const sel = document.getElementById("f-parent");
  sel.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = t("admin.f.desktop");
  sel.appendChild(none);
  config.items
    .filter((it) => it.type === "folder" && it.id !== exceptId)
    .forEach((it) => {
      const o = document.createElement("option");
      o.value = it.id;
      o.textContent = L(it.name);
      sel.appendChild(o);
    });
}

function renderAdminItems() {
  const box = document.getElementById("admin-items");
  box.innerHTML = "";

  if (!config.items.length) {
    box.appendChild(el("p", "admin-hint", t("admin.items.none")));
    return;
  }

  config.items.forEach((item, i) => {
    const row = el("div", "admin-row" + (item.parent ? " is-child" : ""));

    const ico = el("span");
    ico.innerHTML = iconSvg(item.icon);
    row.appendChild(ico.firstChild);

    row.appendChild(el("span", "grow", L(item.name)));
    row.appendChild(el("span", "tagpill", item.app || item.type));

    const mk = (txt, title, fn) => {
      const b = el("button", "mini", txt);
      b.type = "button";
      b.title = title;
      b.addEventListener("click", fn);
      return b;
    };

    row.appendChild(mk("▲", "Subir", () => moveItem(i, -1)));
    row.appendChild(mk("▼", "Bajar", () => moveItem(i, 1)));
    row.appendChild(mk("✎", "Editar", () => editItem(item.id)));
    row.appendChild(
      mk("✕", "Borrar", () => {
        // Los hijos suben al escritorio en vez de quedar huérfanos
        config.items.forEach((c) => {
          if (c.parent === item.id) c.parent = null;
        });
        config.items.splice(i, 1);
        renderAdminItems();
        updateAdminCount();
      })
    );

    box.appendChild(row);
  });
}

function moveItem(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= config.items.length) return;
  const [it] = config.items.splice(i, 1);
  config.items.splice(j, 0, it);
  renderAdminItems();
}

function showItemFields() {
  const type = document.getElementById("f-type").value;
  document.getElementById("field-app").hidden = type !== "app";
  document.getElementById("field-url").hidden = type !== "link";
  document.getElementById("field-text-es").hidden = type !== "txt";
  document.getElementById("field-text-en").hidden = type !== "txt";
}

function editItem(id) {
  const item = id ? itemById(id) : null;
  editingId = id || null;

  fillParentSelect(id);
  document.getElementById("item-form").hidden = false;
  document.getElementById("f-name-es").value = item ? item.name.es || "" : "";
  document.getElementById("f-name-en").value = item ? item.name.en || "" : "";
  document.getElementById("f-type").value = item ? item.type : "txt";
  document.getElementById("f-icon").value = item ? item.icon : "txt";
  document.getElementById("f-parent").value = item ? item.parent || "" : "";
  document.getElementById("f-app").value = item && item.app ? item.app : "projects";
  document.getElementById("f-url").value = item ? item.url || "" : "";
  document.getElementById("f-text-es").value = item ? item.text.es || "" : "";
  document.getElementById("f-text-en").value = item ? item.text.en || "" : "";
  showItemFields();
  document.getElementById("f-name-es").focus();
}

function submitItem(e) {
  e.preventDefault();
  const type = document.getElementById("f-type").value;
  const data = {
    id: editingId || "it" + Date.now().toString(36),
    type: type,
    app: type === "app" ? document.getElementById("f-app").value : null,
    icon: document.getElementById("f-icon").value,
    url: type === "link" ? document.getElementById("f-url").value : "",
    parent: document.getElementById("f-parent").value || null,
    name: {
      es: document.getElementById("f-name-es").value.trim(),
      en: document.getElementById("f-name-en").value.trim(),
    },
    text: {
      es: document.getElementById("f-text-es").value,
      en: document.getElementById("f-text-en").value,
    },
  };
  if (!data.name.en) data.name.en = data.name.es;

  if (editingId) {
    const i = config.items.findIndex((it) => it.id === editingId);
    config.items[i] = data;
  } else {
    config.items.push(data);
  }

  editingId = null;
  document.getElementById("item-form").hidden = true;
  renderAdminItems();
  updateAdminCount();
}

function renderAdminRepos() {
  const box = document.getElementById("admin-repos");
  box.innerHTML = "";

  if (!allRepos.length) {
    box.appendChild(el("p", "admin-hint", t("admin.repos.wait")));
    return;
  }

  allRepos.forEach((repo) => {
    const row = el("label", "repo-row");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = repo.name;
    cb.checked = config.projects.selected.includes(repo.name);
    cb.addEventListener("change", () => {
      const sel = config.projects.selected;
      const i = sel.indexOf(repo.name);
      if (cb.checked && i < 0) sel.push(repo.name);
      if (!cb.checked && i >= 0) sel.splice(i, 1);
      updateAdminCount();
    });

    const text = el("span");
    text.appendChild(el("strong", "", repo.name));
    text.appendChild(el("span", "repo-desc", repo.description || "—"));

    row.appendChild(cb);
    row.appendChild(text);
    box.appendChild(row);
  });
}

function fillWallpaperForm() {
  const wp = config.wallpaper;
  document.getElementById("wp-type").value = wp.type;
  document.getElementById("wp-color").value = wp.value || "#000000";
  document.getElementById("wp-color2").value = wp.value2 || "#2a0d0d";
  document.getElementById("wp-url").value = wp.url || "";
  document.getElementById("wp-fx").checked = config.showFx !== false;
  syncWallpaperFields();
}

function syncWallpaperFields() {
  const type = document.getElementById("wp-type").value;
  document.getElementById("wp-field-color").hidden = type === "image";
  document.getElementById("wp-field-color2").hidden = type !== "gradient";
  document.getElementById("wp-field-url").hidden = type !== "image";
}

function readWallpaperForm() {
  config.wallpaper = {
    type: document.getElementById("wp-type").value,
    value: document.getElementById("wp-color").value,
    value2: document.getElementById("wp-color2").value,
    url: document.getElementById("wp-url").value.trim(),
  };
  config.showFx = document.getElementById("wp-fx").checked;
  applyWallpaper();
}

/* ----- Habilidades: un bloque por grupo ----- */
function adminInput(labelKey, value, cls) {
  const wrap = el("div", "field");
  const lab = el("label", "", t(labelKey));
  const input = document.createElement("input");
  input.className = "input " + (cls || "");
  input.value = value || "";
  lab.appendChild(input);
  wrap.appendChild(lab);
  return wrap;
}

function removeBtn(onClick) {
  const b = el("button", "mini edit-remove", "✕");
  b.type = "button";
  b.title = t("admin.remove");
  b.setAttribute("aria-label", t("admin.remove"));
  b.addEventListener("click", onClick);
  return b;
}

function renderSkillsEditor() {
  const box = document.getElementById("admin-skills");
  box.innerHTML = "";
  config.skills.forEach((g, i) => {
    const card = el("fieldset", "edit-card");
    card.appendChild(removeBtn(() => {
      readSkillsForm();
      config.skills.splice(i, 1);
      renderSkillsEditor();
    }));
    const grid = el("div", "form-grid");
    grid.appendChild(adminInput("admin.sk.name.es", g.es, "sk-es"));
    grid.appendChild(adminInput("admin.sk.name.en", g.en, "sk-en"));
    card.appendChild(grid);
    card.appendChild(adminInput("admin.sk.items", g.items.join(", "), "sk-items"));
    box.appendChild(card);
  });
}

function readSkillsForm() {
  const cards = document.querySelectorAll("#admin-skills .edit-card");
  if (!cards.length) return; // editor sin pintar: no tocar la config
  config.skills = [...cards]
    .map((c) => ({
      es: c.querySelector(".sk-es").value.trim(),
      en: c.querySelector(".sk-en").value.trim() || c.querySelector(".sk-es").value.trim(),
      items: c.querySelector(".sk-items").value.split(",").map((s) => s.trim()).filter(Boolean),
    }))
    .filter((g) => g.es || g.items.length);
}

/* ----- Educación: un bloque por estudio ----- */
const EDU_FIELDS = [
  ["title", "es", "admin.ed.title.es"],
  ["title", "en", "admin.ed.title.en"],
  ["place", "es", "admin.ed.place"],
  ["when", "es", "admin.ed.when.es"],
  ["when", "en", "admin.ed.when.en"],
  ["state", "es", "admin.ed.state.es"],
  ["state", "en", "admin.ed.state.en"],
];

function renderEduEditor() {
  const box = document.getElementById("admin-edu");
  box.innerHTML = "";
  config.education.forEach((e, i) => {
    const card = el("fieldset", "edit-card");
    card.appendChild(removeBtn(() => {
      readEduForm();
      config.education.splice(i, 1);
      renderEduEditor();
    }));
    const grid = el("div", "form-grid");
    EDU_FIELDS.forEach(([field, lng, key]) => {
      grid.appendChild(adminInput(key, (e[field] || {})[lng], "ed-" + field + "-" + lng));
    });
    card.appendChild(grid);
    box.appendChild(card);
  });
}

function readEduForm() {
  const cards = document.querySelectorAll("#admin-edu .edit-card");
  if (!cards.length) return;
  config.education = [...cards]
    .map((c) => {
      const v = (f, l) => c.querySelector(".ed-" + f + "-" + l).value.trim();
      const pair = (f) => ({ es: v(f, "es"), en: v(f, "en") || v(f, "es") });
      return {
        title: pair("title"),
        // el centro se escribe una vez: vale para los dos idiomas
        place: { es: v("place", "es"), en: v("place", "es") },
        when: pair("when"),
        state: pair("state"),
      };
    })
    .filter((e) => e.title.es);
}

/* Lo que hay en los formularios pasa a la config */
function readAdminForms() {
  readWallpaperForm();
  if (!document.getElementById("admin-panel-body").hidden) {
    readSkillsForm();
    readEduForm();
  }
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "desktop.json";
  a.click();
  URL.revokeObjectURL(url);
  adminSay(t("admin.exported"));
}

function initAdmin() {
  document.getElementById("admin-close").addEventListener("click", closeAdmin);
  document.getElementById("admin-overlay").addEventListener("click", (e) => {
    if (e.target.id === "admin-overlay") closeAdmin();
  });

  const email = document.getElementById("admin-email");
  const pass = document.getElementById("admin-pass");
  const enter = document.getElementById("admin-submit");
  const submit = async () => {
    const err = document.getElementById("admin-error");
    if (!email.value.trim() || !pass.value) return email.value.trim() ? pass.focus() : email.focus();
    err.textContent = t("admin.checking");
    enter.disabled = true;
    try {
      const sb = await getSupabase();
      const { error } = await sb.auth.signInWithPassword({
        email: email.value.trim(),
        password: pass.value,
      });
      pass.value = "";
      if (error) {
        err.textContent = t("admin.badlogin");
        pass.focus();
        return;
      }
      if (!(await isSiteAdmin(sb))) {
        await sb.auth.signOut();
        err.textContent = t("admin.notadmin");
        return;
      }
      err.textContent = "";
      adminUnlocked();
    } catch (e) {
      err.textContent = t("admin.offline");
    } finally {
      enter.disabled = false;
    }
  };
  enter.addEventListener("click", submit);
  [email, pass].forEach((input) =>
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    })
  );

  document.getElementById("admin-logout").addEventListener("click", async () => {
    try {
      await (await getSupabase()).auth.signOut();
    } catch (e) {}
    showAdminGate("");
  });

  // Borrador de antes de Supabase: cargarlo en el panel o tirarlo
  document.getElementById("legacy-load").addEventListener("click", () => {
    const draft = legacyDraft();
    if (!draft) return;
    applyConfig(draft);
    adminUnlocked();
    document.getElementById("admin-legacy").hidden = false;
    adminSay(t("admin.legacy.loaded"));
  });
  document.getElementById("legacy-drop").addEventListener("click", () => {
    try { localStorage.removeItem(CFG_KEY); } catch (e) {}
    document.getElementById("admin-legacy").hidden = true;
  });

  document.getElementById("admin-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    document.querySelectorAll("#admin-tabs .tab").forEach((b) => {
      b.classList.toggle("is-active", b === tab);
    });
    ["items", "look", "repos", "skills", "edu"].forEach((name) => {
      document.getElementById("tab-" + name).hidden = name !== tab.dataset.tab;
    });
  });

  document.getElementById("skill-add").addEventListener("click", () => {
    readSkillsForm();
    config.skills.push({ es: "", en: "", items: [] });
    renderSkillsEditor();
    const last = document.querySelector("#admin-skills .edit-card:last-child .sk-es");
    if (last) last.focus();
  });
  document.getElementById("edu-add").addEventListener("click", () => {
    readEduForm();
    const empty = { es: "", en: "" };
    config.education.push({ title: { ...empty }, place: { ...empty }, when: { ...empty }, state: { ...empty } });
    renderEduEditor();
    const last = document.querySelector("#admin-edu .edit-card:last-child input");
    if (last) last.focus();
  });

  document.getElementById("item-add").addEventListener("click", () => editItem(null));
  document.getElementById("item-cancel").addEventListener("click", () => {
    editingId = null;
    document.getElementById("item-form").hidden = true;
  });
  document.getElementById("f-type").addEventListener("change", showItemFields);
  document.getElementById("item-form").addEventListener("submit", submitItem);

  ["wp-type", "wp-color", "wp-color2", "wp-url", "wp-fx"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      syncWallpaperFields();
      readWallpaperForm();
    });
  });

  // Publicar: va a Supabase y de ahí, en vivo, a todas las visitas
  const save = document.getElementById("admin-save");
  save.addEventListener("click", async () => {
    readAdminForms();
    renderDesktop();
    renderStartMenu();
    renderLauncher();
    repaintOpenWindows({ keepForms: true });
    save.disabled = true;
    adminSay(t("admin.saving"));
    try {
      config = await publishData(normalizeConfig(config));
      // Lo de este navegador ya está publicado: el borrador viejo sobra
      try { localStorage.removeItem(CFG_KEY); } catch (e) {}
      document.getElementById("admin-legacy").hidden = true;
      adminSay(t("admin.saved"));
    } catch (e) {
      adminSay(t("admin.saveFail", { msg: (e && e.message) || "?" }), true);
    } finally {
      save.disabled = false;
    }
  });

  document.getElementById("admin-export").addEventListener("click", () => {
    readAdminForms();
    exportConfig();
  });

  // Restablecer publica "{}": todos vuelven al escritorio de fábrica,
  // y los iconos nuevos que traiga el código aparecen solos
  document.getElementById("admin-reset").addEventListener("click", async () => {
    if (!window.confirm(t("admin.resetAsk"))) return;
    adminSay(t("admin.saving"));
    try {
      const next = await publishData({});
      closeAllWins();
      applyConfig(next);
      adminUnlocked();
      adminSay(t("admin.saved"));
    } catch (e) {
      adminSay(t("admin.saveFail", { msg: (e && e.message) || "?" }), true);
    }
  });
}

/* =========================================================
   STAR WARS
   Cada tanto cruza un caza TIE disparando, o aparece la
   Estrella de la Muerte, se queda quieta y explota.
   ========================================================= */
const TIE_SIZE = 34;
const DS_SIZE = 60;
const TIE_SPEED = 0.4;       // px por milisegundo
const DS_STATIC_MS = 6500;   // cuánto se queda quieta antes de explotar

function initSpaceFx() {
  const stage = document.getElementById("sw-fx");
  const tie = document.getElementById("tie-fighter");
  const star = document.getElementById("death-star");
  if (!stage || !tie || !star) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const area = () => ({
    w: stage.clientWidth,
    h: stage.clientHeight,
  });

  function laser(x, y, dx, dy) {
    const bolt = document.createElement("div");
    bolt.className = "tie-laser";
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    bolt.style.transform =
      "translate(" + x + "px," + y + "px) rotate(" + angle + "deg)";
    stage.appendChild(bolt);

    requestAnimationFrame(() => {
      bolt.style.transition = "transform 620ms linear, opacity 620ms linear";
      bolt.style.transform =
        "translate(" + (x + dx * 560) + "px," + (y + dy * 560) + "px) rotate(" + angle + "deg)";
      bolt.style.opacity = "0";
    });
    setTimeout(() => bolt.remove(), 700);
  }

  /* Vuelo del caza, siempre horizontal */
  function flyTie() {
    const { w, h } = area();
    const off = 80;
    const y = 60 + Math.random() * Math.max(1, h - 200);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const from = dir === 1 ? -off : w + off;
    const dist = w + off * 2;
    const ms = dist / TIE_SPEED;

    tie.style.transition = "none";
    tie.style.transform = "translate(" + from + "px," + y + "px)";
    void tie.offsetWidth; // reflow para que arranque desde "from"

    tie.classList.add("flying");
    tie.style.transition = "transform " + ms + "ms linear";
    tie.style.transform = "translate(" + (from + dir * dist) + "px," + y + "px)";

    const shots = setInterval(() => {
      const box = tie.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      const cx = box.left - stageBox.left + box.width / 2 + dir * (TIE_SIZE / 2 + 6);
      const cy = box.top - stageBox.top + box.height / 2;
      laser(cx, cy, dir, 0);
    }, 480);

    setTimeout(() => {
      clearInterval(shots);
      tie.classList.remove("flying");
    }, ms);

    return ms;
  }

  /* La Estrella aparece, espera y explota */
  function deathStarRun() {
    const { w, h } = area();
    const x = 40 + Math.random() * Math.max(1, w - DS_SIZE - 80);
    const y = 60 + Math.random() * Math.max(1, h - DS_SIZE - 140);

    star.style.transform = "translate(" + x + "px," + y + "px)";
    star.classList.add("visible");

    const cx = x + DS_SIZE / 2;
    const cy = y + DS_SIZE / 2;

    setTimeout(() => {
      star.classList.add("exploding");
      const at = "translate(" + cx + "px," + cy + "px)";
      ["ds-flash", "ds-ring", "ds-ring flat"].forEach((cls) => {
        const fx = document.createElement("div");
        fx.className = cls;
        fx.style.transform = at;
        stage.appendChild(fx);
        setTimeout(() => fx.remove(), 1300);
      });
      setTimeout(() => star.classList.remove("visible", "exploding"), 950);
    }, DS_STATIC_MS);

    return DS_STATIC_MS + 1400;
  }

  function next() {
    if (config.showFx === false) {
      setTimeout(next, 20000);
      return;
    }
    const ms = Math.random() < 0.6 ? flyTie() : deathStarRun();
    setTimeout(next, ms + 18000 + Math.random() * 26000);
  }

  setTimeout(next, 6000);
}

/* =========================================================
   SONIDOS DE SISTEMA
   Apagados por defecto; se encienden con el altavoz de la
   bandeja. Se generan con Web Audio: no hay archivos.
   ========================================================= */
const SOUND_KEY = "sound";
let soundOn = false;
let audioCtx = null;

const SOUNDS = {
  open: [660, 880],
  close: [880, 587],
  boot: [523, 659, 784, 1047],
  on: [784, 1175],
  sent: [784, 988, 1319],
  error: [440, 311],
};

function playSound(kind) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    (SOUNDS[kind] || [800]).forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square"; // timbre de altavoz de PC
      osc.frequency.value = freq;
      const t0 = now + i * 0.075;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.04, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.11);
    });
  } catch (e) {}
}

function paintSoundButton() {
  const btn = document.getElementById("sound-toggle");
  document.getElementById("sound-ico").innerHTML = iconSvg(soundOn ? "sound" : "mute");
  btn.setAttribute("aria-pressed", soundOn ? "true" : "false");
  btn.title = t(soundOn ? "ui.sound.on" : "ui.sound.off");
}

function initSound() {
  try {
    soundOn = localStorage.getItem(SOUND_KEY) === "1";
  } catch (e) {}
  paintSoundButton();
  document.getElementById("sound-toggle").addEventListener("click", () => {
    soundOn = !soundOn;
    try {
      localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0");
    } catch (e) {}
    paintSoundButton();
    playSound("on");
  });
}

/* =========================================================
   PANTALLA DE ARRANQUE
   En cada visita, unos dos segundos. Cualquier tecla, clic o
   toque la salta. Con "reducir movimiento" sale entera de golpe
   y dura menos.
   ========================================================= */
const BOOT_LINE_MS = 230;

function runBoot() {
  const boot = document.getElementById("boot");
  const textEl = document.getElementById("boot-text");
  const fill = document.getElementById("boot-fill");
  if (!boot || !document.documentElement.classList.contains("boot-on")) {
    return Promise.resolve();
  }
  bootRunning = true;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const dots = (label) => (label + " ").padEnd(32, ".") + " ";
  const skills = config.skills
    .reduce((all, g) => all.concat(g.items), [])
    .slice(0, 4)
    .join(", ");
  const reposLine = () =>
    dots(t("boot.repos")) +
    (allRepos.length
      ? t("boot.reposN", { n: visibleRepos().length })
      : reposError ? t("boot.reposErr") : t("boot.reposWait"));

  const lines = [
    "AMBIOS (C) " + new Date().getFullYear() + " Andres Madrid Software",
    t("boot.sub"),
    "",
    dots(t("boot.mem")) + "640K OK",
    dots(t("boot.skills")) + skills,
    reposLine, // función: se reescribe si GitHub responde a tiempo
    dots(t("boot.clock")) + TZ,
    dots(t("boot.desk")) + "OK",
  ];

  return new Promise((resolve) => {
    let shown = 0;
    let finished = false;
    let timer = null;

    const paint = () => {
      textEl.textContent = lines
        .slice(0, shown)
        .map((l) => (typeof l === "function" ? l() : l))
        .join("\n");
      fill.style.width = Math.round((shown / lines.length) * 100) + "%";
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      shown = lines.length;
      paint();
      document.removeEventListener("keydown", finish, true);
      document.removeEventListener("pointerdown", finish, true);
      boot.classList.add("is-done");
      setTimeout(() => {
        document.documentElement.classList.remove("boot-on");
        bootRunning = false;
        playSound("boot");
        resolve();
      }, reduce ? 0 : 320);
    };

    // Saltar: cualquier tecla, clic o toque
    document.addEventListener("keydown", finish, true);
    document.addEventListener("pointerdown", finish, true);

    if (reduce) {
      shown = lines.length;
      paint();
      setTimeout(finish, 700);
      return;
    }

    paint();
    timer = setInterval(() => {
      shown++;
      paint();
      if (shown >= lines.length) {
        clearInterval(timer);
        setTimeout(finish, 450);
      }
    }, BOOT_LINE_MS);
  });
}

/* =========================================================
   BIENVENIDA
   Sale tras el arranque en la primera visita, y siempre desde
   Inicio → Bienvenida. En el teléfono no: allí el lanzador ya
   explica cada elemento.
   ========================================================= */
const WELCOME_KEY = "welcome-seen";

const WELCOME_ITEM = {
  id: "welcome",
  type: "app",
  app: "welcome",
  icon: "info",
  name: { es: "Bienvenido.exe", en: "Welcome.exe" },
  w: 600,
  h: 330,
  center: true,
};

function maybeWelcome() {
  let seen = false;
  try {
    seen = localStorage.getItem(WELCOME_KEY) === "1";
  } catch (e) {}
  if (!seen && !isMobile()) openItem(WELCOME_ITEM);
}

/* =========================================================
   LANZADOR DEL TELÉFONO
   Los mismos elementos del escritorio en lista, con una línea
   que dice qué hay dentro antes de abrirlo.
   ========================================================= */
function launchSub(item) {
  if (item.sub) return L(item.sub);
  if (item.type === "folder") return t("sub.folder", { n: childrenOf(item.id).length });
  if (item.type === "link") {
    try {
      return new URL(item.url, location.href).host;
    } catch (e) {
      return t("sub.link");
    }
  }
  if (item.type === "txt") return t("sub.txt");
  if (item.app === "projects") {
    return allRepos.length
      ? t("sub.projects", { n: visibleRepos().length })
      : t("sub.loading");
  }
  if (item.app === "education" && config.education[0]) return L(config.education[0].title);
  if (item.app === "trash") return t("sub.trash", { n: trashRepos.length });
  return t("sub." + item.app);
}

function renderLauncher() {
  const list = document.getElementById("launcher-list");
  if (!list) return;
  document.getElementById("launcher-ico").innerHTML = iconSvg("pc");
  list.innerHTML = "";
  childrenOf(null).forEach((item) => {
    const b = el("button", "send-opt launch-row");
    b.type = "button";
    const ico = el("span", "send-ico");
    ico.innerHTML = iconSvg(item.icon);
    b.appendChild(ico);
    const txt = el("span", "send-txt");
    txt.appendChild(el("strong", "", L(item.name)));
    txt.appendChild(el("span", "", launchSub(item)));
    b.appendChild(txt);
    b.addEventListener("click", () => openItem(item));
    list.appendChild(b);
  });
}

/* =========================================================
   PERFIL EN TEXTO
   Pone la lista real de repos en el <article> oculto, para
   lectores de pantalla y buscadores que ejecutan JavaScript.
   ========================================================= */
function refreshSeoProjects() {
  const ul = document.getElementById("seo-projects");
  if (!ul || !allRepos.length) return;
  ul.innerHTML = "";
  visibleRepos().forEach((r) => {
    const li = el("li");
    const a = el("a", "", r.name);
    a.href = r.homepage || r.html_url;
    li.appendChild(a);
    if (r.description) li.appendChild(document.createTextNode(" — " + r.description));
    ul.appendChild(li);
  });
}

/* =========================================================
   ANALÍTICA
   Vercel Web Analytics: sin cookies. Solo carga en la web
   publicada; hay que activarla una vez en el panel de Vercel
   (proyecto → Analytics → Enable), si no la ruta da 404.
   ========================================================= */
function initAnalytics() {
  // En local no: ni hay analítica ni se quiere contar uno mismo
  const host = location.hostname;
  if (location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host)) return;
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };
  const s = document.createElement("script");
  s.defer = true;
  s.src = "/_vercel/insights/script.js";
  document.head.appendChild(s);
}

/* =========================================================
   ARRANQUE
   ========================================================= */
document.addEventListener("DOMContentLoaded", async function () {
  harvestBaseLang(); // el HTML manda: antes de traducir nada

  // Config: Supabase > última copia vista > desktop.json > fábrica.
  // La pantalla de arranque tapa la espera (3 s como mucho).
  let data = await fetchRemoteData();
  if (data === undefined) data = cachedRemoteData();
  else cacheRemoteData(data);
  config = await configFromData(data);
  lastRemote = stableJson(config);
  applyWallpaper();

  let startLang = DEFAULT_LANG;
  try {
    startLang = localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
  } catch (e) {}
  applyLang(startLang);

  // Idioma
  document.getElementById("lang-toggle").addEventListener("click", () => {
    applyLang(lang === "es" ? "en" : "es");
  });

  // Menú Inicio
  const startBtn = document.getElementById("start-btn");
  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (document.getElementById("start-menu").hidden) showStart();
    else hideStart();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#start-menu") && !e.target.closest("#start-btn")) hideStart();
  });

  // Esc cierra lo que esté más arriba: panel, menú Inicio o ventana
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || bootRunning) return;
    if (!document.getElementById("admin-overlay").hidden) return closeAdmin();
    if (!document.getElementById("start-menu").hidden) return hideStart();
    const id = activeWinId();
    if (id) requestClose(id);
  });

  // Botón Atrás del teléfono: cierra la ventana de arriba
  window.addEventListener("popstate", () => {
    let top = null;
    let z = -1;
    openWins.forEach((w, id) => {
      const wz = Number(w.el.style.zIndex) || 0;
      if (wz > z) {
        z = wz;
        top = id;
      }
    });
    if (top) closeWin(top);
  });

  // Reloj de Colombia
  tickClock();
  setInterval(tickClock, 15000);

  initCursors();
  initSound();
  initAdmin();
  initSpaceFx();
  initAnalytics();

  // Los repos se piden ya, en paralelo con el arranque: si GitHub
  // responde a tiempo, la pantalla de arranque dice cuántos hay
  document.body.classList.add("is-busy"); // reloj de arena mientras cargan
  const repos = loadRepos().then(() => {
    document.body.classList.remove("is-busy");
    repaintOpenWindows();
    renderLauncher();
    refreshSeoProjects();
    if (!document.getElementById("admin-panel-body").hidden) renderAdminRepos();
  });

  await runBoot();
  maybeWelcome();
  startLiveConfig(); // a partir de aquí, lo que publiques llega en vivo
  await repos;
});
