import { MathUtils, Vector3 } from 'three'
import type { GarmentRegion } from '../types/poetry'

export interface HumanFigureSurfaceSample {
  position: Vector3
  region: GarmentRegion
}

const TAU = Math.PI * 2
const FIGURE_TOP = 4.05
const FIGURE_HEIGHT = 8.55
const FIGURE_COLLAR_SPAN = 0.8

/**
 * Vertical landmarks traced off the reference line drawing. Every value is the
 * normalised height of a drawn seam, measured from the crown of the futou (0)
 * to the bottom of the hem (1). Anchoring the silhouette to the drawing rather
 * than to the spreadsheet row count keeps the figure recognisable when a user
 * uploads a grid of a different shape.
 */
const V_HAT_BAND = 0.054
const V_HAT_HEM = 0.082
const V_CHIN = 0.155
const V_NECK = 0.185
const V_COLLAR_SIDE = 0.204
const V_COLLAR_DIP = 0.042
const V_BELT_TOP = 0.43
const V_BELT_BOTTOM = 0.478
const V_HEM = 0.955

function smoothStep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const normalized = MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return normalized * normalized * (3 - 2 * normalized)
}

function band(
  value: number,
  enterStart: number,
  enterEnd: number,
  exitStart: number,
  exitEnd: number,
): number {
  return smoothStep(enterStart, enterEnd, value) * (1 - smoothStep(exitStart, exitEnd, value))
}

function gaussian(value: number, center: number, radius: number): number {
  const normalized = (value - center) / radius
  return Math.exp(-normalized * normalized)
}

type Stops = ReadonlyArray<readonly [number, number]>

function series(value: number, stops: Stops): number {
  if (value <= stops[0][0]) return stops[0][1]
  for (let index = 0; index < stops.length - 1; index += 1) {
    const [startValue, startResult] = stops[index]
    const [endValue, endResult] = stops[index + 1]
    if (value <= endValue) {
      return MathUtils.lerp(startResult, endResult, smoothStep(startValue, endValue, value))
    }
  }
  return stops[stops.length - 1][1]
}

/**
 * Half width of the robe body itself, without the sleeves. The shoulders stay
 * flat and wide, the waist cinches under the belt, and the skirt opens into the
 * long A-line of the drawing before it rolls under at the hem.
 */
const TORSO_HALF_WIDTH: Stops = [
  [0.185, 0.26],
  [0.196, 0.46],
  [0.206, 0.86],
  [0.216, 1.06],
  [0.25, 1.1],
  [0.31, 1.06],
  [0.38, 0.96],
  [0.43, 0.88],
  [0.478, 0.92],
  [0.56, 1.02],
  [0.68, 1.2],
  [0.82, 1.48],
  [0.93, 1.72],
  [0.965, 1.8],
  [1, 1.66],
]

/**
 * Front-to-back radius. The drawing only fixes the silhouette, so the depth is
 * chosen to keep the figure from collapsing into a flat cut-out when the user
 * orbits it: roughly two thirds of the half width, which is what a robe of this
 * cut actually measures.
 */
const TORSO_DEPTH: Stops = [
  [0.185, 0.3],
  [0.196, 0.5],
  [0.216, 0.66],
  [0.31, 0.66],
  [0.43, 0.52],
  [0.478, 0.56],
  [0.56, 0.64],
  [0.82, 0.88],
  [0.965, 1.08],
  [1, 1.04],
]

/**
 * Outer silhouette of the extended arm on the viewer's left, traced from the
 * drawing. The top edge leaves the shoulder almost horizontally, the forearm
 * carries the silhouette out to the cuff, and the wide 琵琶袖 then drops well
 * below it. The arm is lifted above its natural row height so the pose reads as
 * raised rather than hanging.
 */
const LEFT_SLEEVE_X: Stops = [
  [0.2, -1.05],
  [0.228, -1.68],
  [0.252, -2.06],
  [0.27, -2.24],
  [0.29, -2.34],
  [0.325, -2.4],
  [0.36, -2.38],
  [0.39, -2.3],
  [0.415, -2.16],
  [0.442, -1.9],
  [0.47, -1.5],
  [0.5, -1.08],
]

const LEFT_SLEEVE_Y: Stops = [
  [0.2, 2.36],
  [0.228, 2.28],
  [0.252, 2.16],
  [0.27, 2.02],
  [0.29, 1.84],
  [0.325, 1.52],
  [0.36, 1.18],
  [0.39, 0.92],
  [0.415, 0.74],
  [0.442, 0.6],
  [0.47, 0.52],
  [0.5, 0.46],
]

