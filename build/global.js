// build/global.js
import {DataClassification} from '../src/leaflet-dataclassification.js';

// leaflet is external here and resolves to window.L, from 1.x's leaflet.js or 2.0's leaflet-global.js
window.L.DataClassification = DataClassification;

// 2.0 has no factories, so only 1.x pages get the 1.x-style one
if (L.version.startsWith('1.')) {
    L.dataClassification = (data, options) => new DataClassification(data, options);
}