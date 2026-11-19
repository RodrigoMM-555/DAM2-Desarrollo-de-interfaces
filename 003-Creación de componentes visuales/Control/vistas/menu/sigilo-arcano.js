/**
 * Círculo mágico decorativo del menú principal (SVG generado).
 *
 * Tres anillos que giran a distinta velocidad y en sentidos opuestos:
 * el exterior con los nombres de los glifos, el medio con un hexagrama y
 * el interior con un cuadrado inscrito.
 */

const TEXT = 'IGNIS ✦ AQUA ✦ VENTUS ✦ LUX ✦ AEGIS ✦ GLACIES ✦ ';

/**
 * Puntos de un polígono regular centrado en el origen.
 * @param {number} sides
 * @param {number} radius
 * @param {number} [rotation] En grados.
 */
function polygon(sides, radius, rotation = -90) {
  return Array.from({ length: sides }, (_, i) => {
    const a = ((rotation + (360 / sides) * i) * Math.PI) / 180;
    return `${(Math.cos(a) * radius).toFixed(2)},${(Math.sin(a) * radius).toFixed(2)}`;
  }).join(' ');
}

/** Marcas radiales tipo reloj de sol. */
function ticks(count, inner, outer, long = 5) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const r1 = i % long === 0 ? inner - 6 : inner;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    return `<line x1="${(c * r1).toFixed(2)}" y1="${(s * r1).toFixed(2)}" x2="${(c * outer).toFixed(2)}" y2="${(s * outer).toFixed(2)}"/>`;
  }).join('');
}

/** Pequeños círculos en los vértices de un polígono. */
function vertexNodes(sides, radius, r, rotation = -90) {
  return polygon(sides, radius, rotation)
    .split(' ')
    .map((p) => {
      const [x, y] = p.split(',');
      return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
    })
    .join('');
}

/** @returns {string} */
export function arcaneSigil() {
  return `
<svg class="sigil" viewBox="-300 -300 600 600" aria-hidden="true" focusable="false">
  <defs>
    <path id="sigil-text-ring" d="M0,-252 a252,252 0 1,1 0,504 a252,252 0 1,1 0,-504"/>
  </defs>
  <g class="sigil__ring sigil__ring--outer">
    <circle r="284" class="faint"/>
    <circle r="272"/>
    <text class="sigil__text"><textPath href="#sigil-text-ring">${TEXT.repeat(2)}</textPath></text>
    <circle r="236"/>
    <g class="faint">${ticks(72, 226, 236)}</g>
  </g>
  <g class="sigil__ring sigil__ring--middle">
    <polygon points="${polygon(3, 205)}"/>
    <polygon points="${polygon(3, 205, 90)}"/>
    <circle r="205" class="faint"/>
    <g class="sigil__nodes">${vertexNodes(6, 205, 7, -90)}</g>
  </g>
  <g class="sigil__ring sigil__ring--inner">
    <circle r="118"/>
    <polygon points="${polygon(4, 118, -45)}" class="faint"/>
    <polygon points="${polygon(4, 118, 0)}" class="faint"/>
    <circle r="62"/>
    <polygon points="${polygon(3, 44)}"/>
    <circle r="5" class="sigil__core"/>
  </g>
</svg>`;
}
