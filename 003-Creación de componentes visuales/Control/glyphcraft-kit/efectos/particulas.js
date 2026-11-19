import * as THREE from 'three';

/**
 * Sistema de partículas calculado en la GPU.
 *
 * Cada partícula guarda solo sus datos iniciales (posición, velocidad,
 * instante de nacimiento, vida, tamaño y una semilla). El *vertex shader*
 * calcula en cada fotograma dónde está y de qué color es a partir del
 * tiempo transcurrido. La CPU no mueve ninguna partícula: solo actualiza
 * un número (`uTime`). Así se pueden animar miles sin coste apreciable.
 *
 * Física disponible (toda por uniforms):
 * - velocidad con rozamiento (`drag`) y gravedad / flotación (`gravity`);
 * - turbulencia pseudoaleatoria (`turbulence`, `turbulenceFrequency`);
 * - remolino alrededor de un centro (`swirl`, rad/s);
 * - atracción en espiral hacia un punto en una ventana de tiempo
 *   (`attract`): es la "absorción" de la energía del glifo;
 * - rampa de color de tres tonos a lo largo de la vida, aparición y
 *   desvanecimiento suaves, crecimiento y parpadeo (`flicker`).
 */

/**
 * @typedef {object} ParticleSeed
 * @property {[number, number, number]} position
 * @property {[number, number, number]} [velocity]
 * @property {number} [delay] Segundos hasta nacer.
 * @property {number} life Segundos de vida.
 * @property {number} size Tamaño en unidades del mundo.
 */

/**
 * @typedef {object} ParticleOptions
 * @property {number} count
 * @property {(index: number) => ParticleSeed} emit Genera cada partícula.
 * @property {THREE.Uniform<number>} sizeScale Uniform compartido: píxeles por unidad a distancia 1.
 * @property {[number, number, number][]} [colors] Tres colores RGB (0-1): nacer, mitad y morir.
 * @property {[number, number, number]} [gravity]
 * @property {number} [drag]
 * @property {number} [turbulence]
 * @property {number} [turbulenceFrequency]
 * @property {number} [swirl]
 * @property {[number, number, number]} [center] Centro del remolino.
 * @property {{ target: [number, number, number], start: number, end: number, twist?: number } | null} [attract]
 * @property {number} [growth] Factor de tamaño al final de la vida.
 * @property {number} [fadeIn] Fracción de vida para aparecer.
 * @property {number} [fadeOut] Fracción de vida para desvanecerse.
 * @property {number} [flicker] Parpadeo 0-1.
 * @property {number} [opacity]
 * @property {'additive' | 'normal'} [blending] `additive` para luz, `normal` para humo.
 */

const vertexShader = /* glsl */ `
  attribute vec3 aVelocity;
  attribute vec2 aTime;   // x: nacimiento, y: duración
  attribute float aSize;
  attribute float aSeed;

  uniform float uTime;
  uniform float uDrag;
  uniform float uTurbulence;
  uniform float uTurbFreq;
  uniform float uSwirl;
  uniform float uSizeScale;
  uniform float uGrowth;
  uniform float uFadeIn;
  uniform float uFadeOut;
  uniform float uFlicker;
  uniform vec3 uGravity;
  uniform vec3 uCenter;
  uniform vec4 uAttract;        // xyz: destino, w: giro (0 = sin atracción)
  uniform vec2 uAttractWindow;  // inicio y fin de la atracción (s)
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;

  varying vec3 vColor;
  varying float vAlpha;

  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

  void main() {
    float age = uTime - aTime.x;
    float t = age / aTime.y;
    if (age < 0.0 || t > 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      return;
    }

    // Velocidad con rozamiento integrada analíticamente + gravedad
    float travel = uDrag > 0.0 ? (1.0 - exp(-uDrag * age)) / uDrag : age;
    vec3 p = position + aVelocity * travel + 0.5 * uGravity * age * age;

    // Turbulencia barata (sumas de senos con desfase por partícula)
    float s = aSeed * 6.2831853;
    p += uTurbulence * min(age, 1.0) * vec3(
      sin(age * uTurbFreq + s + p.y * 2.1),
      sin(age * uTurbFreq * 1.31 + s * 1.7 + p.x * 1.7),
      sin(age * uTurbFreq * 0.73 + s * 2.3)
    );

    // Remolino alrededor del centro
    p.xy = uCenter.xy + rot(uSwirl * age) * (p.xy - uCenter.xy);

    // Atracción en espiral hacia el destino (absorción de energía)
    float k = smoothstep(uAttractWindow.x, uAttractWindow.y, uTime);
    if (uAttract.w > 0.0 && k > 0.0) {
      vec3 r = p - uAttract.xyz;
      r.xy = rot(k * k * 6.0 * uAttract.w) * r.xy;
      p = uAttract.xyz + r * (1.0 - k);
    }

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * mix(1.0, uGrowth, t) * uSizeScale / -mv.z;

    vColor = t < 0.5 ? mix(uColor0, uColor1, t * 2.0) : mix(uColor1, uColor2, (t - 0.5) * 2.0);
    float fade = smoothstep(0.0, uFadeIn, t) * (1.0 - smoothstep(1.0 - uFadeOut, 1.0, t));
    float flick = 1.0 - uFlicker * 0.5 * (1.0 + sin(uTime * 31.0 + aSeed * 97.0));
    vAlpha = fade * flick;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    // Halo suave + núcleo brillante: simula el "bloom" sin posprocesado
    float glow = pow(1.0 - d, 2.2);
    float core = smoothstep(0.35, 0.0, d);
    vec3 color = vColor * glow + vec3(core * 0.35 * glow);
    float a = glow * vAlpha * uOpacity;
    gl_FragColor = vec4(color * a, a); // alfa premultiplicado
  }
`;

