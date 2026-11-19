import * as THREE from 'three';
import { SistemaParticulas } from './particulas.js';

/** @typedef {[number, number, number]} RGB */

/**
 * Datos que recibe cada hechizo al lanzarse.
 *
 * @typedef {object} SpellContext
 * @property {THREE.Vector3} origin Centro del glifo en el mundo 3D.
 * @property {number} radius Radio del círculo del glifo (unidades del mundo).
 * @property {THREE.Vector3[][]} strokes Trazos dibujados, en el mundo 3D.
 * @property {number} intensity 0-1: más precisión → hechizo más potente.
 * @property {number} stability 0-1: poca precisión → el efecto parpadea.
 * @property {number} density Multiplicador de partículas según la calidad.
 * @property {THREE.Uniform<number>} sizeScale Uniform compartido de tamaño de partícula.
 * @property {RGB} color Color principal del hechizo.
 * @property {RGB} accent Color secundario.
 */

/**
 * @typedef {object} EffectPart
 * @property {number} start Segundo en que empieza (relativo al efecto).
 * @property {number} duration
 * @property {THREE.Object3D} object
 * @property {(time: number) => void} update Recibe el tiempo local de la pieza.
 * @property {() => void} dispose
 */

/**
 * Un efecto es un grupo de piezas (sistemas de partículas y mallas) que
 * empiezan en distintos momentos. Coordina su tiempo y su limpieza.
 */
export class Efecto {
  group = new THREE.Group();
  duration = 0;
  /** Partículas totales (para estadísticas). */
  particleCount = 0;
  /** @type {EffectPart[]} */
  #parts = [];

  /**
   * @param {SistemaParticulas} system
   * @param {number} [start=0]
   */
  addParticles(system, start = 0) {
    this.particleCount += system.count;
    return this.addPart({
      start,
      duration: system.duration,
      object: system.points,
      update: (t) => system.update(t),
      dispose: () => system.dispose(),
    });
  }

  /**
   * Añade una malla animada por una función.
   * @param {THREE.Mesh | THREE.InstancedMesh | THREE.Group} object
   * @param {{ start?: number, duration: number, animate: (t: number, progress: number) => void }} options
   */
  addMesh(object, { start = 0, duration, animate }) {
    return this.addPart({
      start,
      duration,
      object,
      update: (t) => animate(t, Math.min(1, t / duration)),
      dispose: () => disposeObject(object),
    });
  }

  /** @param {EffectPart} part */
  addPart(part) {
    part.object.visible = false;
    this.group.add(part.object);
    this.#parts.push(part);
    this.duration = Math.max(this.duration, part.start + part.duration);
    return part;
  }

  /**
   * @param {number} time Segundos desde que empezó el efecto.
   * @returns {boolean} `true` mientras siga vivo.
   */
  update(time) {
    for (const part of this.#parts) {
      const local = time - part.start;
      const active = local >= 0 && local <= part.duration;
      part.object.visible = active;
      if (active) part.update(local);
    }
    return time <= this.duration;
  }

  dispose() {
    this.#parts.forEach((p) => p.dispose());
    this.#parts = [];
    this.group.removeFromParent();
  }
}

/** @param {THREE.Object3D} object */
function disposeObject(object) {
  object.traverse((child) => {
    const mesh = /** @type {THREE.Mesh} */ (child);
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}

// ── Utilidades para escribir hechizos ───────────────────────

/**
 * Número aleatorio en un rango.
 * @param {number} min
 * @param {number} max
 */
export const rand = (min, max) => min + Math.random() * (max - min);

/**
 * Punto aleatorio dentro de un disco (distribución uniforme).
 * @param {number} radius
 * @returns {[number, number]}
 */
export function inDisk(radius) {
  const r = Math.sqrt(Math.random()) * radius;
  const a = Math.random() * Math.PI * 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

/**
 * Punto aleatorio en la superficie de una esfera (solo la mitad que mira a la cámara si `front`).
 * @param {number} radius
 * @param {boolean} [front]
 * @returns {[number, number, number]}
 */
export function onSphere(radius, front = false) {
  const u = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  const z = front ? Math.abs(u) : u;
  return [Math.cos(a) * s * radius, Math.sin(a) * s * radius, z * radius];
}

/**
 * Número de partículas ajustado a la calidad y a la intensidad.
 * @param {SpellContext} ctx
 * @param {number} base
 */
export function amount(ctx, base) {
  return Math.max(1, Math.round(base * ctx.density * (0.6 + 0.4 * ctx.intensity)));
}

/**
 * Crea un sistema de partículas con el uniform de tamaño del contexto.
 * @param {SpellContext} ctx
 * @param {Omit<import('./particulas.js').ParticleOptions, 'sizeScale'>} options
 */
export function particles(ctx, options) {
  return new SistemaParticulas({ ...options, sizeScale: ctx.sizeScale });
}
