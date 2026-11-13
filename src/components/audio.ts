// Reproductor de Trazo con la Web Audio API, sin librerías.
// Cada EventoSonido se convierte en un oscilador (la onda) conectado a un control
// de volumen con envolvente ADSR (ataque, decaimiento, sostenido, relajación), para
// que las notas no empiecen ni terminen con un "clic".

import type { EventoSonido, Instrumento } from "@/compiler/natives";

/** Forma de onda y envolvente de cada instrumento (tiempos en segundos). */
const TIMBRES: Record<Instrumento, { onda: OscillatorType; ataque: number; decaimiento: number; sostenido: number; ganancia: number }> = {
  piano: { onda: "triangle", ataque: 0.005, decaimiento: 0.25, sostenido: 0.35, ganancia: 0.9 },
  organo: { onda: "sine", ataque: 0.03, decaimiento: 0.05, sostenido: 0.9, ganancia: 0.6 },
  flauta: { onda: "sine", ataque: 0.06, decaimiento: 0.1, sostenido: 0.8, ganancia: 0.8 },
  "8bit": { onda: "square", ataque: 0.002, decaimiento: 0.02, sostenido: 0.8, ganancia: 0.25 },
};

const RELAJACION = 0.06;
const MARGEN_INICIO = 0.12; // pequeño margen para programar todo antes de que suene

export interface Reproduccion {
  /** Momento (performance.now, en ms) que corresponde al segundo 0 de la música. */
  inicioMs: number;
  detener: () => void;
}

/**
 * Programa todos los eventos de una vez con ctx.currentTime + inicio.
 * `alSonar` recibe la línea de cada nota cuando empieza (para resaltarla en el editor).
 */
export function reproducir(eventos: EventoSonido[], alSonar: (linea: number) => void, alTerminar: () => void): Reproduccion {
  const ctx = new AudioContext();
  const maestro = ctx.createGain();
  maestro.gain.value = 0.25; // varias notas a la vez (acordes) no deben saturar
  maestro.connect(ctx.destination);

  const t0 = ctx.currentTime + MARGEN_INICIO;
  const temporizadores: number[] = [];

  for (const e of eventos) {
    const timbre = TIMBRES[e.instrumento] ?? TIMBRES.piano;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = timbre.onda;
    osc.frequency.value = e.frecuencia;

    const pico = timbre.ganancia * e.volumen;
    const inicio = t0 + e.inicio;
    const fin = inicio + Math.max(0.05, e.duracion);
    env.gain.setValueAtTime(0, inicio);
    env.gain.linearRampToValueAtTime(pico, inicio + timbre.ataque); // ataque
    env.gain.linearRampToValueAtTime(pico * timbre.sostenido, inicio + timbre.ataque + timbre.decaimiento); // decaimiento
    env.gain.setValueAtTime(pico * timbre.sostenido, fin - RELAJACION); // sostenido
    env.gain.linearRampToValueAtTime(0, fin); // relajación

    osc.connect(env).connect(maestro);
    osc.start(inicio);
    osc.stop(fin + 0.02);

    temporizadores.push(window.setTimeout(() => alSonar(e.linea), (MARGEN_INICIO + e.inicio) * 1000));
  }

  const total = eventos.reduce((m, e) => Math.max(m, e.inicio + e.duracion), 0);
  let terminado = false;
  const detener = () => {
    if (terminado) return;
    terminado = true;
    temporizadores.forEach((t) => window.clearTimeout(t));
    void ctx.close();
    alTerminar();
  };
  temporizadores.push(window.setTimeout(detener, (MARGEN_INICIO + total + 0.2) * 1000));

  return { inicioMs: performance.now() + MARGEN_INICIO * 1000, detener };
}
