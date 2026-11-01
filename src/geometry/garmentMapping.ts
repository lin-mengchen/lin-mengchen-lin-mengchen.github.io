import {
  Matrix4,
  MathUtils,
  Quaternion,
  Vector3,
} from 'three'
import {
  humanFigureSurfacePosition,
  sampleHumanFigureSurface,
} from './humanFigureMapping'
import type { GarmentRegion, GenerationStyle, PoetryGrid } from '../types/poetry'

export interface CharacterPose {
  id: string
  index: number
  char: string
  region: GarmentRegion
  sourcePosition: Vector3
  curlPosition: Vector3
  targetPosition: Vector3
  sourceQuaternion: Quaternion
  curlQuaternion: Quaternion
  targetQuaternion: Quaternion
  sourceScale: number
  targetScale: number
}

export interface CharacterEdge {
  from: number
  to: number
}

export interface GarmentMapping {
  poses: CharacterPose[]
  edges: CharacterEdge[]
  sourceSpacing: number
  targetScale: number
}

export interface GarmentSurfaceSample {
  position: Vector3
  region: GarmentRegion
}

const TAU = Math.PI * 2
const ROBE_TOP = 3.22
const ROBE_HEIGHT = 7.72
const COLLAR_SPAN = 0.78

function smoothStep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const normalized = MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return normalized * normalized * (3 - 2 * normalized)
}

interface SurfaceProfile {
  theta: number
  sinTheta: number
  cosTheta: number
  sideWeight: number
  sleeveWindow: number
  halfWidth: number
  depth: number
  skirt: number
  frontWeight: number
  localX: number
  collarV: number
  collarDistance: number
}

function surfaceProfile(u: number, v: number): SurfaceProfile {
  const theta = (u - 0.5) * TAU
  const sinTheta = Math.sin(theta)
  const cosTheta = Math.cos(theta)
  const upper = smoothStep(0.02, 0.46, v)
  const skirt = smoothStep(0.46, 1, v)
  const halfWidth = MathUtils.lerp(1.78, 1.18, upper) +
    1.1 * Math.pow(skirt, 0.92)
  const depth = MathUtils.lerp(0.68, 0.5, upper) +
    0.24 * Math.pow(skirt, 1.05)
  const sideWeight = Math.pow(Math.abs(sinTheta), 6)
  const sleeveWindow = Math.pow(
    smoothStep(0.025, 0.105, v) * (1 - smoothStep(0.34, 0.445, v)),
    0.38,
  )
  const frontWeight = Math.pow(Math.max(0, cosTheta), 4)
  const localX = halfWidth * sinTheta
  const collarUnitX = MathUtils.clamp(localX / COLLAR_SPAN, -1, 1)
  const collarV = 0.052 + 0.122 * Math.sqrt(Math.max(0, 1 - collarUnitX * collarUnitX))

  return {
    theta,
    sinTheta,
    cosTheta,
    sideWeight,
    sleeveWindow,
    halfWidth,
    depth,
    skirt,
    frontWeight,
    localX,
    collarV,
    collarDistance: Math.abs(v - collarV),
  }
}

