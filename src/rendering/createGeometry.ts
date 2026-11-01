import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  Sphere,
  Vector3,
} from 'three'
import type { GarmentRegion } from '../types/poetry'
import type { GarmentMapping } from '../geometry/garmentMapping'
import type { GlyphAtlasBundle } from './glyphAtlas'
import {
  glyphFragmentShader,
  glyphVertexShader,
  lineFragmentShader,
  lineVertexShader,
} from './shaders'

export interface GlyphPageRenderData {
  geometry: InstancedBufferGeometry
  material: ShaderMaterial
  count: number
}

export interface LineRenderData {
  geometry: BufferGeometry
  material: ShaderMaterial
}

const REGION_COLORS: Record<GarmentRegion, Color> = {
  cap: new Color('#4a4033'),
  face: new Color('#3a342c'),
  neck: new Color('#473b2d'),
  collar: new Color('#b68a42'),
  front: new Color('#171713'),
  back: new Color('#292720'),
  'left-sleeve': new Color('#201e19'),
  'right-sleeve': new Color('#201e19'),
  'left-hand': new Color('#705331'),
  'right-hand': new Color('#705331'),
  waist: new Color('#8b6938'),
  hem: new Color('#242119'),
}

function sourceHalfWidth(mapping: GarmentMapping): number {
  return Math.max(
    0.001,
    ...mapping.poses.map((pose) => Math.abs(pose.sourcePosition.x)),
  )
}

export function createGlyphPageRenderData(
  mapping: GarmentMapping,
  atlas: GlyphAtlasBundle,
  pageIndex: number,
): GlyphPageRenderData {
  const pagePoses = mapping.poses.filter((pose) => atlas.lookup.get(pose.char)?.page === pageIndex)
  const count = pagePoses.length
  const starts = new Float32Array(count * 3)
  const targets = new Float32Array(count * 3)
  const targetQuaternions = new Float32Array(count * 4)
  const uvRects = new Float32Array(count * 4)
  const tints = new Float32Array(count * 3)
  const scales = new Float32Array(count * 2)

  pagePoses.forEach((pose, index) => {
    const startOffset = index * 3
    const quaternionOffset = index * 4
    const scaleOffset = index * 2
    const glyphUv = atlas.lookup.get(pose.char)
    const tint = REGION_COLORS[pose.region]
    if (!glyphUv) throw new Error(`字形图集缺少“${pose.char}”。`)

    pose.sourcePosition.toArray(starts, startOffset)
    pose.targetPosition.toArray(targets, startOffset)
    pose.targetQuaternion.toArray(targetQuaternions, quaternionOffset)
    uvRects.set(glyphUv.rect, quaternionOffset)
    tint.toArray(tints, startOffset)
    scales.set([pose.sourceScale, pose.targetScale], scaleOffset)
  })

  const base = new PlaneGeometry(1, 1, 1, 1)
  const geometry = new InstancedBufferGeometry()
  geometry.index = base.index?.clone() ?? null
  geometry.setAttribute('position', base.getAttribute('position').clone())
  geometry.setAttribute('uv', base.getAttribute('uv').clone())
  geometry.setAttribute('iStart', new InstancedBufferAttribute(starts, 3))
  geometry.setAttribute('iTarget', new InstancedBufferAttribute(targets, 3))
  geometry.setAttribute('iTargetQ', new InstancedBufferAttribute(targetQuaternions, 4))
  geometry.setAttribute('iUvRect', new InstancedBufferAttribute(uvRects, 4))
  geometry.setAttribute('iTint', new InstancedBufferAttribute(tints, 3))
  geometry.setAttribute('iScale', new InstancedBufferAttribute(scales, 2))
  geometry.instanceCount = count
  geometry.boundingSphere = new Sphere(new Vector3(0, -0.3, 0), 18)
  base.dispose()

  const material = new ShaderMaterial({
    name: `诗衣文字材质-${pageIndex + 1}`,
    uniforms: {
      uProgress: { value: 0 },
      uHalfWidth: { value: sourceHalfWidth(mapping) },
      uAtlas: { value: atlas.pages[pageIndex].texture },
      uOpacity: { value: 0.96 },
    },
    vertexShader: glyphVertexShader,
    fragmentShader: glyphFragmentShader,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    side: DoubleSide,
    blending: NormalBlending,
  })

  return { geometry, material, count }
}

export function createLineRenderData(mapping: GarmentMapping): LineRenderData {
  const vertexCount = mapping.edges.length * 2
  const starts = new Float32Array(vertexCount * 3)
  const targets = new Float32Array(vertexCount * 3)
  const keeps = new Float32Array(vertexCount)

  mapping.edges.forEach((edge, edgeIndex) => {
    const from = mapping.poses[edge.from]
    const to = mapping.poses[edge.to]
    const offset = edgeIndex * 6
    const keep = from.region === to.region || from.targetPosition.distanceTo(to.targetPosition) < 0.5 ? 1 : 0.15

    from.sourcePosition.toArray(starts, offset)
    to.sourcePosition.toArray(starts, offset + 3)
    from.targetPosition.toArray(targets, offset)
    to.targetPosition.toArray(targets, offset + 3)
    keeps[edgeIndex * 2] = keep
    keeps[edgeIndex * 2 + 1] = keep
  })

  const geometry = new BufferGeometry()
  const sourceAttribute = new BufferAttribute(starts, 3)
  sourceAttribute.setUsage(DynamicDrawUsage)
  geometry.setAttribute('position', sourceAttribute)
  geometry.setAttribute('aTarget', new BufferAttribute(targets, 3))
  geometry.setAttribute('aKeep', new BufferAttribute(keeps, 1))
  geometry.boundingSphere = new Sphere(new Vector3(0, -0.3, 0), 18)

  const material = new ShaderMaterial({
    name: '诗衣经纬连接线材质',
    uniforms: {
      uProgress: { value: 0 },
      uHalfWidth: { value: sourceHalfWidth(mapping) },
      uLineColor: { value: new Color('#a78145') },
    },
    vertexShader: lineVertexShader,
    fragmentShader: lineFragmentShader,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: NormalBlending,
  })

  return { geometry, material }
}
