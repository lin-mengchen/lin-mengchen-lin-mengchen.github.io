import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { CharacterPose } from '../geometry/garmentMapping'
import { sampleCharacterPose, stageAtProgress, type SampledPose } from './progress'

const pose: CharacterPose = {
  id: 'Sheet1!R1C1',
  index: 0,
  char: '诗',
  region: 'front',
  sourcePosition: new Vector3(0, 1, 0),
  curlPosition: new Vector3(1, 1, 1),
  targetPosition: new Vector3(2, -1, 0.5),
  sourceQuaternion: new Quaternion(),
  curlQuaternion: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.5),
  targetQuaternion: new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1),
  sourceScale: 0.2,
  targetScale: 0.4,
}

function output(): SampledPose {
  return { position: new Vector3(), quaternion: new Quaternion(), scale: 0 }
}

describe('animation progress', () => {
  it('matches the four required stage boundaries', () => {
    expect(stageAtProgress(0)).toBe('matrix')
    expect(stageAtProgress(2 / 12)).toBe('curl')
    expect(stageAtProgress(5 / 12)).toBe('weave')
    expect(stageAtProgress(9 / 12)).toBe('reveal')
  })

  it('is reconstructed exactly from progress without accumulated state', () => {
    const start = sampleCharacterPose(pose, 2 / 12, output())
    const curl = sampleCharacterPose(pose, 5 / 12, output())
    const target = sampleCharacterPose(pose, 9 / 12, output())
    const repeated = sampleCharacterPose(pose, 9 / 12, output())

    expect(start.position.toArray()).toEqual(pose.sourcePosition.toArray())
    expect(curl.position.toArray()).toEqual(pose.curlPosition.toArray())
    expect(target.position.toArray()).toEqual(pose.targetPosition.toArray())
    expect(repeated.position.toArray()).toEqual(target.position.toArray())
    expect(Math.abs(target.quaternion.length() - 1)).toBeLessThan(1e-6)
  })
})
