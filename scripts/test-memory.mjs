/* eslint-disable no-console */
/**
 * Memory Leak Test Script for resvg-js
 *
 * Run with:
 *   node scripts/test-memory.mjs              # Default: sync render
 *   node scripts/test-memory.mjs render_async # Async render
 *
 * With GC enabled:
 *   node --expose-gc scripts/test-memory.mjs render_async
 *
 * 设置 libuv 线程池的大小（线程数量），默认为 4。线程越多并发越高，但每个线程都有栈内存和分配器缓存，RSS 可能更高。
 * 所以异步函数默认占用内存会更高一些，我们可以强制设为 1 来与非异步函数做对比。
 * UV_THREADPOOL_SIZE=1 node scripts/test-memory.mjs render_async
 *
 */
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, '../__test__/tiger.svg')

const useAsync = process.argv.includes('render_async')

const initialMemoryUsage = process.memoryUsage()

function displayMemoryUsageFromNode(initialMemoryUsage) {
  const finalMemoryUsage = process.memoryUsage()
  const keys = Object.keys(initialMemoryUsage)
  const tableData = [keys]

  const diffColumn = []
  for (const [key, value] of Object.entries(initialMemoryUsage)) {
    const diff = finalMemoryUsage[key] - value
    const prettyDiff = formatBytes(diff, true)
    if (diff > 0) {
      diffColumn.push('+' + prettyDiff)
    } else if (diff < 0) {
      diffColumn.push(prettyDiff)
    } else {
      diffColumn.push('0 B')
    }
  }
  tableData.push(diffColumn)
  console.table(tableData)
}

function formatBytes(bytes, signed = false) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
  const prefix = signed && bytes < 0 ? '-' : ''
  return prefix + parseFloat((Math.abs(bytes) / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function main() {
  const svg = await fs.readFile(svgPath, 'utf-8')
  const { Resvg, renderAsync } = await import('../index.js')

  const opts = {
    fitTo: {
      mode: 'width',
      value: 3000,
    },
    font: {
      loadSystemFonts: false,
    },
  }

  if (useAsync) {
    console.log('\n=== Testing renderAsync() ===')
    await runMemoryTest('Async Render', async () => {
      const rendered = await renderAsync(svg, opts)
      return rendered.asPng().length
    })
  } else {
    console.log('\n=== Testing Resvg.render() ===')
    await runMemoryTest('Sync Render', async () => {
      const resvg = new Resvg(svg, opts)
      return resvg.render().asPng().length
    })
  }
}

async function runMemoryTest(label, renderFn) {
  for (let i = 0; i < 100; i++) {
    displayMemoryUsageFromNode(initialMemoryUsage)
    global?.gc?.()
    await sleep(200)
    const bytes = await renderFn(i)
    console.info(`${label} ${i}: ${formatBytes(bytes)}`)
  }
}

function sleep(time = 100) {
  return new Promise((resolve) => setTimeout(resolve, time))
}

main().then(() => {
  displayMemoryUsageFromNode(initialMemoryUsage)
  global?.gc?.()
  setInterval(() => {
    displayMemoryUsageFromNode(initialMemoryUsage)
  }, 2000)
})
