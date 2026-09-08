/* =========================================================
   PORTAFOLIO — ESCRITORIO
   Cada icono abre una ventana. El contenido del escritorio
   (iconos, carpetas, archivos y fondo) vive en una config que
   se puede editar desde el portal de administración.

   Orden de la config, de más a menos prioritario:
     1. localStorage  -> borrador tuyo, solo en tu navegador
     2. desktop.json  -> lo publicado, lo que ven las visitas
     3. DEFAULT_DESKTOP -> lo que trae el código
   ========================================================= */

const TZ = "America/Bogota";
const EMAIL = "mvandres08@gmail.com";
const GITHUB_USER = "afMadridv";
const LINKEDIN =
  "https://www.linkedin.com/in/andr%C3%A9s-felipe-madrid-villar-9987693a8/";

const CFG_KEY = "desktop-cfg";
const GH_CACHE_KEY = "gh-repos";
const GH_CACHE_TTL = 60 * 60 * 1000; // 1 hora
const LANG_KEY = "lang";
const DEFAULT_LANG = "es";

let lang = DEFAULT_LANG;
let config = null;
let allRepos = [];
let reposError = false;

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
};

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

const ICON_KEYS = Object.keys(PIXELS);




/* =========================================================
   CONTENIDO FIJO
   Lo que no se edita desde el portal se cambia aquí.
   Los archivos .txt sí son editables desde el portal.
   ========================================================= */
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
  items: [
    {
      id: "about",
      type: "txt",
      icon: "info",
      name: { es: "Sobre mí.txt", en: "About me.txt" },
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

    "app.contact.title": "Escríbeme",
    "app.contact.hint":
      "Al enviar se abre tu correo con el mensaje ya escrito. Solo tienes que pulsar enviar.",
    "app.contact.name": "Nombre",
    "app.contact.name.ph": "Tu nombre",
    "app.contact.email": "Tu email",
    "app.contact.email.ph": "para poder responderte",
    "app.contact.subject": "Asunto",
    "app.contact.subject.ph": "Asunto del mensaje",
    "app.contact.message": "Mensaje",
    "app.contact.message.ph": "Cuéntame",
    "app.contact.send": "Enviar mensaje",
    "app.contact.opening":
      "Abriendo tu correo con el mensaje listo — solo pulsa enviar. ¿No se abrió? Escríbeme a {mail}",
    "app.contact.toolong":
      "El mensaje es muy largo para abrirse solo. Cópialo y mándalo a {mail}",
    "app.contact.from": "Enviado desde el portafolio por",
    "app.contact.reply": "Responder a",

    "folder.empty": "Esta carpeta está vacía.",

    "admin.title": "Panel de administración",
    "admin.gate": "Escribe la clave para administrar el escritorio.",
    "admin.pass": "Clave",
    "admin.enter": "Entrar",
    "admin.wrongpass": "Clave incorrecta.",
    "admin.nocrypto": "Este navegador no puede comprobar la clave.",
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
    "admin.wp.hint": "El fondo se ve al instante. Recuerda pulsar Guardar abajo.",
    "admin.repos.hint":
      "Marca los repos que quieres mostrar en Proyectos. Sin nada marcado, salen todos.",
    "admin.repos.wait": "Los repos aún no han cargado.",
    "admin.reset": "Restablecer",
    "admin.export": "Descargar desktop.json",
    "admin.save": "Guardar",
    "admin.saved": "Guardado en este navegador.",
    "admin.resetAsk":
      "¿Restablecer el escritorio como venía de fábrica? Se pierden tus cambios locales.",
    "admin.count": "{n} elementos · {r} repos marcados",
    "admin.exported":
      "Descargado. Sube desktop.json junto a index.html para que lo vean las visitas.",

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

    "app.contact.title": "Write to me",
    "app.contact.hint":
      "Sending opens your mail app with the message ready. You only have to hit send.",
    "app.contact.name": "Name",
    "app.contact.name.ph": "Your name",
    "app.contact.email": "Your email",
    "app.contact.email.ph": "so I can reply",
    "app.contact.subject": "Subject",
    "app.contact.subject.ph": "Subject of your message",
    "app.contact.message": "Message",
    "app.contact.message.ph": "Tell me about it",
    "app.contact.send": "Send message",
    "app.contact.opening":
      "Opening your mail app with the message ready — just hit send. Didn't open? Write to {mail}",
    "app.contact.toolong":
      "The message is too long to open automatically. Copy it and send it to {mail}",
    "app.contact.from": "Sent from the portfolio by",
    "app.contact.reply": "Reply to",

    "folder.empty": "This folder is empty.",

    "admin.title": "Admin panel",
    "admin.gate": "Enter the passphrase to manage the desktop.",
    "admin.pass": "Passphrase",
    "admin.enter": "Enter",
    "admin.wrongpass": "Wrong passphrase.",
    "admin.nocrypto": "This browser cannot verify the passphrase.",
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
    "admin.wp.hint": "The wallpaper updates live. Remember to press Save below.",
    "admin.repos.hint":
      "Tick the repos you want inside Projects. With none ticked, all of them show.",
    "admin.repos.wait": "Repos have not loaded yet.",
    "admin.reset": "Reset",
    "admin.export": "Download desktop.json",
    "admin.save": "Save",
    "admin.saved": "Saved in this browser.",
    "admin.resetAsk":
      "Reset the desktop to how it shipped? Your local changes will be lost.",
    "admin.count": "{n} items · {r} repos ticked",
    "admin.exported":
      "Downloaded. Upload desktop.json next to index.html so visitors see it.",

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
  repaintOpenWindows();
  tickClock();
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
  };
  if (raw.projects && Array.isArray(raw.projects.selected)) {
    out.projects.selected = raw.projects.selected;
  }
  out.items = out.items
    .filter((it) => it && it.id && it.type)
    .map((it) => ({
      id: String(it.id),
      type: it.type,
      app: it.app || null,
      icon: ICONS[it.icon] ? it.icon : "txt",
      url: it.url || "",
      parent: it.parent || null,
      name: typeof it.name === "object" ? it.name : { es: String(it.name || "") },
      text: typeof it.text === "object" ? it.text : { es: String(it.text || "") },
    }));
  return out;
}

