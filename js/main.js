import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { conectarServidor, enviarPosicion, actualizarOtrosJugadores } from './multijugador.js';
import { reproducirSonido } from './sonido.js';

const NIVELES = [
    {
        nombre: 'LA CRIPTA',
        cielo: 0x111a35, suelo: 0x34364a, pared: 0x202940, ambiente: 0x9db7ff, intensidad: 1.35,
        direccional: 0xffd7a1, relleno: 0x5e8dff, grid: 0x39425e, jugador: 0x48cfff, foco: 0xfff1d0,
        niebla: [20, 70],
        objetivo: { clave: 'daga', x: -10, z: -10 },
        mensaje: 'Has encontrado la Daga del Umbral',
        decor: [['build', -18, 9], ['build2', 16, 18], ['watcht', -18, -18], ['window', -5, -20.2], ['plat', 9, -19]],
        enemigos: [[8, -6], [-12, 2]],
        items: { med: [[14, 4]], barrel: [[-3, 6]], nucleo: [[0, -2], [12, -14], [-14, -6]] }
    },
    {
        nombre: 'EL BOSQUE CARMESÍ',
        cielo: 0x301a2c, suelo: 0x493039, pared: 0x3a1f2b, ambiente: 0xffa5a5, intensidad: 1.15,
        direccional: 0xff684f, relleno: 0xff3b6b, grid: 0x9d5266, jugador: 0xffbd76, foco: 0xffc9a0,
        niebla: [12, 50],
        objetivo: { clave: 'armadura', x: 10, z: -10 },
        mensaje: 'La Armadura despierta el siguiente portal',
        decor: [['ship', -14, 15], ['plat', -19, -19], ['build', 18, -18]],
        enemigos: [[-8, -8], [6, -2], [-14, -14]],
        items: { med: [[-16, 0]], barrel: [[14, 8]], nucleo: [[-4, -14], [16, -4], [-10, 6]] }
    },
    {
        nombre: 'EL TRONO DE KAEL',
        cielo: 0x071e20, suelo: 0x263e39, pared: 0x15302c, ambiente: 0x9cffe0, intensidad: 1.5,
        direccional: 0x68f0d0, relleno: 0x45ffd1, grid: 0x4d9b87, jugador: 0x8bffe0, foco: 0xd0fff0,
        niebla: [24, 80],
        objetivo: { clave: 'caballero', x: 0, z: -13 },
        mensaje: 'Has llegado al final de La Falla de Kael',
        decor: [['watcht', 18, -18], ['build2', -18, -16], ['ship', 16, 15], ['window', 5, -20.2]],
        enemigos: [[-8, -6], [8, -6], [0, 0], [-14, 4]],
        items: { med: [[-14, 8], [12, 4]], barrel: [[-6, -16]], nucleo: [[14, -8], [-16, -4], [4, 6]] }
    }
];

// 2 niveles de dificultad: cambian enemigos, visión, vidas y puntos 
const DIFICULTADES = {
    facil:   { nombre: 'FÁCIL',   velEnemigo: 2.4, vision: 7,  extraEnemigos: 0, vidas: 5, multPuntos: 1 },
    dificil: { nombre: 'DIFÍCIL', velEnemigo: 4.2, vision: 12, extraEnemigos: 2, vidas: 3, multPuntos: 1.5 }
};

const TIEMPO_AVENTURA = 120;      // segundos por nivel
const TIEMPO_SUPERVIVENCIA = 90;  // segundos que hay que aguantar