/** Same construction on the viewer's right, where the sleeve hangs from a bent elbow. */
const RIGHT_SLEEVE_X: Stops = [
  [0.2, 1.05],
  [0.228, 1.62],
  [0.252, 1.96],
  [0.27, 2.12],
  [0.29, 2.2],
  [0.325, 2.24],
  [0.36, 2.22],
  [0.39, 2.14],
  [0.415, 2.02],
  [0.442, 1.78],
  [0.47, 1.42],
  [0.5, 1.06],
]

const RIGHT_SLEEVE_Y: Stops = [
  [0.2, 2.36],
  [0.228, 2.28],
  [0.256, 2.12],
  [0.284, 1.94],
  [0.314, 1.7],
  [0.346, 1.4],
  [0.378, 1.1],
  [0.41, 0.84],
  [0.442, 0.64],
  [0.47, 0.54],
  [0.5, 0.46],
]

interface FigureProfile {
  sinTheta: number
  cosTheta: number
  halfWidth: number
  depth: number
  localX: number
  frontWeight: number
  collarV: number
  collarDistance: number
  leftSleeve: number
  rightSleeve: number
  leftHand: number
  rightHand: number
  belt: number
}

function figureProfile(u: number, v: number): FigureProfile {
  const theta = (u - 0.5) * TAU
  const sinTheta = Math.sin(theta)
  const cosTheta = Math.cos(theta)
  const halfWidth = series(v, TORSO_HALF_WIDTH)
  const depth = series(v, TORSO_DEPTH)
  const localX = halfWidth * sinTheta

  // A linear falloff around each side seam spreads the sleeve characters out
  // instead of bunching them all on the single outermost column.
  const armFalloff = (centerU: number) => 1 - smoothStep(0, 0.098, Math.abs(u - centerU))
  const leftArm = armFalloff(0.25)
  const rightArm = armFalloff(0.75)

  // The sleeve hangs deeper the further it is from the body: against the side
  // seam it is only as tall as the armpit, and at the cuff it reaches well
  // below the belt. Keeping the band end tied to the arm weight is what stops
  // the sleeve from smearing into the torso as a flat wing.
  const bandEnd = (armWeight: number, atSeam: number, atCuff: number) =>
    MathUtils.lerp(atSeam, atCuff, armWeight)

  const leftSleeveEnd = bandEnd(leftArm, 0.395, 0.505)
  const rightSleeveEnd = bandEnd(rightArm, 0.375, 0.495)
  const leftSleeve = leftArm *
    band(v, 0.19, 0.206, leftSleeveEnd - 0.045, leftSleeveEnd)
  const rightSleeve = rightArm *
    band(v, 0.19, 0.21, rightSleeveEnd - 0.045, rightSleeveEnd)
  const leftHand = (1 - smoothStep(0, 0.048, Math.abs(u - 0.25))) * gaussian(v, 0.3, 0.042)
  const rightHand =
    (1 - smoothStep(0, 0.058, Math.abs(u - 0.645))) * band(v, 0.398, 0.424, 0.462, 0.496)

  const collarUnitX = MathUtils.clamp(localX / FIGURE_COLLAR_SPAN, -1, 1)
  const collarV =
    V_COLLAR_SIDE + V_COLLAR_DIP * Math.sqrt(Math.max(0, 1 - collarUnitX * collarUnitX))

  return {
    sinTheta,
    cosTheta,
    halfWidth,
    depth,
    localX,
    // A tighter power keeps the collar piping and the belt plaques on the
    // front surface without spilling around the sides.
    frontWeight: Math.pow(Math.max(0, cosTheta), 3),
    collarV,
    collarDistance: Math.abs(v - collarV),
    leftSleeve,
    rightSleeve,
    leftHand,
    rightHand,
    belt: band(v, V_BELT_TOP - 0.014, V_BELT_TOP, V_BELT_BOTTOM, V_BELT_BOTTOM + 0.014),
  }
}

/**
 * 幞头, blank face and neck. The face carries no features on purpose: the
 * imported characters stay the only marks on the figure, exactly as the ink
 * drawing leaves the face empty.
 */
