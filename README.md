# leaflet-dataclassification

Classifies quantitative data from attributes, styles the features appropriately and also creates a clean, simple and appealing legend depicting the value classes and their associated symbols, all combined in a single step. Classifying point features can be done based on symbol color and size, line features based on color and width, polygon features based on fill color (for choropleth maps) and fill pattern (hatch fill). Extends the L.geoJSON layer.

Aims to simplify data visualization and creation of elegant thematic web maps with Leaflet using GeoJSON data, with a more traditional approach of thematic cartography. Although tutorials for defining style functions (to retrieve class colors through pre-defined conditional statements) and basic legend creation exist for Leaflet, those are static (are only created for a specific dataset) and might require using GIS software beforehand to classify and style the dataset properly (to get class boundaries and exact colors), in order to have a visualization that gets the message through. This customizable plugin automates all this and can easily be used for any dataset with quantitative data. As it extends L.GeoJSON, you can have multiple layers of this (with a matched legend for each) to create a more complex data visualization.

![Screenshot of example maps created with the plugin. Samples.](screenshots.png)

## Features
- Classification and styling of:
    - Point features based on color and size (graduated symbol sizes)
    - Line features based on line color and width (graduated line widths)
    - Polygon features based on fill color (choropleth map) and hatch fill pattern (thanks to [leaflet-hatchclass](https://github.com/samanbey/leaflet-hatchclass))
- Supported classification methods (mostly thanks to [simple-statistics.js](https://github.com/simple-statistics/simple-statistics)):
    - natural breaks (Jenks)
    - quantile (equal count)
    - equal interval
    - standard deviation
    - logarithmic scale
    - manual
- Supports ColorBrewer2 color ramps and custom color ramps (thanks to [chroma.js](https://github.com/gka/chroma.js))
- Various SVG shapes/symbols for Point features
- For size/width based symbology, min and max values can be adjusted to create a telling visualization with distinguishable classes
- Normalization by another attribute field
- Rounding of class boundary values to *n* decimals or up/down to the nearest 10, 100, 1000 etc. numbers
- Handling of null/nodata feature attributes
- Legend generation with options for:
    - class order (ascending/descending)
    - legend header (title), footer
    - custom HTML templating of legend rows, including the display of feature counts in classes
    - modifying class boundary values in legend by dividing/multiplying by a number (to easily change unit of measurement from m to km for example)
    - positioning (L.control options)
    - row gap adjustments

## Demo
All features in the examples listed here have binded tooltips (a default Leaflet feature) for an easier check of attribute values.
- combined (three layers): [./examples/combined.html](https://balladaniel.github.io/leaflet-dataclassification/examples/combined.html)
- points (color, 92 points): [./examples/points_c.html](https://balladaniel.github.io/leaflet-dataclassification/examples/points_c.html)
- points (size, 471 points with diamond-shaped symbols): [./examples/points_s.html](https://balladaniel.github.io/leaflet-dataclassification/examples/points_s.html)
- lines (color, 4879 lines): [./examples/lines_c.html](https://balladaniel.github.io/leaflet-dataclassification/examples/lines_c.html)
- lines (width, 109 lines): [./examples/lines_w.html](https://balladaniel.github.io/leaflet-dataclassification/examples/lines_w.html)
- polygons (color, 16 polygons): [./examples/polygons_c.html](https://balladaniel.github.io/leaflet-dataclassification/examples/polygons_c.html)
- polygons (color 2, 3220 polygons): [./examples/polygons_c2.html](https://balladaniel.github.io/leaflet-dataclassification/examples/polygons_c2.html)
- polygons (hatch fill, with both width/angle as distinction, 334 polygons): [./examples/polygons_h.html](https://balladaniel.github.io/leaflet-dataclassification/examples/polygons_h.html)

## Requirements
- [Leaflet](https://github.com/Leaflet/Leaflet) (tested with v1.9.4)
### External dependencies
- [simple-statistics.js](https://github.com/simple-statistics/simple-statistics) (tested with v7.8.0)
- [chroma.js](https://github.com/gka/chroma.js) (tested with v2.6.0)
- [leaflet-hatchclass](https://github.com/samanbey/leaflet-hatchclass) (only if you intend to use hatch pattern fills for polygons)

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
    field: 'population',
    // optional:					
    pointMode: 'size',
    pointSize: {min: 2, max: 10},
    pointShape: 'square',
    lineMode: 'width',
    lineWidth: {min: 1, max: 15},
    polygonMode: 'color',
    polygonHatch: {
        strokeColors: ['lightgreen', '#fff8b5'], 
        strokeWidth: {min: -1, max: 13},
        distinctionMode: 'both',
        angle: 45,
        alternateAngle: 45
    },
    colorRamp: 'OrRd',
    colorCustom: ['rgba(210,255,178,1)', '#fec44f', 'f95f0eff'],  // if specified, overrides colorRamp!
    noDataColor: '#101010',
    noDataIgnore: false,
    reverseColorRamp: false,
    middlePointValue: 0,
    classRounding: 2,
    normalizeByField: 'areakm2',
    legendTitle: 'Density (pop/km²)',
    legendFooter: '(additional info in footer)',
    legendPosition: 'bottomleft',
    legendRowGap: 5,
    legendAscending: false,	
    legendTemplate: {
        highest: '{low} and above [{count}]',
        middle: '{low} – {high} [{count}]',
        lowest: 'below {high} [{count}]',
        nodata: 'No data [{count}]'
    },
    unitModifier: {action: 'divide', by: 1000},
    style: {
        fillColor: 'purple',    // marker fill color in point/size mode
        radius: 8,              // marker shape radius (size) in point/color mode,
        fillOpacity: 0.7,       // polygon fill opacity in polygon modes
        color: '#aabbcc',       // line stroke color in line/width mode, polygon outline stroke color in polygon modes
        weight: 5,              // line stroke weight in line/color mode, polygon outline stroke weight in polygon modes
    }
}.addTo(map);
```

### Required options 
- `mode <string>`: ['jenks'|'quantile'|'equalinterval'|'logarithmic'|'stddeviation'|'manual'] classification method: natural break (Jenks), equal count (quantile), equal interval, logarithmic scale, standard deviation, manual. When using standard deviation, option `classes` is ignored. When using manual (which partially defeats the purpose of this plugin), option `classes` must be an array of class boundary values!
- `classes <integer|array>`: desired number of classes (min: 3; max: 10 or featurecount, whichever is lower. If higher, reverts back to the max of 10.). If `mode` is manual, this must be an array of numbers (for example [0, 150, 200] would yield the following three classes: below 150, 150-200, above 200). 
- `field <string>`: target attribute field name to base classification on. Case-sensitive!

### Additional options (in addition to the standard L.geoJSON options)
#### Specific for Point	features
- `pointMode <string>`: ['color'|'size'] fill "color" or "size" (default: 'color')
- `pointSize <object>`: when pointMode: "size", define min/max point circle radius 
    - `min <float>`: symbol size for the lowest class. (default: 2)
    - `max <float>`: symbol size for the highest class. (default: 10)
- `pointShape <string>`: ['circle'|'square'|'diamond'] shape of points: 'circle', 'square', 'diamond' (default: 'circle')
- `style <object>`: custom styling
    - `fillColor <string>`: marker fill color, use only in size mode (default: orange)
    - `radius <float>`: marker shape radius (size), use only in color mode (default: 8, max: 10-12)
#### Specific for Line features
- `lineMode <string>`: ['color'|'width'] stroke "color" or "width" (default: 'color')
- `lineWidth <object>`: when lineMode: "width", define min/max stroke width as object
    - `min <float>`: symbol size for the lowest class. (default: 3)
    - `max <float>`: symbol size for the highest class. (default: 15)
- `style <object>`: custom styling
    - `color <string>`: line stroke color, use only in width mode (default: blue, the L.path default)
    - `weight <float>`: line stroke weight, use only in color mode (default: 3, the L.path default)
#### Specific for Polygon features
- `polygonMode <string>`: ['color'|'hatch'] fill "color" or "hatch" (default: 'color')
- `polygonHatch <object>`: when polygonMode: "hatch", customize hatch fill pattern
    - `distinctionMode <string>`: ['width'|'angle'|'both'] symbol distinction type between classes (default: 'both')
    - `strokeColors <array<string>>`: stroke colors (default: ['darkred', 'none'])
    - `strokeWidth <object>`: stroke widths to gradually alternate between for symbols, when distinctionMode: 'width' or both'.
        - `min <float>`: stroke width of the first color. Tip: set to -1 to have solid fills on two ends of the symbols' spectrum, only in distinctionMode: 'width' and 'both'. (default: 2)
        - `max <float>`: stroke width of the other color (default: 10)
    - `angle <number>`: initial angle for hatch pattern (leaflet-hatchclass default: 45)
    - `alternateAngle <number>`: value to increment angle with between all hatch fill symbols, when distinctionMode: 'angle' or both'
- `style <object>`: custom styling
    - `fillOpacity <float>`: polygon fill opacity (default: 0.7)
    - `color <string>`: polygon outline color (default: '#3388ff' blue, the L.path default)
    - `weight <float>`: polygon outline stroke width (default: 3, the L.path default)

#### General options
- `colorRamp <string>`: color ramp to use for symbology (only used with modes in which color is the way of distinction between symbols). Based on ColorBrewer2 color ramps (https://colorbrewer2.org/), included in Chroma.js. Custom colors (`colorCustom`) override this. (default: 'PuRd')
- `colorCustom <array<string>>`: custom color ramp defined as an array, colors in formats supported by Chroma.js, with opacity support. A minimum of two colors are required. If defined, custom colors override `colorRamp`. Example: ['rgba(210,255,178,1)', '#fec44f', 'f95f0eff']. Examples for yellow in different color formats: '#ffff00', 'ffff00', '#ff0', 'yellow', '#ffff0055', 'rgba(255,255,0,0.35)', 'hsla(58,100%,50%,0.6)', chroma('yellow').alpha(0.5). For more formats, see: https://gka.github.io/chroma.js/. For an interactive color palette helper, see: https://gka.github.io/palettes/.
- `noDataColor <string>`: fill/line color to use for features with null/nodata attribute values. (default: '#606060')
- `noDataIgnore <boolean>`: if true, features with null attribute values are not shown on the map. This also means the legend will not have a nodata class (default: false)
- `reverseColorRamp <boolean>`: if true, reverses the chosen color ramp, both in symbology on map and legend colors. Useful when you found a great looking colorramp (green to red), but would prefer reversed colors to match visual implications about colors: green implies positive, red implies negative phenomena. (default: false)
- `middlePointValue <number>`: adjust boundary value of middle classes (only when classifying into even classes). Useful for symmetric classification of diverging data around 0. Only use a value within the range of the two middle classes.    
- `classRounding <integer>`: class boundary value rounding. When positive numbers are used for this option, class boundary values are rounded to x decimals, zero will round to whole numbers, while negative numbers will round values to the nearest 10, 100, 1000, etc. Example: with a setting of "1", a value of 254777.253 will get rounded up to 254777.3, with "0" it will be 254777, with "-2" it will become 254800. (default: null - no rounding happens, values are used as-is)
- `normalizeByField <string>`: attribute field name to normalize values of `field` by. Useful for choropleth maps showing population density. Case-sensitive!
- `legendTitle <string>`: legend header (usually a description of visualized data, with a unit of measurement). HTML-markdown and styling allowed. To hide header, set this as ''. (by default it inherits target attribute field name, on which the classification is based on)
- `legendFooter <string>`: legend footer, centered, using a smaller italic font by default (customizble in CSS - .legendFooter class). HTML-markdown and CSS styling allowed. Hidden by default. (default: null)
- `legendPosition <string>`: ['topleft'|'topright'|'bottomleft'|'bottomright'] legend position, L.control option. (default: 'bottomleft')
- `legendRowGap <number>`: legend symbology row gap in pixels. You can also alter this in the attached CSS file. (default: 3)
- `legendAscending <boolean>`: if true, value classes in legend will be ascending (low first, high last) (default: false)
- `legendTemplate <object>`: custom HTML formatting of legend rows using {high}, {low} and {count} placeholders (interpreted as high/low value and feature count in the context of a given class interval). Distinct formatting for the highest, lowest and middle class intervals. Middle class format requires both {high} and {low}, highest only {low} and lowest only {high}. You can also format the row for nodata, if there are features with null attributes and you wish to show a class for them in the legend (defined by `noDataIgnore`).
    - `highest <string>`: template for the upper end of classes, "highest value and above" (default: '{low} <')
    - `middle <string>`: template for rows in the middle, "low to high" (default: '{low} – {high}')
    - `lowest <string>`: template for the lower end of classes, "lowest value and below" (default: '< {high}')
    - `nodata <string>`: text to show for null/nodata class (default: 'No data')
- `unitModifier <object>`: modifies the final class boundary values in order to multiply/divide them by a number. Useful for example when a dataset attribute is in metres, but kilometres would fit the legend better (786000 metres shown as 786 km). Purely visual, only affects legend. Happens after classRounding.
    - `action <string>`: ['divide'|'multiply'] action to take on the number specified by `by`. Required for `unitModifier`.
    - `by <number>`: a number to divide/multiply class boundary values with. Required for `unitModifier`.

## Hatch fill pattern types
Hatch fill patterns provided by [leaflet-hatchclass](https://github.com/samanbey/leaflet-hatchclass). (Gede, M.: Hatch Fill on Webmaps – to Do or Not to Do, and How to Do, Abstr. Int. Cartogr. Assoc., 5, 48, https://doi.org/10.5194/ica-abs-5-48-2022, 2022.)

![Screenshot of different hatch fill pattern modes (distinctionMode option). Samples.](screenshots_hatchfill.png)

## How to cite
If you happen to use the plugin in connection with a scientific publication, please refer to: 

**Balla, D. and Gede, M.: Beautiful thematic maps in Leaflet with automatic data classification, Int. Arch. Photogramm. Remote Sens. Spatial Inf. Sci., XLVIII-4/W12-2024, 3–10, https://doi.org/10.5194/isprs-archives-XLVIII-4-W12-2024-3-2024, 2024.**

The publication gives an overview of features offered (and not offered) by Leaflet specifically for creating thematic maps and it also includes a basic performance assessment of the plugin.
