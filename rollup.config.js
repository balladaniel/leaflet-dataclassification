import { nodeResolve } from '@rollup/plugin-node-resolve'; // needed for bundling dependencies

export default [{
    plugins: [
        nodeResolve()
    ],
    input: './src/leaflet-dataclassification.js',
    output: [{
        file: './dist/leaflet-dataclassification.js',
        //format: 'umd',
        //name: 'leaflet-dataclassification'
    }],
    external: ['leaflet']
},{
    plugins: [
        nodeResolve()
    ],
    // https://github.com/Leaflet/Leaflet/blob/main/PLUGIN-GUIDE.md#script-tags-and-the-global-build
    input: './build/global.js',
    output: {
        file: './dist/leaflet-dataclassification-global.js', 
        format: 'iife', 
        globals: {'leaflet': 'L', 'simple-statistics': 'ss', 'chroma-js': 'chroma'}
    },
    external: ['leaflet']
}]