function surfacePosition(u: number, v: number): Vector3 {
  const clampedU = MathUtils.clamp(u, 0.001, 0.999)
  const clampedV = MathUtils.clamp(v, 0, 1)
  const profile = surfaceProfile(clampedU, clampedV)
  const sideSign = profile.sinTheta < 0 ? -1 : 1
  const sleeveReach = 1.65 * profile.sideWeight * profile.sleeveWindow

  let x = profile.halfWidth * profile.sinTheta + sideSign * sleeveReach
  let y = ROBE_TOP - ROBE_HEIGHT * clampedV
  let z = profile.depth * profile.cosTheta *
    (1 - 0.18 * profile.sideWeight * profile.sleeveWindow)

  // Round-robed sleeves fall from the shoulder instead of spreading into
  // horizontal wings. The broad plateau keeps the cuff readable in outline.
  y -= sleeveReach * MathUtils.lerp(
    0.22,
    0.36,
    smoothStep(0.08, 0.4, clampedV),
  )

  // Pull nearby samples toward a shallow U-shaped ridge. This keeps the
  // collar position and its finite-difference normal on the same surface.
  const collarRidge = Math.exp(
    -(profile.collarDistance * profile.collarDistance) / 0.00072,
  ) * profile.frontWeight * (1 - smoothStep(0.79, 0.9, Math.abs(profile.localX)))
  const collarY = ROBE_TOP - ROBE_HEIGHT * profile.collarV
  y = MathUtils.lerp(y, collarY, collarRidge * 0.82)
  z += collarRidge * 0.2

  // Recess the area inside the U so the neckline remains legible without an
  // opaque cloth mesh covering any character.
  const neckOpening = (1 - smoothStep(
    profile.collarV - 0.012,
    profile.collarV + 0.018,
    clampedV,
  )) * profile.frontWeight * (1 - smoothStep(0.58, 0.82, Math.abs(profile.localX)))
  z -= neckOpening * 0.3

  // A narrow raised belt separates the fitted upper body from the long robe.
  const beltBand = Math.exp(-Math.pow((clampedV - 0.47) / 0.038, 2))
  const beltLift = 0.07 * beltBand
  x += profile.sinTheta * beltLift
  z += profile.cosTheta * beltLift

  // Subtle front-only ridges let the existing vertical character connections
  // read as restrained skirt pleats rather than a flared fishtail.
  z += 0.035 * profile.frontWeight * profile.skirt * Math.cos(profile.localX * 7.5)

  return new Vector3(x, y, z)
}

function classifyRegion(u: number, v: number): GarmentRegion {
  const profile = surfaceProfile(u, v)

  if (
    v < 0.23 &&
    Math.abs(profile.localX) < 0.84 &&
    profile.frontWeight > 0.26 &&
    profile.collarDistance < 0.034
  ) return 'collar'
  if (v >= 0.435 && v <= 0.505) return 'waist'
  if (v < 0.455 && profile.sideWeight > 0.32 && profile.sleeveWindow > 0.12) {
    return profile.sinTheta < 0 ? 'left-sleeve' : 'right-sleeve'
  }
  if (v > 0.52) return 'hem'
  return profile.cosTheta < 0 ? 'back' : 'front'
}

export function sampleGarmentSurface(u: number, v: number): GarmentSurfaceSample {
  const position = surfacePosition(u, v)
  const region = classifyRegion(u, v)

  return {
    position,
    region,
  }
}

export function sampleRoundCollar(u: number, bandOffset = 0): Vector3 {
  const clampedU = MathUtils.clamp(u, 0.001, 0.999)
  let v = 0.12
  for (let iteration = 0; iteration < 4; iteration += 1) {
    v = MathUtils.clamp(surfaceProfile(clampedU, v).collarV + bandOffset, 0, 1)
  }
  return surfacePosition(clampedU, v)
}

export function sampleGenerationSurface(
  style: GenerationStyle,
  u: number,
  v: number,
): GarmentSurfaceSample {
  if (style === 'humanUpperBody') return sampleHumanFigureSurface(u, v)
  return sampleGarmentSurface(u, v)
}

function surfacePositionForStyle(style: GenerationStyle, u: number, v: number): Vector3 {
  if (style === 'humanUpperBody') return humanFigureSurfacePosition(u, v)
  return surfacePosition(u, v)
}

