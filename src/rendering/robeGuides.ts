import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicMaterial,
  MathUtils,
  Sphere,
  Vector3,
} from 'three'
import { sampleGarmentSurface, sampleRoundCollar } from '../geometry/garmentMapping'
import {
  humanFigurePleatPosition,
  sampleHumanFigureSurface,
  sampleHumanRoundCollar,
} from '../geometry/humanFigureMapping'
import type { GenerationStyle } from '../types/poetry'

export interface RobeGuideRenderData {
  geometry: BufferGeometry
  material: LineBasicMaterial
}

type CurveSampler = (amount: number) => Vector3
const TAU = Math.PI * 2

function addCurve(
  vertices: number[],
  segments: number,
  sampler: CurveSampler,
): void {
  let previous = sampler(0)
  for (let index = 1; index <= segments; index += 1) {
    const current = sampler(index / segments)
    previous.toArray(vertices, vertices.length)
    current.toArray(vertices, vertices.length)
    previous = current
  }
}

function frontLift(point: Vector3, amount = 0.025): Vector3 {
  point.z += amount
  return point
}

function robePoint(u: number, v: number): Vector3 {
  return frontLift(sampleGarmentSurface(u, v).position)
}

function createRoundRobeGuideRenderData(): RobeGuideRenderData {
  const vertices: number[] = []

  // Twin collar edges retain the characteristic piped round neckline even
  // when the imported spreadsheet is sparse around its upper middle cells.
  for (const offset of [-0.014, 0.014]) {
    addCurve(vertices, 36, (amount) =>
      frontLift(sampleRoundCollar(MathUtils.lerp(0.42, 0.58, amount), offset), 0.035),
    )
  }

  // Sloped shoulder lines and inward-returning lower sleeve edges replace the
  // previous horizontal wing silhouette with a restrained hanging robe sleeve.
  for (const side of [-1, 1]) {
    const outerU = side < 0 ? 0.25 : 0.75
    const innerU = side < 0 ? 0.42 : 0.58
    addCurve(vertices, 24, (amount) => robePoint(
      MathUtils.lerp(outerU, innerU, amount),
      MathUtils.lerp(0.105, 0.052, amount),
    ))
    addCurve(vertices, 24, (amount) => robePoint(
      MathUtils.lerp(outerU, innerU, amount),
      MathUtils.lerp(0.315, 0.405, amount),
    ))
    addCurve(vertices, 28, (amount) => robePoint(
      outerU,
      MathUtils.lerp(0.105, 0.315, amount),
    ))

    // Side seams continue from belt to ankle and make the long A-line cut read
    // as one robe rather than disconnected rows of source characters.
    addCurve(vertices, 44, (amount) => robePoint(
      outerU,
      MathUtils.lerp(0.505, 0.985, amount),
    ))
  }

  // Two belt edges, a central opening and restrained vertical pleats borrow
  // the clean construction lines of the supplied Ming robe reference.
  for (const beltV of [0.442, 0.498]) {
    addCurve(vertices, 56, (amount) => robePoint(
      MathUtils.lerp(0.25, 0.75, amount),
      beltV,
    ))
  }
  addCurve(vertices, 46, (amount) => robePoint(0.5, MathUtils.lerp(0.505, 0.985, amount)))
  for (const u of [0.455, 0.48, 0.52, 0.545]) {
    addCurve(vertices, 36, (amount) => robePoint(u, MathUtils.lerp(0.56, 0.95, amount)))
  }
  addCurve(vertices, 60, (amount) => robePoint(
    MathUtils.lerp(0.25, 0.75, amount),
    0.985,
  ))

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.boundingSphere = new Sphere(new Vector3(0, -0.55, 0), 8)

  const material = new LineBasicMaterial({
    name: '明制圆领袍结构线',
    color: new Color('#725733'),
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
  })

  return { geometry, material }
}

function figurePoint(u: number, v: number): Vector3 {
  return frontLift(sampleHumanFigureSurface(u, v).position)
}

// Two shoes peeking out from under the hem, splayed the way the drawing has
// them. They are outline only, like the rest of the construction lines, so the
// character surface still carries the robe itself.
const SHOE_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [-0.16, 0.01],
  [0.16, -0.02],
  [0.23, -0.17],
  [0.17, -0.32],
  [-0.05, -0.37],
  [-0.17, -0.2],
]

function addShoeOutline(vertices: number[], side: number): void {
  // Mirror to the requested foot, then splay the toe outward by a quarter of a
  // turn so the two shoes point away from each other.
  const splay = side * 0.34
  const cos = Math.cos(splay)
  const sin = Math.sin(splay)
  const points = SHOE_OUTLINE.map(([offsetX, offsetY]) => {
    const mirroredX = side * offsetX
    return frontLift(
      new Vector3(
        0.3 * side + mirroredX * cos - offsetY * sin * side,
        -4.46 + mirroredX * sin * side + offsetY * cos,
        -0.06 + Math.abs(offsetX) * 0.3,
      ),
      0.03,
    )
  })
  for (let index = 0; index < points.length; index += 1) {
    points[index].toArray(vertices, vertices.length)
    points[(index + 1) % points.length].toArray(vertices, vertices.length)
  }
}

