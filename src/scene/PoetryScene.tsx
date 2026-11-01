import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { MathUtils } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { GenerationStyle, PoetryGrid } from '../types/poetry'
import { createGarmentMapping } from '../geometry/garmentMapping'
import {
  createGlyphPageRenderData,
  createLineRenderData,
  type GlyphPageRenderData,
  type LineRenderData,
} from '../rendering/createGeometry'
import {
  createGlyphAtlas,
  disposeGlyphAtlas,
  type GlyphAtlasBundle,
} from '../rendering/glyphAtlas'
import {
  createRobeGuideRenderData,
  type RobeGuideRenderData,
} from '../rendering/robeGuides'
import { revealOrbitProgress } from '../animation/progress'

export interface ProgressReference {
  current: number
}

interface PoetrySceneProps {
  grid: PoetryGrid
  style: GenerationStyle
  progressRef: ProgressReference
  resetSignal: number
  onSceneError?: (message: string) => void
}

interface GlyphNetworkProps {
  grid: PoetryGrid
  style: GenerationStyle
  progressRef: ProgressReference
  onSceneError?: (message: string) => void
}

interface RenderBundle {
  pages: GlyphPageRenderData[]
  lines: LineRenderData
  guides: RobeGuideRenderData
}

const CAMERA_VIEWS: Record<GenerationStyle, { radius: number; cameraY: number; targetY: number }> = {
  roundCollarRobe: { radius: 14, cameraY: 0, targetY: -0.6 },
  humanUpperBody: { radius: 15.5, cameraY: 0.15, targetY: -0.25 },
}

function GlyphNetwork({ grid, style, progressRef, onSceneError }: GlyphNetworkProps) {
  const gl = useThree((state) => state.gl)
  const mapping = useMemo(() => createGarmentMapping(grid, style), [grid, style])
  const [atlas, setAtlas] = useState<GlyphAtlasBundle | null>(null)

  useEffect(() => {
    let disposed = false
    let createdAtlas: GlyphAtlasBundle | null = null

    const prepare = async () => {
      try {
        await document.fonts.ready
        if (disposed) return
        createdAtlas = createGlyphAtlas(
          mapping.poses.map((pose) => pose.char),
          gl.capabilities.maxTextureSize,
        )
        const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
        createdAtlas.pages.forEach((page) => {
          page.texture.anisotropy = anisotropy
          page.texture.needsUpdate = true
        })
        if (!disposed) setAtlas(createdAtlas)
      } catch (error) {
        const message = error instanceof Error ? error.message : '字形图集创建失败。'
        onSceneError?.(message)
      }
    }

    void prepare()
    return () => {
      disposed = true
      if (createdAtlas) disposeGlyphAtlas(createdAtlas)
    }
  }, [gl, mapping, onSceneError])

  const renderBundle = useMemo<RenderBundle | null>(() => {
    if (!atlas) return null
    return {
      pages: atlas.pages.map((_, pageIndex) =>
        createGlyphPageRenderData(mapping, atlas, pageIndex),
      ),
      lines: createLineRenderData(mapping),
      guides: createRobeGuideRenderData(style),
    }
  }, [atlas, mapping])

  useEffect(() => () => {
    if (!renderBundle) return
    renderBundle.pages.forEach((page) => {
      page.geometry.dispose()
      page.material.dispose()
    })
    renderBundle.lines.geometry.dispose()
    renderBundle.lines.material.dispose()
    renderBundle.guides.geometry.dispose()
    renderBundle.guides.material.dispose()
  }, [renderBundle])

  useFrame(() => {
    if (!renderBundle) return
    const progress = progressRef.current
    renderBundle.pages.forEach((page) => {
      page.material.uniforms.uProgress.value = progress
    })
    renderBundle.lines.material.uniforms.uProgress.value = progress
    const reveal = MathUtils.clamp((progress - 0.48) / 0.24, 0, 1)
    renderBundle.guides.material.opacity = 0.36 * reveal * reveal * (3 - 2 * reveal)
  })

  if (!renderBundle) return null

  return (
    <group>
      <lineSegments
        geometry={renderBundle.lines.geometry}
        material={renderBundle.lines.material}
        frustumCulled={false}
        renderOrder={0}
      />
      <lineSegments
        geometry={renderBundle.guides.geometry}
        material={renderBundle.guides.material}
        frustumCulled={false}
        renderOrder={0.5}
      />
      {renderBundle.pages.map((page, pageIndex) => (
        <mesh
          key={pageIndex}
          geometry={page.geometry}
          material={page.material}
          frustumCulled={false}
          renderOrder={1}
        />
      ))}
    </group>
  )
}

interface CameraControlsProps {
  style: GenerationStyle
  progressRef: ProgressReference
  resetSignal: number
}

function CameraControls({ style, progressRef, resetSignal }: CameraControlsProps) {
  const camera = useThree((state) => state.camera)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const view = CAMERA_VIEWS[style]

  useEffect(() => {
    camera.position.set(0, view.cameraY, view.radius)
    camera.lookAt(0, view.targetY, 0)
    if (controlsRef.current) {
      controlsRef.current.target.set(0, view.targetY, 0)
      controlsRef.current.update()
    }
  }, [camera, resetSignal, style, view.cameraY, view.radius, view.targetY])

  useFrame(() => {
    const progress = progressRef.current
    const controls = controlsRef.current
    if (!controls) return

    if (progress < 0.9999) {
      controls.enabled = false
      const orbit = revealOrbitProgress(progress)
      if (orbit > 0) {
        const azimuth = orbit * Math.PI * 0.34
        camera.position.set(
          Math.sin(azimuth) * view.radius,
          view.cameraY,
          Math.cos(azimuth) * view.radius,
        )
        camera.lookAt(0, view.targetY, 0)
      }
    } else {
      controls.enabled = true
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={false}
      enableDamping
      dampingFactor={0.075}
      minDistance={6.5}
      maxDistance={24}
      minPolarAngle={Math.PI * 0.16}
      maxPolarAngle={Math.PI * 0.84}
      zoomSpeed={0.75}
      rotateSpeed={0.62}
      panSpeed={0.65}
      target={[0, view.targetY, 0]}
    />
  )
}

function GroundGlow() {
  return (
    <mesh position={[0, -4.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[4.8, 64]} />
      <meshBasicMaterial color="#bca273" transparent opacity={0.055} depthWrite={false} />
    </mesh>
  )
}

export function PoetryScene({
  grid,
  style,
  progressRef,
  resetSignal,
  onSceneError,
}: PoetrySceneProps) {
  const view = CAMERA_VIEWS[style]

  return (
    <Canvas
      className="poetry-canvas"
      camera={{ position: [0, view.cameraY, view.radius], fov: 38, near: 0.1, far: 80 }}
      dpr={[1, 1.65]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      }}
      onCreated={({ gl }) => {
        gl.setClearAlpha(0)
      }}
      onPointerMissed={() => undefined}
    >
      <Suspense fallback={null}>
        <GlyphNetwork grid={grid} style={style} progressRef={progressRef} onSceneError={onSceneError} />
        <GroundGlow />
        <CameraControls style={style} progressRef={progressRef} resetSignal={resetSignal} />
      </Suspense>
    </Canvas>
  )
}