export class SistemaParticulas {
  /** Objeto 3D que se añade a la escena. */
  points;
  /** Segundos hasta que muere la última partícula. */
  duration = 0;
  /** Número de partículas. */
  count;
  /** @type {THREE.ShaderMaterial} */
  #material;

  /** @param {ParticleOptions} options */
  constructor(options) {
    const {
      count,
      emit,
      sizeScale,
      colors = [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
      gravity = [0, 0, 0],
      drag = 0,
      turbulence = 0,
      turbulenceFrequency = 3,
      swirl = 0,
      center = [0, 0, 0],
      attract = null,
      growth = 1,
      fadeIn = 0.1,
      fadeOut = 0.4,
      flicker = 0,
      opacity = 1,
      blending = 'additive',
    } = options;
    if (!Number.isInteger(count) || count < 1) throw new RangeError('SistemaParticulas: "count" debe ser un entero ≥ 1.');
    if (typeof emit !== 'function') throw new TypeError('SistemaParticulas: "emit" debe ser una función.');
    this.count = count;

    const position = new Float32Array(count * 3);
    const velocity = new Float32Array(count * 3);
    const time = new Float32Array(count * 2);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const p = emit(i);
      position.set(p.position, i * 3);
      velocity.set(p.velocity ?? [0, 0, 0], i * 3);
      time[i * 2] = p.delay ?? 0;
      time[i * 2 + 1] = Math.max(1e-3, p.life);
      size[i] = p.size;
      seed[i] = Math.random();
      this.duration = Math.max(this.duration, (p.delay ?? 0) + p.life);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocity, 3));
    geometry.setAttribute('aTime', new THREE.BufferAttribute(time, 2));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    // Las partículas se mueven en el shader: la caja precalculada no sirve.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    const vec3 = (/** @type {number[]} */ v) => new THREE.Vector3(...v);
    this.#material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
      blending: blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uDrag: { value: drag },
        uTurbulence: { value: turbulence },
        uTurbFreq: { value: turbulenceFrequency },
        uSwirl: { value: swirl },
        uSizeScale: sizeScale,
        uGrowth: { value: growth },
        uFadeIn: { value: fadeIn },
        uFadeOut: { value: fadeOut },
        uFlicker: { value: flicker },
        uGravity: { value: vec3(gravity) },
        uCenter: { value: vec3(center) },
        // Ojo: new Vector4() vale (0, 0, 0, 1). La w es el interruptor de la
        // atracción, así que sin atracción hay que ponerla a 0 explícitamente.
        uAttract: { value: attract ? new THREE.Vector4(...attract.target, attract.twist ?? 1) : new THREE.Vector4(0, 0, 0, 0) },
        uAttractWindow: { value: new THREE.Vector2(attract?.start ?? 0, attract?.end ?? 1) },
        uColor0: { value: vec3(colors[0]) },
        uColor1: { value: vec3(colors[1]) },
        uColor2: { value: vec3(colors[2]) },
        uOpacity: { value: opacity },
      },
    });
    this.points = new THREE.Points(geometry, this.#material);
    this.points.frustumCulled = false;
  }

  /**
   * Avanza la animación.
   * @param {number} time Segundos desde que se creó el sistema.
   */
  update(time) {
    this.#material.uniforms.uTime.value = time;
  }

  /** Opacidad global (0-1), p. ej. para desvanecer todo el sistema. */
  set opacity(value) {
    this.#material.uniforms.uOpacity.value = value;
  }

  dispose() {
    this.points.geometry.dispose();
    this.#material.dispose();
  }
}
