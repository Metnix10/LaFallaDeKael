//Llama a iniciarJuego()
import { iniciarJuego, pausarJuego } from './main.js';

// Referencias a los elementos del HTML
const mainMenu = document.getElementById('main-menu');
const hud = document.getElementById('hud');
const configPantalla = document.getElementById('config-pantalla');
const puntuacionesPantalla = document.getElementById('puntuaciones-pantalla');
const pausaPantalla = document.getElementById('pausa-pantalla');

// Botones
const btnJugar = document.getElementById('btn-jugar');
const btnPuntuaciones = document.getElementById('btn-puntuaciones');
const btnConfig = document.getElementById('btn-config');
const btnGoogle = document.getElementById('btn-google');

const btnVolverConfig = document.getElementById('btn-volver-config');
const btnVolverPuntos = document.getElementById('btn-volver-puntos');
const btnGuardar = document.getElementById('btn-guardar');

const btnReanudar = document.getElementById('btn-reanudar');
const btnSalir = document.getElementById('btn-salir');

// Oculta todas las pantallas
function ocultarTodo() {
    mainMenu.classList.add('hidden');
    configPantalla.classList.add('hidden');
    puntuacionesPantalla.classList.add('hidden');
    pausaPantalla.classList.add('hidden');
    hud.classList.add('hidden');
}

// Muestra solo ek menu principal
function mostrarMenu() {
    ocultarTodo();
    mainMenu.classList.remove('hidden');
}


// Acciones de los botones

// JUGAR
btnJugar.addEventListener('click', () => {
    console.log('Iniciando juego...');
    ocultarTodo();
    hud.classList.remove('hidden');
    iniciarJuego(); //Llama a iniciarJuego()
});

// PUNTUACIONES
btnPuntuaciones.addEventListener('click', () => {
    console.log('Mostrando puntuaciones');
    ocultarTodo();
    puntuacionesPantalla.classList.remove('hidden');
});

// CONFIGURACIONES
btnConfig.addEventListener('click', () => {
    console.log('Mostrando configuraciones');
    ocultarTodo();
    configPantalla.classList.remove('hidden');
});

// VOLVER -Ventana de configuraciones
btnVolverConfig.addEventListener('click', () => {
    mostrarMenu();
});

// GUARDAR -Ventana de configuraciones
btnGuardar.addEventListener('click', () => {
    console.log('Configuraciones guardadas');
    alert('Configuraciones guardadas');
});

// VOLVER -puntuaciones
btnVolverPuntos.addEventListener('click', () => {
    mostrarMenu();
});

// REANUDAR -pausa
btnReanudar.addEventListener('click', () => {
    pausarJuego(false);
    ocultarTodo();
    hud.classList.remove('hidden');
});

// SALIR -Pausa
btnSalir.addEventListener('click', () => {
    pausarJuego(true);
    mostrarMenu();
});

// TECLA ESC PARA PAUSA
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Si estamos jugando, mostramos pausa
        if (!hud.classList.contains('hidden')) {
            pausarJuego(true);
            hud.classList.add('hidden');
            pausaPantalla.classList.remove('hidden');
        }
    }
});