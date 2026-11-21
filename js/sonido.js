import { leerConfig } from './api.js';

let ctx = null;
let volumenMaster = (leerConfig().volumen ?? 50) / 100;

function obtenerContexto() {
    if (!ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }
    return ctx;
}

// Desbloquea el audio en la primera interacción del usuario
['pointerdown', 'keydown'].forEach(ev =>
    window.addEventListener(ev, () => obtenerContexto(), { once: true })
);

export function ajustarVolumen(valor0a100) {
    volumenMaster = Math.max(0, Math.min(100, Number(valor0a100))) / 100;
}

function tono(freqInicio, freqFin, duracion, tipo = 'sine', ganancia = 0.25, retraso = 0) {
    if (volumenMaster <= 0.001) return;
    const audio = obtenerContexto();
    if (!audio) return;

    const ahora = audio.currentTime + retraso;
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = tipo;
    osc.frequency.setValueAtTime(freqInicio, ahora);
    if (freqFin !== freqInicio) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(freqFin, 20), ahora + duracion);
    }

    const volFinal = ganancia * volumenMaster;
    gain.gain.setValueAtTime(0.0001, ahora);
    gain.gain.linearRampToValueAtTime(volFinal, ahora + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ahora + duracion);

    osc.connect(gain);
    gain.connect(audio.destination);

    osc.start(ahora);
    osc.stop(ahora + duracion + 0.02);
}

const EFECTOS = {
    click() {
        tono(620, 880, 0.07, 'sine', 0.14);
    },
    nucleo() {
        tono(523.25, 523.25, 0.10, 'triangle', 0.25, 0);
        tono(659.25, 659.25, 0.10, 'triangle', 0.25, 0.07);
        tono(1046.5, 1174.6, 0.22, 'sine', 0.28, 0.14);
    },
    portal() {
        tono(180, 540, 0.55, 'sawtooth', 0.18, 0);
        tono(360, 720, 0.55, 'sine', 0.22, 0.08);
    },
    curar() {
        tono(440, 440, 0.12, 'sine', 0.24, 0);
        tono(659.25, 880, 0.24, 'sine', 0.26, 0.10);
    },
    turbo() {
        tono(240, 960, 0.35, 'sawtooth', 0.20, 0);
        tono(480, 1280, 0.30, 'sine', 0.18, 0.06);
    },
    golpe() {
        tono(520, 140, 0.18, 'sawtooth', 0.65, 0);
        tono(320, 95, 0.22, 'square', 0.55, 0.02);

        const audio = obtenerContexto();
        if (!audio || volumenMaster <= 0.001) return;
        const buffer = audio.createBuffer(1, audio.sampleRate * 0.15, audio.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);

        const ruido = audio.createBufferSource();
        const gain = audio.createGain();
        ruido.buffer = buffer;
        gain.gain.setValueAtTime(0.5 * volumenMaster, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
        ruido.connect(gain);
        gain.connect(audio.destination);
        ruido.start();
    },
    alerta() {
        tono(740, 740, 0.09, 'square', 0.14, 0);
        tono(580, 580, 0.12, 'square', 0.14, 0.11);
    },
    nivel() {
        const notas = [523.25, 659.25, 783.99, 1046.5];
        notas.forEach((n, i) => tono(n, n, 0.18, 'triangle', 0.25, i * 0.09));
    },
    victoria() {
        const notas = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notas.forEach((n, i) => tono(n, n * 1.01, i === 4 ? 0.45 : 0.16, 'triangle', 0.26, i * 0.10));
    },
    derrota() {
        const notas = [392.0, 349.23, 311.13, 220.0];
        notas.forEach((n, i) => tono(n, n * 0.92, i === 3 ? 0.5 : 0.2, 'sawtooth', 0.20, i * 0.14));
    }
};

export function reproducirSonido(nombre) {
    if (EFECTOS[nombre]) EFECTOS[nombre]();
}