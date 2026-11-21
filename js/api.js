// Almacenamiento local (LocalStorage) y remoto (servicio web -> puntuaciones.json en el servidor)

const BASE = location.port === '8080' ? '' : 'http://localhost:8080';
const CLAVE_CONFIG = 'kael_config';
const CLAVE_PUNTOS = 'kael_puntuaciones';

const CONFIG_INICIAL = { volumen: 50, calidad: 'media', dificultad: 'facil', modo: 'aventura', nombre: '' };

// ---------- Configuración ----------
export function leerConfig() {
    try {
        return { ...CONFIG_INICIAL, ...JSON.parse(localStorage.getItem(CLAVE_CONFIG) || '{}') };
    } catch {
        return { ...CONFIG_INICIAL };
    }
}

export function guardarConfig(config) {
    try { localStorage.setItem(CLAVE_CONFIG, JSON.stringify(config)); } catch { }
}

// ---------- Puntuaciones ----------
function leerPuntosLocales() {
    try { return JSON.parse(localStorage.getItem(CLAVE_PUNTOS) || '[]'); } catch { return []; }
}

function guardarPuntosLocales(registro) {
    const lista = leerPuntosLocales();
    lista.push(registro);
    lista.sort((a, b) => b.puntos - a.puntos);
    try { localStorage.setItem(CLAVE_PUNTOS, JSON.stringify(lista.slice(0, 10))); } catch { }
}

// Guarda local y luego intenta mandarla al servicio web
export async function guardarPuntuacion(registro) {
    guardarPuntosLocales(registro);
    try {
        const r = await fetch(BASE + '/api/puntuaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registro)
        });
        return r.ok;
    } catch {
        return false;
    }
}

// Pide las puntuaciones al servicio web; si no hay servidor, usa las locales
export async function obtenerPuntuaciones() {
    try {
        const r = await fetch(BASE + '/api/puntuaciones');
        if (!r.ok) throw new Error('Error del servidor');
        return { lista: await r.json(), origen: 'servidor' };
    } catch {
        return { lista: leerPuntosLocales(), origen: 'local' };
    }
}