function localConfig() {
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

function saveConfig() {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(config));
  } catch (e) {}
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
const openWins = new Map(); // id -> { el, item, btn }
let zTop = 10;
let cascade = 0;

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

  // Posición en cascada, sin salirse de la pantalla
  const w = Math.min(560, window.innerWidth - 40);
  const h = Math.min(420, window.innerHeight - 120);
  const off = (cascade % 6) * 26;
  cascade++;
  el.style.width = w + "px";
  el.style.height = h + "px";
  el.style.left = Math.max(8, 48 + off) + "px";
  el.style.top = Math.max(8, 32 + off) + "px";

  el.innerHTML =
    '<div class="win-bar">' +
    '<span class="win-ico"></span>' +
    '<span class="win-title"></span>' +
    '<span class="win-controls">' +
    '<button type="button" class="win-btn" data-act="min">_</button>' +
    '<button type="button" class="win-btn" data-act="max">□</button>' +
    '<button type="button" class="win-btn" data-act="close">✕</button>' +
    "</span></div>" +
    '<div class="win-body"></div>' +
    '<div class="win-status"></div>' +
    '<div class="win-grip"></div>';

  el.querySelector(".win-ico").innerHTML = iconSvg(item.icon);
  el.querySelector(".win-title").textContent = L(item.name);
  el.querySelector('[data-act="min"]').title = t("win.min");
  el.querySelector('[data-act="max"]').title = t("win.max");
  el.querySelector('[data-act="close"]').title = t("win.close");

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

  openWins.set(item.id, { el, item, btn });

  // Controles
  el.querySelector('[data-act="close"]').addEventListener("click", () => closeWin(item.id));
  el.querySelector('[data-act="min"]').addEventListener("click", () => minimizeWin(item.id));
  el.querySelector('[data-act="max"]').addEventListener("click", () => {
    el.classList.toggle("is-max");
  });
  el.addEventListener("pointerdown", () => focusWin(item.id), true);

  makeDraggable(el);
  makeResizable(el);
  renderWindowBody(item, el.querySelector(".win-body"));

  focusWin(item.id);
  markOpenIcons();
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
  w.el.remove();
  w.btn.remove();
  openWins.delete(id);
  markOpenIcons();
}

function closeAllWins() {
  [...openWins.keys()].forEach(closeWin);
}

