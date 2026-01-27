import { promises } from 'fs'
import { join } from 'path'

import test from 'ava'
import jimp from 'jimp-compact'

import { Resvg } from '../index'

const svgPath1 = join(__dirname, '../example/bbox.svg')
const svgPath2 = join(__dirname, '../example/bbox2.svg')

test('should handle cropByBBox with various padding values', async (t) => {
  const svg = await promises.readFile(svgPath2)

  const opts = {
    fitTo: {
      mode: 'width',
      value: 768,
    },
    background: '#fff',
    font: {
      loadSystemFonts: false,
    },
  }

  // Test a range of padding values
  for (let padding = -20; padding <= 600; padding++) {
    const resvg = new Resvg(svg, opts)

    const bbox = resvg.getBBox()
    t.truthy(bbox, `BBox should exist for padding=${padding}`)

    if (bbox) {
      // This should not panic or throw
      resvg.cropByBBox(bbox, padding, true)

      // This should render successfully
      const pngData = resvg.render()

      // Verify output dimensions are reasonable
      t.true(pngData.width > 0, `PNG width should be positive for padding=${padding}`)
      t.true(pngData.height > 0, `PNG height should be positive for padding=${padding}`)

      // Verify PNG size matches expected dimensions
      t.is(pngData.width, 768, `PNG width should match fitTo value for padding=${padding}`)
      t.is(pngData.width, pngData.height, `PNG should be square for padding=${padding}`)
    }
  }
})

