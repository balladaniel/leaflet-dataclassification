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
        legendTitle: '',					        // title for legend (usually a description of visualized data). HTML-markdown and styling allowed. If you want to hide title, set this as 'hidden'. (default: ='field')
        classRounding: 0                            // class boundary value rounding to decimal (default: 0 - whole numbers), set -1 to disable rounding
    },

    // variables for plugin scope
    _values: [],
    _legends: [],
    _classes: [],
    _colors: [],
    _radiuses: [],
    _widths: [],
    _pointMarkers: [],
    _field: '',
    _pointShape: '',
    _linecolor: '',
    _pointcolor: '',

    // value evaluators to match classes
    _getColor(d) {
        for (var i = 0; i<classes.length; i++) {
            if (d < classes[i+1]) {
                return colors[i];
            } 					
        }
        return colors.at(-1);	// highest group
    },
    _getWeight(d) {
        for (var i = 0; i<classes.length; i++) {
            if (d < classes[i+1]) {
                return widths[i];
            } 					
        }
        return widths.at(-1);	// highest group
    },
    _getRadius(d) {
        for (var i = 0; i<classes.length; i++) {
            if (d < classes[i+1]) {
                return radiuses[i];
            } 					
        }
        return radiuses.at(-1);	// highest group
    },

    // stylers
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
    _stylePoint_size(value){
        return {
            fillColor: "orange",
            fillOpacity: 1,
            color: "black",
            weight: 1,
            shape: "circle",
            radius: getRadius(value)
        };			
    },
    _styleLine_color(value){
        return {
            color: getColor(value)/*,
            weight: 3*/
        };			
    },
    _styleLine_width(value){
        return {
            weight: getWeight(value)
        };			
    },
    _stylePolygon(value){
        return {
            fillColor: getColor(value),
            fillOpacity: 0.7,
            /*color: 'white',*/
            /*weight: 2*/
        };			
    },
    
    // get n categories of point radiuses, line widths for symbology
    _pointMode_size_radiuses(sizes){
        radiuses = [];
        
        var step = (sizes.max - sizes.min) / (classes.length - 1);
        for (var i = 0; i < classes.length; i++) {
            var curr = sizes.min + (step * i);
            radiuses.push(curr);
        }
        console.log('points: radius categories:', radiuses)
    },
    _lineMode_width(sizes){
        widths = [];
        
        var step = (sizes.max - sizes.min) / (classes.length - 1);
        for (var i = 0; i < classes.length; i++) {
            widths.push(sizes.min + (step * i));
        }
        console.log('lines: width categories:', widths)
    },

    _svgCreator(options){
        (options.shape == null ? options.shape = 'circle' : '');			// default shape
        (options.color == null ? options.color = 'orange' : '');			// default color
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

    _generateLegend(title, asc, round, mode_line, mode_point, typeOfFeatures) {
        svgCreator = this._svgCreator;
        ps = this._pointShape;
        lc = this._linecolor

        var legend = L.control({position: 'bottomleft'});
        
        if (round >= 0) {
            for (var i=0; i<classes.length; i++) {
                classes[i] = classes[i].toFixed(round);
            }
            console.log('Class interval boundary values have been rounded to', round, 'decimals.')
        }
        
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
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            svgCreator({shape: ps, color: colors[i]})+
                                            '<div>'+(i == 0 ? '< ' : classes[i] + (classes[i + 1] ? ' &ndash; ' : '')) + (classes[i + 1] ? classes[i + 1] : ' <')+'</div>'+
                                        '</div>';
                                }
                                break;
                            case 'size':
                            // size (radius) based categories
                                for (var i = 0; i < classes.length; i++) {
                                    /*console.log('Legend: building line', i+1)*/
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            svgCreator({shape: ps, size: radiuses[i]})+
                                            '<div>'+(i == 0 ? '< ' : classes[i] + (classes[i + 1] ? ' &ndash; ' : '')) + (classes[i + 1] ? classes[i + 1] : ' <')+'</div>'+
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
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            svgCreator({shape: ps, color: colors[i-1]})+
                                            '<div>'+(i == 1 ? '< ' : '') + (i == classes.length ? classes[i-1] + ' <' : classes[i] + (i == 1 ? '' : ' &ndash; ' + classes[i-1]))+'</div>'+
                                        '</div>';
                                }
                                break;
                            case 'size':
                            // size (radius) based categories
                                for (var i = classes.length; i > 0; i--) {
                                    /*console.log('Legend: building line', i)*/
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            svgCreator({shape: ps, size: radiuses[i-1]})+
                                            '<div>'+(i == 1 ? '< ' : '') + (i == classes.length ? classes[i-1] + ' <' : classes[i] + (i == 1 ? '' : ' &ndash; ' + classes[i-1]))+'</div>'+
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
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            '<i style="background: ' + colors[i] + '"></i> ' +
                                            '<div>'+(i == 0 ? '< ' : classes[i] + (classes[i + 1] ? ' &ndash; ' : '')) + (classes[i + 1] ? classes[i + 1] : ' <')+'</div>'+
                                        '</div>';
                                }
                                break;
                            case 'width':
                            // width based categories
                                for (var i = 0; i < classes.length; i++) {
                                    /*console.log('Legend: building line', i+1)*/
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            '<svg width="25" height="25" viewBox="0 0 25 25" style="margin-left: 4px; margin-right: 10px">'+
                                                '<line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: '+widths[i]+'; stroke: '+lc+';"/>'+
                                            '</svg>'+
                                            '<div>'+(i == 0 ? '< ' : classes[i] + (classes[i + 1] ? ' &ndash; ' : '')) + (classes[i + 1] ? classes[i + 1] : ' <')+'</div>'+
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
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            '<i style="background: ' + colors[i-1] + '"></i>' +
                                            '<div>'+(i == 1 ? '< ' : '') + (i == classes.length ? classes[i-1] + ' <' : classes[i] + (i == 1 ? '' : ' &ndash; ' + classes[i-1]))+'</div>'+
                                        '</div>'
                                }
                                break;
                            case 'width':
                            // width based categories
                                for (var i = classes.length; i > 0; i--) {
                                    /*console.log('Legend: building line', i)*/
                                    container +=
                                        '<div style="display: flex; flex-direction: row; align-items: center">'+
                                            '<svg width="25" height="25" viewBox="0 0 25 25" style="margin-left: 4px; margin-right: 10px">'+
                                                '<line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: '+widths[i-1]+'; stroke: '+lc+';"/>'+
                                            '</svg>'+
                                        '<div>'+(i == 1 ? '< ' : '') + (i == classes.length ? classes[i-1] + ' <' : classes[i] + (i == 1 ? '' : ' &ndash; ' + classes[i-1]))+'</div>'+
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
                            container +=
                                '<div style="display: flex; flex-direction: row; align-items: center">'+
                                    '<i style="background: ' + colors[i] + '"></i> ' +
                                    '<div>'+(i == 0 ? '< ' : classes[i] + (classes[i + 1] ? ' &ndash; ' : '')) + (classes[i + 1] ? classes[i + 1] : ' <')+'</div>'+
                                '</div>';
                        }
                        break;
                    case false:
                    // descending legend
                        for (var i = classes.length; i > 0; i--) {
                            /*console.log('Legend: building line', i)*/
                            container +=
                                '<div style="display: flex; flex-direction: row; align-items: center">'+
                                    '<i style="background: ' + colors[i-1] + '"></i>' +
                                    '<div>'+(i == 1 ? '< ' : '') + (i == classes.length ? classes[i-1] + ' <' : classes[i] + (i == 1 ? '' : ' &ndash; ' + classes[i-1]))+'</div>'+
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
        console.log('L.dataClassification: Classifying...')
        console.log('L.dataClassification: options:', this.options)
        this._field=this.options.field
        L.GeoJSON.prototype.onAdd.call(this, map);
        this._classify(map);
    },

    _classify(map) {
        _field=this.options.field
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
        if (classrounding > 15) { // over 15
            console.warn("Don't be silly, legend will look incomprehensible. Overriding classrounding with 0 (whole numbers)."); 
            classrounding = 0;
        }; 

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
                    console.error('Make sure chosen color ramp exists (color ramps based on https://colorbrewer2.org/) and custom colors are formatted correctly. For supported formats, see https://gka.github.io/chroma.js/.')
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
            this._generateLegend(legendtitle, asc, classrounding, mode_line, mode_point, typeOfFeatures);
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

        currentmarker = null;

        // apply symbology to features
        this.eachLayer(function(layer) {
            if (layer.feature.geometry.type == "Point" || layer.feature.geometry.type == "MultiPoint") {
                var coords = layer.feature.geometry.coordinates;
                var style = (mode_point == "color" ? stylePoint_color(layer.feature.properties[this._field]) : stylePoint_size(layer.feature.properties[this._field]))
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