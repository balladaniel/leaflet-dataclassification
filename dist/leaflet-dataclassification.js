import * as L from 'leaflet';

/**
 * When adding a new value to a list, one does not have to necessary
 * recompute the mean of the list in linear time. They can instead use
 * this function to compute the new mean by providing the current mean,
 * the number of elements in the list that produced it and the new
 * value to add.
 *
 * @since 2.5.0
 * @param {number} mean current mean
 * @param {number} n number of items in the list
 * @param {number} newValue the added value
 * @returns {number} the new mean
 *
 * @example
 * addToMean(14, 5, 53); // => 20.5
 */

/**
 * Our default sum is the [Kahan-Babuska algorithm](https://pdfs.semanticscholar.org/1760/7d467cda1d0277ad272deb2113533131dc09.pdf).
 * This method is an improvement over the classical
 * [Kahan summation algorithm](https://en.wikipedia.org/wiki/Kahan_summation_algorithm).
 * It aims at computing the sum of a list of numbers while correcting for
 * floating-point errors. Traditionally, sums are calculated as many
 * successive additions, each one with its own floating-point roundoff. These
 * losses in precision add up as the number of numbers increases. This alternative
 * algorithm is more accurate than the simple way of calculating sums by simple
 * addition.
 *
 * This runs in `O(n)`, linear time, with respect to the length of the array.
 *
 * @param {Array<number>} x input
 * @return {number} sum of all input numbers
 * @example
 * sum([1, 2, 3]); // => 6
 */
function sum(x) {
    // If the array is empty, we needn't bother computing its sum
    if (x.length === 0) {
        return 0;
    }

    // Initializing the sum as the first number in the array
    let sum = x[0];

    // Keeping track of the floating-point error correction
    let correction = 0;

    let transition;

    if (typeof sum !== "number") {
        return Number.NaN;
    }

    for (let i = 1; i < x.length; i++) {
        if (typeof x[i] !== "number") {
            return Number.NaN;
        }
        transition = sum + x[i];

        // Here we need to update the correction in a different fashion
        // if the new absolute value is greater than the absolute sum
        if (Math.abs(sum) >= Math.abs(x[i])) {
            correction += sum - transition + x[i];
        } else {
            correction += x[i] - transition + sum;
        }

        sum = transition;
    }

    // Returning the corrected sum
    return sum + correction;
}

/**
 * The mean, _also known as average_,
 * is the sum of all values over the number of values.
 * This is a [measure of central tendency](https://en.wikipedia.org/wiki/Central_tendency):
 * a method of finding a typical or central value of a set of numbers.
 *
 * This runs in `O(n)`, linear time, with respect to the length of the array.
 *
 * @param {Array<number>} x sample of one or more data points
 * @throws {Error} if the length of x is less than one
 * @returns {number} mean
 * @example
 * mean([0, 10]); // => 5
 */
function mean(x) {
    if (x.length === 0) {
        throw new Error("mean requires at least one data point");
    }

    return sum(x) / x.length;
}

/**
 * The sum of deviations to the Nth power.
 * When n=2 it's the sum of squared deviations.
 * When n=3 it's the sum of cubed deviations.
 *
 * @param {Array<number>} x
 * @param {number} n power
 * @returns {number} sum of nth power deviations
 *
 * @example
 * var input = [1, 2, 3];
 * // since the variance of a set is the mean squared
 * // deviations, we can calculate that with sumNthPowerDeviations:
 * sumNthPowerDeviations(input, 2) / input.length;
 */
function sumNthPowerDeviations(x, n) {
    const meanValue = mean(x);
    let sum = 0;
    let tempValue;
    let i;

    // This is an optimization: when n is 2 (we're computing a number squared),
    // multiplying the number by itself is significantly faster than using
    // the Math.pow method.
    {
        for (i = 0; i < x.length; i++) {
            tempValue = x[i] - meanValue;
            sum += tempValue * tempValue;
        }
    }

    return sum;
}

/**
 * This computes the minimum & maximum number in an array.
 *
 * This runs in `O(n)`, linear time, with respect to the length of the array.
 *
 * If any value is `NaN`, both bounds are `NaN`, wherever that value appears.
 *
 * @param {Array<number>} x sample of one or more data points
 * @returns {Array<number>} minimum & maximum value
 * @throws {Error} if the length of x is less than one
 * @example
 * extent([1, 2, 3, 4]);
 * // => [1, 4]
 */
function extent(x) {
    if (x.length === 0) {
        throw new Error("extent requires at least one data point");
    }

    let min = x[0];
    let max = x[0];
    for (let i = 1; i < x.length; i++) {
        if (Number.isNaN(x[i])) {
            return [Number.NaN, Number.NaN];
        }
        if (x[i] > max) {
            max = x[i];
        }
        if (x[i] < min) {
            min = x[i];
        }
    }
    return [min, max];
}

/**
 * This is the internal implementation of quantiles: when you know
 * that the order is sorted, you don't need to re-sort it, and the computations
 * are faster.
 *
 * This implements the linear interpolation method (type=7 in R/numpy),
 * which is the default in numpy.percentile and R's quantile.
 *
 * @param {Array<number>} x sample of one or more data points
 * @param {number} p desired quantile: a number between 0 to 1, inclusive
 * @returns {number} quantile value
 * @throws {Error} if p ix outside of the range from 0 to 1
 * @throws {Error} if x is empty
 * @example
 * quantileSorted([3, 6, 7, 8, 8, 9, 10, 13, 15, 16, 20], 0.5); // => 9
 */
function quantileSorted(x, p) {
    // Use (n-1) * p for index, matching numpy's linear method (type=7)
    const idx = (x.length - 1) * p;
    if (x.length === 0) {
        throw new Error("quantile requires at least one data point.");
    } else if (p < 0 || p > 1) {
        throw new Error("quantiles must be between 0 and 1");
    } else if (p === 1) {
        // If p is 1, directly return the last element
        return x[x.length - 1];
    } else if (p === 0) {
        // If p is 0, directly return the first element
        return x[0];
    } else if (idx % 1 !== 0) {
        // If idx is not integer, interpolate linearly between floor and ceil
        const lower = Math.floor(idx);
        const upper = Math.ceil(idx);
        const fraction = idx - lower;
        return x[lower] + fraction * (x[upper] - x[lower]);
    } else {
        // If idx is integer, type=7 returns the value at that index
        return x[idx];
    }
}

/**
 * Rearrange items in `arr` so that all items in `[left, k]` range are the smallest.
 * The `k`-th element will have the `(k - left + 1)`-th smallest value in `[left, right]`.
 *
 * Implements Floyd-Rivest selection algorithm https://en.wikipedia.org/wiki/Floyd-Rivest_algorithm
 *
 * @param {Array<number>} arr input array
 * @param {number} k pivot index
 * @param {number} [left] left index
 * @param {number} [right] right index
 * @returns {void} mutates input array
 * @example
 * var arr = [65, 28, 59, 33, 21, 56, 22, 95, 50, 12, 90, 53, 28, 77, 39];
 * quickselect(arr, 8);
 * // = [39, 28, 28, 33, 21, 12, 22, 50, 53, 56, 59, 65, 90, 77, 95]
 */
function quickselect(arr, k, left, right) {
    left = left || 0;
    if (right === undefined || right === null) {
        right = arr.length - 1;
    }

    while (right > left) {
        // 600 and 0.5 are arbitrary constants chosen in the original paper to minimize execution time
        if (right - left > 600) {
            const n = right - left + 1;
            const m = k - left + 1;
            const z = Math.log(n);
            const s = 0.5 * Math.exp((2 * z) / 3);
            let sd = 0.5 * Math.sqrt((z * s * (n - s)) / n);
            if (m - n / 2 < 0) sd *= -1;
            const newLeft = Math.max(left, Math.floor(k - (m * s) / n + sd));
            const newRight = Math.min(
                right,
                Math.floor(k + ((n - m) * s) / n + sd)
            );
            quickselect(arr, k, newLeft, newRight);
        }

        const t = arr[k];
        let i = left;
        let j = right;

        swap(arr, left, k);
        if (arr[right] > t) swap(arr, left, right);

        while (i < j) {
            swap(arr, i, j);
            i++;
            j--;
            while (arr[i] < t) i++;
            while (arr[j] > t) j--;
        }

        if (arr[left] === t) swap(arr, left, j);
        else {
            j++;
            swap(arr, j, right);
        }

        if (j <= k) left = j + 1;
        if (k <= j) right = j - 1;
    }
}

function swap(arr, i, j) {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}

/**
 * The [quantile](https://en.wikipedia.org/wiki/Quantile):
 * this is a population quantile, since we assume to know the entire
 * dataset in this library. This implementation uses linear interpolation,
 * equivalent to R's type=7 and numpy's default percentile method.
 *
 * Sample is a one-dimensional array of numbers,
 * and p is either a decimal number from 0 to 1 or an array of decimal
 * numbers from 0 to 1.
 * In terms of a k/q quantile, p = k/q - it's just dealing with fractions or dealing
 * with decimal values.
 * When p is an array, the result of the function is also an array containing the appropriate
 * quantiles in input order
 *
 * @param {Array<number>} x sample of one or more numbers
 * @param {Array<number> | number} p the desired quantile, as a number between 0 and 1
 * @returns {number} quantile
 * @example
 * quantile([3, 6, 7, 8, 8, 9, 10, 13, 15, 16, 20], 0.5); // => 9
 */
function quantile(x, p) {
    const copy = x.slice();

    if (Array.isArray(p)) {
        // rearrange elements so that each element corresponding to a requested
        // quantile is on a place it would be if the array was fully sorted
        multiQuantileSelect(copy, p);
        // Initialize the result array
        const results = [];
        // For each requested quantile
        for (let i = 0; i < p.length; i++) {
            results[i] = quantileSorted(copy, p[i]);
        }
        return results;
    } else {
        const idx = quantileIndex(copy.length, p);
        quantileSelect(copy, idx, 0, copy.length - 1);
        return quantileSorted(copy, p);
    }
}

function quantileSelect(arr, k, left, right) {
    if (k % 1 === 0) {
        quickselect(arr, k, left, right);
    } else {
        k = Math.floor(k);
        quickselect(arr, k, left, right);
        quickselect(arr, k + 1, k + 1, right);
    }
}

function multiQuantileSelect(arr, p) {
    // Collect every integer order statistic that the requested quantiles need.
    // Linear interpolation (type=7) reads x[floor(idx)] and x[ceil(idx)], so both
    // surrounding positions must be placed. Deduplicate to integer positions
    // so each is selected with an unambiguous index.
    const positions = new Set();
    for (let i = 0; i < p.length; i++) {
        const idx = quantileIndex(arr.length, p[i]);
        positions.add(Math.floor(idx));
        positions.add(Math.ceil(idx));
    }
    const indices = Array.from(positions).sort(compare);

    multiselect(arr, indices, 0, indices.length - 1, 0, arr.length - 1);
}

// Place every order statistic in `indices` by partitioning around the median
// requested position, then recursing into the two halves. The just-placed pivot
// is excluded from the child ranges (indices[mid] ± 1) so that a later, narrower
// quickselect cannot disturb an already-finalized position.
function multiselect(arr, indices, lo, hi, left, right) {
    if (lo > hi) return;
    const mid = (lo + hi) >> 1;
    quickselect(arr, indices[mid], left, right);
    multiselect(arr, indices, lo, mid - 1, left, indices[mid] - 1);
    multiselect(arr, indices, mid + 1, hi, indices[mid] + 1, right);
}

function compare(a, b) {
    return a - b;
}

function quantileIndex(len, p) {
    // Use (n-1) * p to match numpy's linear method (type=7)
    const idx = (len - 1) * p;
    if (p === 1) {
        // If p is 1, directly return the last index
        return len - 1;
    } else if (p === 0) {
        // If p is 0, directly return the first index
        return 0;
    } else if (idx % 1 !== 0) {
        // If index is not integer, keep the fractional position so we can
        // select both surrounding order statistics for interpolation.
        return idx;
    } else {
        // If index is integer, return that exact position.
        return idx;
    }
}

/*
 * Pull Breaks Values for Jenks
 *
 * the second part of the jenks recipe: take the calculated matrices
 * and derive an array of n breaks.
 *
 * @private
 */
function jenksBreaks(data, lowerClassLimits, nClasses) {
    let k = data.length;
    const kclass = [];
    let countNum = nClasses;

    // the calculation of classes will never include the upper
    // bound, so we need to explicitly set it
    kclass[nClasses] = data[data.length - 1];

    // the lowerClassLimits matrix is used as indices into itself
    // here: the `k` variable is reused in each iteration.
    while (countNum > 0) {
        kclass[countNum - 1] = data[lowerClassLimits[k][countNum] - 1];
        k = lowerClassLimits[k][countNum] - 1;
        countNum--;
    }

    return kclass;
}

/*
 * Compute Matrices for Jenks
 *
 * Compute the matrices required for Jenks breaks. These matrices
 * can be used for any classing of data with `classes <= nClasses`
 *
 * @private
 */
function jenksMatrices(data, nClasses) {
    // in the original implementation, these matrices are referred to
    // as `LC` and `OP`
    //
    // * lowerClassLimits (LC): optimal lower class limits
    // * varianceCombinations (OP): optimal variance combinations for all classes
    const lowerClassLimits = [];
    const varianceCombinations = [];
    // loop counters
    let i;
    let j;
    // the variance, as computed at each step in the calculation
    let variance = 0;

    // Initialize and fill each matrix with zeroes
    for (i = 0; i < data.length + 1; i++) {
        const tmp1 = [];
        const tmp2 = [];
        // despite these arrays having the same values, we need
        // to keep them separate so that changing one does not change
        // the other
        for (j = 0; j < nClasses + 1; j++) {
            tmp1.push(0);
            tmp2.push(0);
        }
        lowerClassLimits.push(tmp1);
        varianceCombinations.push(tmp2);
    }

    for (i = 1; i < nClasses + 1; i++) {
        lowerClassLimits[1][i] = 1;
        varianceCombinations[1][i] = 0;
        // in the original implementation, 9999999 is used but
        // since Javascript has `Infinity`, we use that.
        for (j = 2; j < data.length + 1; j++) {
            varianceCombinations[j][i] = Number.POSITIVE_INFINITY;
        }
    }

    // Shift values by the median to improve numeric stability
    const shift = data[Math.floor(data.length / 2)];

    for (let l = 2; l < data.length + 1; l++) {
        // `SZ` originally. this is the sum of the values seen thus
        // far when calculating variance.
        let sum = 0;
        // `ZSQ` originally. the sum of squares of values seen
        // thus far
        let sumSquares = 0;
        // `WT` originally. This is the number of
        let w = 0;
        // `IV` originally
        let i4 = 0;

        // in several instances, you could say `Math.pow(x, 2)`
        // instead of `x * x`, but this is slower in some browsers
        // introduces an unnecessary concept.
        for (let m = 1; m < l + 1; m++) {
            // `III` originally
            const lowerClassLimit = l - m + 1;
            const val = data[lowerClassLimit - 1] - shift;

            // here we're estimating variance for each potential classing
            // of the data, for each potential number of classes. `w`
            // is the number of data points considered so far.
            w++;

            // increase the current sum and sum-of-squares
            sum += val;
            sumSquares += val * val;

            // the variance at this point in the sequence is the difference
            // between the sum of squares and the total x 2, over the number
            // of samples.
            variance = sumSquares - (sum * sum) / w;

            i4 = lowerClassLimit - 1;

            if (i4 !== 0) {
                for (j = 2; j < nClasses + 1; j++) {
                    // if adding this element to an existing class
                    // will increase its variance beyond the limit, break
                    // the class at this point, setting the `lowerClassLimit`
                    // at this point.
                    if (
                        varianceCombinations[l][j] >=
                        variance + varianceCombinations[i4][j - 1]
                    ) {
                        lowerClassLimits[l][j] = lowerClassLimit;
                        varianceCombinations[l][j] =
                            variance + varianceCombinations[i4][j - 1];
                    }
                }
            }
        }

        lowerClassLimits[l][1] = 1;
        varianceCombinations[l][1] = variance;
    }

    // return the two matrices. for just providing breaks, only
    // `lowerClassLimits` is needed, but variances can be useful to
    // evaluate goodness of fit.
    return {
        lowerClassLimits: lowerClassLimits,
        varianceCombinations: varianceCombinations
    };
}

/**
 * The **[jenks natural breaks optimization](http://en.wikipedia.org/wiki/Jenks_natural_breaks_optimization)**
 * is an algorithm commonly used in cartography and visualization to decide
 * upon groupings of data values that minimize variance within themselves
 * and maximize variation between themselves.
 *
 * For instance, cartographers often use jenks in order to choose which
 * values are assigned to which colors in a [choropleth](https://en.wikipedia.org/wiki/Choropleth_map)
 * map.
 *
 * @param {Array<number>} data input data, as an array of number values
 * @param {number} nClasses number of desired classes
 * @returns {Array<number> | null} array of class break positions, or null
 * when nClasses is greater than the number of data points
 * @example
 * // split data into 3 break points
 * jenks([1, 2, 4, 5, 7, 9, 10, 20], 3) // = [1, 7, 20, 20]
 */
function jenks(data, nClasses) {
    if (nClasses > data.length) {
        return null;
    }

    // sort data in numerical order, since this is expected
    // by the matrices function
    data = data.slice().sort(function (a, b) {
        return a - b;
    });

    // get our basic matrices
    const matrices = jenksMatrices(data, nClasses);
    // we only need lower class limits here
    const lowerClassLimits = matrices.lowerClassLimits;

    // extract nClasses out of the computed matrices
    return jenksBreaks(data, lowerClassLimits, nClasses);
}

/**
 * The [variance](http://en.wikipedia.org/wiki/Variance)
 * is the sum of squared deviations from the mean.
 *
 * This is an implementation of variance, not sample variance:
 * see the `sampleVariance` method if you want a sample measure.
 *
 * @param {Array<number>} x a population of one or more data points
 * @returns {number} variance: a value greater than or equal to zero.
 * zero indicates that all values are identical.
 * @throws {Error} if x's length is 0
 * @example
 * variance([1, 2, 3, 4, 5, 6]); // => 2.9166666666666665
 */
function variance(x) {
    if (x.length === 0) {
        throw new Error("variance requires at least one data point");
    }

    // Find the mean of squared deviations between the
    // mean value and each value.
    return sumNthPowerDeviations(x) / x.length;
}

/**
 * The [standard deviation](http://en.wikipedia.org/wiki/Standard_deviation)
 * is the square root of the variance. This is also known as the population
 * standard deviation. It's useful for measuring the amount
 * of variation or dispersion in a set of values.
 *
 * Standard deviation is only appropriate for full-population knowledge: for
 * samples of a population, {@link sampleStandardDeviation} is
 * more appropriate.
 *
 * @param {Array<number>} x input
 * @returns {number} standard deviation
 * @example
 * variance([2, 4, 4, 4, 5, 5, 7, 9]); // => 4
 * standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]); // => 2
 */
function standardDeviation(x) {
    if (x.length === 1) {
        return 0;
    }
    const v = variance(x);
    return Math.sqrt(v);
}

const { min: min$4, max: max$4 } = Math;

var limit = (x, low = 0, high = 1) => {
    return min$4(max$4(low, x), high);
};

var clip_rgb = (rgb) => {
    rgb._clipped = false;
    rgb._unclipped = rgb.slice(0);
    for (let i = 0; i <= 3; i++) {
        if (i < 3) {
            if (rgb[i] < 0 || rgb[i] > 255) rgb._clipped = true;
            rgb[i] = limit(rgb[i], 0, 255);
        } else if (i === 3 && rgb.length > 3) {
            rgb[i] = limit(rgb[i], 0, 1);
        }
    }
    return rgb;
};

// ported from jQuery's $.type
const classToType = {};
for (let name of [
    'Boolean',
    'Number',
    'String',
    'Function',
    'Array',
    'Date',
    'RegExp',
    'Undefined',
    'Null'
]) {
    classToType[`[object ${name}]`] = name.toLowerCase();
}
function type (obj) {
    return classToType[Object.prototype.toString.call(obj)] || 'object';
}

var unpack = (args, keyOrder = null) => {
    // if called with more than 3 arguments, we return the arguments
    if (args.length >= 3) return Array.prototype.slice.call(args);
    // with less than 3 args we check if first arg is object
    // and use the keyOrder string to extract and sort properties
    if (type(args[0]) == 'object' && keyOrder) {
        return keyOrder
            .split('')
            .filter((k) => args[0][k] !== undefined)
            .map((k) => args[0][k]);
    }
    // otherwise we just return the first argument
    // (which we suppose is an array of args)
    return args[0].slice(0);
};

var last = (args) => {
    if (args.length < 2) return null;
    const l = args.length - 1;
    if (type(args[l]) == 'string') return args[l].toLowerCase();
    return null;
};

const { PI: PI$2, min: min$3, max: max$3 } = Math;

const rnd2 = (a) => Math.round(a * 100) / 100;
const rnd3 = (a) => Math.round(a * 100) / 100;

const TWOPI = PI$2 * 2;
const PITHIRD = PI$2 / 3;
const DEG2RAD = PI$2 / 180;
const RAD2DEG = 180 / PI$2;

/**
 * Reverse the first three elements of an array
 *
 * @param {any[]} arr
 * @returns {any[]}
 */
function reverse3(arr) {
    return [...arr.slice(0, 3).reverse(), ...arr.slice(3)];
}

var input = {
    format: {},
    autodetect: []
};

class Color {
    constructor(...args) {
        const me = this;
        if (
            type(args[0]) === 'object' &&
            args[0].constructor &&
            args[0].constructor === this.constructor
        ) {
            // the argument is already a Color instance
            return args[0];
        }
        // last argument could be the mode
        let mode = last(args);
        let autodetect = false;
        if (!mode) {
            autodetect = true;

            if (!input.sorted) {
                input.autodetect = input.autodetect.sort((a, b) => b.p - a.p);
                input.sorted = true;
            }

            // auto-detect format
            for (let chk of input.autodetect) {
                mode = chk.test(...args);
                if (mode) break;
            }
        }
        if (input.format[mode]) {
            const rgb = input.format[mode].apply(
                null,
                autodetect ? args : args.slice(0, -1)
            );
            me._rgb = clip_rgb(rgb);
        } else {
            throw new Error('unknown format: ' + args);
        }
        // add alpha channel
        if (me._rgb.length === 3) me._rgb.push(1);
    }
    toString() {
        if (type(this.hex) == 'function') return this.hex();
        return `[${this._rgb.join(',')}]`;
    }
}

// this gets updated automatically
const version = '3.3.0';

const chroma = (...args) => {
    return new Color(...args);
};

chroma.version = version;

/**
	X11 color names

	http://www.w3.org/TR/css3-color/#svg-color
*/