test('should treat null/undefined/NaN padding as 0 for cropByBBox', (t) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <rect x="10" y="10" width="180" height="80" fill="green" />
</svg>`

  const opts = {
    fitTo: {
      mode: 'width',
      value: 120,
    },
    background: '#fff',
    font: {
      loadSystemFonts: false,
    },
  }

  const baseline = new Resvg(svg, opts)
  const baselineBBox = baseline.getBBox()
  t.truthy(baselineBBox, 'BBox should exist for baseline padding')
  if (baselineBBox) {
    baseline.cropByBBox(baselineBBox, 0, true)
  }
  const baselinePng = baseline.render()

  const resvgNull = new Resvg(svg, opts)
  const bboxNull = resvgNull.getBBox()
  t.truthy(bboxNull, 'BBox should exist for null padding')
  if (bboxNull) {
    resvgNull.cropByBBox(bboxNull, null as unknown as number, true)
  }
  const pngNull = resvgNull.render()

  const resvgUndefined = new Resvg(svg, opts)
  const bboxUndefined = resvgUndefined.getBBox()
  t.truthy(bboxUndefined, 'BBox should exist for undefined padding')
  if (bboxUndefined) {
    resvgUndefined.cropByBBox(bboxUndefined, undefined, true)
  }
  const pngUndefined = resvgUndefined.render()

  const resvgNaN = new Resvg(svg, opts)
  const bboxNaN = resvgNaN.getBBox()
  t.truthy(bboxNaN, 'BBox should exist for NaN padding')
  if (bboxNaN) {
    resvgNaN.cropByBBox(bboxNaN, Number.NaN, true)
  }
  const pngNaN = resvgNaN.render()

  t.is(pngNull.width, baselinePng.width, 'Null padding should match zero padding width')
  t.is(pngNull.height, baselinePng.height, 'Null padding should match zero padding height')
  t.is(pngUndefined.width, baselinePng.width, 'Undefined padding should match zero padding width')
  t.is(pngUndefined.height, baselinePng.height, 'Undefined padding should match zero padding height')
  t.is(pngNaN.width, baselinePng.width, 'NaN padding should match zero padding width')
  t.is(pngNaN.height, baselinePng.height, 'NaN padding should match zero padding height')
})

test('should treat negative padding as 0 for cropByBBox', async (t) => {
  const svg = await promises.readFile(svgPath1)

  const opts = {
    fitTo: {
      mode: 'width',
      value: 768,
    },
    background: '#fff',
    font: {
      loadSystemFonts: false,
    },
  }

  const resvgNegative = new Resvg(svg, opts)
  const bboxNegative = resvgNegative.getBBox()
  t.truthy(bboxNegative, 'BBox should exist for negative padding test')
  if (bboxNegative) {
    resvgNegative.cropByBBox(bboxNegative, -10, true)
  }
  const pngNegative = resvgNegative.render()

  const resvgZero = new Resvg(svg, opts)
  const bboxZero = resvgZero.getBBox()
  t.truthy(bboxZero, 'BBox should exist for zero padding test')
  if (bboxZero) {
    resvgZero.cropByBBox(bboxZero, 0, true)
  }
  const pngZero = resvgZero.render()

  t.is(pngNegative.width, pngZero.width, 'Negative padding should match zero padding width')
  t.is(pngNegative.height, pngZero.height, 'Negative padding should match zero padding height')
  t.is(pngNegative.width, pngNegative.height, 'Negative padding output should be square')
})

test('should handle cropByBBox with fitTo height', async (t) => {
  const svg = await promises.readFile(svgPath1)

  const opts = {
    fitTo: {
      mode: 'height',
      value: 512,
    },
    background: '#fff',
    font: {
      loadSystemFonts: false,
    },
  }

  const resvg = new Resvg(svg, opts)
  const bbox = resvg.getBBox()
  t.truthy(bbox, 'BBox should exist for fitTo height test')
  if (bbox) {
    resvg.cropByBBox(bbox, 20, true)
  }

  const pngData = resvg.render()
  t.true(pngData.width > 0, 'PNG width should be positive for fitTo height')
  t.true(pngData.height > 0, 'PNG height should be positive for fitTo height')
  t.is(pngData.height, 512, 'PNG height should match fitTo height value')
  t.is(pngData.width, pngData.height, 'PNG should be square for fitTo height')
})

test('should handle cropByBBox with fitTo width as square output', async (t) => {
  const svg = await promises.readFile(svgPath1)

  const opts = {
    fitTo: {
      mode: 'width',
      value: 391,
    },
    background: '#fff',
    font: {
      loadSystemFonts: false,
    },
  }

  const resvg = new Resvg(svg, opts)
  const bbox = resvg.getBBox()
  t.truthy(bbox, 'BBox should exist for fitTo width test')
  if (bbox) {
    resvg.cropByBBox(bbox, 181, true)
  }

  const pngData = resvg.render()
  t.true(pngData.width > 0, 'PNG width should be positive for fitTo width')
  t.true(pngData.height > 0, 'PNG height should be positive for fitTo width')
  t.is(pngData.width, 391, 'PNG width should match fitTo width value')
  t.is(pngData.width, pngData.height, 'PNG should be square for fitTo width')
})

test('should keep height stable with larger padding for fitTo width when not square', (t) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <rect x="20" y="20" width="100" height="50" fill="green" />
  </svg>`
  const paddings = [-10, 0, 10, 20, 40, 60, 80, 100]
  const heights: number[] = []

  for (const padding of paddings) {
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: 'width',
        value: 300,
      },
    })
    const bbox = resvg.getBBox()
    t.truthy(bbox, `BBox should exist for padding=${padding}`)
    if (bbox) {
      resvg.cropByBBox(bbox, padding, false)
    }
    const pngData = resvg.render()
    heights.push(pngData.height)
  }

  t.is(heights[0], heights[heights.length - 1], 'Height should remain unchanged across paddings')
  for (let i = 1; i < heights.length; i++) {
    t.is(heights[i], heights[i - 1], `Height should remain unchanged at index ${i}`)
    t.is(heights[i], 150, `Height should be 150 at index ${i}`)
  }
})

test('should not panic when bbox coordinates are huge and padding empties content', (t) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
  <rect x="1e35" y="1e35" width="1e35" height="1e35" fill="green" />
  </svg>`
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 100,
    },
  })
  const bbox = resvg.getBBox()
  t.truthy(bbox, 'BBox should exist for huge coordinate test')
  if (bbox) {
    resvg.cropByBBox(bbox, 1000, false)
  }
  t.notThrows(() => resvg.render())
})

test('should not panic when passing an oversized bbox manually', (t) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <rect x="0" y="0" width="50" height="50" fill="green" />
  </svg>`
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 150,
    },
  })
  const bbox = resvg.getBBox()
  t.truthy(bbox, 'BBox should exist for oversized bbox test')

  if (!bbox) {
    t.fail('BBox should not be undefined for oversized bbox test')
    return
  }
  bbox.x = 3e38
  bbox.y = 3e38
  bbox.width = 3e38
  bbox.height = 3e38

  t.notThrows(() => resvg.cropByBBox(bbox, 1000, false))
  t.notThrows(() => resvg.render())
})

