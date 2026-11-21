import { iniciarJuego, salirAlMenu, alTerminar } from './main.js';
import { leerConfig, guardarConfig, guardarPuntuacion, obtenerPuntuaciones } from './api.js';

const $ = id => document.getElementById(id);

// Pantallas
const mainMenu = $('main-menu');
const hud = $('hud');
const modoPantalla = $('modo-pantalla');
const configPantalla = $('config-pantalla');
const puntuacionesPantalla = $('puntuaciones-pantalla');
const finPantalla = $('fin-pantalla');
const pantallas = [mainMenu, hud, modoPantalla, configPantalla, puntuacionesPantalla, finPantalla];

let config = leerConfig();
let ultimaPartida = null;

function mostrar(pantalla) {
    pantallas.forEach(p => p.classList.add('hidden'));
    pantalla.classList.remove('hidden');
}

// Marca como activo el botón elegido dentro de un grupo
function marcarActivo(selector, atributo, valor) {
    document.querySelectorAll(selector).forEach(b => b.classList.toggle('activo', b.dataset[atributo] === valor));
}

// MENÚ PRINCIPAL
$('btn-jugar').addEventListener('click', () => {
    $('input-nombre').value = config.nombre;
    marcarActivo('[data-modo]', 'modo', config.modo);
    marcarActivo('[data-dificultad]', 'dificultad', config.dificultad);
    actualizarDescripcion();
    mostrar(modoPantalla);
});

$('btn-puntuaciones').addEventListener('click', async () => {
    mostrar(puntuacionesPantalla);
    const body = $('puntos-body');
    body.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
    const { lista, origen } = await obtenerPuntuaciones();
    body.innerHTML = '';
    if (!lista.length) body.innerHTML = '<tr><td colspan="4">Aún no hay puntuaciones</td></tr>';
    lista.slice(0, 10).forEach((p, i) => {
        const fila = document.createElement('tr');
        [i + 1, p.nombre, p.puntos, (p.modo || '').toUpperCase()].forEach(valor => {
            const td = document.createElement('td');
            td.textContent = valor; // textContent evita que se inyecte HTML
            fila.appendChild(td);
        });
        body.appendChild(fila);
    });
    $('puntos-origen').textContent = origen === 'servidor' ? 'Datos del servidor' : 'Sin servidor · mostrando puntuaciones locales';
});

$('btn-config').addEventListener('click', () => {
    $('slider-volume').value = config.volumen;
    marcarActivo('[data-quality]', 'quality', config.calidad);
    mostrar(configPantalla);
});

// SELECCIÓN DE MODO
const DESCRIPCIONES = {
    aventura: 'AVENTURA: recorre los 3 escenarios. Junta 3 núcleos en cada uno para activar el objetivo y pasar al siguiente.',
    supervivencia: 'SUPERVIVENCIA: aguanta 90 segundos mientras llegan más trolls. Junta núcleos para sumar puntos.'
};

function actualizarDescripcion() {
    const extra = config.dificultad === 'dificil'
        ? ' · DIFÍCIL: 3 vidas, trolls más rápidos que te ven de más lejos, x1.5 puntos.'
        : ' · FÁCIL: 5 vidas y trolls lentos.';
    $('modo-desc').textContent = DESCRIPCIONES[config.modo] + extra;
}

document.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', () => {
    config.modo = b.dataset.modo;
    marcarActivo('[data-modo]', 'modo', config.modo);
    actualizarDescripcion();
}));

document.querySelectorAll('[data-dificultad]').forEach(b => b.addEventListener('click', () => {
    config.dificultad = b.dataset.dificultad;
    marcarActivo('[data-dificultad]', 'dificultad', config.dificultad);
    actualizarDescripcion();
}));

function comenzar(opciones) {
    ultimaPartida = opciones;
    mostrar(hud);
    iniciarJuego(opciones);
}

$('btn-comenzar').addEventListener('click', () => {
    config.nombre = $('input-nombre').value.trim().toUpperCase().slice(0, 12) || 'JUGADOR';
    guardarConfig(config);
    comenzar({ modo: config.modo, dificultad: config.dificultad, calidad: config.calidad, nombre: config.nombre });
});

$('btn-volver-modo').addEventListener('click', () => mostrar(mainMenu));

// CONFIGURACIONES 
document.querySelectorAll('[data-quality]').forEach(b => b.addEventListener('click', () => {
    marcarActivo('[data-quality]', 'quality', b.dataset.quality);
}));

$('btn-guardar').addEventListener('click', () => {
    config.volumen = Number($('slider-volume').value);
    const activo = document.querySelector('[data-quality].activo');
    config.calidad = activo ? activo.dataset.quality : 'media';
    guardarConfig(config);
    const btn = $('btn-guardar');
    btn.textContent = 'GUARDADO ✓';
    setTimeout(() => btn.textContent = 'GUARDAR', 1200);
});

$('btn-volver-config').addEventListener('click', () => {
    mostrar(mainMenu);
});

$('btn-volver-puntos').addEventListener('click', () => mostrar(mainMenu));

// FIN DE PARTIDA
alTerminar(async resultado => {
    $('fin-titulo').textContent = resultado.gano ? '¡VICTORIA!' : 'GAME OVER';
    $('fin-motivo').textContent = resultado.motivo;
    $('fin-puntos').textContent = resultado.puntos;
    $('fin-guardado').textContent = 'Guardando puntuación...';
    setTimeout(() => mostrar(finPantalla), 600);

    const ok = await guardarPuntuacion({
        nombre: config.nombre || 'JUGADOR',
        puntos: resultado.puntos,
        modo: resultado.modo,
        dificultad: resultado.dificultad
    });
    $('fin-guardado').textContent = ok ? 'Puntuación guardada en el servidor ✓' : 'Puntuación guardada localmente';
});

$('btn-reintentar').addEventListener('click', () => {
    if (ultimaPartida) comenzar(ultimaPartida);
});

$('btn-fin-menu').addEventListener('click', () => {
    salirAlMenu();
    mostrar(mainMenu);
});

// Redes sociales
$('btn-compartir-fb').addEventListener('click', () => window.open('https://www.facebook.com', '_blank'));
$('btn-compartir-x').addEventListener('click', () => window.open('https://x.com', '_blank'));
