import * as THREE from 'three';
import { Efecto, particles, amount, rand, inDisk, onSphere } from '../efecto.js';
import { ringMaterial, shellMaterial, rayMaterial, iceMaterial } from '../materiales.js';

/**
 * Hechizos de los seis elementos. Cada función recibe el contexto del
 * lanzamiento y devuelve un `Efecto`. Escalan con:
 * - `radius`: el tamaño del círculo dibujado;
 * - `intensity`: la precisión (más partículas, más alto, más brillante);
 * - `stability`: si es baja, el efecto parpadea.
 */

/** @typedef {import('../efecto.js').SpellContext} SpellContext */

const ease = {
  outBack: (/** @type {number} */ t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outCubic: (/** @type {number} */ t) => 1 - (1 - t) ** 3,
};

/** @param {SpellContext} ctx */
const at = (ctx) => /** @type {[number, number, number]} */ ([ctx.origin.x, ctx.origin.y, ctx.origin.z]);
const flick = (/** @type {SpellContext} */ ctx) => (1 - ctx.stability) * 0.7;

// ── Fuego: llamas que brotan del glifo, chispas y humo ───────
/** @param {SpellContext} ctx */
export function fire(ctx) {
  const effect = new Efecto();
  const [ox, oy, oz] = at(ctx);
  const r = ctx.radius;
  const height = 0.7 + ctx.intensity * 0.5;

  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 1500),
      emit: () => {
        const [dx, dz] = inDisk(r * 0.6);
        return {
          position: [ox + dx, oy - r * 0.3, oz + dz * 0.5],
          velocity: [-dx * 0.9, r * rand(1.1, 2) * height, rand(-0.1, 0.1)],
          delay: rand(0, 2.6),
          life: rand(0.6, 1.2),
          size: r * rand(0.26, 0.42),
        };
      },
      colors: [[1, 0.95, 0.75], [1, 0.45, 0.08], [0.45, 0.04, 0.02]],
      gravity: [0, r * 0.5, 0],
      drag: 1.1,
      turbulence: r * 0.12,
      turbulenceFrequency: 5,
      growth: 0.35,
      fadeIn: 0.12,
      fadeOut: 0.5,
      flicker: flick(ctx),
    }),
  );

  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 220),
      emit: () => {
        const [dx] = inDisk(r * 0.4);
        return {
          position: [ox + dx, oy, oz],
          velocity: [rand(-0.6, 0.6) * r, r * rand(2, 4) * height, rand(-0.3, 0.3)],
          delay: rand(0.1, 2.8),
          life: rand(1.2, 2.2),
          size: r * rand(0.03, 0.06),
        };
      },
      colors: [[1, 0.85, 0.4], [1, 0.4, 0.05], [0.6, 0.1, 0]],
      gravity: [0, -r * 0.4, 0],
      drag: 1.2,
      turbulence: r * 0.2,
      turbulenceFrequency: 7,
      flicker: 0.5,
    }),
  );

  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 140),
      emit: () => {
        const [dx] = inDisk(r * 0.35);
        return {
          position: [ox + dx, oy + r * 0.9 * height, oz - 0.1],
          velocity: [rand(-0.2, 0.2) * r, r * rand(0.5, 1), 0],
          delay: rand(0.4, 2.8),
          life: rand(1.6, 2.6),
          size: r * rand(0.35, 0.55),
        };
      },
      colors: [[0.25, 0.2, 0.22], [0.16, 0.14, 0.16], [0.1, 0.1, 0.12]],
      turbulence: r * 0.15,
      growth: 2.6,
      opacity: 0.32,
      fadeIn: 0.25,
      fadeOut: 0.6,
      blending: 'normal',
    }),
  );
  return effect;
}

