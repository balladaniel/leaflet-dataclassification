import { nodeResolve } from '@rollup/plugin-node-resolve'; // needed for bundling dependencies
import commonjs from '@rollup/plugin-commonjs'; // needed for bundling dependencies

export default [{
    plugins: [
        nodeResolve(), 
        /*commonjs({
            //defaultIsModuleExports: true
        })*/
    ],
    input: './leaflet-dataclassification.js',
    output: [{
        file: './leaflet-dataclassification_bundletest.js',
        //format: 'umd',
        //name: 'leaflet-dataclassification',
        //name: 'DataClassification',
        //globals: {leaflet: 'L'},
        //exports: 'named'
    }],
    //external: ['leaflet']
},{
    // https://github.com/Leaflet/Leaflet/blob/main/PLUGIN-GUIDE.md#script-tags-and-the-global-build
    input: './build/global.js',
    output: {
        file: './leaflet-dataclassification_bundletest_global.js', 
        format: 'iife', 
        globals: {leaflet: 'L', 'simple-statistics': 'ss', 'chroma-js': 'chroma'}
    },
    external: ['leaflet', 'simple-statistics', 'chroma-js']
}]