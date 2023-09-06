/**
 * class L.DataClassification()
 * 
 * (extends L.GeoJSON)
 * 
 * classifies point, line or polygon features by chosen quantitative-type attribute
 * stylizes features on map accordingly
 * generates an appropriate legend for visualized data
 *
 * MIT License
 * Copyright (c) 2023 Dániel Balla
*/

L.DataClassification = L.GeoJSON.extend({
    options: {
        // default options
        mode: 'quantile',							// classification method: jenks, quantile, equalinterval
        classes: 5,									// desired number of classes (min: 3, max: 10 or featurecount, whichever is lower)
        pointMode: 'color', 						// POINT FEATURES: fill "color" or "size" (default: color)
        pointSize: {min: 2, max: 10},               // POINT FEATURES: when pointMode: "size", define min/max point circle radius (default min: 2, default max: 10, recommended max: 12)
        pointShape: 'circle',						// POINT FEATURES: shape of points: 'circle', 'square', 'diamond' (default: 'circle')
        lineMode: 'width', 							// LINE FEATURES: stroke "color" or "width" (default: color)
        lineWidth: {min: 3, max: 15},				// LINE FEATURES: when lineMode: "width", define min/max stroke width as object (default min: 1, default max: 15, recommended max: 20)
        colorRamp: 'purd',							// color ramp to use in symbology. Based on ColorBrewer2 color ramps, included in Chroma.js: https://colorbrewer2.org/. (default: PuRd)
        /*colorCustom: [	'rgba(210,255,178,1)', 
                        '#fec44fff', 
                        'f95f0eff'],*/				// custom color ramp as an array, colors in format supported by Chroma.js, with opacity support. A minimum of two colors are required.
                                                    // (examples for yellow: 'ffff00', '#ff0', 'yellow', '#ffff0055', 'rgba(255,255,0,0.35)', 'hsla(58,100%,50%,0.6)', 
                                                    // chroma('yellow').alpha(0.5). For more, see: https://gka.github.io/chroma.js/)
                                                    // Custom colors override colorRamp.
        legendAscending: false,						// true = values in legend will be ascending (low first, high last) (default: false)
        reverseColorRamp: false,					// true = reverse the chosen color ramp, both in symbology on map and legend colors. (default: false)
                                                    // Useful if you found a great looking colorramp (green to red), but would prefer reversed colors 
                                                    // (for example to match visual implications about colors: green implies positive, red implies negative phenomena)
        /*middlePointValue: 0,*/					// optional: adjust boundary value of middle classes (only for even classcount), useful for symmetric classification of diverging data around 0 for example. Only use a value within the original middle classes range.
        /*field: '',*/					            // target attribute field name. Case-sensitive!
        legendTitle: '',					        // title for legend (usually a description of visualized data, with a unit of measurement). HTML-markdown and styling allowed. If you want to hide title, set this as 'hidden'. (default: ='field')
        classRounding: null,                        // class boundary value rounding. Positive numbers round to x decimals, zero will round to whole numbers, negative numbers will round values to the nearest 10, 100, 1000, etc. (default: null - no rounding, values are used as-is)
        unitModifier: null,                         // modifies the final class boundary values in order to multiply/divide them. Useful when a dataset attribute is in metres, but kilometres would fit the legend better, for example 786000 metres shown as 786 km. Purely visual, only affects legend.
        legendPosition: 'bottomleft',               // Legend position (L.control option: 'topleft', 'topright', 'bottomleft' or 'bottomright')

        style: {
            fillColor: 'orange',
            color: L.Path.prototype.options.color
        }
    },

    // variables for plugin scope
    _values: [],
    _legends: [],
    _classes: [],
    _colors: [],
    _radiuses: [],
    _widths: [],
    _pointMarkers: [],
    _unitMod: {},
    _field: '',
    _pointShape: '',
    _linecolor: '',
    _legendPos: '',

    // value evaluators to match classes
    /**
     * Value evaluator to match a color class.
     * @param {float} d - Number to match a class to
     * @returns {string} Symbol color of the class
     */
    _getColor(d) {
        for (var i = 0; i<classes.length; i++) {
            if (d < classes[i+1]) {
                return colors[i];
            } 					
        }
        return colors.at(-1);	// highest group
    },

    /**
     * Value evaluator to match a line width class.
     * @param {float} d - Number to match a class to
     * @returns {float} Symbol width of the class
     */
    _getWeight(d) {
        for (var i = 0; i<classes.length; i++) {
            if (d < classes[i+1]) {
                return widths[i];
            } 					
        }
        return widths.at(-1);	// highest group
    },

    /**
     * Value evaluator to match a point symbol size class.
     * @param {float} d - Number to match a class to
     * @returns {float} Symbol radius of the class
     */
    _getRadius(d) {
        for (var i = 0; i<classes.length; i++) {
            if (d < classes[i+1]) {
                return radiuses[i];
            } 					
        }
        return radiuses.at(-1);	// highest group
    },

    // stylers
    /**
     * Feature styler for point/color mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @returns {object} Final symbol style of the feature
     */
    _stylePoint_color(value){
        return {
            fillColor: getColor(value),
            fillOpacity: 1,
            color: "black",
            weight: 1,
            shape: "circle",
            radius: 8
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
            fillColor: options.style.fillColor,
            fillOpacity: 1,
            color: "black",
            weight: 1,
            shape: "circle",
            radius: getRadius(value)
        };			
    },

    /**
     * Feature styler for line/color mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @returns {object} Final symbol style of the feature
     */
    _styleLine_color(value){
        return {
            color: getColor(value)/*,
            weight: 3*/
        };			
    },

    /**
     * Feature styler for line/width mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @returns {object} Final symbol style of the feature
     */
    _styleLine_width(value){
        return {
            weight: getWeight(value)
        };			
    },

    /**
     * Feature styler for polygons.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @returns {object} Final symbol style of the feature
     */
    _stylePolygon(value){
        return {
            fillColor: getColor(value),
            fillOpacity: 0.7,
            /*color: 'white',*/
            /*weight: 2*/
        };			
    },
    
    // get n categories of point radiuses, line widths for symbology
    /**
     * Generates a range of symbol sizes for point/size mode. Fills up global array `radiuses[]`.
     * @param {Object} sizes Symbol size information
     * @param {float} sizes.min Minimum symbol size, radius (symbol of the lowest class)
     * @param {float} sizes.max Maximum symbol size, radius (symbol of the highest class)
     */
    _pointMode_size_radiuses(sizes){
        radiuses = [];
        
        var step = (sizes.max - sizes.min) / (classes.length - 1);
        for (var i = 0; i < classes.length; i++) {
            var curr = sizes.min + (step * i);
            radiuses.push(curr);
        }
        console.log('points: radius categories:', radiuses)
    },
    /**
     * Generates a range of symbol sizes for line/width mode. Fills up global array `widths[]`.
     * @param {Object} sizes Symbol size information
     * @param {float} sizes.min Minimum symbol size, width (symbol of the lowest class)
     * @param {float} sizes.max Maximum symbol size, width (symbol of the highest class)
     */
    _lineMode_width(sizes){
        widths = [];
        
        var step = (sizes.max - sizes.min) / (classes.length - 1);
        for (var i = 0; i < classes.length; i++) {
            widths.push(sizes.min + (step * i));
        }
        console.log('lines: width categories:', widths)
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
        var svg;
        switch (options.shape) {
            case 'circle':
                svg = '<svg width="25" height="25" viewBox="0 0 25 25" style="margin-left: 4px; margin-right: 10px">'+
                            '<circle cx="12.5" cy="12.5" r="'+options.size+'" style="stroke: black; fill: '+options.color+';"/>'+
                        '</svg>'
                break;
            case 'square':
                svg = '<svg width="25" height="25"  style="margin-left: 4px; margin-right: 10px">'+
                            '<rect x="'+(25-(options.size*2))/2+'" y="'+(25-(options.size*2))/2+'" height="'+options.size*2+'" width="'+options.size*2+'" style="stroke: black; fill: '+options.color+';"/>'+
                        '</svg>'
                break;
            case 'diamond':
                svg = '<svg width="30" height="30" style="margin-left: 4px; margin-right: 10px">'+
                            '<path d="M -'+options.size*1.4+' 0 L 0 -'+options.size*1.4+' L '+options.size*1.4+' 0 L 0 '+options.size*1.4+' Z" style="fill: '+options.color+'; stroke: black; transform: translateX(15px) translateY(15px);"/>'+
                        '</svg>'
                break;
            /*case 'triangle':
                svg = '<svg width="30" height="30" style="margin-left: 4px; margin-right: 10px; scale: '+options.size/7.5+'; stroke: black; ">'+
                            '<polygon points="50 15, 100 100, 0 100" style="fill: '+options.color+'; scale: 0.2; transform: translateX(30px) translateY(15px)"/>'+
                        '</svg>'
                break;*/
            default:
                console.error('Invalid shape given. Choose one of: circle, square, diamond');
                break;
        }
        return svg;
    },

    _classPostProc_roundinghelper(num) {
        // This recommends an optimal "classRounding" parameter in a console message, when it was set too high. Basically the reverse of function _classesPostProcessing_rounding().
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
            // rounding to decimals using toFixed()
            for (var i=0; i<classes.length; i++) {
                classes[i] = classes[i].toFixed(n);
            }
            console.log('Class interval boundary values have been rounded to', n, 'decimals.')
        } else {
            // rounding up/down to 10s, 100s, 1000s etc.
            if (Math.max.apply(Math, classes) < Math.pow(10,Math.abs(n))) {
                // check if the highest class boundary value is higher than the requested nearest value 
                // (requested -3, so 1000, while the highest class is 386.2 - this would yield useless rounded values for classes, with ~all classes between 0 and 0.)
                console.error('Class interval boundary rounding error: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + 
                ') is larger than the highest class boundary value (' + Math.max.apply(Math, classes) + '). Class intervals were untouched. Fix this by adjusting the "classRounding" option to ' 
                + this._classPostProc_roundinghelper(Math.max.apply(Math, classes)) + ' (optimal).');                
                return;
            }
            if (Math.max.apply(Math, classes) < Math.pow(10,Math.abs(n-1))) {
                // the highest class boundary value vs. requested nearest value being high enough might cause problems at the lowest classes (lowest class does not belong to any features etc.).
                console.warn('Class interval boundary rounding warning: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + ') might result in the lowest class not belonging to any features on the map (class empty). Make sure the visualized data is correct on the map, otherwise, fix this by adjusting the "classRounding" option to ' + parseInt(n+1) + '.')
            }
            for (var i=0; i<classes.length; i++) {
                classes[i] = Math.round(classes[i]/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n)); // round(number/100)*100 to round up/down to nearest 100 value
            }
            console.log('Class interval boundary values have been rounded to the nearest', Math.pow(10,Math.abs(n)), 'values.')
        }
    },

    _legendPostProc_unitModifier(options) {
        // This processes the final class boundary values in order to multiply/divide them as wished. Purely visual, only affects legend. 
        // (useful when a dataset attribute is in metres, but kilometres would fit the legend better, for example 786000 metres as 786 km).
        // Note: runs after clsasRounding(). Runs during _generatelegend(). It DOES change the main classes[] array elements, but since legend generation is the last step in the whole process, it's OK (for now).
        switch (options.action) {
            case 'multiply':
                for (var i = 0; i<classes.length; i++) {
                    console.log('MULTIPLY', classes[i],' by', options.by)
                    classes[i] = classes[i] * options.by;
                }
                break;
            case 'divide':
                for (var i = 0; i<classes.length; i++) {
                    console.log('DIVIDE', classes[i],' by', options.by)  
                    classes[i] = classes[i] / options.by;                  
                }
                break;
            default:
                console.error('Invalid action for "unitModifier". Choose one of: "multiply", "divide".')
        }
        return;         
    },

    _generateLegend(title, asc, mode_line, mode_point, typeOfFeatures, pfc) {
        svgCreator = this._svgCreator;
        legendPP_unitMod = this._legendPostProc_unitModifier;
        unitMod_options = this._unitMod;
        position = this._legendPos;
        ps = this._pointShape;
        lc = this._linecolor;

        // unitModifier process:
        if (unitMod_options != null) {
            if (unitMod_options.hasOwnProperty('action') && unitMod_options.action != null && typeof unitMod_options.action == "string" && unitMod_options.hasOwnProperty('by') && unitMod_options.by != null && typeof unitMod_options.by == "number") { 
                legendPP_unitMod(unitMod_options)
            } else {
                console.error('Missing/invalid options for "unitModifier". Try `unitModifier: {action: "multiply", number: 1000}`.')
            };
        }

        // make sure legendPosition option is valid, if not, revert to default
        if(!['topleft', 'topright', 'bottomleft', 'bottomright'].includes(position)) {
            console.error('Invalid legendPosition. Choose one of: "bottomleft", "bottomright", "topleft", "topright". Overriding with default ("bottomleft").');
            position = 'bottomleft';
        }

        var legend = L.control({position: position});
        
        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'info legend');
            // legend title:
            div.innerHTML += '<div style="font-weight: bold; display: flex; justify-content: center; margin-bottom: 5px; max-width: 170px;">' + title + '</div>';
            // legenditems container
            var container = '';
            
            // type of features
            if (typeOfFeatures == "MultiPoint" || typeOfFeatures == "Point") {
                // points
                switch (asc) {
                    // ascending legend
                    case true:
                        switch (mode_point) {
                            case 'color':
                            // color based categories
                                for (var i = 0; i < classes.length; i++) {
                                    /*console.log('Legend: building line', i+1)*/
                                    let low = classes[i];
                                    let high = classes[i+1];
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            svgCreator({shape: ps, color: colors[i]})+
                                            '<div>'+ (i == 0 ? '< ' + high : (!high ? low + ' <' : low + ' &ndash; ' + high)) +'</div>'+
                                        '</div>';
                                }
                                break;
                            case 'size':
                            // size (radius) based categories
                                for (var i = 0; i < classes.length; i++) {
                                    let low = classes[i];
                                    let high = classes[i+1];
                                    /*console.log('Legend: building line', i+1)*/
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            svgCreator({shape: ps, size: radiuses[i], color: pfc})+
                                            '<div>'+ (i == 0 ? '< ' + high : (!high ? low + ' <' : low + ' &ndash; ' + high)) +'</div>'+
                                        '</div>';
                                }
                                break;
                        }
                        break;
                    // descending legend
                    case false:
                        switch (mode_point) {
                            case 'color':
                            // color based categories
                                for (var i = classes.length; i > 0; i--) {
                                    /*console.log('Legend: building line', i)*/
                                    let low = classes[i-1];
                                    let high = classes[i];
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            svgCreator({shape: ps, color: colors[i-1]})+
                                            '<div>'+ (!high ? low + ' <' : (i != 1 ? low + ' &ndash; ' + high : '< ' + high))+'</div>'+
                                        '</div>';
                                }
                                break;
                            case 'size':
                            // size (radius) based categories
                                for (var i = classes.length; i > 0; i--) {
                                    /*console.log('Legend: building line', i)*/
                                    let low = classes[i-1];
                                    let high = classes[i];
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            svgCreator({shape: ps, size: radiuses[i-1], color: pfc})+
                                            '<div>'+ (!high ? low + ' <' : (i != 1 ? low + ' &ndash; ' + high : '< ' + high))+'</div>'+
                                        '</div>';
                                }
                                break;
                        }
                        break;
                }
            } else if (typeOfFeatures == "MultiLineString" || typeOfFeatures == "LineString") {
                // lines
                switch (asc) {
                    case true:
                    // ascending legend
                        switch (mode_line) {
                            case 'color':
                            // color based categories
                                for (var i = 0; i < classes.length; i++) {
                                    /*console.log('Legend: building line', i+1)*/
                                    let low = classes[i];
                                    let high = classes[i+1];
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            '<i style="background: ' + colors[i] + '"></i> ' +
                                            '<div>'+ (i == 0 ? '< ' + high : (!high ? low + ' <' : low + ' &ndash; ' + high)) +'</div>'+
                                        '</div>';
                                }
                                break;
                            case 'width':
                            // width based categories
                                for (var i = 0; i < classes.length; i++) {
                                    /*console.log('Legend: building line', i+1)*/
                                    let low = classes[i];
                                    let high = classes[i+1];
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            '<svg width="25" height="25" viewBox="0 0 25 25" style="margin-left: 4px; margin-right: 10px">'+
                                                '<line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: '+widths[i]+'; stroke: '+lc+';"/>'+
                                            '</svg>'+
                                            '<div>'+ (i == 0 ? '< ' + high : (!high ? low + ' <' : low + ' &ndash; ' + high)) +'</div>'+
                                        '</div>';
                                }
                                break;
                        }
                        break;
                    case false:
                    // descending legend
                        switch (mode_line) {
                            case 'color':
                            // color based categories
                                for (var i = classes.length; i > 0; i--) {
                                    /*console.log('Legend: building line', i)*/
                                    let low = classes[i-1];
                                    let high = classes[i];
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            '<i style="background: ' + colors[i-1] + '"></i>' +
                                            '<div>'+ (!high ? low + ' <' : (i != 1 ? low + ' &ndash; ' + high : '< ' + high))+'</div>'+
                                        '</div>'
                                }
                                break;
                            case 'width':
                            // width based categories
                                for (var i = classes.length; i > 0; i--) {
                                    /*console.log('Legend: building line', i)*/
                                    let low = classes[i-1];
                                    let high = classes[i];
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            '<svg width="25" height="25" viewBox="0 0 25 25" style="margin-left: 4px; margin-right: 10px">'+
                                                '<line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: '+widths[i-1]+'; stroke: '+lc+';"/>'+
                                            '</svg>'+
                                            '<div>'+ (!high ? low + ' <' : (i != 1 ? low + ' &ndash; ' + high : '< ' + high))+'</div>'+
                                        '</div>'
                                }
                                break;
                        }
                        break;
                }
            } else {
                // polygons
                switch (asc) {
                    case true:
                    // ascending legend
                        for (var i = 0; i < classes.length; i++) {
                            /*console.log('Legend: building line', i+1)*/
                            let low = classes[i];
                            let high = classes[i+1];
                            container +=
                                '<div style="display: flex; flex-direction: row; align-items: center">'+
                                    '<i style="background: ' + colors[i] + '"></i> ' +
                                    '<div>'+ (i == 0 ? '< ' + high : (!high ? low + ' <' : low + ' &ndash; ' + high)) +'</div>'+
                                '</div>';
                        }
                        break;
                    case false:
                    // descending legend
                        for (var i = classes.length; i > 0; i--) {
                            /*console.log('Legend: building line', i)*/
                            let low = classes[i-1];
                            let high = classes[i];
                            container +=
                                '<div style="display: flex; flex-direction: row; align-items: center">'+
                                    '<i style="background: ' + colors[i-1] + '"></i>' +
                                    '<div>'+ (!high ? low + ' <' : (i != 1 ? low + ' &ndash; ' + high : '< ' + high))+'</div>'+
                                '</div>'
                        }
                        break;
                }
            }
            
            div.innerHTML += container;
            return div;
        };

        legend.id = this._leaflet_id;
        this._legends.push(legend);
        console.log('Legend generated:', title);
        legend.addTo(map);
    },

    onAdd(map) {
        // DEBUG FLAG - enable for development
        var DEBUG = false;
        if(!DEBUG){
            if(!window.console) window.console = {};
            var methods = ["log"];
            for(var i=0;i<methods.length;i++){
                console[methods[i]] = function(){};
            }
        }

        console.log('L.dataClassification: Classifying...')
        console.log('L.dataClassification: options:', this.options)
        this._field=this.options.field
        L.GeoJSON.prototype.onAdd.call(this, map);
        this._classify(map);
    },

    _classify(map) {
        _field=this.options.field;
        var features_info = { Point: 0, MultiPoint: 0, LineString: 0, MultiLineString: 0, Polygon: 0, MultiPolygon: 0};
        var typeOfFeatures = 'unknown';
        values = [];
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
            if (layer.feature.properties[this._field] != null) {
                values.push(layer.feature.properties[this._field]);
            } else {
                console.error('Attribute field "'+this._field+'" does not exist, or is NULL in given GeoJSON. Please note that attribute field input is case-sensitve.')
                return;
            };
        })
        this._values = values;
        console.log('Loaded values from GeoJSON (field: '+this._field+'):', this._values);	
        console.log('Feature types in GeoJSON:', features_info)
        typeOfFeatures = Object.keys(features_info).reduce((a, b) => features_info[a] > features_info[b] ? a : b);
        console.log('Dominant feature type in GeoJSON:', typeOfFeatures)

        // if line color is overridden with L.Path style options, reflect that in Legend too
        if ((typeOfFeatures == 'LineString' || typeOfFeatures == 'MultiLineString')) {
            if (this.options.hasOwnProperty('style')) {
                this._linecolor = this.options.style.color;
            } else {
                this._linecolor = L.Path.prototype.options.color;
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
        lineWidth = this.options.lineWidth;
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
        var asc = this.options.legendAscending;
        middlepoint = this.options.middlePointValue;
        var legendtitle;
        if (this.options.legendTitle == 'hidden') {
            legendtitle = '';                    
        } else {
            (this.options.legendTitle == '' ? legendtitle = this._field :legendtitle = this.options.legendTitle )
        }; 	
        var classrounding = this.options.classRounding;
        if (classrounding > 10) { // over 10
            console.warn("Don't be silly, by rounding class boundary values to 10+ decimal places the legend will look incomprehensible. Overriding classrounding with 0 (whole numbers) for now. Fix this by using a more sensible number for the 'classRounding' parameter (like 2), set it to zero to get whole numbers, or set it to negative numbers to round up/down to 10s (-1), 100s (-2), 1000s (-3), etc."); 
            classrounding = 0;
        }; 
        var pointfillcolor = this.options.style.fillColor;
        this._unitMod = this.options.unitModifier;
        this._legendPos = this.options.legendPosition;

        // classification process
        var success = false;
        if (classnum > 2 && classnum < this._values.length) {				
            switch (mode) {
                case 'jenks':	
                    classes = ss.jenks(values, classnum);
                    classes.pop(); // remove last, since its the max value
                    console.log('Jenks classes: ', classes);
                    success = true;
                    break;
                case 'equalinterval':
                    classes = [];
                    var minmax = ss.extent(values);
                    console.log('min:', minmax[0], ', max:', minmax[1])
                    var range = minmax[1]-minmax[0];
                    console.log('data range:', range)
                    var oneclass = range/classnum;
                    console.log('one class:', oneclass);
                    for (var i=minmax[0]; i<minmax[1];) {
                        classes.push(i);
                        i = i + oneclass;
                    }
                    console.log('EI classes: ', classes);
                    success = true;
                    break;
                case 'quantile':
                    classes = [];
                    for (var i = 0; i<classnum; i++) {
                        var currentq = (1/classnum)*i;
                        classes.push(ss.quantile(values, currentq));
                    }				
                    console.warn('Quantile classes at the middle might be different, compared to GIS SW');		
                    console.log('Quantile classes: ', classes);	
                    success = true;
                    break;
                // EXPERIMENTAL LOG
                case 'logarithmic':
                    classes = [];
                    var minmax = ss.extent(values);
                    console.log('min:', minmax[0], ', max:', minmax[1])							
                    for (var i = 0; i<classnum; i++) {
                        var x = Math.pow(10, i);
                        classes.push(x);
                    }					
                    console.log('Logarithmic classes: ', classes);	
                    success = true;
                    break;
                default:
                    console.error('wrong classification type (choose from "jenks", "equalinterval", "quantile")')
            }
            if (success) {
                try {
                    colors = chroma.scale(colorramp).colors(classnum);
                } catch (error) {
                    console.error(error)
                    console.error('Make sure chosen color ramp exists (color ramps based on https://colorbrewer2.org/) and custom colors are formatted correctly. For supported formats, see https://gka.github.io/chroma.js/. For an interactive color palette helper, see https://gka.github.io/palettes/.')
                    return;
                }
                if (colorramp_rev) {
                    console.log('reversing colorramp')
                    colors.reverse(); 
                };
            }
            if (mode_point == "size") {
                this._pointMode_size_radiuses(pointSize);
            }
            if (mode_line == "width") {
                this._lineMode_width(lineWidth);
            }
            if (middlepoint != null && classnum % 2 == 0) {
                console.log('Adjusting middle classes to value: ', middlepoint);
                classes[classes.length / 2] = middlepoint;
            }
            if (classrounding != null) { this._classPostProc_rounding(classrounding); }    // round class boundary values
        } else {
            console.error('Classnumber out of range (must be: 2 < x <', values.length, '(featurecount))!');
            return;
        };
        
        svgCreator = this._svgCreator;
        ps = this._pointShape;
        stylePoint_color = this._stylePoint_color;
        stylePoint_size = this._stylePoint_size;
        styleLine_color = this._styleLine_color;
        styleLine_width = this._styleLine_width;
        stylePolygon = this._stylePolygon;
        getColor = this._getColor;
        getRadius = this._getRadius;
        getWeight = this._getWeight;
        pointMarkers = this._pointMarkers;
        options = this.options;

        currentmarker = null;

        // apply symbology to features
        this.eachLayer(function(layer) {
            if (layer.feature.geometry.type == "Point" || layer.feature.geometry.type == "MultiPoint") {
                var coords = layer.feature.geometry.coordinates;
                var style = (mode_point == "color" ? stylePoint_color(layer.feature.properties[this._field]) : stylePoint_size(layer.feature.properties[this._field], this.options))
                style.shape = ps;

                const svgIcon = L.divIcon({
                    html: svgCreator({shape: style.shape, size: style.radius, color: style.fillColor}),
                    className: "",
                    iconSize: [25, 25],
                    iconAnchor: [17, 25/2],
                });                
                layer.setIcon(svgIcon);
            }
            if (layer.feature.geometry.type == "LineString" || layer.feature.geometry.type == "MultiLineString") {
                layer.setStyle((mode_line == "width" ? styleLine_width(layer.feature.properties[this._field]) : styleLine_color(layer.feature.properties[this._field])))/*.addTo(map)*/;
            }
            if (layer.feature.geometry.type == "Polygon" || layer.feature.geometry.type == "MultiPolygon") {
                layer.setStyle(stylePolygon(layer.feature.properties[this._field]))/*.addTo(map)*/;
            }
            
        });

        this._generateLegend(legendtitle, asc, mode_line, mode_point, typeOfFeatures, pointfillcolor);  // generate legend

        console.log('L.dataClassification: Finished!')
        console.log('------------------------------------')
    },

    classify() {
        this._classify(this._map);
    },
    
    onRemove(map) {
        console.log('Removing Layer..........')
        // remove legend
        legend = this._legends.find(item => item.id === this._leaflet_id);
        console.log('Removing Legend with id:', legend.id, legend)
        legend.remove();
        console.log('Legend Removed.')
        // remove layer
		this.eachLayer(map.removeLayer, map);
        console.log('Layer Removed.')
	}
});


L.dataClassification = function (layers, options) {
	return new L.DataClassification(layers, options);
};