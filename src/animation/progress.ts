import { MathUtils, Quaternion, Vector3 } from 'three'
import type { CharacterPose } from '../geometry/garmentMapping'

export const ANIMATION_DURATION_MS = 12_000

export type AnimationStage = 'matrix' | 'curl' | 'weave' | 'reveal'

export interface SampledPose {
  position: Vector3
  quaternion: Quaternion
  scale: number
}

const MATRIX_END = 2 / 12
const CURL_END = 5 / 12
const WEAVE_END = 9 / 12

export function easeInOutCubic(value: number): number {
  const t = MathUtils.clamp(value, 0, 1)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function stageAtProgress(progress: number): AnimationStage {
  if (progress < MATRIX_END) return 'matrix'
  if (progress < CURL_END) return 'curl'
  if (progress < WEAVE_END) return 'weave'
  return 'reveal'
}

export function sampleCharacterPose(
  pose: CharacterPose,
  progress: number,
  output: SampledPose,
): SampledPose {
  const normalized = MathUtils.clamp(progress, 0, 1)

  if (normalized <= MATRIX_END) {
    output.position.copy(pose.sourcePosition)
    output.quaternion.copy(pose.sourceQuaternion)
    output.scale = pose.sourceScale
    return output
  }

  if (normalized <= CURL_END) {
    const local = easeInOutCubic((normalized - MATRIX_END) / (CURL_END - MATRIX_END))
    output.position.copy(pose.sourcePosition).lerp(pose.curlPosition, local)
    output.quaternion.copy(pose.sourceQuaternion).slerp(pose.curlQuaternion, local)
    output.scale = MathUtils.lerp(pose.sourceScale, (pose.sourceScale + pose.targetScale) / 2, local)
    return output
  }

  if (normalized <= WEAVE_END) {
    const local = easeInOutCubic((normalized - CURL_END) / (WEAVE_END - CURL_END))
    output.position.copy(pose.curlPosition).lerp(pose.targetPosition, local)
    output.quaternion.copy(pose.curlQuaternion).slerp(pose.targetQuaternion, local)
    output.scale = MathUtils.lerp((pose.sourceScale + pose.targetScale) / 2, pose.targetScale, local)
    return output
  }

  output.position.copy(pose.targetPosition)
  output.quaternion.copy(pose.targetQuaternion)
  output.scale = pose.targetScale
  return output
}

export function revealOrbitProgress(progress: number): number {
  if (progress <= WEAVE_END) return 0
  return easeInOutCubic((MathUtils.clamp(progress, 0, 1) - WEAVE_END) / (1 - WEAVE_END))
}
