import { signedArea } from '../geometria/trazo.js';
import { analyzeCircle } from './estrategias/circulo.js';
import { cloudDistance } from './estrategias/nube-puntos.js';
import { prepareStrokes, distanceMatrix, greedyAssignment, sameDirection } from './estrategias/coincidencia-trazos.js';

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {import('../glifos/modelo-glifo.js').Glyph} Glyph */
/** @typedef {'apprentice' | 'artisan' | 'master'} RecognitionLevel */
/** @typedef {'good' | 'fair' | 'poor'} Grade */

/**
 * @typedef {object} LevelConfig
 * @property {string} label
 * @property {number} threshold Puntuación mínima para superar el glifo.
 * @property {boolean} checkOrder
 * @property {boolean} checkDirection
 * @property {'ghost' | 'faint' | 'none'} guide Guía recomendada en el lienzo.
 */

/** Niveles de dificultad. */
export const RECOGNITION_LEVELS = Object.freeze({
  apprentice: Object.freeze({ label: 'Aprendiz', threshold: 60, checkOrder: false, checkDirection: false, guide: 'ghost' }),
  artisan: Object.freeze({ label: 'Artesano', threshold: 75, checkOrder: true, checkDirection: false, guide: 'faint' }),
  master: Object.freeze({ label: 'Maestro', threshold: 85, checkOrder: true, checkDirection: true, guide: 'none' }),
});

/**
 * @typedef {object} StrokeFeedback
 * @property {number} index Índice del trazo del usuario.
 * @property {'circle' | 'inner' | 'extra'} role
 * @property {number | null} matched Índice del trazo modelo emparejado (0 = círculo).
 * @property {number} score 0-100.
 * @property {Grade} grade
 */

/**
 * @typedef {object} Issue
 * @property {string} code Identificador estable (para pruebas o traducciones).
 * @property {string} message Texto para la persona.
 * @property {number} [stroke] Índice del trazo implicado.
 */

/**
 * @typedef {object} RecognitionResult
 * @property {string} glyphId
 * @property {RecognitionLevel} level
 * @property {number} score Puntuación final 0-100.
 * @property {number} threshold
 * @property {boolean} passed
 * @property {string} summary Frase de resumen.
 * @property {{ circle: number, shape: number, order: number | null, direction: number | null }} components
 * @property {import('./estrategias/circulo.js').CircleAnalysis | null} circle
 * @property {{ cx: number, cy: number, r: number } | null} transform Dónde está el glifo dibujado (coordenadas de entrada).
 * @property {StrokeFeedback[]} strokes
 * @property {Issue[]} issues Problemas, del más al menos importante.
 */

/** @typedef {{ points: Point[] } | Point[]} StrokeInput */

/**
 * Compara dibujos con glifos.
 *
 * Proceso:
 * 1. Encuentra el **círculo exterior** (el trazo circular más grande). Su
 *    centro y radio definen el sistema de coordenadas: así da igual dónde y
 *    a qué tamaño se dibuje.
 * 2. Compara la **forma interior** con la estrategia de nube de puntos.
 * 3. Según el nivel, comprueba el **orden** y el **sentido** trazo a trazo.
 *    En Artesano, un error de orden o de número de trazos suspende; en
 *    Maestro, también un trazo en sentido contrario.
 * 4. Combina las notas y genera retroalimentación por trazo.
 *
 * Las estrategias están en `strategies/` y se pueden mejorar o sustituir
 * sin cambiar esta API.
 */
export class ReconocedorGlifos {
  #sigma;

  /**
   * @param {{ sigma?: number }} [options] `sigma`: tolerancia de forma en
   *   radios del círculo (mayor = más permisivo). Por defecto 0,08.
   */
  constructor({ sigma = 0.08 } = {}) {
    if (!(sigma > 0)) throw new RangeError('ReconocedorGlifos: "sigma" debe ser > 0.');
    this.#sigma = sigma;
  }