function createHumanFigureGuideRenderData(): RobeGuideRenderData {
  const vertices: number[] = []

  // ── 幞头、面、颈 ──
  // The profile is deliberately unfeatured: the imported characters remain the
  // portrait's only visible surface, exactly as the reference leaves the face
  // blank.
  addCurve(vertices, 26, (amount) => figurePoint(MathUtils.lerp(0.35, 0.65, amount), 0.006))
  addCurve(vertices, 34, (amount) => figurePoint(MathUtils.lerp(0.29, 0.71, amount), 0.054))
  addCurve(vertices, 36, (amount) => figurePoint(MathUtils.lerp(0.26, 0.74, amount), 0.082))
  for (const side of [0.253, 0.747]) {
    addCurve(vertices, 16, (amount) => figurePoint(side, MathUtils.lerp(0.008, 0.082, amount)))
  }
  for (const side of [0.263, 0.737]) {
    addCurve(vertices, 20, (amount) => figurePoint(side, MathUtils.lerp(0.082, 0.155, amount)))
  }
  addCurve(vertices, 28, (amount) => figurePoint(MathUtils.lerp(0.3, 0.7, amount), 0.155))
  addCurve(vertices, 26, (amount) => figurePoint(MathUtils.lerp(0.31, 0.69, amount), 0.185))

  // ── 圆领 ──
  // Twin U-shaped piping, sampled from the same 3D surface as the characters so
  // it follows the figure while the user orbits it.
  for (const offset of [-0.016, 0.016]) {
    addCurve(vertices, 40, (amount) => frontLift(
      sampleHumanRoundCollar(MathUtils.lerp(0.36, 0.64, amount), offset),
      0.035,
    ))
  }

  // ── 左臂：抬起的小臂与垂落的琵琶袖 ──
  addCurve(vertices, 40, (amount) => figurePoint(0.25, MathUtils.lerp(0.2, 0.484, amount)))
  addCurve(vertices, 22, (amount) => figurePoint(
    MathUtils.lerp(0.25, 0.345, amount),
    MathUtils.lerp(0.2, 0.218, amount),
  ))
  addCurve(vertices, 22, (amount) => figurePoint(
    MathUtils.lerp(0.25, 0.335, amount),
    MathUtils.lerp(0.484, 0.506, amount),
  ))
  addCurve(vertices, 22, (amount) => {
    const angle = amount * TAU
    return new Vector3(
      -2.5 + Math.cos(angle) * 0.17,
      1.72 + Math.sin(angle) * 0.19,
      0.36 + Math.cos(angle) * 0.04,
    )
  })

  // ── 右臂：屈肘下垂的袍袖，手落在腰带右侧 ──
  addCurve(vertices, 40, (amount) => figurePoint(0.75, MathUtils.lerp(0.2, 0.48, amount)))
  addCurve(vertices, 22, (amount) => figurePoint(
    MathUtils.lerp(0.75, 0.655, amount),
    MathUtils.lerp(0.2, 0.218, amount),
  ))
  addCurve(vertices, 22, (amount) => figurePoint(
    MathUtils.lerp(0.75, 0.665, amount),
    MathUtils.lerp(0.48, 0.502, amount),
  ))
  addCurve(vertices, 20, (amount) => {
    const angle = amount * TAU
    return new Vector3(
      0.6 + Math.cos(angle) * 0.19,
      0.23 + Math.sin(angle) * 0.17,
      0.6 + Math.cos(angle) * 0.05,
    )
  })

  // ── 腰带与带銙 ──
  // Eight plaques divided across the front, matching the crest spacing of the
  // matching ripple in the character surface.
  for (const beltV of [0.43, 0.478]) {
    addCurve(vertices, 52, (amount) => figurePoint(MathUtils.lerp(0.3, 0.7, amount), beltV))
  }
  for (let index = 0; index <= 8; index += 1) {
    const u = 0.3 + index * 0.05
    addCurve(vertices, 8, (amount) => figurePoint(u, MathUtils.lerp(0.43, 0.478, amount)))
  }
  addCurve(vertices, 20, (amount) => {
    const angle = amount * TAU
    return new Vector3(Math.cos(angle) * 0.2, 0.168 + Math.sin(angle) * 0.075, 0.58)
  })

  // ── 长摆 ──
  // Side seams continue below the sleeves to the hem; the front carries the
  // centre opening and the pleat creases sampled off the surface itself.
  for (const side of [0.25, 0.75]) {
    addCurve(vertices, 34, (amount) => figurePoint(side, MathUtils.lerp(0.49, 0.965, amount)))
  }
  addCurve(vertices, 40, (amount) => figurePoint(0.5, MathUtils.lerp(0.486, 0.97, amount)))
  for (const crease of [-1.366, -1.0245, -0.683, -0.3415, 0.3415, 0.683, 1.0245, 1.366]) {
    addCurve(vertices, 28, (amount) => frontLift(
      humanFigurePleatPosition(crease, MathUtils.lerp(0.56, 0.945, amount)),
      0.02,
    ))
  }
  addCurve(vertices, 56, (amount) => figurePoint(MathUtils.lerp(0.25, 0.75, amount), 0.968))

  // ── 双履 ──
  addShoeOutline(vertices, -1)
  addShoeOutline(vertices, 1)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.boundingSphere = new Sphere(new Vector3(0, -0.2, 0), 9.5)

  const material = new LineBasicMaterial({
    name: '人形圆领袍结构线',
    color: new Color('#63492d'),
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
  })

  return { geometry, material }
}

export function createRobeGuideRenderData(
  style: GenerationStyle = 'roundCollarRobe',
): RobeGuideRenderData {
  if (style === 'humanUpperBody') return createHumanFigureGuideRenderData()
  return createRoundRobeGuideRenderData()
}