const RUTAS = {
    daga: { tipo: 'gltf', ruta: 'assets/modelos/Daga/source/fantasy_dagger.glb' },
    armadura: { tipo: 'gltf', ruta: 'assets/modelos/Armadura/source/scifi_armor.glb' },
    caballero: { tipo: 'gltf', ruta: 'assets/modelos/Caballero Oscuro/source/dark_knight.glb' },
    troll: { tipo: 'obj', base: 'assets/modelos/Troll/source/Trolloc_com_cara_de_p_1107163050_obj/', obj: 'Trolloc_com_cara_de_p_1107163050.obj', mtl: 'Trolloc_com_cara_de_p_1107163050.mtl' },
    plat: { tipo: 'obj', base: 'assets/modelos/plat/source/', obj: 'skylift_01_977de03af93efb9e.obj', mtl: 'skylift_01_977de03af93efb9e.mtl' },
    med: { tipo: 'gltf', ruta: 'assets/modelos/med/future_first_aid_kit.glb' },
    ship: { tipo: 'gltf', ruta: 'assets/modelos/ship/space_ship.glb' },
    barrel: { tipo: 'gltf', ruta: 'assets/modelos/barrel/sci_-_fi_barrels_pack.glb' },
    mach: { tipo: 'gltf', ruta: 'assets/modelos/mach/sci-fi_lab_machine.glb' },
    window: { tipo: 'gltf', ruta: 'assets/modelos/window/scifi_windows.glb' },
    watcht: { tipo: 'gltf', ruta: 'assets/modelos/watcht/watchtower_gamereadylowpoly.glb' },
    build: { tipo: 'gltf', ruta: 'assets/modelos/build/brutalist_building.glb' },
    build2: { tipo: 'gltf', ruta: 'assets/modelos/build2/brutalist_building.glb' }
};

const ESCALA_DECOR = { ship: 1.5, window: 1.0, watcht: 5.0, build: 3.0, build2: 4.0 };
const ROTACION_DECOR = { ship: Math.PI, window: Math.PI * 0.5, build: Math.PI * 0.5, build2: Math.PI * 0.004 };

let mundoListo = null;
let partidaId = 0;
let alTerminarCallback = null;

let scene, camera, renderer, reloj;
let luzAmbiente, luzPrincipal, luzRelleno, foco;
let suelo, grid, paredMaterial, jugador;
let grupoNivel = null;

const modelos = {};
const paredes = [];
const solidos = [];
const enemigos = [];
const items = [];
let objetivo = null;
const teclas = {};
let estado = null;

// SISTEMA DE PARTÍCULAS
let polvoAmbiental = null;
const particulas = [];
const geoParticula = new THREE.BoxGeometry(0.14, 0.14, 0.14);
const matsParticula = new Map();

function materialParticula(color) {
    if (!matsParticula.has(color)) {
        matsParticula.set(color, new THREE.MeshBasicMaterial({ color }));
    }
    return matsParticula.get(color);
}

function crearParticulas(pos, color, cantidad = 14, velocidad = 4.5) {
    if (!grupoNivel) return;
    const mat = materialParticula(color);
    for (let i = 0; i < cantidad; i++) {
        const mesh = new THREE.Mesh(geoParticula, mat);
        mesh.position.set(pos.x, (pos.y || 0.6) + 0.3, pos.z);
        const angulo = Math.random() * Math.PI * 2;
        const fuerza = (0.3 + Math.random() * 0.7) * velocidad;
        grupoNivel.add(mesh);
        particulas.push({
            mesh,
            vx: Math.cos(angulo) * fuerza,
            vy: 1.5 + Math.random() * velocidad * 0.8,
            vz: Math.sin(angulo) * fuerza,
            vida: 0.45 + Math.random() * 0.25,
            vidaMax: 0.7
        });
    }
}

function actualizarParticulas(delta) {
    if (polvoAmbiental) polvoAmbiental.rotation.y += delta * 0.04;

    for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];
        p.vida -= delta;
        if (p.vida <= 0) {
            if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
            particulas.splice(i, 1);
            continue;
        }
        p.vy -= 9.8 * delta;
        p.mesh.position.x += p.vx * delta;
        p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * delta);
        p.mesh.position.z += p.vz * delta;
        p.mesh.rotation.x += delta * 6;
        p.mesh.rotation.y += delta * 6;
        p.mesh.scale.setScalar(Math.max(0.01, p.vida / p.vidaMax));
    }
}