  /**
   * Convierte una distancia (en radios del círculo) en una nota 0-100.
   *
   * Se usa una curva "de meseta", exp(−(d/σ)⁴): las imperfecciones pequeñas
   * apenas restan, pero la nota cae en picado al acercarse a σ. Medido con
   * dibujos sintéticos: un glifo correcto con bastante temblor queda en
   * d ≈ 0,06 y uno equivocado nunca baja de d ≈ 0,078.
   * Con σ = 0,08: d = 0,04 → 94 · 0,06 → 73 · 0,07 → 56 · 0,08 → 37 · 0,1 → 9.
   *
   * @param {number} distance
   */
  scoreFromDistance(distance) {
    if (!Number.isFinite(distance)) return 0;
    return 100 * Math.exp(-((distance / this.#sigma) ** 4));
  }

  /**
   * Evalúa un dibujo frente a un glifo concreto.
   *
   * @param {StrokeInput[]} strokes Trazos del usuario (cualquier sistema de coordenadas con y hacia abajo).
   * @param {Glyph} glyph
   * @param {{ level?: RecognitionLevel }} [options]
   * @returns {RecognitionResult}
   */
  evaluate(strokes, glyph, { level = 'apprentice' } = {}) {
    const config = RECOGNITION_LEVELS[level];
    if (!config) throw new RangeError(`Nivel desconocido: ${level}.`);
    if (!glyph?.sampled) throw new TypeError('evaluate() necesita un glifo creado con createGlyph().');
    const user = normalizeInput(strokes);

    /** @type {RecognitionResult} */
    const result = {
      glyphId: glyph.id,
      level,
      score: 0,
      threshold: config.threshold,
      passed: false,
      summary: '',
      components: { circle: 0, shape: 0, order: config.checkOrder ? 0 : null, direction: config.checkDirection ? 0 : null },
      circle: null,
      transform: null,
      strokes: user.map((_, index) => ({ index, role: 'extra', matched: null, score: 0, grade: 'poor' })),
      issues: [],
    };

    if (user.length === 0) {
      result.issues.push({ code: 'empty', message: 'Todavía no has trazado nada.' });
      result.summary = result.issues[0].message;
      return result;
    }

    // 1. Círculo exterior: el candidato circular más grande.
    const analyses = user.map((points) => analyzeCircle(points));
    let circleIndex = -1;
    analyses.forEach((a, i) => {
      if (a?.candidate && (circleIndex < 0 || a.r > /** @type {any} */ (analyses[circleIndex]).r)) circleIndex = i;
    });
    if (circleIndex < 0) {
      result.issues.push({ code: 'no-circle', message: 'No encuentro el círculo exterior: trázalo en un solo trazo, bien cerrado.' });
      result.summary = result.issues[0].message;
      return result;
    }
    const circle = /** @type {import('./estrategias/circulo.js').CircleAnalysis} */ (analyses[circleIndex]);
    result.circle = circle;
    result.transform = { cx: circle.cx, cy: circle.cy, r: circle.r };
    result.components.circle = circle.score;
    result.strokes[circleIndex] = { index: circleIndex, role: 'circle', matched: 0, score: circle.score, grade: grade(circle.score) };

    if (circle.closure > 0.45) {
      result.issues.push({ code: 'circle-open', message: 'El círculo no se cierra: termina donde empezaste.', stroke: circleIndex });
    }
    if (circle.residual > 0.12) {
      result.issues.push({ code: 'circle-irregular', message: 'El círculo está deformado: trázalo más redondo y sin prisa.', stroke: circleIndex });
    }

    // 2. Trazos interiores en el espacio del glifo (círculo de radio 1).
    const innerIdx = user.map((_, i) => i).filter((i) => i !== circleIndex);
    const inner = innerIdx.map((i) =>
      user[i].map((p) => ({ x: (p.x - circle.cx) / circle.r, y: (p.y - circle.cy) / circle.r })),
    );
    const templateInner = /** @type {Point[][]} */ (glyph.sampled.slice(1));
    const templateClosed = glyph.closed.slice(1);

    if (inner.length === 0) {
      result.issues.push({ code: 'no-inner', message: 'Falta el símbolo interior del glifo.' });
    }

    result.components.shape = this.scoreFromDistance(cloudDistance(inner, templateInner));

    // 3. Emparejamiento trazo a trazo.
    const userPrepared = prepareStrokes(inner);
    const templatePrepared = prepareStrokes(templateInner);
    const matrix = distanceMatrix(userPrepared, templatePrepared);
    const assigned = greedyAssignment(matrix);
    const assignedScores = assigned.map((j, i) => (j === null ? 0 : this.scoreFromDistance(matrix[i][j])));

    const nU = inner.length;
    const nT = templateInner.length;
    /** @type {number[]} */
    const orderedScores = templatePrepared.map((_, j) => (j < nU ? this.scoreFromDistance(matrix[j][j]) : 0));

    if (config.checkOrder) {
      const ordered = orderedScores.reduce((a, b) => a + b, 0) / nT;
      result.components.order = ordered;
      if (nU !== nT && nU > 0) {
        result.issues.push({
          code: 'stroke-count',
          message: `Este glifo tiene ${nT} ${nT === 1 ? 'trazo interior' : 'trazos interiores'} y has hecho ${nU}.`,
        });
      }
      const best = assignedScores.reduce((a, b) => a + b, 0) / Math.max(nT, nU);
      if (circleIndex !== 0) {
        result.components.order = ordered * 0.85;
        result.issues.push({ code: 'circle-first', message: 'Empieza siempre por el círculo exterior.', stroke: circleIndex });
      } else if (best - ordered > 15) {
        result.issues.push({ code: 'order', message: 'Los trazos están bien, pero en otro orden: sigue la animación.' });
      }
    }

    if (config.checkDirection) {
      let checked = 1;
      let correct = Math.sign(signedArea(user[circleIndex])) === Math.sign(signedArea(/** @type {Point[]} */ (glyph.sampled[0]))) ? 1 : 0;
      if (!correct) result.issues.push({ code: 'direction', message: 'El círculo va en sentido contrario.', stroke: circleIndex });
      for (let j = 0; j < Math.min(nU, nT); j++) {
        checked++;
        if (sameDirection(userPrepared[j], templatePrepared[j], templateClosed[j])) correct++;
        else {
          result.issues.push({ code: 'direction', message: `El trazo ${innerIdx[j] + 1} va en sentido contrario.`, stroke: innerIdx[j] });
        }
      }
      result.components.direction = (100 * correct) / checked;
    }

    // 4. Retroalimentación por trazo.
    innerIdx.forEach((userIndex, k) => {
      const ordered = config.checkOrder;
      const matched = ordered ? (k < nT ? k : null) : assigned[k];
      const score = ordered ? (k < nT ? this.scoreFromDistance(matrix[k][k]) : 0) : assignedScores[k];
      result.strokes[userIndex] = {
        index: userIndex,
        role: matched === null ? 'extra' : 'inner',
        matched: matched === null ? null : matched + 1,
        score,
        grade: matched === null && !ordered ? 'fair' : grade(score),
      };
    });
    const worst = result.strokes
      .filter((s) => s.role === 'inner' && s.grade === 'poor')
      .sort((a, b) => a.score - b.score)[0];
    if (worst && result.components.shape < 85) {
      result.issues.push({ code: 'stroke-shape', message: `El trazo ${worst.index + 1} no se parece al del modelo.`, stroke: worst.index });
    }

    // 5. Nota final. El círculo multiplica (no suma): un círculo perfecto no
    //    puede compensar un símbolo interior equivocado.
    const c = result.components;
    const circleFactor = 0.7 + 0.3 * (c.circle / 100);
    const innerScore =
      level === 'apprentice'
        ? c.shape
        : level === 'artisan'
          ? 0.55 * c.shape + 0.45 * /** @type {number} */ (c.order)
          : 0.45 * c.shape + 0.3 * /** @type {number} */ (c.order) + 0.25 * /** @type {number} */ (c.direction);
    let score = innerScore * circleFactor;
    if (config.checkOrder) score -= 6 * Math.max(0, nU - nT);
    if (innerIdx.length === 0) score = Math.min(score, 30);

    result.score = Math.round(Math.max(0, Math.min(100, score)));
    // Reglas de cada nivel: no basta con la nota.
    const blocking = new Set([
      ...(config.checkOrder ? ['order', 'circle-first', 'stroke-count'] : []),
      ...(config.checkDirection ? ['direction'] : []),
    ]);
    const blocked = result.issues.some((i) => blocking.has(i.code));
    result.passed = result.score >= config.threshold && innerIdx.length > 0 && !blocked;
    result.summary = result.passed
      ? result.score >= 95
        ? '¡Trazo impecable!'
        : result.score >= config.threshold + 10
          ? 'Glifo bien trazado.'
          : 'Glifo aceptado, por poco.'
      : result.issues[0]?.message ?? 'Aún no se parece lo suficiente: fíjate en la guía.';
    return result;
  }

  /**
   * Reconoce qué glifo se ha dibujado entre varios.
   *
   * @param {StrokeInput[]} strokes
   * @param {Iterable<Glyph>} glyphs
   * @param {{ level?: RecognitionLevel }} [options]
   * @returns {{ glyph: Glyph, result: RecognitionResult }[]} Ordenados de más a menos parecido.
   */
  classify(strokes, glyphs, { level = 'apprentice' } = {}) {
    return [...glyphs]
      .map((glyph) => ({ glyph, result: this.evaluate(strokes, glyph, { level }) }))
      .sort((a, b) => b.result.score - a.result.score);
  }
}

/**
 * @param {number} score
 * @returns {Grade}
 */
function grade(score) {
  return score >= 80 ? 'good' : score >= 55 ? 'fair' : 'poor';
}

/**
 * Acepta trazos como `{ points: [...] }` (formato de <gc-glyph-canvas>) o
 * como arrays de puntos, y descarta los no válidos.
 * @param {StrokeInput[]} strokes
 * @returns {Point[][]}
 */
function normalizeInput(strokes) {
  if (!Array.isArray(strokes)) throw new TypeError('Los trazos deben ser un array.');
  return strokes
    .map((s) => (Array.isArray(s) ? s : s?.points))
    .filter((points) => Array.isArray(points) && points.length >= 2)
    .map((points) => points.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)).map((p) => ({ x: p.x, y: p.y })))
    .filter((points) => points.length >= 2);
}
