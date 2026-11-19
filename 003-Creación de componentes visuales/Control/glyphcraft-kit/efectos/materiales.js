import * as THREE from 'three';

/**
 * Materiales de los efectos. Todos son *shaders* propios sin iluminación:
 * la "luz" la ponen ellos mismos con mezcla aditiva, así encajan con las
 * partículas y funcionan sobre un lienzo transparente.
 */

/** @typedef {[number, number, number]} RGB */

const common = {
  transparent: true,
  depthWrite: false,
  premultipliedAlpha: true,
  blending: THREE.AdditiveBlending,
};

/**
 * Onda expansiva: un anillo que crece y se desvanece.
 * Se usa sobre un `PlaneGeometry(2, 2)`; `uProgress` va de 0 a 1.
 * @param {RGB} color
 */
export function ringMaterial(color) {
  return new THREE.ShaderMaterial({
    ...common,
    side: THREE.DoubleSide,
    uniforms: {
      uProgress: { value: 0 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Vector3(...color) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uProgress;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float width = 0.02 + 0.1 * (1.0 - uProgress);
        float ring = exp(-pow((d - uProgress) / width, 2.0));
        float a = ring * (1.0 - uProgress) * uOpacity;
        gl_FragColor = vec4((uColor + vec3(0.4) * ring) * a, a);
      }`,
  });
}

/**
 * Esfera con borde luminoso (efecto fresnel), ondulación y, opcionalmente,
 * un patrón hexagonal con ondas que la recorren (escudo).
 *
 * @param {{ color: RGB, rim: RGB, wobble?: number, hex?: boolean }} options
 */
export function shellMaterial({ color, rim, wobble = 0, hex = false }) {
  return new THREE.ShaderMaterial({
    ...common,
    side: THREE.FrontSide,
    defines: hex ? { HEX: '' } : {},
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uWobble: { value: wobble },
      uColor: { value: new THREE.Vector3(...color) },
      uRim: { value: new THREE.Vector3(...rim) },
      uImpact: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWobble;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec2 vUv;
      varying vec3 vLocal;
      void main() {
        vec3 p = position;
        float w = sin(p.x * 4.0 + uTime * 3.1) * sin(p.y * 5.0 + uTime * 2.3) * sin(p.z * 3.0 + uTime * 1.7);
        p += normal * w * uWobble;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        vUv = uv;
        vLocal = normalize(position);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uImpact;
      uniform vec3 uColor;
      uniform vec3 uRim;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec2 vUv;
      varying vec3 vLocal;

      // Distancia al borde de la celda en una rejilla hexagonal
      float hexEdge(vec2 p) {
        vec2 r = vec2(1.0, 1.7320508);
        vec2 h = r * 0.5;
        vec2 a = mod(p, r) - h;
        vec2 b = mod(p - h, r) - h;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        g = abs(g);
        return 0.5 - max(dot(g, normalize(r)), g.x);
      }

      void main() {
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
        vec3 col = uColor * 0.25 + uRim * fresnel * 1.4;
        float a = 0.12 + fresnel * 0.85;
        // Bandas de luz que recorren la superficie
        float band = 0.5 + 0.5 * sin(vLocal.y * 9.0 - uTime * 3.0 + vLocal.x * 4.0);
        col += uRim * band * 0.12;
        #ifdef HEX
          float edge = hexEdge(vUv * vec2(18.0, 9.0));
          float lines = smoothstep(0.08, 0.0, edge);
          float wave = 0.5 + 0.5 * sin(length(vLocal.xy) * 14.0 - uTime * 5.0);
          col += uRim * lines * (0.35 + 0.65 * wave + uImpact);
          a += lines * 0.5;
        #endif
        a *= uOpacity;
        gl_FragColor = vec4(col * a, a);
      }`,
  });
}

/**
 * Rayo de luz: un plano alargado con degradado desde el origen.
 * La geometría debe tener su origen en un extremo (x de 0 a 1).
 * @param {RGB} color
 */
export function rayMaterial(color) {
  return new THREE.ShaderMaterial({
    ...common,
    side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 1 }, uColor: { value: new THREE.Vector3(...color) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float along = pow(1.0 - vUv.x, 1.6);
        float across = exp(-pow((vUv.y - 0.5) * 5.0, 2.0));
        float a = along * across * uOpacity;
        gl_FragColor = vec4((uColor + vec3(0.5) * across) * a, a);
      }`,
  });
}

/**
 * Cristal de hielo con facetas y borde luminoso. Admite `InstancedMesh`.
 */
export function iceMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    premultipliedAlpha: true,
    blending: THREE.NormalBlending,
    uniforms: { uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 local = vec4(position, 1.0);
        vec3 n = normal;
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * local;
        vNormal = normalize(normalMatrix * n);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec3 n = normalize(vNormal);
        float facing = abs(dot(n, normalize(vView)));
        float fresnel = pow(1.0 - facing, 2.0);
        // Facetas: cada cara recibe un tono según su orientación
        float facet = 0.55 + 0.45 * dot(n, normalize(vec3(-0.4, 0.7, 0.6)));
        vec3 col = mix(vec3(0.35, 0.65, 0.95), vec3(0.9, 0.98, 1.0), facet) + fresnel * vec3(0.6, 0.9, 1.0);
        float a = (0.55 + 0.4 * fresnel) * uOpacity;
        gl_FragColor = vec4(col * a, a);
      }`,
  });
}
