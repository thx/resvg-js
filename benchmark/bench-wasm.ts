import { promises as fs } from 'fs'
import { join } from 'path'

import b from 'benny'

const wasm = require(`../wasm`)
const simd = require(`../wasm-simd`)

async function run() {
  await wasm.initWasm(fs.readFile(join(__dirname, '../wasm/index_bg.wasm')))
  await simd.initWasm(fs.readFile(join(__dirname, '../wasm-simd/index_bg.wasm')))

  const svg1 = await fs.readFile(join(__dirname, '../example/text.svg'))
  const tiger = await fs.readFile(join(__dirname, '../__test__/tiger.svg'))
  const icon = await fs.readFile(join(__dirname, '../__test__/icon-alarm.svg'))

  await b.suite(
    'resize width',
    b.add('resvg-js(Wasm)', () => {
      const opts = {
        background: '#eeebe6',
        fitTo: {
          mode: 'width',
          value: 1200,
        },
        logLevel: 'off',
      }
      const resvg = new wasm.Resvg(svg1, opts)
      const pngData = resvg.render()
      pngData.asPng()
    }),

    b.add('resvg-js(Wasm SIMD)', () => {
      const opts = {
        background: '#eeebe6',
        fitTo: {
          mode: 'width',
          value: 1200,
        },
        logLevel: 'off',
      }
      const resvg = new simd.Resvg(svg1, opts)
      const pngData = resvg.render()
      pngData.asPng()
    }),

    b.cycle(),
    b.complete(),
  )

  await b.suite(
    'resize icon width',
    b.add('resvg-js(Wasm)', () => {
      const opts = {
        fitTo: {
          mode: 'width',
          value: 386,
        },
        logLevel: 'off',
      }
      const resvg = new wasm.Resvg(icon, opts)
      const pngData = resvg.render()
      pngData.asPng()
    }),

    b.add('resvg-js(Wasm SIMD)', () => {
      const opts = {
        fitTo: {
          mode: 'width',
          value: 386,
        },
        logLevel: 'off',
      }
      const resvg = new simd.Resvg(icon, opts)
      const pngData = resvg.render()
      pngData.asPng()
    }),

    b.cycle(),
    b.complete(),
  )

  await b.suite(
    'default options and no text',
    b.add('resvg-js(Wasm)', () => {
      const opts = {
        logLevel: 'off',
      }
      const resvg = new wasm.Resvg(tiger, opts)
      const pngData = resvg.render()
      pngData.asPng()
    }),

    b.add('resvg-js(Wasm SIMD)', () => {
      const opts = {
        logLevel: 'off',
      }
      const resvg = new simd.Resvg(tiger, opts)
      const pngData = resvg.render()
      pngData.asPng()
    }),

    b.cycle(),
    b.complete(),
  )
}

run().catch((e) => {
  console.error(e)
})