// ── Agua: esfera ondulante que estalla en gotas, ondas y bruma ──
/** @param {SpellContext} ctx */
export function water(ctx) {
  const effect = new Efecto();
  const [ox, oy, oz] = at(ctx);
  const r = ctx.radius;
  const size = r * (0.45 + ctx.intensity * 0.2);
  const POP = 2.7;

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    shellMaterial({ color: [0.1, 0.35, 0.8], rim: [0.45, 0.85, 1], wobble: 0.08 }),
  );
  sphere.position.set(ox, oy, oz);
  const material = /** @type {THREE.ShaderMaterial} */ (sphere.material);
  effect.addMesh(sphere, {
    duration: POP + 0.35,
    animate: (t) => {
      const grow = ease.outBack(Math.min(1, t / 0.7));
      const pop = t > POP ? (t - POP) / 0.35 : 0;
      sphere.scale.setScalar(size * Math.max(0, grow) * (1 + pop * 0.5));
      sphere.rotation.y = t * 0.6;
      material.uniforms.uTime.value = t;
      material.uniforms.uOpacity.value = (1 - pop) * (1 - flick(ctx) * 0.5 * (1 + Math.sin(t * 30)));
    },
  });

  // Corrientes que giran alrededor de la esfera
  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 420),
      emit: () => {
        const a = Math.random() * Math.PI * 2;
        const d = size * rand(1.1, 1.6);
        return {
          position: [ox + Math.cos(a) * d, oy + Math.sin(a) * d * 0.4 + rand(-0.3, 0.3) * size, oz + rand(-0.2, 0.2)],
          delay: rand(0.2, 2.2),
          life: rand(0.6, 1.1),
          size: r * rand(0.04, 0.08),
        };
      },
      colors: [[0.75, 0.95, 1], [0.35, 0.75, 1], [0.15, 0.4, 0.9]],
      swirl: 3.2,
      center: [ox, oy, oz],
      fadeOut: 0.6,
    }),
  );

  // Ondas sobre el plano del glifo
  [0.15, 0.8, 1.45].forEach((start) => {
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ringMaterial([0.3, 0.7, 1]));
    ring.position.set(ox, oy, oz - 0.01);
    effect.addMesh(ring, {
      start,
      duration: 1.3,
      animate: (_, p) => {
        ring.scale.setScalar(r * (0.6 + p * 1.6));
        /** @type {THREE.ShaderMaterial} */ (ring.material).uniforms.uProgress.value = Math.min(0.999, p);
      },
    });
  });

  // Estallido final en gotas que caen
  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 380),
      emit: () => {
        const [x, y, z] = onSphere(size);
        const speed = rand(1.2, 2.6);
        return {
          position: [ox + x, oy + y, oz + z],
          velocity: [x * speed * 2.2, y * speed * 2.2 + r * 0.8, z * speed],
          life: rand(0.8, 1.4),
          size: r * rand(0.04, 0.09),
        };
      },
      colors: [[0.9, 0.98, 1], [0.45, 0.8, 1], [0.2, 0.45, 0.9]],
      gravity: [0, -r * 4.5, 0],
      drag: 0.6,
      fadeIn: 0.02,
    }),
    POP,
  );
  return effect;
}

// ── Viento: remolino en espiral que se abre ──────────────────
/** @param {SpellContext} ctx */
export function wind(ctx) {
  const effect = new Efecto();
  const [ox, oy, oz] = at(ctx);
  const r = ctx.radius;

  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 1800),
      emit: () => {
        const a = Math.random() * Math.PI * 2;
        const d = r * rand(0.15, 0.6);
        const out = rand(0.5, 1.2) * r;
        return {
          position: [ox + Math.cos(a) * d, oy + Math.sin(a) * d, oz + rand(-0.15, 0.15)],
          velocity: [Math.cos(a) * out, Math.sin(a) * out + r * 0.15, rand(-0.1, 0.2)],
          delay: rand(0, 2.6),
          life: rand(0.8, 1.5),
          size: r * rand(0.03, 0.06),
        };
      },
      colors: [[0.95, 1, 0.95], [0.7, 0.95, 0.85], [0.4, 0.75, 0.7]],
      swirl: 4.5 + ctx.intensity * 2,
      center: [ox, oy, oz],
      drag: 0.4,
      turbulence: r * 0.05,
      fadeIn: 0.15,
      fadeOut: 0.6,
      flicker: flick(ctx),
    }),
  );

  // Hojas y motas más grandes arrastradas por la corriente
  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 70),
      emit: () => {
        const a = Math.random() * Math.PI * 2;
        const d = r * rand(0.3, 0.9);
        return {
          position: [ox + Math.cos(a) * d, oy + Math.sin(a) * d, oz + rand(0, 0.3)],
          velocity: [0, r * rand(0.2, 0.6), 0],
          delay: rand(0, 2.2),
          life: rand(1.2, 1.8),
          size: r * rand(0.09, 0.15),
        };
      },
      colors: [[0.75, 0.95, 0.5], [0.55, 0.85, 0.45], [0.35, 0.6, 0.3]],
      swirl: 3,
      center: [ox, oy, oz],
      turbulence: r * 0.15,
      fadeOut: 0.5,
    }),
  );

  // Pulsos de viento (ondas)
  [0.2, 1, 1.8].forEach((start) => {
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ringMaterial([0.6, 0.95, 0.85]));
    ring.position.set(ox, oy, oz);
    effect.addMesh(ring, {
      start,
      duration: 1,
      animate: (_, p) => {
        ring.scale.setScalar(r * (0.4 + p * 2));
        ring.rotation.z = p * 2;
        /** @type {THREE.ShaderMaterial} */ (ring.material).uniforms.uProgress.value = Math.min(0.999, p);
      },
    });
  });
  return effect;
}

