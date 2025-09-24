import { Buffer } from 'buffer'
import { promises as fs } from 'fs'
import { join } from 'path'

import test from 'ava'
import jimp from 'jimp-compact'
import fetch from 'node-fetch'

import { Resvg, initWasm } from '../wasm'

import { jimpToRgbaPixels } from './helper'

// Init Wasm
test.before(async () => {
  const file = await fs.readFile(join(__dirname, '../wasm/index_bg.wasm'))
  await initWasm(file)
  //  暂时锁定 wasm-bindgen 版本，后面的 API 有较大变动：https://github.com/wasm-bindgen/wasm-bindgen/pull/3995#issuecomment-2295178639
  // await initWasm({ module_or_path: file })
})

test.skip('Use href to load a JPG image without alpha', async (t) => {
  const imgUrl = 'https://wd.imgix.net/image/kheDArv5csY6rvQUJDbWRscckLr1/De5peVXJZz3uSEmmVeYJ.png?w=500'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image href="${imgUrl}" width="500" height="250"/>
</svg>`
  const resvg = new Resvg(svg)
  const resolved = await Promise.all(
    resvg.imagesToResolve().map(async (url) => {
      console.info('image url', url)
      const img = await fetch(url)
      const buffer = await img.arrayBuffer()
      return {
        url,
        buffer: Buffer.from(buffer),
      }
    }),
  )
  if (resolved.length > 0) {
    for (const result of resolved) {
      const { url, buffer } = result
      resvg.resolveImage(url, buffer)
    }
  }
  const pngData = resvg.render()
  const resvgPngBuffer = Buffer.from(pngData.asPng())
  const result1 = await jimp.read(resvgPngBuffer)

  const jimpImg = await fetch(imgUrl)
  const jimpBuffer = Buffer.from(await jimpImg.arrayBuffer())
  const result2 = await jimp.read(jimpBuffer)

  const r1 = new jimp({ data: result1.bitmap.data, width: pngData.width, height: pngData.height })
  const r2 = new jimp({ data: result2.bitmap.data, width: result2.bitmap.width, height: result2.bitmap.height })

  t.is(result1.hasAlpha(), false)
  t.is(jimp.diff(r1, r2, 0.01).percent, 0) // 0 means similar, 1 means not similar
})

test('svg to RGBA pixels Array', async (t) => {
  const svg = `<svg width="10px" height="5px" viewBox="0 0 10 5" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <rect fill="red" x="0" y="0" width="5" height="5"></rect>
    <rect fill="green" x="5" y="0" width="5" height="5"></rect>
  </svg>`
  const resvg = new Resvg(svg)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  const originPixels = Array.from(pngData.pixels)
  const pixelArray = await jimpToRgbaPixels(Buffer.from(pngBuffer), pngData.width, pngData.height)

  t.is(originPixels.length, pixelArray.length)
  t.is(originPixels.toString(), pixelArray.toString())
})

test("should be no error: RuntimeError { message: 'unreachable', }", async (t) => {
  const svg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Google News</title><path d="M21.267 21.2a.614.614 0 0 1-.613.613H3.344a.614.614 0 0 1-.612-.613V8.115a.614.614 0 0 1 .613-.613h17.309a.614.614 0 0 1 .613.613V21.2zm-3.032-3.42v-1.195a.08.08 0 0 0-.08-.08h-5.373v1.361h5.373a.082.082 0 0 0 .08-.083v-.003zm.817-2.587v-1.201a.08.08 0 0 0-.079-.082h-6.19v1.362h6.189a.079.079 0 0 0 .08-.078v-.004.003zm-.817-2.588V11.4a.08.08 0 0 0-.08-.08h-5.373v1.361h5.373a.082.082 0 0 0 .08-.079v.004zM8.15 14.045v1.226h1.77c-.145.748-.804 1.292-1.77 1.292a1.976 1.976 0 0 1 0-3.95 1.77 1.77 0 0 1 1.253.49l.934-.932a3.14 3.14 0 0 0-2.187-.853 3.268 3.268 0 1 0 0 6.537c1.89 0 3.133-1.328 3.133-3.197a3.941 3.941 0 0 0-.052-.619l-3.08.006zM2.27 7.654a.616.616 0 0 1 .613-.613h12.154l-1.269-3.49a.595.595 0 0 0-.743-.383L.368 7.775a.594.594 0 0 0-.323.775l2.225 6.112V7.654za.616.616 0 0 1 .613-.613h12.154l-1.269-3.49a.595.595 0 0 0-.743-.383L.368 7.775a.594.594 0 0 0-.323.775l2.225 6.112V7.654zm21.312-.31l-8.803-2.37.751 2.067h5.584a.614.614 0 0 1 .613.613v8.794l2.247-8.366a.592.592 0 0 0-.392-.739zm-4.496-1.675V2.795a.61.61 0 0 0-.611-.608H5.524a.61.61 0 0 0-.616.605v2.837l8.39-3.052a.594.594 0 0 1 .743.39l.544 1.497 4.501 1.205z"/></svg>`
  const resvg = new Resvg(svg, {
    background: '#fff',
    fitTo: {
      mode: 'width',
      value: 300,
    },
  })
  const pngBuffer = resvg.render().asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))

  t.is(result.getWidth(), 300)
  t.is(result.getHeight(), 300)
})

