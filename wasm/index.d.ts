// Generated by dts-bundle-generator v6.9.0

declare class BBox {
	free(): void;
	/**
	*/
	height: number;
	/**
	*/
	width: number;
	/**
	*/
	x: number;
	/**
	*/
	y: number;
}
declare class RenderedImage {
	free(): void;
	/**
	* Write the image data to Uint8Array
	* @returns {Uint8Array}
	*/
	asPng(): Uint8Array;
	/**
	* Get the PNG height
	* @returns {number}
	*/
	readonly height: number;
	/**
	* Get the PNG width
	* @returns {number}
	*/
	readonly width: number;
}
export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
export type ResvgRenderOptions = {
	font?: {
		loadSystemFonts?: boolean;
		fontFiles?: string[];
		fontDirs?: string[];
		defaultFontFamily?: string;
		defaultFontSize?: number;
		serifFamily?: string;
		sansSerifFamily?: string;
		cursiveFamily?: string;
		fantasyFamily?: string;
		monospaceFamily?: string;
	};
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
	logLevel?: "off" | "error" | "warn" | "info" | "debug" | "trace";
};
/**
 * Initialize Wasm module
 * @param module_or_path WebAssembly Module or .wasm url
 *
 */
export declare const initWasm: (module_or_path: Promise<InitInput> | InitInput) => Promise<void>;
export declare const Resvg: {
	new (svg: Uint8Array | string, options?: ResvgRenderOptions | undefined): {
		free(): void;
		render(): RenderedImage;
		toString(): string;
		innerBBox(): BBox;
		getBBox(): BBox;
		cropByBBox(bbox: BBox): void;
		readonly height: number;
		readonly width: number;
	};
};

export {};
