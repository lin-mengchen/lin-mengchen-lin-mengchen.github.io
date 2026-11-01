import { describe, expect, it } from 'vitest'
import {
  humanFigurePleatPosition,
  humanFigureSurfacePosition,
  sampleHumanFigureSurface,
  sampleHumanRoundCollar,
} from './humanFigureMapping'

describe('Ming round-collar robe worn on the figure', () => {
  it('reads as 幞头, blank face and neck from the crown down', () => {
    expect(sampleHumanFigureSurface(0.5, 0.02).region).toBe('cap')
    expect(sampleHumanFigureSurface(0.5, 0.11).region).toBe('face')
    expect(sampleHumanFigureSurface(0.5, 0.17).region).toBe('neck')

    // The hat is wider than the jaw, and the neck is the narrowest link
    // between the head and the shoulders.
    const hat = sampleHumanFigureSurface(0.25, 0.05).position
    const jaw = sampleHumanFigureSurface(0.25, 0.14).position
    const neck = sampleHumanFigureSurface(0.25, 0.18).position
    expect(Math.abs(hat.x)).toBeGreaterThan(Math.abs(jaw.x) - 0.02)
    expect(Math.abs(neck.x)).toBeLessThan(Math.abs(jaw.x))
  })

  it('forms a mirrored U-shaped collar piping that dips at the centre front', () => {
    const left = sampleHumanRoundCollar(0.4)
    const right = sampleHumanRoundCollar(0.6)
    const centre = sampleHumanRoundCollar(0.5)

    expect(left.x).toBeCloseTo(-right.x, 6)
    expect(left.y).toBeCloseTo(right.y, 6)
    expect(centre.y).toBeLessThan(left.y - 0.1)

    expect(sampleHumanFigureSurface(0.5, 0.22).region).toBe('collar')
  })

  it('hangs the sleeves out and well below the belt', () => {
    const cuff = sampleHumanFigureSurface(0.25, 0.42)
    const shoulder = sampleHumanFigureSurface(0.25, 0.21)

    expect(cuff.region).toBe('left-sleeve')
    expect(cuff.position.x).toBeLessThan(-2)
    expect(cuff.position.y).toBeLessThan(shoulder.position.y - 1.4)

    const rightCuff = sampleHumanFigureSurface(0.75, 0.42)
    expect(rightCuff.region).toBe('right-sleeve')
    expect(rightCuff.position.x).toBeGreaterThan(1.9)
  })

  it('closes a fist just past the cuff and rests the other hand on the belt', () => {
    expect(sampleHumanFigureSurface(0.25, 0.3).region).toBe('left-hand')
    expect(sampleHumanFigureSurface(0.25, 0.3).position.x).toBeLessThan(-2.4)

    const hand = sampleHumanFigureSurface(0.62, 0.454)
    expect(hand.region).toBe('right-hand')
    expect(hand.position.z).toBeGreaterThan(0.45)
  })

  it('keeps the belt band continuous across the front', () => {
    expect(sampleHumanFigureSurface(0.5, 0.454).region).toBe('waist')
    expect(sampleHumanFigureSurface(0.38, 0.454).region).toBe('waist')
    expect(sampleHumanFigureSurface(0.5, 0.43).region).toBe('waist')
    expect(sampleHumanFigureSurface(0.5, 0.478).region).toBe('waist')
  })

  it('opens the skirt from the belt into a mirrored A-line hem', () => {
    const waist = humanFigureSurfacePosition(0.35, 0.454)
    const hem = humanFigureSurfacePosition(0.35, 0.95)
    const mirror = humanFigureSurfacePosition(0.65, 0.95)

    expect(sampleHumanFigureSurface(0.35, 0.95).region).toBe('hem')
    expect(Math.abs(hem.x)).toBeGreaterThan(Math.abs(waist.x) * 1.6)
    expect(hem.y).toBeLessThan(waist.y - 3)
    expect(hem.x).toBeCloseTo(-mirror.x, 6)
    expect(hem.z).toBeCloseTo(mirror.z, 6)
  })

  it('resolves the drawn pleat creases back onto the folded surface', () => {
    for (const crease of [-1.366, -0.683, 0.683, 1.366]) {
      const outer = humanFigurePleatPosition(crease, 0.9)
      const inner = humanFigurePleatPosition(crease * 0.5, 0.9)

      expect(outer.toArray().every(Number.isFinite)).toBe(true)
      // A crease drawn further from the centre front lands further from the
      // body, and the fold keeps its sign across the mirrored halves.
      expect(Math.abs(outer.x)).toBeGreaterThan(Math.abs(inner.x))
      expect(Math.sign(outer.x)).toBe(Math.sign(crease))
    }
  })

  it('returns finite coordinates throughout the parameter surface', () => {
    for (let u = 0; u <= 1; u += 0.04) {
      for (let v = 0; v <= 1; v += 0.04) {
        const { position } = sampleHumanFigureSurface(u, v)
        expect(position.toArray().every(Number.isFinite)).toBe(true)
      }
    }
  })
})