function surfaceQuaternion(style: GenerationStyle, u: number, v: number): Quaternion {
  const epsilon = 0.0025
  const left = surfacePositionForStyle(style, u - epsilon, v)
  const right = surfacePositionForStyle(style, u + epsilon, v)
  const above = surfacePositionForStyle(style, u, v - epsilon)
  const below = surfacePositionForStyle(style, u, v + epsilon)

  const tangentX = right.sub(left).normalize()
  const tangentY = above.sub(below).normalize()
  const normal = new Vector3().crossVectors(tangentX, tangentY).normalize()
  tangentY.crossVectors(normal, tangentX).normalize()

  const basis = new Matrix4().makeBasis(tangentX, tangentY, normal)
  return new Quaternion().setFromRotationMatrix(basis)
}

function gridUnit(value: number, start: number, count: number): number {
  if (count <= 1) return 0.5
  return (value - start + 0.5) / count
}

function buildEdges(grid: PoetryGrid): CharacterEdge[] {
  const at = new Map<string, number>()
  for (const character of grid.characters) {
    at.set(`${character.row}:${character.col}`, character.index)
  }

  const edges: CharacterEdge[] = []
  for (const character of grid.characters) {
    const right = at.get(`${character.row}:${character.col + 1}`)
    const below = at.get(`${character.row + 1}:${character.col}`)
    if (right !== undefined) edges.push({ from: character.index, to: right })
    if (below !== undefined) edges.push({ from: character.index, to: below })
  }
  return edges
}

function targetScaleForRegion(region: GarmentRegion, targetScale: number): number {
  if (region === 'collar') return targetScale * 1.26
  if (region === 'waist') return targetScale * 1.06
  if (region === 'cap' || region === 'face' || region === 'neck') return targetScale * 0.9
  if (region === 'left-hand' || region === 'right-hand') return targetScale * 0.84
  return targetScale
}

export function createGarmentMapping(
  grid: PoetryGrid,
  style: GenerationStyle = 'roundCollarRobe',
): GarmentMapping {
  const horizontalSpacing = 9.4 / Math.max(grid.colCount - 1, 1)
  const verticalSpacing = 7.6 / Math.max(grid.rowCount - 1, 1)
  const sourceSpacing = MathUtils.clamp(Math.min(horizontalSpacing, verticalSpacing), 0.045, 0.54)
  const sourceScale = sourceSpacing * 0.98
  const targetScale = MathUtils.clamp(
    Math.min(7.1 / Math.max(grid.rowCount, 1), 12 / Math.max(grid.colCount, 1)) * 1.16,
    0.055,
    0.43,
  )
  const centerRow = (grid.rowStart + grid.rowEnd) / 2
  const centerCol = (grid.colStart + grid.colEnd) / 2
  const curlRadius = Math.max(1.6, (grid.colCount * sourceSpacing) / (Math.PI * 1.7))

  const poses = grid.characters.map<CharacterPose>((character) => {
    const u = gridUnit(character.col, grid.colStart, grid.colCount)
    const v = gridUnit(character.row, grid.rowStart, grid.rowCount)
    const sourcePosition = new Vector3(
      (character.col - centerCol) * sourceSpacing,
      (centerRow - character.row) * sourceSpacing,
      0,
    )
    const normalizedColumn = grid.colCount <= 1
      ? 0
      : (character.col - centerCol) / Math.max(grid.colCount - 1, 1)
    const curlAngle = normalizedColumn * Math.PI * 1.28
    const curlPosition = new Vector3(
      Math.sin(curlAngle) * curlRadius,
      sourcePosition.y,
      curlRadius * (1 - Math.cos(curlAngle)),
    )
    const target = sampleGenerationSurface(style, u, v)

    return {
      id: character.id,
      index: character.index,
      char: character.char,
      region: target.region,
      sourcePosition,
      curlPosition,
      targetPosition: target.position,
      sourceQuaternion: new Quaternion(),
      curlQuaternion: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), curlAngle),
      targetQuaternion: surfaceQuaternion(style, u, v),
      sourceScale,
      targetScale: targetScaleForRegion(target.region, targetScale),
    }
  })

  return {
    poses,
    edges: buildEdges(grid),
    sourceSpacing,
    targetScale,
  }
}