test('buffer input', async (t) => {
  const filePath = '../example/text.svg'
  const svg = await fs.readFile(join(__dirname, filePath))

  const opts = {
    background: 'rgba(0, 0, 0, .36)',
  }
  const resvg = new Resvg(svg, opts)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))

  t.is(result.hasAlpha(), true)
})

test('fit to width', async (t) => {
  const filePath = '../example/bbox.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const svgString = svg.toString('utf-8')
  const opts = {
    background: '#eeebe6',
    fitTo: {
      mode: 'width',
      value: 800,
    },
  }
  const resvg = new Resvg(svgString, opts)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))

  t.is(result.getWidth(), 800)
  t.is(result.getHeight(), 1156)
})

test('fit to height', async (t) => {
  const filePath = '../example/bbox.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const svgString = svg.toString('utf-8')
  const opts = {
    background: '#eeebe6',
    fitTo: {
      mode: 'height',
      value: 520,
    },
  }
  const resvg = new Resvg(svgString, opts)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))

  t.is(result.getWidth(), 360)
  t.is(result.getHeight(), 520)
})

test('Get SVG original size', async (t) => {
  const filePath = '../example/bbox.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const resvg = new Resvg(svg, {
    background: '#eeebe6',
    fitTo: {
      mode: 'width',
      value: 600, // The original size is not affected by the fitTo parameter
    },
  })

  t.is(resvg.width, 180)
  t.is(resvg.height, 260)
})

test('SVG size must be rounded to an integer', (t) => {
  const svg = `<svg viewBox="0 0 200.5 126.49999" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <rect fill="#FCA6A6" x="0" y="0" width="100%" height="100%"></rect>
  </svg>`
  const resvg = new Resvg(svg)
  const { width, height } = resvg

  t.is(width, 201)
  t.is(height, 126)
})

test('SVG size must be equal to PNG size', async (t) => {
  const svg = `<svg viewBox="0 0 200.5 126.49999" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <rect fill="#FCA6A6" x="0" y="0" width="100%" height="100%"></rect>
  </svg>`
  const resvg = new Resvg(svg)

  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))
  const { width, height } = resvg

  t.is(width, result.getWidth())
  t.is(height, result.getHeight())
})

test('Set the background with alpha by rgba()', async (t) => {
  const filePath = './tiger.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const svgString = svg.toString('utf-8')
  const opts = {
    background: 'rgba(0, 0, 0, 0.6)',
  }
  const resvg = new Resvg(svgString, opts)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))

  t.is(result.hasAlpha(), true)
})

test('Set the background with alpha by rgb()', async (t) => {
  const filePath = './tiger.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const svgString = svg.toString('utf-8')
  const opts = {
    background: 'rgb(255, 0, 0, .832)',
  }
  const resvg = new Resvg(svgString, opts)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))

  t.is(result.hasAlpha(), true)
})

test('Set the background without alpha by hsla()', async (t) => {
  const filePath = './tiger.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const svgString = svg.toString('utf-8')
  const opts = {
    background: 'hsla(255, 80%, 50%, 1)',
  }
  const resvg = new Resvg(svgString, opts)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))

  t.is(result.hasAlpha(), false)
})

test('Load custom font(use fontBuffers option)', async (t) => {
  const filePath = '../example/text.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const fontBuffer = await fs.readFile(join(__dirname, '../example/SourceHanSerifCN-Light-subset.ttf'))
  const resvg = new Resvg(svg.toString('utf-8'), {
    font: {
      fontBuffers: [fontBuffer], // Load custom fonts.
    },
  })
  const pngBuffer = resvg.render().asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))

  t.is(result.getWidth(), 1324)
  t.is(result.getHeight(), 687)
})

