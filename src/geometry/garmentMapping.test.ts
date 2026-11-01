import { describe, expect, it } from 'vitest'
import { sampleGarmentSurface } from './garmentMapping'

describe('Ming round-collar robe surface', () => {
  it('forms a mirrored U-shaped collar instead of crossed lapels', () => {
    const center = sampleGarmentSurface(0.5, 0.174)
    const left = sampleGarmentSurface(0.43, 0.105)
    const right = sampleGarmentSurface(0.57, 0.105)

    expect(center.region).toBe('collar')
    expect(left.region).toBe('collar')
    expect(right.region).toBe('collar')
    expect(left.position.x).toBeCloseTo(-right.position.x, 5)
    expect(left.position.y).toBeCloseTo(right.position.y, 5)
    expect(center.position.y).toBeLessThan(left.position.y - 0.4)
  })

  it('keeps the belt continuous around the body', () => {
    expect(sampleGarmentSurface(0.5, 0.47).region).toBe('waist')
    expect(sampleGarmentSurface(0.75, 0.47).region).toBe('waist')
    expect(sampleGarmentSurface(0.01, 0.47).region).toBe('waist')
  })

  it('uses restrained, downward sleeves rather than horizontal wings', () => {
    const left = sampleGarmentSurface(0.25, 0.22)
    const right = sampleGarmentSurface(0.75, 0.22)
    const shoulder = sampleGarmentSurface(0.75, 0.06)

    expect(left.region).toBe('left-sleeve')
    expect(right.region).toBe('right-sleeve')
    expect(left.position.x).toBeCloseTo(-right.position.x, 5)
    expect(Math.abs(right.position.x)).toBeGreaterThan(3)
    expect(Math.abs(right.position.x)).toBeLessThan(4.2)
    expect(right.position.y).toBeLessThan(shoulder.position.y - 1)
  })

  it('ends in a long, modest A-line hem', () => {
    const waist = sampleGarmentSurface(0.75, 0.47)
    const leftHem = sampleGarmentSurface(0.25, 0.96)
    const rightHem = sampleGarmentSurface(0.75, 0.96)

    expect(leftHem.region).toBe('hem')
    expect(rightHem.region).toBe('hem')
    expect(leftHem.position.x).toBeCloseTo(-rightHem.position.x, 5)
    expect(Math.abs(rightHem.position.x)).toBeGreaterThan(Math.abs(waist.position.x) * 1.4)
    expect(rightHem.position.y).toBeLessThan(waist.position.y - 3)
  })

  it('returns finite coordinates throughout the parameter surface', () => {
    for (let u = 0; u <= 1; u += 0.05) {
      for (let v = 0; v <= 1; v += 0.05) {
        const { position } = sampleGarmentSurface(u, v)
        expect(position.toArray().every(Number.isFinite)).toBe(true)
      }
    }
  })
})
