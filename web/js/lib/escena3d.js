// Vista 3D del local, con three.js.
//
// POR QUÉ SE REHIZO: la versión anterior dibujaba cajas con transformaciones
// CSS. Funcionaba, pero no se parecía a una tienda: no había frigoríficos con
// puerta de vidrio, ni un congelador de tapa, ni el mostrador de caja, y no se
// podía girar la cámara para mirar detrás de una percha. Este módulo construye
// una escena real a partir de lo que dice la base —qué muebles hay, de qué
// tamaño y dónde están parados— y cada nivel de cada mueble se pinta según lo
// lleno que esté.
//
// three.js está guardado en js/vendor/, no traído de un CDN, y se carga solo al
// abrir la pestaña 3D: son 670 KB que no tienen por qué pesar en el arranque de
// la caja.
//
// La unidad de la escena es el metro; la base guarda centímetros.

let THREE = null;

/** Carga three.js una sola vez. */
async function cargarThree() {
  if (!THREE) {
    THREE = await import('../vendor/three.module.min.js');
  }
  return THREE;
}

const CM = 0.01;   // centímetros → metros

// Colores de ocupación. Son los mismos que usa el resto del sistema para
// decir "vacío / bien / lleno", para que el mapa y el 3D no se contradigan.
const COLOR_VACIO = 0xd9e2db;
const COLOR_BAJO = 0x8fcf9f;
const COLOR_MEDIO = 0x2e9e44;
const COLOR_ALTO = 0x0f6b28;
const COLOR_LLENO = 0xf5c518;

function colorOcupacion(pct) {
  if (pct <= 0) return COLOR_VACIO;
  if (pct < 34) return COLOR_BAJO;
  if (pct < 67) return COLOR_MEDIO;
  if (pct < 100) return COLOR_ALTO;
  return COLOR_LLENO;
}

/**
 * Crea la escena dentro de un contenedor.
 *
 * @param {HTMLElement} contenedor
 * @param {object} opciones { alSeleccionar(datos) }
 * @returns control con { actualizar(estructuras, posiciones), vista(nombre),
 *                        destruir(), redimensionar() }
 */