const w3cx11 = {
    aliceblue: '#f0f8ff',
    antiquewhite: '#faebd7',
    aqua: '#00ffff',
    aquamarine: '#7fffd4',
    azure: '#f0ffff',
    beige: '#f5f5dc',
    bisque: '#ffe4c4',
    black: '#000000',
    blanchedalmond: '#ffebcd',
    blue: '#0000ff',
    blueviolet: '#8a2be2',
    brown: '#a52a2a',
    burlywood: '#deb887',
    cadetblue: '#5f9ea0',
    chartreuse: '#7fff00',
    chocolate: '#d2691e',
    coral: '#ff7f50',
    cornflowerblue: '#6495ed',
    cornsilk: '#fff8dc',
    crimson: '#dc143c',
    cyan: '#00ffff',
    darkblue: '#00008b',
    darkcyan: '#008b8b',
    darkgoldenrod: '#b8860b',
    darkgray: '#a9a9a9',
    darkgreen: '#006400',
    darkgrey: '#a9a9a9',
    darkkhaki: '#bdb76b',
    darkmagenta: '#8b008b',
    darkolivegreen: '#556b2f',
    darkorange: '#ff8c00',
    darkorchid: '#9932cc',
    darkred: '#8b0000',
    darksalmon: '#e9967a',
    darkseagreen: '#8fbc8f',
    darkslateblue: '#483d8b',
    darkslategray: '#2f4f4f',
    darkslategrey: '#2f4f4f',
    darkturquoise: '#00ced1',
    darkviolet: '#9400d3',
    deeppink: '#ff1493',
    deepskyblue: '#00bfff',
    dimgray: '#696969',
    dimgrey: '#696969',
    dodgerblue: '#1e90ff',
    firebrick: '#b22222',
    floralwhite: '#fffaf0',
    forestgreen: '#228b22',
    fuchsia: '#ff00ff',
    gainsboro: '#dcdcdc',
    ghostwhite: '#f8f8ff',
    gold: '#ffd700',
    goldenrod: '#daa520',
    gray: '#808080',
    green: '#008000',
    greenyellow: '#adff2f',
    grey: '#808080',
    honeydew: '#f0fff0',
    hotpink: '#ff69b4',
    indianred: '#cd5c5c',
    indigo: '#4b0082',
    ivory: '#fffff0',
    khaki: '#f0e68c',
    laserlemon: '#ffff54',
    lavender: '#e6e6fa',
    lavenderblush: '#fff0f5',
    lawngreen: '#7cfc00',
    lemonchiffon: '#fffacd',
    lightblue: '#add8e6',
    lightcoral: '#f08080',
    lightcyan: '#e0ffff',
    lightgoldenrod: '#fafad2',
    lightgoldenrodyellow: '#fafad2',
    lightgray: '#d3d3d3',
    lightgreen: '#90ee90',
    lightgrey: '#d3d3d3',
    lightpink: '#ffb6c1',
    lightsalmon: '#ffa07a',
    lightseagreen: '#20b2aa',
    lightskyblue: '#87cefa',
    lightslategray: '#778899',
    lightslategrey: '#778899',
    lightsteelblue: '#b0c4de',
    lightyellow: '#ffffe0',
    lime: '#00ff00',
    limegreen: '#32cd32',
    linen: '#faf0e6',
    magenta: '#ff00ff',
    maroon: '#800000',
    maroon2: '#7f0000',
    maroon3: '#b03060',
    mediumaquamarine: '#66cdaa',
    mediumblue: '#0000cd',
    mediumorchid: '#ba55d3',
    mediumpurple: '#9370db',
    mediumseagreen: '#3cb371',
    mediumslateblue: '#7b68ee',
    mediumspringgreen: '#00fa9a',
    mediumturquoise: '#48d1cc',
    mediumvioletred: '#c71585',
    midnightblue: '#191970',
    mintcream: '#f5fffa',
    mistyrose: '#ffe4e1',
    moccasin: '#ffe4b5',
    navajowhite: '#ffdead',
    navy: '#000080',
    oldlace: '#fdf5e6',
    olive: '#808000',
    olivedrab: '#6b8e23',
    orange: '#ffa500',
    orangered: '#ff4500',
    orchid: '#da70d6',
    palegoldenrod: '#eee8aa',
    palegreen: '#98fb98',
    paleturquoise: '#afeeee',
    palevioletred: '#db7093',
    papayawhip: '#ffefd5',
    peachpuff: '#ffdab9',
    peru: '#cd853f',
    pink: '#ffc0cb',
    plum: '#dda0dd',
    powderblue: '#b0e0e6',
    purple: '#800080',
    purple2: '#7f007f',
    purple3: '#a020f0',
    rebeccapurple: '#663399',
    red: '#ff0000',
    rosybrown: '#bc8f8f',
    royalblue: '#4169e1',
    saddlebrown: '#8b4513',
    salmon: '#fa8072',
    sandybrown: '#f4a460',
    seagreen: '#2e8b57',
    seashell: '#fff5ee',
    sienna: '#a0522d',
    silver: '#c0c0c0',
    skyblue: '#87ceeb',
    slateblue: '#6a5acd',
    slategray: '#708090',
    slategrey: '#708090',
    snow: '#fffafa',
    springgreen: '#00ff7f',
    steelblue: '#4682b4',
    tan: '#d2b48c',
    teal: '#008080',
    thistle: '#d8bfd8',
    tomato: '#ff6347',
    turquoise: '#40e0d0',
    violet: '#ee82ee',
    wheat: '#f5deb3',
    white: '#ffffff',
    whitesmoke: '#f5f5f5',
    yellow: '#ffff00',
    yellowgreen: '#9acd32'
};

const RE_HEX = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const RE_HEXA = /^#?([A-Fa-f0-9]{8}|[A-Fa-f0-9]{4})$/;

const hex2rgb = (hex) => {
    if (hex.match(RE_HEX)) {
        // remove optional leading #
        if (hex.length === 4 || hex.length === 7) {
            hex = hex.substr(1);
        }
        // expand short-notation to full six-digit
        if (hex.length === 3) {
            hex = hex.split('');
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const u = parseInt(hex, 16);
        const r = u >> 16;
        const g = (u >> 8) & 0xff;
        const b = u & 0xff;
        return [r, g, b, 1];
    }

    // match rgba hex format, eg #FF000077
    if (hex.match(RE_HEXA)) {
        if (hex.length === 5 || hex.length === 9) {
            // remove optional leading #
            hex = hex.substr(1);
        }
        // expand short-notation to full eight-digit
        if (hex.length === 4) {
            hex = hex.split('');
            hex =
                hex[0] +
                hex[0] +
                hex[1] +
                hex[1] +
                hex[2] +
                hex[2] +
                hex[3] +
                hex[3];
        }
        const u = parseInt(hex, 16);
        const r = (u >> 24) & 0xff;
        const g = (u >> 16) & 0xff;
        const b = (u >> 8) & 0xff;
        const a = (u & 0xff) / 0xff;
        return [r, g, b, a];
    }

    // we used to check for css colors here
    // if _input.css? and rgb = _input.css hex
    //     return rgb

    throw new Error(`unknown hex color: ${hex}`);
};

const { round: round$5 } = Math;

const rgb2hex = (...args) => {
    let [r, g, b, a] = unpack(args, 'rgba');
    let mode = last(args) || 'auto';
    if (a === undefined) a = 1;
    if (mode === 'auto') {
        mode = a < 1 ? 'rgba' : 'rgb';
    }
    r = round$5(r);
    g = round$5(g);
    b = round$5(b);
    const u = (r << 16) | (g << 8) | b;
    let str = '000000' + u.toString(16); //#.toUpperCase();
    str = str.substr(str.length - 6);
    let hxa = '0' + round$5(a * 255).toString(16);
    hxa = hxa.substr(hxa.length - 2);
    switch (mode.toLowerCase()) {
        case 'rgba':
            return `#${str}${hxa}`;
        case 'argb':
            return `#${hxa}${str}`;
        default:
            return `#${str}`;
    }
};

Color.prototype.name = function () {
    const hex = rgb2hex(this._rgb, 'rgb');
    for (let n of Object.keys(w3cx11)) {
        if (w3cx11[n] === hex) return n.toLowerCase();
    }
    return hex;
};

input.format.named = (name) => {
    name = name.toLowerCase();
    if (w3cx11[name]) return hex2rgb(w3cx11[name]);
    throw new Error('unknown color name: ' + name);
};

input.autodetect.push({
    p: 5,
    test: (h, ...rest) => {
        if (!rest.length && type(h) === 'string' && w3cx11[h.toLowerCase()]) {
            return 'named';
        }
    }
});

Color.prototype.alpha = function (a, mutate = false) {
    if (a !== undefined && type(a) === 'number') {
        if (mutate) {
            this._rgb[3] = a;
            return this;
        }
        return new Color([this._rgb[0], this._rgb[1], this._rgb[2], a], 'rgb');
    }
    return this._rgb[3];
};

Color.prototype.clipped = function () {
    return this._rgb._clipped || false;
};

const labConstants = {
    // Corresponds roughly to RGB brighter/darker
    Kn: 18,

    // D65 standard referent
    labWhitePoint: 'd65',
    Xn: 0.95047,
    Yn: 1,
    Zn: 1.08883,

    kE: 216.0 / 24389.0,
    kKE: 8.0,
    kK: 24389.0 / 27.0,

    RefWhiteRGB: {
        // sRGB
        X: 0.95047,
        Y: 1,
        Z: 1.08883
    },

    MtxRGB2XYZ: {
        m00: 0.4124564390896922,
        m01: 0.21267285140562253,
        m02: 0.0193338955823293,
        m10: 0.357576077643909,
        m11: 0.715152155287818,
        m12: 0.11919202588130297,
        m20: 0.18043748326639894,
        m21: 0.07217499330655958,
        m22: 0.9503040785363679
    },

    MtxXYZ2RGB: {
        m00: 3.2404541621141045,
        m01: -0.9692660305051868,
        m02: 0.055643430959114726,
        m10: -1.5371385127977166,
        m11: 1.8760108454466942,
        m12: -0.2040259135167538,
        m20: -0.498531409556016,
        m21: 0.041556017530349834,
        m22: 1.0572251882231791
    },

    // used in rgb2xyz
    As: 0.9414285350000001,
    Bs: 1.040417467,
    Cs: 1.089532651,

    MtxAdaptMa: {
        m00: 0.8951,
        m01: -0.7502,
        m02: 0.0389,
        m10: 0.2664,
        m11: 1.7135,
        m12: -0.0685,
        m20: -0.1614,
        m21: 0.0367,
        m22: 1.0296
    },

    MtxAdaptMaI: {
        m00: 0.9869929054667123,
        m01: 0.43230526972339456,
        m02: -0.008528664575177328,
        m10: -0.14705425642099013,
        m11: 0.5183602715367776,
        m12: 0.04004282165408487,
        m20: 0.15996265166373125,
        m21: 0.0492912282128556,
        m22: 0.9684866957875502
    }
};

// taken from https://de.mathworks.com/help/images/ref/whitepoint.html
const ILLUMINANTS = new Map([
    // ASTM E308-01
    ['a', [1.0985, 0.35585]],
    // Wyszecki & Stiles, p. 769
    ['b', [1.0985, 0.35585]],
    // C ASTM E308-01
    ['c', [0.98074, 1.18232]],
    // D50 (ASTM E308-01)
    ['d50', [0.96422, 0.82521]],
    // D55 (ASTM E308-01)
    ['d55', [0.95682, 0.92149]],
    // D65 (ASTM E308-01)
    ['d65', [0.95047, 1.08883]],
    // E (ASTM E308-01)
    ['e', [1, 1, 1]],
    // F2 (ASTM E308-01)
    ['f2', [0.99186, 0.67393]],
    // F7 (ASTM E308-01)
    ['f7', [0.95041, 1.08747]],
    // F11 (ASTM E308-01)
    ['f11', [1.00962, 0.6435]],
    ['icc', [0.96422, 0.82521]]
]);

function setLabWhitePoint(name) {
    const ill = ILLUMINANTS.get(String(name).toLowerCase());
    if (!ill) {
        throw new Error('unknown Lab illuminant ' + name);
    }
    labConstants.labWhitePoint = name;
    labConstants.Xn = ill[0];
    labConstants.Zn = ill[1];
}

function getLabWhitePoint() {
    return labConstants.labWhitePoint;
}

/*
 * L* [0..100]
 * a [-100..100]
 * b [-100..100]
 */
const lab2rgb = (...args) => {
    args = unpack(args, 'lab');
    const [L, a, b] = args;
    const [x, y, z] = lab2xyz(L, a, b);
    const [r, g, b_] = xyz2rgb(x, y, z);
    return [r, g, b_, args.length > 3 ? args[3] : 1];
};

const lab2xyz = (L, a, b) => {
    const { kE, kK, kKE, Xn, Yn, Zn } = labConstants;

    const fy = (L + 16.0) / 116.0;
    const fx = 0.002 * a + fy;
    const fz = fy - 0.005 * b;

    const fx3 = fx * fx * fx;
    const fz3 = fz * fz * fz;

    const xr = fx3 > kE ? fx3 : (116.0 * fx - 16.0) / kK;
    const yr = L > kKE ? Math.pow((L + 16.0) / 116.0, 3.0) : L / kK;
    const zr = fz3 > kE ? fz3 : (116.0 * fz - 16.0) / kK;

    const x = xr * Xn;
    const y = yr * Yn;
    const z = zr * Zn;

    return [x, y, z];
};

const compand = (linear) => {
    /* sRGB */
    const sign = Math.sign(linear);
    linear = Math.abs(linear);
    return (
        (linear <= 0.0031308
            ? linear * 12.92
            : 1.055 * Math.pow(linear, 1.0 / 2.4) - 0.055) * sign
    );
};

const xyz2rgb = (x, y, z) => {
    const { MtxAdaptMa, MtxAdaptMaI, MtxXYZ2RGB, RefWhiteRGB, Xn, Yn, Zn } =
        labConstants;

    const As = Xn * MtxAdaptMa.m00 + Yn * MtxAdaptMa.m10 + Zn * MtxAdaptMa.m20;
    const Bs = Xn * MtxAdaptMa.m01 + Yn * MtxAdaptMa.m11 + Zn * MtxAdaptMa.m21;
    const Cs = Xn * MtxAdaptMa.m02 + Yn * MtxAdaptMa.m12 + Zn * MtxAdaptMa.m22;

    const Ad =
        RefWhiteRGB.X * MtxAdaptMa.m00 +
        RefWhiteRGB.Y * MtxAdaptMa.m10 +
        RefWhiteRGB.Z * MtxAdaptMa.m20;
    const Bd =
        RefWhiteRGB.X * MtxAdaptMa.m01 +
        RefWhiteRGB.Y * MtxAdaptMa.m11 +
        RefWhiteRGB.Z * MtxAdaptMa.m21;
    const Cd =
        RefWhiteRGB.X * MtxAdaptMa.m02 +
        RefWhiteRGB.Y * MtxAdaptMa.m12 +
        RefWhiteRGB.Z * MtxAdaptMa.m22;

    const X1 =
        (x * MtxAdaptMa.m00 + y * MtxAdaptMa.m10 + z * MtxAdaptMa.m20) *
        (Ad / As);
    const Y1 =
        (x * MtxAdaptMa.m01 + y * MtxAdaptMa.m11 + z * MtxAdaptMa.m21) *
        (Bd / Bs);
    const Z1 =
        (x * MtxAdaptMa.m02 + y * MtxAdaptMa.m12 + z * MtxAdaptMa.m22) *
        (Cd / Cs);

    const X2 =
        X1 * MtxAdaptMaI.m00 + Y1 * MtxAdaptMaI.m10 + Z1 * MtxAdaptMaI.m20;
    const Y2 =
        X1 * MtxAdaptMaI.m01 + Y1 * MtxAdaptMaI.m11 + Z1 * MtxAdaptMaI.m21;
    const Z2 =
        X1 * MtxAdaptMaI.m02 + Y1 * MtxAdaptMaI.m12 + Z1 * MtxAdaptMaI.m22;

    const r = compand(
        X2 * MtxXYZ2RGB.m00 + Y2 * MtxXYZ2RGB.m10 + Z2 * MtxXYZ2RGB.m20
    );
    const g = compand(
        X2 * MtxXYZ2RGB.m01 + Y2 * MtxXYZ2RGB.m11 + Z2 * MtxXYZ2RGB.m21
    );
    const b = compand(
        X2 * MtxXYZ2RGB.m02 + Y2 * MtxXYZ2RGB.m12 + Z2 * MtxXYZ2RGB.m22
    );

    return [r * 255, g * 255, b * 255];
};

const rgb2lab = (...args) => {
    const [r, g, b, ...rest] = unpack(args, 'rgb');
    const [x, y, z] = rgb2xyz(r, g, b);
    const [L, a, b_] = xyz2lab(x, y, z);
    return [L, a, b_, ...(rest.length > 0 && rest[0] < 1 ? [rest[0]] : [])];
};

function xyz2lab(x, y, z) {
    const { Xn, Yn, Zn, kE, kK } = labConstants;
    const xr = x / Xn;
    const yr = y / Yn;
    const zr = z / Zn;

    const fx = xr > kE ? Math.pow(xr, 1.0 / 3.0) : (kK * xr + 16.0) / 116.0;
    const fy = yr > kE ? Math.pow(yr, 1.0 / 3.0) : (kK * yr + 16.0) / 116.0;
    const fz = zr > kE ? Math.pow(zr, 1.0 / 3.0) : (kK * zr + 16.0) / 116.0;

    return [116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz)];
}

function gammaAdjustSRGB(companded) {
    const sign = Math.sign(companded);
    companded = Math.abs(companded);
    const linear =
        companded <= 0.04045
            ? companded / 12.92
            : Math.pow((companded + 0.055) / 1.055, 2.4);
    return linear * sign;
}

const rgb2xyz = (r, g, b) => {
    // normalize and gamma adjust
    r = gammaAdjustSRGB(r / 255);
    g = gammaAdjustSRGB(g / 255);
    b = gammaAdjustSRGB(b / 255);

    const { MtxRGB2XYZ, MtxAdaptMa, MtxAdaptMaI, Xn, Yn, Zn, As, Bs, Cs } =
        labConstants;

    let x = r * MtxRGB2XYZ.m00 + g * MtxRGB2XYZ.m10 + b * MtxRGB2XYZ.m20;
    let y = r * MtxRGB2XYZ.m01 + g * MtxRGB2XYZ.m11 + b * MtxRGB2XYZ.m21;
    let z = r * MtxRGB2XYZ.m02 + g * MtxRGB2XYZ.m12 + b * MtxRGB2XYZ.m22;

    const Ad = Xn * MtxAdaptMa.m00 + Yn * MtxAdaptMa.m10 + Zn * MtxAdaptMa.m20;
    const Bd = Xn * MtxAdaptMa.m01 + Yn * MtxAdaptMa.m11 + Zn * MtxAdaptMa.m21;
    const Cd = Xn * MtxAdaptMa.m02 + Yn * MtxAdaptMa.m12 + Zn * MtxAdaptMa.m22;

    let X = x * MtxAdaptMa.m00 + y * MtxAdaptMa.m10 + z * MtxAdaptMa.m20;
    let Y = x * MtxAdaptMa.m01 + y * MtxAdaptMa.m11 + z * MtxAdaptMa.m21;
    let Z = x * MtxAdaptMa.m02 + y * MtxAdaptMa.m12 + z * MtxAdaptMa.m22;

    X *= Ad / As;
    Y *= Bd / Bs;
    Z *= Cd / Cs;

    x = X * MtxAdaptMaI.m00 + Y * MtxAdaptMaI.m10 + Z * MtxAdaptMaI.m20;
    y = X * MtxAdaptMaI.m01 + Y * MtxAdaptMaI.m11 + Z * MtxAdaptMaI.m21;
    z = X * MtxAdaptMaI.m02 + Y * MtxAdaptMaI.m12 + Z * MtxAdaptMaI.m22;

    return [x, y, z];
};

Color.prototype.lab = function () {
    return rgb2lab(this._rgb);
};

const lab$1 = (...args) => new Color(...args, 'lab');
Object.assign(chroma, { lab: lab$1, getLabWhitePoint, setLabWhitePoint });

input.format.lab = lab2rgb;

input.autodetect.push({
    p: 2,
    test: (...args) => {
        args = unpack(args, 'lab');
        if (type(args) === 'array' && args.length === 3) {
            return 'lab';
        }
    }
});

Color.prototype.darken = function (amount = 1) {
    const me = this;
    const lab = me.lab();
    lab[0] -= labConstants.Kn * amount;
    return new Color(lab, 'lab').alpha(me.alpha(), true);
};

Color.prototype.brighten = function (amount = 1) {
    return this.darken(-amount);
};

Color.prototype.darker = Color.prototype.darken;
Color.prototype.brighter = Color.prototype.brighten;

Color.prototype.get = function (mc) {
    const [mode, channel] = mc.split('.');
    const src = this[mode]();
    if (channel) {
        const i = mode.indexOf(channel) - (mode.substr(0, 2) === 'ok' ? 2 : 0);
        if (i > -1) return src[i];
        throw new Error(`unknown channel ${channel} in mode ${mode}`);
    } else {
        return src;
    }
};

const { pow: pow$6 } = Math;

const EPS = 1e-7;
const MAX_ITER = 20;

Color.prototype.luminance = function (lum, mode = 'rgb') {
    if (lum !== undefined && type(lum) === 'number') {
        if (lum === 0) {
            // return pure black
            return new Color([0, 0, 0, this._rgb[3]], 'rgb');
        }
        if (lum === 1) {
            // return pure white
            return new Color([255, 255, 255, this._rgb[3]], 'rgb');
        }
        // compute new color using...
        let cur_lum = this.luminance();
        let max_iter = MAX_ITER;

        const test = (low, high) => {
            const mid = low.interpolate(high, 0.5, mode);
            const lm = mid.luminance();
            if (Math.abs(lum - lm) < EPS || !max_iter--) {
                // close enough
                return mid;
            }
            return lm > lum ? test(low, mid) : test(mid, high);
        };

        const rgb = (
            cur_lum > lum
                ? test(new Color([0, 0, 0]), this)
                : test(this, new Color([255, 255, 255]))
        ).rgb();
        return new Color([...rgb, this._rgb[3]]);
    }
    return rgb2luminance(...this._rgb.slice(0, 3));
};