test('should be load custom font(no defaultFontFamily option)', async (t) => {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <text fill="blue" font-family="serif" font-size="120">
      <tspan x="40" y="143">水</tspan>
    </text>
  </svg>
  `
  const fontBuffer = await fs.readFile(join(__dirname, '../example/SourceHanSerifCN-Light-subset.ttf'))
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [fontBuffer],
      // defaultFontFamily: 'Source Han Serif CN Light',
    },
  })
  const pngData = resvg.render()
  const originPixels = Array.from(pngData.pixels)

  // Find the number of blue `rgb(0,255,255)`pixels
  t.is(originPixels.join(',').match(/0,0,255/g)?.length, 1727)
})

test('should be load custom fontBuffers(no defaultFontFamily option)', async (t) => {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <text fill="blue" font-family="serif" font-size="120">
      <tspan x="40" y="143">水</tspan>
    </text>
  </svg>
  `
  const fontBuffer = await fs.readFile(join(__dirname, '../example/SourceHanSerifCN-Light-subset.ttf'))
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [fontBuffer],
    },
  })
  const pngData = resvg.render()
  const originPixels = Array.from(pngData.pixels)

  // Find the number of blue `rgb(0,255,255)`pixels
  t.is(originPixels.join(',').match(/0,0,255/g)?.length, 1727)
})

test('should be load custom multiple fontBuffers', async (t) => {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="500" height="200" viewBox="0 0 500 200">
    <text fill="blue" font-size="60">
      <tspan x="40" y="80">竹外桃花三两枝</tspan>
      <tspan x="40" y="160">Hello resvg-js</tspan>
    </text>
  </svg>
  `
  const fontBuffer = await fs.readFile(join(__dirname, '../example/SourceHanSerifCN-Light-subset.ttf'))
  const pacificoBuffer = await fs.readFile(join(__dirname, './Pacifico-Regular.ttf'))
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [pacificoBuffer, fontBuffer],
      defaultFontFamily: ' Pacifico  ', // Multiple spaces
    },
  })
  const pngData = resvg.render()
  const originPixels = Array.from(pngData.pixels)

  // Find the number of blue `rgb(0,255,255)`pixels
  t.is(originPixels.join(',').match(/0,0,255/g)?.length, 8911)
})

test('should be load custom WOFF2 font', async (t) => {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="500" height="200" viewBox="0 0 500 200">
    <text fill="blue" font-size="60">
      <tspan x="40" y="100">Hello resvg-js</tspan>
    </text>
  </svg>
  `
  const pacificoBuffer = await fs.readFile(join(__dirname, '../wasm/fonts/', 'Pacifico-Regular.woff2'))
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [pacificoBuffer],
    },
  })
  const pngData = resvg.render()
  const originPixels = Array.from(pngData.pixels)

  // Find the number of blue `rgb(0,255,255)`pixels
  t.is(originPixels.join(',').match(/0,0,255/g)?.length, 6039)
})

test('should generate a 80x80 png and opaque', async (t) => {
  const svg = `<svg width="200px" height="200px" viewBox="0 0 200 200" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <rect fill="green" x="0" y="0" width="100" height="100"></rect>
  </svg>`
  const resvg = new Resvg(svg, {
    crop: {
      left: 20,
      top: 20,
      right: 100,
      bottom: 100,
    },
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))

  t.is(result.getWidth(), 100 - 20)
  t.is(result.getHeight(), 100 - 20)
  t.is(result.hasAlpha(), false)
})

test('should render HEXA color format', async (t) => {
  const HEXA_SVG = `<svg viewBox="0 0 200 200" version="1.1" xmlns="http://www.w3.org/2000/svg"><rect fill="#00800080" x="0" y="0" width="100%" height="100%"></rect></svg>`
  const RGBA_SVG = `<svg viewBox="0 0 200 200" version="1.1" xmlns="http://www.w3.org/2000/svg"><rect fill="rgba(0, 128, 0, 0.5)" x="0" y="0" width="100%" height="100%"></rect></svg>`

  const hexaPngData = new Resvg(HEXA_SVG).render().asPng()
  const rgbaPngData = new Resvg(RGBA_SVG).render().asPng()
  const HEXABuffer = await jimp.read(Buffer.from(hexaPngData))
  const RGBABuffer = await jimp.read(Buffer.from(rgbaPngData))

  const r1 = new jimp({ data: HEXABuffer.bitmap.data, width: 200, height: 200 })
  const r2 = new jimp({ data: RGBABuffer.bitmap.data, width: 200, height: 200 })
  const diff = jimp.diff(r1, r2, 0.01)

  t.is(diff.percent, 0) // 0 means similar, 1 means not similar
})

