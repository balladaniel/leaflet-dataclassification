# leaflet-dataclassification

Classifies quantitative data from attributes, styles the features appropriately and also creates a clean, simple and appealing legend depicting the value classes and their associated symbols, all combined in one step. Classifying point features can be done based on color and size, line features based on color and width, polygon features based on fill color (for choropleth maps). Extends the L.GeoJSON layer.

Aims to simplify data visualization and creation of elegant thematic web maps with Leaflet using GeoJSON data, with a more traditional approach of thematic cartography. Although tutorials for defining style functions (to retrieve class colors through pre-defined conditional statements) and basic legend creation exist for Leaflet, those are static (are only created for a specific dataset) and might require using GIS software beforehand to classify and style the dataset properly (to get class boundaries and exact colors), in order to have a visualization that gets the message through. This customizable plugin automates all this and can easily be used for any dataset with quantitative data. As it extends L.GeoJSON, you can have multiple layers of this (with a matched legend for each) to create a more complex data visualization.

[SCREENSHOT]

## Features
- Classification and styling of:
    - Point features based on color and size (graduated symbol sizes)
    - Line features based on line color and width (graduated line widths)
    - Polygon features based on fill color
- Supported classification methods (thanks to [simple-statistics.js](https://github.com/simple-statistics/simple-statistics)):
    - natural breaks (Jenks)
    - quantile
    - equal interval
- Supports ColorBrewer2 color ramps and custom color ramps (thanks to [chroma.js](https://github.com/gka/chroma.js))
- Various SVG shapes/symbols for Point features
- For size/width based symbology, min and max values can be adjusted to create a telling visualization with distinguishable classes
- Legend generation with options for:
    - class order (ascending/descending)
    - legend header (title)
    - rounding of class boundary values to n decimals

## Demo
- combined (three layers): [./examples/combined.html](https://balladaniel.github.io/leaflet-dataclassification/examples/combined.html)
- points (color): [./examples/points_c.html](https://balladaniel.github.io/leaflet-dataclassification/examples/points_c.html)
- points (size, with diamond-shaped symbols): [./examples/points_s.html](https://balladaniel.github.io/leaflet-dataclassification/examples/points_s.html)
- lines (color): [./examples/lines_c.html](https://balladaniel.github.io/leaflet-dataclassification/examples/lines_c.html)
- lines (width): [./examples/lines_w.html](https://balladaniel.github.io/leaflet-dataclassification/examples/lines_w.html)
- polygons: [./examples/polygons.html](https://balladaniel.github.io/leaflet-dataclassification/examples/polygons.html)

## Requirements
- [Leaflet](https://github.com/Leaflet/Leaflet) (tested with v1.9.4)
### External dependencies
- [simple-statistics.js](https://github.com/simple-statistics/simple-statistics) (tested with v7.8.0)
- [chroma.js](https://github.com/gka/chroma.js) (tested with v2.4.0)

Include dependencies plus `leaflet-dataclassification.css` and `leaflet-dataclassification.js` in your code. You can also link them through GitHub Pages:
``` html
<link rel="stylesheet" href="https://balladaniel.github.io/leaflet-dataclassification/leaflet-dataclassification.css" />
<script src="https://balladaniel.github.io/leaflet-dataclassification/leaflet-dataclassification.js"></script>
```

## Usage example
``` javascript
const layer = L.dataClassification(data, {
    // required:
    mode: 'quantile',
    classes: 4,
    field: 'density',
    // optional:					
    pointMode: 'size',
    pointSize: {min: 2, max: 10},
    pointShape: 'square',
    lineMode: 'width',
    lineWidth: {min: 1, max: 15},
    colorRamp: 'OrRd',
    colorCustom: ['rgba(210,255,178,1)', '#fec44fff', 'f95f0eff'],    // if specified, overrides colorRamp!
    legendAscending: false,	
    reverseColorRamp: false,
    middlePointValue: 0,
    legendTitle: 'Density (pop/km²)',	
    classRounding: 2
}.addTo(map);
```

### Required options 
- `mode <string>`: ['jenks'|'quantile'|'equalinterval'] classification method: jenks, quantile, equalinterval
- `classes <integer>`: desired number of classes (min: 3; max: 10 or featurecount, whichever is lower. If higher, reverts back to the max of 10.)
- `field <string>`: target attribute field name to base classification on. Case-sensitive!

### Additional options (in addition to the standard L.geoJSON options)
#### Specific for Point	features
- `pointMode <string>`: ['color'|'size'] fill "color" or "size" (default: 'color')
- `pointSize <object>`: when pointMode: "size", define min/max point circle radius (defaults: {min: 2, max: 10}, recommended max: 12)
- `pointShape <string>`: ['circle'|'square'|'diamond'] shape of points: 'circle', 'square', 'diamond' (default: 'circle')
#### Specific for Line features
- `lineMode <string>`: ['color'|'width'] stroke "color" or "width" (default: 'color')
- `lineWidth <object>`: when lineMode: "width", define min/max stroke width as object (defaults: {min: 1, max: 15}, recommended max: 20)
#### General options
- `colorRamp <string>`: color ramp to use for symbology. Based on ColorBrewer2 color ramps (https://colorbrewer2.org/), included in Chroma.js. Custom colors (`colorCustom`) override this. (default: 'PuRd')
- `colorCustom <array>`: custom color ramp defined as an array, colors in formats supported by Chroma.js, with opacity support. A minimum of two colors are required. If defined, custom colors override `colorRamp`. Example: ['rgba(210,255,178,1)', '#fec44fff', 'f95f0eff']. Examples for yellow in different color formats: 'ffff00', '#ff0', 'yellow', '#ffff0055', 'rgba(255,255,0,0.35)', 'hsla(58,100%,50%,0.6)', chroma('yellow').alpha(0.5). For more formats, see: https://gka.github.io/chroma.js/.
- `legendAscending <boolean>`: if true, value classes in legend will be ascending (low first, high last) (default: false)
- `reverseColorRamp <boolean>`: if true, reverses the chosen color ramp, both in symbology on map and legend colors. Useful when you found a great looking colorramp (green to red), but would prefer reversed colors to match visual implications about colors: green implies positive, red implies negative phenomena. (default: false)
- `middlePointValue <number>`: adjust boundary value of middle classes (only when classifying into even classes). Useful for symmetric classification of diverging data around 0. Only use a value within the range of the two middle classes.    
- `legendTitle <string>`: legend header (usually a description of visualized data, with a unit of measurement). HTML-markdown and styling allowed. To hide header, set this as ''. (by default it inherits target attribute field name, on which the classification is based on)
- `classRounding <integer>`: round class boundary values to a decimal place (default: 0 for whole numbers), set -1 to disable rounding