function headPosition(u: number, v: number): Vector3 {
  const theta = (u - 0.5) * TAU
  const sinTheta = Math.sin(theta)
  const cosTheta = Math.cos(theta)
  const y = FIGURE_TOP - FIGURE_HEIGHT * v

  if (v < V_HAT_HEM) {
    // Rounded crown that swells to a soft fold just above the brow band.
    const crown = series(v, [
      [0, 0.09],
      [0.01, 0.22],
      [0.024, 0.375],
      [0.04, 0.445],
      [0.05, 0.468],
      [0.064, 0.462],
      [0.072, 0.436],
      [0.082, 0.408],
    ])
    const depth = series(v, [
      [0, 0.11],
      [0.01, 0.25],
      [0.024, 0.41],
      [0.04, 0.487],
      [0.05, 0.512],
      [0.064, 0.505],
      [0.072, 0.478],
      [0.082, 0.45],
    ])
    // The band is a concentric lip rather than a hard brim so the outline
    // stays as soft as the brush stroke that drew it.
    const lip = 0.02 * gaussian(v, V_HAT_BAND, 0.013)
    return new Vector3(
      (crown + lip) * sinTheta,
      y + lip * 1.3,
      (depth + lip) * cosTheta,
    )
  }

  if (v < V_CHIN) {
    const face = smoothStep(V_HAT_HEM, V_CHIN, v)
    const cheek = Math.sin(Math.PI * face)
    return new Vector3(
      (MathUtils.lerp(0.408, 0.262, face) + 0.05 * cheek) * sinTheta,
      y,
      (MathUtils.lerp(0.45, 0.315, face) + 0.028 * cheek) * cosTheta,
    )
  }

  const neck = smoothStep(V_CHIN, V_NECK, v)
  return new Vector3(
    MathUtils.lerp(0.262, 0.235, neck) * sinTheta,
    y,
    MathUtils.lerp(0.315, 0.262, neck) * cosTheta,
  )
}

export function humanFigureSurfacePosition(u: number, v: number): Vector3 {
  const clampedU = MathUtils.clamp(u, 0.001, 0.999)
  const clampedV = MathUtils.clamp(v, 0, 1)
  if (clampedV < V_NECK) return headPosition(clampedU, clampedV)

  const profile = figureProfile(clampedU, clampedV)
  const y = FIGURE_TOP - FIGURE_HEIGHT * clampedV
  let x = profile.halfWidth * profile.sinTheta
  let z = profile.depth * profile.cosTheta
  let surfaceY = y

  // 圆领: a shallow U of piped banding that dips at the centre front. Both the
  // ridge and the recess are part of the sampled surface, so character normals
  // agree with what the eye sees.
  const collarRidge =
    gaussian(profile.collarDistance, 0, 0.024) *
    profile.frontWeight *
    (1 - smoothStep(0.86, 1, Math.abs(profile.localX)))
  const collarY = FIGURE_TOP - FIGURE_HEIGHT * profile.collarV
  surfaceY = MathUtils.lerp(surfaceY, collarY, collarRidge * 0.85)
  z += collarRidge * 0.24

  // The chest inside the neckline is pressed back so the collar reads as an
  // opening rather than a painted stripe.
  const neckOpening =
    (1 - smoothStep(profile.collarV - 0.008, profile.collarV + 0.008, clampedV)) *
    smoothStep(V_NECK, V_NECK + 0.016, clampedV) *
    profile.frontWeight *
    (1 - smoothStep(0.5, 0.78, Math.abs(profile.localX)))
  z -= neckOpening * 0.26

  // 腰带: a raised band with 带銙 plaques. The plaques modulate the radial lift
  // only, so the belt keeps a continuous, readable edge all the way round.
  // Twenty identical plaques around the body put a crest or a trough every
  // 0.05 of u, which is exactly where the guide lines divide them up.
  const beltLift = profile.belt * 0.085
  const plaqueWave = 0.5 + 0.5 * Math.cos((clampedU - 0.325) * TAU * 20)
  const plaque = MathUtils.lerp(1, 0.42 + 0.58 * plaqueWave, profile.belt * profile.frontWeight)
  x += profile.sinTheta * beltLift * plaque
  z += profile.cosTheta * beltLift * plaque
  // Central buckle.
  const buckle = gaussian(profile.localX, 0, 0.19) * profile.belt
  z += buckle * 0.055

  // Skirt pleats. The folds run down the front of the robe from the belt and
  // deepen as the skirt opens, giving the vertical lines of the drawing.
  const pleatRun = smoothStep(V_BELT_BOTTOM - 0.02, V_HEM - 0.06, clampedV)
  const pleatWeight = (0.32 + 0.68 * profile.frontWeight) * pleatRun
  z += 0.062 * pleatWeight * Math.cos(profile.localX * 9.2)
  // Centre-front seam of the round-collar robe: a shallow gutter flanked by pleats.
  z -= 0.05 * pleatRun * gaussian(profile.localX, 0, 0.11)

  // Sleeves. Each side is blended toward the traced outer silhouette so the
  // characters themselves draw the raised forearm and the falling cuff.
  if (profile.leftSleeve > 0) {
    x = MathUtils.lerp(x, series(clampedV, LEFT_SLEEVE_X), profile.leftSleeve)
    surfaceY = MathUtils.lerp(surfaceY, series(clampedV, LEFT_SLEEVE_Y), profile.leftSleeve)
  }
  if (profile.rightSleeve > 0) {
    x = MathUtils.lerp(x, series(clampedV, RIGHT_SLEEVE_X), profile.rightSleeve)
    surfaceY = MathUtils.lerp(surfaceY, series(clampedV, RIGHT_SLEEVE_Y), profile.rightSleeve)
  }

  // Hands sit on the same text surface. The left fist closes just past the
  // cuff; the right hand settles over the belt on the viewer's right.
  if (profile.leftHand > 0) {
    x = MathUtils.lerp(x, -2.74, profile.leftHand * 0.55)
    surfaceY = MathUtils.lerp(surfaceY, FIGURE_TOP - FIGURE_HEIGHT * 0.292, profile.leftHand * 0.35)
    z = MathUtils.lerp(z, 0.36, profile.leftHand * 0.85)
  }
  if (profile.rightHand > 0) {
    x = MathUtils.lerp(x, 0.56, profile.rightHand * 0.7)
    surfaceY = MathUtils.lerp(surfaceY, FIGURE_TOP - FIGURE_HEIGHT * 0.447, profile.rightHand * 0.6)
    z = MathUtils.lerp(z, 0.62, profile.rightHand * 0.8)
  }

  return new Vector3(x, surfaceY, z)
}