test('should handle cropByBBox with fitTo zoom', (t) => {
  const bbox_width = 180
  const bbox_height = 80
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <rect x="10" y="10" width="${bbox_width}" height="${bbox_height}" fill="green" />
  </svg>`

  const opts = {
    fitTo: {
      mode: 'zoom',
      value: 0.5,
    },
    background: '#fff',
    font: {
      loadSystemFonts: false,
    },
  }
  // zoom from 0.5 to 2
  for (let zoom_value = 0.5; zoom_value <= 2; zoom_value += 0.5) {
    opts.fitTo.value = zoom_value
    const resvg = new Resvg(svg, opts)
    const bbox = resvg.getBBox()
    t.truthy(bbox, `BBox should exist for fitTo zoom=${zoom_value}`)
    if (bbox) {
      resvg.cropByBBox(bbox, 0, false)
    }

    const pngData = resvg.render()
    t.is(pngData.width, bbox_width * zoom_value)
    t.is(pngData.height, bbox_height * zoom_value)
    t.true(pngData.width > 0, `PNG width should be positive for fitTo zoom=${zoom_value}`)
    t.true(pngData.height > 0, `PNG height should be positive for fitTo zoom=${zoom_value}`)
    t.not(pngData.width, pngData.height)
  }
})

test('should handle cropByBBox with fitTo zoom as square output', (t) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <rect x="10" y="10" width="180" height="80" fill="green" />
  </svg>`

  const opts = {
    fitTo: {
      mode: 'zoom',
      value: 2,
    },
    background: '#fff',
    font: {
      loadSystemFonts: false,
    },
  }

  const resvg = new Resvg(svg, opts)
  const bbox = resvg.getBBox()
  t.truthy(bbox, 'BBox should exist for fitTo zoom square test')
  if (bbox) {
    resvg.cropByBBox(bbox, 0, true)
  }

  const pngData = resvg.render()
  t.is(pngData.width, 360)
  t.is(pngData.height, 360)
  t.is(pngData.width, pngData.height, 'PNG should be square for fitTo zoom')
})
// Old tests
test('should handle invalid padding values for cropByBBox', (t) => {
  const svg = `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
    <rect fill="green" x="50" y="50" width="200" height="200"/>
  </svg>`
  const resvg = new Resvg(svg)
  const bbox = resvg.getBBox()!

  // Invalid values should silently use 0, not throw
  t.notThrows(() => resvg.cropByBBox(bbox, NaN))
  t.notThrows(() => resvg.cropByBBox(bbox, Infinity))
  t.notThrows(() => resvg.cropByBBox(bbox, null as any))
  t.notThrows(() => resvg.cropByBBox(bbox, undefined))
  t.notThrows(() => resvg.cropByBBox(bbox, -10))
  t.notThrows(() => resvg.cropByBBox(bbox, 0))
  t.notThrows(() => resvg.cropByBBox(bbox, -0))

  // padding >= half of dimensions should produce transparent image, not panic
  t.notThrows(() => resvg.cropByBBox(bbox, bbox.width))
})

test('should handle zero/negative bbox dimensions for cropByBBox', (t) => {
  const svg = `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
    <rect fill="green" x="50" y="50" width="200" height="200"/>
  </svg>`
  const resvg = new Resvg(svg)
  const bbox = resvg.getBBox()!

  // These should not panic (validation happens in Rust)
  const zeroBbox = { ...bbox, width: 0 }
  const negativeBbox = { ...bbox, width: -10 }

  // napi-rs may reject invalid BBox objects at type conversion level (InvalidArg)
  // or at Rust validation level (silently ignored). Both are acceptable.
  try {
    resvg.cropByBBox(zeroBbox as any)
    t.pass('Zero width bbox handled without panic')
  } catch (e: any) {
    t.true(e.code === 'InvalidArg', 'Zero width bbox rejected at type level')
  }

  try {
    resvg.cropByBBox(negativeBbox as any)
    t.pass('Negative width bbox handled without panic')
  } catch (e: any) {
    t.true(e.code === 'InvalidArg', 'Negative width bbox rejected at type level')
  }
})

test('should handle zero/negative bbox dimensions for cropByBBox with fitTo', (t) => {
  const svg = `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
    <rect fill="green" x="50" y="50" width="200" height="200"/>
  </svg>`
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 500 } })
  const bbox = resvg.getBBox()!

  // Modify bbox to have zero/negative dimensions
  const zeroBbox = { ...bbox, width: 0 }
  const negativeBbox = { ...bbox, width: -10 }

  // These should not panic with fitTo option
  try {
    resvg.cropByBBox(zeroBbox as any)
    t.pass('Zero width bbox with fitTo handled without panic')
  } catch (e: any) {
    t.true(e.code === 'InvalidArg', 'Zero width bbox rejected at type level')
  }

  try {
    resvg.cropByBBox(negativeBbox as any)
    t.pass('Negative width bbox with fitTo handled without panic')
  } catch (e: any) {
    t.true(e.code === 'InvalidArg', 'Negative width bbox rejected at type level')
  }
})

