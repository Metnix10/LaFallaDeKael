import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

let juegoIniciado = false;
let motor = null;

const NIVELES = [
    { nombre: 'NIVEL 1 · LA CRIPTA', cielo: 0x111a35, suelo: 0x34364a, ambiente: 0x9db7ff, intensidad: 1.35, direccional: 0xffd7a1, objetivo: 'daga', mensaje: 'Has encontrado la Daga del Umbral' },
    { nombre: 'NIVEL 2 · EL BOSQUE CARMESÍ', cielo: 0x301a2c, suelo: 0x493039, ambiente: 0xffa5a5, intensidad: 1.15, direccional: 0xff684f, objetivo: 'armadura', mensaje: 'La Armadura despierta el siguiente portal' },
    { nombre: 'NIVEL 3 · EL TRONO DE KAEL', cielo: 0x071e20, suelo: 0x263e39, ambiente: 0x9cffe0, intensidad: 1.5, direccional: 0x68f0d0, objetivo: 'caballero', mensaje: 'Has llegado al final de La Falla de Kael' }
];

export function iniciarJuego() {
    if (juegoIniciado) {
        if (motor) motor.pausado = false;
        return;
    }
    juegoIniciado = true;

    const canvas = document.getElementById('webgl-canvas');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(NIVELES[0].cielo);
    scene.fog = new THREE.Fog(NIVELES[0].cielo, 24, 75);

    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 250);
    camera.position.set(0, 7, 11);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const luzAmbiente = new THREE.AmbientLight(NIVELES[0].ambiente, NIVELES[0].intensidad);
    scene.add(luzAmbiente);
    const luzPrincipal = new THREE.DirectionalLight(NIVELES[0].direccional, 2.0);
    luzPrincipal.position.set(-8, 16, 7);
    luzPrincipal.castShadow = true;
    luzPrincipal.shadow.mapSize.set(1024, 1024);
    luzPrincipal.shadow.camera.left = -30;
    luzPrincipal.shadow.camera.right = 30;
    luzPrincipal.shadow.camera.top = 30;
    luzPrincipal.shadow.camera.bottom = -30;
    scene.add(luzPrincipal);
    const luzRelleno = new THREE.PointLight(0x5e8dff, 35, 30);
    luzRelleno.position.set(0, 4, 0);
    scene.add(luzRelleno);

    const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.MeshStandardMaterial({ color: NIVELES[0].suelo, roughness: 0.92, metalness: 0.05 })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    scene.add(suelo);

    const grid = new THREE.GridHelper(60, 60, 0x6a7ca6, 0x39425e);
    grid.position.y = 0.015;
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    scene.add(grid);

    // Límites físicos del escenario.
    const paredes = [];
    const paredMaterial = new THREE.MeshStandardMaterial({ color: 0x202940, roughness: 0.8, metalness: 0.15 });
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

    const jugador = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.42, 0.7, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x48cfff, roughness: 0.38, metalness: 0.25, emissive: 0x062638 })
    );
    jugador.position.set(0, 0.82, 12);
    jugador.castShadow = true;
    scene.add(jugador);

    // const jugadorBoxHelper = new THREE.BoxHelper(jugador, 0x00ffff);
    // scene.add(jugadorBoxHelper);

    const cargadorGLTF = new GLTFLoader();
    const cargadorMTL = new MTLLoader();
    const cargadorOBJ = new OBJLoader();
    const modelos = {};
    const colisionables = [];
    let nivelActual = 0;
    let objetivoActual = null;
    let completado = false;
    let avisoHasta = 0;
    let aviso = '';
    const teclas = {};

    const rutas = {
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
        build2: { tipo: 'gltf', ruta: 'assets/modelos/build2/brutalist_building.glb' },
        build3: { tipo: 'gltf', ruta: 'assets/modelos/build3/.glb' },
    };

    function normalizarModelo(objeto, alturaObjetivo = 3.2) {
        objeto.updateMatrixWorld(true);
        const caja = new THREE.Box3().setFromObject(objeto);
        const tam = new THREE.Vector3();
        const centro = new THREE.Vector3();
        caja.getSize(tam);
        caja.getCenter(centro);
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
    return new Promise((resolve) => {
        const conf = rutas[clave];
        
        if (conf.tipo === 'gltf') {
            cargadorGLTF.load(conf.ruta, gltf => {
                const objeto = gltf.scene;
                normalizarModelo(objeto, clave === 'caballero' ? 4.1 : 3.0);
                modelos[clave] = objeto;
                resolve(objeto);
            }, undefined, err => { 
                console.error('No se pudo cargar ' + clave, err); 
                resolve(null); 
            });
        } else {
            const base = conf.base;
            
            if (conf.mtl) {
                cargadorMTL.setPath(base).load(conf.mtl, materiales => {
                    materiales.preload();
                    cargadorOBJ.setMaterials(materiales).setPath(base).load(conf.obj, objeto => {
                        normalizarModelo(objeto, 4.2); 
                        modelos[clave] = objeto; 
                        resolve(objeto);
                    }, undefined, () => resolve(null));
                }, undefined, () => {
                    console.warn('Fallo el MTL, cargando OBJ sin materiales para: ' + clave);
                    cargadorOBJ.setPath(base).load(conf.obj, objeto => { 
                        normalizarModelo(objeto, 4.2); 
                        modelos[clave] = objeto; 
                        resolve(objeto); 
                    }, undefined, () => resolve(null));
                });
            } else {
                cargadorOBJ.setPath(base).load(conf.obj, objeto => {
                    normalizarModelo(objeto, 4.2); 
                    modelos[clave] = objeto; 
                    resolve(objeto);
                }, undefined, err => {
                    console.error('No se pudo cargar OBJ: ' + clave, err);
                    resolve(null);
                });
            }
        }
    });
}

   function ponerModelo(clave, x, z, objetivo = false) {
        const original = modelos[clave];
        if (!original) return null;
        const objeto = new THREE.Group();
        const modelo = original.clone(true); 

        if (clave === 'ship') {
            modelo.scale.set(1.5, 1.5, 1.5);
        } else if (clave === 'barrel') {
            modelo.scale.set(0.8, 0.8, 0.8); 
        } else if (clave === 'mach') {
            modelo.scale.set(1.5, 1.5, 1.5); 
        } else if (clave === 'window') {
            modelo.scale.set(1.0, 1.0, 1.0); 
        } else if (clave === 'watcht') {
            modelo.scale.set(5.0, 5.0, 5.0); 
        } else if (clave === 'build') {
            modelo.scale.set(3.0, 3.0, 3.0); 
        } else if (clave === 'build2') {
            modelo.scale.set(4.0, 4.0, 4.0); 
        }

        objeto.add(modelo);

        let alturaY = 0;
        if (clave === 'window') {
            alturaY = 1.5;
        }
        objeto.position.set(x, alturaY, z);

        if (clave === 'ship') {
            objeto.rotation.y = Math.PI; 
        } else if (clave === 'window') {
            objeto.rotation.y = Math.PI * 0.5;
        } else if (clave === 'build') {
            objeto.rotation.y = Math.PI * 0.5;
        } else if (clave === 'build2') {
            objeto.rotation.y = Math.PI * 0.004;
        } else {
            objeto.rotation.y = clave === 'daga' ? -0.25 : Math.PI * 0.08;
        } 

        scene.add(objeto);

        const caja = new THREE.Box3().setFromObject(objeto);

        // const helper = new THREE.BoxHelper(objeto, 0xff0000); 
        // scene.add(helper);

        const registro = { objeto, caja, clave, objetivo };
        colisionables.push(registro);
        
        return registro;
    }

    function limpiarModelos() {
        for (const c of [...colisionables]) {
            scene.remove(c.objeto);
            const i = colisionables.indexOf(c);
            if (i >= 0) colisionables.splice(i, 1);
        }
        objetivoActual = null;
    }

    function actualizarHUD() {
        const el = document.getElementById('hud-nivel');
        if (el) el.textContent = `NIVEL: ${nivelActual + 1}/3 · ${NIVELES[nivelActual].nombre}`;
        const nucleos = document.getElementById('nucleos');
        if (nucleos) nucleos.textContent = `${nivelActual}/3`;
        const puntuacion = document.getElementById('puntuacion');
        if (puntuacion) puntuacion.textContent = String(nivelActual * 1000).padStart(4, '0');
    }

    function mostrarAviso(texto, duracion = 3000) {
        aviso = texto;
        avisoHasta = performance.now() + duracion;
        let elemento = document.getElementById('aviso-nivel');
        if (!elemento) {
            elemento = document.createElement('div');
            elemento.id = 'aviso-nivel';
            document.getElementById('game-container').appendChild(elemento);
        }
        elemento.textContent = texto;
        elemento.classList.add('visible');
        window.setTimeout(() => { if (performance.now() >= avisoHasta) elemento.classList.remove('visible'); }, duracion + 30);
    }

    function construirNivel(indice) {
        nivelActual = indice;
        const config = NIVELES[indice];
        limpiarModelos();
        scene.background.setHex(config.cielo);
        scene.fog.color.setHex(config.cielo);
        suelo.material.color.setHex(config.suelo);
        luzAmbiente.color.setHex(config.ambiente);
        luzAmbiente.intensity = config.intensidad;
        luzPrincipal.color.setHex(config.direccional);
        luzPrincipal.intensity = indice === 1 ? 2.4 : 2.0;
        luzRelleno.color.setHex(indice === 1 ? 0xff3b6b : indice === 2 ? 0x45ffd1 : 0x5e8dff);
        grid.material.color.setHex(indice === 1 ? 0x9d5266 : indice === 2 ? 0x4d9b87 : 0x39425e);
        jugador.position.set(0, 0.82, 12);
        jugador.material.color.setHex(indice === 0 ? 0x48cfff : indice === 1 ? 0xffbd76 : 0x8bffe0);

        const meta = config.objetivo;
        const posiciones = {
            daga: [-10, -7], armadura: [10, -7], caballero: [0, -11], troll: [0, -5], plat: [-9, -19], med: [21, -1], 
            ship: [6, 13], barrel: [20, -21], mach: [22, -15], window: [-5, -20.2], watcht: [-18, -18], build: [-18, 9],
            build2: [16, 18], build3: [-18, -18]
        };
        for (const clave of ['daga', 'armadura', 'caballero', 'troll', 'plat', 'med', 'ship', 'barrel', 'mach', 'window', 'watcht', 'build', 'build2', 'build3']) {
            const [x, z] = posiciones[clave];
            const registro = ponerModelo(clave, x, z, clave === meta);
            if (registro && clave === meta) objetivoActual = registro;
        }
        
        if (objetivoActual) {
            const aura = new THREE.PointLight(config.direccional, 22, 9);
            aura.position.set(objetivoActual.objeto.position.x, 2.3, objetivoActual.objeto.position.z);
            aura.userData.decorativa = true;
            scene.add(aura);
            objetivoActual.aura = aura;
        }
        actualizarHUD();
        mostrarAviso(config.nombre, 2400);
    }

    function cajasJugador() {
        return new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(jugador.position.x, jugador.position.y, jugador.position.z),
            new THREE.Vector3(0.72, 1.55, 0.72)
        );
    }

   function comprobarColisiones(posicionAnterior) {
        const cajaJugador = cajasJugador();
        
        for (const pared of paredes) {
            if (cajaJugador.intersectsBox(pared)) {
                jugador.position.copy(posicionAnterior);
                return;
            }
        }
        
        for (const c of colisionables) {
            c.caja.setFromObject(c.objeto);
            if (cajaJugador.intersectsBox(c.caja)) {
                if (c.objetivo) {
                    if (c.aura) scene.remove(c.aura);
                    if (nivelActual < NIVELES.length - 1) construirNivel(nivelActual + 1);
                    else {
                        completado = true;
                        mostrarAviso('¡LA FALLA HA SIDO SELLADA! · JUEGO COMPLETADO', 10000);
                        motor.pausado = true;
                    }
                    return;
                }
                
                jugador.position.copy(posicionAnterior); 
                return;
            }
        }
    }

    function manejarTeclas(e, estado) {
        const tecla = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(tecla)) e.preventDefault();
        teclas[tecla] = estado;
    }
    window.addEventListener('keydown', e => manejarTeclas(e, true));
    window.addEventListener('keyup', e => manejarTeclas(e, false));
    window.addEventListener('blur', () => { Object.keys(teclas).forEach(k => teclas[k] = false); });

    const reloj = new THREE.Clock();
    motor = { pausado: false };
    window.renderer = renderer;
    window.scene = scene;
    window.camera = camera;
    window.juegoMotor = motor;

    Promise.all(Object.keys(rutas).map(cargarModelo)).then(() => {
        construirNivel(0);
        if (Object.keys(modelos).length === 0) mostrarAviso('No se pudieron cargar los modelos. Ejecuta el juego con un servidor local.', 7000);
    });

    function animar() {
        requestAnimationFrame(animar);
        const delta = Math.min(reloj.getDelta(), 0.05);
        if (!motor.pausado && !completado) {
            const anterior = jugador.position.clone();
            const velocidad = 7.0 * delta;
            let dx = 0, dz = 0;
            if (teclas.w || teclas.arrowup) dz -= 1;
            if (teclas.s || teclas.arrowdown) dz += 1;
            if (teclas.a || teclas.arrowleft) dx -= 1;
            if (teclas.d || teclas.arrowright) dx += 1;
            if (dx || dz) {
                const largo = Math.hypot(dx, dz) || 1;
                jugador.position.x += (dx / largo) * velocidad;
                jugador.position.z += (dz / largo) * velocidad;
                comprobarColisiones(anterior);
            }
            if (objetivoActual) objetivoActual.objeto.rotation.y += delta * 0.25;
            const objetivoCamara = new THREE.Vector3(jugador.position.x, jugador.position.y + 5.2, jugador.position.z + 8.8);
            camera.position.lerp(objetivoCamara, 1 - Math.pow(0.001, delta));
            camera.lookAt(jugador.position.x, jugador.position.y + 0.8, jugador.position.z - 1.5);
            luzRelleno.position.set(jugador.position.x - 2, 4, jugador.position.z + 1);
        }
        renderer.render(scene, camera);
    }
    animar();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

export function pausarJuego(valor = true) {
    if (motor) motor.pausado = valor;
}
