/**
 * class L.DataClassification()
 * 
 * (extends L.GeoJSON)
 * 
 * classifies point, line or polygon features by chosen quantitative-type attribute
 * stylizes features on map accordingly
 * generates an appropriate legend for visualized data
 * 
 * project page: https://github.com/balladaniel/leaflet-dataclassification 
 *
 * MIT License
 * Copyright (c) 2023 Dániel Balla
*/

L.DataClassification = L.GeoJSON.extend({
    options: {
        // NOTE: documentation in this object might not be up to date. Please always refer to the documentation on GitHub.
        // default options
        mode: 'quantile',							// classification method: jenks, quantile, equalinterval, logarithmic, stddeviation (when using stddev, `classes` is ignored!), manual (when using manual, `classes` must be an array!)
        classes: 5,									// desired number of classes (min: 3, max: 10 or featurecount, whichever is lower)
        pointMode: 'color', 						// POINT FEATURES: fill "color" or "size" (default: color)
        pointSize: {min: 2, max: 10},               // POINT FEATURES: when pointMode: "size", define min/max point circle radius (default min: 2, default max: 10, recommended max: 12)
        pointShape: 'circle',						// POINT FEATURES: shape of points: 'circle', 'square', 'diamond' (default: 'circle')
        lineMode: 'width', 							// LINE FEATURES: stroke "color" or "width" (default: color)
        lineWidth: {min: 3, max: 15},				// LINE FEATURES: when lineMode: "width", define min/max stroke width as object (default min: 1, default max: 15, recommended max: 20)
        polygonMode: 'color',                       // POLYGON FEATURES: fill "color" or "hatch" (default: color)
        polygonHatch: {                             // POLYGON FEATURES: when polygonMode: "hatch", define hatch stroke colors and min/max widths to alternate between for individual classes.
            strokeColors: ['darkred', 'none'],      // POLYGON HATCHING: stroke colors
            strokeWidth: {min: 2, max: 10},         // POLYGON HATCHING: stroke widths
            distinctionMode: 'both',                // POLYGON HATCHING: resulting symbol distinction type between classes. width/angle/both
            angle: 45,                              // POLYGON HATCHING: initial angle
            alternateAngle: 45                     // POLYGON HATCHING: value to increment angle with between all hatch fill symbols
        },                           
        colorRamp: 'purd',							// color ramp to use in symbology. Based on ColorBrewer2 color ramps, included in Chroma.js: https://colorbrewer2.org/. (default: PuRd)
        /*colorCustom: [	'rgba(210,255,178,1)', 
                        '#fec44fff', 
                        'f95f0eff'],*/				// custom color ramp as an array, colors in format supported by Chroma.js, with opacity support. A minimum of two colors are required.
                                                    // (examples for yellow: 'ffff00', '#ff0', 'yellow', '#ffff0055', 'rgba(255,255,0,0.35)', 'hsla(58,100%,50%,0.6)', 
                                                    // chroma('yellow').alpha(0.5). For more, see: https://gka.github.io/chroma.js/)
                                                    // Custom colors override colorRamp.
        noDataColor: '#606060',                     // fill/stroke color to use for features with null/nodata attribute values, in polygon, point/color and line/color modes  (default: '#606060')
        noDataIgnore: false,                        // if true, features with null attribute values are not shown on the map. This also means the legend will not have a nodata classs (default: false)
        legendAscending: false,						// true = values in legend will be ascending (low first, high last) (default: false)
        reverseColorRamp: false,					// true = reverse the chosen color ramp, both in symbology on map and legend colors. (default: false)
                                                    // Useful if you found a great looking colorramp (green to red), but would prefer reversed colors 
                                                    // (for example to match visual implications about colors: green implies positive, red implies negative phenomena)
        /*middlePointValue: 0,*/					// optional: adjust boundary value of middle classes (only for even classcount), useful for symmetric classification of diverging data around 0 for example. Only use a value within the original middle classes range.
        /*field: '',*/					            // target attribute field name. Case-sensitive!
        /*normalizeByField: '',*/                   // attribute field name to normalize values of `field` by. Useful for choropleth maps showing population density. Case-sensitive!
        legendTitle: '',					        // title for legend (usually a description of visualized data, with a unit of measurement). HTML-markdown and styling allowed. If you want to hide title, set this as 'hidden'. (default: ='field')
        legendFooter: null,					        // legend footer, italic and a smaller font by default (see attached css - .legendFooter class). HTML-markdown and CSS styling allowed. Hidden by default. (default: null)
        classRounding: null,                        // class boundary value rounding. Positive numbers round to x decimals, zero will round to whole numbers, negative numbers will round values to the nearest 10, 100, 1000, etc. (default: null - no rounding, values are used as-is)
        unitModifier: null,                         // modifies the final class boundary values in order to multiply/divide them. Useful when a dataset attribute is in metres, but kilometres would fit the legend better, for example 786000 metres shown as 786 km. Purely visual, only affects legend.
        legendPosition: 'bottomleft',               // Legend position (L.control option: 'topleft', 'topright', 'bottomleft' or 'bottomright')
        legendTemplate: {                           // Legend row template for custom formatting using {high} and {low} placeholders (interpreted as high/low value in the context of a given class). Placeholder {count} represents feature count in that class. Distinct formatting for the highest, lowest and middle classes (legend rows). Middle class format requires both {high} and {low}, highest only {low} and lowest only {high}. You can also format the row for nodata.
            highest: '{low} <',
            middle:  '{low} – {high}',
            lowest: '< {high}',
            nodata: 'No data'
        },
        legendRowGap: null,       

        style: {
            fillColor: 'orange',
            fillOpacity: 0.7,
            color: L.Path.prototype.options.color,
            weight: L.Path.prototype.options.weight,
            radius: 8
        }
    },

    // variables for plugin scope
    _legends: [],
    _classes: [],
    _colors: [],
    _radiuses: [],
    _widths: [],
    _pointMarkers: [],
    _unitMod: {},
    _field: '',
    _normalizeByField: '',
    _pointShape: '',
    _linecolor: '',
    _lineweight: '',
    _legendPos: '',
    _legendTemplate: {},
    _noDataFound: false,
    _noDataIgnore: false,
    _noDataColor: '',

    // value evaluators to match classes
    /**
     * Value evaluator to match a color class (POINTS/COLOR, LINES/COLOR, POLYGON/COLOR modes). While evaluating, also counts the number of features in given class.
     * @param {float} d - Number to match a class to
     * @returns {string} Symbol color of the class
     */
    _getColor(d) {
        for (var i = 0; i<classes.length; i++) {
            if (classes[i+1] != null) {
                if (d < classes[i+1].value) {
                    ++classes[i].featureCount;
                    return colors[i];
                } 	
            }				
        }
        // highest group
        ++classes[classes.length-1].featureCount;
        return colors.at(-1);	
    },

    /**
     * Value evaluator to match a line width class (LINES/WIDTH mode). While evaluating, also counts the number of features in given class.
     * @param {float} d - Number to match a class to
     * @returns {float} Symbol width of the class
     */
    _getWeight(d) {
        for (var i = 0; i<classes.length; i++) {
            if (classes[i+1] != null) {
                if (d < classes[i+1].value) {
                    ++classes[i].featureCount;
                    return widths[i];
                } 					
            } 					
        }
        // highest group
        ++classes[classes.length-1].featureCount;
        return widths.at(-1);
    },

    /**
     * Value evaluator to match a point symbol size class (POINTS/SIZE mode). While evaluating, also counts the number of features in given class.
     * @param {float} d - Number to match a class to
     * @returns {float} Symbol radius of the class
     */
    _getRadius(d) {
        for (var i = 0; i<classes.length; i++) {
            if (classes[i+1] != null) {
                if (d < classes[i+1].value) {
                    ++classes[i].featureCount;
                    return radiuses[i];
                }
            }
        }
        // highest group
        ++classes[classes.length-1].featureCount;
        return radiuses.at(-1);
    },

    /**
     * Value evaluator to match a polygon hatch fill symbol class (POLYGONS/HATCH mode). While evaluating, also counts the number of features in given class.
     * @param {float} d - Number to match a class to
     * @returns {string} Symbol hatch fill pattern CSS class name
     */
    _getHatch(d) {
        for (var i = 0; i<classes.length; i++) {
            if (classes[i+1] != null) {
                if (d < classes[i+1].value) {
                    ++classes[i].featureCount;
                    return hatchclasses[i];
                }
            }
        }
        // highest group
        ++classes[classes.length-1].featureCount;
        return hatchclasses.at(-1);
    },

    // stylers
    /**
     * Feature styler for point/color mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @returns {object} Final symbol style of the feature
     */
    _stylePoint_color(value){
        return {
            fillColor: (value != null ? getColor(value) : options.noDataColor),
            fillOpacity: 1,
            color: "black",
            weight: 1,
            shape: "circle",
            radius: options.style.radius
        };
    },

    /**
     * Feature styler for point/size mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @param {object} options - Custom styling (see the `style` option)
     * @returns {object} Final symbol style of the feature
     */
    _stylePoint_size(value, options){
        return {
            fillColor: (value != null ? (options.style.fillColor != null ? options.style.fillColor : 'orange') : options.noDataColor),
            fillOpacity: 1,
            color: "black",
            weight: 1,
            shape: "circle",
            radius: (value != null ? getRadius(value) : Math.min.apply(Math, radiuses))
        };
    },

    /**
     * Feature styler for line/color mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @returns {object} Final symbol style of the feature
     */
    _styleLine_color(value){
        return {
            color: (value != null ? getColor(value) : options.noDataColor)
        };
    },

    /**
     * Feature styler for line/width mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @returns {object} Final symbol style of the feature
     */
    _styleLine_width(value){
        return {
            weight: (value != null ? getWeight(value) : Math.min.apply(Math, widths)),
            color: (value != null ? (options.style.color != null ? options.style.color : L.Path.prototype.options.color) : options.noDataColor)
        };
    },

    /**
     * Feature styler for polygon/color mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @param {object} options - Custom styling (see the `style` option)
     * @returns {object} Final symbol style of the feature
     */
    _stylePolygon_color(value, options){
        return {
            fillColor: (value != null ? getColor(value) : options.noDataColor),
            fillOpacity: (options.style.fillOpacity != null ? options.style.fillOpacity : 0.7),
            /*color: 'white',
            weight: 2*/
        };
    },

    /**
     * Feature styler for polygon/hatch mode. Different to the other feature styler, since this returns a formatted string which is then used for the `fill` CSS property.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @returns {string} Final symbol style of the feature (as a string, which is used for CSS-`fill` later.)
     */
    _stylePolygon_hatch(value, options){
        var style;
        if (value != null) {
            style = 'url(#' + getHatch(value) + ')';
        } else {
            style = options.noDataColor;
        }
        return style;
    },
    
    // get n categories of point radiuses, line widths for symbology
    /**
     * Generates a range of symbol sizes for point/size mode. Fills up global array `radiuses[]`.
     * @param {Object} sizes - Symbol size information
     * @param {float} sizes.min - Minimum symbol size, radius (symbol of the lowest class)
     * @param {float} sizes.max - Maximum symbol size, radius (symbol of the highest class)
     */
    _pointMode_size_radiuses(sizes){
        radiuses = [];
        
        var step = (sizes.max - sizes.min) / (classes.length - 1);
        for (var i = 0; i < classes.length; i++) {
            var curr = sizes.min + (step * i);
            radiuses.push(curr);
        }
        console.debug('points: radius categories:', radiuses)
    },
    /**
     * Generates a range of symbol sizes for line/width mode. Fills up global array `widths[]`.
     * @param {Object} sizes - Symbol size information
     * @param {float} sizes.min - Minimum symbol size, width (symbol of the lowest class)
     * @param {float} sizes.max - Maximum symbol size, width (symbol of the highest class)
     */
    _lineMode_width(sizes){
        widths = [];
        
        var step = (sizes.max - sizes.min) / (classes.length - 1);
        for (var i = 0; i < classes.length; i++) {
            widths.push(sizes.min + (step * i));
        }
        console.debug('lines: width categories:', widths)
    },

    _polygonMode_hatch(options){
        if (options.strokeColors != null && options.strokeColors.length != 2) {
            console.error('Currently, polygonMode "hatch" requires exactly two colors to alternate lines between. Check the polygonHatch/strokeColors property. Working example: ["red", "orange"] or ["red", "none"]')
            return;
        }
        hatchclasses = [];
        var swMin, swMax, angle, altAng;
        // defaults
        if (options.strokeWidth != null) {
            if (options.strokeWidth.min == null){
                swMin = 2;
            } else {
                swMin = options.strokeWidth.min; 
            }
            if (options.strokeWidth.max == null) {
                swMax = 10;
            } else {
                swMax = options.strokeWidth.max;
            }
        } else {
            swMin = 2;
            swMax = 10;
        };
        (options.distinctionMode != null ? '' : options.distinctionMode = 'both');
        (options.strokeColors != null ? '' : options.strokeColors = ['darkred', 'none']);
        (options.angle != null ? angle = options.angle : angle = 45);
        (options.alternateAngle != null ? altAng = options.alternateAngle : altAng = 45);
        var step = (swMax - swMin) / (classes.length - 1);

        switch (options.distinctionMode) {
            case 'width':
                console.debug('hatch distinction mode: `width`');
                for (var i = 0; i < classes.length; i++) {
                    console.debug('current hatch class line widths: swMin:', swMin, 'swMax:', swMax);
                    hatchclasses.push(L.hatchClass([{ color: options.strokeColors[0], width: swMax }, { color: options.strokeColors[1], width: swMin }], null, angle));
                    swMin += step;
                    swMax -= step;
                }
                break;
            case 'angle':
                console.debug('hatch distinction mode: `angle`');
                if (altAng == 0) {
                    console.warn('You are using hatch distinction mode: `angle`. Since this mode is supposed to only alter hatch stroke angle between class symbols, and option `alternateAngle` was set to 0, you will not be able to distinguish them. Overridden value with 45.');
                    altAng = 45;
                }
                if (95 >= altAng && altAng >= 85 || 185 >= altAng && altAng >= 175 || 275 >= altAng && altAng >= 265) {
                    console.warn('In this mode (`angle`), alternating angles around pi/2 (90), pi (180), 3pi/2 (270) result in very similar or same hatch fill symbols. Consider adjusting hatch angle to ~45°.');
                }
                for (var i = 0; i < classes.length; i++) {
                    hatchclasses.push(L.hatchClass([{ color: options.strokeColors[0], width: swMax }, { color: options.strokeColors[1], width: swMin }], null, (altAng != 0 ? angle+altAng*i : angle)));
                }
                break;
            case 'both':
                console.debug('hatch distinction mode: `both`');
                if (altAng == 0) {
                    console.warn("You are using hatch distinction mode: `both`. Since this mode is supposed to alter both hatch stroke angle and width between class symbols, and option `alternateAngle` was set to 0, you wouldn't see any difference in stroke angle (and therefore could just simply use mode `width`). Overridden value with 45.");
                    altAng = 45;
                }
                for (var i = 0; i < classes.length; i++) {
                    console.debug('current hatch class line widths: swMin:', swMin, 'swMax:', swMax);
                    hatchclasses.push(L.hatchClass([{ color: options.strokeColors[0], width: swMax }, { color: options.strokeColors[1], width: swMin }], null, (altAng != 0 ? angle+altAng*i : angle)));
                    swMin += step;
                    swMax -= step;
                }
                break;
        }
        hatchclasses.reverse();
        console.debug('polygons: hatchclasses:', hatchclasses)
    },

    /**
     * SVG creator. This creates symbols for the point/size and point/color modes.
     * @param {Object} options Options for the SVG to be created
     * @param {('circle'|'square'|'diamond')} options.shape Choose from circle, square, diamond shapes for symbol
     * @param {string} options.color Fill color of the symbol
     * @param {number} options.size Size of the symbol
     * @returns {string} Final HTML-formatted SVG symbol as string.
     */
    _svgCreator(options){
        (options.shape == null ? options.shape = 'circle' : '');			// default shape
        (options.size == null ? options.size = 8 : '');						// default size
        var strokeWidth = 1;
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute('style', 'display: block'); // affects only svgs less than 14x14px in size, otherwise those are misplaced on marker: https://stackoverflow.com/questions/75342672/leaflet-small-divicons-less-than-14px-do-not-align-at-center-of-point
        svg.setAttribute('width', Math.ceil((options.size+strokeWidth)*2));
        svg.setAttribute('height', Math.ceil((options.size+strokeWidth)*2));
        svg.setAttribute('stroke', 'black');
        svg.setAttribute('stroke-width', strokeWidth);
        switch (options.shape) {
            case 'circle':
                var circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
                circle.setAttribute('cx', (options.size+strokeWidth));
                circle.setAttribute('cy', (options.size+strokeWidth));
                circle.setAttribute('r', options.size);
                circle.setAttribute('fill', options.color);
                svg.appendChild(circle);
                break;
            case 'square':
                svg.setAttribute('shape-rendering', 'crispEdges');
                var rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
                rect.setAttribute('x', strokeWidth);
                rect.setAttribute('y', strokeWidth);
                rect.setAttribute('height', options.size*2);
                rect.setAttribute('width', options.size*2);
                rect.setAttribute('fill', options.color);
                svg.appendChild(rect);
                break;
            case 'diamond':
                var path = document.createElementNS("http://www.w3.org/2000/svg", 'path');
                path.setAttribute('d', 'M '+strokeWidth+' '+parseFloat(options.size+strokeWidth)+' L '+parseFloat(options.size+strokeWidth)+' '+strokeWidth+' L '+parseFloat(options.size*2+strokeWidth)+' '+parseFloat(options.size+strokeWidth)+' L '+parseFloat(options.size+strokeWidth)+' '+parseFloat(options.size*2+strokeWidth)+' Z');
                path.setAttribute('fill', options.color);
                svg.appendChild(path);
                break;
            /*case 'triangle':
                svg = '<svg width="30" height="30" style="margin-left: 4px; scale: '+options.size/7.5+'; stroke: black; ">'+
                            '<polygon points="50 15, 100 100, 0 100" style="fill: '+options.color+'; scale: 0.2; transform: translateX(30px) translateY(15px)"/>'+
                        '</svg>'
                break;*/
            default:
                console.error('Invalid shape given. Choose one of the following: circle, square, diamond');
                break;
        }
        return svg;
    },

    /**
     * Does a one-time conversion of classes array to an array of objects (from now on, access class boundary value by classes[i].value).
     */
    _convertClassesToObjects() {
        classes = classes.map(function(element, idx) {
            return {
                value: element,
                featureCount: 0
            }
        });
        console.debug('Global array of class boundaries has been converted to an array of objects (access class boundary value by classes[i].value) and features were counted! New classes: ', classes)
    },

    /**
     * Recommends an optimal "classRounding" parameter in a console message, when it was set too extreme. Basically the reverse of function _classPostProc_rounding().
     * @param {integer} num - "classRounding" parameter set by user
     * @returns {integer} Optimal "classRounding" parameter to use. Goes out in a console warning later.
     */
    _classPostProc_roundinghelper(num) {
        // This recommends an optimal "classRounding" parameter in a console message, when it was set too high. Basically the reverse of function _classPostProc_rounding().
        var i = 1;
        var x;
        do {
            x = num/i
            i = i*10
        } while (num > i)
        return (Math.log10(i)*-1)+2;
    },

    _classPostProc_rounding(n) { 
        if (n >= 0) {
            // rounding to decimals using toFixed(), store string in classes object
            for (var i=0; i<classes.length; i++) {
                classes[i].value = +classes[i].value.toFixed(n);
                classes[i].valueFormattedString = classes[i].value.toFixed(n);
            }
            console.debug('Class interval boundary values have been rounded to', n, 'decimals. New classes:', classes)
        } else {
            // rounding up/down to 10s, 100s, 1000s etc.
            if (Math.max.apply(Math, classes.map(item => item.value)) < Math.pow(10,Math.abs(n))) {
                // check if the highest class boundary value is higher than the requested nearest value 
                // (requested -3, so 1000, while the maximum value is 386.2 - this would yield useless rounded values for classes, with ~all classes between 0 and 0.)
                console.error('Class interval boundary rounding error: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + 
                ') is larger than the highest class boundary value (' + Math.max.apply(Math, classes.map(item => item.value)) + '). Class intervals were untouched. Fix this by adjusting the "classRounding" option to ' 
                + this._classPostProc_roundinghelper(Math.max.apply(Math, classes.map(item => item.value))) + ' (optimal).');                
                return;
            }
            if (Math.max.apply(Math, classes.map(item => item.value)) < Math.pow(10,Math.abs(n-1))) {
                // the highest class boundary value vs. requested nearest value being high enough might cause problems (lowest class does not belong to any features etc.).
                console.warn('Class interval boundary rounding warning: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + ') might result in weird class boundaries and/or in the lowest class not belonging to any features on the map (class empty). Make sure the visualized data is correct on the map, otherwise, fix this by adjusting the "classRounding" option to ' + parseInt(n+1) + '.')
            }
            if (Math.round(classes[1].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n)) == Math.round(classes[2].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n))) {
                // check if the lowest and lowest+1 class boundary would be the same after rounding
                // (requested -1, so 10, with lowest class boundaries being 7.32 and 10.4 - since these both would get rounded to 10, this would yield a class that is defined between 10 and 10.)
                console.error('Class interval boundary rounding error: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + 
                ') might yield empty classes or classes with the same boundaries after rounding. Class intervals were untouched. Fix this by adjusting the "classRounding" option to ' 
                + parseInt(this._classPostProc_roundinghelper(classes[1].value)-1) + ' (optimal).');       
                return;
            }
            if (classes[1].value < Math.pow(10,Math.abs(n+1))) {
                // check if the lowest class boundary value is smaller than the requested nearest value 
                // (requested -2, so 100, while the upper value of the lowest class boundary is 7.32 - since this would get rounded to 0, this would yield useless rounded values for classes, with classes between 0 and 0 and similar.)
                console.error('Class interval boundary rounding error: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + 
                ') is larger than the lowest class boundary value (' + classes[1].value + '). Class intervals were untouched. Fix this by adjusting the "classRounding" option to ' 
                + parseInt(this._classPostProc_roundinghelper(classes[1].value)-2) + ' (optimal).');       
                return;
            }
            for (var i=1; i<classes.length; i++) {
                // Lowest/highest class boundary value gets rounded up/down here, respectively. Done to avoid features with extreme attr. values
                // (which should fall in the lowest/highest classes) falling in the 2nd lowest/highest class upon rounding.
                if (i+1 == classes.length) {
                    // highest class, round down at all times
                    if (n >= this._classPostProc_roundinghelper(Math.max.apply(Math, classes.map(item => item.value))) ) {
                        classes[i].value = Math.floor(classes[i].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n)); 
                    }
                } else if (i == 1) {
                    if (n >= this._classPostProc_roundinghelper(classes[classes.length-1].value) ) {
                        // lowest class handling to make sure it does not stay empty or same as lowest+1, after rounding
                        var rounded_round = Math.round(classes[i].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n)); 
                        var rounded_ip1_round = Math.round(classes[i+1].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n)); 
                        if (rounded_round <= classes[0].value || rounded_round == rounded_ip1_round){
                            console.error('Class interval boundary rounding error: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + 
                            ') might yield empty classes or classes with the same boundaries after rounding the lowest two class boundaries (' + classes[1].value + ' and ' + classes[2].value+'). Class intervals were untouched. Fix this by adjusting the "classRounding" option to ' 
                            + parseInt(this._classPostProc_roundinghelper(classes[1].value)-1) + ' (optimal).'); 
                            return;
                        } else {   
                            classes[i].value = rounded_round; 
                        }
                    }
                } else {
                    // midway classes
                    classes[i].value = Math.round(classes[i].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n)); // round(number/100)*100 to round up/down to nearest 100 value
                }
            }
            console.debug('Class interval boundary values have been rounded to the nearest', Math.pow(10,Math.abs(n)), 'values. New class boundary values:', classes)
        }
    },

    _legendPostProc_unitModifier(options) {
        // This processes the final class boundary values in order to multiply/divide them as wished. Purely visual, only affects legend. 
        // (useful when a dataset attribute is in metres, but kilometres would fit the legend better, for example 786000 metres as 786 km).
        // Note: runs after classRounding(). Called inside _generatelegend(). It DOES change the main classes[] array elements, but since legend generation is the last step in the whole process, it's OK (for now).
        switch (options.action) {
            case 'multiply':
                for (var i = 0; i<classes.length; i++) {
                    console.debug('MULTIPLY', classes[i].value,' by', options.by)
                    classes[i].value = classes[i].value * options.by;
                }
                break;
            case 'divide':
                for (var i = 0; i<classes.length; i++) {
                    console.debug('DIVIDE', classes[i].value,' by', options.by)  
                    classes[i].value = classes[i].value / options.by;                  
                }
                break;
            default:
                console.error('Invalid action for "unitModifier". Choose one of the following: "multiply", "divide".')
        }
        return;         
    },

    _legendRowFormatter(low, high, i) {
        // solve row based on the 3 row templates
        if (i == classes.length) {
            // highest
            let solved_high = template.highest.replace(/({high})/i, high)
            solved_high = solved_high.replace(/({low})/i, low)
            solved_high = solved_high.replace(/({count})/i, classes[classes.length-1].featureCount)
            return solved_high;
        } else if (i == 1) {
            // lowest
            let solved_low = template.lowest.replace(/({high})/i, high)
            solved_low = solved_low.replace(/({low})/i, low)
            solved_low = solved_low.replace(/({count})/i, classes[i-1].featureCount)
            return solved_low;
        } else {
            // middle
            let solved_mid = template.middle.replace(/({high})/i, high)
            solved_mid = solved_mid.replace(/({low})/i, low)
            solved_mid = solved_mid.replace(/({count})/i, classes[i-1].featureCount)
            return solved_mid;
        };
    },

    _generateLegend(title, asc, mode_line, mode_point, typeOfFeatures, footer) {
        svgCreator = this._svgCreator;
        legendPP_unitMod = this._legendPostProc_unitModifier;
        legendRowFormatter = this._legendRowFormatter;
        unitMod_options = this._unitMod;
        position = this._legendPos;
        ps = this._pointShape;
        lc = (this._linecolor != null ? this._linecolor : L.Path.prototype.options.color);
        lw = this._lineweight;
        nodata = this._noDataFound;
        nodatacolor = this._noDataColor;
        nodataignore = this._noDataIgnore;
        rowgap = this.options.legendRowGap;
        lt = this._legendTemplate;
        // format nodata row. Necessary for supporting {count} in that legend class row.
        if (classes.nodataFeatureCount > 0) {
            lt_formattedNoData = lt.nodata.replace(/({count})/i, classes.nodataFeatureCount);
        };
        var prad = (options.style.radius != null ? options.style.radius : 8);
        var pfc = (options.style.fillColor != null ? options.style.fillColor : 'orange');

        template = this._legendTemplate;

        // unitModifier process:
        if (unitMod_options != null) {
            if (unitMod_options.hasOwnProperty('action') && unitMod_options.action != null && typeof unitMod_options.action == "string" && unitMod_options.hasOwnProperty('by') && unitMod_options.by != null && typeof unitMod_options.by == "number") { 
                legendPP_unitMod(unitMod_options)
            } else {
                console.error('Missing/invalid options for "unitModifier". Try `unitModifier: {action: "multiply", number: 1000}`. Class values in legend were not affected.')
            };
        }

        // make sure legendPosition option is valid, if not, revert to default
        if(!['topleft', 'topright', 'bottomleft', 'bottomright'].includes(position)) {
            console.error('Invalid legendPosition. Choose one of the following: "bottomleft", "bottomright", "topleft", "topright". Overriding with default ("bottomleft").');
            position = 'bottomleft';
        }

        var legend = L.control({position: position});
        
        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'info legend');

            // legend title:
            if (title != null && title != '') {
                var titlediv = L.DomUtil.create('div', 'legendtitle');
                titlediv.id = 'legendtitlediv';
                titlediv.innerHTML += title;
                div.appendChild(titlediv);
            }

            // legenditems container (symbology)
            var container = L.DomUtil.create('div', 'symbology');
            container.id = 'legendsymbologydiv';
            if (rowgap != null) {
                if (typeof rowgap === 'number') {
                    container.style['row-gap'] = rowgap+'px';
                } else {
                    container.style['row-gap'] = rowgap;
                }
                (rowgap > 5 && titlediv != null ? container.style['margin-top'] = rowgap+'px' : '');  // If symbology row-gap is higher than 5, it looks better if title gets linearly distanced as well. Title div margin-bottom is 5 by default, we don't go lower than that. 
            };
            
            // symbology div fillup:
            if (typeOfFeatures == "MultiPoint" || typeOfFeatures == "Point") {
                // points
                switch (mode_point) {
                    case 'color':
                    // color based categories
                        for (var i = classes.length; i > 0; i--) {
                            /*console.debug('Legend: building line', i)*/
                            let low, high;
                            switch (mode) {
                                case 'stddeviation':
                                    low = classes[i-1].stddev_lower;
                                    high = (classes[i] != null ? classes[i].stddev_lower : '');
                                    break;
                                default:
                                    low = classes[i-1].value;
                                    high = (classes[i] != null ? classes[i].value : '');
                                    break;
                            }
                            container.innerHTML +=
                                '<div class="legendDataRow legendVarSizeDataRow">'+
                                    svgCreator({shape: ps, color: colors[i-1], size: prad}).outerHTML+
                                    '<div>'+ legendRowFormatter(low, high, i) +'</div>'+
                                '</div>';
                        }
                        if (nodata && !nodataignore) {
                            container.innerHTML +=
                                '<div id="nodatarow" class="legendDataRow legendVarSizeDataRow">'+
                                    svgCreator({shape: ps, color: nodatacolor, size: prad}).outerHTML+
                                    '<div>'+lt_formattedNoData+'</div>'+
                                '</div>'
                        }
                        break;
                    case 'size':
                    // size (radius) based categories
                        for (var i = classes.length; i > 0; i--) {
                            let low, high;
                            switch (mode) {
                                case 'stddeviation':
                                    low = classes[i-1].stddev_lower;
                                    high = (classes[i] != null ? classes[i].stddev_lower : '');
                                    break;
                                default:
                                    // decide low and high boundary values for current legend row (class)
                                    low = classes[i-1].value;
                                    high = (classes[i] != null ? classes[i].value : '');
                                    break;
                            }
                            
                            // Changed in v1.6.1, since the symbol SVGs no longer have a fixed 25x25/30x30 svg size,
                            // but only a size that encapsulates the symbol itself (therefore those SVGs no longer can be insert as they are).
                            // The following X/Y shift is only for use in the legend, creating a uniform 30x30 svg canvas for legend symbols:
                            var symbol = svgCreator({shape: ps, size: radiuses[i-1], color: pfc});
                            var origHeight = symbol.getAttribute('height');
                            var origWidth = symbol.getAttribute('width');
                            var shiftX = (30-origWidth)/2;
                            var shiftY = (30-origHeight)/2;
                            symbol.setAttribute('height', 30);
                            symbol.setAttribute('width', 30);
                            symbol.children[0].setAttribute('style', 'transform: translateX('+shiftX+'px) translateY('+shiftY+'px)');

                            // generate row with symbol
                            container.innerHTML += 
                                '<div class="legendDataRow legendVarSizeDataRow">'+
                                    symbol.outerHTML+
                                    '<div>'+ legendRowFormatter(low, high, i) +'</div>'+
                                '</div>';
                        }
                        if (nodata && !nodataignore) {
                            var NDsymbol = svgCreator({shape: ps, size: Math.min.apply(Math, radiuses), color: nodatacolor});
                            var origHeight = NDsymbol.getAttribute('height');
                            var origWidth = NDsymbol.getAttribute('width');
                            var shiftX = (30-origWidth)/2;
                            var shiftY = (30-origHeight)/2;
                            NDsymbol.setAttribute('height', 30);
                            NDsymbol.setAttribute('width', 30);
                            NDsymbol.children[0].setAttribute('style', 'transform: translateX('+shiftX+'px) translateY('+shiftY+'px)');
                            container.innerHTML +=
                                '<div id="nodatarow" class="legendDataRow legendVarSizeDataRow">'+
                                    NDsymbol.outerHTML+
                                    '<div>'+lt_formattedNoData+'</div>'+
                                '</div>'
                        }
                        break;
                }
            } else if (typeOfFeatures == "MultiLineString" || typeOfFeatures == "LineString") {
                // lines
                switch (mode_line) {
                    case 'color':
                    // color based categories
                        for (var i = classes.length; i > 0; i--) {
                            let low, high;
                            switch (mode) {
                                case 'stddeviation':
                                    low = classes[i-1].stddev_lower;
                                    high = (classes[i] != null ? classes[i].stddev_lower : '');
                                    break;
                                default:
                                    /*console.debug('Legend: building line', i)*/
                                    low = classes[i-1].value;
                                    high = (classes[i] != null ? classes[i].value : '');
                                    break;
                            }

                            container.innerHTML +=
                                '<div class="legendDataRow">'+
                                    '<svg width="25" height="25" viewBox="0 0 25 25">'+
                                        '<line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: '+lw+'; stroke: '+colors[i-1]+';"/>'+
                                    '</svg>' +
                                    '<div>'+ legendRowFormatter(low, high, i) +'</div>'+
                                '</div>'
                        }
                        if (nodata && !nodataignore) {
                            container.innerHTML +=
                                '<div id="nodatarow" class="legendDataRow">'+
                                    '<svg width="25" height="25" viewBox="0 0 25 25">'+
                                        '<line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: '+lw+'; stroke: '+nodatacolor+';"/>'+
                                    '</svg>' +
                                    '<div>'+lt_formattedNoData+'</div>'+
                                '</div>'
                        }
                        break;
                    case 'width':
                    // width based categories
                        for (var i = classes.length; i > 0; i--) {
                            /*console.debug('Legend: building line', i)*/
                            let low, high;
                            switch (mode) {
                                case 'stddeviation':
                                    low = classes[i-1].stddev_lower;
                                    high = (classes[i] != null ? classes[i].stddev_lower : '');
                                    break;
                                default:
                                    low = classes[i-1].value;
                                    high = (classes[i] != null ? classes[i].value : '');
                                    break;
                            }
                            container.innerHTML +=
                                '<div class="legendDataRow">'+
                                    '<svg width="25" height="25" viewBox="0 0 25 25">'+
                                        '<line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: '+widths[i-1]+'; stroke: '+lc+';"/>'+
                                    '</svg>'+
                                    '<div>'+ legendRowFormatter(low, high, i) +'</div>'+
                                '</div>'
                        }
                        if (nodata && !nodataignore) {
                            container.innerHTML +=
                                '<div id="nodatarow" class="legendDataRow">'+
                                    '<svg width="25" height="25" viewBox="0 0 25 25">'+
                                        '<line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: '+lw+'; stroke: '+nodatacolor+';"/>'+
                                    '</svg>' +
                                    '<div>'+lt_formattedNoData+'</div>'+
                                '</div>'
                        }
                        break;
                }
            } else {
                let opacity = (options.style.fillOpacity ? options.style.fillOpacity : 0.7);
                // polygons
                switch (mode_polygon) {
                    case 'color':
                        for (var i = classes.length; i > 0; i--) {
                            /*console.debug('Legend: building line', i)*/
                            let low, high;
                            switch (mode) {
                                case 'stddeviation':
                                    low = classes[i-1].stddev_lower;
                                    high = (classes[i] != null ? classes[i].stddev_lower : '');
                                    break;
                                default:
                                    low = classes[i-1].value;
                                    high = (classes[i] != null ? classes[i].value : '');
                                    break;
                            }
                            container.innerHTML +=
                                '<div class="legendDataRow">'+
                                    '<i style="background: ' + colors[i-1] + '; opacity: ' + opacity + '"></i>' +
                                    '<div>'+ legendRowFormatter(low, high, i) +'</div>'+
                                '</div>'
                        }
                        if (nodata && !nodataignore) {
                            container.innerHTML +=
                                '<div id="nodatarow" class="legendDataRow">'+
                                    '<i style="background: ' + nodatacolor + '; opacity: ' + opacity + '"></i>' +
                                    '<div>'+lt_formattedNoData+'</div>'+
                                '</div>'
                        }
                        break;
                    case 'hatch':
                        for (var i = classes.length; i > 0; i--) {
                            /*console.debug('Legend: building line', i)*/
                            let low, high;
                            switch (mode) {
                                case 'stddeviation':
                                    low = classes[i-1].stddev_lower;
                                    high = (classes[i] != null ? classes[i].stddev_lower : '');
                                    break;
                                default:
                                    low = classes[i-1].value;
                                    high = (classes[i] != null ? classes[i].value : '');
                                    break;
                            }
                            container.innerHTML +=
                                '<div class="legendDataRow">'+
                                    '<svg class="hatchPatch"><rect fill="url(#'+hatchclasses[i-1]+')" fill-opacity="' + opacity + '" x="0" y="0" width="100%" height="100%"></rect></svg>'+
                                    '<div>'+ legendRowFormatter(low, high, i) +'</div>'+
                                '</div>'
                        }
                        if (nodata && !nodataignore) {
                            container.innerHTML +=
                                '<div id="nodatarow" class="legendDataRow">'+
                                    '<svg class="hatchPatch"><rect fill="'+ nodatacolor + '" fill-opacity="' + opacity + '" x="0" y="0" width="100%" height="100%"></rect></svg>' +
                                    '<div>'+lt_formattedNoData+'</div>'+
                                '</div>'
                        }
                        break;
                }
            }
            // reverse legend row order in ascending mode by reversing flex-direction
            if (asc) {
                L.DomUtil.addClass(container, 'reverseOrder');
            }
            // append symbology content
            div.appendChild(container);

            // legend footer (note):
            if (footer != null && footer != '') {
                var footerdiv = L.DomUtil.create('div', 'legendfooter');
                footerdiv.id = 'legendfooterdiv';
                footerdiv.innerHTML += footer;
                div.appendChild(footerdiv);
            }

            return div;
        };

        legend.id = this._leaflet_id;
        this._legends.push(legend);
        legend.addTo(map);
        console.debug('Legend generated:', title);
        
        // move nodata row to the bottom after legend reversal (in ascending mode)
        if (asc) {
            if (document.getElementById('nodatarow')) {
                document.getElementById('nodatarow').classList.add('legendAscNodata');
            }
        } 
    },

    onAdd(map) {
        console.debug('L.dataClassification: Classifying...')
        console.debug('L.dataClassification: options:', this.options)
        this._field=this.options.field
        this._normalizeByField=this.options.normalizeByField
        L.GeoJSON.prototype.onAdd.call(this, map);
        this._classify(map);
    },

    _classify(map) {
        var timerGlobalStart = Date.now();

        _field=this.options.field;
        _normalizeByField=this.options.normalizeByField;
        _nodata=this._noDataFound;
        _nodataignore=this.options.noDataIgnore;
        var features_info = { Point: 0, MultiPoint: 0, LineString: 0, MultiLineString: 0, Polygon: 0, MultiPolygon: 0};
        var typeOfFeatures = 'unknown';
        features = [];

        var timerLoadValuesStart = Date.now();
        this.eachLayer(function (layer) {
            // gather info feature types in geojson 
            switch (layer.feature.geometry.type) {
                case 'Point': 	
                    features_info.Point += 1;
                    break;
                case 'MultiPoint': 	
                    features_info.MultiPoint += 1;
                    break;
                case 'LineString': 	
                    features_info.LineString += 1;
                    break;
                case 'MultiLineString': 	
                    features_info.MultiLineString += 1;
                    break;
                case 'Polygon': 	
                    features_info.Polygon += 1;
                    break;
                case 'MultiPolygon': 	
                    features_info.MultiPolygon += 1;
                    break;
                default:
                    features_info.Unknown += 1;
            };
            // feature attribute value extraction to array
            if (!layer.feature.properties.hasOwnProperty(this._field)) {
                console.error('Attribute field "'+this._field+'" does not exist in given GeoJSON. Please note that attribute field input is case-sensitve. Available attribute fields: '+JSON.stringify(layer.feature.properties));
                return;
            } 
            if (this._normalizeByField != null && !layer.feature.properties.hasOwnProperty(this._normalizeByField)) {
                console.error('Normalization attribute field "'+this._normalizeByField+'" does not exist in given GeoJSON. Please note that attribute field input is case-sensitve. Either choose one of the available fields, or omit the option `normalizeByField`. Available attribute fields: '+JSON.stringify(layer.feature.properties));
                return;
            } 
            /*if (typeof layer.feature.properties[this._field] != 'number') {
                console.error('Attribute field "'+this._field+'" does not contain quantitative values in given GeoJSON. Please note that attribute field input is case-sensitve. Available attribute fields: '+JSON.stringify(layer.feature.properties));
                return;
            } */
            if (layer.feature.properties[this._field] != null) {
                //values.push(layer.feature.properties[this._field]);
                features.push(layer.feature.properties);
            } else {
                _nodata = true;     // flag for generateLegend() later
                if (!_nodataignore) {
                    // we add null values to main array
                    //values.push(layer.feature.properties[this._field]);
                    features.push(layer.feature.properties);
                }
                console.warn('A feature has NULL as attribute field "'+this._field+'" in given GeoJSON. If this is a valid nodata attribute, ignore this warning, the plugin will handle nodata features as a separate symbol class. Null found in feature: ', layer.feature)
            };
        })
        var timerLoadValuesEnd = Date.now();
        console.debug('Feature types in GeoJSON:', features_info)
        typeOfFeatures = Object.keys(features_info).reduce((a, b) => features_info[a] > features_info[b] ? a : b);
        console.debug('Dominant feature type in GeoJSON:', typeOfFeatures)

        console.debug('Loaded values from GeoJSON (field: '+this._field+'):', features.map(a => a[this._field]));

        var timerNormalizationStart = Date.now();
        features.forEach((arrayItem, index) => {
            if (this._normalizeByField != null && arrayItem[this._field] != null && arrayItem[this._normalizeByField] != null) {
                arrayItem.finalvalue = arrayItem[this._field]/arrayItem[this._normalizeByField];
            } else {
                arrayItem.finalvalue = arrayItem[this._field];
            }
        });
        var timerNormalizationEnd = Date.now();

        this._noDataFound = _nodata;
        this._features = features;
        if (this._normalizeByField != null) {
            console.debug('Loaded values from GeoJSON field: "'+this._field+'", after normalization by field: "'+this._normalizeByField+'"', features.map(a => a.finalvalue));
        }	

        // if line color is overridden with L.Path style options, reflect that in Legend too
        if ((typeOfFeatures == 'LineString' || typeOfFeatures == 'MultiLineString')) {
            if (this.options.hasOwnProperty('style')) {
                this._linecolor = this.options.style.color;
                if (this.options.style.hasOwnProperty('weight')) {
                    this._lineweight = this.options.style.weight;
                } else {
                    this._lineweight = L.Path.prototype.options.weight;     // fallback to Leaflet default
                }
            } else {
                this._linecolor = L.Path.prototype.options.color;           // fallback to Leaflet default
                this._lineweight = L.Path.prototype.options.weight;         // fallback to Leaflet default
            }
        };

        // options extract and checks
        classnum = this.options.classes;
        if (classnum > 10) { console.warn("Don't be silly, both map and legend will look incomprehensible. Overriding classnumber with 10."); classnum = 10 }; // over 10
        mode = this.options.mode;
        mode_point = this.options.pointMode;
        pointSize = this.options.pointSize;
		this._pointShape = this.options.pointShape;
        mode_line = this.options.lineMode;
        mode_polygon = this.options.polygonMode;
        lineWidth = this.options.lineWidth;
        polygonHatch = this.options.polygonHatch;
        colorramp = this.options.colorRamp;
        colorramp_rev = this.options.reverseColorRamp;
        colorramp_custom = this.options.colorCustom;
        if (colorramp_custom != null ) {
            if (colorramp_custom.length == 1) {
                console.error('Custom colors: only one color was set. At least 2 are required. Falling back to colorRamp.');
            } else {
                // if an array of at least 2 colors are set, use custom color ramp. Otherwise, fallback to colorramp.
                (colorramp_custom[0] == null || colorramp_custom[1] == null ? '' : colorramp = colorramp_custom);	
            }
        }
        var asc = (this.options.legendAscending != null ? this.options.legendAscending : false);
        middlepoint = this.options.middlePointValue;
        var legendtitle;
        if (this.options.legendTitle == 'hidden') {
            legendtitle = '';                    
        } else {
            (this.options.legendTitle == '' ? legendtitle = this._field : legendtitle = this.options.legendTitle )
        }; 	
        var legendfooter;
        if (this.options.legendFooter == 'hidden' || this.options.legendFooter == '') {
            legendfooter = null;                    
        } else {
            legendfooter = this.options.legendFooter;
        }; 	
        var classrounding = this.options.classRounding;
        if (classrounding > 10) { // over 10
            console.warn("Don't be silly, by rounding class boundary values to 10+ decimal places the legend will look incomprehensible. Overriding classrounding with 0 (whole numbers) for now. Fix this by using a more sensible number for the 'classRounding' parameter (like 2), set it to zero to get whole numbers, or set it to negative numbers to round up/down to 10s (-1), 100s (-2), 1000s (-3), etc."); 
            classrounding = 0;
        }; 
        var pointfillcolor = this.options.style.fillColor;
        this._unitMod = this.options.unitModifier;
        this._legendPos = this.options.legendPosition;
        this._legendTemplate = this.options.legendTemplate;
        // fallback to default when user only specified one of the three custom templates
        if (!this._legendTemplate.hasOwnProperty('highest')) {this._legendTemplate.highest = '{low} <'};
        if (!this._legendTemplate.hasOwnProperty('middle')) {this._legendTemplate.middle = '{low} – {high}'};
        if (!this._legendTemplate.hasOwnProperty('lowest')) {this._legendTemplate.lowest = '< {high}'};
        if (!this._legendTemplate.hasOwnProperty('nodata')) {this._legendTemplate.nodata = 'No data'};
        this._noDataColor = this.options.noDataColor;
        this._noDataIgnore = this.options.noDataIgnore;

        var timerClsfStart = Date.now();
        // classification process
        var success = false;
        if (mode == 'manual') {
            console.debug('Mode: ', mode);
            console.debug('Value for option "classes": ', classnum);
            if (!Array.isArray(classnum)) {
                console.error('When using `mode`: "manual", `classes` must be an array of class boundary values you wish to classify features into (for example `classes`: [50, 150, 300]). ');
                console.error('Classification error, stopped process.');
                return;
            } else {
                classnum.sort(function(a, b) {
                    return a - b;
                  });
                classes = classnum;
                classnum = classes.length;
            }
        } else {
            if (Array.isArray(classnum)) {
                console.error('When using a classification `mode` other than "manual", `classes` option must be an integer, based on how many classes you want to generate (for example `classes`: 5). ');
                console.error('Classification error, stopped process.');
                return;
            }
        }
        values = features.map(a => a.finalvalue);
        if (classnum > 2 && classnum < this._features.length) {	
            switch (mode) {
                case 'jenks':	
                    classes = ss.jenks(values.filter((value) => value != null), classnum);
                    classes.pop(); // remove last, since its the max value
                    console.debug('Jenks classes: ', classes);
                    this._convertClassesToObjects();
                    success = true;
                    break;
                case 'equalinterval':
                    classes = [];
                    var minmax = ss.extent(values.filter((value) => value != null));
                    console.debug('min:', minmax[0], ', max:', minmax[1])
                    var range = minmax[1]-minmax[0];
                    console.debug('data range:', range)
                    var oneclass = range/classnum;
                    console.debug('one class:', oneclass);
                    for (var i=minmax[0]; i<minmax[1];) {
                        classes.push(i);
                        i = i + oneclass;
                    }
                    console.debug('EI classes: ', classes);
                    this._convertClassesToObjects();
                    success = true;
                    break;
                case 'quantile':
                    classes = [];
                    for (var i = 0; i<classnum; i++) {
                        var currentq = (1/classnum)*i;
                        classes.push(ss.quantile(values.filter((value) => value != null), currentq));
                    }				
                    console.warn('Quantile classes at the middle might be slightly different compared to GIS SW');		
                    console.debug('Quantile classes: ', classes);	
                    this._convertClassesToObjects();
                    success = true;
                    break;
                case 'manual':
					classnum = classes.length;
                    console.debug('Manually defined classes: ', classes);	
                    this._convertClassesToObjects();
                    success = true;
                    break;
                case 'stddeviation':
                    // with zScore: (number-average)/standard_deviation
                    classes = [];
                    var stddev = ss.standardDeviation(values.filter((value) => value != null))
                    var mean = ss.mean(values.filter((value) => value != null))
                    console.debug('stddev:', stddev)
                    console.debug('mean:', mean)
                    var extent = ss.extent(values.filter((value) => value != null))
                    /*console.debug('extent', extent)
                    var diff = extent[1]-extent[0]
                    console.debug('diff', diff)
                    console.debug('number of classes if 1 stddev:', diff/(stddev/1))
                    console.debug('number of classes if 1 stddev:', Math.round(diff/(stddev/1)))
                    console.debug('number of classes if 1/2 stddev:', diff/(stddev/2))
                    console.debug('number of classes if 1/3 stddev:', diff/(stddev/3))*/

                    var halfstddev = stddev/2;
                    var curr;
                    var down = 1;
                    var up = 1;
                    //var potclassnum = Math.round(diff/(stddev/1));
                    var valid = true;
                    classes.push(-999999);
                    for (var i = 0; valid /*i<potclassnum*/; i++) {
                            console.debug('downwards', down)
                            curr = mean-(halfstddev*down);
                            console.debug('downwards curr', curr)
                            console.debug(extent[0])
                            console.debug((curr > extent[0]))
                            console.debug(halfstddev)
                            if (curr > extent[0] && down < 7) {
                                classes.push(curr);
                                down += 2;
                            } else {
                                valid = false;
                            };
                    }
                    
                    valid = true;
                    for (var i = 0; valid /*i<potclassnum*/; i++) {
                        console.debug('upwards', up)
                        curr = mean+(halfstddev*up);
                        console.debug('upwards curr', curr)
                        if (curr < extent[1] && up < 7) {
                            classes.push(curr);
                            up += 2;
                        } else {
                            valid = false
                        };
                    }

                    console.debug(classes);
                    classes.sort(function(a, b) {
                        return a - b;
                    });
                    console.debug('Sorted Stddev classes: ', classes);	
                    this._convertClassesToObjects();

                    console.debug('down intervals:', down, 'up intervals:', up)
                    var interval_lower = (0.5 * -down);
                    classes.forEach(function (arrayItem) {
                        if (down > 0) {
                            console.debug('down =', down, 'up =', up, 'boundary =', interval_lower)
                            arrayItem.stddev_lower = interval_lower;
                            interval_lower += 1;
                            down -= 2;
                        } else if (down < 0 && up > 0) {
                            console.debug('down =', down, 'up =', up, 'boundary =', interval_lower)
                            arrayItem.stddev_lower = interval_lower;
                            interval_lower += 1;
                            up -= 2;
                            
                        };
                    });
                    success = true;
                    break;
                case 'logarithmic':
                    classes = [];
                    var minmax = ss.extent(values.filter((value) => value != null));
                    console.debug('min:', minmax[0], ', max:', minmax[1])	

                    var logdiff = Math.log(minmax[1]) - Math.log(minmax[0])
                    if (Number.isNaN(logdiff)) {
                        console.error('Logarithmic scale does not support negative values yet. (dataset minimum: '+minmax[0]+', maximum: '+minmax[1]+') Please use a different classification method for this dataset, or choose an other data attribute field that has no negative values. Classification failed, map was not generated properly.');
                        return;
                    };
                    var logdiff_divided = logdiff / classnum;
                    console.debug('logdiff', Math.log(minmax[1]) - Math.log(minmax[0]))
                    console.debug('logdiff divided by classnum', logdiff_divided)
                    var factor = Math.exp(logdiff_divided);
                    console.debug('factor Math.exp(logdiff_divided):', factor)
                    classes.push(minmax[0])
                    for (var i = 1; i < classnum; i++) {
                        classes.push(classes[classes.length - 1] * factor);
                    }

                    // round interval boundary values by default, since with logarithmic classes we get high precision floats
                    if (classrounding == null) { classrounding = 2;}

                    console.debug('Logarithmic classes: ', classes);	
                    this._convertClassesToObjects();
                    success = true;
                    break;
                default:
                    console.error('Wrong classification type (choose one of the following: "jenks", "equalinterval", "quantile", "stddeviation", "logarithmic", "manual" - when manual, `classes` must be an array!)')
            }
            var timerClsfEnd = Date.now();

            var timerGenColorsStart = Date.now();
            // Classification success, proceed with generating colors
            if (success) {
                console.debug('Classification success.');
                console.debug('Generating color- and symbol property ranges for '+classes.length+' classes.');
                try {
                    colors = chroma.scale(colorramp).colors(classes.length);
                } catch (error) {
                    console.error(error)
                    console.error('Make sure chosen color ramp exists (color ramps based on https://colorbrewer2.org/) and custom colors are formatted correctly. For supported formats, see https://gka.github.io/chroma.js/. For an interactive color palette helper, see https://gka.github.io/palettes/.')
                    return;
                }
                if (colorramp_rev) {
                    console.debug('reversing colorramp')
                    colors.reverse(); 
                };
            }
            var timerGenColorsEnd = Date.now();
            var timerGenRangesStart = Date.now();
            // Generate symbol property ranges (size/width/hatch classes):
            if (mode_point == "size") {
                this._pointMode_size_radiuses(pointSize);
            }
            if (mode_line == "width") {
                this._lineMode_width(lineWidth);
            }
            if (mode_polygon == "hatch") {
                this._polygonMode_hatch(polygonHatch);
            }
            var timerGenRangesEnd = Date.now();
            // Middlepoint value handling:
            if (middlepoint != null && classes.length % 2 == 0) {
                console.debug('Adjusting middle classes to value: ', middlepoint);
                classes[classes.length / 2].value = middlepoint;
            }
            // Class rounding handling:
            if (classrounding != null) { this._classPostProc_rounding(classrounding); }    // round class boundary values
        } else {
            console.error('Classnumber out of range (must be: 2 < x <', values.length, '(featurecount))!');
            return;
        };

        this._classes = classes;
        svgCreator = this._svgCreator;
        ps = this._pointShape;
        stylePoint_color = this._stylePoint_color;
        stylePoint_size = this._stylePoint_size;
        styleLine_color = this._styleLine_color;
        styleLine_width = this._styleLine_width;
        stylePolygon_color = this._stylePolygon_color;
        stylePolygon_hatch = this._stylePolygon_hatch;
        getColor = this._getColor;
        getHatch= this._getHatch;
        getRadius = this._getRadius;
        getWeight = this._getWeight;
        pointMarkers = this._pointMarkers;
        options = this.options;
        nodataignore = this._noDataIgnore;

        currentmarker = null;

        var n = 0;

        var timerSymbologyStart = Date.now();
        console.debug('Applying symbology to map features.');
        // apply symbology to features
        this.eachLayer(function(layer) {
            if (layer.feature.properties[this._field] == null && nodataignore) {
                layer.remove();
            } else {
                switch (layer.feature.geometry.type) {
                    case "Point":
                        var coords = layer.feature.geometry.coordinates;
                        var style = (mode_point == "color" ? stylePoint_color(features[n].finalvalue) : stylePoint_size(features[n].finalvalue, this.options))
                        style.shape = ps;
                        var finalSymbol = svgCreator({shape: style.shape, size: style.radius, color: style.fillColor});
                        iconW = finalSymbol.getAttribute('width');
                        iconH = finalSymbol.getAttribute('height');

                        const svgIcon = L.divIcon({
                            html: finalSymbol,
                            className: "",
                            iconSize: [iconW, iconH],
                            iconAnchor: [iconW/2, iconH/2],
                        });                
                        layer.setIcon(svgIcon);
                        break;
                    case "MultiPoint":
                        var style = (mode_point == "color" ? stylePoint_color(features[n].finalvalue) : stylePoint_size(features[n].finalvalue, this.options))
                        style.shape = ps;
                        var finalSymbol2 = svgCreator({shape: style.shape, size: style.radius, color: style.fillColor});
                        iconW = finalSymbol2.getAttribute('width');
                        iconH = finalSymbol2.getAttribute('height');

                        var mpfeatures = layer._layers;
                        for (const property in mpfeatures) {
                            mpfeatures[property].setIcon(L.divIcon({
                                html: finalSymbol2.outerHTML,
                                className: "",
                                iconSize: [iconW, iconH],
                                iconAnchor: [iconW/2, iconH/2],
                            }));
                        }
                        break;
                    case "LineString":
                    case "MultiLineString":
                        layer.setStyle((mode_line == "width" ? styleLine_width(features[n].finalvalue) : styleLine_color(features[n].finalvalue)))/*.addTo(map)*/;
                        break;
                    case "Polygon":
                    case "MultiPolygon":
                        if (mode_polygon == "hatch") {
                            layer._path.style['fill'] = stylePolygon_hatch(features[n].finalvalue, this.options); // this messy workaround is needed due to Leaflet ignoring `className` in layer.setStyle(). See https://github.com/leaflet/leaflet/issues/2662.
                            layer._path.style['fill-opacity'] = (options.style.fillOpacity != null ? options.style.fillOpacity : 0.7); 
                        } else {
                            layer.setStyle(stylePolygon_color(features[n].finalvalue, this.options))/*.addTo(map)*/;
                        }
                        break;
                    default:
                        console.error('Error: Unknown feature type: ', layer.feature.geometry.type, layer.feature)
                        break;
                }
                n += 1;  
            }     
        });
        var timerSymbologyEnd = Date.now();

        // count nodata features (= all values - validFeatures). For use in legend ("no data" class).
        var validFeatures = 0;
        classes.forEach((element, idx) => {
            validFeatures += element.featureCount;
        });
        classes.nodataFeatureCount = features.length-validFeatures;

        //this._convertClassesToObjects();

        var timerLegendStart = Date.now();
        this._generateLegend(legendtitle, asc, mode_line, mode_point, typeOfFeatures, legendfooter);  // generate legend
        var timerLegendEnd = Date.now();

        console.debug('L.dataClassification: Finished!')
        var timerGlobalEnd = Date.now();

        var showTimeBreakdown = false;
        if (showTimeBreakdown) {
            // timing breakdown (ms)
            console.group('Processing time breakdown (ms):')
            console.table({
                'Loading values': (timerLoadValuesEnd - timerLoadValuesStart),
                'Data normalization': (timerNormalizationEnd - timerNormalizationStart),
                'Generating classes': (timerClsfEnd - timerClsfStart),
                'Generating colors': (timerGenColorsEnd - timerGenColorsStart),
                'Generating symbol size ranges': (timerGenRangesEnd - timerGenRangesStart),
                'Applying symbology based on classes': (timerSymbologyEnd - timerSymbologyStart),
                'Generating legend': (timerLegendEnd - timerLegendStart),
                'TOTAL PROCESS TIME for this layer': (timerGlobalEnd - timerGlobalStart)
            });
            console.groupEnd()
        }
        console.debug('------------------------------------')
    },

    classify() {
        this._classify(this._map);
    },
    
    onRemove(map) {
        console.debug('Removing Layer..........')
        // remove legend
        legend = this._legends.find(item => item.id === this._leaflet_id);
        console.debug('Removing Legend with id:', legend.id, legend)
        legend.remove();
        console.debug('Legend Removed.')
        // remove layer
		this.eachLayer(map.removeLayer, map);
        console.debug('Layer Removed.')
	}
});


L.dataClassification = function (layers, options) {
	return new L.DataClassification(layers, options);
};