export async function crearEscena(contenedor, opciones = {}) {
  const T = await cargarThree();

  const ancho = () => contenedor.clientWidth || 800;
  const alto = () => contenedor.clientHeight || 520;

  // ---------- Escena, cámara, luces ----------
  const escena = new T.Scene();
  escena.background = new T.Color(0xeef3ef);
  escena.fog = new T.Fog(0xeef3ef, 22, 55);

  const camara = new T.PerspectiveCamera(50, ancho() / alto(), 0.1, 200);

  const render = new T.WebGLRenderer({ antialias: true });
  render.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  render.setSize(ancho(), alto());
  render.shadowMap.enabled = true;
  render.shadowMap.type = T.PCFSoftShadowMap;
  contenedor.appendChild(render.domElement);

  // Luz de local comercial: mucha luz ambiente y unos fluorescentes
  // cenitales. Un solo foco dejaría medio salón en sombra.
  escena.add(new T.HemisphereLight(0xffffff, 0xb9c6bc, 1.05));

  const sol = new T.DirectionalLight(0xffffff, 0.85);
  sol.position.set(6, 14, 8);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.left = -18;
  sol.shadow.camera.right = 18;
  sol.shadow.camera.top = 18;
  sol.shadow.camera.bottom = -18;
  escena.add(sol);

  const relleno = new T.DirectionalLight(0xffffff, 0.3);
  relleno.position.set(-8, 8, -6);
  escena.add(relleno);

  // ---------- Grupos ----------
  const grupoLocal = new T.Group();      // piso y paredes
  const grupoMuebles = new T.Group();    // lo que se puede clicar
  escena.add(grupoLocal);
  escena.add(grupoMuebles);

  // ---------- Órbita a mano ----------
  // No se usa OrbitControls para no arrastrar otro archivo de vendor por
  // algo que son treinta líneas: arrastrar gira, rueda acerca, botón
  // derecho desplaza.
  // El ángulo por defecto mira desde la esquina abierta de la sala. Las
  // paredes están en x=0 y z=0, así que la cámara tiene que quedar en el
  // cuadrante positivo: con un ángulo negativo se veía el local desde
  // fuera, por detrás de la pared, que fue justo lo que pasó al
  // probarlo la primera vez.
  const orbita = {
    radio: 16, theta: Math.PI / 4, phi: Math.PI / 3.2,
    centro: new T.Vector3(0, 1, 0),
  };

  function aplicarCamara() {
    orbita.phi = Math.max(0.18, Math.min(Math.PI / 2.02, orbita.phi));
    orbita.radio = Math.max(3, Math.min(60, orbita.radio));
    camara.position.set(
      orbita.centro.x + orbita.radio * Math.sin(orbita.phi) * Math.cos(orbita.theta),
      orbita.centro.y + orbita.radio * Math.cos(orbita.phi),
      orbita.centro.z + orbita.radio * Math.sin(orbita.phi) * Math.sin(orbita.theta),
    );
    camara.lookAt(orbita.centro);

    // La posición de la cámara queda publicada en el contenedor. Sirve
    // para dos cosas: que las pruebas comprueben que los botones de
    // vista mueven de verdad la cámara —el lienzo de WebGL se borra
    // después de cada cuadro, así que no se puede leer su imagen— y
    // que, ante un reporte de "no veo nada", se pueda saber desde dónde
    // estaba mirando el usuario.
    contenedor.dataset.camara =
      `${camara.position.x.toFixed(2)},${camara.position.y.toFixed(2)},${camara.position.z.toFixed(2)}`;
  }

  let arrastrando = null;
  let movido = false;

  const lienzo = render.domElement;
  lienzo.style.touchAction = 'none';   // el gesto lo maneja la escena, no el navegador
  lienzo.style.cursor = 'grab';

  function alBajar(e) {
    arrastrando = { x: e.clientX, y: e.clientY, boton: e.button };
    movido = false;
    lienzo.setPointerCapture?.(e.pointerId);
    lienzo.style.cursor = 'grabbing';
  }

  function alMover(e) {
    if (!arrastrando) return;
    const dx = e.clientX - arrastrando.x;
    const dy = e.clientY - arrastrando.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) movido = true;

    if (arrastrando.boton === 2) {
      // Desplazar el centro, en el plano del piso
      const k = orbita.radio * 0.0016;
      orbita.centro.x -= (dx * Math.cos(orbita.theta) - dy * Math.sin(orbita.theta)) * k;
      orbita.centro.z -= (dx * Math.sin(orbita.theta) + dy * Math.cos(orbita.theta)) * k;
    } else {
      orbita.theta -= dx * 0.006;
      orbita.phi -= dy * 0.006;
    }
    arrastrando.x = e.clientX;
    arrastrando.y = e.clientY;
    aplicarCamara();
  }

  function alSubir(e) {
    lienzo.style.cursor = 'grab';
    const eraClic = arrastrando && !movido && arrastrando.boton === 0;
    arrastrando = null;
    if (eraClic) seleccionarEn(e);
  }

  lienzo.addEventListener('pointerdown', alBajar);
  lienzo.addEventListener('pointermove', alMover);
  lienzo.addEventListener('pointerup', alSubir);
  lienzo.addEventListener('pointerleave', () => { arrastrando = null; });
  lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
  lienzo.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbita.radio *= e.deltaY > 0 ? 1.1 : 0.9;
    aplicarCamara();
  }, { passive: false });

  // Pellizco para acercar en el celular
  let distanciaPellizco = null;
  lienzo.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    const d = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY);
    if (distanciaPellizco) {
      orbita.radio *= distanciaPellizco / d;
      aplicarCamara();
    }
    distanciaPellizco = d;
  }, { passive: true });
  lienzo.addEventListener('touchend', () => { distanciaPellizco = null; });

  // ---------- Selección ----------
  const rayo = new T.Raycaster();
  const puntero = new T.Vector2();
  let resaltado = null;

  function seleccionarEn(e) {
    const caja = lienzo.getBoundingClientRect();
    puntero.x = ((e.clientX - caja.left) / caja.width) * 2 - 1;
    puntero.y = -((e.clientY - caja.top) / caja.height) * 2 + 1;
    rayo.setFromCamera(puntero, camara);

    const tocados = rayo.intersectObjects(grupoMuebles.children, true);
    const elegido = tocados.find((t) => t.object.userData?.info);

    if (resaltado) {
      resaltado.material.emissive?.setHex(resaltado.userData.emisionOriginal ?? 0x000000);
      resaltado = null;
    }

    if (!elegido) {
      opciones.alSeleccionar?.(null);
      return;
    }

    const o = elegido.object;
    o.userData.emisionOriginal = o.material.emissive?.getHex() ?? 0x000000;
    o.material.emissive?.setHex(0xf5c518);
    resaltado = o;
    opciones.alSeleccionar?.(o.userData.info);
  }

  // =========================================================
  // Construcción del local
  // =========================================================
  function limpiarGrupo(g) {
    while (g.children.length) {
      const h = g.children.pop();
      h.traverse?.((n) => {
        n.geometry?.dispose();
        if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
        else n.material?.dispose();
      });
    }
  }

  function construirLocal(anchoM, fondoM) {
    limpiarGrupo(grupoLocal);

    // Piso de baldosa clara, como el de la tienda
    const piso = new T.Mesh(
      new T.PlaneGeometry(anchoM, fondoM),
      new T.MeshStandardMaterial({ color: 0xf2efe9, roughness: 0.85, metalness: 0.02 }));
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(anchoM / 2, 0, fondoM / 2);
    piso.receiveShadow = true;
    grupoLocal.add(piso);

    // Líneas de baldosa cada 60 cm: dan escala y ayudan a ubicarse
    const rejilla = new T.GridHelper(Math.max(anchoM, fondoM), Math.round(Math.max(anchoM, fondoM) / 0.6), 0xd7ddd6, 0xe6ebe5);
    rejilla.position.set(anchoM / 2, 0.002, fondoM / 2);
    grupoLocal.add(rejilla);

    // Dos paredes, al fondo y a la izquierda, para que se entienda el
    // encierro sin tapar la vista desde la cámara
    const matPared = new T.MeshStandardMaterial({ color: 0xfbfbf8, roughness: 0.95, side: T.DoubleSide });

    const fondo = new T.Mesh(new T.PlaneGeometry(anchoM, 3), matPared);
    fondo.position.set(anchoM / 2, 1.5, 0);
    fondo.receiveShadow = true;
    grupoLocal.add(fondo);

    const izq = new T.Mesh(new T.PlaneGeometry(fondoM, 3), matPared);
    izq.rotation.y = Math.PI / 2;
    izq.position.set(0, 1.5, fondoM / 2);
    izq.receiveShadow = true;
    grupoLocal.add(izq);

    // Ventanal a la derecha, como en la foto del local
    const vidrio = new T.Mesh(
      new T.PlaneGeometry(fondoM * 0.8, 2.2),
      new T.MeshStandardMaterial({
        color: 0xbcd9e8, roughness: 0.1, metalness: 0.2,
        transparent: true, opacity: 0.45, side: T.DoubleSide }));
    vidrio.rotation.y = -Math.PI / 2;
    vidrio.position.set(anchoM, 1.3, fondoM / 2);
    grupoLocal.add(vidrio);
  }

  // ---------- Piezas reutilizables ----------
  function cajaConBorde(w, h, d, color, opts = {}) {
    const mat = new T.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.7,
      metalness: opts.metalness ?? 0.05,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.castShadow = opts.sombra !== false;
    m.receiveShadow = true;
    return m;
  }

  /**
   * Un mueble completo.
   *
   * Cada tipo se dibuja distinto porque en la tienda se ven distinto, y
   * la gracia de esta vista es reconocer de un vistazo cuál es cuál:
   * el frigorífico tiene puerta de vidrio y marco, el congelador es bajo
   * y con tapa corrediza, el exhibidor de frutas tiene bandejas
   * inclinadas, y el mostrador tiene su tablero.
   */
  function construirMueble(e, porNivel) {
    const w = Math.max(e.ancho_cm, 30) * CM;
    const h = Math.max(e.alto_cm, 30) * CM;
    const d = Math.max(e.fondo_cm, 20) * CM;

    const g = new T.Group();
    g.position.set(e.pos_x_cm * CM, 0, e.pos_y_cm * CM);
    g.rotation.y = -(e.rotacion_grados ?? 0) * Math.PI / 180;

    const esFrio = e.tipo === 'FRIGORIFICO';
    const esNevera = e.tipo === 'NEVERA';
    const esMostrador = e.tipo === 'MOSTRADOR';
    const esFruta = e.tipo === 'EXHIBIDOR_FRUTA';

    // ---- Estructura ----
    const colorCuerpo = new T.Color(e.color_hex || '#d8dee0');
    const espesor = 0.04;

    if (esNevera) {
      // Arcón: cuerpo bajo y tapa de vidrio inclinada
      const cuerpo = cajaConBorde(w, h, d, colorCuerpo.getHex(), { roughness: 0.5 });
      cuerpo.position.set(w / 2, h / 2, d / 2);
      g.add(cuerpo);

      const tapa = cajaConBorde(w * 0.96, 0.03, d * 0.9, 0xcfe6f2,
        { transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.3 });
      tapa.position.set(w / 2, h + 0.02, d / 2);
      tapa.rotation.x = -0.07;
      g.add(tapa);

    } else {
      // Laterales y respaldo: el esqueleto común de percha y frigorífico
      const matLateral = new T.MeshStandardMaterial({
        color: colorCuerpo, roughness: 0.6, metalness: esFrio ? 0.35 : 0.1 });

      for (const x of [espesor / 2, w - espesor / 2]) {
        const lado = new T.Mesh(new T.BoxGeometry(espesor, h, d), matLateral);
        lado.position.set(x, h / 2, d / 2);
        lado.castShadow = true;
        g.add(lado);
      }

      const respaldo = new T.Mesh(
        new T.BoxGeometry(w, h, espesor),
        new T.MeshStandardMaterial({
          color: esFruta ? 0x2f3a33 : colorCuerpo,
          roughness: 0.8 }));
      respaldo.position.set(w / 2, h / 2, espesor / 2);
      respaldo.receiveShadow = true;
      g.add(respaldo);

      if (esFrio) {
        // Puerta de vidrio con su marco: es lo que hace que se reconozca
        // como frigorífico y no como una percha más.
        const puerta = cajaConBorde(w - espesor * 2, h - 0.16, 0.025, 0xd4ecf7,
          { transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.4, sombra: false });
        puerta.position.set(w / 2, h / 2 + 0.04, d);
        g.add(puerta);

        const marco = new T.Mesh(
          new T.BoxGeometry(w, 0.1, 0.06),
          new T.MeshStandardMaterial({ color: 0x9aa8b2, metalness: 0.5, roughness: 0.4 }));
        marco.position.set(w / 2, h - 0.05, d);
        g.add(marco);

        const tirador = new T.Mesh(
          new T.CylinderGeometry(0.018, 0.018, h * 0.55, 8),
          new T.MeshStandardMaterial({ color: 0x8894a0, metalness: 0.75, roughness: 0.25 }));
        tirador.position.set(w - 0.09, h / 2, d + 0.05);
        g.add(tirador);
      }

      if (esMostrador) {
        const tablero = cajaConBorde(w + 0.08, 0.05, d + 0.1, 0x6b4f2a, { roughness: 0.5 });
        tablero.position.set(w / 2, h + 0.03, d / 2);
        g.add(tablero);
      }
    }

    // ---- Niveles con su ocupación ----
    const niveles = Math.max(e.niveles, 1);
    const columnas = Math.max(e.columnas, 1);
    const baseY = esNevera ? 0.08 : 0.12;
    const útil = (esNevera ? h * 0.8 : h - baseY - 0.06);
    const pasoY = útil / niveles;

    for (let n = 1; n <= niveles; n++) {
      const y = baseY + pasoY * (n - 1);

      // La repisa
      const repisa = new T.Mesh(
        new T.BoxGeometry(w - espesor * 2, 0.022, d - espesor),
        new T.MeshStandardMaterial({
          color: esFruta ? 0x3d4a41 : 0xffffff, roughness: 0.55 }));
      repisa.position.set(w / 2, y, d / 2);
      if (esFruta) repisa.rotation.x = -0.18;   // bandeja inclinada
      repisa.receiveShadow = true;
      repisa.castShadow = true;
      g.add(repisa);

      // Un bloque por columna, con el color de su ocupación. Este es el
      // dato: de un vistazo se ve qué parte de la percha está vacía.
      const anchoCol = (w - espesor * 2) / columnas;
      for (let c = 1; c <= columnas; c++) {
        const clave = `${c}|${n}`;
        const info = porNivel.get(clave);
        const ocupada = Boolean(info?.producto_id);
        const altoCaja = Math.min(pasoY * 0.62, 0.34);

        const bloque = cajaConBorde(
          anchoCol * 0.84, ocupada ? altoCaja : altoCaja * 0.35, d * 0.66,
          ocupada ? colorOcupacion(info.llenado ?? 70) : COLOR_VACIO,
          { roughness: 0.75, transparent: !ocupada, opacity: ocupada ? 1 : 0.4 });

        bloque.position.set(
          espesor + anchoCol * (c - 0.5),
          y + (ocupada ? altoCaja : altoCaja * 0.35) / 2 + 0.014,
          d / 2);
        if (esFruta) bloque.rotation.x = -0.18;

        bloque.userData.info = {
          tipo: 'posicion',
          codigo: info?.codigo ?? `${e.codigo_nave}-${e.literal}-${String(c).padStart(2, '0')}-${n}`,
          estructura: e.nombre,
          literal: e.literal,
          columna: c,
          nivel: n,
          producto: info?.producto ?? null,
          producto_codigo: info?.producto_codigo ?? null,
          stock: info?.stock ?? null,
          unidad: info?.unidad ?? null,
          categoria: info?.categoria ?? null,
        };

        g.add(bloque);
      }
    }

    // ---- Etiqueta del literal, flotando sobre el mueble ----
    const etiqueta = crearEtiqueta(e.literal, e.temperatura);
    etiqueta.position.set(w / 2, h + (esNevera ? 0.35 : 0.28), d / 2);
    g.add(etiqueta);

    return g;
  }

  /** Cartel con el literal, dibujado en un canvas y pegado a un plano. */
  function crearEtiqueta(texto, temperatura) {
    const lienzoEtq = document.createElement('canvas');
    lienzoEtq.width = 256;
    lienzoEtq.height = 128;
    const ctx = lienzoEtq.getContext('2d');

    const fondo = temperatura === 'REFRIGERADO' ? '#1f6f8b'
                : temperatura === 'CONGELADO' ? '#2b5f9e'
                : '#013D10';

    ctx.fillStyle = fondo;
    ctx.beginPath();
    ctx.roundRect(8, 24, 240, 80, 16);
    ctx.fill();

    ctx.fillStyle = '#F5C518';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, 128, 66);

    const textura = new T.CanvasTexture(lienzoEtq);
    textura.colorSpace = T.SRGBColorSpace;

    const sprite = new T.Sprite(new T.SpriteMaterial({ map: textura, transparent: true }));
    sprite.scale.set(0.62, 0.31, 1);
    return sprite;
  }

  // =========================================================
  // API pública
  // =========================================================
  function actualizar(estructuras, posiciones) {
    limpiarGrupo(grupoMuebles);

    const activas = (estructuras ?? []).filter((e) => e.activa !== false);
    if (!activas.length) {
      construirLocal(8, 6);
      aplicarCamara();
      return { muebles: 0 };
    }

    // Tamaño del local. Si la sede tiene sus medidas cargadas se usan
    // esas: el plano se parece al local de verdad, con su espacio de
    // circulación y sus paredes donde están. Si no, se deduce de lo que
    // ocupen los muebles más un margen, que es lo que había antes.
    const medido = activas.find((e) => Number(e.ancho_local_cm) > 0);
    let anchoM;
    let fondoM;

    if (medido) {
      anchoM = Number(medido.ancho_local_cm) * CM;
      fondoM = Number(medido.fondo_local_cm) * CM;
    } else {
      const maxX = Math.max(...activas.map((e) => (e.pos_x_cm + e.ancho_cm))) * CM;
      const maxY = Math.max(...activas.map((e) => (e.pos_y_cm + e.fondo_cm))) * CM;
      anchoM = Math.max(maxX + 1.5, 6);
      fondoM = Math.max(maxY + 1.5, 5);
    }

    construirLocal(anchoM, fondoM);

    // Posiciones indexadas por estructura y por celda, para no recorrer
    // el arreglo entero dentro del doble bucle de cada mueble.
    const indice = new Map();
    for (const p of posiciones ?? []) {
      if (!indice.has(p.estructura_id)) indice.set(p.estructura_id, new Map());
      indice.get(p.estructura_id).set(`${p.columna}|${p.nivel}`, p);
    }

    for (const e of activas) {
      grupoMuebles.add(construirMueble(e, indice.get(e.estructura_id) ?? new Map()));
    }

    orbita.centro.set(anchoM / 2, 0.85, fondoM / 2);
    orbita.radio = Math.hypot(anchoM, fondoM) * 0.85;
    aplicarCamara();

    return { muebles: activas.length, anchoM, fondoM };
  }

  const VISTAS = {
    general: { theta: Math.PI / 4,     phi: Math.PI / 3.2, factor: 1.25 },
    frente:  { theta: Math.PI / 2,     phi: Math.PI / 2.5, factor: 1.05 },
    planta:  { theta: Math.PI / 2,     phi: 0.16,          factor: 1.2 },
    pasillo: { theta: Math.PI * 0.42,  phi: Math.PI / 2.15, factor: 0.5 },
  };

  function vista(nombre) {
    const v = VISTAS[nombre] ?? VISTAS.general;
    orbita.theta = v.theta;
    orbita.phi = v.phi;
    // El radio sale del tamaño real de la sala, no de una constante: en
    // una tienda pequeña una cámara a 20 m dejaría los muebles como
    // puntos, y en una grande se quedaría dentro de una percha.
    orbita.radio = Math.hypot(orbita.centro.x, orbita.centro.z) * 2.1 * v.factor;
    aplicarCamara();
  }

  function redimensionar() {
    camara.aspect = ancho() / alto();
    camara.updateProjectionMatrix();
    render.setSize(ancho(), alto());
  }

  // ---------- Bucle ----------
  let vivo = true;
  function animar() {
    if (!vivo) return;
    requestAnimationFrame(animar);
    render.render(escena, camara);
  }

  const observador = new ResizeObserver(redimensionar);
  observador.observe(contenedor);

  aplicarCamara();
  animar();

  function destruir() {
    vivo = false;
    observador.disconnect();
    limpiarGrupo(grupoMuebles);
    limpiarGrupo(grupoLocal);
    render.dispose();
    render.domElement.remove();
  }

  return { actualizar, vista, redimensionar, destruir };
}
