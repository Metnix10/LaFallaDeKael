const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const mysql = require('mysql2/promise');

const PUERTO = process.env.PORT || 8080;
const RAIZ = __dirname;
const ARCHIVO = path.join(RAIZ, 'puntuaciones.json');

// CONEXIÓN A MYSQL
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'lafalladekael',
    waitForConnections: true,
    connectionLimit: 5
});

// Respaldo en JSON por si MySQL no está encendido
function leerArchivo() {
    try { return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); } catch { return []; }
}

async function obtenerPuntuaciones() {
    try {
        const [filas] = await pool.query(
            'SELECT nombre, puntos, modo, dificultad, fecha FROM puntuaciones ORDER BY puntos DESC LIMIT 10'
        );
        return filas;
    } catch (err) {
        console.warn('MySQL no disponible, leyendo puntuaciones.json:', err.code);
        return leerArchivo().sort((a, b) => b.puntos - a.puntos).slice(0, 10);
    }
}

async function guardarPuntuacion(p) {
    try {
        await pool.query(
            'INSERT INTO puntuaciones (nombre, puntos, modo, dificultad) VALUES (?, ?, ?, ?)',
            [p.nombre, p.puntos, p.modo, p.dificultad]
        );
    } catch (err) {
        console.warn('MySQL no disponible, guardando en puntuaciones.json:', err.code);
        const lista = leerArchivo();
        lista.push({ ...p, fecha: new Date().toISOString() });
        fs.writeFileSync(ARCHIVO, JSON.stringify(lista, null, 2));
    }
}

// Revisa que los datos recibidos sean válidos
function validar(datos) {
    const nombre = String(datos.nombre || 'JUGADOR').replace(/[^\wÁÉÍÓÚÑáéíóúñ ]/g, '').slice(0, 12) || 'JUGADOR';
    const puntos = Math.floor(Number(datos.puntos));
    const modo = ['aventura', 'supervivencia'].includes(datos.modo) ? datos.modo : null;
    const dificultad = ['facil', 'dificil'].includes(datos.dificultad) ? datos.dificultad : null;
    if (!Number.isFinite(puntos) || puntos < 0 || puntos > 10000000 || !modo || !dificultad) return null;
    return { nombre, puntos, modo, dificultad };
}

// SERVIDOR HTTP
const TIPOS = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
    '.obj': 'text/plain', '.mtl': 'text/plain', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg'
};

function responderJSON(res, codigo, datos) {
    res.writeHead(codigo, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(datos));
}

async function manejarAPI(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }
    try {
        if (req.method === 'GET') {
            const lista = await obtenerPuntuaciones();
            return responderJSON(res, 200, lista);
        }
        if (req.method === 'POST') {
            let cuerpo = '';
            req.on('data', parte => {
                cuerpo += parte;
                if (cuerpo.length > 10000) req.destroy();
            });
            req.on('end', async () => {
                try {
                    const datos = validar(JSON.parse(cuerpo));
                    if (!datos) return responderJSON(res, 400, { error: 'Datos inválidos' });
                    await guardarPuntuacion(datos);
                    responderJSON(res, 201, { ok: true });
                } catch (e) {
                    responderJSON(res, 500, { error: 'No se pudo guardar' });
                }
            });
            return;
        }
        responderJSON(res, 405, { error: 'Método no permitido' });
    } catch (e) {
        console.error(e);
        responderJSON(res, 500, { error: 'Error del servidor' });
    }
}

function servirArchivo(req, res) {
    let ruta = decodeURIComponent(req.url.split('?')[0]);
    if (ruta === '/') ruta = '/index.html';
    const archivo = path.normalize(path.join(RAIZ, ruta));
    if (!archivo.startsWith(RAIZ)) {
        res.writeHead(403);
        return res.end('Prohibido');
    }
    fs.readFile(archivo, (err, datos) => {
        if (err) {
            res.writeHead(404);
            return res.end('No encontrado');
        }
        res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream' });
        res.end(datos);
    });
}

const servidor = http.createServer((req, res) => {
    if (req.url.startsWith('/api/puntuaciones')) return manejarAPI(req, res);
    servirArchivo(req, res);
});

// MULTIJUGADOR
const wss = new WebSocket.Server({ server: servidor });
const jugadores = {};

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).slice(2, 11);
    console.log('Jugador conectado:', id);
    ws.send(JSON.stringify({ type: 'bienvenida', id }));

    for (const otroId in jugadores) {
        ws.send(JSON.stringify({ type: 'actualizacion', id: otroId, ...jugadores[otroId] }));
    }

    ws.on('message', (mensaje) => {
        let data;
        try { data = JSON.parse(mensaje); } catch { return; }

        if (data.type === 'movimiento' && data.posicion) {
            jugadores[id] = { posicion: data.posicion, nivel: data.nivel };
            const salida = JSON.stringify({ type: 'actualizacion', id, posicion: data.posicion, nivel: data.nivel });
            wss.clients.forEach((cliente) => {
                if (cliente !== ws && cliente.readyState === WebSocket.OPEN) cliente.send(salida);
            });
        }
    });

    ws.on('close', () => {
        delete jugadores[id];
        wss.clients.forEach((cliente) => {
            if (cliente.readyState === WebSocket.OPEN) {
                cliente.send(JSON.stringify({ type: 'desconexion', id }));
            }
        });
        console.log('Jugador desconectado:', id);
    });
});

servidor.listen(PUERTO, async () => {
    console.log(`Servidor activo: http://localhost:${PUERTO}`);
    try {
        const conn = await pool.getConnection();
        console.log('Conectado a MySQL (lafalladekael) ✓');
        conn.release();
    } catch (e) {
        console.warn('Aviso: MySQL no respondió (usando puntuaciones.json hasta que enciendas MySQL).');
    }
});