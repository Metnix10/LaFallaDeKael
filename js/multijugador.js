import * as THREE from 'three';

let ws = null;
let escena = null;
const otrosJugadores = {};

// Si abres el juego desde node server.js (puerto 8080) usa ese mismo host,
// si lo abres con Live Server u otro, se conecta a localhost:8080
const HOST = location.port === '8080' ? location.host : 'localhost:8080';

function crearOtroJugador() {
    const malla = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xFF6B6B })
    );
    malla.castShadow = true;
    malla.visible = false;
    malla.userData.destino = new THREE.Vector3();
    malla.userData.nivel = -1;
    return malla;
}

export function conectarServidor(scene) {
    escena = scene;
    try {
        ws = new WebSocket(`ws://${HOST}`);
    } catch (e) {
        console.warn('No se pudo conectar al servidor multijugador');
        return;
    }

    ws.onopen = () => console.log('Conectado al servidor multijugador');
    ws.onerror = () => console.warn('Servidor multijugador no disponible (ejecuta: node server.js)');

    ws.onmessage = (evento) => {
        let data;
        try { data = JSON.parse(evento.data); } catch { return; }

        if (data.type === 'actualizacion') {
            let otro = otrosJugadores[data.id];
            if (!otro) {
                otro = crearOtroJugador();
                otro.position.set(data.posicion.x, data.posicion.y, data.posicion.z);
                escena.add(otro);
                otrosJugadores[data.id] = otro;
            }
            otro.userData.destino.set(data.posicion.x, data.posicion.y, data.posicion.z);
            otro.userData.nivel = data.nivel;
        }

        if (data.type === 'desconexion' && otrosJugadores[data.id]) {
            escena.remove(otrosJugadores[data.id]);
            delete otrosJugadores[data.id];
        }
    };
}

export function enviarPosicion(posicion, nivel) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'movimiento',
            nivel,
            posicion: { x: posicion.x, y: posicion.y, z: posicion.z }
        }));
    }
}

// Mueve suavemente a los demás jugadores y solo muestra a los que están en tu mismo escenario
export function actualizarOtrosJugadores(delta, miNivel) {
    for (const id in otrosJugadores) {
        const otro = otrosJugadores[id];
        otro.position.lerp(otro.userData.destino, Math.min(1, delta * 12));
        otro.visible = otro.userData.nivel === miNivel;
    }
}