function crearMundo() {
    const canvas = document.getElementById('webgl-canvas');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(NIVELES[0].cielo);
    scene.fog = new THREE.Fog(NIVELES[0].cielo, 20, 70);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 250);
    camera.position.set(0, 7, 20);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    //Iluminacion ambiental
    luzAmbiente = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(luzAmbiente);

    luzPrincipal = new THREE.DirectionalLight(0xffffff, 2.0);
    luzPrincipal.position.set(-8, 16, 7);
    luzPrincipal.castShadow = true;
    luzPrincipal.shadow.mapSize.set(1024, 1024);
    luzPrincipal.shadow.camera.left = -30;
    luzPrincipal.shadow.camera.right = 30;
    luzPrincipal.shadow.camera.top = 30;
    luzPrincipal.shadow.camera.bottom = -30;
    scene.add(luzPrincipal);

    luzRelleno = new THREE.PointLight(0x5e8dff, 35, 30);
    scene.add(luzRelleno);

    // Luz focal: Linterna que sigue al jugador
    foco = new THREE.SpotLight(0xffffff, 40, 26, Math.PI / 6, 0.45, 1);
    scene.add(foco);
    scene.add(foco.target);

    suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.MeshStandardMaterial({ color: NIVELES[0].suelo, roughness: 0.92, metalness: 0.05 })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    scene.add(suelo);

    grid = new THREE.GridHelper(60, 60, 0x6a7ca6, 0x39425e);
    grid.position.y = 0.015;
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    scene.add(grid);

    // Partículas ambientales flotantes
    const totalMotas = 180;
    const posiciones = new Float32Array(totalMotas * 3);
    for (let i = 0; i < totalMotas; i++) {
        posiciones[i * 3] = (Math.random() - 0.5) * 48;
        posiciones[i * 3 + 1] = 0.4 + Math.random() * 6.5;
        posiciones[i * 3 + 2] = (Math.random() - 0.5) * 48;
    }
    const geoPolvo = new THREE.BufferGeometry();
    geoPolvo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    polvoAmbiental = new THREE.Points(
        geoPolvo,
        new THREE.PointsMaterial({ color: NIVELES[0].direccional, size: 0.16, transparent: true, opacity: 0.65 })
    );
    scene.add(polvoAmbiental);

    // Paredes del escenario
    paredMaterial = new THREE.MeshStandardMaterial({ color: 0x202940, roughness: 0.8, metalness: 0.15 });
    function crearPared(x, z, sx, sz) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, 3, sz), paredMaterial);
        mesh.position.set(x, 1.5, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        paredes.push(new THREE.Box3().setFromObject(mesh));
    }
    crearPared(0, -25, 50, 1); crearPared(0, 25, 50, 1);
    crearPared(-25, 0, 1, 50); crearPared(25, 0, 1, 50);

    // Jugador
    jugador = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.42, 0.7, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x48cfff, roughness: 0.38, metalness: 0.25, emissive: 0x062638 })
    );
    jugador.position.set(0, 0.82, 12);
    jugador.castShadow = true;
    scene.add(jugador);

    // Teclado
    function manejarTeclas(e, presionada) {
        if (e.target && e.target.tagName === 'INPUT') return;
        const tecla = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(tecla)) e.preventDefault();
        teclas[tecla] = presionada;
    }
    window.addEventListener('keydown', e => manejarTeclas(e, true));
    window.addEventListener('keyup', e => manejarTeclas(e, false));
    window.addEventListener('blur', () => Object.keys(teclas).forEach(k => teclas[k] = false));

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Multijugador en tiempo real
    conectarServidor(scene);

    reloj = new THREE.Clock();
    animar();

    mostrarAviso('CARGANDO...', 60000);
    return Promise.all(Object.keys(RUTAS).map(cargarModelo));
}

//  CARGA DE MODELOS
function normalizarModelo(objeto, alturaObjetivo = 3.2) {
    objeto.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(objeto);
    const tam = new THREE.Vector3();
    caja.getSize(tam);
    const mayor = Math.max(tam.x, tam.y, tam.z) || 1;
    objeto.scale.multiplyScalar(alturaObjetivo / mayor);
    objeto.updateMatrixWorld(true);
    const cajaEscalada = new THREE.Box3().setFromObject(objeto);
    const centroEscalado = new THREE.Vector3();
    cajaEscalada.getCenter(centroEscalado);
    objeto.position.x -= centroEscalado.x;
    objeto.position.z -= centroEscalado.z;
    objeto.position.y -= cajaEscalada.min.y;
    objeto.traverse(n => {
        if (n.isMesh) {
            n.castShadow = true;
            n.receiveShadow = true;
            if (n.material) {
                n.material.side = THREE.DoubleSide;
                n.material.needsUpdate = true;
            }
        }
    });
}