// ── Luz: rayos que giran, resplandor y destellos ──────────────
/** @param {SpellContext} ctx */
export function light(ctx) {
  const effect = new Efecto();
  const [ox, oy, oz] = at(ctx);
  const r = ctx.radius;
  const DURATION = 3.2;

  const rays = new THREE.Group();
  rays.position.set(ox, oy, oz);
  const COUNT = 14;
  for (let i = 0; i < COUNT; i++) {
    const length = r * rand(1.6, 2.6) * (0.8 + ctx.intensity * 0.4);
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.translate(0.5, 0, 0); // origen en el extremo
    const ray = new THREE.Mesh(geometry, rayMaterial([1, 0.92, 0.6]));
    ray.scale.set(length, r * rand(0.12, 0.25), 1);
    ray.rotation.z = (i / COUNT) * Math.PI * 2 + rand(-0.1, 0.1);
    ray.userData.length = length;
    rays.add(ray);
  }
  effect.addMesh(rays, {
    duration: DURATION,
    animate: (t, p) => {
      rays.rotation.z = t * 0.35;
      const appear = ease.outCubic(Math.min(1, t / 0.4));
      const fade = 1 - Math.max(0, (p - 0.7) / 0.3);
      rays.children.forEach((ray, i) => {
        const pulse = 0.75 + 0.25 * Math.sin(t * 5 + i * 1.7);
        ray.scale.x = /** @type {number} */ (ray.userData.length) * appear * pulse;
        /** @type {THREE.ShaderMaterial} */ (/** @type {THREE.Mesh} */ (ray).material).uniforms.uOpacity.value =
          fade * (1 - flick(ctx) * 0.5 * (1 + Math.sin(t * 27 + i)));
      });
    },
  });

  // Resplandor central que late
  effect.addParticles(
    particles(ctx, {
      count: 3,
      emit: (i) => ({ position: [ox, oy, oz], delay: i * 0.05, life: DURATION - i * 0.05, size: r * (3 - i * 0.7) }),
      colors: [[1, 1, 0.95], [1, 0.95, 0.7], [1, 0.85, 0.5]],
      fadeIn: 0.1,
      fadeOut: 0.35,
      flicker: 0.15,
    }),
  );

  // Destellos que titilan alrededor
  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 420),
      emit: () => {
        const [dx, dy] = inDisk(r * 1.8);
        return {
          position: [ox + dx, oy + dy, oz + rand(0, 0.4)],
          velocity: [0, r * rand(0.05, 0.25), 0],
          delay: rand(0, 2.4),
          life: rand(0.6, 1.2),
          size: r * rand(0.04, 0.1),
        };
      },
      colors: [[1, 1, 1], [1, 0.95, 0.75], [1, 0.85, 0.55]],
      flicker: 0.9,
      fadeIn: 0.3,
      fadeOut: 0.5,
    }),
  );
  return effect;
}

