import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
} from 'three'

export interface GlyphUv {
  page: number
  rect: [number, number, number, number]
}

export interface GlyphAtlasPage {
  texture: CanvasTexture
  size: number
  glyphCount: number
}

export interface GlyphAtlasBundle {
  pages: GlyphAtlasPage[]
  lookup: Map<string, GlyphUv>
}

const TILE_SIZE = 72
const MAX_ATLAS_SIZE = 4096

function previousPowerOfTwo(value: number): number {
  return Math.pow(2, Math.floor(Math.log2(Math.max(1, value))))
}

function nextPowerOfTwo(value: number): number {
  return Math.pow(2, Math.ceil(Math.log2(Math.max(1, value))))
}

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values)]
}

export function createGlyphAtlas(
  glyphs: string[],
  maxTextureSize: number,
): GlyphAtlasBundle {
  const uniqueGlyphs = uniqueInOrder(glyphs)
  const largestPageSize = Math.max(
    512,
    Math.min(MAX_ATLAS_SIZE, previousPowerOfTwo(maxTextureSize)),
  )
  const maxColumns = Math.floor(largestPageSize / TILE_SIZE)
  const pageCapacity = Math.max(1, maxColumns * maxColumns)
  const pages: GlyphAtlasPage[] = []
  const lookup = new Map<string, GlyphUv>()

  for (let offset = 0; offset < uniqueGlyphs.length; offset += pageCapacity) {
    const pageGlyphs = uniqueGlyphs.slice(offset, offset + pageCapacity)
    const columnsNeeded = Math.ceil(Math.sqrt(pageGlyphs.length))
    const atlasSize = Math.min(
      largestPageSize,
      Math.max(512, nextPowerOfTwo(columnsNeeded * TILE_SIZE)),
    )
    const columns = Math.floor(atlasSize / TILE_SIZE)
    const canvas = document.createElement('canvas')
    canvas.width = atlasSize
    canvas.height = atlasSize
    const context = canvas.getContext('2d', { alpha: true })

    if (!context) {
      throw new Error('浏览器无法创建字形图集画布。')
    }

    context.clearRect(0, 0, atlasSize, atlasSize)
    context.fillStyle = '#ffffff'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '54px "STXingkai", "STKaiti", "KaiTi", "FangSong", "Noto Serif CJK SC", "Source Han Serif SC", serif'

    const pageIndex = pages.length
    pageGlyphs.forEach((glyph, index) => {
      const col = index % columns
      const row = Math.floor(index / columns)
      const x = col * TILE_SIZE
      const y = row * TILE_SIZE
      context.fillText(glyph, x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 2)

      const halfTexel = 0.5
      lookup.set(glyph, {
        page: pageIndex,
        rect: [
          (x + halfTexel) / atlasSize,
          1 - (y + TILE_SIZE - halfTexel) / atlasSize,
          (TILE_SIZE - 1) / atlasSize,
          (TILE_SIZE - 1) / atlasSize,
        ],
      })
    })

    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.minFilter = LinearMipmapLinearFilter
    texture.magFilter = LinearFilter
    texture.generateMipmaps = true
    texture.needsUpdate = true
    texture.name = `诗衣字形图集-${pageIndex + 1}`
    pages.push({ texture, size: atlasSize, glyphCount: pageGlyphs.length })
  }

  return { pages, lookup }
}

export function disposeGlyphAtlas(atlas: GlyphAtlasBundle): void {
  atlas.pages.forEach((page) => page.texture.dispose())
}