function cargarModelo(clave) {
    const cargadorGLTF = new GLTFLoader();
    const cargadorMTL = new MTLLoader();
    const cargadorOBJ = new OBJLoader();
    return new Promise(resolve => {
        const conf = RUTAS[clave];
        const listo = (objeto, altura) => {
            normalizarModelo(objeto, altura);
            modelos[clave] = objeto;
            resolve(objeto);
        };
        const fallo = err => { console.error('No se pudo cargar ' + clave, err); resolve(null); };

        if (conf.tipo === 'gltf') {
            cargadorGLTF.load(conf.ruta, gltf => listo(gltf.scene, clave === 'caballero' ? 4.1 : 3.0), undefined, fallo);
        } else {
            cargadorMTL.setPath(conf.base).load(conf.mtl, materiales => {
                materiales.preload();
                cargadorOBJ.setMaterials(materiales).setPath(conf.base).load(conf.obj, o => listo(o, 4.2), undefined, fallo);
            }, undefined, () => {
                cargadorOBJ.setPath(conf.base).load(conf.obj, o => listo(o, 4.2), undefined, fallo);
            });
        }
    });
}

// Copia un modelo cargado
function clonarModelo(clave) {
    return modelos[clave] ? modelos[clave].clone(true) : new THREE.Group();
}

//  CONSTRUCCIÓN DE NIVELES
function agregarSolido(objeto) {
    grupoNivel.add(objeto);
    objeto.updateMatrixWorld(true);
    solidos.push(new THREE.Box3().setFromObject(objeto));
}

function ponerDecor(clave, x, z) {
    if (!modelos[clave]) return;
    const grupo = new THREE.Group();
    const modelo = clonarModelo(clave);
    if (ESCALA_DECOR[clave]) modelo.scale.setScalar(ESCALA_DECOR[clave]);
    grupo.add(modelo);
    grupo.position.set(x, clave === 'window' ? 1.5 : 0, z);
    grupo.rotation.y = ROTACION_DECOR[clave] ?? Math.PI * 0.08;
    agregarSolido(grupo);
}

function crearObjetivo({ clave, x, z }, comoEstatua) {
    const grupo = new THREE.Group();
    grupo.add(clonarModelo(clave));
    grupo.position.set(x, 0, z);
    grupo.rotation.y = clave === 'daga' ? -0.25 : Math.PI * 0.08;
    if (comoEstatua) { agregarSolido(grupo); return; }
    grupoNivel.add(grupo);
    const aura = new THREE.PointLight(NIVELES[estado.nivel].direccional, 4, 9);
    aura.position.set(x, 2.3, z);
    grupoNivel.add(aura);
    objetivo = { objeto: grupo, aura, clave };
}

function crearEnemigo(x, z) {
    const grupo = new THREE.Group();
    grupo.add(clonarModelo('troll'));
    if (modelos.troll) grupo.scale.setScalar(0.45);
    grupo.position.set(x, 0, z);
    grupoNivel.add(grupo);
    enemigos.push({
        objeto: grupo,
        inicio: new THREE.Vector3(x, 0, z),
        destino: new THREE.Vector3(x, 0, z),
        cambioDestino: 0,
        persiguiendo: false
    });
}

const MODELO_ITEM = { nucleo: 'mach', med: 'med', barrel: 'barrel' };

function crearItem(tipo, x, z) {
    const clave = MODELO_ITEM[tipo];
    const grupo = new THREE.Group();
    grupo.add(clonarModelo(clave));
    if (modelos[clave]) grupo.scale.setScalar(tipo === 'nucleo' ? 0.35 : 0.4);
    const baseY = 0.2;
    grupo.position.set(x, baseY, z);
    grupoNivel.add(grupo);
    items.push({ objeto: grupo, tipo, baseY });
}