const rgb2luminance = (r, g, b) => {
    // relative luminance
    // see http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
    r = luminance_x(r);
    g = luminance_x(g);
    b = luminance_x(b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const luminance_x = (x) => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : pow$6((x + 0.055) / 1.055, 2.4);
};

var index = {};

var mix = (col1, col2, f = 0.5, ...rest) => {
    let mode = rest[0] || 'lrgb';
    if (!index[mode] && !rest.length) {
        // fall back to the first supported mode
        mode = Object.keys(index)[0];
    }
    if (!index[mode]) {
        throw new Error(`interpolation mode ${mode} is not defined`);
    }
    if (type(col1) !== 'object') col1 = new Color(col1);
    if (type(col2) !== 'object') col2 = new Color(col2);
    return index[mode](col1, col2, f).alpha(
        col1.alpha() + f * (col2.alpha() - col1.alpha())
    );
};

Color.prototype.mix = Color.prototype.interpolate = function (
    col2,
    f = 0.5,
    ...rest
) {
    return mix(this, col2, f, ...rest);
};

Color.prototype.premultiply = function (mutate = false) {
    const rgb = this._rgb;
    const a = rgb[3];
    if (mutate) {
        this._rgb = [rgb[0] * a, rgb[1] * a, rgb[2] * a, a];
        return this;
    } else {
        return new Color([rgb[0] * a, rgb[1] * a, rgb[2] * a, a], 'rgb');
    }
};

const { sin: sin$3, cos: cos$4 } = Math;

const lch2lab = (...args) => {
    /*
    Convert from a qualitative parameter h and a quantitative parameter l to a 24-bit pixel.
    These formulas were invented by David Dalrymple to obtain maximum contrast without going
    out of gamut if the parameters are in the range 0-1.

    A saturation multiplier was added by Gregor Aisch
    */
    let [l, c, h] = unpack(args, 'lch');
    if (isNaN(h)) h = 0;
    h = h * DEG2RAD;
    return [l, cos$4(h) * c, sin$3(h) * c];
};

const lch2rgb = (...args) => {
    args = unpack(args, 'lch');
    const [l, c, h] = args;
    const [L, a, b_] = lch2lab(l, c, h);
    const [r, g, b] = lab2rgb(L, a, b_);
    return [r, g, b, args.length > 3 ? args[3] : 1];
};

const hcl2rgb = (...args) => {
    const hcl = reverse3(unpack(args, 'hcl'));
    return lch2rgb(...hcl);
};

const { sqrt: sqrt$4, atan2: atan2$2, round: round$4 } = Math;

const lab2lch = (...args) => {
    const [l, a, b] = unpack(args, 'lab');
    const c = sqrt$4(a * a + b * b);
    let h = (atan2$2(b, a) * RAD2DEG + 360) % 360;
    if (round$4(c * 10000) === 0) h = Number.NaN;
    return [l, c, h];
};

const rgb2lch = (...args) => {
    const [r, g, b, ...rest] = unpack(args, 'rgb');
    const [l, a, b_] = rgb2lab(r, g, b);
    const [L, c, h] = lab2lch(l, a, b_);
    return [L, c, h, ...(rest.length > 0 && rest[0] < 1 ? [rest[0]] : [])];
};

Color.prototype.lch = function () {
    return rgb2lch(this._rgb);
};
Color.prototype.hcl = function () {
    return reverse3(rgb2lch(this._rgb));
};

const lch$1 = (...args) => new Color(...args, 'lch');
const hcl = (...args) => new Color(...args, 'hcl');

Object.assign(chroma, { lch: lch$1, hcl });

input.format.lch = lch2rgb;
input.format.hcl = hcl2rgb;
['lch', 'hcl'].forEach((m) =>
    input.autodetect.push({
        p: 2,
        test: (...args) => {
            args = unpack(args, m);
            if (type(args) === 'array' && args.length === 3) {
                return m;
            }
        }
    })
);

Color.prototype.saturate = function (amount = 1) {
    const me = this;
    const lch = me.lch();
    lch[1] += labConstants.Kn * amount;
    if (lch[1] < 0) lch[1] = 0;
    return new Color(lch, 'lch').alpha(me.alpha(), true);
};

Color.prototype.desaturate = function (amount = 1) {
    return this.saturate(-amount);
};

Color.prototype.set = function (mc, value, mutate = false) {
    const [mode, channel] = mc.split('.');
    const src = this[mode]();
    if (channel) {
        const i = mode.indexOf(channel) - (mode.substr(0, 2) === 'ok' ? 2 : 0);
        if (i > -1) {
            if (type(value) == 'string') {
                switch (value.charAt(0)) {
                    case '+':
                        src[i] += +value;
                        break;
                    case '-':
                        src[i] += +value;
                        break;
                    case '*':
                        src[i] *= +value.substr(1);
                        break;
                    case '/':
                        src[i] /= +value.substr(1);
                        break;
                    default:
                        src[i] = +value;
                }
            } else if (type(value) === 'number') {
                src[i] = value;
            } else {
                throw new Error(`unsupported value for Color.set`);
            }
            const out = new Color(src, mode).alpha(this.alpha(), true);
            if (mutate) {
                this._rgb = out._rgb;
                return this;
            }
            return out;
        }
        throw new Error(`unknown channel ${channel} in mode ${mode}`);
    } else {
        return src;
    }
};

Color.prototype.tint = function (f = 0.5, ...rest) {
    return mix(this, 'white', f, ...rest);
};

Color.prototype.shade = function (f = 0.5, ...rest) {
    return mix(this, 'black', f, ...rest);
};

const rgb$1 = (col1, col2, f) => {
    const xyz0 = col1._rgb;
    const xyz1 = col2._rgb;
    return new Color(
        xyz0[0] + f * (xyz1[0] - xyz0[0]),
        xyz0[1] + f * (xyz1[1] - xyz0[1]),
        xyz0[2] + f * (xyz1[2] - xyz0[2]),
        'rgb'
    );
};

// register interpolator
index.rgb = rgb$1;

const { sqrt: sqrt$3, pow: pow$5 } = Math;

const lrgb = (col1, col2, f) => {
    const [x1, y1, z1] = col1._rgb;
    const [x2, y2, z2] = col2._rgb;
    return new Color(
        sqrt$3(pow$5(x1, 2) * (1 - f) + pow$5(x2, 2) * f),
        sqrt$3(pow$5(y1, 2) * (1 - f) + pow$5(y2, 2) * f),
        sqrt$3(pow$5(z1, 2) * (1 - f) + pow$5(z2, 2) * f),
        'rgb'
    );
};

// register interpolator
index.lrgb = lrgb;

const lab = (col1, col2, f) => {
    const xyz0 = col1.lab();
    const xyz1 = col2.lab();
    return new Color(
        xyz0[0] + f * (xyz1[0] - xyz0[0]),
        xyz0[1] + f * (xyz1[1] - xyz0[1]),
        xyz0[2] + f * (xyz1[2] - xyz0[2]),
        'lab'
    );
};

// register interpolator
index.lab = lab;

var interpolate_hsx = (col1, col2, f, m) => {
    let xyz0, xyz1;
    if (m === 'hsl') {
        xyz0 = col1.hsl();
        xyz1 = col2.hsl();
    } else if (m === 'hsv') {
        xyz0 = col1.hsv();
        xyz1 = col2.hsv();
    } else if (m === 'hcg') {
        xyz0 = col1.hcg();
        xyz1 = col2.hcg();
    } else if (m === 'hsi') {
        xyz0 = col1.hsi();
        xyz1 = col2.hsi();
    } else if (m === 'lch' || m === 'hcl') {
        m = 'hcl';
        xyz0 = col1.hcl();
        xyz1 = col2.hcl();
    } else if (m === 'oklch') {
        xyz0 = col1.oklch().reverse();
        xyz1 = col2.oklch().reverse();
    }

    let hue0, hue1, sat0, sat1, lbv0, lbv1;
    if (m.substr(0, 1) === 'h' || m === 'oklch') {
        [hue0, sat0, lbv0] = xyz0;
        [hue1, sat1, lbv1] = xyz1;
    }

    let sat, hue, lbv, dh;

    if (!isNaN(hue0) && !isNaN(hue1)) {
        // both colors have hue
        if (hue1 > hue0 && hue1 - hue0 > 180) {
            dh = hue1 - (hue0 + 360);
        } else if (hue1 < hue0 && hue0 - hue1 > 180) {
            dh = hue1 + 360 - hue0;
        } else {
            dh = hue1 - hue0;
        }
        hue = hue0 + f * dh;
    } else if (!isNaN(hue0)) {
        hue = hue0;
        // Freezing saturation at sat0 keeps colors looking vivid while
        // shading/tinting toward an achromatic endpoint (e.g. shade(0.5)).
        // But once f fully reaches that endpoint (f === 1), the result must
        // equal it exactly, so the freeze has to stop there and fall through
        // to the normal interpolation, which resolves to sat1 (see #310).
        if (f < 1 && (lbv1 == 1 || lbv1 == 0) && m != 'hsv') sat = sat0;
    } else if (!isNaN(hue1)) {
        hue = hue1;
        if (f > 0 && (lbv0 == 1 || lbv0 == 0) && m != 'hsv') sat = sat1;
    } else {
        hue = Number.NaN;
    }

    if (sat === undefined) sat = sat0 + f * (sat1 - sat0);
    lbv = lbv0 + f * (lbv1 - lbv0);
    return m === 'oklch'
        ? new Color([lbv, sat, hue], m)
        : new Color([hue, sat, lbv], m);
};

const lch = (col1, col2, f) => {
    return interpolate_hsx(col1, col2, f, 'lch');
};

// register interpolator
index.lch = lch;
index.hcl = lch;

const num2rgb = (num) => {
    if (type(num) == 'number' && num >= 0 && num <= 0xffffff) {
        const r = num >> 16;
        const g = (num >> 8) & 0xff;
        const b = num & 0xff;
        return [r, g, b, 1];
    }
    throw new Error('unknown num color: ' + num);
};

const rgb2num = (...args) => {
    const [r, g, b] = unpack(args, 'rgb');
    return (r << 16) + (g << 8) + b;
};

Color.prototype.num = function () {
    return rgb2num(this._rgb);
};

const num$1 = (...args) => new Color(...args, 'num');

Object.assign(chroma, { num: num$1 });

input.format.num = num2rgb;

input.autodetect.push({
    p: 5,
    test: (...args) => {
        if (
            args.length === 1 &&
            type(args[0]) === 'number' &&
            args[0] >= 0 &&
            args[0] <= 0xffffff
        ) {
            return 'num';
        }
    }
});

const num = (col1, col2, f) => {
    const c1 = col1.num();
    const c2 = col2.num();
    return new Color(c1 + f * (c2 - c1), 'num');
};

// register interpolator
index.num = num;

const { floor: floor$3 } = Math;

/*
 * this is basically just HSV with some minor tweaks
 *
 * hue.. [0..360]
 * chroma .. [0..1]
 * grayness .. [0..1]
 */

const hcg2rgb = (...args) => {
    args = unpack(args, 'hcg');
    let [h, c, _g] = args;
    let r, g, b;
    _g = _g * 255;
    const _c = c * 255;
    if (c === 0) {
        r = g = b = _g;
    } else {
        if (h === 360) h = 0;
        if (h > 360) h -= 360;
        if (h < 0) h += 360;
        h /= 60;
        const i = floor$3(h);
        const f = h - i;
        const p = _g * (1 - c);
        const q = p + _c * (1 - f);
        const t = p + _c * f;
        const v = p + _c;
        switch (i) {
            case 0:
                [r, g, b] = [v, t, p];
                break;
            case 1:
                [r, g, b] = [q, v, p];
                break;
            case 2:
                [r, g, b] = [p, v, t];
                break;
            case 3:
                [r, g, b] = [p, q, v];
                break;
            case 4:
                [r, g, b] = [t, p, v];
                break;
            case 5:
                [r, g, b] = [v, p, q];
                break;
        }
    }
    return [r, g, b, args.length > 3 ? args[3] : 1];
};

const rgb2hcg = (...args) => {
    const [r, g, b] = unpack(args, 'rgb').map((x) => x / 255);
    const minRgb = min$3(r, g, b);
    const maxRgb = max$3(r, g, b);
    const delta = maxRgb - minRgb;
    const c = delta;
    const _g = delta < 1 ? minRgb / (1 - delta) : 0;
    let h;
    if (delta === 0) {
        h = Number.NaN;
    } else {
        if (r === maxRgb) h = (g - b) / delta;
        if (g === maxRgb) h = 2 + (b - r) / delta;
        if (b === maxRgb) h = 4 + (r - g) / delta;
        h *= 60;
        if (h < 0) h += 360;
    }
    return [h, c, _g];
};

Color.prototype.hcg = function () {
    return rgb2hcg(this._rgb);
};

const hcg$1 = (...args) => new Color(...args, 'hcg');
chroma.hcg = hcg$1;

input.format.hcg = hcg2rgb;

input.autodetect.push({
    p: 1,
    test: (...args) => {
        args = unpack(args, 'hcg');
        if (type(args) === 'array' && args.length === 3) {
            return 'hcg';
        }
    }
});

const hcg = (col1, col2, f) => {
    return interpolate_hsx(col1, col2, f, 'hcg');
};

// register interpolator
index.hcg = hcg;

const { cos: cos$3 } = Math;

/*
 * hue [0..360]
 * saturation [0..1]
 * intensity [0..1]
 */
const hsi2rgb = (...args) => {
    /*
    borrowed from here:
    http://hummer.stanford.edu/museinfo/doc/examples/humdrum/keyscape2/hsi2rgb.cpp
    */
    args = unpack(args, 'hsi');
    let [h, s, i] = args;
    let r, g, b;

    if (isNaN(h)) h = 0;
    if (isNaN(s)) s = 0;
    // normalize hue
    if (h > 360) h -= 360;
    if (h < 0) h += 360;
    h /= 360;
    if (h < 1 / 3) {
        b = (1 - s) / 3;
        r = (1 + (s * cos$3(TWOPI * h)) / cos$3(PITHIRD - TWOPI * h)) / 3;
        g = 1 - (b + r);
    } else if (h < 2 / 3) {
        h -= 1 / 3;
        r = (1 - s) / 3;
        g = (1 + (s * cos$3(TWOPI * h)) / cos$3(PITHIRD - TWOPI * h)) / 3;
        b = 1 - (r + g);
    } else {
        h -= 2 / 3;
        g = (1 - s) / 3;
        b = (1 + (s * cos$3(TWOPI * h)) / cos$3(PITHIRD - TWOPI * h)) / 3;
        r = 1 - (g + b);
    }
    r = limit(i * r * 3);
    g = limit(i * g * 3);
    b = limit(i * b * 3);
    return [r * 255, g * 255, b * 255, args.length > 3 ? args[3] : 1];
};

const { min: min$2, sqrt: sqrt$2, acos } = Math;

const rgb2hsi = (...args) => {
    /*
    borrowed from here:
    http://hummer.stanford.edu/museinfo/doc/examples/humdrum/keyscape2/rgb2hsi.cpp
    */
    let [r, g, b] = unpack(args, 'rgb');
    r /= 255;
    g /= 255;
    b /= 255;
    let h;
    const min_ = min$2(r, g, b);
    const i = (r + g + b) / 3;
    const s = i > 0 ? 1 - min_ / i : 0;
    if (s === 0) {
        h = NaN;
    } else {
        h = (r - g + (r - b)) / 2;
        h /= sqrt$2((r - g) * (r - g) + (r - b) * (g - b));
        h = acos(h);
        if (b > g) {
            h = TWOPI - h;
        }
        h /= TWOPI;
    }
    return [h * 360, s, i];
};

Color.prototype.hsi = function () {
    return rgb2hsi(this._rgb);
};

const hsi$1 = (...args) => new Color(...args, 'hsi');
chroma.hsi = hsi$1;

input.format.hsi = hsi2rgb;

input.autodetect.push({
    p: 2,
    test: (...args) => {
        args = unpack(args, 'hsi');
        if (type(args) === 'array' && args.length === 3) {
            return 'hsi';
        }
    }
});

const hsi = (col1, col2, f) => {
    return interpolate_hsx(col1, col2, f, 'hsi');
};

// register interpolator
index.hsi = hsi;

const hsl2rgb = (...args) => {
    args = unpack(args, 'hsla');
    const [h, s, l] = args;
    let r, g, b;
    if (s === 0) {
        r = g = b = l * 255;
    } else {
        const t3 = [0, 0, 0];
        const c = [0, 0, 0];
        const t2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const t1 = 2 * l - t2;
        const h_ = h / 360;
        t3[0] = h_ + 1 / 3;
        t3[1] = h_;
        t3[2] = h_ - 1 / 3;
        for (let i = 0; i < 3; i++) {
            if (t3[i] < 0) t3[i] += 1;
            if (t3[i] > 1) t3[i] -= 1;
            if (6 * t3[i] < 1) c[i] = t1 + (t2 - t1) * 6 * t3[i];
            else if (2 * t3[i] < 1) c[i] = t2;
            else if (3 * t3[i] < 2) c[i] = t1 + (t2 - t1) * (2 / 3 - t3[i]) * 6;
            else c[i] = t1;
        }
        [r, g, b] = [c[0] * 255, c[1] * 255, c[2] * 255];
    }
    if (args.length > 3) {
        // keep alpha channel
        return [r, g, b, args[3]];
    }
    return [r, g, b, 1];
};

/*
 * supported arguments:
 * - rgb2hsl(r,g,b)
 * - rgb2hsl(r,g,b,a)
 * - rgb2hsl([r,g,b])
 * - rgb2hsl([r,g,b,a])
 * - rgb2hsl({r,g,b,a})
 */
const rgb2hsl = (...args) => {
    args = unpack(args, 'rgba');
    let [r, g, b] = args;

    r /= 255;
    g /= 255;
    b /= 255;

    const minRgb = min$3(r, g, b);
    const maxRgb = max$3(r, g, b);

    const l = (maxRgb + minRgb) / 2;
    let s, h;

    if (maxRgb === minRgb) {
        s = 0;
        h = Number.NaN;
    } else {
        s =
            l < 0.5
                ? (maxRgb - minRgb) / (maxRgb + minRgb)
                : (maxRgb - minRgb) / (2 - maxRgb - minRgb);
    }

    if (r == maxRgb) h = (g - b) / (maxRgb - minRgb);
    else if (g == maxRgb) h = 2 + (b - r) / (maxRgb - minRgb);
    else if (b == maxRgb) h = 4 + (r - g) / (maxRgb - minRgb);

    h *= 60;
    if (h < 0) h += 360;
    if (args.length > 3 && args[3] !== undefined) return [h, s, l, args[3]];
    return [h, s, l];
};

Color.prototype.hsl = function () {
    return rgb2hsl(this._rgb);
};

const hsl$1 = (...args) => new Color(...args, 'hsl');
chroma.hsl = hsl$1;

input.format.hsl = hsl2rgb;

input.autodetect.push({
    p: 2,
    test: (...args) => {
        args = unpack(args, 'hsl');
        if (type(args) === 'array' && args.length === 3) {
            return 'hsl';
        }
    }
});

const hsl = (col1, col2, f) => {
    return interpolate_hsx(col1, col2, f, 'hsl');
};

// register interpolator
index.hsl = hsl;

const { floor: floor$2 } = Math;

const hsv2rgb = (...args) => {
    args = unpack(args, 'hsv');
    let [h, s, v] = args;
    let r, g, b;
    v *= 255;
    if (s === 0) {
        r = g = b = v;
    } else {
        if (h === 360) h = 0;
        if (h > 360) h -= 360;
        if (h < 0) h += 360;
        h /= 60;

        const i = floor$2(h);
        const f = h - i;
        const p = v * (1 - s);
        const q = v * (1 - s * f);
        const t = v * (1 - s * (1 - f));

        switch (i) {
            case 0:
                [r, g, b] = [v, t, p];
                break;
            case 1:
                [r, g, b] = [q, v, p];
                break;
            case 2:
                [r, g, b] = [p, v, t];
                break;
            case 3:
                [r, g, b] = [p, q, v];
                break;
            case 4:
                [r, g, b] = [t, p, v];
                break;
            case 5:
                [r, g, b] = [v, p, q];
                break;
        }
    }
    return [r, g, b, args.length > 3 ? args[3] : 1];
};

const { min: min$1, max: max$2 } = Math;

/*
 * supported arguments:
 * - rgb2hsv(r,g,b)
 * - rgb2hsv([r,g,b])
 * - rgb2hsv({r,g,b})
 */
const rgb2hsv = (...args) => {
    args = unpack(args, 'rgb');
    let [r, g, b] = args;
    const min_ = min$1(r, g, b);
    const max_ = max$2(r, g, b);
    const delta = max_ - min_;
    let h, s, v;
    v = max_ / 255.0;
    if (max_ === 0) {
        h = Number.NaN;
        s = 0;
    } else {
        s = delta / max_;
        if (r === max_) h = (g - b) / delta;
        if (g === max_) h = 2 + (b - r) / delta;
        if (b === max_) h = 4 + (r - g) / delta;
        h *= 60;
        if (h < 0) h += 360;
    }
    return [h, s, v];
};

Color.prototype.hsv = function () {
    return rgb2hsv(this._rgb);
};

const hsv$1 = (...args) => new Color(...args, 'hsv');
chroma.hsv = hsv$1;

input.format.hsv = hsv2rgb;

input.autodetect.push({
    p: 2,
    test: (...args) => {
        args = unpack(args, 'hsv');
        if (type(args) === 'array' && args.length === 3) {
            return 'hsv';
        }
    }
});

const hsv = (col1, col2, f) => {
    return interpolate_hsx(col1, col2, f, 'hsv');
};

// register interpolator
index.hsv = hsv;

// from https://www.w3.org/TR/css-color-4/multiply-matrices.js
function multiplyMatrices(A, B) {
    let m = A.length;

    if (!Array.isArray(A[0])) {
        // A is vector, convert to [[a, b, c, ...]]
        A = [A];
    }

    if (!Array.isArray(B[0])) {
        // B is vector, convert to [[a], [b], [c], ...]]
        B = B.map((x) => [x]);
    }

    let p = B[0].length;
    let B_cols = B[0].map((_, i) => B.map((x) => x[i])); // transpose B
    let product = A.map((row) =>
        B_cols.map((col) => {
            if (!Array.isArray(row)) {
                return col.reduce((a, c) => a + c * row, 0);
            }

            return row.reduce((a, c, i) => a + c * (col[i] || 0), 0);
        })
    );

    if (m === 1) {
        product = product[0]; // Avoid [[a, b, c, ...]]
    }

    if (p === 1) {
        return product.map((x) => x[0]); // Avoid [[a], [b], [c], ...]]
    }

    return product;
}

const oklab2rgb = (...args) => {
    args = unpack(args, 'lab');
    const [L, a, b, ...rest] = args;
    const [X, Y, Z] = OKLab_to_XYZ([L, a, b]);
    const [r, g, b_] = xyz2rgb(X, Y, Z);
    return [r, g, b_, ...(rest.length > 0 && rest[0] < 1 ? [rest[0]] : [])];
};

// from https://www.w3.org/TR/css-color-4/#color-conversion-code
function OKLab_to_XYZ(OKLab) {
    // Given OKLab, convert to XYZ relative to D65
    var LMStoXYZ = [
        [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
        [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
        [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816]
    ];
    var OKLabtoLMS = [
        [1.0, 0.3963377773761749, 0.2158037573099136],
        [1.0, -0.1055613458156586, -0.0638541728258133],
        [1.0, -0.0894841775298119, -1.2914855480194092]
    ];

    var LMSnl = multiplyMatrices(OKLabtoLMS, OKLab);
    return multiplyMatrices(
        LMStoXYZ,
        LMSnl.map((c) => c ** 3)
    );
}

const rgb2oklab = (...args) => {
    const [r, g, b, ...rest] = unpack(args, 'rgb');
    const xyz = rgb2xyz(r, g, b);
    const oklab = XYZ_to_OKLab(xyz);
    return [...oklab, ...(rest.length > 0 && rest[0] < 1 ? [rest[0]] : [])];
};

// from https://www.w3.org/TR/css-color-4/#color-conversion-code
function XYZ_to_OKLab(XYZ) {
    // Given XYZ relative to D65, convert to OKLab
    const XYZtoLMS = [
        [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
        [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
        [0.0481771893596242, 0.2642395317527308, 0.6335478284694309]
    ];
    const LMStoOKLab = [
        [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
        [1.9779985324311684, -2.42859224204858, 0.450593709617411],
        [0.0259040424655478, 0.7827717124575296, -0.8086757549230774]
    ];

    const LMS = multiplyMatrices(XYZtoLMS, XYZ);
    // JavaScript Math.cbrt returns a sign-matched cube root
    // beware if porting to other languages
    // especially if tempted to use a general power function
    return multiplyMatrices(
        LMStoOKLab,
        LMS.map((c) => Math.cbrt(c))
    );
    // L in range [0,1]. For use in CSS, multiply by 100 and add a percent
}

Color.prototype.oklab = function () {
    return rgb2oklab(this._rgb);
};

const oklab$1 = (...args) => new Color(...args, 'oklab');
Object.assign(chroma, { oklab: oklab$1 });

input.format.oklab = oklab2rgb;

input.autodetect.push({
    p: 2,
    test: (...args) => {
        args = unpack(args, 'oklab');
        if (type(args) === 'array' && args.length === 3) {
            return 'oklab';
        }
    }
});

const oklab = (col1, col2, f) => {
    const xyz0 = col1.oklab();
    const xyz1 = col2.oklab();
    return new Color(
        xyz0[0] + f * (xyz1[0] - xyz0[0]),
        xyz0[1] + f * (xyz1[1] - xyz0[1]),
        xyz0[2] + f * (xyz1[2] - xyz0[2]),
        'oklab'
    );
};

// register interpolator
index.oklab = oklab;

const oklch$1 = (col1, col2, f) => {
    return interpolate_hsx(col1, col2, f, 'oklch');
};

// register interpolator
index.oklch = oklch$1;

const { pow: pow$4, sqrt: sqrt$1, PI: PI$1, cos: cos$2, sin: sin$2, atan2: atan2$1 } = Math;

var average = (colors, mode = 'lrgb', weights = null) => {
    const l = colors.length;
    if (!weights) weights = Array.from(new Array(l)).map(() => 1);
    // normalize weights
    const k =
        l /
        weights.reduce(function (a, b) {
            return a + b;
        });
    weights.forEach((w, i) => {
        weights[i] *= k;
    });
    // convert colors to Color objects
    colors = colors.map((c) => new Color(c));
    if (mode === 'lrgb') {
        return _average_lrgb(colors, weights);
    }
    const first = colors.shift();
    const xyz = first.get(mode);
    const cnt = [];
    let dx = 0;
    let dy = 0;
    // initial color
    for (let i = 0; i < xyz.length; i++) {
        cnt.push(isNaN(xyz[i]) ? 0 : weights[0]);
        if (mode.charAt(i) === 'h') {
            if (!isNaN(xyz[i])) {
                const A = (xyz[i] / 180) * PI$1;
                dx += cos$2(A) * weights[0];
                dy += sin$2(A) * weights[0];
            }
            xyz[i] = 0;
        } else {
            xyz[i] = (xyz[i] || 0) * weights[0];
        }
    }

    let alpha = first.alpha() * weights[0];
    colors.forEach((c, ci) => {
        const xyz2 = c.get(mode);
        alpha += c.alpha() * weights[ci + 1];
        for (let i = 0; i < xyz.length; i++) {
            if (!isNaN(xyz2[i])) {
                cnt[i] += weights[ci + 1];
                if (mode.charAt(i) === 'h') {
                    const A = (xyz2[i] / 180) * PI$1;
                    dx += cos$2(A) * weights[ci + 1];
                    dy += sin$2(A) * weights[ci + 1];
                } else {
                    xyz[i] += xyz2[i] * weights[ci + 1];
                }
            }
        }
    });

    for (let i = 0; i < xyz.length; i++) {
        if (mode.charAt(i) === 'h') {
            let A = (atan2$1(dy / cnt[i], dx / cnt[i]) / PI$1) * 180;
            while (A < 0) A += 360;
            while (A >= 360) A -= 360;
            xyz[i] = A;
        } else {
            xyz[i] = xyz[i] / cnt[i];
        }
    }
    alpha /= l;
    return new Color(xyz, mode).alpha(alpha > 0.99999 ? 1 : alpha, true);
};

const _average_lrgb = (colors, weights) => {
    const l = colors.length;
    const xyz = [0, 0, 0, 0];
    for (let i = 0; i < colors.length; i++) {
        const col = colors[i];
        const f = weights[i] / l;
        const rgb = col._rgb;
        xyz[0] += pow$4(rgb[0], 2) * f;
        xyz[1] += pow$4(rgb[1], 2) * f;
        xyz[2] += pow$4(rgb[2], 2) * f;
        xyz[3] += rgb[3] * f;
    }
    xyz[0] = sqrt$1(xyz[0]);
    xyz[1] = sqrt$1(xyz[1]);
    xyz[2] = sqrt$1(xyz[2]);
    if (xyz[3] > 0.9999999) xyz[3] = 1;
    return new Color(clip_rgb(xyz));
};

// minimal multi-purpose interface


const { pow: pow$3 } = Math;

function scale (colors) {
    // constructor
    let _mode = 'rgb';
    let _nacol = chroma('#ccc');
    let _spread = 0;
    // const _fixed = false;
    let _positions = [0, 1];
    let _domain = [0, 1];
    let _pos = [];
    let _padding = [0, 0];
    let _classes = false;
    let _classCount = null;
    let _colors = [];
    let _out = false;
    let _min = 0;
    let _max = 1;
    let _correctLightness = false;
    let _colorCache = {};
    let _useCache = true;
    let _gamma = 1;

    // private methods

    const setColors = function (colors) {
        colors = colors || ['#fff', '#000'];
        if (
            colors &&
            type(colors) === 'string' &&
            chroma.brewer &&
            chroma.brewer[colors.toLowerCase()]
        ) {
            colors = chroma.brewer[colors.toLowerCase()];
        }
        if (type(colors) === 'array') {
            // handle single color
            if (colors.length === 1) {
                colors = [colors[0], colors[0]];
            }
            // make a copy of the colors
            colors = colors.slice(0);
            // convert to chroma classes
            for (let c = 0; c < colors.length; c++) {
                colors[c] = chroma(colors[c]);
            }
            // auto-fill color position
            _pos.length = 0;
            for (let c = 0; c < colors.length; c++) {
                _pos.push(c / (colors.length - 1));
            }
        }
        resetCache();
        return (_colors = colors);
    };

    const getClass = function (value) {
        if (_classes != null) {
            const n = _classes.length - 1;
            let i = 0;
            while (i < n && value >= _classes[i]) {
                i++;
            }
            return i - 1;
        }
        return 0;
    };

    let tMapLightness = (t) => t;
    let tMapDomain = (t) => t;

    // const classifyValue = function(value) {
    //     let val = value;
    //     if (_classes.length > 2) {
    //         const n = _classes.length-1;
    //         const i = getClass(value);
    //         const minc = _classes[0] + ((_classes[1]-_classes[0]) * (0 + (_spread * 0.5)));  // center of 1st class
    //         const maxc = _classes[n-1] + ((_classes[n]-_classes[n-1]) * (1 - (_spread * 0.5)));  // center of last class
    //         val = _min + ((((_classes[i] + ((_classes[i+1] - _classes[i]) * 0.5)) - minc) / (maxc-minc)) * (_max - _min));
    //     }
    //     return val;
    // };

    const getColor = function (val, bypassMap) {
        let col, t;
        if (bypassMap == null) {
            bypassMap = false;
        }
        if (isNaN(val) || val === null) {
            return _nacol;
        }
        if (!bypassMap) {
            if (_classes && _classes.length > 2) {
                // find the class
                const c = getClass(val);
                t = c / (_classes.length - 2);
            } else if (_max !== _min) {
                // just interpolate between min/max
                t = (val - _min) / (_max - _min);
            } else {
                t = 1;
            }
        } else {
            t = val;
        }

        // domain map
        t = tMapDomain(t);

        if (!bypassMap) {
            t = tMapLightness(t); // lightness correction
        }

        if (_gamma !== 1) {
            // clamp before pow: a fractional gamma over a negative base returns
            // NaN, so out-of-domain values must be pinned to the endpoints first
            t = pow$3(limit(t, 0, 1), _gamma);
        }

        t = _padding[0] + t * (1 - _padding[0] - _padding[1]);

        t = limit(t, 0, 1);

        const k = Math.floor(t * 10000);

        if (_useCache && _colorCache[k]) {
            col = _colorCache[k];
        } else {
            if (type(_colors) === 'array') {
                //for i in [0.._pos.length-1]
                for (let i = 0; i < _pos.length; i++) {
                    const p = _pos[i];
                    if (t <= p) {
                        col = _colors[i];
                        break;
                    }
                    if (t >= p && i === _pos.length - 1) {
                        col = _colors[i];
                        break;
                    }
                    if (t > p && t < _pos[i + 1]) {
                        t = (t - p) / (_pos[i + 1] - p);
                        col = chroma.interpolate(
                            _colors[i],
                            _colors[i + 1],
                            t,
                            _mode
                        );
                        break;
                    }
                }
            } else if (type(_colors) === 'function') {
                col = _colors(t);
            }
            if (_useCache) {
                _colorCache[k] = col;
            }
        }
        return col;
    };

    var resetCache = () => (_colorCache = {});

    setColors(colors);

    // public interface

    const f = function (v) {
        const c = chroma(getColor(v));
        if (_out && c[_out]) {
            return c[_out]();
        } else {
            return c;
        }
    };

    f.classes = function (classes) {
        if (classes != null) {
            if (type(classes) === 'array') {
                _classCount = null;
                _classes = classes;
                _positions = [classes[0], classes[classes.length - 1]];
            } else {
                _classCount = classes;
                const d = chroma.analyze(_positions);
                if (classes === 0) {
                    _classes = [d.min, d.max];
                } else {
                    _classes = chroma.limits(d, 'e', classes);
                }
            }
            return f;
        }
        return _classes;
    };

    f.domain = function (domain) {
        if (!arguments.length) {
            // return original domain
            return _domain;
        }
        // store original domain so we can return it later
        _domain = domain.slice(0);
        _min = domain[0];
        _max = domain[domain.length - 1];
        _pos = [];
        const k = _colors.length;
        if (domain.length === k && _min !== _max) {
            // update positions
            for (let d of Array.from(domain)) {
                _pos.push((d - _min) / (_max - _min));
            }
        } else {
            for (let c = 0; c < k; c++) {
                _pos.push(c / (k - 1));
            }
            if (domain.length > 2) {
                // set domain map
                const tOut = domain.map((d, i) => i / (domain.length - 1));
                const tBreaks = domain.map((d) => (d - _min) / (_max - _min));
                if (!tBreaks.every((val, i) => tOut[i] === val)) {
                    tMapDomain = (t) => {
                        if (t <= 0 || t >= 1) return t;
                        let i = 0;
                        while (t >= tBreaks[i + 1]) i++;
                        const f =
                            (t - tBreaks[i]) / (tBreaks[i + 1] - tBreaks[i]);
                        const out = tOut[i] + f * (tOut[i + 1] - tOut[i]);
                        return out;
                    };
                }
            }
        }
        _positions = [_min, _max];
        if (_classCount !== null) {
            f.classes(_classCount);
        }
        return f;
    };

    f.mode = function (_m) {
        if (!arguments.length) {
            return _mode;
        }
        _mode = _m;
        resetCache();
        return f;
    };

    f.range = function (colors, _pos) {
        setColors(colors);
        return f;
    };

    f.out = function (_o) {
        _out = _o;
        return f;
    };

    f.spread = function (val) {
        if (!arguments.length) {
            return _spread;
        }
        _spread = val;
        return f;
    };

    f.correctLightness = function (v) {
        if (v == null) {
            v = true;
        }
        _correctLightness = v;
        resetCache();
        if (_correctLightness) {
            tMapLightness = function (t) {
                const L0 = getColor(0, true).lab()[0];
                const L1 = getColor(1, true).lab()[0];
                const pol = L0 > L1;
                let L_actual = getColor(t, true).lab()[0];
                const L_ideal = L0 + (L1 - L0) * t;
                let L_diff = L_actual - L_ideal;
                let t0 = 0;
                let t1 = 1;
                let max_iter = 20;
                while (Math.abs(L_diff) > 1e-2 && max_iter-- > 0) {
                    (function () {
                        if (pol) {
                            L_diff *= -1;
                        }
                        if (L_diff < 0) {
                            t0 = t;
                            t += (t1 - t) * 0.5;
                        } else {
                            t1 = t;
                            t += (t0 - t) * 0.5;
                        }
                        L_actual = getColor(t, true).lab()[0];
                        return (L_diff = L_actual - L_ideal);
                    })();
                }
                return t;
            };
        } else {
            tMapLightness = (t) => t;
        }
        return f;
    };

    f.padding = function (p) {
        if (p != null) {
            if (type(p) === 'number') {
                p = [p, p];
            }
            _padding = p;
            return f;
        } else {
            return _padding;
        }
    };

    f.colors = function (numColors, out) {
        // If no arguments are given, return the original colors that were provided
        if (arguments.length < 2) {
            out = 'hex';
        }
        let result = [];

        if (arguments.length === 0) {
            result = _colors.slice(0);
        } else if (numColors === 1) {
            result = [f(0.5)];
        } else if (numColors > 1) {
            const dm = _positions[0];
            const dd = _positions[1] - dm;
            result = __range__(0, numColors).map((i) =>
                f(dm + (i / (numColors - 1)) * dd)
            );
        } else {
            // returns all colors based on the defined classes
            colors = [];
            let samples = [];
            if (_classes && _classes.length > 2) {
                for (
                    let i = 1, end = _classes.length, asc = 1 <= end;
                    asc ? i < end : i > end;
                    asc ? i++ : i--
                ) {
                    samples.push((_classes[i - 1] + _classes[i]) * 0.5);
                }
            } else {
                samples = _positions;
            }
            result = samples.map((v) => f(v));
        }

        if (chroma[out]) {
            result = result.map((c) => c[out]());
        }
        return result;
    };

    f.cache = function (c) {
        if (c != null) {
            _useCache = c;
            return f;
        } else {
            return _useCache;
        }
    };

    f.gamma = function (g) {
        if (g != null) {
            _gamma = g;
            return f;
        } else {
            return _gamma;
        }
    };

    f.nodata = function (d) {
        if (d != null) {
            _nacol = chroma(d);
            return f;
        } else {
            return _nacol;
        }
    };

    return f;
}

function __range__(left, right, inclusive) {
    let range = [];
    let ascending = left < right;
    let end = right ;
    for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
        range.push(i);
    }
    return range;
}

//
// interpolates between a set of colors uzing a bezier spline
//


// nth row of the pascal triangle
const binom_row = function (n) {
    let row = [1, 1];
    for (let i = 1; i < n; i++) {
        let newrow = [1];
        for (let j = 1; j <= row.length; j++) {
            newrow[j] = (row[j] || 0) + row[j - 1];
        }
        row = newrow;
    }
    return row;
};

const bezier = function (colors) {
    let I, lab0, lab1, lab2;
    colors = colors.map((c) => new Color(c));
    if (colors.length === 2) {
        // linear interpolation
        [lab0, lab1] = colors.map((c) => c.lab());
        I = function (t) {
            const lab = [0, 1, 2].map((i) => lab0[i] + t * (lab1[i] - lab0[i]));
            return new Color(lab, 'lab');
        };
    } else if (colors.length === 3) {
        // quadratic bezier interpolation
        [lab0, lab1, lab2] = colors.map((c) => c.lab());
        I = function (t) {
            const lab = [0, 1, 2].map(
                (i) =>
                    (1 - t) * (1 - t) * lab0[i] +
                    2 * (1 - t) * t * lab1[i] +
                    t * t * lab2[i]
            );
            return new Color(lab, 'lab');
        };
    } else if (colors.length === 4) {
        // cubic bezier interpolation
        let lab3;
        [lab0, lab1, lab2, lab3] = colors.map((c) => c.lab());
        I = function (t) {
            const lab = [0, 1, 2].map(
                (i) =>
                    (1 - t) * (1 - t) * (1 - t) * lab0[i] +
                    3 * (1 - t) * (1 - t) * t * lab1[i] +
                    3 * (1 - t) * t * t * lab2[i] +
                    t * t * t * lab3[i]
            );
            return new Color(lab, 'lab');
        };
    } else if (colors.length >= 5) {
        // general case (degree n bezier)
        let labs, row, n;
        labs = colors.map((c) => c.lab());
        n = colors.length - 1;
        row = binom_row(n);
        I = function (t) {
            const u = 1 - t;
            const lab = [0, 1, 2].map((i) =>
                labs.reduce(
                    (sum, el, j) =>
                        sum + row[j] * u ** (n - j) * t ** j * el[i],
                    0
                )
            );
            return new Color(lab, 'lab');
        };
    } else {
        throw new RangeError('No point in running bezier with only one color.');
    }
    return I;
};

var bezier$1 = (colors) => {
    const f = bezier(colors);
    f.scale = () => scale(f);
    return f;
};

const { round: round$3 } = Math;

Color.prototype.rgb = function (rnd = true) {
    if (rnd === false) return this._rgb.slice(0, 3);
    return this._rgb.slice(0, 3).map(round$3);
};

Color.prototype.rgba = function (rnd = true) {
    return this._rgb.slice(0, 4).map((v, i) => {
        return i < 3 ? (rnd === false ? v : round$3(v)) : v;
    });
};

const rgb = (...args) => new Color(...args, 'rgb');
Object.assign(chroma, { rgb });

const isValidChannel = (value) =>
    type(value) === 'number' && !Number.isNaN(value);

input.format.rgb = (...args) => {
    const rgba = unpack(args, 'rgba');
    if (!rgba.slice(0, 3).every(isValidChannel)) {
        throw new Error('invalid rgb color');
    }
    if (rgba[3] !== undefined && !isValidChannel(rgba[3])) {
        throw new Error('invalid rgb color');
    }
    if (rgba[3] === undefined) rgba[3] = 1;
    return rgba;
};

input.autodetect.push({
    p: 3,
    test: (...args) => {
        args = unpack(args, 'rgba');
        if (
            type(args) === 'array' &&
            args.slice(0, 3).every(isValidChannel) &&
            (args.length === 3 ||
                (args.length === 4 &&
                    type(args[3]) == 'number' &&
                    args[3] >= 0 &&
                    args[3] <= 1))
        ) {
            return 'rgb';
        }
    }
});

/*
 * interpolates between a set of colors uzing a bezier spline
 * blend mode formulas taken from https://web.archive.org/web/20180110014946/http://www.venture-ware.com/kevin/coding/lets-learn-math-photoshop-blend-modes/
 */


const blend = (bottom, top, mode) => {
    if (!blend[mode]) {
        throw new Error('unknown blend mode ' + mode);
    }
    return blend[mode](bottom, top);
};

const blend_f = (f) => (bottom, top) => {
    const c0 = chroma(top).rgba();
    const c1 = chroma(bottom).rgba();
    c0[3] = limit(c0[3], 0, 1);
    c1[3] = limit(c1[3], 0, 1);
    const alpha = c0[3] + c1[3] * (1 - c0[3]);
    if (alpha === 0) return chroma.rgb(0, 0, 0, 0);
    if (c0[3] === 0) return chroma.rgb(c1);
    if (c1[3] === 0) return chroma.rgb(c0);

    const out = f(c0, c1);
    if (c0[3] === 1 && c1[3] === 1) return chroma.rgb(out);

    // Source-over composition: blend only where source and backdrop overlap.
    for (let i = 0; i < 3; i++) {
        out[i] =
            (c0[3] * (1 - c1[3]) * c0[i] +
                c0[3] * c1[3] * limit(out[i], 0, 255) +
                (1 - c0[3]) * c1[3] * c1[i]) /
            alpha;
    }
    return chroma.rgb(...out, alpha);
};

const each = (f) => (c0, c1) => {
    const out = [];
    out[0] = f(c0[0], c1[0]);
    out[1] = f(c0[1], c1[1]);
    out[2] = f(c0[2], c1[2]);
    return out;
};

const normal = (a) => a;
const multiply = (a, b) => (a * b) / 255;
const darken = (a, b) => (a > b ? b : a);
const lighten = (a, b) => (a > b ? a : b);
const screen = (a, b) => 255 * (1 - (1 - a / 255) * (1 - b / 255));
const overlay = (a, b) =>
    b < 128 ? (2 * a * b) / 255 : 255 * (1 - 2 * (1 - a / 255) * (1 - b / 255));
const burn = (a, b) =>
    b === 255 ? 255 : 255 * (1 - (1 - b / 255) / (a / 255));
const dodge = (a, b) => {
    if (a === 255) return 255;
    a = (255 * (b / 255)) / (1 - a / 255);
    return a > 255 ? 255 : a;
};

// # add = (a,b) ->
// #     if (a + b > 255) then 255 else a + b

blend.normal = blend_f(each(normal));
blend.multiply = blend_f(each(multiply));
blend.screen = blend_f(each(screen));
blend.overlay = blend_f(each(overlay));
blend.darken = blend_f(each(darken));
blend.lighten = blend_f(each(lighten));
blend.dodge = blend_f(each(dodge));
blend.burn = blend_f(each(burn));

// cubehelix interpolation
// based on D.A. Green "A colour scheme for the display of astronomical intensity images"
// http://astron-soc.in/bulletin/11June/289392011.pdf
const { pow: pow$2, sin: sin$1, cos: cos$1 } = Math;

function cubehelix (
    start = 300,
    rotations = -1.5,
    hue = 1,
    gamma = 1,
    lightness = [0, 1]
) {
    let dh = 0,
        dl;
    if (type(lightness) === 'array') {
        dl = lightness[1] - lightness[0];
    } else {
        dl = 0;
        lightness = [lightness, lightness];
    }
    const f = function (fract) {
        const a = TWOPI * ((start + 120) / 360 + rotations * fract);
        const l = pow$2(lightness[0] + dl * fract, gamma);
        const h = dh !== 0 ? hue[0] + fract * dh : hue;
        const amp = (h * l * (1 - l)) / 2;
        const cos_a = cos$1(a);
        const sin_a = sin$1(a);
        const r = l + amp * (-0.14861 * cos_a + 1.78277 * sin_a);
        const g = l + amp * (-0.29227 * cos_a - 0.90649 * sin_a);
        const b = l + amp * (1.97294 * cos_a);
        return chroma(clip_rgb([r * 255, g * 255, b * 255, 1]));
    };
    f.start = function (s) {
        if (s == null) {
            return start;
        }
        start = s;
        return f;
    };
    f.rotations = function (r) {
        if (r == null) {
            return rotations;
        }
        rotations = r;
        return f;
    };
    f.gamma = function (g) {
        if (g == null) {
            return gamma;
        }
        gamma = g;
        return f;
    };
    f.hue = function (h) {
        if (h == null) {
            return hue;
        }
        hue = h;
        if (type(hue) === 'array') {
            dh = hue[1] - hue[0];
            if (dh === 0) {
                hue = hue[1];
            }
        } else {
            dh = 0;
        }
        return f;
    };
    f.lightness = function (h) {
        if (h == null) {
            return lightness;
        }
        if (type(h) === 'array') {
            lightness = h;
            dl = h[1] - h[0];
        } else {
            lightness = [h, h];
            dl = 0;
        }
        return f;
    };
    f.scale = () => chroma.scale(f);
    f.hue(hue);
    return f;
}

const digits = '0123456789abcdef';

const { floor: floor$1, random } = Math;

/**
 * Generates a random color.
 * @param {() => number} rng - A random number generator function.
 */
var random$1 = (rng = random) => {
    let code = '#';
    for (let i = 0; i < 6; i++) {
        code += digits.charAt(floor$1(rng() * 16));
    }
    return new Color(code, 'hex');
};

const { log: log$1, pow: pow$1, floor, abs: abs$1 } = Math;

function analyze(data, key = null) {
    const r = {
        min: Number.MAX_VALUE,
        max: Number.MAX_VALUE * -1,
        sum: 0,
        values: [],
        count: 0
    };
    if (type(data) === 'object') {
        data = Object.values(data);
    }
    data.forEach((val) => {
        if (key && type(val) === 'object') val = val[key];
        if (val !== undefined && val !== null && !isNaN(val)) {
            r.values.push(val);
            r.sum += val;
            if (val < r.min) r.min = val;
            if (val > r.max) r.max = val;
            r.count += 1;
        }
    });

    r.domain = [r.min, r.max];

    r.limits = (mode, num) => limits(r, mode, num);

    return r;
}

function limits(data, mode = 'equal', num = 7) {
    if (type(data) == 'array') {
        data = analyze(data);
    }
    const { min, max } = data;
    const values = data.values.sort((a, b) => a - b);

    if (num === 1) {
        return [min, max];
    }

    const limits = [];

    if (mode.substr(0, 1) === 'c') {
        // continuous
        limits.push(min);
        limits.push(max);
    }

    if (mode.substr(0, 1) === 'e') {
        // equal interval
        limits.push(min);
        for (let i = 1; i < num; i++) {
            limits.push(min + (i / num) * (max - min));
        }
        limits.push(max);
    } else if (mode.substr(0, 1) === 'l') {
        // log scale
        if (min <= 0) {
            throw new Error(
                'Logarithmic scales are only possible for values > 0'
            );
        }
        const min_log = Math.LOG10E * log$1(min);
        const max_log = Math.LOG10E * log$1(max);
        limits.push(min);
        for (let i = 1; i < num; i++) {
            limits.push(pow$1(10, min_log + (i / num) * (max_log - min_log)));
        }
        limits.push(max);
    } else if (mode.substr(0, 1) === 'q') {
        // quantile scale
        limits.push(min);
        for (let i = 1; i < num; i++) {
            const p = ((values.length - 1) * i) / num;
            const pb = floor(p);
            if (pb === p) {
                limits.push(values[pb]);
            } else {
                // p > pb
                const pr = p - pb;
                limits.push(values[pb] * (1 - pr) + values[pb + 1] * pr);
            }
        }
        limits.push(max);
    } else if (mode.substr(0, 1) === 'k') {
        // k-means clustering
        /*
        implementation based on
        http://code.google.com/p/figue/source/browse/trunk/figue.js#336
        simplified for 1-d input values
        */
        let cluster;
        const n = values.length;
        const assignments = new Array(n);
        const clusterSizes = new Array(num);
        let repeat = true;
        let nb_iters = 0;
        let centroids = null;

        // get seed values
        centroids = [];
        centroids.push(min);
        for (let i = 1; i < num; i++) {
            centroids.push(min + (i / num) * (max - min));
        }
        centroids.push(max);

        while (repeat) {
            // assignment step
            for (let j = 0; j < num; j++) {
                clusterSizes[j] = 0;
            }
            for (let i = 0; i < n; i++) {
                const value = values[i];
                let mindist = Number.MAX_VALUE;
                let best;
                for (let j = 0; j < num; j++) {
                    const dist = abs$1(centroids[j] - value);
                    if (dist < mindist) {
                        mindist = dist;
                        best = j;
                    }
                }
                // tally the winning cluster once per point, after the argmin
                // over j; incrementing inside the loop corrupted clusterSizes
                clusterSizes[best]++;
                assignments[i] = best;
            }

            // update centroids step
            const newCentroids = new Array(num);
            for (let j = 0; j < num; j++) {
                newCentroids[j] = null;
            }
            for (let i = 0; i < n; i++) {
                cluster = assignments[i];
                if (newCentroids[cluster] === null) {
                    newCentroids[cluster] = values[i];
                } else {
                    newCentroids[cluster] += values[i];
                }
            }
            for (let j = 0; j < num; j++) {
                newCentroids[j] *= 1 / clusterSizes[j];
            }

            // check convergence
            repeat = false;
            for (let j = 0; j < num; j++) {
                if (newCentroids[j] !== centroids[j]) {
                    repeat = true;
                    break;
                }
            }

            centroids = newCentroids;
            nb_iters++;

            if (nb_iters > 200) {
                repeat = false;
            }
        }

        // finished k-means clustering
        // the next part is borrowed from gabrielflor.it
        const kClusters = {};
        for (let j = 0; j < num; j++) {
            kClusters[j] = [];
        }
        for (let i = 0; i < n; i++) {
            cluster = assignments[i];
            kClusters[cluster].push(values[i]);
        }
        let tmpKMeansBreaks = [];
        for (let j = 0; j < num; j++) {
            tmpKMeansBreaks.push(kClusters[j][0]);
            tmpKMeansBreaks.push(kClusters[j][kClusters[j].length - 1]);
        }
        tmpKMeansBreaks = tmpKMeansBreaks.sort((a, b) => a - b);
        limits.push(tmpKMeansBreaks[0]);
        for (let i = 1; i < tmpKMeansBreaks.length; i += 2) {
            const v = tmpKMeansBreaks[i];
            if (!isNaN(v) && limits.indexOf(v) === -1) {
                limits.push(v);
            }
        }
    }
    return limits;
}

var contrast = (a, b) => {
    // WCAG contrast ratio
    // see http://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
    a = new Color(a);
    b = new Color(b);
    const l1 = a.luminance();
    const l2 = b.luminance();
    return l1 > l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05);
};

/**
 * @license
 *
 * The APCA contrast prediction algorithm is based of the formulas published
 * in the APCA-1.0.98G specification by Myndex. The specification is available at:
 * https://raw.githubusercontent.com/Myndex/apca-w3/master/images/APCAw3_0.1.17_APCA0.0.98G.svg
 *
 * Note that the APCA implementation is still beta, so please update to
 * future versions of chroma.js when they become available.
 *
 * You can read more about the APCA Readability Criterion at
 * https://readtech.org/ARC/
 */

// constants
const W_offset = 0.027;
const P_in = 0.0005;
const P_out = 0.1;
const R_scale = 1.14;
const B_threshold = 0.022;
const B_exp = 1.414;

var contrastAPCA = (text, bg) => {
    // parse input colors
    text = new Color(text);
    bg = new Color(bg);
    // if text color has alpha, blend against background
    if (text.alpha() < 1) {
        text = mix(bg, text, text.alpha(), 'rgb');
    }
    const l_text = lum(...text.rgb());
    const l_bg = lum(...bg.rgb());

    // soft clamp black levels
    const Y_text =
        l_text >= B_threshold
            ? l_text
            : l_text + Math.pow(B_threshold - l_text, B_exp);
    const Y_bg =
        l_bg >= B_threshold ? l_bg : l_bg + Math.pow(B_threshold - l_bg, B_exp);

    // normal polarity (dark text on light background)
    const S_norm = Math.pow(Y_bg, 0.56) - Math.pow(Y_text, 0.57);
    // reverse polarity (light text on dark background)
    const S_rev = Math.pow(Y_bg, 0.65) - Math.pow(Y_text, 0.62);
    // clamp noise then scale
    const C =
        Math.abs(Y_bg - Y_text) < P_in
            ? 0
            : Y_text < Y_bg
              ? S_norm * R_scale
              : S_rev * R_scale;
    // clamp minimum contrast then offset
    const S_apc = Math.abs(C) < P_out ? 0 : C > 0 ? C - W_offset : C + W_offset;
    // scale to 100
    return S_apc * 100;
};

function lum(r, g, b) {
    return (
        0.2126729 * Math.pow(r / 255, 2.4) +
        0.7151522 * Math.pow(g / 255, 2.4) +
        0.072175 * Math.pow(b / 255, 2.4)
    );
}

const { sqrt, pow, min, max: max$1, atan2, abs, cos, sin, exp, PI } = Math;

function deltaE (a, b, Kl = 1, Kc = 1, Kh = 1) {
    // Delta E (CIE 2000)
    // see http://www.brucelindbloom.com/index.html?Eqn_DeltaE_CIE2000.html
    var rad2deg = function (rad) {
        return (360 * rad) / (2 * PI);
    };
    var deg2rad = function (deg) {
        return (2 * PI * deg) / 360;
    };
    a = new Color(a);
    b = new Color(b);
    const [L1, a1, b1] = Array.from(a.lab());
    const [L2, a2, b2] = Array.from(b.lab());
    const avgL = (L1 + L2) / 2;
    const C1 = sqrt(pow(a1, 2) + pow(b1, 2));
    const C2 = sqrt(pow(a2, 2) + pow(b2, 2));
    const avgC = (C1 + C2) / 2;
    const G = 0.5 * (1 - sqrt(pow(avgC, 7) / (pow(avgC, 7) + pow(25, 7))));
    const a1p = a1 * (1 + G);
    const a2p = a2 * (1 + G);
    const C1p = sqrt(pow(a1p, 2) + pow(b1, 2));
    const C2p = sqrt(pow(a2p, 2) + pow(b2, 2));
    const avgCp = (C1p + C2p) / 2;
    const arctan1 = rad2deg(atan2(b1, a1p));
    const arctan2 = rad2deg(atan2(b2, a2p));
    const h1p = arctan1 >= 0 ? arctan1 : arctan1 + 360;
    const h2p = arctan2 >= 0 ? arctan2 : arctan2 + 360;
    const avgHp =
        abs(h1p - h2p) > 180 ? (h1p + h2p + 360) / 2 : (h1p + h2p) / 2;
    const T =
        1 -
        0.17 * cos(deg2rad(avgHp - 30)) +
        0.24 * cos(deg2rad(2 * avgHp)) +
        0.32 * cos(deg2rad(3 * avgHp + 6)) -
        0.2 * cos(deg2rad(4 * avgHp - 63));
    let deltaHp = h2p - h1p;
    deltaHp =
        abs(deltaHp) <= 180
            ? deltaHp
            : h2p <= h1p
              ? deltaHp + 360
              : deltaHp - 360;
    deltaHp = 2 * sqrt(C1p * C2p) * sin(deg2rad(deltaHp) / 2);
    const deltaL = L2 - L1;
    const deltaCp = C2p - C1p;
    const sl = 1 + (0.015 * pow(avgL - 50, 2)) / sqrt(20 + pow(avgL - 50, 2));
    const sc = 1 + 0.045 * avgCp;
    const sh = 1 + 0.015 * avgCp * T;
    const deltaTheta = 30 * exp(-pow((avgHp - 275) / 25, 2));
    const Rc = 2 * sqrt(pow(avgCp, 7) / (pow(avgCp, 7) + pow(25, 7)));
    const Rt = -Rc * sin(2 * deg2rad(deltaTheta));
    const result = sqrt(
        pow(deltaL / (Kl * sl), 2) +
            pow(deltaCp / (Kc * sc), 2) +
            pow(deltaHp / (Kh * sh), 2) +
            Rt * (deltaCp / (Kc * sc)) * (deltaHp / (Kh * sh))
    );
    return max$1(0, min(100, result));
}

// simple Euclidean distance
function distance (a, b, mode = 'lab') {
    // Delta E (CIE 1976)
    // see http://www.brucelindbloom.com/index.html?Equations.html
    a = new Color(a);
    b = new Color(b);
    const l1 = a.get(mode);
    const l2 = b.get(mode);
    let sum_sq = 0;
    for (let i in l1) {
        const d = (l1[i] || 0) - (l2[i] || 0);
        sum_sq += d * d;
    }
    return Math.sqrt(sum_sq);
}

var valid = (...args) => {
    try {
        new Color(...args);
        return true;
        // eslint-disable-next-line
    } catch (e) {
        return false;
    }
};

// some pre-defined color scales:

var scales = {
    cool() {
        return scale([chroma.hsl(180, 1, 0.9), chroma.hsl(250, 0.7, 0.4)]);
    },
    hot() {
        return scale(['#000', '#f00', '#ff0', '#fff']).mode(
            'rgb'
        );
    }
};

/**
    ColorBrewer colors for chroma.js

    Copyright (c) 2002 Cynthia Brewer, Mark Harrower, and The
    Pennsylvania State University.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software distributed
    under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
    CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

const colorbrewer = {
    // sequential
    OrRd: ['#fff7ec', '#fee8c8', '#fdd49e', '#fdbb84', '#fc8d59', '#ef6548', '#d7301f', '#b30000', '#7f0000'],
    PuBu: ['#fff7fb', '#ece7f2', '#d0d1e6', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#045a8d', '#023858'],
    BuPu: ['#f7fcfd', '#e0ecf4', '#bfd3e6', '#9ebcda', '#8c96c6', '#8c6bb1', '#88419d', '#810f7c', '#4d004b'],
    Oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
    BuGn: ['#f7fcfd', '#e5f5f9', '#ccece6', '#99d8c9', '#66c2a4', '#41ae76', '#238b45', '#006d2c', '#00441b'],
    YlOrBr: ['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#993404', '#662506'],
    YlGn: ['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#006837', '#004529'],
    Reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
    RdPu: ['#fff7f3', '#fde0dd', '#fcc5c0', '#fa9fb5', '#f768a1', '#dd3497', '#ae017e', '#7a0177', '#49006a'],
    Greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
    YlGnBu: ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58'],
    Purples: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
    GnBu: ['#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5', '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081'],
    Greys: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000'],
    YlOrRd: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'],
    PuRd: ['#f7f4f9', '#e7e1ef', '#d4b9da', '#c994c7', '#df65b0', '#e7298a', '#ce1256', '#980043', '#67001f'],
    Blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
    PuBuGn: ['#fff7fb', '#ece2f0', '#d0d1e6', '#a6bddb', '#67a9cf', '#3690c0', '#02818a', '#016c59', '#014636'],
    Viridis: ['#440154', '#482777', '#3f4a8a', '#31678e', '#26838f', '#1f9d8a', '#6cce5a', '#b6de2b', '#fee825'],

    // diverging
    Spectral: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'],
    RdYlGn: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837'],
    RdBu: ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'],
    PiYG: ['#8e0152', '#c51b7d', '#de77ae', '#f1b6da', '#fde0ef', '#f7f7f7', '#e6f5d0', '#b8e186', '#7fbc41', '#4d9221', '#276419'],
    PRGn: ['#40004b', '#762a83', '#9970ab', '#c2a5cf', '#e7d4e8', '#f7f7f7', '#d9f0d3', '#a6dba0', '#5aae61', '#1b7837', '#00441b'],
    RdYlBu: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee090', '#ffffbf', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695'],
    BrBG: ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'],
    RdGy: ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#ffffff', '#e0e0e0', '#bababa', '#878787', '#4d4d4d', '#1a1a1a'],
    PuOr: ['#7f3b08', '#b35806', '#e08214', '#fdb863', '#fee0b6', '#f7f7f7', '#d8daeb', '#b2abd2', '#8073ac', '#542788', '#2d004b'],

    // qualitative
    Set2: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
    Accent: ['#7fc97f', '#beaed4', '#fdc086', '#ffff99', '#386cb0', '#f0027f', '#bf5b17', '#666666'],
    Set1: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'],
    Set3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5', '#ffed6f'],
    Dark2: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'],
    Paired: ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a', '#ffff99', '#b15928'],
    Pastel2: ['#b3e2cd', '#fdcdac', '#cbd5e8', '#f4cae4', '#e6f5c9', '#fff2ae', '#f1e2cc', '#cccccc'],
    Pastel1: ['#fbb4ae', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6', '#ffffcc', '#e5d8bd', '#fddaec', '#f2f2f2']
};

const colorbrewerTypes = Object.keys(colorbrewer);
const typeMap = new Map(colorbrewerTypes.map((key) => [key.toLowerCase(), key]));

// use Proxy to allow case-insensitive access to palettes
const colorbrewerProxy =
    typeof Proxy === 'function'
        ? new Proxy(colorbrewer, {
              get(target, prop) {
                  const lower = prop.toLowerCase();
                  if (typeMap.has(lower)) {
                      return target[typeMap.get(lower)];
                  }
              },
              getOwnPropertyNames() {
                  return Object.getOwnPropertyNames(colorbrewerTypes);
              }
          })
        : colorbrewer;

const cmyk2rgb = (...args) => {
    args = unpack(args, 'cmyk');
    const [c, m, y, k] = args;
    const alpha = args.length > 4 ? args[4] : 1;
    if (k === 1) return [0, 0, 0, alpha];
    return [
        c >= 1 ? 0 : 255 * (1 - c) * (1 - k), // r
        m >= 1 ? 0 : 255 * (1 - m) * (1 - k), // g
        y >= 1 ? 0 : 255 * (1 - y) * (1 - k), // b
        alpha
    ];
};

const { max } = Math;

const rgb2cmyk = (...args) => {
    let [r, g, b] = unpack(args, 'rgb');
    r = r / 255;
    g = g / 255;
    b = b / 255;
    const k = 1 - max(r, max(g, b));
    const f = k < 1 ? 1 / (1 - k) : 0;
    const c = (1 - r - k) * f;
    const m = (1 - g - k) * f;
    const y = (1 - b - k) * f;
    return [c, m, y, k];
};

Color.prototype.cmyk = function () {
    return rgb2cmyk(this._rgb);
};

const cmyk = (...args) => new Color(...args, 'cmyk');
Object.assign(chroma, { cmyk });

input.format.cmyk = cmyk2rgb;

input.autodetect.push({
    p: 2,
    test: (...args) => {
        args = unpack(args, 'cmyk');
        if (type(args) === 'array' && args.length === 4) {
            return 'cmyk';
        }
    }
});

/*
 * supported arguments:
 * - hsl2css(h,s,l)
 * - hsl2css(h,s,l,a)
 * - hsl2css([h,s,l], mode)
 * - hsl2css([h,s,l,a], mode)
 * - hsl2css({h,s,l,a}, mode)
 */
const hsl2css = (...args) => {
    const hsla = unpack(args, 'hsla');
    let mode = last(args) || 'lsa';
    hsla[0] = rnd2(hsla[0] || 0) + 'deg';
    hsla[1] = rnd2(hsla[1] * 100) + '%';
    hsla[2] = rnd2(hsla[2] * 100) + '%';
    if (mode === 'hsla' || (hsla.length > 3 && hsla[3] < 1)) {
        hsla[3] = '/ ' + (hsla.length > 3 ? hsla[3] : 1);
        mode = 'hsla';
    } else {
        hsla.length = 3;
    }
    return `${mode.substr(0, 3)}(${hsla.join(' ')})`;
};

/*
 * supported arguments:
 * - lab2css(l,a,b)
 * - lab2css(l,a,b,alpha)
 * - lab2css([l,a,b], mode)
 * - lab2css([l,a,b,alpha], mode)
 */
const lab2css = (...args) => {
    const laba = unpack(args, 'lab');
    let mode = last(args) || 'lab';
    laba[0] = rnd2(laba[0]) + '%';
    laba[1] = rnd2(laba[1]);
    laba[2] = rnd2(laba[2]);
    if (mode === 'laba' || (laba.length > 3 && laba[3] < 1)) {
        laba[3] = '/ ' + (laba.length > 3 ? laba[3] : 1);
    } else {
        laba.length = 3;
    }
    return `lab(${laba.join(' ')})`;
};

/*
 * supported arguments:
 * - lab2css(l,a,b)
 * - lab2css(l,a,b,alpha)
 * - lab2css([l,a,b], mode)
 * - lab2css([l,a,b,alpha], mode)
 */
const lch2css = (...args) => {
    const lcha = unpack(args, 'lch');
    let mode = last(args) || 'lab';
    lcha[0] = rnd2(lcha[0]) + '%';
    lcha[1] = rnd2(lcha[1]);
    lcha[2] = isNaN(lcha[2]) ? 'none' : rnd2(lcha[2]) + 'deg'; // add deg unit to hue
    if (mode === 'lcha' || (lcha.length > 3 && lcha[3] < 1)) {
        lcha[3] = '/ ' + (lcha.length > 3 ? lcha[3] : 1);
    } else {
        lcha.length = 3;
    }
    return `lch(${lcha.join(' ')})`;
};

const oklab2css = (...args) => {
    const laba = unpack(args, 'lab');
    laba[0] = rnd2(laba[0] * 100) + '%';
    laba[1] = rnd3(laba[1]);
    laba[2] = rnd3(laba[2]);
    if (laba.length > 3 && laba[3] < 1) {
        laba[3] = '/ ' + (laba.length > 3 ? laba[3] : 1);
    } else {
        laba.length = 3;
    }
    return `oklab(${laba.join(' ')})`;
};

const rgb2oklch = (...args) => {
    const [r, g, b, ...rest] = unpack(args, 'rgb');
    const [l, a, b_] = rgb2oklab(r, g, b);
    const [L, c, h] = lab2lch(l, a, b_);
    return [L, c, h, ...(rest.length > 0 && rest[0] < 1 ? [rest[0]] : [])];
};

const oklch2css = (...args) => {
    const lcha = unpack(args, 'lch');
    lcha[0] = rnd2(lcha[0] * 100) + '%';
    lcha[1] = rnd3(lcha[1]);
    lcha[2] = isNaN(lcha[2]) ? 'none' : rnd2(lcha[2]) + 'deg'; // add deg unit to hue
    if (lcha.length > 3 && lcha[3] < 1) {
        lcha[3] = '/ ' + (lcha.length > 3 ? lcha[3] : 1);
    } else {
        lcha.length = 3;
    }
    return `oklch(${lcha.join(' ')})`;
};

const { round: round$2 } = Math;

/*
 * supported arguments:
 * - rgb2css(r,g,b)
 * - rgb2css(r,g,b,a)
 * - rgb2css([r,g,b], mode)
 * - rgb2css([r,g,b,a], mode)
 * - rgb2css({r,g,b,a}, mode)
 */
const rgb2css = (...args) => {
    const rgba = unpack(args, 'rgba');
    let mode = last(args) || 'rgb';
    if (mode.substr(0, 3) === 'hsl') {
        return hsl2css(rgb2hsl(rgba), mode);
    }
    if (mode.substr(0, 3) === 'lab') {
        // change to D50 lab whitepoint since this is what W3C is using for CSS Lab colors
        const prevWhitePoint = getLabWhitePoint();
        setLabWhitePoint('d50');
        const cssColor = lab2css(rgb2lab(rgba), mode);
        setLabWhitePoint(prevWhitePoint);
        return cssColor;
    }
    if (mode.substr(0, 3) === 'lch') {
        // change to D50 lab whitepoint since this is what W3C is using for CSS Lab colors
        const prevWhitePoint = getLabWhitePoint();
        setLabWhitePoint('d50');
        const cssColor = lch2css(rgb2lch(rgba), mode);
        setLabWhitePoint(prevWhitePoint);
        return cssColor;
    }
    if (mode.substr(0, 5) === 'oklab') {
        return oklab2css(rgb2oklab(rgba));
    }
    if (mode.substr(0, 5) === 'oklch') {
        return oklch2css(rgb2oklch(rgba));
    }
    rgba[0] = round$2(rgba[0]);
    rgba[1] = round$2(rgba[1]);
    rgba[2] = round$2(rgba[2]);
    if (mode === 'rgba' || (rgba.length > 3 && rgba[3] < 1)) {
        rgba[3] = '/ ' + (rgba.length > 3 ? rgba[3] : 1);
        mode = 'rgba';
    }
    return `${mode.substr(0, 3)}(${rgba.slice(0, mode === 'rgb' ? 3 : 4).join(' ')})`;
};

const oklch2rgb = (...args) => {
    args = unpack(args, 'lch');
    const [l, c, h, ...rest] = args;
    const [L, a, b_] = lch2lab(l, c, h);
    const [r, g, b] = oklab2rgb(L, a, b_);
    return [r, g, b, ...(rest.length > 0 && rest[0] < 1 ? [rest[0]] : [])];
};

const INT_OR_PCT = /((?:-?\d+)|(?:-?\d+(?:\.\d+)?)%|none)/.source;
const FLOAT_OR_PCT = /((?:-?(?:\d+(?:\.\d*)?|\.\d+)%?)|none)/.source;
const PCT = /((?:-?(?:\d+(?:\.\d*)?|\.\d+)%)|none)/.source;
const RE_S = /\s*/.source;
const SEP = /\s+/.source;
const COMMA = /\s*,\s*/.source;
const ANLGE = /((?:-?(?:\d+(?:\.\d*)?|\.\d+)(?:deg)?)|none)/.source;
const ALPHA = /\s*(?:\/\s*((?:[01]|[01]?\.\d+)|\d+(?:\.\d+)?%))?/.source;

// e.g. rgb(250 20 0), rgb(100% 50% 20%), rgb(100% 50% 20% / 0.5)
const RE_RGB = new RegExp(
    '^rgba?\\(' +
        RE_S +
        [INT_OR_PCT, INT_OR_PCT, INT_OR_PCT].join(SEP) +
        ALPHA +
        '\\)$'
);
const RE_RGB_LEGACY = new RegExp(
    '^rgb\\(' +
        RE_S +
        [INT_OR_PCT, INT_OR_PCT, INT_OR_PCT].join(COMMA) +
        RE_S +
        '\\)$'
);
const RE_RGBA_LEGACY = new RegExp(
    '^rgba\\(' +
        RE_S +
        [INT_OR_PCT, INT_OR_PCT, INT_OR_PCT, FLOAT_OR_PCT].join(COMMA) +
        RE_S +
        '\\)$'
);

const RE_HSL = new RegExp(
    '^hsla?\\(' + RE_S + [ANLGE, PCT, PCT].join(SEP) + ALPHA + '\\)$'
);
const RE_HSL_LEGACY = new RegExp(
    '^hsl?\\(' + RE_S + [ANLGE, PCT, PCT].join(COMMA) + RE_S + '\\)$'
);
const RE_HSLA_LEGACY =
    /^hsla\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)%\s*,\s*(-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)$/;

const RE_LAB = new RegExp(
    '^lab\\(' +
        RE_S +
        [FLOAT_OR_PCT, FLOAT_OR_PCT, FLOAT_OR_PCT].join(SEP) +
        ALPHA +
        '\\)$'
);
const RE_LCH = new RegExp(
    '^lch\\(' +
        RE_S +
        [FLOAT_OR_PCT, FLOAT_OR_PCT, ANLGE].join(SEP) +
        ALPHA +
        '\\)$'
);
const RE_OKLAB = new RegExp(
    '^oklab\\(' +
        RE_S +
        [FLOAT_OR_PCT, FLOAT_OR_PCT, FLOAT_OR_PCT].join(SEP) +
        ALPHA +
        '\\)$'
);
const RE_OKLCH = new RegExp(
    '^oklch\\(' +
        RE_S +
        [FLOAT_OR_PCT, FLOAT_OR_PCT, ANLGE].join(SEP) +
        ALPHA +
        '\\)$'
);

const { round: round$1 } = Math;

const roundRGB = (rgb) => {
    return rgb.map((v, i) => (i <= 2 ? limit(round$1(v), 0, 255) : v));
};

const percentToAbsolute = (pct, min = 0, max = 100, signed = false) => {
    if (typeof pct === 'string' && pct.endsWith('%')) {
        pct = parseFloat(pct.substring(0, pct.length - 1)) / 100;
        if (signed) {
            // signed percentages are in the range -100% to 100%
            pct = min + (pct + 1) * 0.5 * (max - min);
        } else {
            pct = min + pct * (max - min);
        }
    }
    return +pct;
};

const noneToValue = (v, noneValue) => {
    return v === 'none' ? noneValue : v;
};

const css2rgb = (css) => {
    css = css.toLowerCase().trim();

    if (css === 'transparent') {
        return [0, 0, 0, 0];
    }

    let m;

    if (input.format.named) {
        try {
            return input.format.named(css);
            // eslint-disable-next-line
        } catch (e) {}
    }

    // rgb(250 20 0) or rgb(250,20,0)
    if ((m = css.match(RE_RGB)) || (m = css.match(RE_RGB_LEGACY))) {
        let rgb = m.slice(1, 4);
        for (let i = 0; i < 3; i++) {
            rgb[i] = +percentToAbsolute(noneToValue(rgb[i], 0), 0, 255);
        }
        rgb = roundRGB(rgb);
        const alpha = m[4] !== undefined ? +percentToAbsolute(m[4], 0, 1) : 1;
        rgb[3] = alpha; // default alpha
        return rgb;
    }

    // rgba(250,20,0,0.4)
    if ((m = css.match(RE_RGBA_LEGACY))) {
        let rgb = m.slice(1, 4);
        for (let i = 0; i < 3; i++) {
            rgb[i] = +percentToAbsolute(noneToValue(rgb[i], 0), 0, 255);
        }
        rgb = roundRGB(rgb);
        rgb[3] = +percentToAbsolute(noneToValue(m[4], 0), 0, 1);
        return rgb;
    }

    // hsl(0,100%,50%)
    if ((m = css.match(RE_HSL)) || (m = css.match(RE_HSL_LEGACY))) {
        const hsl = m.slice(1, 4);
        hsl[0] = +noneToValue(hsl[0].replace('deg', ''), 0);
        hsl[1] = +percentToAbsolute(noneToValue(hsl[1], 0), 0, 100) * 0.01;
        hsl[2] = +percentToAbsolute(noneToValue(hsl[2], 0), 0, 100) * 0.01;
        const rgb = roundRGB(hsl2rgb(hsl));
        const alpha = m[4] !== undefined ? +percentToAbsolute(m[4], 0, 1) : 1;
        rgb[3] = alpha;
        return rgb;
    }

    // hsla(0,100%,50%,0.5)
    if ((m = css.match(RE_HSLA_LEGACY))) {
        const hsl = m.slice(1, 4);
        hsl[1] *= 0.01;
        hsl[2] *= 0.01;
        const rgb = hsl2rgb(hsl);
        for (let i = 0; i < 3; i++) {
            rgb[i] = round$1(rgb[i]);
        }
        rgb[3] = +m[4]; // default alpha = 1
        return rgb;
    }

    if ((m = css.match(RE_LAB))) {
        const lab = m.slice(1, 4);
        lab[0] = percentToAbsolute(noneToValue(lab[0], 0), 0, 100);
        lab[1] = percentToAbsolute(noneToValue(lab[1], 0), -125, 125, true);
        lab[2] = percentToAbsolute(noneToValue(lab[2], 0), -125, 125, true);
        // convert to D50 Lab whitepoint
        const wp = getLabWhitePoint();
        setLabWhitePoint('d50');
        const rgb = roundRGB(lab2rgb(lab));
        // convert back to original Lab whitepoint
        setLabWhitePoint(wp);
        const alpha = m[4] !== undefined ? +percentToAbsolute(m[4], 0, 1) : 1;
        rgb[3] = alpha;
        return rgb;
    }

    if ((m = css.match(RE_LCH))) {
        const lch = m.slice(1, 4);
        lch[0] = percentToAbsolute(noneToValue(lch[0], 0), 0, 100);
        lch[1] = percentToAbsolute(noneToValue(lch[1], 0), 0, 150, false);
        lch[2] = +noneToValue(lch[2].replace('deg', ''), 0);
        // convert to D50 Lab whitepoint
        const wp = getLabWhitePoint();
        setLabWhitePoint('d50');
        const rgb = roundRGB(lch2rgb(lch));
        // convert back to original Lab whitepoint
        setLabWhitePoint(wp);
        const alpha = m[4] !== undefined ? +percentToAbsolute(m[4], 0, 1) : 1;
        rgb[3] = alpha;
        return rgb;
    }

    if ((m = css.match(RE_OKLAB))) {
        const oklab = m.slice(1, 4);
        oklab[0] = percentToAbsolute(noneToValue(oklab[0], 0), 0, 1);
        oklab[1] = percentToAbsolute(noneToValue(oklab[1], 0), -0.4, 0.4, true);
        oklab[2] = percentToAbsolute(noneToValue(oklab[2], 0), -0.4, 0.4, true);
        const rgb = roundRGB(oklab2rgb(oklab));
        const alpha = m[4] !== undefined ? +percentToAbsolute(m[4], 0, 1) : 1;
        rgb[3] = alpha;
        return rgb;
    }

    if ((m = css.match(RE_OKLCH))) {
        const oklch = m.slice(1, 4);
        oklch[0] = percentToAbsolute(noneToValue(oklch[0], 0), 0, 1);
        oklch[1] = percentToAbsolute(noneToValue(oklch[1], 0), 0, 0.4, false);
        oklch[2] = +noneToValue(oklch[2].replace('deg', ''), 0);
        const rgb = roundRGB(oklch2rgb(oklch));
        const alpha = m[4] !== undefined ? +percentToAbsolute(m[4], 0, 1) : 1;
        rgb[3] = alpha;
        return rgb;
    }
};

css2rgb.test = (s) => {
    return (
        // modern
        RE_RGB.test(s) ||
        RE_HSL.test(s) ||
        RE_LAB.test(s) ||
        RE_LCH.test(s) ||
        RE_OKLAB.test(s) ||
        RE_OKLCH.test(s) ||
        // legacy
        RE_RGB_LEGACY.test(s) ||
        RE_RGBA_LEGACY.test(s) ||
        RE_HSL_LEGACY.test(s) ||
        RE_HSLA_LEGACY.test(s) ||
        s === 'transparent'
    );
};

Color.prototype.css = function (mode) {
    return rgb2css(this._rgb, mode);
};

const css = (...args) => new Color(...args, 'css');
chroma.css = css;

input.format.css = css2rgb;

input.autodetect.push({
    p: 5,
    test: (h, ...rest) => {
        if (!rest.length && type(h) === 'string' && css2rgb.test(h)) {
            return 'css';
        }
    }
});

input.format.gl = (...args) => {
    const rgb = unpack(args, 'rgba');
    rgb[0] *= 255;
    rgb[1] *= 255;
    rgb[2] *= 255;
    return rgb;
};

const gl = (...args) => new Color(...args, 'gl');
chroma.gl = gl;

Color.prototype.gl = function () {
    const rgb = this._rgb;
    return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, rgb[3]];
};

Color.prototype.hex = function (mode) {
    return rgb2hex(this._rgb, mode);
};

const hex = (...args) => new Color(...args, 'hex');
chroma.hex = hex;

input.format.hex = hex2rgb;
input.autodetect.push({
    p: 4,
    test: (h, ...rest) => {
        if (
            !rest.length &&
            type(h) === 'string' &&
            [3, 4, 5, 6, 7, 8, 9].indexOf(h.length) >= 0
        ) {
            return 'hex';
        }
    }
});

/*
 * Based on implementation by Neil Bartlett
 * https://github.com/neilbartlett/color-temperature
 */

const { log } = Math;

const temperature2rgb = (kelvin) => {
    const temp = kelvin / 100;
    let r, g, b;
    if (temp < 66) {
        r = 255;
        g =
            temp < 6
                ? 0
                : -155.25485562709179 -
                  0.44596950469579133 * (g = temp - 2) +
                  104.49216199393888 * log(g);
        b =
            temp < 20
                ? 0
                : -254.76935184120902 +
                  0.8274096064007395 * (b = temp - 10) +
                  115.67994401066147 * log(b);
    } else {
        r =
            351.97690566805693 +
            0.114206453784165 * (r = temp - 55) -
            40.25366309332127 * log(r);
        g =
            325.4494125711974 +
            0.07943456536662342 * (g = temp - 50) -
            28.0852963507957 * log(g);
        b = 255;
    }
    return [r, g, b, 1];
};

/*
 * Based on implementation by Neil Bartlett
 * https://github.com/neilbartlett/color-temperature
 **/

const { round } = Math;

const rgb2temperature = (...args) => {
    const rgb = unpack(args, 'rgb');
    const r = rgb[0],
        b = rgb[2];
    let minTemp = 1000;
    let maxTemp = 40000;
    const eps = 0.4;
    let temp;
    while (maxTemp - minTemp > eps) {
        temp = (maxTemp + minTemp) * 0.5;
        const rgb = temperature2rgb(temp);
        if (rgb[2] / rgb[0] >= b / r) {
            maxTemp = temp;
        } else {
            minTemp = temp;
        }
    }
    return round(temp);
};

Color.prototype.temp =
    Color.prototype.kelvin =
    Color.prototype.temperature =
        function () {
            return rgb2temperature(this._rgb);
        };

const temp = (...args) => new Color(...args, 'temp');
Object.assign(chroma, { temp, kelvin: temp, temperature: temp });

input.format.temp =
    input.format.kelvin =
    input.format.temperature =
        temperature2rgb;

Color.prototype.oklch = function () {
    return rgb2oklch(this._rgb);
};

const oklch = (...args) => new Color(...args, 'oklch');
Object.assign(chroma, { oklch });

input.format.oklch = oklch2rgb;

input.autodetect.push({
    p: 2,
    test: (...args) => {
        args = unpack(args, 'oklch');
        if (type(args) === 'array' && args.length === 3) {
            return 'oklch';
        }
    }
});

// feel free to comment out anything to rollup
// a smaller chroma.js bundle

Object.assign(chroma, {
    analyze,
    average,
    bezier: bezier$1,
    blend,
    brewer: colorbrewerProxy,
    Color,
    colors: w3cx11,
    contrast,
    contrastAPCA,
    cubehelix,
    deltaE,
    distance,
    input,
    interpolate: mix,
    limits,
    mix,
    random: random$1,
    scale,
    scales,
    valid
});

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
 * Copyright (c) 2026 Dániel Balla
*/


var LeafletisV1 = L.version.startsWith('1.');

var plugin_defaultOptions = {
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
        color: (LeafletisV1 ? L.Path.prototype.options.color : L.Path.defaultOptions.color),
        weight: (LeafletisV1 ? L.Path.prototype.options.weight : L.Path.defaultOptions.weight),
        radius: 8
    }
};

class DataClassification extends L.GeoJSON {
    static defaultOptions = plugin_defaultOptions;

    constructor(data, options) {
        super(data, options);
        L.Util.setOptions(this, options);
        
        // variables for layer scope
        this._legend;
        this._classes = [];
        this._colors = [];
        this._radiuses = [];
        this._widths = [];
        this._pointMarkers = [];
        this._hatchclasses = [];
        this._unitMod = {};
        this._field = '';
        this._normalizeByField = '';
        this._pointShape = '';
        this._linecolor = '';
        this._lineweight = '';
        this._legendPos = '';
        this._legendTemplate = {};
        this._noDataFound = false;
        this._noDataIgnore = false;
        this._noDataColor = '';
        this._attributeFieldExistsButAllFeaturesAreNull = true; // assume by default, this flag is used to handle the special case when all attributes are null in given field

        this._log('Plugin initialized...');
        this._log('Options:', this.options);
        this._field = this.options.field;
        this._normalizeByField = this.options.normalizeByField;

        // timing init
        this._timerGlobalStart = Date.now();
        this._timerGlobalEnd = Date.now();
        this._timerLoadValuesStart;
        this._timerLoadValuesEnd;
        this._timerNormalizationStart;
        this._timerNormalizationEnd;
        this._timerClsfStart;
        this._timerClsfEnd;
        this._timerGenColorsStart;
        this._timerGenColorsEnd;
        this._timerGenRangesStart;
        this._timerGenRangesEnd;
        this._timerLegendStart;
        this._timerLegendEnd;
        this._timerSymbologyStart;
        this._timerSymbologyEnd;

        this._classify();
    }


    // value evaluators to match classes
    /**
     * Value evaluator to match a color class (POINTS/COLOR, LINES/COLOR, POLYGON/COLOR modes). While evaluating, also counts the number of features in given class.
     * @param {float} d - Number to match a class to
     * @returns {string} Symbol color of the class
     */
    _getColor(d) {
        for (var i = 0; i<this._classes.length; i++) {
            if (this._classes[i+1] != null) {
                if (d < this._classes[i+1].value) {
                    //++this._classes[i].featureCount;
                    return this._colors[i];
                } 	
            }				
        }
        // highest group
        //++this._classes[this._classes.length-1].featureCount;
        return this._colors.at(-1);	
    }

    /**
     * Value evaluator to match a line width class (LINES/WIDTH mode). While evaluating, also counts the number of features in given class.
     * @param {float} d - Number to match a class to
     * @returns {float} Symbol width of the class
     */
    _getWeight(d) {
        for (var i = 0; i<this._classes.length; i++) {
            if (this._classes[i+1] != null) {
                if (d < this._classes[i+1].value) {
                    //++this._classes[i].featureCount;
                    return this._widths[i];
                } 					
            } 					
        }
        // highest group
        //++this._classes[this._classes.length-1].featureCount;
        return this._widths.at(-1);
    }

    /**
     * Value evaluator to match a point symbol size class (POINTS/SIZE mode). While evaluating, also counts the number of features in given class.
     * @param {float} d - Number to match a class to
     * @returns {float} Symbol radius of the class
     */
    _getRadius(d) {
        for (var i = 0; i<this._classes.length; i++) {
            if (this._classes[i+1] != null) {
                if (d < this._classes[i+1].value) {
                    //++this._classes[i].featureCount;
                    return this._radiuses[i];
                }
            }
        }
        // highest group
        //++this._classes[this._classes.length-1].featureCount;
        return this._radiuses.at(-1);
    }

    /**
     * Value evaluator to match a polygon hatch fill symbol class (POLYGONS/HATCH mode). While evaluating, also counts the number of features in given class.
     * @param {float} d - Number to match a class to
     * @returns {string} Symbol hatch fill pattern CSS class name
     */
    _getHatch(d) {
        for (var i = 0; i<this._classes.length; i++) {
            if (this._classes[i+1] != null) {
                if (d < this._classes[i+1].value) {
                    //++this._classes[i].featureCount;
                    return this._hatchclasses[i];
                }
            }
        }
        // highest group
        //++this._classes[this._classes.length-1].featureCount;
        return this._hatchclasses.at(-1);
    }

    // stylers
    /**
     * Feature styler for point/color mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @returns {object} Final symbol style of the feature
     */
    _stylePoint_color = (value, options) => {
        return {
            fillColor: (value != null ? this._getColor(value) : options.noDataColor),
            fillOpacity: 1,
            color: "black",
            weight: 1,
            shape: "circle",
            radius: options.style.radius
        };
    }

    /**
     * Feature styler for point/size mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @param {object} options - Custom styling (see the `style` option)
     * @returns {object} Final symbol style of the feature
     */
    _stylePoint_size = (value, options) => {
        return {
            fillColor: (value != null ? (options.style.fillColor != null ? options.style.fillColor : 'orange') : options.noDataColor),
            fillOpacity: 1,
            color: "black",
            weight: 1,
            shape: "circle",
            radius: (value != null ? this._getRadius(value) : Math.min.apply(Math, this._radiuses))
        };
    }

    /**
     * Feature styler for line/color mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @returns {object} Final symbol style of the feature
     */
    _styleLine_color = (value, options) => {
        return {
            color: (value != null ? this._getColor(value) : options.noDataColor)
        };
    }

    /**
     * Feature styler for line/width mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @param {object} options - Custom styling (see the `style` option)
     * @returns {object} Final symbol style of the feature
     */
    _styleLine_width = (value, options) => {
        return {
            weight: (value != null ? this._getWeight(value) : Math.min.apply(Math, this._widths)),
            //color: (value != null ? (options.style.color != null ? options.style.color : (L.Path.defaultOptions.color ?? L.Path.prototype.options.color)) : options.noDataColor)
            color: (value != null ? (options.style.color != null ? options.style.color : (LeafletisV1 ? L.Path.prototype.options.color : L.Path.defaultOptions.color)) : options.noDataColor)
        };
    }

    /**
     * Feature styler for polygon/color mode.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @param {object} options - Custom styling (see the `style` option)
     * @returns {object} Final symbol style of the feature
     */
    _stylePolygon_color = (value, options) => {
        return {
            fillColor: (value != null ? this._getColor(value) : options.noDataColor),
            fillOpacity: (options.style.fillOpacity != null ? options.style.fillOpacity : 0.7),
            /*color: 'white',
            weight: 2*/
        };
    }

    /**
     * Feature styler for polygon/hatch mode. Different to the other feature styler, since this returns a formatted string which is then used for the `fill` CSS property.
     * @param {float} value - Attribute (number), based on which we classify the feature
     * @param {object} options - Custom styling (basically just the `noDataColor` option)
     * @returns {string} Final symbol style of the feature (as a string, which is used for CSS-`fill` later.)
     */
    _stylePolygon_hatch = (value, options) => {
        var style;
        if (value != null) {
            style = 'url(#' + this._getHatch(value) + ')';
        } else {
            style = options.noDataColor;
        }
        return style;
    }
    
    // get n categories of point radiuses, line widths for symbology
    /**
     * Generates a range of symbol sizes for point/size mode. Fills up global array `radiuses[]`.
     * @param {Object} sizes - Symbol size information
     * @param {float} sizes.min - Minimum symbol size, radius (symbol of the lowest class)
     * @param {float} sizes.max - Maximum symbol size, radius (symbol of the highest class)
     */
    _pointMode_size_radiuses(sizes){
        this._radiuses = [];
        
        var step = (sizes.max - sizes.min) / (this._classes.length - 1);
        for (var i = 0; i < this._classes.length; i++) {
            var curr = sizes.min + (step * i);
            this._radiuses.push(curr);
        }
        this._log('points: radius categories:', this._radiuses);
    }

    /**
     * Generates a range of symbol sizes for line/width mode. Fills up global array `widths[]`.
     * @param {Object} sizes - Symbol size information
     * @param {float} sizes.min - Minimum symbol size, width (symbol of the lowest class)
     * @param {float} sizes.max - Maximum symbol size, width (symbol of the highest class)
     */
    _lineMode_width(sizes){
        this._widths = [];
        
        var step = (sizes.max - sizes.min) / (this._classes.length - 1);
        for (var i = 0; i < this._classes.length; i++) {
            this._widths.push(sizes.min + (step * i));
        }
        this._log('lines: width categories:', this._widths);
    }

    _polygonMode_hatch(options){
        if (options.strokeColors != null && options.strokeColors.length != 2) {
            console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Currently, polygonMode "hatch" requires exactly two colors to alternate lines between. Check the `polygonHatch.strokeColors` property. Working example: ["red", "orange"] or ["red", "none"]');
            return;
        }
        //var hatchclasses = [];
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
        }        (options.distinctionMode != null ? '' : options.distinctionMode = 'both');
        (options.strokeColors != null ? '' : options.strokeColors = ['darkred', 'none']);
        (options.angle != null ? angle = options.angle : angle = 45);
        (options.alternateAngle != null ? altAng = options.alternateAngle : altAng = 45);
        var step = (swMax - swMin) / (this._classes.length - 1);

        switch (options.distinctionMode) {
            case 'width':
                this._log('hatch distinction mode: `width`');
                for (var i = 0; i < this._classes.length; i++) {
                    this._log('current hatch class line widths: swMin:', swMin, 'swMax:', swMax);
                    this._hatchclasses.push(L.hatchClass([{ color: options.strokeColors[0], width: swMax }, { color: options.strokeColors[1], width: swMin }], null, angle));
                    swMin += step;
                    swMax -= step;
                }
                break;
            case 'angle':
                this._log('hatch distinction mode: `angle`');
                // the total hatch pattern rotation range from the bottom class to the top. If this exceeds 180 + altAng, repeated symbols might occur.
                var totalRotation = this._classes.length * altAng;
                if (totalRotation >= (180 + altAng)) {
                    console.warn(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'With your current `polygonHatch.alternateAngle` (', altAng, ') and `classes` (', this._classes.length, ') settings, the total hatch pattern symbol rotation exceeds 180 degrees across all classes, therefore classes might share very similar or matching symbols. Double-check that your symbols are visibly different and distinguishable. Consider lowering the number of your classes, or adjust the `alternateAngle` setting.');
                }
                if (altAng == 0) {
                    console.warn(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'You are using hatch distinction mode: `angle`. Since this mode is supposed to only alter hatch stroke angle between class symbols, and option `alternateAngle` was set to 0, you would not be able to distinguish the classes. Overridden value with 45.');
                    altAng = 45;
                }
                if (95 >= altAng && altAng >= 85 || 185 >= altAng && altAng >= 175 || 275 >= altAng && altAng >= 265) {
                    console.warn(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'In this mode (`angle`), alternating strokes with angle values around pi/2 (90), pi (180), 3pi/2 (270) result in very similar or same hatch fill symbols. Consider adjusting hatch angle to ~45°.');
                }
                if (swMax < 1 || swMin < 1) {
                    console.warn(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'In this mode (`angle`), using a stroke width of 1 or smaller, for either `polygonHatch.strokeWidth.min` or `.max`, would result in indistinguishable hatch patterns. Overridden value with defaults, so that the map remains comprehensible.');
                    swMax = 10;
                    swMin = 2;
                }
                for (var i = 0; i < this._classes.length; i++) {
                    this._hatchclasses.push(L.hatchClass([{ color: options.strokeColors[0], width: swMax }, { color: options.strokeColors[1], width: swMin }], null, (altAng != 0 ? angle+altAng*i : angle)));
                }
                break;
            case 'both':
                this._log('hatch distinction mode: `both`');
                if (altAng == 0) {
                    console.warn(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', "You are using hatch distinction mode: `both`. Since this mode is supposed to alter both hatch stroke angle and width between class symbols, and option `alternateAngle` was set to 0, you wouldn't see any difference in stroke angle (and therefore could just simply use mode `width`). Overridden value with 45.");
                    altAng = 45;
                }
                for (var i = 0; i < this._classes.length; i++) {
                    this._log('current hatch class line widths: swMin:', swMin, 'swMax:', swMax);
                    this._hatchclasses.push(L.hatchClass([{ color: options.strokeColors[0], width: swMax }, { color: options.strokeColors[1], width: swMin }], null, (altAng != 0 ? angle+altAng*i : angle)));
                    swMin += step;
                    swMax -= step;
                }
                break;
        }
        this._hatchclasses.reverse();
        this._log('polygons: hatchclasses:', this._hatchclasses);
    }

    /**
     * SVG creator. This creates symbols for the point/size and point/color modes.
     * @param {Object} options Options for the SVG to be created
     * @param {('circle'|'square'|'diamond')} options.shape Choose from circle, square, diamond shapes for symbol
     * @param {string} options.color Fill color of the symbol
     * @param {number} options.size Size of the symbol
     * @returns {string} Final HTML-formatted SVG symbol as string.
     */
    _svgCreator = (options) => {
        (options.shape == null ? options.shape = 'circle' : '');			// default shape
        (options.size == null ? options.size = 8 : '');						// default size
        var strokeWidth = 1;
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute('style', 'display: block'); // affects only svgs less than 14x14px in size, otherwise those are misplaced on marker: https://stackoverflow.com/questions/75342672/leaflet-small-divicons-less-than-14px-do-not-align-at-center-of-point
        svg.setAttribute('width', Math.ceil((options.size+strokeWidth)*2));
        svg.setAttribute('height', Math.ceil((options.size+strokeWidth)*2));
        svg.setAttribute('stroke', 'black');
        svg.setAttribute('stroke-width', strokeWidth);

        // check if user given shape is valid, if not, fall back to a simple circle
        var acceptedshapes = ['circle', 'square', 'diamond'];
        if (acceptedshapes.indexOf(options.shape.toLowerCase()) === -1) {
            console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', `Invalid shape given ("${options.shape}"). Choose one of the following: circle, square, diamond. Falling back to a circle.`);
            options.shape = 'circle';
        }

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
                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', `_svgCreator(): Invalid shape given ("${options.shape}"). Choose one of the following: circle, square, diamond. SVG not generated.`);
                break;
        }
        return svg;
    }

    /**
     * Does a one-time conversion of classes array to an array of objects (from now on, access class boundary value by classes[i].value).
     */
    _convertClassesToObjects() {
        this._classes = this._classes.map(function(element, idx) {
            return {
                value: element,
                featureCount: 0
            }
        });
        this._log('Global array of class boundaries has been converted to an array of objects (access class boundary value by classes[i].value) and features were counted! New classes: ', this._classes);
    }

    /**
     * Recommends an optimal "classRounding" parameter in a console message, when it was set too extreme. Basically the reverse of function _classPostProc_rounding().
     * @param {integer} num - "classRounding" parameter set by user
     * @returns {integer} Optimal "classRounding" parameter to use. Goes out in a console warning later.
     */
    _classPostProc_roundinghelper(num) {
        // This recommends an optimal "classRounding" parameter in a console message, when it was set too high. Basically the reverse of function _classPostProc_rounding().
        var i = 1;
        do {
            i = i*10;
        } while (num > i)
        return (Math.log10(i)*-1)+2;
    }

    _classPostProc_rounding(n) { 
        if (n >= 0) {
            // rounding to decimals using toFixed(), store string in classes object
            for (var i=0; i<this._classes.length; i++) {
                this._classes[i].value = +this._classes[i].value.toFixed(n);
            }
            this._log('Class interval boundary values have been rounded to', n, 'decimal(s). New classes:', this._classes);
        } else {
            // rounding up/down to 10s, 100s, 1000s etc.
            if (Math.max.apply(Math, this._classes.map(item => item.value)) < Math.pow(10,Math.abs(n))) {
                // check if the highest class boundary value is higher than the requested nearest value 
                // (requested -3, so 1000, while the maximum value is 386.2 - this would yield useless rounded values for classes, with ~all classes between 0 and 0.)
                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Class interval boundary rounding error: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + 
                ') is larger than the highest class boundary value (' + Math.max.apply(Math, this._classes.map(item => item.value)) + '). Class intervals were untouched. Fix this by adjusting the "classRounding" option to ' 
                + this._classPostProc_roundinghelper(Math.max.apply(Math, this._classes.map(item => item.value))) + ' (optimal).');                
                return;
            }
            if (Math.max.apply(Math, this._classes.map(item => item.value)) < Math.pow(10,Math.abs(n-1))) {
                // the highest class boundary value vs. requested nearest value being high enough might cause problems (lowest class does not belong to any features etc.).
                console.warn(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Class interval boundary rounding warning: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + ') might result in weird class boundaries and/or in the lowest class not belonging to any features on the map (class empty). Make sure the visualized data is correct on the map, otherwise, fix this by adjusting the "classRounding" option to ' + parseInt(n+1) + '.');
            }
            if (Math.round(this._classes[1].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n)) == Math.round(this._classes[2].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n))) {
                // check if the lowest and lowest+1 class boundary would be the same after rounding
                // (requested -1, so 10, with lowest class boundaries being 7.32 and 10.4 - since these both would get rounded to 10, this would yield a class that is defined between 10 and 10.)
                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Class interval boundary rounding error: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + 
                ') might yield empty classes or classes with the same boundaries after rounding. Class intervals were untouched. Fix this by adjusting the "classRounding" option to ' 
                + parseInt(this._classPostProc_roundinghelper(this._classes[1].value)-1) + ' (optimal).');       
                return;
            }
            if (this._classes[1].value < Math.pow(10,Math.abs(n+1))) {
                // check if the lowest class boundary value is smaller than the requested nearest value 
                // (requested -2, so 100, while the upper value of the lowest class boundary is 7.32 - since this would get rounded to 0, this would yield useless rounded values for classes, with classes between 0 and 0 and similar.)
                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Class interval boundary rounding error: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + 
                ') is larger than the lowest class boundary value (' + this._classes[1].value + '). Class intervals were untouched. Fix this by adjusting the "classRounding" option to ' 
                + parseInt(this._classPostProc_roundinghelper(this._classes[1].value)-2) + ' (optimal).');       
                return;
            }
            for (var i=1; i<this._classes.length; i++) {
                // Lowest/highest class boundary value gets rounded up/down here, respectively. Done to avoid features with extreme attr. values
                // (which should fall in the lowest/highest classes) falling in the 2nd lowest/highest class upon rounding.
                if (i+1 == this._classes.length) {
                    // highest class, round down at all times
                    if (n >= this._classPostProc_roundinghelper(Math.max.apply(Math, this._classes.map(item => item.value))) ) {
                        this._classes[i].value = Math.floor(this._classes[i].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n)); 
                    }
                } else if (i == 1) {
                    if (n >= this._classPostProc_roundinghelper(this._classes[this._classes.length-1].value) ) {
                        // lowest class handling to make sure it does not stay empty or same as lowest+1, after rounding
                        var rounded_round = Math.round(this._classes[i].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n)); 
                        var rounded_ip1_round = Math.round(this._classes[i+1].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n)); 
                        if (rounded_round <= this._classes[0].value || rounded_round == rounded_ip1_round){
                            console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Class interval boundary rounding error: requested nearest value (' + n + ', so rounding to the nearest ' + Math.pow(10,Math.abs(n)) + 
                            ') might yield empty classes or classes with the same boundaries after rounding the lowest two class boundaries (' + classes[1].value + ' and ' + classes[2].value+'). Class intervals were untouched. Fix this by adjusting the "classRounding" option to ' 
                            + parseInt(this._classPostProc_roundinghelper(this._classes[1].value)-1) + ' (optimal).'); 
                            return;
                        } else {   
                            this._classes[i].value = rounded_round; 
                        }
                    }
                } else {
                    // midway classes
                    this._classes[i].value = Math.round(this._classes[i].value/Math.pow(10,Math.abs(n)))*Math.pow(10,Math.abs(n)); // round(number/100)*100 to round up/down to nearest 100 value
                }
            }
            this._log('Class interval boundary values have been rounded to the nearest', Math.pow(10,Math.abs(n)), 'values. New class boundary values:', this._classes);
        }
    }

    _legendPostProc_unitModifier(options) {
        // This processes the final class boundary values in order to multiply/divide them as wished. Purely visual, only affects legend. 
        // (useful when a dataset attribute is in metres, but kilometres would fit the legend better, for example 786000 metres as 786 km).
        // Note: runs after classRounding(). Called inside _generatelegend(). It DOES change the main classes[] array elements, but since legend generation is the last step in the whole process, it's OK (for now).
        switch (options.action) {
            case 'multiply':
                for (var i = 0; i<this._classes.length; i++) {
                    this._log('MULTIPLY', this._classes[i].valueFormatted, 'by', options.by);
                    this._classes[i].valueFormattedForLegend = this._classes[i].valueFormattedForLegend * options.by;
                }
                break;
            case 'divide':
                for (var i = 0; i<this._classes.length; i++) {
                    this._log('DIVIDE', this._classes[i].value, 'by', options.by);  
                    this._classes[i].valueFormattedForLegend = this._classes[i].valueFormattedForLegend / options.by;                  
                }
                break;
            default:
                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Invalid action for "unitModifier". Choose one of the following: "multiply", "divide".');
        }
        return;         
    }

    _legendRowFormatter(low, high, i) { 
        var template = this._legendTemplate;
        // solve row based on the 3 row templates
        if (i == this._classes.length) {
            // highest
            let solved_high = template.highest.replace(/({high})/i, high);
            solved_high = solved_high.replace(/({low})/i, low);
            solved_high = solved_high.replace(/({count})/i, this._classes[this._classes.length-1].featureCount);
            return solved_high;
        } else if (i == 1) {
            // lowest
            let solved_low = template.lowest.replace(/({high})/i, high);
            solved_low = solved_low.replace(/({low})/i, low);
            solved_low = solved_low.replace(/({count})/i, this._classes[i-1].featureCount);
            return solved_low;
        } else {
            // middle
            let solved_mid = template.middle.replace(/({high})/i, high);
            solved_mid = solved_mid.replace(/({low})/i, low);
            solved_mid = solved_mid.replace(/({count})/i, this._classes[i-1].featureCount);
            return solved_mid;
        }    }

    _generateLegendContent = ({title, asc, mode_line, mode_point, mode_polygon, typeOfFeatures, footer, classes, mode, rowgap, prad, pfc, lc, lw, lt_formattedNoData}) => {
            var div = L.DomUtil.create('div', 'info legend');

            var nodatafound = this._noDataFound;
            var nodatacolor = this._noDataColor;
            var nodataignore = this._noDataIgnore;
            var nodatarow;

            // legend title:
            if (title != null && title != '') {
                var titlediv = L.DomUtil.create('div', 'legendtitle');
                titlediv.innerHTML += title;
                div.appendChild(titlediv);
            }

            // legenditems container (symbology)
            var container = L.DomUtil.create('div', 'symbology');
            if (rowgap != null) {
                if (typeof rowgap === 'number') {
                    container.style['row-gap'] = rowgap+'px';
                } else {
                    container.style['row-gap'] = rowgap;
                }
                (rowgap > 5 && titlediv != null ? container.style['margin-top'] = rowgap+'px' : '');  // If symbology row-gap is higher than 5, it looks better if title gets linearly distanced as well. Title div margin-bottom is 5 by default, we don't go lower than that. 
            }            
            // symbology div fillup:
            if (typeOfFeatures == "MultiPoint" || typeOfFeatures == "Point") {
                // points
                switch (mode_point) {
                    case 'color':
                    // color based categories
                        for (var i = classes.length; i > 0; i--) {
                            //this._log('Legend: building line', i)
                            let low, high;
                            switch (mode) {
                                case 'stddeviation':
                                    low = classes[i-1].stddev_lower;
                                    high = (classes[i] != null ? classes[i].stddev_lower : '');
                                    break;
                                default:
                                    low = classes[i-1].valueFormattedForLegend;
                                    high = (classes[i] != null ? classes[i].valueFormattedForLegend : '');
                                    break;
                            }
                            container.innerHTML +=
                                `<div class="legendDataRow legendVarSizeDataRow">
                                    ${this._svgCreator({shape: this._pointShape, color: this._colors[i-1], size: prad}).outerHTML}
                                    <div>${this._legendRowFormatter(low, high, i)}</div>
                                </div>`;
                        }
                        if (nodatafound && !nodataignore) {
                            nodatarow = L.DomUtil.create('div', 'legendDataRow');
                            nodatarow.classList.add('legendVarSizeDataRow');
                            nodatarow.innerHTML += 
                                `${this._svgCreator({shape: this._pointShape, color: nodatacolor, size: prad}).outerHTML}
                                <div>${lt_formattedNoData}</div>`;
                            container.appendChild(nodatarow);
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
                                    low = classes[i-1].valueFormattedForLegend;
                                    high = (classes[i] != null ? classes[i].valueFormattedForLegend : '');
                                    break;
                            }
                            
                            // Changed in v1.6.1, since the symbol SVGs no longer have a fixed 25x25/30x30 svg size,
                            // but only a size that encapsulates the symbol itself (therefore those SVGs no longer can be insert as they are).
                            // The following X/Y shift is only for use in the legend, creating a uniform 30x30 svg canvas for legend symbols:
                            var symbol = this._svgCreator({shape: this._pointShape, size: this._radiuses[i-1], color: pfc});
                            var origHeight = symbol.getAttribute('height');
                            var origWidth = symbol.getAttribute('width');
                            var shiftX = (30-origWidth)/2;
                            var shiftY = (30-origHeight)/2;
                            symbol.setAttribute('height', 30);
                            symbol.setAttribute('width', 30);
                            if (symbol.children[0] != null) {
                                symbol.children[0].setAttribute('style', 'transform: translateX('+shiftX+'px) translateY('+shiftY+'px)');
                            } else {
                                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'There was an error when generating SVG: SVG does not have any children elements');
                            }

                            // generate row with symbol
                            container.innerHTML += 
                                `<div class="legendDataRow legendVarSizeDataRow">
                                    ${symbol.outerHTML}
                                    <div>${this._legendRowFormatter(low, high, i)}</div>
                                </div>`;
                        }
                        if (nodatafound && !nodataignore) {
                            nodatarow = L.DomUtil.create('div', 'legendDataRow');
                            nodatarow.classList.add('legendVarSizeDataRow');
                            var NDsymbol = this._svgCreator({shape: this._pointShape, size: Math.min.apply(Math, this._radiuses), color: nodatacolor});
                            var origHeight = NDsymbol.getAttribute('height');
                            var origWidth = NDsymbol.getAttribute('width');
                            var shiftX = (30-origWidth)/2;
                            var shiftY = (30-origHeight)/2;
                            NDsymbol.setAttribute('height', 30);
                            NDsymbol.setAttribute('width', 30);
                            NDsymbol.children[0].setAttribute('style', 'transform: translateX('+shiftX+'px) translateY('+shiftY+'px)');
                            nodatarow.innerHTML +=
                                `${NDsymbol.outerHTML}
                                <div>${lt_formattedNoData}</div>`;
                            container.appendChild(nodatarow);
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
                                    //this._log('Legend: building line', i)
                                    low = classes[i-1].valueFormattedForLegend;
                                    high = (classes[i] != null ? classes[i].valueFormattedForLegend : '');
                                    break;
                            }

                            container.innerHTML +=
                                `<div class="legendDataRow">
                                    <svg width="25" height="25" viewBox="0 0 25 25">
                                        <line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: ${lw}; stroke: ${this._colors[i-1]};"/>
                                    </svg>
                                    <div>${this._legendRowFormatter(low, high, i)}</div>
                                </div>`;
                        }
                        if (nodatafound && !nodataignore) {
                            nodatarow = L.DomUtil.create('div', 'legendDataRow');
                            nodatarow.innerHTML +=
                                `<svg width="25" height="25" viewBox="0 0 25 25">
                                    <line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: ${lw}; stroke: ${nodatacolor};"/>
                                </svg>
                                <div>${lt_formattedNoData}</div>`;
                            container.appendChild(nodatarow);
                        }
                        break;
                    case 'width':
                    // width based categories
                        for (var i = classes.length; i > 0; i--) {
                            //this._log('Legend: building line', i)
                            let low, high;
                            switch (mode) {
                                case 'stddeviation':
                                    low = classes[i-1].stddev_lower;
                                    high = (classes[i] != null ? classes[i].stddev_lower : '');
                                    break;
                                default:
                                    low = classes[i-1].valueFormattedForLegend;
                                    high = (classes[i] != null ? classes[i].valueFormattedForLegend : '');
                                    break;
                            }
                            container.innerHTML +=
                                `<div class="legendDataRow">
                                    <svg width="25" height="25" viewBox="0 0 25 25">
                                        <line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: ${this._widths[i-1]}; stroke: ${lc};"/>
                                    </svg>
                                    <div>${this._legendRowFormatter(low, high, i)}</div>
                                </div>`;
                        }
                        if (nodatafound && !nodataignore) {
                            nodatarow = L.DomUtil.create('div', 'legendDataRow');
                            nodatarow.innerHTML +=
                                `<svg width="25" height="25" viewBox="0 0 25 25">
                                    <line x1="0" y1="12.5" x2="25" y2="12.5" style="stroke-width: ${lw}; stroke: ${nodatacolor};"/>
                                </svg>
                                <div>${lt_formattedNoData}</div>`;
                            container.appendChild(nodatarow);
                        }
                        break;
                }
            } else {
                let opacity = (this.options.style.fillOpacity ? this.options.style.fillOpacity : 0.7);
                // polygons
                switch (mode_polygon) {
                    case 'color':
                        for (var i = classes.length; i > 0; i--) {
                            //this._log('Legend: building line', i)
                            let low, high;
                            switch (mode) {
                                case 'stddeviation':
                                    low = classes[i-1].stddev_lower;
                                    high = (classes[i] != null ? classes[i].stddev_lower : '');
                                    break;
                                default:
                                    low = classes[i-1].valueFormattedForLegend;
                                    high = (classes[i] != null ? classes[i].valueFormattedForLegend : '');
                                    break;
                            }
                            container.innerHTML +=
                                `<div class="legendDataRow">
                                    <i style="background: ${this._colors[i-1]}; opacity: ${opacity}"></i>
                                    <div>${this._legendRowFormatter(low, high, i)}</div>
                                </div>`;
                        }
                        if (nodatafound && !nodataignore) {
                            nodatarow = L.DomUtil.create('div', 'legendDataRow');
                            nodatarow.innerHTML +=
                                `<i style="background: ${nodatacolor}; opacity: ${opacity}"></i>
                                <div>${lt_formattedNoData}</div>`;
                            container.appendChild(nodatarow);
                        }
                        break;
                    case 'hatch':
                        for (var i = classes.length; i > 0; i--) {
                            //this._log('Legend: building line', i)
                            let low, high;
                            switch (mode) {
                                case 'stddeviation':
                                    low = classes[i-1].stddev_lower;
                                    high = (classes[i] != null ? classes[i].stddev_lower : '');
                                    break;
                                default:
                                    low = classes[i-1].valueFormattedForLegend;
                                    high = (classes[i] != null ? classes[i].valueFormattedForLegend : '');
                                    break;
                            }
                            container.innerHTML +=
                                `<div class="legendDataRow">
                                    <svg class="hatchPatch">
                                        <rect fill="url(#${this._hatchclasses[i-1]})" fill-opacity="${opacity}" x="0" y="0" width="100%" height="100%"></rect>
                                    </svg>
                                    <div>${this._legendRowFormatter(low, high, i)}</div>
                                </div>`;
                        }
                        if (nodatafound && !nodataignore) {
                            nodatarow = L.DomUtil.create('div', 'legendDataRow');
                            nodatarow.innerHTML +=
                                `<svg class="hatchPatch"><rect fill="${nodatacolor}" fill-opacity="${opacity}" x="0" y="0" width="100%" height="100%"></rect></svg>
                                <div>${lt_formattedNoData}</div>`;
                            container.appendChild(nodatarow);
                        }
                        break;
                }
            }
            // in ascending legend mode: reverse legend row order by reversing flex-direction
            if (asc) {
                container.classList.add('reverseOrder');
                // move nodata row to the bottom after legend reversal
                if (nodatarow) {
                    nodatarow.classList.add('legendAscNodata');
                }
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
    }

    _generateLegend = (title, asc, mode_line, mode_point, mode_polygon, typeOfFeatures, footer, classes, mode) => {
        this._timerLegendStart = Date.now();
        var unitMod_options = this._unitMod;
        var position = this._legendPos;
        this._pointShape;
        var lc = (this._linecolor != null ? this._linecolor : (LeafletisV1 ? L.Path.prototype.options.color : L.Path.defaultOptions.color));
        var lw = this._lineweight;
        var rowgap = this.options.legendRowGap;
        var lt = this._legendTemplate;
        // format nodata row. Necessary for supporting {count} in that legend class row.
        if (this._classes.nodataFeatureCount > 0) {
            var lt_formattedNoData = lt.nodata.replace(/({count})/i, this._classes.nodataFeatureCount);
        }        var prad = (this.options.style.radius != null ? this.options.style.radius : 8);
        var pfc = (this.options.style.fillColor != null ? this.options.style.fillColor : 'orange');


        // unitModifier process:
        if (unitMod_options != null) {
            if (unitMod_options.hasOwnProperty('action') && unitMod_options.action != null && typeof unitMod_options.action == "string" && unitMod_options.hasOwnProperty('by') && unitMod_options.by != null && typeof unitMod_options.by == "number") { 
                this._legendPostProc_unitModifier(unitMod_options);
            } else {
                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Missing/invalid options for "unitModifier". Try `unitModifier: {action: "multiply", number: 1000}`. Class values in legend were not affected.');
            }        }

        // make sure legendPosition option is valid, if not, revert to default
        if(!['topleft', 'topright', 'bottomleft', 'bottomright'].includes(position)) {
            console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Invalid legendPosition. Choose one of the following: "bottomleft", "bottomright", "topleft", "topright". Overriding with default ("bottomleft").');
            position = 'bottomleft';
        }

        var legend = new LegendControl({position: position}, {title, asc, mode_line, mode_point, mode_polygon, typeOfFeatures, footer, classes, mode, rowgap, prad, pfc, lc, lw, lt_formattedNoData}, this);

        legend.id = this._leaflet_id;
        this._legend = legend;
        
        this._log('Legend generated:', title);

        this._timerLegendEnd = Date.now();
    }

    _classify(data) {

        this._field = this.options.field;
        this._normalizeByField = this.options.normalizeByField;
        this._nodata = this._noDataFound;
        this._nodataignore = this.options.noDataIgnore;
        var features_info = { Point: 0, MultiPoint: 0, LineString: 0, MultiLineString: 0, Polygon: 0, MultiPolygon: 0};
        var typeOfFeatures = 'unknown';
        var features = [];

        this._timerLoadValuesStart = Date.now();
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
            }            // feature attribute value extraction to array
            if (!layer.feature.properties.hasOwnProperty(this._field)) {
                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Attribute field "'+this._field+'" does not exist in given GeoJSON. Please note that attribute field input is case-sensitve. Available attribute fields: '+JSON.stringify(layer.feature.properties));
                return;
            } 
            if (this._normalizeByField != null && !layer.feature.properties.hasOwnProperty(this._normalizeByField)) {
                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Normalization attribute field "'+this._normalizeByField+'" does not exist in given GeoJSON. Please note that attribute field input is case-sensitve. Either choose one of the available fields, or omit the option `normalizeByField`. Available attribute fields: '+JSON.stringify(layer.feature.properties));
                return;
            } 
            /*if (typeof layer.feature.properties[this._field] != 'number') {
                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Attribute field "'+this._field+'" does not contain quantitative values in given GeoJSON. Please note that attribute field input is case-sensitve. Available attribute fields: '+JSON.stringify(layer.feature.properties));
                return;
            } */
            if (layer.feature.properties[this._field] != null) {
                //values.push(layer.feature.properties[this._field]);
                features.push(layer.feature.properties);
                this._attributeFieldExistsButAllFeaturesAreNull = false;
            } else {    
                this._nodata = true;     // set flag for generateLegend() and code control later
                if (!this._nodataignore) {
                    // we add null values to main array
                    //values.push(layer.feature.properties[this._field]);
                    features.push(layer.feature.properties);
                }
                console.warn(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'A feature has NULL as attribute field "'+this._field+'" in given GeoJSON. If this is a valid nodata attribute, ignore this warning, the plugin will handle nodata features as a separate symbol class. Null found in feature: ', layer.feature);
            }        }, this);

        this._timerLoadValuesEnd = Date.now();

        if (this._attributeFieldExistsButAllFeaturesAreNull && this._nodataignore) {
            console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'The attribute field exists in GeoJSON, but no features have a value defined for it (all are NULL). Since you enabled `noDataIgnore`, nothing will be shown on the map. Automatically removing layer...');
            return;
        } else if (this._attributeFieldExistsButAllFeaturesAreNull) {
            console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'The attribute field exists in GeoJSON, but no features have a value defined for it (all are NULL). The map and legend will still be generated, but with a sole "No data" class.');
        }

        // extract feature type information from GeoJSON
        this._log('Feature types in GeoJSON:', features_info);
        typeOfFeatures = Object.keys(features_info).reduce((a, b) => features_info[a] > features_info[b] ? a : b);
        this._log('Dominant feature type in GeoJSON:', typeOfFeatures);

        this._log('Loaded values from GeoJSON (field: '+this._field+'):', features.map(a => a[this._field]));

        // options extract and checks
        var classnum = this.options.classes;
        if (classnum > 10) { console.warn(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', "Don't be silly, both map and legend will look incomprehensible. Overriding classnumber with 10."); classnum = 10; }        // mode (clsf. method name) aliases for ease of use
        var mode = this.options.mode;
        var aliases_stddev = ['stddeviation', 'stddev', 'sd', 's'];
        if (aliases_stddev.indexOf(mode.toLowerCase()) !== -1) {
            if (mode != 'stddeviation') {
                this._log(`Alias for 'stddeviation' found!: '${mode}'. Overridden with 'stddeviation'`);
                mode = 'stddeviation';
            }            
        }
        var aliases_log = ['logarithmic', 'log'];
        if (aliases_log.indexOf(mode.toLowerCase()) !== -1) {
            if (mode != 'logarithmic') {
                this._log(`Alias for 'logarithmic' found!: '${mode}'. Overridden with 'logarithmic'`);
                mode = 'logarithmic';
            }            
        }
        var aliases_jenks = ['jenks', 'naturalbreaks', 'naturalbreaksjenks', 'jenksnaturalbreaks', 'jnb'];
        if (aliases_jenks.indexOf(mode.toLowerCase()) !== -1) {
            if (mode != 'jenks') {
                this._log(`Alias for 'jenks' found!: '${mode}'. Overridden with 'jenks'`);
                mode = 'jenks';
            }            
        }
        var aliases_equalinterval = ['equalinterval', 'equalintervals', 'ei'];
        if (aliases_equalinterval.indexOf(mode.toLowerCase()) !== -1) {
            if (mode != 'equalinterval') {
                this._log(`Alias for 'equalinterval' found!: '${mode}'. Overridden with 'equalinterval'`);
                mode = 'equalinterval';
            }            
        }
        var aliases_quantile = ['quantile', 'q'];
        if (aliases_quantile.indexOf(mode.toLowerCase()) !== -1) {
            if (mode != 'quantile') {
                this._log(`Alias for 'quantile' found!: '${mode}'. Overridden with 'quantile'`);
                mode = 'quantile';
            }            
        }
        var mode_point = this.options.pointMode;
        var pointSize = this.options.pointSize;
        this._pointShape = this.options.pointShape;
        var mode_line = this.options.lineMode;
        var mode_polygon = this.options.polygonMode;
        var lineWidth = this.options.lineWidth;
        var polygonHatch = this.options.polygonHatch;
        var colorramp = this.options.colorRamp;
        var colorramp_rev = this.options.reverseColorRamp;
        var colorramp_custom = this.options.colorCustom;
        if (colorramp_custom != null ) {
            if (colorramp_custom.length == 1) {
                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Custom colors: only one color was set. At least 2 are required. Falling back to colorRamp.');
            } else {
                // if an array of at least 2 colors are set, use custom color ramp. Otherwise, fallback to colorramp.
                (colorramp_custom[0] == null || colorramp_custom[1] == null ? '' : colorramp = colorramp_custom);	
            }
        }
        var asc = (this.options.legendAscending != null ? this.options.legendAscending : false);
        var middlepoint = this.options.middlePointValue;
        var legendtitle;
        if (this.options.legendTitle == 'hidden') {
            legendtitle = '';                    
        } else {
            (this.options.legendTitle == '' ? legendtitle = this._field : legendtitle = this.options.legendTitle );
        }        var legendfooter;
        if (this.options.legendFooter == 'hidden' || this.options.legendFooter == '') {
            legendfooter = null;                    
        } else {
            legendfooter = this.options.legendFooter;
        }        var classrounding = this.options.classRounding;
        if (classrounding > 10) { // over 10
            console.warn("Don't be silly, by rounding class boundary values to 10+ decimal places the legend will look incomprehensible. Overriding classrounding with 0 (whole numbers) for now. Fix this by using a more sensible number for the 'classRounding' parameter (like 2), set it to zero to get whole numbers, or set it to negative numbers to round up/down to 10s (-1), 100s (-2), 1000s (-3), etc."); 
            classrounding = 0;
        }        //var pointfillcolor = this.options.style.fillColor;
        this._unitMod = this.options.unitModifier;
        this._legendPos = this.options.legendPosition;
        this._legendTemplate = this.options.legendTemplate;
        // fallback to default when user only specified one of the three custom templates
        if (!this._legendTemplate.hasOwnProperty('highest')) {this._legendTemplate.highest = '{low} <';}        if (!this._legendTemplate.hasOwnProperty('middle')) {this._legendTemplate.middle = '{low} – {high}';}        if (!this._legendTemplate.hasOwnProperty('lowest')) {this._legendTemplate.lowest = '< {high}';}        if (!this._legendTemplate.hasOwnProperty('nodata')) {this._legendTemplate.nodata = 'No data';}        this._noDataColor = this.options.noDataColor;
        this._noDataIgnore = this.options.noDataIgnore;
        this._noDataFound = this._nodata;

        // only do normalization, classification, rounding stuff if we have some actual values. Otherwise, everything that comes after (legend creation) can still happen, if user does not ignore nodata. It will result in a single "!"No data" class with a legend.
        if (!this._attributeFieldExistsButAllFeaturesAreNull) {

            // count how many features have an actual value in the given attribute field (not null)
            var valuesOnly = features.map(a => a[this._field]);
            var validFeatureCount = valuesOnly.filter(function(value) { return value !== null }).length;

            // data normalization, if user opted in to do so
            this._timerNormalizationStart = Date.now();
            features.forEach((arrayItem, index) => {
                if (this._normalizeByField != null && arrayItem[this._field] != null && arrayItem[this._normalizeByField] != null) {
                    arrayItem.finalvalue = arrayItem[this._field]/arrayItem[this._normalizeByField];
                } else {
                    arrayItem.finalvalue = arrayItem[this._field];
                }
            });
            this._timerNormalizationEnd = Date.now();

            this._features = features;
            if (this._normalizeByField != null) {
                this._log('Loaded values from GeoJSON field: "'+this._field+'", after normalization by field: "'+this._normalizeByField+'"', features.map(a => a.finalvalue));
            }	

            // if line color is overridden with L.Path style options, reflect that in Legend too
            if ((typeOfFeatures == 'LineString' || typeOfFeatures == 'MultiLineString')) {
                if (this.options.hasOwnProperty('style')) {
                    this._linecolor = this.options.style.color;
                    if (this.options.style.hasOwnProperty('weight')) {
                        this._lineweight = this.options.style.weight;
                    } else {
                        this._lineweight = (LeafletisV1 ? L.Path.prototype.options.weight : L.Path.defaultOptions.weight);     // fallback to Leaflet default
                    }
                } else {
                    this._linecolor = (LeafletisV1 ? L.Path.prototype.options.color : L.Path.defaultOptions.color);           // fallback to Leaflet default
                    this._lineweight = (LeafletisV1 ? L.Path.prototype.options.weight : L.Path.defaultOptions.weight);         // fallback to Leaflet default
                }
            }
            this._timerClsfStart = Date.now();
            // classification process
            var success = false;
            if (mode == 'manual') {
                this._log('Classification method: ', mode);
                this._log('Value for option "classes": ', classnum);
                if (!Array.isArray(classnum)) {
                    // the array is not an array
                    console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'When using `mode`: "manual", `classes` must be an array of class boundary values you wish to classify features into (for example `classes`: [50, 150, 300]). Classification error, stopped process.');
                    return;
                } else if (!classnum.every((element) => typeof element === 'number')) {
                    // the array has items that are not numbers
                    console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'When using `mode`: "manual", `classes` must only contain numbers. Classification error, stopped process.');
                    return;
                } else if (new Set(classnum).size != classnum.length) {
                    // the array contains duplicated boundary values
                    console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'When using `mode`: "manual", `classes` must only contain unique numbers to avoid empty classes. Classification error, stopped process.');
                    return;   
                } else if (classnum.length > validFeatureCount) {
                    // the array has more classes defined than the number of features that have a numerical value (we would have empty classes)
                    console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'When using `mode`: "manual", `classes` must define less classes than the count of features with a numeric value in attribute field (', validFeatureCount, '). Classification error, stopped process.');
                    return;                       
                } else {
                    // all seems good, lets sort and we have the final classes
                    classnum.sort(function(a, b) {
                        return a - b;
                    });
                    this._classes = classnum;
                    classnum = this._classes.length;
                }
            } else {
                if (Array.isArray(classnum)) {
                    console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'When using a classification `mode` other than "manual", `classes` option must be an integer, based on how many classes you want to generate (for example `classes`: 5). ');
                    console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Classification error, stopped process.');
                    return;
                }
            }
            var values = features.map(a => a.finalvalue);
            if (classnum > 2 && classnum <= validFeatureCount) {	
                switch (mode) {
                    case 'jenks':	
                        this._classes = jenks(values.filter((value) => value != null), classnum);
                        this._classes.pop(); // remove last, since its the max value
                        this._log('Jenks classes: ', this._classes);
                        this._convertClassesToObjects();
                        success = true;
                        break;
                    case 'equalinterval':
                        this._classes = [];
                        var minmax = extent(values.filter((value) => value != null));
                        this._log('EI: min:', minmax[0], ', max:', minmax[1]);
                        var range = minmax[1]-minmax[0];
                        this._log('EI data range:', range);
                        var oneclass = range/classnum;
                        this._log('EI one class:', oneclass);
                        for (var i=minmax[0]; i<minmax[1];) {
                            this._classes.push(i);
                            i = i + oneclass;
                        }
                        this._log('EI classes:', this._classes);
                        this._convertClassesToObjects();
                        success = true;
                        break;
                    case 'quantile':
                        this._classes = [];
                        for (var i = 0; i<classnum; i++) {
                            var currentq = (1/classnum)*i;
                            this._classes.push(quantile(values.filter((value) => value != null), currentq));
                        }				
                        console.warn(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Quantile classes at the middle might be slightly different compared to GIS SW');		
                        this._log('Quantile classes: ', this._classes);	
                        this._convertClassesToObjects();
                        success = true;
                        break;
                    case 'manual':
                        this._classnum = this._classes.length;
                        this._log('Manually defined classes: ', this._classes);	
                        this._convertClassesToObjects();
                        success = true;
                        break;
                    case 'stddeviation':
                        // with zScore: (number-average)/standard_deviation
                        this._classes = [];
                        var stddev = standardDeviation(values.filter((value) => value != null));
                        var mean$1 = mean(values.filter((value) => value != null));
                        this._log('stddev:', stddev);
                        this._log('stddev mean:', mean$1);
                        var extent$1 = extent(values.filter((value) => value != null));
                        this._log('stddev extent:', extent$1);
                        /*var diff = extent[1]-extent[0]                    
                        console.debug('diff', diff)
                        console.debug('number of classes if 1 stddev:', diff/(stddev/1))
                        console.debug('number of classes if 1 stddev:', Math.round(diff/(stddev/1)))
                        console.debug('number of classes if 1/2 stddev:', diff/(stddev/2))
                        console.debug('number of classes if 1/3 stddev:', diff/(stddev/3))
                        */

                        var halfstddev = stddev/2;
                        var curr;
                        var down = 1;
                        var up = 1;
                        //var potclassnum = Math.round(diff/(stddev/1));
                        var valid = true;
                        this._classes.push(-999999);
                        for (var i = 0; valid /*i<potclassnum*/; i++) {
                                //console.debug('downwards', down)
                                curr = mean$1-(halfstddev*down);
                                /*
                                console.debug('downwards curr', curr)
                                console.debug(extent[0])
                                console.debug((curr > extent[0]))
                                console.debug(halfstddev)
                                */
                                if (curr > extent$1[0] && down < 7) {
                                    this._classes.push(curr);
                                    down += 2;
                                } else {
                                    valid = false;
                                }                        }
                        
                        valid = true;
                        for (var i = 0; valid /*i<potclassnum*/; i++) {
                            //console.debug('upwards', up)
                            curr = mean$1+(halfstddev*up);
                            //console.debug('upwards curr', curr)
                            if (curr < extent$1[1] && up < 7) {
                                this._classes.push(curr);
                                up += 2;
                            } else {
                                valid = false;
                            }                        }

                        this._log('Stddev unsorted classes:', this._classes);
                        this._classes.sort(function(a, b) {
                            return a - b;
                        });
                        this._log('Stddev sorted classes: ', this._classes);	
                        this._convertClassesToObjects();

                        this._log('Stddev: down intervals:', down, 'up intervals:', up);
                        var interval_lower = (0.5 * -down);
                        this._classes.forEach((arrayItem) => {
                            if (down > 0) {
                                this._log('Stddev: down =', down, 'up =', up, 'boundary =', interval_lower);
                                arrayItem.stddev_lower = interval_lower;
                                interval_lower += 1;
                                down -= 2;
                            } else if (down < 0 && up > 0) {
                                this._log('Stddev: down =', down, 'up =', up, 'boundary =', interval_lower);
                                arrayItem.stddev_lower = interval_lower;
                                interval_lower += 1;
                                up -= 2;
                                
                            }                        });
                        success = true;
                        this._log('Stddev: final classes:', this._classes);
                        break;
                    case 'logarithmic':
                        this._classes = [];
                        var minmax = extent(values.filter((value) => value != null));
                        this._log('Log: min:', minmax[0], ', max:', minmax[1]);	

                        var logdiff = Math.log(minmax[1]) - Math.log(minmax[0]);
                        if (Number.isNaN(logdiff)) {
                            console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Logarithmic scale does not support negative values yet. (dataset minimum: '+minmax[0]+', maximum: '+minmax[1]+') Please use a different classification method for this dataset, or choose an other data attribute field that has no negative values. Classification failed, map was not generated properly.');
                            return;
                        }                        var logdiff_divided = logdiff / classnum;
                        this._log('Logdiff', Math.log(minmax[1]) - Math.log(minmax[0]));
                        this._log('Logdiff divided by classnum', logdiff_divided);
                        var factor = Math.exp(logdiff_divided);
                        this._log('Log: factor Math.exp(logdiff_divided):', factor);
                        this._classes.push(minmax[0]);
                        for (var i = 1; i < classnum; i++) {
                            this._classes.push(this._classes[this._classes.length - 1] * factor);
                        }

                        // round interval boundary values by default, since with logarithmic classes we get high precision floats
                        if (classrounding == null) { classrounding = 2;}

                        this._log('Logarithmic classes: ', this._classes);	
                        this._convertClassesToObjects();
                        success = true;
                        break;
                    default:
                        console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Wrong classification type (choose one of the following: "jenks", "equalinterval", "quantile", "stddeviation", "logarithmic", "manual" - when manual, `classes` must be an array!)');
                }
                this._timerClsfEnd = Date.now();

                this._timerGenColorsStart = Date.now();
                // Classification success, proceed with generating colors
                if (success) {
                    this._log('Classification success.');
                    this._log('Generating color- and symbol property ranges for '+this._classes.length+' classes.');
                    try {
                        this._colors = scale(colorramp).colors(this._classes.length);
                    } catch (error) {
                        console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', error);
                        console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Make sure chosen color ramp exists (color ramps based on https://colorbrewer2.org/) and custom colors are formatted correctly. For supported formats, see https://gka.github.io/chroma.js/. For an interactive color palette helper, see https://gka.github.io/palettes/.');
                        return;
                    }
                    if (colorramp_rev) {
                        this._log('Reversing colorramp...');
                        this._colors.reverse(); 
                    }                }
                this._timerGenColorsEnd = Date.now();
                this._timerGenRangesStart = Date.now();
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
                this._timerGenRangesEnd = Date.now();
                // Middlepoint value handling:
                if (middlepoint != null) {
                    if (this._classes.length % 2 == 0) {
                        this._log('Adjusting middle classes to boundary value:', middlepoint);
                        this._classes[this._classes.length / 2].value = middlepoint;
                    } else {
                        console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Option `middlePointValue` only works with an even number of classes. Option ignored, middle class boundary values unchanged.');
                    }
                }
                // Class rounding handling:
                if (classrounding != null) { this._classPostProc_rounding(classrounding); }    // round class boundary values
            } else {
                console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Classnumber', classnum, 'is out of range, must be: 2 < x <=', validFeatureCount, '(count of features with a numeric value in field)!');
                return;
            }        }        

        // count how many values belong in a single class (make sure to use features.finalvalue, as that is already through normalization), track it in _classes.featureCount
        features.forEach((element) => {
            for (var i = 0; i < this._classes.length; i++) {
                if ((i === this._classes.length - 1 || element.finalvalue < this._classes[i + 1].value) && element.finalvalue !== null) {
                    this._classes[i].featureCount++;
                    break;
                }
            }
        });

        // warn if there is an empty class
        this._classes.forEach((element, idx) => {
            if (element.featureCount == 0) { 
                if (mode == 'stddeviation') {
                    console.warn(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', `Empty class! Zero features belong to class covering interval [${element.stddev_lower},${(idx != this._classes.length-1 ? this._classes[idx+1].stddev_lower : "")}] (class no. ${idx+1}, counted from the lowest class)! Consider using a different classification method.`); 
                } else {
                    console.warn(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', `Empty class! Zero features belong to class covering interval [${element.value},${(idx != this._classes.length-1 ? this._classes[idx+1].value : "")}] (class no. ${idx+1}, counted from the lowest class)! Consider using a different classification method or adjusting your class boundaries.`); 
                }                
            }        });

        // count nodata features (= all values - validFeatures). For use in legend ("no data" class).
        this._classes.nodataFeatureCount = features.length-validFeatureCount;

        //this._convertClassesToObjects();

        // the class boundary values are final, legend is ready to be generated - that also means that before legend generation, unitModifier can be applied to alter the displayed values (using .valueFormattedForLegend)
        this._classes.forEach(element => {
            element.valueFormattedForLegend = element.value;   // create a property for copy of actual class boundary value
        });

        this._generateLegend(legendtitle, asc, mode_line, mode_point, mode_polygon, typeOfFeatures, legendfooter, this._classes, mode);  // generate legend

    }

    _applySymbology() {
        var mode_point = this.options.pointMode;
        this.options.pointSize;
        this._pointShape = this.options.pointShape;
        var mode_line = this.options.lineMode;
        var mode_polygon = this.options.polygonMode;
        this.options.lineWidth;
        this.options.polygonHatch;

        //this._classes = classes;
        var svgCreator = this._svgCreator;
        var ps = this._pointShape;
        var stylePoint_color = this._stylePoint_color;
        var stylePoint_size = this._stylePoint_size;
        var styleLine_color = this._styleLine_color;
        var styleLine_width = this._styleLine_width;
        var stylePolygon_color = this._stylePolygon_color;
        var stylePolygon_hatch = this._stylePolygon_hatch;
        this._pointMarkers;
        var options = this.options;
        var nodataignore = this._noDataIgnore;

        var n = 0;

        this._timerSymbologyStart = Date.now();
        this._log('Applying symbology to map features.');
        // apply symbology to features
        this.eachLayer(function(layer) {
            if (layer.feature.properties[this._field] == null && nodataignore) {
                layer.remove();
            } else {
                switch (layer.feature.geometry.type) {
                    case "Point":
                        layer.feature.geometry.coordinates;
                        var style = (mode_point == "color" ? stylePoint_color(this._features[n].finalvalue, this.options) : stylePoint_size(this._features[n].finalvalue, this.options));
                        style.shape = ps;
                        var finalSymbol = svgCreator({shape: style.shape, size: style.radius, color: style.fillColor});
                        var iconW = finalSymbol.getAttribute('width');
                        var iconH = finalSymbol.getAttribute('height');

                        const svgIcon = new L.DivIcon({
                            html: finalSymbol,
                            className: "",
                            iconSize: [iconW, iconH],
                            iconAnchor: [iconW/2, iconH/2],
                        });                
                        layer.setIcon(svgIcon);
                        break;
                    case "MultiPoint":
                        var style = (mode_point == "color" ? stylePoint_color(this._features[n].finalvalue, this.options) : stylePoint_size(this._features[n].finalvalue, this.options));
                        style.shape = ps;
                        var finalSymbol2 = svgCreator({shape: style.shape, size: style.radius, color: style.fillColor});
                        iconW = finalSymbol2.getAttribute('width');
                        iconH = finalSymbol2.getAttribute('height');

                        var mpfeatures = layer._layers;
                        for (const property in mpfeatures) {
                            mpfeatures[property].setIcon(new L.DivIcon({
                                html: finalSymbol2.outerHTML,
                                className: "",
                                iconSize: [iconW, iconH],
                                iconAnchor: [iconW/2, iconH/2],
                            }));
                        }
                        break;
                    case "LineString":
                    case "MultiLineString":
                        layer.setStyle((mode_line == "width" ? styleLine_width(this._features[n].finalvalue, this.options) : styleLine_color(this._features[n].finalvalue, this.options)))/*.addTo(map)*/;
                        break;
                    case "Polygon":
                    case "MultiPolygon":
                        if (mode_polygon == "hatch") {
                            layer._path.style['fill'] = stylePolygon_hatch(this._features[n].finalvalue, this.options); // this messy workaround is needed due to Leaflet ignoring `className` in layer.setStyle(). See https://github.com/leaflet/leaflet/issues/2662. With Leaflet v2, make sure to set intial map view (L.map.setView()), otherwise the plugin spits an error on this line.
                            layer._path.style['fill-opacity'] = (options.style.fillOpacity != null ? options.style.fillOpacity : 0.7); 
                        } else {
                            layer.setStyle(stylePolygon_color(this._features[n].finalvalue, this.options));
                        }
                        break;
                    default:
                        console.error(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', 'Error: Unknown feature type: ', layer.feature.geometry.type, layer.feature);
                        break;
                }
                n += 1;  
            }     
        }, this);
        this._timerSymbologyEnd = Date.now();
    }

    /*classify() {
        this._classify(this._map);
    }*/

    /** @param {LeafletMap} map */
    onAdd(map) {
        super.onAdd(map); // execute L.GeoJSON onAdd()
        this._log('super.onAdd(): executed L.GeoJSON onAdd() code');
        // apply symbology to all features
        this._applySymbology();
        // if a legend exists for this layer, add it to map
        if (this._legend) {
            this._legend.addTo(map);
            this._log('onAdd(): Legend added to map:', map);
        }        // in case of attribute values being null in the selected field in all features AND user does NOT want to show the nodata class (noDataIgnore: true), 
        // self-destructively remove layer from map. Otherwise, just show a message that all went well, layer added to the map.
        if (this._attributeFieldExistsButAllFeaturesAreNull && this._nodataignore) {
            this._log('All values are NULL && noDataIgnore: true = Removing layer...');
            this.remove();
            return;
        }
        this._log('onAdd(): Layer added to map:', map);

        this._log('Finished!');
        this._timerGlobalEnd = Date.now();
        this._log('------------------------------------');
    }

    /** @param {LeafletMap} map */
    onRemove(map) {
        this._log('onRemove(): Removing Layer ...');
        // remove legend
        if (this._legend) {
            this._log('Removing legend:', this._legend);
            this._legend.remove();
            this._log('Legend Removed.');
        }
        // remove layer
		this.eachLayer(map.removeLayer, map);
        this._log('Layer Removed.');
	}

    // simple log helper function to reuse throughout the code
    _log(...args) {
        console.debug(`[ %cl-dcls: %cL.id ${this._leaflet_id}`, `color: red`, `color: orange`, ']', ...args);
        return;
    }
}
class LegendControl extends L.Control {
	//static defaultOptions = {position: 'topright'};

	constructor(options, legendData = {}, ctx) {
		super(options);
        this._legendData = legendData;
        this._ctx = ctx;
	}

	onAdd(map) {
        const div = this._ctx._generateLegendContent(this._legendData);
        return div;
	}
}

// Leaflet 1.x to 2.x migration (for support of both): https://github.com/Leaflet/Leaflet/blob/main/MIGRATION.md#11-support-1x-and-20-from-one-release
// 1.x keeps defaults on the prototype, and without a copy of its own, mergeOptions would change the defaults of every L.Layer
if (LeafletisV1) {
	DataClassification.prototype.options = Object.create(L.GeoJSON.prototype.options);
}
DataClassification.mergeOptions(plugin_defaultOptions);

export { DataClassification };
