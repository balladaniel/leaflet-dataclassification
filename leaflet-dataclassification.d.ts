// Type definitions for plugin leaflet-dataclassification (L.dataClassification).
// Manually created.
// https://github.com/balladaniel/leaflet-dataclassification/

import { GeoJSON } from 'leaflet';
import * as L from 'leaflet';
import * as ss from 'simple-statistics';
import * as chroma from 'chroma-js';

declare module 'leaflet' {
    export class DataClassification extends L.GeoJSON {
        constructor(geojson: GeoJSON.GeoJsonObject | GeoJSON.GeoJsonObject[], options: DataClassificationOptions);
    }

    export interface DataClassificationOptions extends GeoJSONOptions {
        /**
         * Classification method to use. When using standard deviation, option classes is ignored. 
         * When using manual (which partially defeats the purpose of this plugin), option classes must be an array of class boundary values!
         * 
         * **Required.**
         */
        mode: ('jenks' | 'quantile' | 'equalinterval' | 'logarithmic' | 'stddeviation' | 'manual');
        /**
         * Desired number of classes (min: 3; max: 10 or featurecount, whichever is lower. If higher, reverts back to the max of 10.). 
         * If mode is 'manual', this must be an array of numbers! In that case, for example [0, 150, 200] would yield the following 
         * three classes: below 150, 150-200, above 200.
         * 
         * **Required.**
         */
        classes: number | number[];
        /** Target attribute field name to base classification on. Case-sensitive!
         * 
         * **Required.**
         */
        field: string;
        /** **(Specific for Point features)** Distinction base for point features, fill "color" or "size" (default: 'color') */
        pointMode?: ('color' | 'size');
        /** **(Specific for Point features)** When pointMode is "size", define min/max point symbol radius */
        pointSize?: {
            /** Symbol size for the lowest class. (default: 2) */
            min?: number;
            /** Symbol size for the highest class. (default: 10) */
            max?: number;
        };
        /** **(Specific for Point features)** Shape of point symbols: 'circle', 'square', 'diamond' (default: 'circle') */
        pointShape?: ('circle' | 'square' | 'diamond');
        /** **(Specific for Line features)** Distinction base for line features, stroke "color" or "width" (default: 'color') */
        lineMode?: ('color' | 'width');
        /** **(Specific for Line features)** When lineMode is 'width', define min/max stroke width */
        lineWidth?: {
            /** Symbol size for the lowest class. (default: 3) */
            min?: number;
            /** Symbol size for the highest class. (default: 15) */
            max?: number;
        };
        /** **(Specific for Polygon features)** Distinction base for polygon features, fill "color" or "hatch" (default: 'color') */
        polygonMode?: ('color' | 'hatch');
        /** **(Specific for Polygon features)** When polygonMode is 'hatch', customize hatch fill pattern */
        polygonHatch?: {
            /** Symbol distinction mode between classes, whether the pattern differ in stroke widths, angles or both (default: 'both') */
            distinctionMode?: ('width' | 'angle' | 'both');
            /** Stroke colors (default: ['darkred', 'none']) */
            strokeColors?: string[];
            /** Stroke widths to gradually alternate between for symbols, when distinctionMode is 'width' or 'both'. */
            strokeWidth?: {
                /** Stroke width of the first color. Tip: set to -1 to have solid fills on two ends of the symbols' spectrum, only in distinctionMode: 'width' and 'both'. (default: 2) */
                min?: number;
                /** Stroke width of the other color (default: 10) */
                max?: number;
            };
            /** Initial angle for strokes in hatch pattern (leaflet-hatchclass default: 45) */
            angle?: number;
            /** Value to increment angle with between all hatch fill symbols, when distinctionMode is 'angle' or 'both' */
            alternateAngle?: number;
        };
        /** Custom styling (in addition to standard L.GeoJSON styling options) */
        style?: {
            /** **(Specific for Point features)** Symbol fill color, use only in 'size' pointMode (default: orange) */
            fillColor?: string;
            /** **(Specific for Point features)** Symbol shape radius (size), use only in 'color' pointMode (default: 8, max: 10-12) */
            radius?: number;
            /** 
             * **(Specific for Line features)** Line stroke color, use only in 'width' lineMode (default: "blue", the L.path default) 
             * 
             * **(Specific for Polygon features)** Polygon outline color (default: '#3388ff' blue, the L.path default)
             * */
            color?: string;
            /** 
             * **(Specific for Line features)** Line stroke weight, use only in 'color' lineMode (default: 3, the L.path default) 
             * 
             * **(Specific for Polygon features)** Polygon outline stroke width (default: 3, the L.path default)
             * */
            weight?: number;
            /** **(Specific for Polygon features)** Polygon fill opacity (default: 0.7) */
            fillOpacity?: number;

        };
        /**
         * Color ramp to use for symbology (only used with modes in which color is the way of distinction between symbols). 
         * Based on ColorBrewer2 color ramps (https://colorbrewer2.org/), included in Chroma.js. 
         * Custom colors (colorCustom) override this. (default: 'PuRd')
         */
        colorRamp?: string;
        /**
         * Custom color ramp defined as an array, colors in formats supported by Chroma.js, with opacity support. 
         * A minimum of two colors are required. If defined, custom colors override colorRamp. Examples: ['rgba(210,255,178,1)', '#fec44f', 'f95f0eff'].
         * Examples for yellow in different color formats: '#ffff00', 'ffff00', '#ff0', 'yellow', '#ffff0055', 
         * 'rgba(255,255,0,0.35)', 'hsla(58,100%,50%,0.6)', chroma('yellow').alpha(0.5). For more formats, see: https://gka.github.io/chroma.js/. 
         * For an interactive color palette helper, see: https://gka.github.io/palettes/.
         */
        colorCustom?: string[];
        /** Fill/line color to use for features with null/nodata attribute values. (default: '#606060') */
        noDataColor?: string;
        /** If true, features with null attribute values are not shown on the map. This also means the legend will not have a nodata class (default: false) */
        noDataIgnore?: boolean;
        /**
         * If true, reverses the chosen color ramp, both in symbology on map and legend colors. Useful when you found a great looking colorramp 
         * (e.g. green to red), but would prefer reversed colors to match visual implications about colors: green implies positive, 
         * red implies negative phenomena. (default: false)
         */
        reverseColorRamp?: boolean;
        /**
         * Adjust boundary value of middle classes (only when classifying into even classes). Useful for symmetric classification of 
         * diverging data around 0. Only use a value within the range of the two middle classes.
         */
        middlePointValue?: number;
        /**
         * Class boundary value rounding. When positive numbers are used for this option, class boundary values are rounded to x decimals, 
         * zero will round to whole numbers, while negative numbers will round values to the nearest 10, 100, 1000, etc. 
         * Example: with a setting of "1", a value of 254777.253 will get rounded up to 254777.3, with "0" it will be 254777, 
         * with "-2" it will become 254800. (default: null - no rounding happens, values are used as-is)
         */
        classRounding?: number;
        /** Attribute field name to normalize values of field by. Useful for choropleth maps showing population density. Case-sensitive! */
        normalizeByField?: string;
        /**
         * Legend header (usually a description of visualized data, with a unit of measurement). HTML-markdown and styling allowed. 
         * To hide header, set this as ''. (by default it inherits target attribute field name, on which the classification is based on)
         */
        legendTitle?: string;
        /**
         * Legend footer, centered, using a smaller italic font by default (customizble in CSS - .legendFooter class). 
         * HTML-markdown and CSS styling allowed. Hidden by default. (default: null)
         */
        legendFooter?: string;
        /** Legend position, L.control option. (default: 'bottomleft') */
        legendPosition?: ('topleft'|'topright'|'bottomleft'|'bottomright');
        /** Legend symbology row gap in pixels. You can also alter this in the attached CSS file. (default: 3) */
        legendRowGap?: number;
        /** If true, value classes in legend will be ascending (low first, high last) (default: false) */
        legendAscending?: boolean;
        /**
         * Custom HTML formatting of legend rows using {high}, {low} and {count} placeholders (interpreted as high/low value and 
         * feature count in the context of a given class interval). Distinct formatting for the highest, lowest and middle class intervals. 
         * Middle class format requires both {high} and {low}, highest only {low} and lowest only {high}. You can also format the row for nodata, 
         * if there are features with null attributes and you wish to show a class for them in the legend (defined by noDataIgnore).
         */
        legendTemplate?: {
            /** Template for the upper end of classes, "highest value and above" (default: '{low} <') */
            highest?: string;
            /** Template for rows in the middle, "low to high" (default: '{low} – {high}') */
            middle?: string;
            /** Template for the lower end of classes, "lowest value and below" (default: '< {high}') */
            lowest?: string;
            /** Text to show for null/nodata class (default: 'No data') */
            nodata?: string;
        };    
        /**
         * Modifies the final class boundary values in order to multiply/divide them by a number. Useful for example when a dataset attribute 
         * is in metres, but kilometres would fit the legend better (786000 metres shown as 786 km). Purely visual, only affects legend. 
         * Happens after classRounding.
         */    
        unitModifier?: {
            /** Action to take on the number specified by 'by'. Required for 'unitModifier'. */
            action: ('divide'|'multiply');
            /** A number to divide/multiply class boundary values with. Required for 'unitModifier'. */
            by: number;
        }
    }

    export function dataClassification(
        geojson: GeoJSON.GeoJsonObject | GeoJSON.GeoJsonObject[],
        options: DataClassificationOptions
    ): DataClassification;
}