function construirNivel(indice) {
    const c = NIVELES[indice];
    const esAventura = estado.modo === 'aventura';
    estado.nivel = indice;
    estado.nucleosNivel = 0;

    if (grupoNivel) scene.remove(grupoNivel);
    grupoNivel = new THREE.Group();
    scene.add(grupoNivel);
    solidos.length = 0;
    enemigos.length = 0;
    items.length = 0;
    objetivo = null;

    particulas.length = 0;
    if (polvoAmbiental) polvoAmbiental.material.color.setHex(c.direccional);

    // Ambientación
    scene.background.setHex(c.cielo);
    scene.fog.color.setHex(c.cielo);
    scene.fog.near = c.niebla[0];
    scene.fog.far = c.niebla[1];
    suelo.material.color.setHex(c.suelo);
    paredMaterial.color.setHex(c.pared);
    luzAmbiente.color.setHex(c.ambiente);
    luzAmbiente.intensity = c.intensidad;
    luzPrincipal.color.setHex(c.direccional);
    luzRelleno.color.setHex(c.relleno);
    foco.color.setHex(c.foco);
    grid.material.color.setHex(c.grid);
    jugador.material.color.setHex(c.jugador);
    jugador.position.set(0, 0.82, 12);
    jugador.visible = true;

    for (const [clave, x, z] of c.decor) ponerDecor(clave, x, z);
    crearObjetivo(c.objetivo, !esAventura); // en supervivencia es solo una estatua

    for (const [x, z] of c.enemigos) crearEnemigo(x, z);
    for (let i = 0; i < estado.dif.extraEnemigos; i++) crearEnemigo(...posicionLibre(10));

    for (const tipo of Object.keys(c.items)) {
        for (const [x, z] of c.items[tipo]) crearItem(tipo, x, z);
    }

    actualizarHUD(true);
}



function azar(min, max) { return min + Math.random() * (max - min); }