function classifyHumanFigureRegion(u: number, v: number): GarmentRegion {
  if (v < V_HAT_HEM) return 'cap'
  if (v < V_CHIN) return 'face'
  if (v < V_NECK) return 'neck'

  const profile = figureProfile(u, v)

  if (profile.leftHand > 0.42) return 'left-hand'
  if (profile.rightHand > 0.42) return 'right-hand'
  if (
    v < V_COLLAR_SIDE + V_COLLAR_DIP + 0.03 &&
    Math.abs(profile.localX) < 0.92 &&
    profile.frontWeight > 0.22 &&
    profile.collarDistance < 0.026
  ) {
    return 'collar'
  }
  if (profile.leftSleeve > 0.3) return 'left-sleeve'
  if (profile.rightSleeve > 0.3) return 'right-sleeve'
  if (v >= V_BELT_TOP - 0.014 && v <= V_BELT_BOTTOM + 0.014) return 'waist'
  if (v > V_BELT_BOTTOM + 0.02) return 'hem'
  return profile.cosTheta < 0 ? 'back' : 'front'
}

export function sampleHumanFigureSurface(u: number, v: number): HumanFigureSurfaceSample {
  return {
    position: humanFigureSurfacePosition(u, v),
    region: classifyHumanFigureRegion(u, v),
  }
}

/** Number of pleat creases running down the front of the skirt. */
export const FIGURE_PLEAT_SPACING = 0.3415

/**
 * Resolves a front-surface x coordinate back to a (u, v) sample. The guide
 * lines use it to trace the pleat creases of the skirt on the exact folds the
 * characters sit on, instead of approximating them with a separate curve.
 */
export function humanFigurePleatPosition(localX: number, v: number): Vector3 {
  const halfWidth = series(MathUtils.clamp(v, 0, 1), TORSO_HALF_WIDTH)
  const ratio = MathUtils.clamp(localX / Math.max(halfWidth, 0.001), -0.999, 0.999)
  return humanFigureSurfacePosition(0.5 + Math.asin(ratio) / TAU, v)
}

export function sampleHumanRoundCollar(u: number, bandOffset = 0): Vector3 {
  const clampedU = MathUtils.clamp(u, 0.001, 0.999)
  let v = V_COLLAR_SIDE + V_COLLAR_DIP * 0.5
  for (let iteration = 0; iteration < 4; iteration += 1) {
    v = MathUtils.clamp(figureProfile(clampedU, v).collarV + bandOffset, 0, 1)
  }
  return humanFigureSurfacePosition(clampedU, v)
}