test('should render `<use xlink:href>` to an `<svg>` element', async (t) => {
  const svg = `
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <svg id="svg1" xmlns="http://www.w3.org/2000/svg">
      <rect width="50%" height="50%" fill="green" />
    </svg>
    <use id="use1" x="50%" y="50%" xlink:href="#svg1" />
    <use id="use2" x="50%" y="0" xlink:href="#svg1" />
    <use id="use3" x="0" y="50%" xlink:href="#svg1" />
  </svg>
  `
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'height',
      value: 800,
    },
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))

  t.is(result.hasAlpha(), false)
  t.is(result.getWidth(), 800)
  t.is(result.getHeight(), 800)
})

test('should render `<use xlink:href>` to an `<defs>` element', async (t) => {
  const svg = `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <svg id="svg1">
        <rect width="50%" height="50%" fill="green" />
      </svg>
    </defs>
    <use id="use1" x="0" y="0" xlink:href="#svg1" />
    <use id="use2" x="50%" y="50%" xlink:href="#svg1" />
  </svg>`

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 900,
    },
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(Buffer.from(pngBuffer))

  t.is(result.hasAlpha(), true)
  t.is(result.getWidth(), 900)
  t.is(result.getHeight(), 900)
})

test('should get svg bbox with stroke', (t) => {
  const svg = `<svg viewBox="-40 0 180 260" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <g fill="green" transform="rotate(-10 50 100) translate(-36 45.5) skewX(40) scale(1 0.5)">
    <path id="heart" d="M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 z" />
  </g>
  <use xlink:href="#heart" fill="none" stroke="red" stroke-width="10" />
</svg>`

  const resvg = new Resvg(svg)
  const bbox = resvg.getBBox()
  t.not(bbox, undefined)
  if (bbox) {
    t.is(bbox.width, 116.70712280273438)
    t.is(bbox.height, 90)
    t.is(bbox.x, -21.707120895385742)
    t.is(bbox.y, 5)
  }

  const innerBBox = resvg.innerBBox()
  t.not(innerBBox, undefined)
  if (innerBBox) {
    t.is(innerBBox.width, 125)
    t.is(innerBBox.height, 93)
    t.is(innerBBox.x, -30)
    t.is(innerBBox.y, 5)
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
    const result = await jimp.read(Buffer.from(pngBuffer))

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

test('should return undefined if bbox is invalid', (t) => {
  const svg = `<svg width="300px" height="300px" viewBox="0 0 300 300" version="1.1" xmlns="http://www.w3.org/2000/svg"></svg>`
  const resvg = new Resvg(svg)
  t.is(resvg.getBBox(), undefined)
  t.is(resvg.innerBBox(), undefined)
})

test('should render using font buffer provided by options', async (t) => {
  const svg = `<svg width='480' height='150' viewBox='-20 -80 550 100' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'>
  <text x='0' y='0' font-size='100' fill='#000'>Font Buffer</text>
  </svg>`

  const pacificoBuffer = await fs.readFile(join(__dirname, './Pacifico-Regular.ttf'))
  const expectedResultBuffer = await fs.readFile(join(__dirname, './options_font_buffer_expected_result.png'))

  const options = {
    font: {
      fontBuffers: [pacificoBuffer],
      defaultFontFamily: 'non-existent-font-family',
    },
  }

  const resvg = new Resvg(svg, options)
  const renderedResult = resvg.render().asPng()

  const expectedResult = await jimp.read(Buffer.from(expectedResultBuffer.buffer))
  const actualPng = await jimp.read(Buffer.from(renderedResult))

  t.is(jimp.diff(expectedResult, actualPng, 0.01).percent, 0) // 0 means similar, 1 means not similar
})

// throws
test('should throw because invalid SVG (blank string)', (t) => {
  const error = t.throws(
    () => {
      new Resvg('')
    },
    { instanceOf: Error },
  )

  t.is(error.message, 'SVG data parsing failed cause the document does not have a root node')
})

test('should throw (no input parameters)', (t) => {
  const error = t.throws(
    () => {
      new Resvg()
    },
    { instanceOf: Error },
  )

  t.is(error.message, 'Input must be string or Uint8Array')
})