function distancia2D(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

const cajaTemp = new THREE.Box3();
const minTemp = new THREE.Vector3();
const maxTemp = new THREE.Vector3();


function hayChoque(x, z, radio, alto = 1.6) {
    minTemp.set(x - radio, 0.05, z - radio);
    maxTemp.set(x + radio, alto, z + radio);
    cajaTemp.set(minTemp, maxTemp);
    for (const p of paredes) if (cajaTemp.intersectsBox(p)) return true;
    for (const s of solidos) if (cajaTemp.intersectsBox(s)) return true;
    return false;
}


function moverConColision(pos, dx, dz, radio) {
    if (!hayChoque(pos.x + dx, pos.z, radio)) pos.x += dx;
    if (!hayChoque(pos.x, pos.z + dz, radio)) pos.z += dz;
}

function posicionLibre(distanciaMinima = 5) {
    for (let i = 0; i < 50; i++) {
        const x = azar(-21, 21);
        const z = azar(-21, 21);
        if (Math.hypot(x - jugador.position.x, z - jugador.position.z) < distanciaMinima) continue;
        if (hayChoque(x, z, 1.2, 3)) continue;
        return [x, z];
    }
    return [0, -2];
}

function mostrarAviso(texto, duracion = 2500) {
    let el = document.getElementById('aviso-nivel');
    if (!el) {
        el = document.createElement('div');
        el.id = 'aviso-nivel';
        document.getElementById('game-container').appendChild(el);
    }
    el.textContent = texto;
    el.classList.add('visible');
    clearTimeout(mostrarAviso.timer);
    mostrarAviso.timer = setTimeout(() => el.classList.remove('visible'), duracion);
}

function ponerTexto(id, texto) {
    const el = document.getElementById(id);
    if (el && el.textContent !== texto) el.textContent = texto;
}

function actualizarHUD() {
    if (!estado) return;
    const c = NIVELES[estado.nivel];
    const dif = estado.dif.nombre;
    ponerTexto('hud-nivel', estado.modo === 'aventura'
        ? `NIVEL: ${estado.nivel + 1}/3 · ${c.nombre} · ${dif}`
        : `SUPERVIVENCIA · ${c.nombre} · ${dif}`);
    ponerTexto('puntuacion', String(Math.floor(estado.puntos)).padStart(4, '0'));
    ponerTexto('nucleos', estado.modo === 'aventura' ? `${estado.nucleosNivel}/3` : String(estado.nucleos));
    ponerTexto('vidas', '♥'.repeat(Math.max(estado.vidas, 0)));
    const t = Math.max(0, Math.ceil(estado.tiempo));
    ponerTexto('tiempo', `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
}

function sumarPuntos(n) { estado.puntos += n * estado.dif.multPuntos; }

function aplicarCalidad(calidad) {
    const opciones = {
        baja: { pixeles: 0.75, sombras: false, mapa: 512 },
        media: { pixeles: 1, sombras: true, mapa: 1024 },
        alta: { pixeles: Math.min(window.devicePixelRatio || 1, 2), sombras: true, mapa: 2048 }
    }[calidad] || { pixeles: 1, sombras: true, mapa: 1024 };

    renderer.setPixelRatio(opciones.pixeles);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = opciones.sombras;
    luzPrincipal.castShadow = opciones.sombras;
    luzPrincipal.shadow.mapSize.set(opciones.mapa, opciones.mapa);
    if (luzPrincipal.shadow.map) { luzPrincipal.shadow.map.dispose(); luzPrincipal.shadow.map = null; }
    scene.traverse(o => {
        if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true);
    });
}

//  LÓGICA DEL JUEGO
function recoger(item) {
    const pos = item.objeto.position;
    grupoNivel.remove(item.objeto);
    if (item.tipo === 'nucleo') {
        reproducirSonido('nucleo');
        crearParticulas(pos, 0x48cfff, 20, 5.5);
        sumarPuntos(250);
        estado.nucleos++;
        estado.nucleosNivel++;
        if (estado.modo === 'aventura' && estado.nucleosNivel === 3 && objetivo) {
            objetivo.aura.intensity = 25;
            crearParticulas(objetivo.objeto.position, 0xffd700, 30, 6.5);
            setTimeout(() => reproducirSonido('portal'), 250);
            mostrarAviso('¡PORTAL ACTIVO! VE POR EL OBJETIVO BRILLANTE');
        }
    } else if (item.tipo === 'med') {
        reproducirSonido('curar');
        crearParticulas(pos, 0x4dff88, 16, 4.5);
        sumarPuntos(100);
        estado.vidas = Math.min(estado.vidas + 1, estado.dif.vidas);
        mostrarAviso('BOTIQUÍN · +1 VIDA', 1500);
    } else if (item.tipo === 'barrel') {
        reproducirSonido('turbo');
        crearParticulas(pos, 0xffaa00, 18, 5.0);
        sumarPuntos(100);
        estado.turboHasta = estado.t + 6;
        mostrarAviso('BARRIL DE ENERGÍA · ¡TURBO 6s!', 1500);
    }
    if (estado.modo === 'supervivencia') crearItem(item.tipo, ...posicionLibre(6));
}

function recibirGolpe(enemigo) {
    reproducirSonido('golpe');
    crearParticulas(jugador.position, 0xff3b5c, 18, 5.0);
    estado.vidas--;
    estado.invulnerableHasta = estado.t + 1.5;
    const dx = jugador.position.x - enemigo.objeto.position.x;
    const dz = jugador.position.z - enemigo.objeto.position.z;
    const largo = Math.hypot(dx, dz) || 1;
    moverConColision(jugador.position, (dx / largo) * 1.5, (dz / largo) * 1.5, 0.36);
    if (estado.vidas <= 0) terminar(false, 'Los trolls te atraparon');
}

function completarNivel() {
    sumarPuntos(1000 + Math.floor(estado.tiempo) * 10);
    if (estado.nivel < NIVELES.length - 1) {
        reproducirSonido('nivel');
        const mensaje = NIVELES[estado.nivel].mensaje;
        construirNivel(estado.nivel + 1);
        estado.tiempo = TIEMPO_AVENTURA;
        mostrarAviso(`${mensaje} · ${NIVELES[estado.nivel].nombre}`, 3500);
    } else {
        terminar(true, '¡LA FALLA HA SIDO SELLADA!');
    }
}

function terminar(gano, motivo) {
    reproducirSonido(gano ? 'victoria' : 'derrota');
    estado.activo = false;
    jugador.visible = true;
    enviarPosicion(jugador.position, -1);
    if (alTerminarCallback) {
        alTerminarCallback({
            gano, motivo,
            puntos: Math.floor(estado.puntos),
            modo: estado.modo,
            dificultad: estado.dificultad,
            nivel: estado.nivel + 1
        });
    }
}

function moverEnemigos(delta) {
    const dif = estado.dif;
    const objetivoJugador = new THREE.Vector3(jugador.position.x, 0, jugador.position.z);

    for (const e of enemigos) {
        const pos = e.objeto.position;
        const dist = distancia2D(pos, objetivoJugador);

        // IA: si el jugador entra en su campo de visión, lo persigue
        const loVe = dist < dif.vision;
        e.persiguiendo = loVe;

        // Si no lo ve, patrulla cerca de donde apareció
        if (!loVe && (distancia2D(pos, e.destino) < 0.5 || estado.t > e.cambioDestino)) {
            e.destino.set(e.inicio.x + azar(-4, 4), 0, e.inicio.z + azar(-4, 4));
            e.cambioDestino = estado.t + 4;
        }

        const meta = loVe ? objetivoJugador : e.destino;
        const vel = (loVe ? dif.velEnemigo : dif.velEnemigo * 0.4) * delta;
        const dx = meta.x - pos.x;
        const dz = meta.z - pos.z;
        const largo = Math.hypot(dx, dz);
        if (largo > 0.05) {
            moverConColision(pos, (dx / largo) * vel, (dz / largo) * vel, 0.5);
            e.objeto.rotation.y = Math.atan2(dx, dz);
        }
        // Pequeño "caminado"
        e.objeto.position.y = Math.abs(Math.sin(estado.t * (loVe ? 10 : 5))) * 0.12;

        if (dist < 1.3 && estado.t > estado.invulnerableHasta && estado.activo) recibirGolpe(e);
    }
}

function actualizarJuego(delta) {
    estado.t += delta;
    estado.tiempo -= delta;

    // Tiempo
    if (estado.modo === 'supervivencia') {
        sumarPuntos(5 * delta);
        if (estado.t >= estado.siguienteRefuerzo && enemigos.length < 10) {
            crearEnemigo(...posicionLibre(12));
            estado.siguienteRefuerzo += 15;
            reproducirSonido('alerta');
            mostrarAviso('¡LLEGAN MÁS TROLLS!', 1500);
        }
        if (estado.tiempo <= 0) return terminar(true, '¡Sobreviviste a la horda!');
    } else if (estado.tiempo <= 0) {
        return terminar(false, 'Se acabó el tiempo');
    }

    // Movimiento del jugador
    const anterior = jugador.position.clone();
    const turbo = estado.t < estado.turboHasta ? 1.7 : 1;
    const velocidad = 7.0 * turbo * delta;
    let dx = 0, dz = 0;
    if (teclas.w || teclas.arrowup) dz -= 1;
    if (teclas.s || teclas.arrowdown) dz += 1;
    if (teclas.a || teclas.arrowleft) dx -= 1;
    if (teclas.d || teclas.arrowright) dx += 1;
    if (dx || dz) {
        const largo = Math.hypot(dx, dz);
        moverConColision(jugador.position, (dx / largo) * velocidad, (dz / largo) * velocidad, 0.36);
    }

    // Objetivo del nivel (modo aventura)
    if (objetivo) {
        objetivo.objeto.rotation.y += delta * 0.25;
        if (distancia2D(jugador.position, objetivo.objeto.position) < 2.2) {
            if (estado.nucleosNivel >= 3) {
                completarNivel();
                if (!estado.activo) return;
            } else {
                jugador.position.copy(anterior);
                if (estado.t > estado.avisoBloqueo) {
                    reproducirSonido('alerta');
                    mostrarAviso('NECESITAS 3 NÚCLEOS PARA ACTIVARLO', 1500);
                    estado.avisoBloqueo = estado.t + 2;
                }
            }
        }
    }

    // Ítems
    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.objeto.rotation.y += delta * 2;
        it.objeto.position.y = it.baseY + Math.sin(estado.t * 3 + i) * 0.15;
        if (distancia2D(it.objeto.position, jugador.position) < 1.3) {
            items.splice(i, 1);
            recoger(it);
        }
    }

    moverEnemigos(delta);
    if (!estado.activo) return;

    // Parpadeo cuando te golpean
    jugador.visible = estado.t > estado.invulnerableHasta || Math.floor(estado.t * 10) % 2 === 0;

    // Enviar posición al servidor ~15 veces por segundo
    if (estado.t - estado.ultimoEnvio > 0.066) {
        enviarPosicion(jugador.position, estado.nivel);
        estado.ultimoEnvio = estado.t;
    }

    if (estado.t < estado.turboHasta && Math.random() < 0.45) {
        crearParticulas(jugador.position, 0xffaa00, 1, 1.5);
    }
    actualizarParticulas(delta);

    actualizarHUD();
}

function animar() {
    requestAnimationFrame(animar);
    const delta = Math.min(reloj.getDelta(), 0.05);
    const jugando = estado && estado.activo && !estado.pausado;

    if (jugando) actualizarJuego(delta);
    actualizarOtrosJugadores(delta, estado && estado.activo ? estado.nivel : -99);

    // Cámara y luces siguen al jugador
    const objetivoCamara = new THREE.Vector3(jugador.position.x, jugador.position.y + 5.2, jugador.position.z + 8.8);
    camera.position.lerp(objetivoCamara, 1 - Math.pow(0.001, delta));
    camera.lookAt(jugador.position.x, jugador.position.y + 0.8, jugador.position.z - 1.5);
    luzRelleno.position.set(jugador.position.x - 2, 4, jugador.position.z + 1);
    foco.position.set(jugador.position.x, 7, jugador.position.z + 3);
    foco.target.position.set(jugador.position.x, 0, jugador.position.z - 3);

    renderer.render(scene, camera);
}



export async function iniciarJuego(opciones = {}) {
    const { modo = 'aventura', dificultad = 'facil', calidad = 'media' } = opciones;
    const id = ++partidaId;
    if (!mundoListo) mundoListo = crearMundo();
    await mundoListo;
    if (id !== partidaId) return; // el jugador salió mientras cargaba

    aplicarCalidad(calidad);
    const dif = DIFICULTADES[dificultad] || DIFICULTADES.facil;
    estado = {
    modo, dificultad, dif,
    nivel: 0,
    vidas: dif.vidas,
    puntos: 0,
    nucleos: 0,
    nucleosNivel: 0,
    tiempo: modo === 'aventura' ? TIEMPO_AVENTURA : TIEMPO_SUPERVIVENCIA,
    t: 0,
    invulnerableHasta: 0,
    turboHasta: 0,
    avisoBloqueo: 0,
    ultimoEnvio: 0,
    siguienteRefuerzo: 15,
    activo: true,
    pausado: false
    };
    Object.keys(teclas).forEach(k => teclas[k] = false);

   
    construirNivel(modo === 'aventura' ? 0 : 2);
    mostrarAviso(modo === 'aventura'
        ? `${NIVELES[0].nombre} · JUNTA 3 NÚCLEOS Y TOMA LA DAGA`
        : `SUPERVIVENCIA · AGUANTA ${TIEMPO_SUPERVIVENCIA} SEGUNDOS`, 3500);

}

export function salirAlMenu() {
    partidaId++;
    if (estado) {
        estado.activo = false;
        enviarPosicion(jugador.position, -1);
    }
}

export function alTerminar(fn) {
    alTerminarCallback = fn;
}

export function alternarPausa(forzar) {
    if (!estado || !estado.activo) return null;
    estado.pausado = typeof forzar === 'boolean' ? forzar : !estado.pausado;
    Object.keys(teclas).forEach(k => teclas[k] = false);
    return estado.pausado;
}
