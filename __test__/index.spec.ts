import { promises as fs } from 'fs'
import { join } from 'path'

import test from 'ava'
import jimp from 'jimp-compact'
import fetch from 'node-fetch'

import { Resvg, renderAsync } from '../index'

import { jimpToRgbaPixels } from './helper'

test.skip('Use href to load a JPG image without alpha', async (t) => {
  const imgUrl = 'https://wd.imgix.net/image/kheDArv5csY6rvQUJDbWRscckLr1/De5peVXJZz3uSEmmVeYJ.png?w=500'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image href="${imgUrl}" width="500" height="250"/>
</svg>`
  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: false,
    },
  })
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
  const resvgPngBuffer = pngData.asPng()
  const result1 = await jimp.read(resvgPngBuffer)

  const jimpImg = await fetch(imgUrl)
  const jimpBuffer = await jimpImg.arrayBuffer()
  const result2 = await jimp.read(jimpBuffer)

  const r1 = new jimp({ data: result1.bitmap.data, width: pngData.width, height: pngData.height })
  const r2 = new jimp({ data: result2.bitmap.data, width: result2.bitmap.width, height: result2.bitmap.height })

  t.is(result1.hasAlpha(), false)
  t.is(jimp.diff(r1, r2, 0.01).percent, 0) // 0 means similar, 1 means not similar
})

test("should be no error: thread '<unnamed>' panicked at 'the previous segment must be M/L/C'", async (t) => {
  const svg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Google News</title><path d="M21.267 21.2a.614.614 0 0 1-.613.613H3.344a.614.614 0 0 1-.612-.613V8.115a.614.614 0 0 1 .613-.613h17.309a.614.614 0 0 1 .613.613V21.2zm-3.032-3.42v-1.195a.08.08 0 0 0-.08-.08h-5.373v1.361h5.373a.082.082 0 0 0 .08-.083v-.003zm.817-2.587v-1.201a.08.08 0 0 0-.079-.082h-6.19v1.362h6.189a.079.079 0 0 0 .08-.078v-.004.003zm-.817-2.588V11.4a.08.08 0 0 0-.08-.08h-5.373v1.361h5.373a.082.082 0 0 0 .08-.079v.004zM8.15 14.045v1.226h1.77c-.145.748-.804 1.292-1.77 1.292a1.976 1.976 0 0 1 0-3.95 1.77 1.77 0 0 1 1.253.49l.934-.932a3.14 3.14 0 0 0-2.187-.853 3.268 3.268 0 1 0 0 6.537c1.89 0 3.133-1.328 3.133-3.197a3.941 3.941 0 0 0-.052-.619l-3.08.006zM2.27 7.654a.616.616 0 0 1 .613-.613h12.154l-1.269-3.49a.595.595 0 0 0-.743-.383L.368 7.775a.594.594 0 0 0-.323.775l2.225 6.112V7.654za.616.616 0 0 1 .613-.613h12.154l-1.269-3.49a.595.595 0 0 0-.743-.383L.368 7.775a.594.594 0 0 0-.323.775l2.225 6.112V7.654zm21.312-.31l-8.803-2.37.751 2.067h5.584a.614.614 0 0 1 .613.613v8.794l2.247-8.366a.592.592 0 0 0-.392-.739zm-4.496-1.675V2.795a.61.61 0 0 0-.611-.608H5.524a.61.61 0 0 0-.616.605v2.837l8.39-3.052a.594.594 0 0 1 .743.39l.544 1.497 4.501 1.205z"/></svg>`
  const resvg = new Resvg(svg, {
    background: '#fff',
    fitTo: {
      mode: 'width',
      value: 300,
    },
    font: {
      loadSystemFonts: false,
    },
  })
  const pngBuffer = resvg.render().asPng()
  const result = await jimp.read(pngBuffer)

  t.is(result.getWidth(), 300)
  t.is(result.getHeight(), 300)
})

test('svg to RGBA pixels Array', async (t) => {
  const svg = `<svg width="10px" height="5px" viewBox="0 0 10 5" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <rect fill="red" x="0" y="0" width="5" height="5"></rect>
    <rect fill="green" x="5" y="0" width="5" height="5"></rect>
  </svg>`
  const resvg = new Resvg(svg)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  const originPixels = pngData.pixels.toJSON().data
  const pixelArray = await jimpToRgbaPixels(pngBuffer, pngData.width, pngData.height)

  t.is(originPixels.length, pixelArray.length)
  t.is(originPixels.toString(), pixelArray.toString())
})

test('fit to width', async (t) => {
  const filePath = '../example/bbox.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const resvg = new Resvg(svg, {
    background: '#eeebe6',
    fitTo: {
      mode: 'width',
      value: 800,
    },
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(pngBuffer)

  t.is(result.getWidth(), 800)
  t.is(result.getHeight(), 1156)
})

