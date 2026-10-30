import * as THREE from 'three';

let ws;
let miId = null;

export function conectarServidor(miJugador, otrosJugadores, scene) {
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        console.log('Conectado al servidor');
    };

    ws.onmessage = (evento) => {
        const data = JSON.parse(evento.data);

        if (data.type === 'bienvenida') {
            miId = data.id;
            console.log('Mi ID es:', miId);
        }

        if (data.type === 'actualizacion' && data.id !== miId) {
            // Si es un jugador nuevo, crear su cubo
            if (!otrosJugadores[data.id]) {
                const cubo = new THREE.Mesh(
                    new THREE.BoxGeometry(1, 1, 1),
                    new THREE.MeshStandardMaterial({ color: 0xFF6B6B })
                );
                cubo.position.y = 0.5;
                scene.add(cubo);
                otrosJugadores[data.id] = cubo;
                console.log('👤 Nuevo jugador:', data.id);
            }
            // Actualizar posición
            otrosJugadores[data.id].position.set(
                data.posicion.x,
                data.posicion.y,
                data.posicion.z
            );
        }

        if (data.type === 'desconexion') {
            if (otrosJugadores[data.id]) {
                scene.remove(otrosJugadores[data.id]);
                delete otrosJugadores[data.id];
                console.log('Jugador salió:', data.id);
            }
        }
    };

    // Función global para enviar nuestra posición
    window.enviarPosicion = (posicion) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'movimiento',
                posicion: { x: posicion.x, y: posicion.y, z: posicion.z }
            }));
        }
    };
}