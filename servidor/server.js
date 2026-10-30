const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let jugadores = {};

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substr(2, 9);
    jugadores[id] = { x: 0, y: 0.5, z: 0 };
    console.log('Jugador conectado:', id);

    // Enviar el ID al jugador que se conecta
    ws.send(JSON.stringify({ type: 'bienvenida', id: id }));

    ws.on('message', (mensaje) => {
        const data = JSON.parse(mensaje);

        if (data.type === 'movimiento') {
            jugadores[id] = data.posicion;

            // Reenviar a todos los demás jugadores
            wss.clients.forEach((cliente) => {
                if (cliente !== ws && cliente.readyState === WebSocket.OPEN) {
                    cliente.send(JSON.stringify({
                        type: 'actualizacion',
                        id: id,
                        posicion: data.posicion
                    }));
                }
            });
        }
    });

    ws.on('close', () => {
        delete jugadores[id];
        wss.clients.forEach((cliente) => {
            if (cliente.readyState === WebSocket.OPEN) {
                cliente.send(JSON.stringify({ type: 'desconexion', id: id }));
            }
        });
        console.log('Jugador desconectado:', id);
    });
});

console.log('Servidor Activo');