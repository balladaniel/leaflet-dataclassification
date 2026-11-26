import { nodeResolve } from '@rollup/plugin-node-resolve'; // needed for bundling dependencies
import terser from '@rollup/plugin-terser';
import pkg from './package.json' with {type: 'json'};

const banner = `/* @preserve
 * Plugin 'leaflet-dataclassification' ${pkg.version}
 * 
 * Classifies point, line or polygon features by chosen quantitative-type attribute, 
 * stylizes features on map accordingly, 
 * generates an appropriate legend for visualized data
 * Project page: https://github.com/balladaniel/leaflet-dataclassification 
 * 
 * MIT License
 * Copyright (c) 2023-${new Date().getFullYear()} Dániel Balla
 */`;

 
/** @type {import('rollup').OutputOptions} */
const commonOptions = {
	banner: banner
};

export default [{
    plugins: [
        nodeResolve(),
        terser()
    ],
    input: './src/leaflet-dataclassification.js',
    output: [{
        file: './dist/leaflet-dataclassification.js',
        //format: 'umd',
        //name: 'leaflet-dataclassification',
		...commonOptions
    }],
    external: ['leaflet']
},{
    plugins: [
        nodeResolve(),
        terser()
    ],
    // https://github.com/Leaflet/Leaflet/blob/main/PLUGIN-GUIDE.md#script-tags-and-the-global-build
    input: './build/global.js',
    output: {
        file: './dist/leaflet-dataclassification-global.js', 
        format: 'iife', 
        globals: {'leaflet': 'L', 'simple-statistics': 'ss', 'chroma-js': 'chroma'},
		...commonOptions
    },
    external: ['leaflet']
}]