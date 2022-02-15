// Generated by dts-bundle-generator v6.5.0

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
export type ResvgRenderOptions = {
	dpi?: number;
	languages?: string[];
	shapeRendering?: 0 // optimizeSpeed
	 | 1 // crispEdges
	 | 2; // geometricPrecision
	textRendering?: 0 // optimizeSpeed
	 | 1 // optimizeLegibility
	 | 2; // geometricPrecision'
	imageRendering?: 0 // optimizeQuality
	 | 1; // optimizeSpeed
	fitTo?: {
		mode: "original";
	} | {
		mode: "width";
		value: number;
	} | {
		mode: "height";
		value: number;
	} | {
		mode: "zoom";
		value: number;
	};
	background?: string; // Support CSS3 color, e.g. rgba(255, 255, 255, .8)
	crop?: {
		left: number;
		top: number;
		right?: number;
		bottom?: number;
	};
};
/**
 * Initialize WASM module
 * @param module_or_path WebAssembly Module or WASM url
 *
 */
export declare const initWasm: (module_or_path: Promise<InitInput> | InitInput) => Promise<void>;
/**
 * render svg to png
 * @param {Uint8Array | string} svg
 * @param {ResvgRenderOptions | undefined} options
 * @returns {Uint8Array}
 */
export declare const render: (svg: Uint8Array | string, options?: ResvgRenderOptions | undefined) => Uint8Array;
