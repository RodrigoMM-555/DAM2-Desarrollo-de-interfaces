import * as THREE from 'three';
import { Efecto, particles, amount, rand } from '../efecto.js';
import { ringMaterial } from '../materiales.js';

/** Segundo en que el glifo estalla y empieza el hechizo del elemento. */
export const ACTIVATION_BURST = 1.15;

/**
 * Secuencia de activación, común a todos los hechizos:
 *
 * 1. (0-0,4 s) Los trazos dibujados se encienden como partículas, en orden.
 * 2. (0,55-1,15 s) La energía gira en espiral hacia el centro: el glifo se consume.
 * 3. (1,15 s) Destello, onda expansiva y chispas.
 *
 * @param {import('../efecto.js').SpellContext} ctx
 */
export function activation(ctx) {
  const effect = new Efecto();
  const { origin, radius: r, color } = ctx;
  const target = /** @type {[number, number, number]} */ ([origin.x, origin.y, origin.z]);

  // 1-2. Trazos convertidos en partículas que se absorben hacia el centro
  const points = ctx.strokes.flat();
  if (points.length) {
    const count = Math.min(points.length * 2, amount(ctx, 1100));
    const step = points.length / count;
    effect.addParticles(
      particles(ctx, {
        count,
        emit: (i) => {
          const index = Math.floor(i * step);
          const p = points[index];
          return {
            position: [p.x + rand(-0.006, 0.006), p.y + rand(-0.006, 0.006), p.z],
            velocity: [rand(-0.02, 0.02), rand(-0.02, 0.02), rand(0, 0.05)],
            delay: (index / points.length) * 0.4,
            life: 1.25 - (index / points.length) * 0.4 + rand(0, 0.05),
            size: r * rand(0.05, 0.09),
          };
        },
        colors: [[1, 0.95, 0.8], [1, 0.9, 0.6], color],
        attract: { target, start: 0.55, end: ACTIVATION_BURST, twist: 1 },
        fadeIn: 0.05,
        fadeOut: 0.05,
        flicker: (1 - ctx.stability) * 0.6,
      }),
    );
  }

  // 3a. Destello
  effect.addParticles(
    particles(ctx, {
      count: 1,
      emit: () => ({ position: target, life: 0.6, size: r * 4.5 }),
      colors: [[1, 1, 1], color, color],
      fadeIn: 0.05,
      fadeOut: 0.9,
      growth: 1.4,
    }),
    ACTIVATION_BURST - 0.05,
  );

  // 3b. Onda expansiva
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ringMaterial(color));
  ring.position.copy(origin);
  effect.addMesh(ring, {
    start: ACTIVATION_BURST,
    duration: 0.9,
    animate: (_, progress) => {
      ring.scale.setScalar(r * (1 + progress * 2.2));
      /** @type {THREE.ShaderMaterial} */ (ring.material).uniforms.uProgress.value = Math.min(0.999, progress);
    },
  });

  // 3c. Chispas radiales
  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 140),
      emit: () => {
        const a = Math.random() * Math.PI * 2;
        const speed = r * rand(1.5, 4);
        return {
          position: target,
          velocity: [Math.cos(a) * speed, Math.sin(a) * speed, rand(-0.5, 1) * speed * 0.3],
          life: rand(0.5, 1.1),
          size: r * rand(0.04, 0.08),
        };
      },
      colors: [[1, 1, 1], color, color],
      drag: 2.6,
      fadeIn: 0.02,
      fadeOut: 0.7,
    }),
    ACTIVATION_BURST,
  );

  return effect;
}