/* Vuelve a pintar títulos y contenido (al cambiar de idioma) */
function repaintOpenWindows() {
  openWins.forEach((w) => {
    const fresh = itemById(w.item.id) || w.item;
    w.item = fresh;
    w.el.querySelector(".win-title").textContent = L(fresh.name);
    w.btn.lastElementChild.textContent = L(fresh.name);
    renderWindowBody(fresh, w.el.querySelector(".win-body"));
  });
}

/* ----- Arrastrar por la barra de título ----- */
function makeDraggable(el) {
  const bar = el.querySelector(".win-bar");
  let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;

  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".win-btn")) return;     // los botones no arrastran
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
  };
  bar.addEventListener("pointerup", stop);
  bar.addEventListener("pointercancel", stop);
}

/* ----- Redimensionar con el tirador ----- */
function makeResizable(el) {
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

  function show(tab) {
    [...row.children].forEach((b) =>
      b.classList.toggle("is-active", b.dataset.tab === tab.id)
    );
    pane.innerHTML = "";
    tab.fill(pane);
    setStatus(body, statusFor ? statusFor(tab) : "");
  }

  tabs.forEach((tab) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "etab";
    b.dataset.tab = tab.id;
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
    SKILLS.forEach((group) => {
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

    const total = SKILLS.reduce((n, g) => n + g.items.length, 0);
    setStatus(body, t("st.skills", { n: total, g: SKILLS.length }));
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
    EDUCATION.forEach((e) => {
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
    setStatus(body, t("st.items", { n: EDUCATION.length }));
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
  contact(body) {
    body.classList.add("body-dialog");

    const head = el("div", "dlg-head");
    const ico = el("span", "dlg-ico");
    ico.innerHTML = iconSvg("mail");
    head.appendChild(ico);
    head.appendChild(el("p", "", t("app.contact.hint")));
    body.appendChild(head);

    const form = document.createElement("form");

    const mkField = (id, labelKey, phKey, tag) => {
      const wrap = el("div", "field");
      const lab = el("label", "", t(labelKey));
      lab.htmlFor = "cf-" + id;
      const input = document.createElement(tag || "input");
      input.className = "input";
      input.id = "cf-" + id;
      input.name = id;
      input.required = true;
      input.placeholder = t(phKey);
      if (id === "email") input.type = "email";
      if (tag === "textarea") input.rows = 4;
      wrap.appendChild(lab);
      wrap.appendChild(input);
      return wrap;
    };

    form.appendChild(mkField("name", "app.contact.name", "app.contact.name.ph"));
    form.appendChild(mkField("email", "app.contact.email", "app.contact.email.ph"));
    form.appendChild(mkField("subject", "app.contact.subject", "app.contact.subject.ph"));
    form.appendChild(
      mkField("message", "app.contact.message", "app.contact.message.ph", "textarea")
    );

    const actions = el("div", "dlg-actions");
    const send = el("button", "btn btn-primary", t("app.contact.send"));
    send.type = "submit";
    actions.appendChild(send);
    form.appendChild(actions);

    const status = el("p", "form-status");
    status.hidden = true;
    form.appendChild(status);

    form.addEventListener("submit", (e) => {
      e.preventDefault(); // no hay servidor: abrimos el cliente de correo
      const d = new FormData(form);
      const bodyText =
        String(d.get("message") || "").trim() +
        "\n\n—\n" +
        t("app.contact.from") + ": " + String(d.get("name") || "").trim() +
        "\n" +
        t("app.contact.reply") + ": " + String(d.get("email") || "").trim();

      const href =
        "mailto:" + encodeURIComponent(EMAIL) +
        "?subject=" + encodeURIComponent(String(d.get("subject") || "").trim()) +
        "&body=" + encodeURIComponent(bodyText);

      status.hidden = false;
      status.classList.remove("is-warn");

      // Los clientes de correo cortan las URL largas sin avisar
      if (href.length > 1800) {
        status.classList.add("is-warn");
        status.textContent = t("app.contact.toolong", { mail: EMAIL });
        return;
      }
      status.textContent = t("app.contact.opening", { mail: EMAIL });
      window.location.href = href;
    });

    body.appendChild(form);
    setStatus(body, EMAIL);
  },

  /* ----- Ficha de un proyecto ----- */
  repo(body, item) {
    body.classList.add("body-txt", "body-repo");
    const repo = allRepos.find((r) => r.name === item.repoName);
    if (!repo) {
      body.appendChild(el("p", "muted", t("app.projects.empty")));
      return;
    }

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
};

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
    if (cached && cached.user === GITHUB_USER && Date.now() - cached.at < GH_CACHE_TTL) {
      allRepos = cached.data;
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
    try {
      localStorage.setItem(
        GH_CACHE_KEY,
        JSON.stringify({ user: GITHUB_USER, at: Date.now(), data: allRepos })
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
   La clave solo evita que un curioso abra el panel. NO es
   seguridad real: este archivo es público y cualquiera puede
   leerlo. Lo que protege el sitio es que publicar un cambio
   exige subir desktop.json al repositorio, y eso solo lo
   puedes hacer tú.
   Cambiar la clave: en la consola ejecuta
   await hashText("tu-clave") y pega el resultado aquí.
   Clave por defecto: pixel-f1
   ========================================================= */
const ADMIN_HASH =
  "61adbce0bda68f1bcf8ab4534ec8458444a09cd9f19116b6fb94fc0939ff7e4a";

async function hashText(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

let editingId = null;

function openAdmin() {
  const ov = document.getElementById("admin-overlay");
  ov.hidden = false;
  document.getElementById("admin-gate").hidden = false;
  document.getElementById("admin-panel-body").hidden = true;
  document.getElementById("admin-error").textContent = "";
  document.getElementById("admin-pass").value = "";
  document.getElementById("admin-pass").focus();
}

function closeAdmin() {
  document.getElementById("admin-overlay").hidden = true;
}

function adminUnlocked() {
  document.getElementById("admin-gate").hidden = true;
  document.getElementById("admin-panel-body").hidden = false;
  fillIconSelect();
  renderAdminItems();
  renderAdminRepos();
  fillWallpaperForm();
  updateAdminCount();
}

function updateAdminCount() {
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
  document.getElementById("admin-count").textContent = t("admin.exported");
}

function initAdmin() {
  document.getElementById("admin-close").addEventListener("click", closeAdmin);
  document.getElementById("admin-overlay").addEventListener("click", (e) => {
    if (e.target.id === "admin-overlay") closeAdmin();
  });

  const pass = document.getElementById("admin-pass");
  const submit = async () => {
    const err = document.getElementById("admin-error");
    err.textContent = "";
    try {
      if ((await hashText(pass.value)) !== ADMIN_HASH) {
        err.textContent = t("admin.wrongpass");
        pass.select();
        return;
      }
    } catch (e) {
      err.textContent = t("admin.nocrypto");
      return;
    }
    adminUnlocked();
  };
  document.getElementById("admin-submit").addEventListener("click", submit);
  pass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });

  document.getElementById("admin-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    document.querySelectorAll("#admin-tabs .tab").forEach((b) => {
      b.classList.toggle("is-active", b === tab);
    });
    ["items", "look", "repos"].forEach((name) => {
      document.getElementById("tab-" + name).hidden = name !== tab.dataset.tab;
    });
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

  document.getElementById("admin-save").addEventListener("click", () => {
    readWallpaperForm();
    saveConfig();
    renderDesktop();
    renderStartMenu();
    repaintOpenWindows();
    document.getElementById("admin-count").textContent = t("admin.saved");
  });

  document.getElementById("admin-export").addEventListener("click", () => {
    readWallpaperForm();
    exportConfig();
  });

  document.getElementById("admin-reset").addEventListener("click", () => {
    if (!window.confirm(t("admin.resetAsk"))) return;
    try { localStorage.removeItem(CFG_KEY); } catch (e) {}
    config = cloneDefaults();
    applyWallpaper();
    renderDesktop();
    renderStartMenu();
    closeAllWins();
    adminUnlocked();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("admin-overlay").hidden) {
      closeAdmin();
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
   ARRANQUE
   ========================================================= */
document.addEventListener("DOMContentLoaded", async function () {
  harvestBaseLang(); // el HTML manda: antes de traducir nada

  // Config: borrador local > desktop.json > valores de fábrica
  config = localConfig() || (await publishedConfig()) || cloneDefaults();
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
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideStart();
  });

  // Reloj de Colombia
  tickClock();
  setInterval(tickClock, 15000);

  initAdmin();
  initSpaceFx();

  // Los repos llegan después: al terminar se repintan las ventanas abiertas
  await loadRepos();
  repaintOpenWindows();
  if (!document.getElementById("admin-panel-body").hidden) renderAdminRepos();
});