// ── Protección: cúpula hexagonal que se levanta ───────────────
/** @param {SpellContext} ctx */
export function aegis(ctx) {
  const effect = new Efecto();
  const [ox, oy, oz] = at(ctx);
  const r = ctx.radius;
  const DURATION = 3.8;
  const size = r * (1.15 + ctx.intensity * 0.15);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 32),
    shellMaterial({ color: [0.35, 0.25, 0.8], rim: [0.75, 0.65, 1], hex: true }),
  );
  dome.position.set(ox, oy, oz);
  const material = /** @type {THREE.ShaderMaterial} */ (dome.material);
  effect.addMesh(dome, {
    duration: DURATION,
    animate: (t, p) => {
      dome.scale.setScalar(size * ease.outBack(Math.min(1, t / 0.6)));
      dome.rotation.y = t * 0.25;
      material.uniforms.uTime.value = t;
      // Impactos periódicos: la cúpula se ilumina como si la golpearan
      material.uniforms.uImpact.value = Math.max(0, Math.sin(t * 2.2)) ** 8 * 0.8;
      material.uniforms.uOpacity.value = (1 - Math.max(0, (p - 0.75) / 0.25)) * (1 - flick(ctx) * 0.4 * (1 + Math.sin(t * 25)));
    },
  });

  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 360),
      emit: () => {
        const [x, y, z] = onSphere(size, true);
        return {
          position: [ox + x, oy + y, oz + z],
          velocity: [x * 0.1, y * 0.1 + r * 0.1, z * 0.1],
          delay: rand(0.3, 3),
          life: rand(0.5, 1),
          size: r * rand(0.04, 0.08),
        };
      },
      colors: [[1, 1, 1], [0.8, 0.7, 1], [0.55, 0.45, 1]],
      flicker: 0.6,
    }),
  );
  return effect;
}

// ── Hielo: cristales que crecen hacia fuera y vaho frío ───────
/** @param {SpellContext} ctx */
export function ice(ctx) {
  const effect = new Efecto();
  const [ox, oy, oz] = at(ctx);
  const r = ctx.radius;
  const DURATION = 3.8;
  const COUNT = Math.round(18 + ctx.intensity * 10);

  // Sin vértices compartidos cada cara tiene su propia normal: aspecto facetado.
  const geometry = new THREE.ConeGeometry(0.5, 1, 5).toNonIndexed();
  geometry.computeVertexNormals();
  geometry.translate(0, 0.5, 0); // base en el origen: crece desde el centro
  const shards = new THREE.InstancedMesh(geometry, iceMaterial(), COUNT);
  shards.position.set(ox, oy, oz);
  const specs = Array.from({ length: COUNT }, (_, i) => {
    const a = (i / COUNT) * Math.PI * 2 + rand(-0.15, 0.15);
    const tilt = rand(-0.6, 0.9); // algunos salen hacia la cámara
    return {
      direction: new THREE.Vector3(Math.cos(a), Math.sin(a), tilt).normalize(),
      length: r * rand(0.6, 1.5),
      width: r * rand(0.12, 0.22),
      delay: rand(0, 0.5),
    };
  });
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3();
  const zero = new THREE.Vector3();
  const material = /** @type {THREE.ShaderMaterial} */ (shards.material);
  effect.addMesh(shards, {
    duration: DURATION,
    animate: (t, p) => {
      specs.forEach((s, i) => {
        const grow = ease.outBack(Math.min(1, Math.max(0, (t - s.delay) / 0.5)));
        quaternion.setFromUnitVectors(up, s.direction);
        scale.set(s.width * Math.max(grow, 0.001), s.length * Math.max(grow, 0.001), s.width * Math.max(grow, 0.001));
        matrix.compose(zero, quaternion, scale);
        shards.setMatrixAt(i, matrix);
      });
      shards.instanceMatrix.needsUpdate = true;
      material.uniforms.uOpacity.value = 1 - Math.max(0, (p - 0.75) / 0.25);
    },
  });

  // Escarcha brillante
  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 450),
      emit: () => {
        const [dx, dy] = inDisk(r * 1.4);
        return {
          position: [ox + dx, oy + dy, oz + rand(-0.1, 0.4)],
          velocity: [dx * 0.2, dy * 0.2 - r * 0.1, 0],
          delay: rand(0, 2.8),
          life: rand(0.8, 1.6),
          size: r * rand(0.03, 0.07),
        };
      },
      colors: [[1, 1, 1], [0.75, 0.92, 1], [0.5, 0.75, 1]],
      swirl: 0.6,
      center: [ox, oy, oz],
      flicker: 0.7,
    }),
  );

  // Vaho frío
  effect.addParticles(
    particles(ctx, {
      count: amount(ctx, 110),
      emit: () => {
        const [dx, dy] = inDisk(r);
        return {
          position: [ox + dx, oy + dy, oz],
          velocity: [dx * 0.3, r * 0.15, 0],
          delay: rand(0.2, 2.6),
          life: rand(1.5, 2.4),
          size: r * rand(0.4, 0.7),
        };
      },
      colors: [[0.75, 0.88, 1], [0.6, 0.78, 0.95], [0.5, 0.65, 0.85]],
      growth: 2,
      opacity: 0.12,
      fadeIn: 0.3,
      fadeOut: 0.6,
    }),
  );
  return effect;
}