test('fit to height', async (t) => {
  const filePath = '../example/bbox.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const resvg = new Resvg(svg, {
    background: '#eeebe6',
    fitTo: {
      mode: 'height',
      value: 520,
    },
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(pngBuffer)

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
  const result = await jimp.read(pngBuffer)
  const { width, height } = resvg

  t.is(width, result.getWidth())
  t.is(height, result.getHeight())
})

test('render().width/height must be equal to PNG size', async (t) => {
  const svg = `<svg viewBox="0 0 200.5 126.49999" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <rect fill="#FCA6A6" x="0" y="0" width="100%" height="100%"></rect>
  </svg>`
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'height',
      value: 300,
    },
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(pngBuffer)
  const { width, height } = pngData

  t.is(width, result.getWidth())
  t.is(height, result.getHeight())
})

test('Set the background with alpha by rgba()', async (t) => {
  const filePath = './tiger.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const svgString = svg.toString('utf-8')
  const resvg = new Resvg(svgString, {
    background: 'rgba(0, 0, 0, 0.6)',
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(pngBuffer)

  t.is(result.hasAlpha(), true)
})

test('Set the background with alpha by rgb()', async (t) => {
  const filePath = './tiger.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const svgString = svg.toString('utf-8')
  const resvg = new Resvg(svgString, {
    background: 'rgb(255, 0, 0, .832)',
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(pngBuffer)

  t.is(result.hasAlpha(), true)
})

test('Set the background without alpha by hsla()', async (t) => {
  const filePath = './tiger.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const svgString = svg.toString('utf-8')
  const resvg = new Resvg(svgString, {
    background: 'hsla(255, 80%, 50%, 1)',
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(pngBuffer)

  t.is(result.hasAlpha(), false)
})

test('Load custom font', async (t) => {
  const filePath = '../example/text.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const svgString = svg.toString('utf-8')
  const resvg = new Resvg(svgString, {
    font: {
      fontFiles: ['./example/SourceHanSerifCN-Light-subset.ttf'], // Load custom fonts.
      loadSystemFonts: false, // It will be faster to disable loading system fonts.
      defaultFontFamily: 'Source Han Serif CN Light',
    },
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(pngBuffer)

  t.is(result.getWidth(), 1324)
  t.is(result.getHeight(), 687)
})

test('should be load custom fontFiles(no defaultFontFamily option)', (t) => {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <text fill="blue" font-family="serif" font-size="120">
      <tspan x="40" y="143">水</tspan>
    </text>
  </svg>
  `
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: ['./example/SourceHanSerifCN-Light-subset.ttf'],
      loadSystemFonts: false,
    },
    logLevel: 'debug',
  })
  const pngData = resvg.render()
  const originPixels = pngData.pixels.toJSON().data

  // Find the number of blue `rgb(0,255,255)`pixels
  t.is(originPixels.join(',').match(/0,0,255/g)?.length, 1727)
})

test('should be load custom fontDirs(no defaultFontFamily option)', (t) => {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <text fill="blue" font-family="serif" font-size="120">
      <tspan x="40" y="143">水</tspan>
    </text>
  </svg>
  `
  const resvg = new Resvg(svg, {
    font: {
      fontDirs: ['./example/'],
      // loadSystemFonts: false,
      // defaultFontFamily: 'Source Han Serif CN Light',
    },
  })
  const pngData = resvg.render()
  const originPixels = pngData.pixels.toJSON().data

  // Find the number of blue `rgb(0,255,255)`pixels
  t.is(originPixels.join(',').match(/0,0,255/g)?.length, 1727)
})

test('The defaultFontFamily is not found in the OS and needs to be fallback', (t) => {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
  <text fill="blue" font-family="" font-size="100">
    <tspan x="10" y="60%">Abc</tspan>
  </text>
</svg>
  `
  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: true,
      fontDirs: ['/usr/share/fonts/'], // 防止在 CI 的 Docker 环境找不到字体
      defaultFontFamily: 'non-existent-font-family',
    },
    logLevel: 'debug',
  })
  const pngData = resvg.render()
  const originPixels = pngData.pixels.toJSON().data
  // Find the number of blue `rgb(0,255,255)`pixels
  const matchPixels = originPixels.join(',').match(/0,0,255/g)
  t.true(matchPixels !== null) // If the font is not matched, there are no blue pixels.
  t.true((matchPixels?.length ?? 0) > 1500)
})

test('Test defaultFontFamily', (t) => {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
  <text fill="blue" font-family="" font-size="100">
    <tspan x="10" y="60%">Abc</tspan>
  </text>
</svg>
  `
  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontDirs: ['./example'],
      defaultFontFamily: 'Source Han Serif CN Light', // 指定中文字体，期望自动 fallback 到英文 字体 Pacifico.
    },
    logLevel: 'debug',
  })
  const pngData = resvg.render()
  const originPixels = pngData.pixels.toJSON().data
  // Find the number of blue `rgb(0,255,255)`pixels
  const matchPixels = originPixels.join(',').match(/0,0,255/g)
  t.true(matchPixels !== null) // If the font is not matched, there are no blue pixels.
  t.true((matchPixels?.length ?? 0) > 1500)
})

test('Async rendering', async (t) => {
  const filePath = '../example/text.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const params = {
    font: {
      fontFiles: ['./example/SourceHanSerifCN-Light-subset.ttf'], // Load custom fonts.
      loadSystemFonts: false, // It will be faster to disable loading system fonts.
      defaultFontFamily: '  Source Han Serif CN Light ',
    },
  }
  let syncRenderingResult = new Resvg(svg, params)
  syncRenderingResult = syncRenderingResult.render()

  const asyncRenderingResult = await renderAsync(svg, params)
  t.is(syncRenderingResult.length, asyncRenderingResult.length)
  // Do not run this assert in non-x64 environment.
  // It's too slow
  if (process.arch === 'x64') {
    t.deepEqual(syncRenderingResult, syncRenderingResult)
  }
})

const MaybeTest = typeof AbortController !== 'undefined' ? test : test.skip

MaybeTest('should be able to abort queued async rendering', async (t) => {
  // Fill the task queue
  for (const _ of Array.from({ length: 100 })) {
    process.nextTick(() => {})
  }
  const filePath = '../example/text.svg'
  const svg = await fs.readFile(join(__dirname, filePath))
  const params = {
    font: {
      fontFiles: ['./example/SourceHanSerifCN-Light-subset.ttf'], // Load custom fonts.
      loadSystemFonts: false, // It will be faster to disable loading system fonts.
      defaultFontFamily: 'Source Han Serif CN Light',
    },
  }
  const controller = new AbortController()
  const renderingPromise = renderAsync(svg, params, controller.signal)
  // In napi-rs v3, AbortSignal only cancels a task that hasn't started yet.
  controller.abort()
  try {
    const result = await renderingPromise
    t.true(typeof result.asPng === 'function')
  } catch (err: any) {
    t.is(err.message, 'AbortError')
    t.is(err.code, 'Cancelled')
  }
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
  const result = await jimp.read(pngBuffer)

  t.is(result.getWidth(), 100 - 20)
  t.is(result.getHeight(), 100 - 20)
  t.is(result.hasAlpha(), false)
})

// Generate a 100x100 transparent png starting from resvg 0.21.0
// https://github.com/RazrFalcon/resvg/commit/5998e9b8411ff3f0171515371938ee1940be17c3
test('should generate a 100x100 transparent png', async (t) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`
  const resvg = new Resvg(svg)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(pngBuffer)

  t.is(result.hasAlpha(), true)
  t.is(result.getWidth(), 100)
  t.is(result.getHeight(), 100)
})

test('should generate a 128x128 png', async (t) => {
  const svg = `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg"></svg>`
  const resvg = new Resvg(svg, {
    background: 'green',
  })
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()
  const result = await jimp.read(pngBuffer)

  t.is(result.hasAlpha(), false)
  t.is(result.getWidth(), 128)
  t.is(result.getHeight(), 128)
})

test('should render HEXA color format', async (t) => {
  const HEXA_SVG = `<svg viewBox="0 0 200 200" version="1.1" xmlns="http://www.w3.org/2000/svg"><rect fill="#00800080" x="0" y="0" width="100%" height="100%"></rect></svg>`
  const RGBA_SVG = `<svg viewBox="0 0 200 200" version="1.1" xmlns="http://www.w3.org/2000/svg"><rect fill="rgba(0, 128, 0, 0.5)" x="0" y="0" width="100%" height="100%"></rect></svg>`

  const hexaPngData = new Resvg(HEXA_SVG).render().asPng()
  const rgbaPngData = new Resvg(RGBA_SVG).render().asPng()
  const HEXABuffer = await jimp.read(hexaPngData)
  const RGBABuffer = await jimp.read(rgbaPngData)

  const r1 = new jimp({ data: HEXABuffer.bitmap.data, width: 200, height: 200 })
  const r2 = new jimp({ data: RGBABuffer.bitmap.data, width: 200, height: 200 })
  const diff = jimp.diff(r1, r2, 0.01)

  t.is(diff.percent, 0) // 0 means similar, 1 means not similar
})

// The four green <rect> must be tiled, with no alpha channel.
// View more test cases: https://github.com/RazrFalcon/resvg/commit/0eb347f2b6b9d76ffcb8e6b66ebefcd0f09da6a7
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
  const result = await jimp.read(pngBuffer)

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
  const result = await jimp.read(pngBuffer)

  t.is(result.hasAlpha(), true)
  t.is(result.getWidth(), 900)
  t.is(result.getHeight(), 900)
})

test('should get svg innerBBox', (t) => {
  const svg = `<svg viewBox="-40 0 150 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <g fill="red" transform="rotate(-10 50 100) translate(-36 45.5) skewX(40) scale(1 0.5)">
      <path id="heart" d="M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 z" />
    </g>
  </svg>`

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 500,
    },
  })
  const bbox = resvg.innerBBox()
  t.not(bbox, undefined)
  if (bbox) {
    t.is(bbox.width, 120)
    t.is(bbox.height, 49)
    t.is(bbox.x, -30)
    t.is(bbox.y, 49)
  }
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
  console.info('extened_svg \n', extened_svg)

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
  console.info('extened_svg \n', extened_svg)

  const resvg = new Resvg(origin_svg, {
    fitTo: {
      mode: 'width', // TODO: test mode 'zoom'
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

test('should return undefined if bbox is invalid', (t) => {
  const svg = `<svg width="300px" height="300px" viewBox="0 0 300 300" version="1.1" xmlns="http://www.w3.org/2000/svg"></svg>`
  const resvg = new Resvg(svg)

  t.is(resvg.getBBox(), undefined)
  t.is(resvg.innerBBox(), undefined)
})

test('cropByBBox should handle invalid padding values', (t) => {
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

test('cropByBBox should handle zero/negative bbox dimensions', (t) => {
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

test('cropByBBox with fitTo should handle zero/negative bbox dimensions', (t) => {
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

test('should render using font buffer provided by options', async (t) => {
  const svg = `<svg width='480' height='150' viewBox='-20 -80 550 100' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'>
  <text x='0' y='0' font-size='100' fill='#000'>Font Buffer</text>
  </svg>`

  const expectedResultBuffer = await fs.readFile(join(__dirname, './options_font_buffer_expected_result.png'))

  const resvg = new Resvg(svg, {
    font: {
      fontFiles: ['./__test__/Pacifico-Regular.ttf'],
      loadSystemFonts: false,
      defaultFontFamily: '',
    },
    logLevel: 'debug',
  })
  const renderedResult = resvg.render().asPng()

  const expectedResult = await jimp.read(Buffer.from(expectedResultBuffer.buffer))
  const actualPng = await jimp.read(Buffer.from(renderedResult))

  t.is(jimp.diff(expectedResult, actualPng, 0.01).percent, 0) // 0 means similar, 1 means not similar
})

test('should throw because invalid SVG attribute (width attribute is 0)', (t) => {
  const error = t.throws(
    () => {
      new Resvg(`
      <svg width="0" height="100px" viewBox="0 0 200 100" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <rect fill="#FCA6A6" x="0" y="0" width="200" height="100"></rect>
      </svg>
      `)
    },
    { instanceOf: Error },
  )

  t.is(error.message, 'SVG has an invalid size')
})

test('should throw because invalid options (width 0)', (t) => {
  const error = t.throws(
    () => {
      const resvg = new Resvg(
        `<svg width="200px" height="100px" viewBox="0 0 200 100" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          <rect fill="#FCA6A6" x="0" y="0" width="200" height="100"></rect>
        </svg>`,
        {
          fitTo: {
            mode: 'width',
            value: 0,
          },
        },
      )

      resvg.render()
    },
    { instanceOf: Error },
  )

  t.is(error.message, 'Target size is zero (please do not set the width/height/zoom options to 0)')
})

test('should throw because invalid options (zoom 0)', (t) => {
  const error = t.throws(
    () => {
      const resvg = new Resvg('<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg"></svg>', {
        fitTo: {
          mode: 'zoom',
          value: 0,
        },
      })

      resvg.render()
    },
    { instanceOf: Error },
  )

  t.is(error.message, 'Target size is zero (please do not set the width/height/zoom options to 0)')
})

// An SVG file must have a xmlns="http://www.w3.org/2000/svg" namespace.
// https://github.com/RazrFalcon/resvg/issues/192
test('should throw because missing namespace', (t) => {
  const svg = `<svg viewBox="0 0 0 16
                                     16"></svg>`
  const error = t.throws(
    () => {
      new Resvg(svg)
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

  t.is(error.code, 'InvalidArg')
  t.is(error.message, 'Value is non of these types `String`, `Vec<u8>`, ')
})

test('should throw (SVG string is empty)', (t) => {
  const error = t.throws(
    () => {
      new Resvg('')
    },
    { instanceOf: Error },
  )

  t.is(error.code, 'GenericFailure')
  t.is(error.message, 'SVG data parsing failed cause the document does not have a root node')
})
