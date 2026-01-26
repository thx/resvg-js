import test from 'ava'

import { Resvg } from '../index'

// This test case from https://github.com/linebender/resvg/issues/1007
test('[1]should catch panic and throw error', (t) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128px" height="128px" xmlns:bx="http://www.w3.org/2001/XMLSchema">
  <defs>
    <linearGradient id="color-2" bx:pinned="true">
      <stop style="stop-color: #252a34;"/>
    </linearGradient>
    <filter id="point-light-filter-0" primitiveUnits="objectBoundingBox" x="-500%" y="-500%" width="1000%" height="1000%" bx:preset="point-light 1 0.5 0.5 0.5 50 1 0.2 0 #ffffff">
      <feSpecularLighting result="specular-lighting" lighting-color="#ffffff" specularConstant="1" specularExponent="50">
        <fePointLight x="0.5" y="0.5" z="0.5"/>
      </feSpecularLighting>
      <feDiffuseLighting result="diffuse-lighting" lighting-color="#ffffff" diffuseConstant="0.2">
        <fePointLight x="0.5" y="0.5" z="0.5"/>
      </feDiffuseLighting>
      <feMerge result="lighting">
        <feMergeNode in="diffuse-lighting"/>
        <feMergeNode in="specular-lighting"/>
      </feMerge>
      <feComposite in="SourceGraphic" in2="lighting" operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>
    </filter>
  </defs>
  <ellipse style="paint-order: stroke; stroke-width: 0px; fill: url(#color-2); filter: url(#point-light-filter-0);" cx="64" cy="64" rx="64" ry="64"/>
  <g transform="matrix(3.850445, 0, 0, 3.473398, 19.614788, 19.295992)" style=""/>
  <g transform="matrix(1, 0, 0, 1, 0.000219, -0.000004)">
    <path d="M 69.455 32.479 Q 74 21.828 78.544 32.479 L 104.412 93.109 Q 108.956 103.76 99.867 103.76 L 48.132 103.76 Q 39.043 103.76 43.587 93.109 Z" style="stroke: rgb(0, 0, 0); stroke-width: 0px; fill: rgb(254, 254, 254);" bx:shape="triangle 39.043 21.828 69.913 81.932 0.5 0.13 1@98033a5e"/>
    <path d="M 38.866 66.193 Q 41.653 60.58 44.44 66.193 L 60.304 98.147 Q 63.091 103.76 57.517 103.76 L 25.789 103.76 Q 20.215 103.76 23.002 98.147 Z" style="stroke: rgb(0, 0, 0); stroke-width: 0px; fill: rgb(254, 254, 254);" bx:shape="triangle 20.215 60.58 42.876 43.18 0.5 0.13 1@e89cda0c"/>
    <ellipse style="stroke: rgb(0, 0, 0); stroke-width: 0px; fill: rgb(254, 254, 254);" cx="41.541" cy="34.856" rx="10.847" ry="10.616"/>
  </g>
</svg>
  `
  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: false,
    },
  })
  const error = t.throws(() => {
    resvg.render()
  })
  // console.info(error)

  t.true(error.message.includes('Rendering failed due to an resvg panic'))
})

// This test case from https://github.com/linebender/resvg/issues/933
test('[2]should catch panic and throw error', (t) => {
  const svg = `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" height="32" viewBox="0 0 8.4.9" width="32" x="w"><g m=""><g><path d="m3 6h8v-158758583"/></g></g></svg>
  `
  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: false,
    },
  })
  const error = t.throws(() => {
    resvg.render()
  })
  // console.info(error)

  t.true(error.message.includes('Rendering failed due to an resvg panic'))
})