test('should get svg bbox(rect) and cropByBBox', async (t) => {
  const svg = `<svg width="300px" height="300px" viewBox="0 0 300 300" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <rect fill="#5283E8" x="50.4" y="60.8" width="200" height="100"></rect>
</svg>`

  const resvg = new Resvg(svg)
  const bbox = resvg.getBBox()
  t.not(bbox, undefined)
  if (bbox) {
    resvg.cropByBBox(bbox)
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()
    const result = await jimp.read(pngBuffer)

    t.is(bbox.width, 200)
    t.is(bbox.height, 100)
    t.is(bbox.x, 50.400001525878906)
    t.is(bbox.y, 60.79999923706055)

    // Must not have Alpha
    t.is(result.hasAlpha(), false)
    // Here the expected value is actually 200*100, and the calculation of the bbox needs to be fixed.
    t.is(result.getWidth(), 200)
    t.is(result.getHeight(), 100)
  }
})

test('should cropByBBox only with padding', async (t) => {
  const bbox_width = 300
  const padding = 10
  let expectedWidth = bbox_width - padding * 2
  expectedWidth = expectedWidth < 0 ? 0 : expectedWidth
  const origin_svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 1024 1024">
    <rect width="300" height="300" x="100" y="150" fill="green"/></svg>`
  const extened_svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${bbox_width}" height="${bbox_width}" viewBox="0 0 ${bbox_width} ${bbox_width}">
    <rect width="${expectedWidth}" height="${expectedWidth}" x="${padding}" y="${padding}" fill="green"/></svg>`
  // console.info('extened_svg \n', extened_svg)

  const resvg = new Resvg(origin_svg)
  const bbox = resvg.getBBox()
  t.not(bbox, undefined)

  let result: jimp
  if (bbox) {
    resvg.cropByBBox(bbox, padding) // Add padding
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()
    result = await jimp.read(pngBuffer)

    t.is(bbox.width, bbox_width)
    t.is(bbox.height, bbox_width)

    // Must be have Alpha
    t.is(result.hasAlpha(), true)
    t.is(result.getWidth(), bbox_width)
    t.is(result.getHeight(), bbox_width)
  }

  const extened_render = new Resvg(extened_svg)
  const extened_pngData = extened_render.render()
  const extened_pngBuffer = extened_pngData.asPng()
  const extened_result = await jimp.read(extened_pngBuffer)

  t.is(extened_result.getWidth(), bbox_width)
  t.is(extened_result.getHeight(), bbox_width)
  // Compare the two images
  t.is(jimp.diff(result, extened_result, 0.01).percent, 0) // 0 means similar, 1 means not similar
})

test('should cropByBBox with fitTo and padding', async (t) => {
  const w = 500
  const padding = 50
  let expectedWidth = w - padding * 2
  expectedWidth = expectedWidth < 0 ? 0 : expectedWidth
  const origin_svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 1024 1024">
    <rect width="300" height="300" x="100" y="150" fill="red"/></svg>`
  const extened_svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${w}" viewBox="0 0 ${w} ${w}">
    <rect width="${expectedWidth}" height="${expectedWidth}" x="${padding}" y="${padding}" fill="red"/></svg>`
  // console.info('extened_svg \n', extened_svg)

  const resvg = new Resvg(origin_svg, {
    fitTo: {
      mode: 'width',
      value: w,
    },
  })
  const bbox = resvg.getBBox()
  t.not(bbox, undefined)

  let result: jimp
  if (bbox) {
    resvg.cropByBBox(bbox, padding) // Add padding
    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()
    result = await jimp.read(pngBuffer)

    t.is(bbox.width, 300)
    t.is(bbox.height, 300)

    // Must be have Alpha
    t.is(result.hasAlpha(), true)
    t.is(result.getWidth(), w)
    t.is(result.getHeight(), w)
  }

  const extened_render = new Resvg(extened_svg)
  const extened_pngData = extened_render.render()
  const extened_pngBuffer = extened_pngData.asPng()
  const extened_result = await jimp.read(extened_pngBuffer)

  t.is(extened_result.getWidth(), w)
  t.is(extened_result.getHeight(), w)
  // Compare the two images
  t.is(jimp.diff(result, extened_result, 0.01).percent, 0) // 0 means similar, 1 means not similar
})
