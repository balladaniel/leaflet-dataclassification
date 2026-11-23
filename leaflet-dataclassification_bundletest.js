/**
 * Various utility functions, used by Leaflet internally.
 * @module Util
 */

/** Last unique ID used by [`stamp()`](#util-stamp) */
let lastId = 0;

/**
 * Returns the unique ID of an object, assigning it one if it doesn't have it.
 * @param {object} obj
 * @returns {number}
 */
function stamp(obj) {
	if (!('_leaflet_id' in obj)) {
		/** @type {any} */ (obj)['_leaflet_id'] = ++lastId;
	}
	return /** @type {any} */ (obj)._leaflet_id;
}

/**
 * Returns the number `num` modulo `range` in such a way so it lies within `range[0]` and `range[1]`.
 * The returned value will always be smaller than `range[1]` unless `includeMax` is set to `true`.
 * @param {number} num
 * @param {number[]} range
 * @param {boolean} [includeMax]
 */
function wrapNum(num, range, includeMax) {
	const max = range[1],
	min = range[0],
	d = max - min;
	return num === max && includeMax ? num : ((num - min) % d + d) % d + min;
}

/**
 * Returns the number `num` rounded with specified `precision`. The default `precision` value is 6 decimal
 * places. `false` can be passed to skip any processing (can be useful to avoid round-off errors).
 * @param {number} num
 * @param {number | false} [precision]
 */
function formatNum(num, precision = 6) {
	if (precision === false) { return num; }
	const pow = 10 ** precision;
	return Math.round(num * pow) / pow;
}

/**
 * Returns `value` if it's a number (including `Infinity`), converts it if it's a numeric string, and returns
 * `NaN` for anything else, unlike `Number()`, which turns `''`, `null` and booleans into `0` or `1`.
 * @param {unknown} value
 */
function toNumber(value) {
	return typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? +value : NaN;
}

const WHITESPACE_RE = /\s+/;

/**
 * Trims and splits the string on whitespace and returns the array of parts.
 * @param {string} str
 */
function splitWords(str) {
	// a single word is the common case, and splitting allocates a lot more than the array
	const trimmed = str.trim();
	return WHITESPACE_RE.test(trimmed) ? trimmed.split(WHITESPACE_RE) : [trimmed];
}

/**
 * Merges the given properties to the `options` of the `obj` object, returning the resulting options. See
 * [Class options](#class-options).
 * @template {object} O
 * @param {{options?: O}} obj
 * @param {Partial<O>} [options]
 */
function setOptions(obj, options) {
	if (!Object.hasOwn(obj, 'options')) {
		const defaults = getDefaultOptions(obj.constructor) ?? obj.options;
		obj.options = defaults ? Object.create(defaults) : /** @type {O} */ ({});
	}
	for (const i in options) {
		if (Object.hasOwn(options, i)) {
			/** @type {any} */ (obj.options)[i] = options[i];
		}
	}
	return /** @type {O} */ (obj.options);
}

/** @type {WeakMap<Function, object>} */
const chainedDefaults = new WeakMap(); // class -> the defaultOptions object it was chained with

// Links the `defaultOptions` of each class in the chain to its parent's, so defaults are inherited and stay live.
// Done on first use because a static field can't do it in its initializer and stay tree-shakeable.
/** @param {Function & {defaultOptions?: object}} cls */
function getDefaultOptions(cls) {
	const defaults = cls?.defaultOptions;
	if (defaults && chainedDefaults.get(cls) !== defaults) {
		for (let c = cls; c.defaultOptions; c = Object.getPrototypeOf(c)) {
			if (Object.hasOwn(c, 'defaultOptions')) {
				Object.setPrototypeOf(c.defaultOptions, Object.getPrototypeOf(c).defaultOptions ?? Object.prototype);
			}
		}
		chainedDefaults.set(cls, defaults);
	}
	return defaults;
}

/**
 * The type of a class's `static defaultOptions`: some of its options, plus anything a subclass adds.
 * @template O
 * @typedef {Partial<O> & {[key: string]: unknown}} Defaults
 */

let hooksVersion = 0;
/** @type {WeakMap<object, Function[]>} */
const ownHooks = new WeakMap(); // class -> hooks added to that class directly
/** @type {WeakMap<Function, {version: number, runners: number, hooks: Function[]}>} */
const hookPlans = new WeakMap(); // class -> {version, runners, hooks} for its whole chain

// Counts the classes in the chain that end their constructor with `callInitHooks()` and collects their hooks,
// parents first. Cached per class until the next `addInitHook` call.
/** @param {Function & {initHooks?: boolean}} cls */
function getHookPlan(cls) {
	let plan = hookPlans.get(cls);
	if (plan?.version !== hooksVersion) {
		plan = {version: hooksVersion, runners: 0, hooks: []};
		for (let c = cls; c !== Function.prototype; c = Object.getPrototypeOf(c)) {
			if (Object.hasOwn(c, 'initHooks') && c.initHooks) { plan.runners++; }
			plan.hooks.unshift(...(ownHooks.get(c) ?? []));
		}
		hookPlans.set(cls, plan);
	}
	return plan;
}

/**
 * Class is the base of `Evented`, `Handler`, `Icon` and `Control`, and
 * through them of almost all of the Leaflet classes documented here.
 *
 * Leaflet classes are plain JavaScript classes: extend them with `extends` and
 * put setup code in `constructor()`, after calling `super()`. Class adds what plugins
 * need on top of that: default options, mixins and constructor hooks.
 *
 * @example
 * ```js
 * class MyClass extends Class {
 *     constructor(greeter) {
 *         super();
 *         this.greeter = greeter;
 *     }
 *
 *     greet(name) {
 *         alert(this.greeter + ', ' + name)
 *     }
 * }
 *
 * // create instance of MyClass, passing "Hello" to the constructor
 * const a = new MyClass("Hello");
 *
 * // call greet method, alerting "Hello, World"
 * a.greet("World");
 * ```
 *
 * Leaflet 1.x classes used an `initialize()` method instead of `constructor()`. Constructing
 * a class that still has an `initialize()` method throws an error.
 *
 * @example <caption>Options</caption>
 * Declare the default options of a class with a static `defaultOptions` field. They
 * are merged with the default options of the parent class instead of replacing them,
 * which makes managing configuration of objects and default values convenient:
 *
 * ```js
 * class MyClass extends Class {
 *     static defaultOptions = {
 *         myOption1: 'foo',
 *         myOption2: 'bar'
 *     };
 * }
 *
 * class MyChildClass extends MyClass {
 *     static defaultOptions = {
 *         myOption1: 'baz',
 *         myOption3: 5
 *     };
 * }
 *
 * const a = new MyChildClass();
 * a.options.myOption1; // 'baz'
 * a.options.myOption2; // 'bar'
 * a.options.myOption3; // 5
 * ```
 *
 * Every instance gets its own `options` object, which inherits from the default options of its class. Changing
 * a default later, like `Marker.defaultOptions.riseOnHover = true`, affects all instances that don't set
 * the option themselves. `mergeOptions()` adds or changes defaults of an existing class without touching
 * the defaults of its parent, which makes it the way to change defaults from a plugin:
 *
 * ```js
 * MyChildClass.mergeOptions({myOption4: true});
 * ```
 *
 * There's also [`Util.setOptions`](#util-setoptions), a method for conveniently merging
 * options passed to constructor with the defaults defined in the class:
 *
 * ```js
 * class MyClass extends Class {
 *     static defaultOptions = {
 *         foo: 'bar',
 *         bla: 5
 *     };
 *
 *     constructor(options) {
 *         super();
 *         Util.setOptions(this, options);
 *         ...
 *     }
 * }
 *
 * const a = new MyClass({bla: 10});
 * a.options; // {foo: 'bar', bla: 10}
 * ```
 *
 * Note that the options object allows any keys, not just the options defined by the class and
 * its base classes. This means you can use the options object to store application specific information,
 * as long as you avoid keys that are already used by the class in question.
 *
 * @example <caption>Mixins</caption>
 * You can add methods and properties from other objects using the `include` method (such objects are called
 * mixins). An `options` property of the mixin is merged into the default options of the class:
 *
 * ```js
 * const MyMixin = {
 *     foo() { ... },
 *     bar: 5
 * };
 *
 * class MyClass extends Class {}
 *
 * MyClass.include(MyMixin);
 *
 * const a = new MyClass();
 * a.foo();
 * ```
 *
 * @example <caption>Constructor hooks</caption>
 * If you're a plugin developer, you often need to add additional initialization code to existing classes (e.g.
 * editing hooks for `Polyline`). Leaflet comes with a way to do it easily using the `addInitHook` method:
 *
 * ```js
 * MyClass.addInitHook(function () {
 *     // ... do something in constructor additionally
 *     // e.g. add event listeners, set custom properties etc.
 * });
 * ```
 *
 * You can also use the following shortcut when you just need to make one additional method call:
 *
 * ```js
 * MyClass.addInitHook('methodName', arg1, arg2, …);
 * ```
 *
 * Hooks added to a class also run for instances of its subclasses, parent class hooks first, and
 * each hook runs once per instance. For Leaflet's own classes, they run after the constructor
 * has finished, so a hook added to `Layer` sees a fully built `Polygon`. For a class of your own
 * that extends a Leaflet class, they run before the constructor body of your class.
 *
 * If other code adds hooks to a class of yours and these hooks need the constructor of your class to have run,
 * mark the class with `static initHooks = true` and end its constructor with `this.callInitHooks()`:
 *
 * ```js
 * class MyLayer extends Layer {
 *     static initHooks = true;
 *
 *     constructor(options) {
 *         super();
 *         Util.setOptions(this, options);
 *         this._items = [];
 *         this.callInitHooks();
 *     }
 * }
 * ```
 *
 * @template {object} [O=object]
 */
class Class {
	/**
	 * Marks a class whose constructor ends with `this.callInitHooks()`. Set it as `static initHooks = true` on a
	 * plugin class whose own [constructor hooks](#class-constructor-hooks) need its constructor to run first.
	 * @uninheritable
	 */
	static initHooks = true;

	/**
	 * [Includes a mixin](#class-mixins) into the current class.
	 * @template {{prototype: object, mergeOptions: (options: object) => unknown}} C
	 * @this {C}
	 * @param {object} properties
	 * @uninheritable
	 */
	static include(properties) {
		for (let obj = properties; obj && obj !== Object.prototype; obj = Object.getPrototypeOf(obj)) {
			for (const k of Object.getOwnPropertyNames(obj)) {
				if (k !== 'constructor' && k !== 'options') {
					/** @type {any} */ (this.prototype)[k] = /** @type {any} */ (properties)[k];
				}
			}
		}
		const {options} = /** @type {{options?: object}} */ (properties);
		if (options) {
			this.mergeOptions(options);
		}
		return this;
	}

	/**
	 * [Merges `options`](#class-options) into the `defaultOptions` of the class.
	 * @template {{defaultOptions?: object}} C
	 * @this {C}
	 * @param {Partial<NonNullable<C['defaultOptions']>>} options
	 * @uninheritable
	 */
	static mergeOptions(options) {
		if (!Object.hasOwn(this, 'defaultOptions')) {
			this.defaultOptions = Object.create(this.defaultOptions ?? Object.prototype);
		}
		Object.assign(/** @type {object} */ (this.defaultOptions), options);
		return this;
	}

	/**
	 * Deprecated alias of `mergeOptions`, kept for code written for 2.0.0-alpha.1.
	 * @deprecated Use `mergeOptions`.
	 * @template {{defaultOptions?: object, mergeOptions: (options: object) => C}} C
	 * @this {C}
	 * @param {Partial<NonNullable<C['defaultOptions']>>} options
	 * @returns {C}
	 * @uninheritable
	 */
	static setDefaultOptions(options) {
		return this.mergeOptions(options);
	}

	/**
	 * Adds a [constructor hook](#class-constructor-hooks) to the class: a function called with the instance as
	 * `this`, or the name of a method to call with the given arguments.
	 * @template {{prototype: object}} C
	 * @this {C}
	 * @param {((this: C['prototype']) => void) | (keyof C['prototype'] & string)} fn
	 * @param {...any} args
	 * @uninheritable
	 */
	static addInitHook(fn, ...args) {
		const hook = typeof fn === 'function' ? fn : /** @this {Record<string, Function>} */ function () {
			this[fn](...args);
		};
		if (!ownHooks.has(this)) {
			ownHooks.set(this, []);
		}
		/** @type {Function[]} */ (ownHooks.get(this)).push(hook);
		hooksVersion++;
		return this;
	}

	constructor() {
		if (/** @type {any} */ (this).initialize) {
			throw new Error(`${this.constructor.name}: initialize() is not called in Leaflet 2. ` +
				'Rename it to constructor() and call super() at its start.');
		}

		// NoInfer stops a contextual type (e.g. `const l: Layer = new Circle(…)`) from inferring O through this
		// property, which would check the constructor options against `LayerOptions` instead of the class's own
		/**
		 * The options of the instance, inheriting from the default options of its class.
		 * @type {NoInfer<O>}
		 */
		this.options = setOptions(this);

		this._initHooksLeft = getHookPlan(this.constructor).runners;
		this.callInitHooks();
	}

	/**
	 * Called at the end of the constructor of every class with `static initHooks = true`. The last of these calls,
	 * from the deepest such class, runs all hooks of the chain once, so they see a fully built instance.
	 * @uninheritable
	 */
	callInitHooks() {
		if (--this._initHooksLeft === 0) {
			for (const hook of getHookPlan(this.constructor).hooks) {
				hook.call(this);
			}
		}
	}
}

/** @import {ControlDefaults, ControlOptions, Defaults} from '../types.js' */
/** @import {LeafletMap} from '../map/Map.js' */

const defaultOptions$d = {
	/**
	 * The position of the control (one of the map corners). Possible values
	 * are `'topleft'`, `'topright'`, `'bottomleft'` or `'bottomright'`
	 * @type {ControlPosition}
	 */
	position: 'topright'
};

/** @typedef {typeof defaultOptions} ControlDefaultsValues */

/**
 * One of the map corners a control can be placed in.
 * @typedef {'topleft' | 'topright' | 'bottomleft' | 'bottomright'} ControlPosition
 */

/**
 * Base class for map controls such as `ZoomControl`, `AttributionControl`, `LayersControl` and `ScaleControl`, which
 * handles positioning them. Extend it to create your own controls.
 * @categoryDescription Methods
 * Classes extending Control will inherit the following methods:
 *
 * @categoryDescription Extension methods
 * Every control should extend from `Control` and (re-)implement the following methods.
 * @template {ControlOptions} [O=ControlOptions]
 * @extends {Class<O & ControlDefaults>}
 */
class Control extends Class {

	static initHooks = true;

	/** @type {Defaults<ControlOptions>} */
	static defaultOptions = defaultOptions$d;

	/**
	 * Creates a control with the given options.
	 * @param {NoInfer<Partial<O>>} [options]
	 */
	constructor(options) {
		super();
		setOptions(this, options);
		this.callInitHooks();
	}

	/** Returns the position of the control. */
	getPosition() {
		return this.options.position;
	}

	/**
	 * Sets the position of the control.
	 * @param {ControlPosition} position
	 */
	setPosition(position) {
		const map = this._map;

		map?.removeControl(this);

		this.options.position = position;

		map?.addControl(this);

		return this;
	}

	/**
	 * Returns the HTMLElement that contains the control.
	 * @returns {HTMLElement | undefined}
	 */
	getContainer() {
		return this._container;
	}

	/**
	 * Adds the control to the given map.
	 * @param {LeafletMap} map
	 */
	addTo(map) {
		this.remove();
		this._map = map;

		const container = this._container = this.onAdd(map),
		pos = this.getPosition(),
		corner = map._controlCorners[pos];

		container.classList.add('leaflet-control');

		if (pos.includes('bottom')) {
			corner.prepend(container);
		} else {
			corner.append(container);
		}

		this._mapEvents = {...this.getEvents?.(), unload: this.remove};
		map.on(this._mapEvents, this);

		return this;
	}

	/** Removes the control from the map it is currently active on. */
	remove() {
		if (!this._map) {
			return this;
		}

		this._container.remove();
		this._map.off(this._mapEvents, this);
		this.onRemove?.(this._map);

		/** @type {any} */ (this)._map = null;

		return this;
	}
}

// a named import of toNumber makes Point#add ~10% slower in V8

/** @typedef {[number, number]} PointTuple */

/**
 * A `Point`, or its array (`[x, y]`) or object (`{x, y}`) form.
 * @typedef {Point | PointTuple | {x: number, y: number}} PointExpression
 */

/**
 * Represents a point with `x` and `y` coordinates in pixels.
 *
 * @example
 * ```js
 * const point = new Point(200, 300);
 * ```
 *
 * All Leaflet methods and options that accept `Point` objects also accept them in a simple Array form (unless noted
 * otherwise), so these lines are equivalent:
 *
 * ```js
 * map.panBy([200, 300]);
 * map.panBy(new Point(200, 300));
 * ```
 *
 * Note that `Point` does not inherit from Leaflet's `Class` object, which means new classes can't inherit from it,
 * and new methods can't be added to it with the `include` function.
 *
 * @categoryDescription Functions
 * There are several static functions which can be called without instantiating Point:
 */
class Point {
	/**
	 * Creates a Point object with the given `x` and `y` coordinates. If
	 * optional `round` is set to true, rounds the `x` and `y` values.
	 * @overload
	 * @param {number} x
	 * @param {number} y
	 * @param {boolean} [round]
	 */
	/**
	 * Expects an array of the form `[x, y]` or a plain object of the form `{x: Number, y: Number}` instead.
	 * @overload
	 * @param {PointExpression} coords
	 */
	/**
	 * @param {number | PointExpression} x
	 * @param {number} [y]
	 * @param {boolean} [round]
	 */
	constructor(x, y, round) {
		if (x instanceof Point) {
			// We can use the same object, no need to clone it
			// eslint-disable-next-line no-constructor-return
			return x;
		}

		let _x = x, _y = y;
		if (Array.isArray(x)) {
			_x = x[0];
			_y = x[1];
		} else if (typeof x === 'object' && x !== null) {
			_x = x.x;
			_y = x.y;
		}

		/**
		 * The `x` coordinate of the point
		 * @type {number}
		 */
		this.x = round ? Math.round(toNumber(_x)) : toNumber(_x);
		/**
		 * The `y` coordinate of the point
		 * @type {number}
		 */
		this.y = round ? Math.round(toNumber(_y)) : toNumber(_y);

		// NaN check; isNaN() here makes Point#add ~10% slower in V8
		// eslint-disable-next-line no-self-compare
		if (this.x !== this.x || this.y !== this.y) {
			throw new Error(`Invalid Point object: (${_x}, ${_y})`);
		}
	}

	/**
	 * Returns `true` if the Point object can be properly initialized.
	 * @category Functions
	 * @overload
	 * @param {number} x
	 * @param {number} [y]
	 * @returns {boolean}
	 */
	/**
	 * Expects an array of the form `[x, y]` or a plain object of the form `{x: Number, y: Number}`. Returns `true` if
	 * the Point object can be properly initialized.
	 * @overload
	 * @param {unknown} coords
	 * @returns {coords is PointExpression}
	 */
	/**
	 * @param {any} x
	 * @param {any} [y]
	 */
	static validate(x, y) {
		try {
			return !!new Point(x, y);
		} catch {
			return false;
		}
	}

	/** Returns a copy of the current point. */
	clone() {
		// to skip the validation in the constructor we need to initialize with 0 and then set the values later
		const p = new Point(0, 0);
		p.x = this.x;
		p.y = this.y;
		return p;
	}

	/**
	 * Returns the result of addition of the current and the given points.
	 * @param {PointExpression} point
	 */
	add(point) {
		// non-destructive, returns a new point
		return this.clone()._add(new Point(point));
	}

	/** @param {Point} point */
	_add(point) {
		// destructive, used directly for performance in situations where it's safe to modify existing point
		this.x += point.x;
		this.y += point.y;
		return this;
	}

	/**
	 * Returns the result of subtraction of the given point from the current.
	 * @param {PointExpression} point
	 */
	subtract(point) {
		return this.clone()._subtract(new Point(point));
	}

	/** @param {Point} point */
	_subtract(point) {
		this.x -= point.x;
		this.y -= point.y;
		return this;
	}

	/**
	 * Returns the result of division of the current point by the given number.
	 * @param {number} num
	 */
	divideBy(num) {
		return this.clone()._divideBy(num);
	}

	/** @param {number} num */
	_divideBy(num) {
		this.x /= num;
		this.y /= num;
		return this;
	}

	/**
	 * Returns the result of multiplication of the current point by the given number.
	 * @param {number} num
	 */
	multiplyBy(num) {
		return this.clone()._multiplyBy(num);
	}

	/** @param {number} num */
	_multiplyBy(num) {
		this.x *= num;
		this.y *= num;
		return this;
	}

	/**
	 * Multiply each coordinate of the current point by each coordinate of `scale`. In linear
	 * algebra terms, multiply the point by the [scaling
	 * matrix](https://en.wikipedia.org/wiki/Scaling_%28geometry%29#Matrix_representation) defined by `scale`.
	 * @param {PointExpression} scale
	 */
	scaleBy(scale) {
		scale = new Point(scale);
		return new Point(this.x * scale.x, this.y * scale.y);
	}

	/**
	 * Inverse of `scaleBy`. Divide each coordinate of the current point by each coordinate of `scale`.
	 * @param {PointExpression} scale
	 */
	unscaleBy(scale) {
		scale = new Point(scale);
		return new Point(this.x / scale.x, this.y / scale.y);
	}

	/** Returns a copy of the current point with rounded coordinates. */
	round() {
		return this.clone()._round();
	}

	_round() {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	}

	/** Returns a copy of the current point with floored coordinates (rounded down). */
	floor() {
		return this.clone()._floor();
	}

	_floor() {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	}

	/** Returns a copy of the current point with ceiled coordinates (rounded up). */
	ceil() {
		return this.clone()._ceil();
	}

	_ceil() {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		return this;
	}

	/** Returns a copy of the current point with truncated coordinates (rounded towards zero). */
	trunc() {
		return this.clone()._trunc();
	}

	_trunc() {
		this.x = Math.trunc(this.x);
		this.y = Math.trunc(this.y);
		return this;
	}

	/**
	 * Returns the cartesian distance between the current and the given points.
	 * @param {PointExpression} point
	 */
	distanceTo(point) {
		point = new Point(point);

		const x = point.x - this.x,
		y = point.y - this.y;

		return Math.sqrt(x * x + y * y);
	}

	/**
	 * Returns `true` if the given point has the same coordinates.
	 * @param {PointExpression} point
	 */
	equals(point) {
		point = new Point(point);

		return point.x === this.x &&
		       point.y === this.y;
	}

	/**
	 * Returns `true` if both coordinates of the given point are less than
	 * the corresponding current point coordinates (in absolute values).
	 * @param {PointExpression} point
	 */
	contains(point) {
		point = new Point(point);

		return Math.abs(point.x) <= Math.abs(this.x) &&
		       Math.abs(point.y) <= Math.abs(this.y);
	}

	/** Returns a string representation of the point for debugging purposes. */
	toString() {
		return `Point(${formatNum(this.x)}, ${formatNum(this.y)})`;
	}
}

/**
 * Creates an HTML element with `tagName`, sets its class to `className`,
 * and optionally appends it to `container` element.
 * @template {keyof HTMLElementTagNameMap} K
 * @overload
 * @param {K} tagName
 * @param {string} [className]
 * @param {HTMLElement} [container]
 * @returns {HTMLElementTagNameMap[K]}
 */
/**
 * @overload
 * @param {string} tagName
 * @param {string} [className]
 * @param {HTMLElement} [container]
 * @returns {HTMLElement}
 */
/**
 * @param {string} tagName
 * @param {string} [className]
 * @param {HTMLElement} [container]
 */
function create(tagName, className, container) {
	const el = document.createElement(tagName);
	el.className = className ?? '';

	container?.append(el);
	return el;
}

/**
 * Makes `el` the last child of its parent, so it renders in front of the other children.
 * @param {HTMLElement | SVGElement} el
 */
function toFront(el) {
	const parent = el.parentNode;
	if (!parent || parent.lastChild === el) { return; }

	// re-inserting a hovered node (e.g. bringToFront in a pointerover handler) makes Chromium 144+ fire a repeated
	// pointerover and lose the next pointerout (#10129), so move the nodes after it instead
	if (el.matches(':hover')) {
		while (el.nextSibling) { el.before(el.nextSibling); }
	} else {
		parent.append(el);
	}
}

/**
 * Makes `el` the first child of its parent, so it renders behind the other children.
 * @param {HTMLElement | SVGElement} el
 */
function toBack(el) {
	const parent = el.parentNode;
	if (!parent || parent.firstChild === el) { return; }

	if (el.matches(':hover')) { // see toFront
		while (el.previousSibling) { el.after(el.previousSibling); }
	} else {
		parent.prepend(el);
	}
}

/**
 * Resets the 3D CSS transform of `el` so it is translated by `offset` pixels and optionally scaled
 * by `scale`. Does not have an effect if the browser doesn't support 3D CSS transforms.
 * @param {HTMLElement | SVGElement} el
 * @param {Point} offset
 * @param {number} [scale]
 */
function setTransform(el, offset, scale) {
	const pos = offset ?? new Point(0, 0);

	el.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)${scale ? ` scale(${scale})` : ''}`;
}

/** @type {WeakMap<HTMLElement | SVGElement, Point>} */
const positions = new WeakMap();

/**
 * Sets the position of `el` to coordinates specified by `point` using a CSS translate (used
 * by Leaflet internally to position its layers). With `flat`, the translate is 2D, so `el` is
 * painted into its parent's compositor layer instead of getting a layer of its own.
 * @param {HTMLElement | SVGElement} el
 * @param {Point} point
 * @param {boolean} [flat]
 */
function setPosition(el, point, flat) {
	positions.set(el, point);
	{
		setTransform(el, point);
	}
}

/**
 * Returns the coordinates of an element previously positioned with setPosition.
 * @param {HTMLElement | SVGElement} el
 */
function getPosition(el) {
	// this method is only used for elements previously positioned using setPosition,
	// so it's safe to cache the position for performance
	return positions.get(el) ?? new Point(0, 0);
}

/** Prevents the user from generating `dragstart` DOM events, usually generated when the user drags an image. */
function disableImageDrag() {
	on(window, 'dragstart', preventDefault);
}

/** Cancels the effects of a previous [`DomUtil.disableImageDrag`](#domutil-disableimagedrag). */
function enableImageDrag() {
	off(window, 'dragstart', preventDefault);
}

/**
 * Finds the closest parent node which size (width and height) is not null.
 * @param {HTMLElement} element
 */
function getSizedParentNode(element) {
	do {
		element = /** @type {HTMLElement} */ (element.parentNode);
	} while ((!element.offsetWidth || !element.offsetHeight) && element !== document.body);
	return element;
}

/**
 * Computes the CSS scale currently applied on the element. Returns an object with `x` and `y` members as
 * horizontal and vertical scales respectively, and `boundingClientRect` as the result of
 * [`getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect).
 * @param {HTMLElement} element
 */
function getScale(element) {
	const rect = element.getBoundingClientRect();

	return {
		x: rect.width / element.offsetWidth || 1,
		y: rect.height / element.offsetHeight || 1,
		boundingClientRect: rect
	};
}

// Internal DOM event helpers, kept out of the public `DomEvent` namespace.

// native events of Leaflet events that `DomEvent.stopPropagation` was called on, so the map stops firing them on
// more targets
/** @type {WeakSet<Event>} */
const stoppedEvents = new WeakSet();

// elements that `DomEvent.disableClickPropagation` was called on
/** @type {WeakSet<Node>} */
const clickDisabledElements = new WeakSet();

/** @type {Map<number, PointerEvent>} */
const activePointers = new Map();

/** Returns the pointers that are currently active on the document. */
function getPointers() {
	return [...activePointers.values()];
}

/**
 * Makes Space click a `role="button"` link like it clicks a native button (Enter already clicks links natively).
 * @param {HTMLElement} el
 */
function clickOnSpace(el) {
	el.addEventListener('keydown', _onSpaceKeyDown);
}

/**
 * @this {HTMLElement}
 * @param {KeyboardEvent} e
 */
function _onSpaceKeyDown(e) {
	if (e.key === ' ' && !e.repeat) {
		e.preventDefault(); // stop the page from scrolling
		this.click();
	}
}

/**
 * Utility functions to work with the
 * [DOM events](https://developer.mozilla.org/docs/Web/API/Event), used by Leaflet internally.
 * @module DomEvent
 */

/**
 * The event object type for the DOM event type `K`, or for any of them if `K` holds space-separated types. Types
 * that aren't in `HTMLElementEventMap` (custom events) get a plain `Event`.
 * @template {string} K
 * @typedef {K extends `${infer A} ${infer B}` ? DomEventOf<A> | DomEventOf<B> :
 *   K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event} DomEventOf
 */

/**
 * A listener for the DOM event type `K` (or several space-separated types).
 * @template {string} K
 * @typedef {(e: DomEventOf<K>) => void} DomEventListener
 */

/**
 * An object with DOM event types as keys and listeners as values, as taken by [`DomEvent.on`](#domevent-on).
 * @typedef {{[K in keyof HTMLElementEventMap]?: (e: HTMLElementEventMap[K]) => void} &
 *   {[type: string]: (e: any) => void}} DomEventListenerMap
 */

// Inspired by John Resig, Dean Edwards and YUI addEvent implementations.

/**
 * Adds a listener function (`fn`) to a particular DOM event type of the element `el`. You
 * can optionally specify the context of the listener (object the `this` keyword will point
 * to). You can also pass several space-separated types (e.g. `'click dblclick'`).
 * @template {string} K
 * @overload
 * @param {EventTarget} el
 * @param {K} types
 * @param {DomEventListener<K>} fn
 * @param {unknown} [context]
 * @returns {void}
 */
/**
 * Adds a set of type/listener pairs, e.g. `{click: onClick, pointermove: onPointerMove}`
 * @overload
 * @param {EventTarget} el
 * @param {DomEventListenerMap} eventMap
 * @param {unknown} [context]
 * @returns {void}
 */
/**
 * @param {any} obj
 * @param {any} types
 * @param {any} [fn]
 * @param {unknown} [context]
 */
function on(obj, types, fn, context) {

	if (types && typeof types === 'object') {
		for (const [type, listener] of Object.entries(types)) {
			addOne(obj, type, listener, fn);
		}
	} else {
		for (const type of splitWords(types)) {
			addOne(obj, type, fn, context);
		}
	}
}

// the wrapped listeners added to each target, by type + listener id + context id
/** @type {WeakMap<EventTarget, Map<string, EventListener>>} */
const handlers = new WeakMap();

/**
 * Removes a previously added listener function. Note that if you passed a custom context
 * to on, you must pass the same context to `off` in order to remove the listener.
 * @template {string} K
 * @overload
 * @param {EventTarget} el
 * @param {K} types
 * @param {DomEventListener<K>} fn
 * @param {unknown} [context]
 * @returns {void}
 */
/**
 * Removes a set of type/listener pairs, e.g. `{click: onClick, pointermove: onPointerMove}`
 * @overload
 * @param {EventTarget} el
 * @param {DomEventListenerMap} eventMap
 * @param {unknown} [context]
 * @returns {void}
 */
/**
 * Removes all previously added listeners of given types.
 * @overload
 * @param {EventTarget} el
 * @param {string} types
 * @returns {void}
 */
/**
 * Removes all previously added listeners from given element.
 * @overload
 * @param {EventTarget} el
 * @returns {void}
 */
/**
 * @param {any} obj
 * @param {any} [types]
 * @param {any} [fn]
 * @param {unknown} [context]
 */
function off(obj, types, fn, context) {

	if (arguments.length === 1) {
		batchRemove(obj);
		handlers.delete(obj);

	} else if (types && typeof types === 'object') {
		for (const [type, listener] of Object.entries(types)) {
			removeOne(obj, type, listener, fn);
		}

	} else {
		types = splitWords(types);

		if (arguments.length === 2) {
			batchRemove(obj, type => types.includes(type));
		} else {
			for (const type of types) {
				removeOne(obj, type, fn, context);
			}
		}
	}
}

const DIGIT_RE = /\d/;

/**
 * @param {EventTarget} obj
 * @param {(type: string) => boolean} [filterFn]
 */
function batchRemove(obj, filterFn) {
	for (const id of handlers.get(obj)?.keys() ?? []) {
		const type = id.split(DIGIT_RE)[0];
		if (!filterFn || filterFn(type)) {
			removeOne(obj, type, null, null, id);
		}
	}
}

/**
 * @param {EventTarget} obj
 * @param {string} type
 * @param {any} fn
 * @param {unknown} [context]
 */
function addOne(obj, type, fn, context) {
	const id = type + stamp(fn) + (context ? `_${stamp(context)}` : '');

	let objHandlers = handlers.get(obj);
	if (objHandlers?.has(id)) { return; }

	/** @type {EventListener} */
	const handler = function (e) {
		return fn.call(context || obj, e);
	};

	obj.addEventListener(type, handler, type === 'wheel' ? {passive: false} : false);

	if (!objHandlers) {
		objHandlers = new Map();
		handlers.set(obj, objHandlers);
	}
	objHandlers.set(id, handler);
}

/**
 * @param {EventTarget} obj
 * @param {string} type
 * @param {any} fn
 * @param {unknown} context
 * @param {string} [id]
 */
function removeOne(obj, type, fn, context, id) {
	id ??= type + stamp(fn) + (context ? `_${stamp(context)}` : '');
	const objHandlers = handlers.get(obj);
	const handler = objHandlers?.get(id);

	if (!objHandlers || !handler) { return; }

	obj.removeEventListener(type, handler, false);

	objHandlers.delete(id);
}

/**
 * Stop the given event from propagation to parent elements. Used inside the listener functions:
 * ```js
 * DomEvent.on(div, 'click', DomEvent.stopPropagation);
 * ```
 * Given a Leaflet event, it stops the map from handling the original DOM event.
 * @param {Event | {originalEvent: Event}} e
 */
function stopPropagation(e) {

	if ('stopPropagation' in e) {
		e.stopPropagation();
	} else if (e.originalEvent) {  // In case of Leaflet event.
		stoppedEvents.add(e.originalEvent);
	}
}

/**
 * Adds `stopPropagation` to the element's `'wheel'` events (plus browser variants).
 * @param {HTMLElement} el
 */
function disableScrollPropagation(el) {
	addOne(el, 'wheel', stopPropagation);
}

/**
 * Adds `stopPropagation` to the element's `'dblclick'`, `'contextmenu'` and `'pointerdown'`
 * events (plus browser variants). For `'click'` events, prevents the map from handling the
 * click while still allowing the native DOM click event to propagate normally.
 * @param {HTMLElement} el
 */
function disableClickPropagation(el) {
	on(el, 'pointerdown dblclick contextmenu', stopPropagation);
	clickDisabledElements.add(el);
}

/**
 * Prevents the default action of the DOM Event `e` from happening (such as following
 * a link in the href of the a element, or doing a POST request with page reload
 * when a `<form>` is submitted). Use it inside listener functions.
 * @param {Event} e
 */
function preventDefault(e) {
	e.preventDefault?.();
}

/** @import {LeafletEvent} from '../types.js' */

/**
 * A listener for the event type `K` of an object with the event map `E` that fired it as `T`. Events that aren't
 * in the map (space-separated types, events of plugins) get a plain event object. An indexed access rather than a
 * conditional type, so that `Evented<O, E>` stays covariant in `E` (a `Marker` is assignable to `Layer`); into
 * `Pick<E, …>` rather than `E`, so that `this` of a generic subclass is too (`map.addLayer(this)` in `Popup`).
 * @template {string} K
 * @template {object} E
 * @template [T=Evented]
 * @typedef {(e: (Pick<E, K & keyof E> & {[type: string]: LeafletEvent & {[key: string]: any}})[K] & {target: T}) => void} Listener
 */

/**
 * An object with event types as keys and listeners as values, as taken by [`on`](#evented-on). `M` is the object
 * itself, inferred at the call, so that each listener is checked against the event type of its key.
 * @template M
 * @template {object} E
 * @template [T=Evented]
 * @typedef {{[K in keyof M]: Listener<K & string, E, T>}} ListenerMap
 */

/**
 * A listener for an event without a known event object type.
 * @typedef {(event: LeafletEvent & {[key: string]: any}) => void} LeafletEventHandlerFn
 */

const warnedEvents = new Set();

/**
 * @typedef {{fn: Function, ctx: any, once?: boolean}} EventListener
 * @typedef {Map<Function, EventListener | Map<any, EventListener>>} ListenerIndex
 * @typedef {{index: ListenerIndex, removed: number}} EventIndex
 */

// Past `INDEX_SIZE` listeners of a type, they're indexed by function (then by context if
// a function has several) for constant-time lookups, and removed ones stay in the array
// until half of it is removed; below it, removal makes a filtered copy of the array.
function removedFn() {}
const INDEX_SIZE = 32;

/**
 * @typedef {Object} LeafletEventProps
 * @property {string} type The event type (e.g. `'click'`).
 * @property {Evented} target The object that fired the event. For propagated events, the last
 *   object in the propagation chain that fired the event.
 * @property {Evented} sourceTarget The object that originally fired the event. For
 *   non-propagated events, this will be the same as the `target`.
 * @property {Evented} [propagatedFrom] For propagated events, the last object that propagated
 *   the event to its event parent.
 */

/**
 * A set of methods shared between event-powered classes (like `Map` and `Marker`). Generally, events allow
 * you to execute some function when something happens with an object (e.g. the user clicks on the map,
 * causing the map to fire `'click'` event).
 *
 * @example
 * ```js
 * map.on('click', function(e) {
 * 	alert(e.latlng);
 * } );
 * ```
 *
 * Leaflet deals with event listeners by reference, so if you want to add a listener and then remove it, define
 * it as a function:
 *
 * ```js
 * function onClick(e) { ... }
 *
 * map.on('click', onClick);
 * map.off('click', onClick);
 * ```
 *
 * @template {object} [O=object]
 * @template {object} [E={}]
 * @extends {Class<O>}
 */
class Evented extends Class {
	static initHooks = true;

	constructor() {
		super();
		/** @type {{[type: string]: EventListener[] | undefined} | undefined} */
		this._events = undefined;
		/** @type {{[type: string]: EventIndex | undefined} | undefined} */
		this._eventIndexes = undefined;
		/** @type {{[id: number]: Evented} | undefined} */
		this._eventParents = undefined;
		this.callInitHooks();
	}

	/**
	 * Adds a listener function (`fn`) to a particular event type of the object. You can optionally specify the
	 * context of the listener (object the this keyword will point to). You can also pass several space-separated
	 * types (e.g. `'click dblclick'`).
	 * @template {string} K
	 * @overload
	 * @param {K} type
	 * @param {Listener<K, E, this>} fn
	 * @param {unknown} [context]
	 * @returns {this}
	 */
	/**
	 * Adds a set of type/listener pairs, e.g. `{click: onClick, pointermove: onPointerMove}`
	 * @template M
	 * @overload
	 * @param {ListenerMap<M, E, this>} eventMap
	 * @param {unknown} [context]
	 * @returns {this}
	 */
	/**
	 * @param {string | object} types
	 * @param {any} [fn]
	 * @param {unknown} [context]
	 */
	on(types, fn, context) {

		// types can be a map of types/handlers
		if (typeof types === 'object') {
			for (const [type, f] of Object.entries(types)) {
				// we don't process space-separated events here for performance;
				// it's a hot path since Layer uses the on(obj) syntax
				this._on(type, f, fn);
			}

		} else {
			// types can be a string of space-separated words
			for (const type of splitWords(types)) {
				this._on(type, fn, context);
			}
		}

		return this;
	}

	/**
	 * Removes a previously added listener function. If no function is specified, it will remove all the
	 * listeners of that particular event from the object. Note that if you passed a custom context to `on`, you
	 * must pass the same context to `off` in order to remove the listener.
	 * @template {string} K
	 * @overload
	 * @param {K} type
	 * @param {Listener<K, E, this>} [fn]
	 * @param {unknown} [context]
	 * @returns {this}
	 */
	/**
	 * Removes a set of type/listener pairs.
	 * @template M
	 * @overload
	 * @param {ListenerMap<M, E, this>} eventMap
	 * @param {unknown} [context]
	 * @returns {this}
	 */
	/**
	 * Removes all listeners to all events on the object. This includes implicitly attached events.
	 * @overload
	 * @returns {this}
	 */
	/**
	 * @param {string | object} [types]
	 * @param {any} [fn]
	 * @param {unknown} [context]
	 */
	off(types, fn, context) {

		if (!arguments.length) {
			// clear all listeners if called without arguments
			for (const type of Object.keys(this._events ?? {})) {
				this._off(type);
			}
			this._events = this._eventIndexes = undefined;

		} else if (typeof types === 'object') {
			for (const [type, f] of Object.entries(types)) {
				this._off(type, f, fn);
			}

		} else {
			const removeAll = arguments.length === 1;
			for (const type of splitWords(/** @type {string} */ (types))) {
				if (removeAll) {
					this._off(type);
				} else {
					this._off(type, fn, context);
				}
			}
		}

		return this;
	}

	/** @type {Record<string, string>} */
	static __REMOVED_EVENTS = {
		mousedown: 'pointerdown',
		mouseup: 'pointerup',
		mouseover: 'pointerover',
		mouseout: 'pointerout',
		mousemove: 'pointermove',
		keypress: 'keydown'
	};

	// attach listener (without syntactic sugar now)
	/**
	 * @param {string} type
	 * @param {unknown} fn
	 * @param {unknown} [context]
	 * @param {boolean} [_once]
	 */
	_on(type, fn, context, _once) {
		// To be removed in leaflet 3
		if (Object.hasOwn(Evented.__REMOVED_EVENTS, type) && !warnedEvents.has(type)) {
			warnedEvents.add(type);
			console.error(`The event ${type} has been removed in Leaflet 2. Use ${Evented.__REMOVED_EVENTS[type]} instead.`);
		}

		if (typeof fn !== 'function') {
			console.warn(`wrong listener type: ${typeof fn}`);
			return;
		}

		if (context === this) {
			// Less memory footprint.
			context = undefined;
		}

		this._events ??= {};
		const listeners = this._events[type] ??= [];
		const index = this._eventIndexes?.[type]?.index;

		// check if fn already there
		if (findListener(listeners, index, fn, context)) {
			return;
		}

		/** @type {EventListener} */
		const listener = {fn, ctx: context};
		if (_once) {
			listener.once = true;
		}
		listeners.push(listener);

		if (index) {
			addToIndex(index, listener);

		} else if (listeners.length > INDEX_SIZE) {
			const newIndex = new Map();
			for (const l of listeners) { addToIndex(newIndex, l); }
			(this._eventIndexes ??= {})[type] = {index: newIndex, removed: 0};
		}
	}

	/**
	 * @param {string} type
	 * @param {unknown} [fn]
	 * @param {unknown} [context]
	 */
	_off(type, fn, context) {
		const events = this._events;
		const listeners = events?.[type];
		if (!events || !listeners) {
			return;
		}

		if (arguments.length === 1) { // remove all
			// make sure the listeners are not called if removed during fire
			for (const listener of listeners) {
				listener.fn = removedFn;
			}
			this._removeType(type);
			return;
		}

		if (typeof fn !== 'function') {
			console.warn(`wrong listener type: ${typeof fn}`);
			return;
		}

		if (context === this) {
			context = undefined;
		}

		const indexed = this._eventIndexes?.[type];
		const listener = findListener(listeners, indexed?.index, fn, context);
		if (!listener) {
			return;
		}

		// set the removed listener to noop so that's not called if remove happens in fire
		listener.fn = removedFn;
		listener.ctx = undefined;

		if (!indexed) {
			// a new array rather than in-place removal, in case `fire` is iterating the old one
			if (listeners.length === 1) {
				this._removeType(type);
			} else {
				events[type] = listeners.filter(l => l !== listener);
			}
			return;
		}

		const entry = indexed.index.get(fn);
		if (entry instanceof Map) {
			entry.delete(context);
			if (!entry.size) { indexed.index.delete(fn); }
		} else {
			indexed.index.delete(fn);
		}

		if (++indexed.removed === listeners.length) {
			this._removeType(type);

		} else if (indexed.removed * 2 >= listeners.length) {
			events[type] = listeners.filter(l => l.fn !== removedFn);
			indexed.removed = 0;
		}
	}

	/** @param {string} type */
	_removeType(type) {
		// unset rather than deleted, which would turn the object into a slower and larger dictionary
		if (this._events) { this._events[type] = undefined; }
		if (this._eventIndexes) { this._eventIndexes[type] = undefined; }
	}

	/**
	 * Fires an event of the specified type. You can optionally provide a data object — the first argument of the
	 * listener function will contain its properties. The event can optionally be propagated to event parents.
	 * @param {string} type
	 * @param {object} [data]
	 * @param {boolean} [propagate]
	 */
	fire(type, data, propagate) {
		if (!this.listens(type, propagate)) { return this; }

		/** @type {LeafletEvent} */
		const event = {
			...data,
			type,
			target: this,
			sourceTarget: /** @type {{sourceTarget?: Evented}} */ (data)?.sourceTarget || this
		};

		const listeners = this._events?.[type];
		if (listeners) {
			// listeners added during fire are appended past `length`, so they're only called on the next one
			const {length} = listeners;
			for (let i = 0; i < length; i++) {
				const l = listeners[i];
				// off overwrites these, so we need to copy them first
				const {fn, ctx} = l;
				if (l.once) {
					this.off(type, /** @type {any} */ (fn), ctx);
				}
				fn.call(ctx || this, event);
			}
		}

		if (propagate) {
			// propagate the event to parents (set with addEventParent)
			this._propagateEvent(event);
		}

		return this;
	}

	/**
	 * Returns `true` if a particular event type has any listeners attached to it. The verification can
	 * optionally be propagated, it will return `true` if parents have the listener attached to it.
	 * @overload
	 * @param {string} type
	 * @param {boolean} [propagate]
	 * @returns {boolean}
	 */
	/**
	 * Returns `true` if the given listener function (with the given context) is attached to a particular event
	 * type, optionally checking event parents too.
	 * @template {string} K
	 * @overload
	 * @param {K} type
	 * @param {Listener<K, E, this>} fn
	 * @param {unknown} [context]
	 * @param {boolean} [propagate]
	 * @returns {boolean}
	 */
	/**
	 * @param {string} type
	 * @param {unknown} [fn]
	 * @param {unknown} [context]
	 * @param {boolean} [propagate]
	 */
	listens(type, fn, context, propagate) {
		if (typeof type !== 'string') {
			console.warn('"string" type argument expected');
		}

		// we don't overwrite the input `fn` value, because we need to use it for propagation
		let _fn = fn;
		if (typeof fn !== 'function') {
			propagate = !!fn;
			_fn = undefined;
			context = undefined;
		}

		const listeners = this._events?.[type];
		// a type is unset when its last listener is removed, so if it's there, it has some
		if (listeners && (!_fn || findListener(listeners, this._eventIndexes?.[type]?.index, _fn, context === this ? undefined : context))) {
			return true;
		}

		if (propagate) {
			// also check parents for listeners if event propagates
			for (const p of Object.values(this._eventParents ?? {})) {
				if (p.listens(type, /** @type {any} */ (fn), context, propagate)) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Behaves as [`on(…)`](#evented-on), except the listener will only get fired once and then removed.
	 * @template {string} K
	 * @overload
	 * @param {K} type
	 * @param {Listener<K, E, this>} fn
	 * @param {unknown} [context]
	 * @returns {this}
	 */
	/**
	 * @template M
	 * @overload
	 * @param {ListenerMap<M, E, this>} eventMap
	 * @param {unknown} [context]
	 * @returns {this}
	 */
	/**
	 * @param {string | object} types
	 * @param {any} [fn]
	 * @param {unknown} [context]
	 */
	once(types, fn, context) {

		// types can be a map of types/handlers
		if (typeof types === 'object') {
			for (const [type, f] of Object.entries(types)) {
				// we don't process space-separated events here for performance;
				// it's a hot path since Layer uses the on(obj) syntax
				this._on(type, f, fn, true);
			}

		} else {
			// types can be a string of space-separated words
			for (const type of splitWords(types)) {
				this._on(type, fn, context, true);
			}
		}

		return this;
	}

	/**
	 * Adds an event parent - an `Evented` that will receive propagated events
	 * @param {Evented} obj
	 */
	addEventParent(obj) {
		this._eventParents ??= {};
		this._eventParents[stamp(obj)] = obj;
		return this;
	}

	/**
	 * Removes an event parent, so it will stop receiving propagated events
	 * @param {Evented} obj
	 */
	removeEventParent(obj) {
		if (this._eventParents) {
			delete this._eventParents[stamp(obj)];
		}
		return this;
	}

	/** @param {LeafletEvent} e */
	_propagateEvent(e) {
		for (const p of Object.values(this._eventParents ?? {})) {
			// `layer` is the 1.x name of `propagatedFrom`, left out of the types to steer new code to the new one
			p.fire(e.type, {
				layer: e.target,
				propagatedFrom: e.target,
				...e
			}, true);
		}
	}
}
/**
 * @param {EventListener[]} listeners
 * @param {ListenerIndex | undefined} index
 * @param {unknown} fn
 * @param {unknown} context
 */
function findListener(listeners, index, fn, context) {
	if (!index) { return listeners.find(l => l.fn === fn && l.ctx === context); }
	const entry = index.get(/** @type {Function} */ (fn));
	return entry instanceof Map ? entry.get(context) : entry?.ctx === context ? entry : undefined;
}

/**
 * @param {ListenerIndex} index
 * @param {EventListener} listener
 */
function addToIndex(index, listener) {
	const entry = index.get(listener.fn);
	if (!entry) {
		index.set(listener.fn, listener);
	} else if (entry instanceof Map) {
		entry.set(listener.ctx, listener);
	} else {
		index.set(listener.fn, new Map([[entry.ctx, entry], [listener.ctx, listener]]));
	}
}

/** @import {LeafletMap} from '../map/Map.js' */

/**
 * Abstract class for map interaction handlers, used to inject interaction features like dragging into classes
 * like `Map` and `Marker`. Each built-in map handler listed below is a `Map` property, e.g. `map.dragging`, that can be
 * enabled or disabled at runtime.
 *
 * @categoryDescription Extension methods
 * Classes inheriting from `Handler` must implement the two following methods:
 *
 * @categoryDescription Functions
 * There is static function which can be called without instantiating Handler:
 */
class Handler extends Class {
	static initHooks = true;

	/**
	 * Creates a handler for the given map, disabled until [`enable`](#handler-enable) is called.
	 * @param {LeafletMap} map
	 */
	constructor(map) {
		super();
		this._map = map;
		this.callInitHooks();
	}

	/** Enables the handler */
	enable() {
		if (this._enabled) { return this; }

		this._enabled = true;
		this.addHooks();
		return this;
	}

	/** Disables the handler */
	disable() {
		if (!this._enabled) { return this; }

		this._enabled = false;
		this.removeHooks();
		return this;
	}

	/** Returns `true` if the handler is enabled */
	enabled() {
		return !!this._enabled;
	}

	/**
	 * Called when the handler is enabled, should add event hooks.
	 * @category Extension methods
	 */
	addHooks() {}

	/**
	 * Called when the handler is disabled, should remove the event hooks added previously.
	 * @category Extension methods
	 */
	removeHooks() {}

	/**
	 * Adds a new Handler to the given map with the given name.
	 * @category Functions
	 * @template {typeof Handler} C
	 * @this {C}
	 * @param {LeafletMap} map
	 * @param {string} name
	 */
	static addTo(map, name) {
		map.addHandler(name, this);
		return this;
	}
}

/** @import {Defaults, DragEndEvent, DraggableDefaults, DraggableEventMap, DraggableOptions, DragStartEvent,
 *    LeafletEvent} from '../types.js' */

const defaultOptions$c = {
	/**
	 * The max number of pixels a user can shift the pointer during a click for
	 * it to be considered a valid click (as opposed to a pointer drag).
	 */
	clickTolerance: 3
};

/** @typedef {typeof defaultOptions} DraggableDefaultsValues */

/**
 * @typedef {Object} DraggableEvents
 * @property {LeafletEvent} down Fired when a drag is about to start.
 * @property {DragStartEvent} dragstart Fired when a drag starts.
 * @property {LeafletEvent} predrag Fired continuously during dragging *before* each corresponding update of the
 *   element's position.
 * @property {LeafletEvent} drag Fired continuously during dragging.
 * @property {DragEndEvent} dragend Fired when the drag ends.
 */

/**
 * @typedef {Object} DragStartEventProps
 * @property {PointerEvent | KeyboardEvent} originalEvent The DOM event that started the drag: the `pointermove` that
 *   moved the pointer past `clickTolerance` (not the `pointerdown`), or the `keydown` of an arrow key that moves a
 *   focused draggable marker.
 */

/**
 * @typedef {Object} DragEndEventProps
 * @property {number} distance The distance in pixels the draggable element was moved by.
 * @property {boolean} [noInertia] Whether the drag should end without inertia (set when the
 *   draggable is disabled mid-drag).
 */

/**
 * A class for making DOM elements draggable. Used internally
 * for map and marker dragging. Works on any DOM element
 * @example
 * ```js
 * const draggable = new Draggable(elementToDrag);
 * draggable.enable();
 * ```
 *
 * @extends {Evented<DraggableOptions & DraggableDefaults, DraggableEventMap>}
 */
class Draggable extends Evented {

	static initHooks = true;

	/** @type {Defaults<DraggableOptions>} */
	static defaultOptions = defaultOptions$c;

	// the draggable being dragged, so that only one is dragged at a time
	/** @type {Draggable | false} */
	static _dragging = false;

	/**
	 * Creates a `Draggable` object for moving `element` when you start dragging
	 * the `dragStartTarget` element (equals `element` itself by default).
	 * @param {HTMLElement} element
	 * @param {HTMLElement} [dragStartTarget]
	 * @param {Partial<DraggableOptions>} [options]
	 */
	constructor(element, dragStartTarget, options) {
		if (typeof options === 'boolean') {
			throw new Error('Draggable: the preventOutline argument is removed in Leaflet 2. Pass options as the third argument.');
		}
		super();

		setOptions(this, options);

		this._element = element;
		this._dragStartTarget = dragStartTarget ?? element;

		this.callInitHooks();
	}

	/** Enables the dragging ability */
	enable() {
		if (this._enabled) { return; }

		on(this._dragStartTarget, 'pointerdown', this._onDown, this);

		this._enabled = true;
	}

	/** Disables the dragging ability */
	disable() {
		if (!this._enabled) { return; }

		// If we're currently dragging this draggable,
		// disabling it counts as first ending the drag.
		if (Draggable._dragging === this) {
			this.finishDrag(true);
		}

		off(this._dragStartTarget, 'pointerdown', this._onDown, this);

		this._enabled = false;
		this._moved = false;
	}

	/** @param {PointerEvent} e */
	_onDown(e) {
		this._moved = false;

		const pointers = getPointers().length;
		if (pointers > 1) {
			// Finish dragging to avoid conflict with touchZoom
			if (Draggable._dragging === this) {
				this.finishDrag();
			}
			return;
		}

		const boxZoom = e.shiftKey && this._element.closest('.leaflet-container')?.classList.contains('leaflet-box-zoom');
		if (Draggable._dragging || boxZoom || (e.button !== 0 && e.pointerType !== 'touch')) { return; }
		Draggable._dragging = this;  // Prevent dragging multiple objects at once.

		disableImageDrag();

		if (this._moving) { return; }

		// outside a map, nothing tracks pointers or captures them, so capture this one to keep its moves coming
		if (!pointers && e.isTrusted) { /** @type {Element} */ (e.target).setPointerCapture(e.pointerId); }

		this.fire('down');

		const sizedParent = getSizedParentNode(this._element);

		/** @type {Point} */
		this._startPoint = new Point(e.clientX, e.clientY);
		/** @type {Point} */
		this._startPos = getPosition(this._element);

		// Cache the scale, so that we can continuously compensate for it during drag (_onMove).
		/** @type {{x: number, y: number}} */
		this._parentScale = getScale(sizedParent);

		on(this._dragStartTarget, 'pointermove', this._onMove, this);
		on(this._dragStartTarget, 'pointerup pointercancel lostpointercapture', this._onUp, this);
	}

	/** @param {PointerEvent} e */
	_onMove(e) {
		if (getPointers().length > 1) {
			this._moved = true;
			return;
		}

		const offset = new Point(e.clientX, e.clientY)._subtract(this._startPoint);

		// once the drag has started, the pointer must be followed even when it comes back near the start point
		const dist = Math.abs(offset.x) + Math.abs(offset.y);
		if (!this._moved && (!dist || dist < this.options.clickTolerance)) { return; }

		// We assume that the parent container's position, border and scale do not change for the duration of the drag.
		// Therefore there is no need to account for the position and border (they are eliminated by the subtraction)
		// and we can use the cached value for the scale.
		offset.x /= this._parentScale.x;
		offset.y /= this._parentScale.y;

		if (e.cancelable) {
			e.preventDefault();
		}

		/** @type {PointerEvent} */
		this._lastEvent = e;

		if (!this._moved) {
			this.fire('dragstart', {originalEvent: e});

			this._moved = true;

			// on the map container rather than the body, so that toggling it doesn't restyle the whole page
			this._draggingContainer = this._element.closest('.leaflet-container') ?? this._element;
			this._draggingContainer.classList.add('leaflet-dragging');

			/** @type {Element | null} */
			this._lastTarget = /** @type {Element} */ (e.target);
			this._lastTarget.classList.add('leaflet-drag-target');
		}

		/** @type {Point} */
		this._newPos = this._startPos.add(offset);
		this._moving = true;

		this._updatePosition();
	}

	_updatePosition() {
		const e = {originalEvent: this._lastEvent};

		this.fire('predrag', e);

		// pointer events can have fractional coordinates; snap them to device pixels, since an edge in the middle of
		// one is drawn partly transparent on both sides and shows a seam between tiles
		const dpr = window.devicePixelRatio;
		this._newPos = this._newPos.multiplyBy(dpr)._round()._divideBy(dpr);
		setPosition(this._element, this._newPos);

		this.fire('drag', e);
	}

	/** @param {PointerEvent} e */
	_onUp(e) {
		// releasing the button outside the window may fire no pointerup, only a lostpointercapture with no buttons;
		// capture lost while the button is still held (e.g. the pressed element was removed) shouldn't end the drag
		if (e.type === 'lostpointercapture' && e.buttons) { return; }
		this.finishDrag();
	}

	/**
	 * Ends the current drag, firing `dragend` if the element was moved. `noInertia` is passed on in the event, so
	 * that the map doesn't keep panning after a drag ended this way.
	 * @param {boolean} [noInertia]
	 */
	finishDrag(noInertia) {
		this._draggingContainer?.classList.remove('leaflet-dragging');
		this._draggingContainer = null;

		this._lastTarget?.classList.remove('leaflet-drag-target');
		this._lastTarget = null;

		off(this._dragStartTarget, 'pointermove', this._onMove, this);
		off(this._dragStartTarget, 'pointerup pointercancel lostpointercapture', this._onUp, this);

		enableImageDrag();

		const fireDragend = this._moved && this._moving;

		this._moving = false;
		Draggable._dragging = false;

		if (fireDragend) {
			this.fire('dragend', {
				noInertia,
				distance: this._newPos.distanceTo(this._startPos)
			});
		}
	}

}

/** @import {PointExpression, PointTuple} from './Point.js' */

/** @typedef {PointTuple[]} BoundsLiteral */

/**
 * A `Bounds`, or an array of the points it should contain (usually two opposite corners).
 * @typedef {Bounds | PointExpression[]} BoundsExpression
 */

/**
 * Represents a rectangular area in pixel coordinates.
 *
 * @example
 * ```js
 * const p1 = new Point(10, 10),
 * p2 = new Point(40, 60),
 * bounds = new Bounds(p1, p2);
 * ```
 *
 * All Leaflet methods that accept `Bounds` objects also accept them in a simple Array form (unless noted
 * otherwise), so the bounds example above can be passed like this:
 *
 * ```js
 * otherBounds.intersects([[10, 10], [40, 60]]);
 * ```
 *
 * Note that `Bounds` does not inherit from Leaflet's `Class` object, which means new classes can't inherit from it,
 * and new methods can't be added to it with the `include` function.
 */
class Bounds {
	/**
	 * Creates a Bounds object from two corners coordinate pairs.
	 * @overload
	 * @param {PointExpression} corner1
	 * @param {PointExpression} corner2
	 */
	/**
	 * Creates a Bounds object from the given array of points.
	 * @overload
	 * @param {BoundsExpression} points
	 */
	/**
	 * Creates an empty Bounds object, to be filled with [`extend`](#bounds-extend).
	 * @overload
	 */
	/**
	 * @param {any} [a]
	 * @param {PointExpression} [b]
	 */
	constructor(a, b) {
		if (!a) { return; }

		if (a instanceof Bounds) {
			// We can use the same object, no need to clone it
			// eslint-disable-next-line no-constructor-return
			return a;
		}

		const points = b ? [a, b] : a;
		for (const point of points) {
			this.extend(point);
		}
	}

	/**
	 * Extends the bounds to contain the given point or bounds.
	 * @param {PointExpression | BoundsExpression} obj
	 */
	extend(obj) {
		let min2, max2;
		if (!obj) { return this; }

		if (isPointExpression(obj)) {
			min2 = max2 = new Point(obj);
		} else {
			({min: min2, max: max2} = new Bounds(obj));
			if (!min2) { return this; }
		}

		if (!this.min) {
			/**
			 * The top left corner of the rectangle.
			 * @type {Point}
			 */
			this.min = min2.clone();
			/**
			 * The bottom right corner of the rectangle.
			 * @type {Point}
			 */
			this.max = max2.clone();
		} else {
			this.min.x = Math.min(min2.x, this.min.x);
			this.max.x = Math.max(max2.x, this.max.x);
			this.min.y = Math.min(min2.y, this.min.y);
			this.max.y = Math.max(max2.y, this.max.y);
		}
		return this;
	}

	/**
	 * Returns the center point of the bounds.
	 * @param {boolean} [round]
	 */
	getCenter(round) {
		return new Point(
			(this.min.x + this.max.x) / 2,
			(this.min.y + this.max.y) / 2, round);
	}

	/** Returns the bottom-left point of the bounds. */
	getBottomLeft() {
		return new Point(this.min.x, this.max.y);
	}

	/** Returns the top-right point of the bounds. */
	getTopRight() {
		return new Point(this.max.x, this.min.y);
	}

	/** Returns the top-left point of the bounds (i.e. [`this.min`](#bounds-min)). */
	getTopLeft() {
		return this.min; // left, top
	}

	/** Returns the bottom-right point of the bounds (i.e. [`this.max`](#bounds-max)). */
	getBottomRight() {
		return this.max; // right, bottom
	}

	/** Returns the size of the given bounds */
	getSize() {
		return this.max.subtract(this.min);
	}

	/**
	 * Returns `true` if the rectangle contains the given point or bounds.
	 * @param {PointExpression | BoundsExpression} obj
	 */
	contains(obj) {
		let min, max;

		if (isPointExpression(obj)) {
			min = max = new Point(obj);
		} else {
			({min, max} = new Bounds(obj));
		}

		return (min.x >= this.min.x) &&
		       (max.x <= this.max.x) &&
		       (min.y >= this.min.y) &&
		       (max.y <= this.max.y);
	}

	/**
	 * Returns `true` if the rectangle intersects the given bounds. Two
	 * bounds intersect if they have at least one point in common.
	 * @param {BoundsExpression} bounds
	 */
	intersects(bounds) {
		bounds = new Bounds(bounds);

		const min = this.min,
		max = this.max,
		min2 = bounds.min,
		max2 = bounds.max,
		xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
		yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

		return xIntersects && yIntersects;
	}

	/**
	 * Returns `true` if the rectangle overlaps the given bounds.
	 * Two bounds overlap if their intersection is an area.
	 * @param {BoundsExpression} bounds
	 */
	overlaps(bounds) {
		bounds = new Bounds(bounds);

		const min = this.min,
		max = this.max,
		min2 = bounds.min,
		max2 = bounds.max,
		xOverlaps = Math.max(min.x, min2.x) < Math.min(max.x, max2.x),
		yOverlaps = Math.max(min.y, min2.y) < Math.min(max.y, max2.y);

		return xOverlaps && yOverlaps;
	}

	/** Returns `true` if the bounds are properly initialized. */
	isValid() {
		return !!(this.min && this.max);
	}


	/**
	 * Returns bounds created by extending or retracting the current bounds by a given ratio in each direction. For
	 * example, a ratio of 0.5 extends the bounds by 50% in each direction. Negative values will retract the bounds.
	 * @param {number} bufferRatio
	 */
	pad(bufferRatio) {
		const min = this.min,
		max = this.max,
		heightBuffer = Math.abs(min.x - max.x) * bufferRatio,
		widthBuffer = Math.abs(min.y - max.y) * bufferRatio;


		return new Bounds(
			new Point(min.x - heightBuffer, min.y - widthBuffer),
			new Point(max.x + heightBuffer, max.y + widthBuffer));
	}


	/**
	 * Returns `true` if the rectangle is equivalent to the given bounds.
	 * @param {BoundsExpression} [bounds]
	 */
	equals(bounds) {
		if (!bounds) { return false; }

		bounds = new Bounds(bounds);

		return this.min.equals(bounds.getTopLeft()) &&
			this.max.equals(bounds.getBottomRight());
	}
}

/**
 * @param {PointExpression | BoundsExpression} obj
 * @returns {obj is PointExpression}
 */
function isPointExpression(obj) {
	return obj instanceof Point || (Array.isArray(obj) ? obj.length > 0 && typeof obj[0] !== 'object' : 'x' in obj);
}

/** @import {LatLngExpression, LatLngTuple} from './LatLng.js' */

/** @typedef {LatLngTuple[]} LatLngBoundsLiteral */

/**
 * A `LatLngBounds`, or an array of the points it should contain (usually two opposite corners).
 * @typedef {LatLngBounds | LatLngExpression[]} LatLngBoundsExpression
 */

// TODO International date line?

/**
 * Represents a rectangular geographical area on a map.
 *
 * @example
 * ```js
 * const corner1 = new LatLng(40.712, -74.227),
 * corner2 = new LatLng(40.774, -74.125),
 * bounds = new LatLngBounds(corner1, corner2);
 * ```
 *
 * All Leaflet methods that accept LatLngBounds objects also accept them in a simple Array form (unless noted
 * otherwise), so the bounds example above can be passed like this:
 *
 * ```js
 * map.fitBounds([
 * 	[40.712, -74.227],
 * 	[40.774, -74.125]
 * ]);
 * ```
 *
 * Caution: if the area crosses the antimeridian (often confused with the International Date Line), you must specify
 * corners _outside_ the [-180, 180] degrees longitude range.
 *
 * Note that `LatLngBounds` does not inherit from Leaflet's `Class` object, which means new classes can't inherit
 * from it, and new methods can't be added to it with the `include` function.
 */
class LatLngBounds {
	/**
	 * Creates a `LatLngBounds` object by defining two diagonally opposite corners of the rectangle.
	 * @overload
	 * @param {LatLngExpression} corner1
	 * @param {LatLngExpression} corner2
	 */
	/**
	 * Creates a `LatLngBounds` object defined by the geographical points it contains. Very useful for
	 * zooming the map to fit a particular set of locations with [`fitBounds`](#map-fitbounds).
	 * @overload
	 * @param {LatLngBoundsExpression} latlngs
	 */
	/**
	 * Creates an empty `LatLngBounds` object, to be filled with [`extend`](#latlngbounds-extend).
	 * @overload
	 */
	/**
	 * @param {any} [corner1]
	 * @param {LatLngExpression} [corner2]
	 */
	constructor(corner1, corner2) {
		if (!corner1) { return; }

		if (corner1 instanceof LatLngBounds) {
			// We can use the same object, no need to clone it
			// eslint-disable-next-line no-constructor-return
			return corner1;
		}

		const latlngs = corner2 ? [corner1, corner2] : corner1;

		for (const latlng of latlngs) {
			this.extend(latlng);
		}
	}

	/**
	 * Extend the bounds to contain the given point or bounds.
	 * @param {LatLngExpression | LatLngBoundsExpression} obj
	 * @returns {this}
	 */
	extend(obj) {
		const sw = this._southWest,
		ne = this._northEast;
		let sw2, ne2;

		if (obj instanceof LatLng) {
			sw2 = ne2 = obj;
		} else if (obj instanceof LatLngBounds) {
			({_southWest: sw2, _northEast: ne2} = obj);
			if (!sw2) { return this; }
		} else if (isLatLngExpression(obj)) {
			sw2 = ne2 = new LatLng(obj);
		} else {
			return this.extend(new LatLngBounds(obj));
		}

		if (!sw) {
			/** @type {LatLng} */
			this._southWest = new LatLng(sw2.lat, sw2.lng);
			/** @type {LatLng} */
			this._northEast = new LatLng(ne2.lat, ne2.lng);
		} else {
			sw.lat = Math.min(sw2.lat, sw.lat);
			sw.lng = Math.min(sw2.lng, sw.lng);
			ne.lat = Math.max(ne2.lat, ne.lat);
			ne.lng = Math.max(ne2.lng, ne.lng);
		}

		return this;
	}

	/**
	 * Returns bounds created by extending or retracting the current bounds by a given ratio in each direction. For
	 * example, a ratio of 0.5 extends the bounds by 50% in each direction. Negative values will retract the bounds.
	 * @param {number} bufferRatio
	 */
	pad(bufferRatio) {
		const sw = this._southWest,
		ne = this._northEast,
		heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio,
		widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;

		return new LatLngBounds(
			new LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
			new LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
	}

	/** Returns the center point of the bounds. */
	getCenter() {
		return new LatLng(
			(this._southWest.lat + this._northEast.lat) / 2,
			(this._southWest.lng + this._northEast.lng) / 2);
	}

	/** Returns the south-west point of the bounds. */
	getSouthWest() {
		return this._southWest;
	}

	/** Returns the north-east point of the bounds. */
	getNorthEast() {
		return this._northEast;
	}

	/** Returns the north-west point of the bounds. */
	getNorthWest() {
		return new LatLng(this.getNorth(), this.getWest());
	}

	/** Returns the south-east point of the bounds. */
	getSouthEast() {
		return new LatLng(this.getSouth(), this.getEast());
	}

	/** Returns the west longitude of the bounds */
	getWest() {
		return this._southWest.lng;
	}

	/** Returns the south latitude of the bounds */
	getSouth() {
		return this._southWest.lat;
	}

	/** Returns the east longitude of the bounds */
	getEast() {
		return this._northEast.lng;
	}

	/** Returns the north latitude of the bounds */
	getNorth() {
		return this._northEast.lat;
	}

	/**
	 * Returns `true` if the rectangle contains the given point or bounds.
	 * @param {LatLngExpression | LatLngBoundsExpression} obj
	 */
	contains(obj) {
		const sw = this._southWest,
		ne = this._northEast;
		let sw2, ne2;

		if (isLatLngExpression(obj)) {
			sw2 = ne2 = new LatLng(obj);
		} else {
			({_southWest: sw2, _northEast: ne2} = new LatLngBounds(obj));
		}

		return (sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
		       (sw2.lng >= sw.lng) && (ne2.lng <= ne.lng);
	}

	/**
	 * Returns `true` if the rectangle intersects the given bounds. Two
	 * bounds intersect if they have at least one point in common.
	 * @param {LatLngBoundsExpression} bounds
	 */
	intersects(bounds) {
		bounds = new LatLngBounds(bounds);

		const sw = this._southWest,
		ne = this._northEast,
		sw2 = bounds.getSouthWest(),
		ne2 = bounds.getNorthEast(),

		latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat),
		lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);

		return latIntersects && lngIntersects;
	}

	/**
	 * Returns `true` if the rectangle overlaps the given bounds.
	 * Two bounds overlap if their intersection is an area.
	 * @param {LatLngBoundsExpression} bounds
	 */
	overlaps(bounds) {
		bounds = new LatLngBounds(bounds);

		const sw = this._southWest,
		ne = this._northEast,
		sw2 = bounds.getSouthWest(),
		ne2 = bounds.getNorthEast(),

		latOverlaps = Math.max(sw.lat, sw2.lat) < Math.min(ne.lat, ne2.lat),
		lngOverlaps = Math.max(sw.lng, sw2.lng) < Math.min(ne.lng, ne2.lng);

		return latOverlaps && lngOverlaps;
	}

	/**
	 * Returns a string with bounding box coordinates in a 'southwest_lng,southwest_lat,northeast_lng,northeast_lat'
	 * format. Useful for sending requests to web services that return geo data.
	 */
	toBBoxString() {
		return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
	}

	/**
	 * Returns `true` if the rectangle is equivalent (within a small margin of error) to the given
	 * bounds. The margin of error can be overridden by setting `maxMargin` to a small number.
	 * @param {LatLngBoundsExpression} [bounds]
	 * @param {number} [maxMargin]
	 */
	equals(bounds, maxMargin) {
		if (!bounds) { return false; }

		bounds = new LatLngBounds(bounds);

		return this._southWest.equals(bounds.getSouthWest(), maxMargin) &&
		       this._northEast.equals(bounds.getNorthEast(), maxMargin);
	}

	/** Returns `true` if the bounds are properly initialized. */
	isValid() {
		return !!(this._southWest && this._northEast);
	}
}

/**
 * @param {LatLngExpression | LatLngBoundsExpression} obj
 * @returns {obj is LatLngExpression}
 */
function isLatLngExpression(obj) {
	return obj instanceof LatLng || (Array.isArray(obj) ? obj.length > 0 && typeof obj[0] !== 'object' :
		typeof obj === 'object' && obj !== null && 'lat' in obj);
}

/** @typedef {[number, number, number?]} LatLngTuple */
/**
 * A geographical point as a plain object.
 * @typedef {Object} LatLngLiteral
 * @property {number} lat Latitude in degrees.
 * @property {number} lng Longitude in degrees.
 * @property {number} [alt] Altitude in meters.
 */

/**
 * A `LatLng`, or its array (`[lat, lng]`, `[lat, lng, alt]`) or object (`{lat, lng}`, `{lat, lon}`) form.
 * @typedef {LatLng | LatLngTuple | LatLngLiteral | {lat: number, lon: number, alt?: number}} LatLngExpression
 */

/**
 * Represents a geographical point with a certain latitude and longitude.
 *
 * @example
 * ```js
 * const latlng = new LatLng(50.5, 30.5);
 * ```
 *
 * All Leaflet methods that accept LatLng objects also accept them in a simple Array form and simple object form
 * (unless noted otherwise), so these lines are equivalent:
 *
 * ```js
 * map.panTo([50, 30]);
 * map.panTo({lat: 50, lng: 30});
 * map.panTo({lat: 50, lon: 30});
 * map.panTo(new LatLng(50, 30));
 * ```
 *
 * Note that `LatLng` does not inherit from Leaflet's `Class` object, which means new classes can't inherit from it,
 * and new methods can't be added to it with the `include` function.
 *
 * @categoryDescription Functions
 * There are several static functions which can be called without instantiating LatLng:
 */
class LatLng {
	/**
	 * Creates an object representing a geographical point with the given latitude and longitude (and optionally
	 * altitude).
	 * @overload
	 * @param {number} lat
	 * @param {number} lng
	 * @param {number} [alt]
	 */
	/**
	 * Expects an array of the form `[Number, Number]` or `[Number, Number, Number]`, or a plain object of the form
	 * `{lat: Number, lng: Number}` or `{lat: Number, lng: Number, alt: Number}` instead. You can also use `lon` in
	 * place of `lng` in the object form.
	 * @overload
	 * @param {LatLngExpression} coords
	 */
	/**
	 * @param {any} lat
	 * @param {number} [lng]
	 * @param {number} [alt]
	 */
	constructor(lat, lng, alt) {
		if (lat instanceof LatLng) {
			// We can use the same object, no need to clone it
			// eslint-disable-next-line no-constructor-return
			return lat;
		}

		let _lat = lat, _lng = lng, _alt = alt;
		if (Array.isArray(lat)) {
			_lat = lat.length <= 3 ? lat[0] : NaN;
			_lng = lat[1];
			_alt = lat[2];
		} else if (typeof lat === 'object' && lat !== null) {
			_lat = lat.lat;
			_lng = 'lng' in lat ? lat.lng : lat.lon;
			_alt = lat.alt;
		}

		/**
		 * Latitude in degrees
		 * @type {number}
		 */
		this.lat = toNumber(_lat);

		/**
		 * Longitude in degrees
		 * @type {number}
		 */
		this.lng = toNumber(_lng);

		if (isNaN(this.lat) || isNaN(this.lng)) {
			throw new Error(`Invalid LatLng object: (${_lat}, ${_lng})`);
		}

		if (_alt != null) {
			/**
			 * Altitude in meters (optional)
			 * @type {number | undefined}
			 */
			this.alt = toNumber(_alt);

			if (isNaN(this.alt)) {
				throw new Error(`Invalid LatLng altitude: ${_alt}`);
			}
		}
	}

	/**
	 * Returns `true` if the LatLng object can be properly initialized.
	 * @category Functions
	 * @overload
	 * @param {number} lat
	 * @param {number} [lng]
	 * @param {number} [alt]
	 * @returns {boolean}
	 */
	/**
	 * Expects an array of the form `[Number, Number]` or `[Number, Number, Number]`, or a plain object of the form
	 * `{lat: Number, lng: Number}`. Returns `true` if the LatLng object can be properly initialized.
	 * @overload
	 * @param {LatLngExpression} coords
	 * @returns {boolean}
	 */
	/**
	 * @param {any} lat
	 * @param {any} [lng]
	 * @param {any} [alt]
	 */
	static validate(lat, lng, alt) {
		try {
			return !!new LatLng(lat, lng, alt);
		} catch {
			return false;
		}
	}

	/**
	 * Returns `true` if the given `LatLng` point is at the same position (within a small margin of
	 * error). The margin of error can be overridden by setting `maxMargin` to a small number.
	 * @param {LatLngExpression} [obj]
	 * @param {number} [maxMargin]
	 */
	equals(obj, maxMargin) {
		if (!obj) { return false; }

		obj = new LatLng(obj);

		const margin = Math.max(
			Math.abs(this.lat - obj.lat),
			Math.abs(this.lng - obj.lng));

		return margin <= (maxMargin ?? 1.0E-9);
	}

	/**
	 * Returns a string representation of the point (for debugging purposes).
	 * @param {number} [precision]
	 */
	toString(precision) {
		return `LatLng(${formatNum(this.lat, precision)}, ${formatNum(this.lng, precision)})`;
	}

	/**
	 * Returns the distance (in meters) to the given `LatLng` calculated using the
	 * [Haversine formula](https://en.wikipedia.org/wiki/Haversine_formula).
	 * @param {LatLngExpression} other
	 */
	distanceTo(other) {
		return haversineDistance(this, new LatLng(other), 6371000);
	}

	/** Returns a new `LatLng` object with the longitude wrapped so it's always between -180 and +180 degrees. */
	wrap() {
		return new LatLng(this.lat, wrapNum(this.lng, [-180, 180], true), this.alt);
	}

	/**
	 * Returns a new `LatLngBounds` object in which each boundary is `sizeInMeters/2` meters apart from the `LatLng`.
	 * @param {number} sizeInMeters
	 */
	toBounds(sizeInMeters) {
		const latAccuracy = 180 * sizeInMeters / 40075017,
		lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);

		return new LatLngBounds(
			[this.lat - latAccuracy, this.lng - lngAccuracy],
			[this.lat + latAccuracy, this.lng + lngAccuracy]);
	}

	/** Returns a copy of the current LatLng. */
	clone() {
		// to skip the validation in the constructor we need to initialize with 0 and then set the values later
		const latlng = new LatLng(0, 0);
		latlng.lat = this.lat;
		latlng.lng = this.lng;
		if (this.alt !== undefined) {
			latlng.alt = this.alt;
		}
		return latlng;
	}
}
/**
 * Great-circle distance on a sphere of radius R, shared with `EarthCRS.distance`.
 * @param {LatLng} latlng1
 * @param {LatLng} latlng2
 * @param {number} R
 */
function haversineDistance(latlng1, latlng2, R) {
	const rad = Math.PI / 180,
	lat1 = latlng1.lat * rad,
	lat2 = latlng2.lat * rad,
	sinDLat = Math.sin((latlng2.lat - latlng1.lat) * rad / 2),
	sinDLon = Math.sin((latlng2.lng - latlng1.lng) * rad / 2),
	// clamp, since rounding can push this slightly above 1 for antipodal points and make `sqrt(1 - a)` NaN
	a = Math.min(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon, 1),
	c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

/**
 * @import {Bounds} from './Bounds.js'
 * @import {CRS} from '../geo/crs/CRS.js'
 * @import {LatLngExpression} from '../types.js'
 */

/**
 * Various utility functions for polyline points processing, used by Leaflet internally to make polylines
 * lightning-fast.
 * @module LineUtil
 */

/**
 * Dramatically reduces the number of points in a polyline while retaining its shape and returns a new
 * array of simplified points, using the [Ramer-Douglas-Peucker
 * algorithm](https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm). Used for a huge performance
 * boost when processing/displaying Leaflet polylines for each zoom level and also reducing visual noise.
 * tolerance affects the amount of simplification (lesser value means higher quality but slower and with
 * more points). Also released as a separated micro-library
 * [Simplify.js](https://mourner.github.io/simplify-js/).
 * @param {Point[]} points
 * @param {number} tolerance
 */
function simplify(points, tolerance) {
	if (!tolerance || !points.length) {
		return points.slice();
	}

	const sqTolerance = tolerance * tolerance;

	// stage 1: vertex reduction
	points = _reducePoints(points, sqTolerance);

	// stage 2: Douglas-Peucker simplification
	points = _simplifyDP(points, sqTolerance);

	return points;
}

/**
 * Returns the distance between point `p` and segment `p1` to `p2`.
 * @param {Point} p
 * @param {Point} p1
 * @param {Point} p2
 */
function pointToSegmentDistance(p, p1, p2) {
	return Math.sqrt(_sqClosestPointOnSegment(p, p1, p2, true));
}

// Ramer-Douglas-Peucker simplification, see https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm
/**
 * @param {Point[]} points
 * @param {number} sqTolerance
 */
function _simplifyDP(points, sqTolerance) {

	const len = points.length,
	markers = new Uint8Array(len);
	markers[0] = markers[len - 1] = 1;

	_simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

	let i;
	const newPoints = [];

	for (i = 0; i < len; i++) {
		if (markers[i]) {
			newPoints.push(points[i]);
		}
	}

	return newPoints;
}

/**
 * @param {Point[]} points
 * @param {Uint8Array} markers
 * @param {number} sqTolerance
 * @param {number} first
 * @param {number} last
 */
function _simplifyDPStep(points, markers, sqTolerance, first, last) {

	let maxSqDist = 0,
	index = 0, i, sqDist;

	for (i = first + 1; i <= last - 1; i++) {
		sqDist = _sqClosestPointOnSegment(points[i], points[first], points[last], true);

		if (sqDist > maxSqDist) {
			index = i;
			maxSqDist = sqDist;
		}
	}

	if (maxSqDist > sqTolerance) {
		markers[index] = 1;

		_simplifyDPStep(points, markers, sqTolerance, first, index);
		_simplifyDPStep(points, markers, sqTolerance, index, last);
	}
}

// reduce points that are too close to each other to a single point
/**
 * @param {Point[]} points
 * @param {number} sqTolerance
 */
function _reducePoints(points, sqTolerance) {
	const reducedPoints = [points[0]];
	let prev = 0;

	for (let i = 1; i < points.length; i++) {
		if (_sqDist(points[i], points[prev]) > sqTolerance) {
			reducedPoints.push(points[i]);
			prev = i;
		}
	}
	if (prev < points.length - 1) {
		reducedPoints.push(points[points.length - 1]);
	}
	return reducedPoints;
}

/** @type {number} */
let _lastCode;

/**
 * Clips the segment a to b by rectangular bounds with the [Cohen-Sutherland
 * algorithm](https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm). Used by Leaflet to only show
 * polyline points that are on the screen or near, increasing performance. Returns the clipped endpoints (new points
 * where clipped, rounded with `round`), or `false` if the segment is entirely outside the bounds. `useLastCode`
 * reuses the bit code of `b` from the previous call as the code of `a`, for clipping consecutive segments of a line.
 * @param {Point} a
 * @param {Point} b
 * @param {Bounds} bounds
 * @param {boolean} [useLastCode]
 * @param {boolean} [round]
 * @returns {[Point, Point] | false}
 */
function clipSegment(a, b, bounds, useLastCode, round) {
	let codeA = useLastCode ? _lastCode : _getBitCode(a, bounds),
	codeB = _getBitCode(b, bounds),

	codeOut, p, newCode;

	// save 2nd code to avoid calculating it on the next segment
	_lastCode = codeB;

	while (true) {
		// if a,b is inside the clip window (trivial accept)
		if (!(codeA | codeB)) {
			return [a, b];
		}

		// if a,b is outside the clip window (trivial reject)
		if (codeA & codeB) {
			return false;
		}

		// other cases
		codeOut = codeA || codeB;
		p = _getEdgeIntersection(a, b, codeOut, bounds);
		newCode = _getBitCode(p, bounds);

		if (codeOut === codeA) {
			a = p;
			codeA = newCode;
		} else {
			b = p;
			codeB = newCode;
		}
	}
}

/**
 * @param {Point} a
 * @param {Point} b
 * @param {number} code
 * @param {Bounds} bounds
 * @param {boolean} [round]
 */
function _getEdgeIntersection(a, b, code, bounds, round) {
	const dx = b.x - a.x,
	dy = b.y - a.y,
	min = bounds.min,
	max = bounds.max;
	let x, y;

	if (code & 8) { // top
		x = a.x + dx * (max.y - a.y) / dy;
		y = max.y;

	} else if (code & 4) { // bottom
		x = a.x + dx * (min.y - a.y) / dy;
		y = min.y;

	} else if (code & 2) { // right
		x = max.x;
		y = a.y + dy * (max.x - a.x) / dx;

	} else { // left
		x = min.x;
		y = a.y + dy * (min.x - a.x) / dx;
	}

	return new Point(x, y, round);
}

/**
 * @param {Point} p
 * @param {Bounds} bounds
 */
function _getBitCode(p, bounds) {
	let code = 0;

	if (p.x < bounds.min.x) { // left
		code |= 1;
	} else if (p.x > bounds.max.x) { // right
		code |= 2;
	}

	if (p.y < bounds.min.y) { // bottom
		code |= 4;
	} else if (p.y > bounds.max.y) { // top
		code |= 8;
	}

	return code;
}

// square distance (to avoid unnecessary Math.sqrt calls)
/**
 * @param {Point} p1
 * @param {Point} p2
 */
function _sqDist(p1, p2) {
	const dx = p2.x - p1.x,
	dy = p2.y - p1.y;
	return dx * dx + dy * dy;
}

// return closest point on segment or distance to that point
/**
 * @overload
 * @param {Point} p
 * @param {Point} p1
 * @param {Point} p2
 * @param {true} sqDist
 * @returns {number}
 */
/**
 * @overload
 * @param {Point} p
 * @param {Point} p1
 * @param {Point} p2
 * @param {false} [sqDist]
 * @returns {Point}
 */
/**
 * @param {Point} p
 * @param {Point} p1
 * @param {Point} p2
 * @param {boolean} [sqDist]
 */
function _sqClosestPointOnSegment(p, p1, p2, sqDist) {
	let x = p1.x,
	y = p1.y,
	dx = p2.x - x,
	dy = p2.y - y,
	t;
	const dot = dx * dx + dy * dy;

	if (dot > 0) {
		t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

		if (t > 1) {
			x = p2.x;
			y = p2.y;
		} else if (t > 0) {
			x += dx * t;
			y += dy * t;
		}
	}

	dx = p.x - x;
	dy = p.y - y;

	return sqDist ? dx * dx + dy * dy : new Point(x, y);
}


/**
 * An array of `T`s, nested up to 3 levels deep, like the points of a line, the rings of a polygon or the polygons
 * of a multipolygon.
 * @template T
 * @typedef {T[] | T[][] | T[][][]} NestedCoords
 */

/**
 * Returns true if `latlngs` is a flat array, false is nested.
 * @template {object} T
 * @param {NestedCoords<T>} latlngs
 * @returns {latlngs is T[]}
 */
function isFlat(latlngs) {
	return !Array.isArray(latlngs[0]) || (typeof latlngs[0][0] !== 'object' && typeof latlngs[0][0] !== 'undefined');
}

/**
 * Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid))
 * of the passed LatLngs (first ring) from a polyline.
 * @param {LatLngExpression[]} latlngs
 * @param {typeof CRS} crs
 */
function polylineCenter(latlngs, crs) {
	const points = _projectRing(latlngs, crs),
	len = points.length;

	let halfDist = 0;
	for (let i = 1; i < len; i++) {
		halfDist += points[i - 1].distanceTo(points[i]);
	}
	halfDist /= 2;

	// if the line has zero length, the loop below never finds a segment and the first point is the center
	let center = points[0];

	for (let i = 1, dist = 0; i < len; i++) {
		const p1 = points[i - 1],
		p2 = points[i],
		segDist = p1.distanceTo(p2);
		dist += segDist;

		if (dist > halfDist) {
			const ratio = (dist - halfDist) / segDist;
			center = new Point(
				p2.x - ratio * (p2.x - p1.x),
				p2.y - ratio * (p2.y - p1.y)
			);
			break;
		}
	}

	return crs.unproject(center);
}

// Projects the first ring of the given latlngs.
/**
 * @param {NestedCoords<LatLngExpression>} latlngs
 * @param {typeof CRS} crs
 * @returns {Point[]}
 */
function _projectRing(latlngs, crs) {
	if (!latlngs || latlngs.length === 0) {
		throw new Error('latlngs not passed');
	}

	if (!isFlat(latlngs)) {
		console.warn('latlngs are not flat! Only the first ring will be used');
		return _projectRing(latlngs[0], crs);
	}

	return latlngs.map(latlng => crs.project(new LatLng(latlng)));
}

/**
 * @import {CRS} from '../geo/crs/CRS.js'
 * @import {LatLngExpression} from '../types.js'
 */

/**
 * Various utility functions for polygon geometries.
 * @module PolyUtil
 */

/**
 * Clips the polygon geometry defined by the given `points` by the given bounds (using the [Sutherland-Hodgman
 * algorithm](https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm)). Used by Leaflet to only
 * show polygon points that are on the screen or near, increasing performance. Note that polygon points needs
 * different algorithm for clipping than polyline, so there's a separate method for it.
 * @param {Point[]} points
 * @param {Bounds} bounds
 * @param {boolean} [round]
 */
function clipPolygon(points, bounds, round) {
	// left, bottom, right, top
	for (const edge of [1, 4, 2, 8]) {
		if (!points.length) { break; }

		/** @type {Point[]} */
		const clippedPoints = [];
		let b = points[points.length - 1],
		bOut = _isOutside(b, edge, bounds);

		for (const a of points) {
			const aOut = _isOutside(a, edge, bounds);
			// a->b crosses the edge
			if (aOut !== bOut) {
				clippedPoints.push(_getEdgeIntersection(b, a, edge, bounds, round));
			}
			if (!aOut) {
				clippedPoints.push(a);
			}
			b = a;
			bOut = aOut;
		}
		points = clippedPoints;
	}

	return points;
}

/**
 * Whether the point is outside the given edge of the bounds; the edge is a `LineUtil` clipping bit code.
 * @param {Point} p
 * @param {number} edge
 * @param {Bounds} bounds
 */
function _isOutside(p, edge, bounds) {
	return edge === 1 ? p.x < bounds.min.x :
		edge === 2 ? p.x > bounds.max.x :
		edge === 4 ? p.y < bounds.min.y : p.y > bounds.max.y;
}

/**
 * Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid))
 * of the passed LatLngs (first ring) from a polygon.
 * @param {LatLngExpression[]} latlngs
 * @param {typeof CRS} crs
 */
function polygonCenter(latlngs, crs) {
	// points relative to the first one, to avoid floating point errors on tiny polygons with large projected coordinates
	const points = _projectRing(latlngs, crs),
	origin = points[0].clone(),
	len = points.length;

	for (const p of points) { p._subtract(origin); }

	let area = 0, x = 0, y = 0;

	// polygon centroid algorithm
	for (let i = 0, j = len - 1; i < len; j = i++) {
		const p1 = points[i],
		p2 = points[j],
		f = p1.y * p2.x - p2.y * p1.x;

		x += (p1.x + p2.x) * f;
		y += (p1.y + p2.y) * f;
		area += f;
	}

	if (area !== 0) { return crs.unproject(new Point(x / (3 * area), y / (3 * area))._add(origin)); }

	// area is 0 when all points lie on one line (or on the same spot), or when the ring goes back over its own edges;
	// take the middle of the points' extent and snap it to the closest point of the ring so it stays on the shape
	const mid = new Bounds(points).getCenter();
	let center = points[0];
	for (let i = 0, j = len - 1; i < len; j = i++) {
		const p = _sqClosestPointOnSegment(mid, points[j], points[i]);
		if (p.distanceTo(mid) < center.distanceTo(mid)) { center = p; }
	}
	return crs.unproject(center._add(origin));
}

/** @import {Defaults, LayerDefaults, LayerEventMap, LayerOptions, LeafletEvent, PopupEvent, TooltipEvent} from '../types.js' */
/** @import {LeafletMap} from '../map/Map.js' */

// Classes extending `Layer` will inherit the following options:
const defaultOptions$b = {
	/**
	 * By default the layer will be added to the map's [overlay pane](#map-overlaypane). Overriding
	 * this option will cause the layer to be placed on another pane by default. Not effective if
	 * the `renderer` option is set (the `renderer` option will override the `pane` option).
	 */
	pane: 'overlayPane',

	/**
	 * String to be shown in the attribution control, e.g. "© OpenStreetMap contributors". It describes
	 * the layer data and is often a legal obligation towards copyright holders and tile providers.
	 * @type {string | null}
	 */
	attribution: null,

	bubblingPointerEvents: true
};

/** @typedef {typeof defaultOptions} LayerDefaultsValues */

/**
 * A `LayerGroup` that can hold layers of type `L`: groups type their members as `Layer`, so a popup or a tooltip
 * isn't one.
 * @template L
 * @typedef {{addLayer(layer: L): unknown, removeLayer(layer: L): unknown}} LayerContainer
 */

/**
 * @typedef {Object} LayerEvents
 * @property {LeafletEvent} add Fired after the layer is added to a map
 * @property {LeafletEvent} remove Fired after the layer is removed from a map
 */

/**
 * @category Popup events
 * @typedef {Object} LayerPopupEvents
 * @property {PopupEvent} popupopen Fired when a popup bound to this layer is opened
 * @property {PopupEvent} popupclose Fired when a popup bound to this layer is closed
 */

/**
 * @category Tooltip events
 * @typedef {Object} LayerTooltipEvents
 * @property {TooltipEvent} tooltipopen Fired when a tooltip bound to this layer is opened.
 * @property {TooltipEvent} tooltipclose Fired when a tooltip bound to this layer is closed.
 */

/**
 * @template {LayerOptions} [O=LayerOptions]
 * @template {LayerEventMap} [E=LayerEventMap]
 * @extends {Evented<O & LayerDefaults, E>}
 */
class LayerBase extends Evented {

	/** @type {Defaults<LayerOptions>} */
	static defaultOptions = defaultOptions$b;

	/**
	 * Adds the layer to the given map or layer group.
	 * @param {LeafletMap | LayerContainer<this>} map
	 */
	addTo(map) {
		map.addLayer(this);
		return this;
	}

	/** Removes the layer from the map it is currently active on. */
	remove() {
		return this.removeFrom(this._map || this._mapToAdd);
	}

	/**
	 * Removes the layer from the given map
	 * @overload
	 * @param {LeafletMap} map
	 * @returns {this}
	 */
	/**
	 * Removes the layer from the given `LayerGroup`
	 * @overload
	 * @param {LayerContainer<this>} group
	 * @returns {this}
	 */
	/** @param {LeafletMap | LayerContainer<this>} [obj] */
	removeFrom(obj) {
		obj?.removeLayer(this);
		return this;
	}

	/**
	 * Returns the `HTMLElement` representing the named pane on the
	 * map. If `name` is omitted, returns the pane for this layer.
	 * @param {string} [name]
	 */
	getPane(name) {
		return this._map.getPane(name ? (/** @type {any} */ (this.options)[name] || name) : this.options.pane);
	}

	/**
	 * Registers `targetEl`, one of the layer's DOM elements, so that pointer, click and keyboard events on it
	 * (or its descendants) fire on the layer and bubble through its parent groups to the map, the way they do
	 * for markers and paths. Custom layers call it in [`onAdd`](#layer-onadd), once the layer is on a map.
	 * @param {HTMLElement | SVGElement} targetEl
	 */
	addInteractiveTarget(targetEl) {
		this._map._targets[stamp(targetEl)] = this;
		return this;
	}

	/**
	 * Undoes [`addInteractiveTarget`](#layer-addinteractivetarget), typically in [`onRemove`](#layer-onremove).
	 * @param {HTMLElement | SVGElement} targetEl
	 */
	removeInteractiveTarget(targetEl) {
		delete this._map._targets[stamp(targetEl)];
		return this;
	}

	/** Used by the `attribution control`, returns the [attribution option](#gridlayer-attribution). */
	getAttribution() {
		return this.options.attribution;
	}

	/** @param {{target: LeafletMap}} e */
	_layerAdd(e) {
		const map = e.target;

		// check in case layer gets added and then removed before the map is ready
		if (!map.hasLayer(this)) { return; }

		this._map = map;
		this._zoomAnimated = map._zoomAnimated;

		if (this.getEvents) {
			const events = this.getEvents();
			map.on(events, this);
			this.once('remove', () => map.off(events, this));
		}

		this.onAdd(map);

		this.fire('add');
		map.fire('layeradd', {layer: this});
	}
}

/** @import {Defaults, DivOverlayDefaults, DivOverlayEventMap, DivOverlayOptions, LatLngExpression, LayerEventMap, LayerOptions, LeafletEvent, MapListeners, PointExpression, ZoomAnimEvent} from '../types.js' */
/** @import {LatLngBounds} from '../geo/LatLngBounds.js' */
/** @import {LeafletMap} from '../map/Map.js' */
/** @import {Layer, OverlayTriggerEvents} from './Layer.js' */

/**
 * Content of a popup or tooltip: HTML, an element or fragment, or a function that gets the layer it's bound to
 * and returns one of these.
 * @typedef {string | HTMLElement | DocumentFragment |
 * ((layer: Layer) => string | HTMLElement | DocumentFragment)} OverlayContent
 */

/** @type {WeakMap<DocumentFragment, ChildNode[]>} */
const fragmentNodes = new WeakMap();

const defaultOptions$a = {
	/** If true, the popup/tooltip will listen to the pointer events. */
	interactive: false,

	/**
	 * The offset of the overlay position.
	 * @type {PointExpression}
	 */
	offset: [0, 0],

	/** A custom CSS class name to assign to the overlay. */
	className: '',

	/**
	 * Sets the HTML content of the overlay while initializing. If a function is passed the source layer will be
	 * passed to the function. The function should return a `String`, `HTMLElement` or `DocumentFragment` to be
	 * used in the overlay.
	 * String content is rendered as HTML; sanitize untrusted input or pass an `HTMLElement` with safe `textContent`
	 * instead.
	 * @type {OverlayContent}
	 */
	content: ''
};

/** @typedef {typeof defaultOptions} DivOverlayDefaultsValues */

/**
 * @category DivOverlay events
 * @typedef {Object} DivOverlayEvents
 * @property {LeafletEvent} contentupdate Fired when the content of the overlay is updated
 */

/**
 * Base model for `Popup` and `Tooltip`; use those to show content on the map. Inherit from it for custom overlays
 * like plugins.
 * @template {DivOverlayOptions} [O=DivOverlayOptions]
 * @template {DivOverlayEventMap} [E=DivOverlayEventMap]
 * @extends {LayerBase<O & DivOverlayDefaults, E>}
 */
class DivOverlay extends LayerBase {

	static initHooks = true;

	/** @type {Defaults<DivOverlayOptions>} */
	static defaultOptions = defaultOptions$a;

	/**
	 * Instantiates the overlay given an optional `options` object that describes its appearance and location and
	 * an optional `source` layer it's bound to.
	 * @overload
	 * @param {NoInfer<Partial<O>>} [options]
	 * @param {Layer} [source]
	 */
	/**
	 * Instantiates the overlay given `latlng` where it will open and an optional `options` object that describes
	 * its appearance and location.
	 * @overload
	 * @param {LatLng | [number, number, number?]} latlng
	 * @param {NoInfer<Partial<O>>} [options]
	 */
	/**
	 * @param {Partial<O> | LatLng | [number, number, number?]} [options]
	 * @param {any} [source]
	 */
	constructor(options, source) {
		super();

		if (options instanceof LatLng || Array.isArray(options)) {
			this._latlng = new LatLng(options);
			setOptions(this, source);
		} else {
			setOptions(this, options);
			/** @type {Layer<LayerOptions, LayerEventMap & OverlayTriggerEvents> | undefined} */
			this._source = source;
		}
		if (this.options.content) {
			/** @type {OverlayContent | undefined} */
			this._content = this.options.content;
		}

		this.callInitHooks();
	}

	/**
	 * Adds the overlay to the map. Alternative to `map.openPopup(popup)`/`.openTooltip(tooltip)`.
	 * @param {LeafletMap} map
	 */
	openOn(map) {
		map = arguments.length ? map : /** @type {Layer} */ (this._source)._map; // experimental, not the part of public api
		if (!map.hasLayer(this)) {
			map.addLayer(this);
		}
		return this;
	}

	/**
	 * Closes the overlay. Alternative to `map.closePopup(popup)`/`.closeTooltip(tooltip)`
	 * and `layer.closePopup()`/`.closeTooltip()`.
	 */
	close() {
		this._map?.removeLayer(this);
		return this;
	}

	/**
	 * Opens or closes the overlay bound to layer depending on its current state. Argument may be omitted
	 * only for overlay bound to layer. Alternative to `layer.togglePopup()`/`.toggleTooltip()`.
	 * @param {Layer} [layer]
	 */
	toggle(layer) {
		if (this._map) {
			this.close();
		} else {
			if (arguments.length) {
				this._source = layer;
			} else {
				layer = this._source;
			}
			if (this._prepareOpen()) {
				// open the overlay on the map
				this.openOn(/** @type {Layer} */ (layer)._map);
			}
		}
		return this;
	}

	/** @param {LeafletMap} map */
	onAdd(map) {
		if (!this._container) {
			this._initLayout();
		}

		if (map._fadeAnimated) {
			this._container.style.opacity = '0';
		}

		clearTimeout(this._removeTimeout);
		this.getPane().append(this._container);
		this.update();

		if (map._fadeAnimated) {
			this._container.style.opacity = '1';
		}

		this.bringToFront();

		if (this.options.interactive) {
			this._container.classList.add('leaflet-interactive');
			this.addInteractiveTarget(this._container);
		}
	}

	/** @param {LeafletMap} map */
	onRemove(map) {
		if (map._fadeAnimated) {
			this._container.style.opacity = '0';
			/** @type {ReturnType<typeof setTimeout> | undefined} */
			this._removeTimeout = setTimeout(() => this._container.remove(), 200);
		} else {
			this._container.remove();
		}

		if (this.options.interactive) {
			this._container.classList.remove('leaflet-interactive');
			this.removeInteractiveTarget(this._container);
		}
	}

	/** Returns the geographical point of the overlay. */
	getLatLng() {
		return this._latlng;
	}

	/**
	 * Sets the geographical point where the overlay will open.
	 * @param {LatLngExpression} latlng
	 */
	setLatLng(latlng) {
		this._latlng = new LatLng(latlng);
		if (this._map) {
			this._updatePosition();
			this._adjustPan();
		}
		return this;
	}

	/** Returns the content of the overlay. */
	getContent() {
		return this._content;
	}

	/**
	 * Sets the HTML content of the overlay. A `String` argument is rendered as HTML; if it may contain untrusted
	 * input, sanitize it or pass an `HTMLElement` with safe `textContent` instead. A `DocumentFragment` can be
	 * passed as well. If a function is passed the source layer will be passed to the function. The function should
	 * return a `String`, `HTMLElement` or `DocumentFragment` to be used in the overlay.
	 * @param {OverlayContent} content
	 */
	setContent(content) {
		this._content = content;
		this.update();
		return this;
	}

	/**
	 * Returns the HTML container of the overlay.
	 * @returns {HTMLElement | undefined}
	 */
	getElement() {
		return this._container;
	}

	/**
	 * Updates the overlay content, layout and position. Useful for updating
	 * the overlay after something inside changed, e.g. image loaded.
	 */
	update() {
		if (!this._map) { return; }

		this._container.style.visibility = 'hidden';

		this._updateContent();
		this._updateLayout();
		this._updatePosition();

		this._container.style.visibility = '';

		this._adjustPan();
	}

	/** @returns {MapListeners} */
	getEvents() {
		return {
			zoom: this._updatePosition,
			viewreset: this._updatePosition,
			zoomanim: this._animateZoom
		};
	}

	/** Returns `true` when the overlay is visible on the map. */
	isOpen() {
		return !!this._map?.hasLayer(this);
	}

	/** Brings this overlay in front of other overlays (in the same map pane). */
	bringToFront() {
		if (this._map) {
			toFront(this._container);
		}
		return this;
	}

	/** Brings this overlay to the back of other overlays (in the same map pane). */
	bringToBack() {
		if (this._map) {
			toBack(this._container);
		}
		return this;
	}

	// prepare bound overlay to open: update latlng pos / content source (for FeatureGroup)
	/** @param {LatLngExpression} [latlng] */
	_prepareOpen(latlng) {
		const layer = /** @type {Layer} */ (this._source);
		if (!layer._map) { return false; }

		const source = /** @type {Layer & {getCenter?: () => LatLng, getLatLng?: () => LatLng,
			getBounds?: () => LatLngBounds} | undefined} */ (layer._getOverlaySource());
		if (!source) { return false; } // Unable to get source layer.
		this._source = source;

		latlng ??= source.getCenter?.() ?? source.getLatLng?.() ?? source.getBounds?.().getCenter();
		if (!latlng) { throw new Error('Unable to get source layer LatLng.'); }
		this.setLatLng(latlng);

		if (this._map) {
			// update the overlay (content, layout, etc...)
			this.update();
		}

		return true;
	}

	_updateContent() {
		if (this._content == null) { return; }

		const node = this._contentNode;
		// a standalone overlay passes itself
		const content = (typeof this._content === 'function') ?
			this._content(this._source ?? /** @type {any} */ (this)) : this._content;

		if (typeof content === 'string') {
			node.innerHTML = content;
		} else if (content instanceof DocumentFragment) {
			// inserting a fragment empties it, so keep its nodes to insert them again on later updates
			if (content.hasChildNodes()) { fragmentNodes.set(content, [...content.childNodes]); }
			node.replaceChildren(...fragmentNodes.get(content) ?? []);
		} else {
			node.replaceChildren(content);
		}

		this.fire('contentupdate');
	}

	_updatePosition() {
		if (!this._map) { return; }

		const pos = this._map._snapLayerPoint(this._map.latLngToLayerPoint(/** @type {LatLng} */ (this._latlng))),
		offset = new Point(this.options.offset);

		setPosition(this._container, pos.add(this._getAnchor()));

		const bottom = this._containerBottom = -offset.y,
		left = this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x;

		// bottom position the overlay in case the height of the overlay changes (images loading etc)
		this._container.style.bottom = `${bottom}px`;
		this._container.style.left = `${left}px`;
	}

	/** @returns {PointExpression} */
	_getAnchor() {
		return [0, 0];
	}

}

/** @import {Defaults, DivOverlayEventMap, PointExpression, PopupDefaults, PopupOptions, ZoomAnimEvent} from '../types.js' */
/** @import {LatLng} from '../geo/LatLng.js' */
/** @import {LeafletMap} from '../map/Map.js' */
/** @import {Layer} from './Layer.js' */

const defaultOptions$9 = {
	/** `Map pane` where the popup will be added. */
	pane: 'popupPane',

	/**
	 * The offset of the popup position.
	 * @type {PointExpression}
	 */
	offset: [0, 7],

	/** Max width of the popup, in pixels. */
	maxWidth: 300,

	/** Min width of the popup, in pixels. */
	minWidth: 50,

	/**
	 * If set, creates a scrollable container of the given height inside a popup if its content exceeds it.
	 * The scrollable container can be styled using the `leaflet-popup-scrolled` CSS class selector.
	 * @type {number | null}
	 */
	maxHeight: null,

	/** Set it to `false` if you don't want the map to do panning animation to fit the opened popup. */
	autoPan: true,

	/**
	 * The margin between the popup and the top left corner of the map view after autopanning was performed.
	 * @type {PointExpression | null}
	 */
	autoPanPaddingTopLeft: null,

	/**
	 * The margin between the popup and the bottom right corner of the map view after autopanning was performed.
	 * @type {PointExpression | null}
	 */
	autoPanPaddingBottomRight: null,

	/**
	 * Equivalent of setting both top left and bottom right autopan padding to the same value.
	 * @type {PointExpression}
	 */
	autoPanPadding: [5, 5],

	/** Set it to `true` if you want to prevent users from panning the popup off of the screen while it is open. */
	keepInView: false,

	/** Controls the presence of a close button in the popup. */
	closeButton: true,

	/**
	 * Specifies the 'aria-label' attribute of the close button.
	 * @translatable
	*/
	closeButtonLabel: 'Close popup',

	/**
	 * Set it to `false` if you want to override the default behavior
	 * of the popup closing when another popup is opened.
	 */
	autoClose: true,

	/** Set it to `false` if you want to override the default behavior of the ESC key for closing of the popup. */
	closeOnEscapeKey: true,

	/** A custom CSS class name to assign to the popup. */
	className: '',

	/**
	 * Whether the popup shall react to changes in the size of its contents
	 * (e.g. when an image inside the popup loads) and reposition itself.
	 */
	trackResize: true,
};

/** @typedef {typeof defaultOptions} PopupDefaultsValues */

/**
 * @typedef {Object} PopupProps
 * @property {boolean} [closeOnClick] Set it if you want to override the default behavior of the popup closing
 *   when user clicks on the map. Defaults to the map's [`closePopupOnClick`](#map-closepopuponclick) option.
 */

/**
 * @typedef {Object} PopupEventProps
 * @property {Popup} popup The popup that was opened or closed.
 */

/**
 * Used to open popups in certain places of the map. Use [Map.openPopup](#map-openpopup)
 * to open popups while making sure that only one popup is open at one time (recommended
 * for usability), or use [Map.addLayer](#map-addlayer) to open as many as you want.
 * @example
 * If you want to just bind a popup to marker click and then open it, it's really easy:
 *
 * ```js
 * marker.bindPopup(popupContent).openPopup();
 * ```
 * Path overlays like polylines also have a `bindPopup` method.
 *
 * A popup can be also standalone:
 *
 * ```js
 * const popup = new Popup()
 * 	.setLatLng(latlng)
 * 	.setContent('<p>Hello world!<br />This is a nice popup.</p>')
 * 	.openOn(map);
 * ```
 * or
 * ```js
 * const popup = new Popup(latlng, {content: '<p>Hello world!<br />This is a nice popup.</p>'})
 * 	.openOn(map);
 * ```
 *
 * **Security note.** Popup string content is rendered as HTML. If your content may include untrusted input (e.g. data
 * from users or external APIs), sanitize it first, or build a DOM element using `textContent` to render it as plain
 * text:
 *
 * ```js
 * const el = document.createElement('div');
 * el.textContent = untrustedString;
 * marker.bindPopup(el);
 * ```
 *
 * @template {PopupOptions} [O=PopupOptions]
 * @template {DivOverlayEventMap} [E=DivOverlayEventMap]
 * @extends {DivOverlay<O & PopupDefaults, E>}
 */
class Popup extends DivOverlay {

	/** @type {Defaults<PopupOptions>} */
	static defaultOptions = defaultOptions$9;

	/**
	 * Alternative to `map.openPopup(popup)`. Adds the popup to the map and closes the previous one.
	 * @param {LeafletMap} map
	 */
	openOn(map) {
		map = arguments.length ? map : /** @type {Layer} */ (this._source)._map; // experimental, not the part of public api

		if (!map.hasLayer(this) && map._popup?.options.autoClose) {
			map.removeLayer(map._popup);
		}
		map._popup = this;

		super.openOn(map);
		this._updateSourceAria(true); // the source may have changed while open, e.g. within a FeatureGroup
		return this;
	}

	/** @param {LeafletMap} map */
	onAdd(map) {
		super.onAdd(map);

		map.fire('popupopen', {popup: this});
		this._updateSourceAria(true);

		if (this._source) {
			this._source.fire('popupopen', {popup: this}, true);
			// For non-path layers, we toggle the popup when clicking
			// again the layer, so prevent the map to reopen it.
			if (this._source._togglesPopupOnClick()) {
				this._source.on('preclick', stopPropagation);
			}
		}
	}

	/** @param {LeafletMap} map */
	onRemove(map) {
		// closing removes the focused element, which would send focus back to the start of the page
		if (this._container.contains(document.activeElement)) {
			const el = /** @type {HTMLElement | null | undefined} */ (this._source?.getElement?.());
			(el && el.tabIndex >= 0 ? el : map._container).focus();
		}

		super.onRemove(map);

		map.fire('popupclose', {popup: this});
		this._updateSourceAria(false);

		if (this._source) {
			this._source.fire('popupclose', {popup: this}, true);
			if (this._source._togglesPopupOnClick()) {
				this._source.off('preclick', stopPropagation);
			}
		}
	}

	getEvents() {
		const events = super.getEvents();

		if (this.options.closeOnClick ?? this._map.options.closePopupOnClick) {
			events.preclick = this.close;
		}

		if (this.options.keepInView) {
			events.moveend = this._adjustPan;
		}

		return events;
	}

	// marks a source that acts as a button (e.g. a keyboard-accessible marker) as a disclosure for the popup
	/** @param {boolean} open */
	_updateSourceAria(open) {
		this._ariaSource?.setAttribute('aria-expanded', 'false');
		this._ariaSource?.removeAttribute('aria-controls');

		const el = this._source?.getElement?.();
		/** @type {Element | null | undefined} */
		this._ariaSource = el?.getAttribute('role') === 'button' ? el : null;
		this._ariaSource?.setAttribute('aria-expanded', String(open));
		if (open) { this._ariaSource?.setAttribute('aria-controls', this._container.id); }
	}

	_initLayout() {
		const prefix = 'leaflet-popup',
		container = this._container = create('div', `${prefix} ${this.options.className || ''} leaflet-zoom-animated`);

		container.id = `leaflet-popup-${stamp(this)}`;

		const wrapper = this._wrapper = create('div', `${prefix}-content-wrapper`, container);
		this._contentNode = create('div', `${prefix}-content`, wrapper);

		disableClickPropagation(container);
		disableScrollPropagation(this._contentNode);
		on(container, 'contextmenu', stopPropagation);

		this._tipContainer = create('div', `${prefix}-tip-container`, container);
		this._tip = create('div', `${prefix}-tip`, this._tipContainer);

		if (this.options.closeButton) {
			const closeButton = this._closeButton = create('a', `${prefix}-close-button`, container);
			closeButton.setAttribute('role', 'button'); // overrides the implicit role=link of <a> elements #7399
			closeButton.setAttribute('aria-label', this._map.translate(this.options.closeButtonLabel));
			clickOnSpace(closeButton);

			closeButton.href = '#close';
			closeButton.textContent = '\u00D7';

			on(closeButton, 'click', (ev) => {
				ev.preventDefault();
				this.close();
			});
		}


		if (this.options.trackResize) {
			this._resizeObserver = new ResizeObserver(() => {
				if (!this._map) { return; }
				this._updateLayout();
				this._updatePosition();
				this._adjustPan();
			});

			this._resizeObserver.observe(this._contentNode);
		}
	}

	_updateLayout() {
		const container = this._contentNode,
		style = container.style;

		style.maxWidth = `${this.options.maxWidth}px`;
		style.minWidth = `${this.options.minWidth}px`;
		style.height = '';

		const maxHeight = this.options.maxHeight,
		scrolled = !!maxHeight && container.offsetHeight > maxHeight;

		if (scrolled) {
			style.height = `${maxHeight}px`;
		}
		container.classList.toggle('leaflet-popup-scrolled', scrolled);

		this._containerWidth = this._container.offsetWidth;
		this._containerHeight = this._container.offsetHeight;
	}

	/** @param {ZoomAnimEvent} e */
	_animateZoom(e) {
		const pos = this._map._latLngToNewLayerPoint(/** @type {LatLng} */ (this._latlng), e.zoom, e.center),
		anchor = this._getAnchor();
		setPosition(this._container, pos.add(anchor));
	}

	_adjustPan() {
		if (!this.options.autoPan) { return; }
		this._map._panAnim?.stop();

		// Stopping the pan fires `moveend`, whose listeners may have removed this popup.
		if (!this._map) { return; }

		// We can endlessly recurse if keepInView is set and the view resets.
		// Let's guard against that by exiting early if we're responding to our own autopan.
		if (this._autopanning) {
			this._autopanning = false;
			return;
		}

		const map = this._map,
		marginBottom = parseInt(getComputedStyle(this._container).marginBottom, 10) || 0,
		containerHeight = this._containerHeight + marginBottom,
		containerWidth = this._containerWidth,
		layerPos = new Point(this._containerLeft, -containerHeight - this._containerBottom);

		layerPos._add(getPosition(this._container));

		const containerPos = map.layerPointToContainerPoint(layerPos),
		padding = new Point(this.options.autoPanPadding),
		paddingTL = new Point(this.options.autoPanPaddingTopLeft ?? padding),
		paddingBR = new Point(this.options.autoPanPaddingBottomRight ?? padding),
		size = map.getSize();
		let dx = 0,
		dy = 0;

		if (containerPos.x + containerWidth + paddingBR.x > size.x) { // right
			dx = containerPos.x + containerWidth - size.x + paddingBR.x;
		}
		if (containerPos.x - dx - paddingTL.x < 0) { // left
			dx = containerPos.x - paddingTL.x;
		}
		if (containerPos.y + containerHeight + paddingBR.y > size.y) { // bottom
			dy = containerPos.y + containerHeight - size.y + paddingBR.y;
		}
		if (containerPos.y - dy - paddingTL.y < 0) { // top
			dy = containerPos.y - paddingTL.y;
		}

		if (dx || dy) {
			// Track that we're autopanning, as this function will be re-ran on moveend
			if (this.options.keepInView) {
				this._autopanning = true;
			}

			map
				.fire('autopanstart')
				.panBy([dx, dy]);
		}
	}

	_getAnchor() {
		// Where should we anchor the popup on the source layer?
		return new Point(this._source?._getPopupAnchor ? this._source._getPopupAnchor() : [0, 0]);
	}

}

/** @import {Defaults, DivOverlayEventMap, PointExpression, TooltipDefaults, TooltipOptions, ZoomAnimEvent} from '../types.js' */
/** @import {LatLng} from '../geo/LatLng.js' */
/** @import {LeafletMap} from '../map/Map.js' */

const defaultOptions$8 = {
	/** `Map pane` where the tooltip will be added. */
	pane: 'tooltipPane',

	/**
	 * Optional offset of the tooltip position, in pixels. Mirrored horizontally when an `auto` tooltip opens to the
	 * left.
	 * @type {PointExpression}
	 */
	offset: [0, 0],

	/**
	 * Direction where to open the tooltip. Possible values are: `right`, `left`, `top`, `bottom`, `center`, `auto`.
	 * `auto` will dynamically switch between `right` and `left` according to the tooltip position on the map.
	 * @type {'right' | 'left' | 'top' | 'bottom' | 'center' | 'auto'}
	 */
	direction: 'auto',

	/** Whether to open the tooltip permanently or only on pointerover. */
	permanent: false,

	/** If true, the tooltip will follow the pointer instead of being fixed at the feature center. */
	sticky: false,

	/** Tooltip container opacity. */
	opacity: 0.9
};

/** @typedef {typeof defaultOptions} TooltipDefaultsValues */

/**
 * Which point of the tooltip (as a fraction of its width and height) sits at the anchor, for each direction.
 * @type {Record<string, [number, number]>}
 */
const directions = {top: [0.5, 1], bottom: [0.5, 0], center: [0.5, 0.5], right: [0, 0.5], left: [1, 0.5]};

/**
 * @typedef {Object} TooltipEventProps
 * @property {Tooltip} tooltip The tooltip that was opened or closed.
 */

/**
 * Used to display small texts on top of map layers.
 * @example
 * If you want to just bind a tooltip to marker:
 *
 * ```js
 * marker.bindTooltip("my tooltip text").openTooltip();
 * ```
 * Path overlays like polylines also have a `bindTooltip` method.
 *
 * A tooltip can be also standalone:
 *
 * ```js
 * const tooltip = new Tooltip()
 * 	.setLatLng(latlng)
 * 	.setContent('Hello world!<br />This is a nice tooltip.')
 * 	.addTo(map);
 * ```
 * or
 * ```js
 * const tooltip = new Tooltip(latlng, {content: 'Hello world!<br />This is a nice tooltip.'})
 * 	.addTo(map);
 * ```
 *
 * **Security note.** Tooltip string content is rendered as HTML. If your content may include untrusted input (e.g.
 * data from users or external APIs), sanitize it first, or build a DOM element using `textContent` to render it as
 * plain text:
 *
 * ```js
 * const el = document.createElement('div');
 * el.textContent = untrustedString;
 * marker.bindTooltip(el);
 * ```
 *
 * Note about tooltip offset. Leaflet takes two options in consideration
 * for computing tooltip offsetting:
 * - the `offset` Tooltip option: it defaults to [0, 0], and it's specific to one tooltip.
 *   Add a positive x offset to move the tooltip to the right, and a positive y offset to
 *   move it to the bottom. Negatives will move to the left and top.
 * - the `tooltipAnchor` Icon option: this will only be considered for Marker. You
 *   should adapt this value if you use a custom icon.
 *
 * @template {TooltipOptions} [O=TooltipOptions]
 * @template {DivOverlayEventMap} [E=DivOverlayEventMap]
 * @extends {DivOverlay<O & TooltipDefaults, E>}
 */
class Tooltip extends DivOverlay {

	/** @type {Defaults<TooltipOptions>} */
	static defaultOptions = defaultOptions$8;

	/** @param {LeafletMap} map */
	onAdd(map) {
		super.onAdd(map);
		this.setOpacity(this.options.opacity);

		map.fire('tooltipopen', {tooltip: this});

		if (this._source) {
			this.addEventParent(this._source);
			/** @type {Element | null | undefined} */
			this._ariaSource = this._source.getElement?.();
			if (this._ariaSource) { updateDescribedBy(this._ariaSource, this._container.id, true); }

			this._source.fire('tooltipopen', {tooltip: this}, true);
		}
	}

	/** @param {LeafletMap} map */
	onRemove(map) {
		super.onRemove(map);

		map.fire('tooltipclose', {tooltip: this});

		if (this._source) {
			this.removeEventParent(this._source);

			if (this._ariaSource) { updateDescribedBy(this._ariaSource, this._container.id, false); }
			this._ariaSource = null;

			this._source.fire('tooltipclose', {tooltip: this}, true);
		}
	}

	getEvents() {
		const events = super.getEvents();

		if (!this.options.permanent) {
			events.preclick = this.close;
		}

		return events;
	}

	_initLayout() {
		const prefix = 'leaflet-tooltip',
		className = `${prefix} ${this.options.className || ''} leaflet-zoom-animated`;

		this._contentNode = this._container = create('div', className);

		this._container.setAttribute('role', 'tooltip');
		this._container.id = `leaflet-tooltip-${stamp(this)}`;
	}

	_updateLayout() {}

	_adjustPan() {}

	/** @param {Point} pos */
	_setPosition(pos) {
		const container = this._container,
		offset = new Point(this.options.offset).clone();
		let direction = this.options.direction;

		if (!(direction in directions)) { // auto: open away from the map center, mirroring the offset
			direction = pos.x <= this._map._getCenterLayerPoint().x ? 'right' : 'left';
			if (direction === 'left') { offset.x = -offset.x; }
		}
		const [fx, fy] = directions[direction];
		const shift = this._getAnchor(direction).add(offset);

		for (const d in directions) {
			container.classList.toggle(`leaflet-tooltip-${d}`, d === direction);
		}
		// a percentage translate follows the tooltip's own size, so it never has to be measured (which would
		// force a reflow per tooltip on every zoom); browsers without CSS round() ignore the second value
		container.style.translate = `${-fx * 100}% ${-fy * 100}%`;
		container.style.translate = `round(${-fx * 100}%, 1px) round(${-fy * 100}%, 1px)`;
		setPosition(container, pos._add(shift));
	}

	_updatePosition() {
		const pos = this._map._snapLayerPoint(this._map.latLngToLayerPoint(/** @type {LatLng} */ (this._latlng)));
		this._setPosition(pos);
	}

	/**
	 * Sets the opacity of the tooltip.
	 * @param {number} opacity
	 */
	setOpacity(opacity) {
		this.options.opacity = opacity;

		if (this._container) {
			this._container.style.opacity = `${opacity}`;
		}
	}

	/** @param {ZoomAnimEvent} e */
	_animateZoom(e) {
		const pos = this._map._latLngToNewLayerPoint(/** @type {LatLng} */ (this._latlng), e.zoom, e.center);
		this._setPosition(pos);
	}

	/** @param {string} [direction] */
	_getAnchor(direction) {
		// Where should we anchor the tooltip on the source layer?
		return new Point(this._source?._getTooltipAnchor && !this.options.sticky ? this._source._getTooltipAnchor(direction) : [0, 0]);
	}

}

// aria-describedby is a whitespace-separated ID list that the app may also be using
/** @param {Element} el @param {string} id @param {boolean} add */
function updateDescribedBy(el, id, add) {
	const ids = splitWords(el.getAttribute('aria-describedby') ?? '').filter(s => s && s !== id);
	if (add) { ids.push(id); }
	if (ids.length) { el.setAttribute('aria-describedby', ids.join(' ')); } else { el.removeAttribute('aria-describedby'); }
}

/** @import {LatLngExpression, LayerEventMap, LayerOptions, LeafletEvent, LeafletPointerEvent, MarkerMoveEvent, PopupOptions, TooltipOptions} from '../types.js' */
/** @import {LatLng} from '../geo/LatLng.js' */
/** @import {OverlayContent} from './DivOverlay.js' */

// the focus listener a tooltip added to each layer element, to remove it when the tooltip is unbound or rebound
/** @type {WeakMap<Element, () => void>} */
const focusHandlers = new WeakMap();

/**
 * Events that bound popups and tooltips listen to, with the event objects they expect if a layer fires them.
 * @typedef {Object} OverlayTriggerEvents
 * @property {LeafletPointerEvent} [click]
 * @property {LeafletPointerEvent} [pointermove]
 * @property {MarkerMoveEvent} [move]
 * @property {LeafletPointerEvent} [preclick]
 */

/**
 * @typedef {Object} InteractiveLayerProps
 * @property {boolean} interactive If `false`, the layer will not emit pointer events and will
 *   act as a part of the underlying map.
 * @property {boolean} bubblingPointerEvents When `true`, a pointer event on this layer will trigger the
 *   same event on the map (unless [`DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
 */

/**
 * @category Pointer events
 * @typedef {Object} InteractiveLayerEvents
 * @property {LeafletPointerEvent} click Fired when the user clicks (or taps) the layer.
 * @property {LeafletPointerEvent} preclick Fired right before `click`, for something that
 *   should happen before any `click` listener runs.
 * @property {LeafletPointerEvent} dblclick Fired when the user double-clicks (or double-taps) the layer.
 * @property {LeafletPointerEvent} pointerdown Fired when the user pushes the pointer on the layer.
 * @property {LeafletPointerEvent} pointerup Fired when the user releases the pointer pushed on the layer.
 * @property {LeafletPointerEvent} pointerover Fired when the pointer enters the layer.
 * @property {LeafletPointerEvent} pointerout Fired when the pointer leaves the layer.
 * @property {LeafletPointerEvent} contextmenu Fired when the user right-clicks on the layer,
 *   prevents default browser context menu from showing if there are listeners on this event. Also
 *   fired on mobile when the user holds a single touch for a second (also called long press).
 */

/**
 * A set of methods from the Layer base class that all Leaflet layers use. Inherits all methods, options and events
 * from `Evented`.
 *
 * @example
 * ```js
 * const layer = new Marker(latlng).addTo(map);
 * layer.addTo(map);
 * layer.remove();
 * ```
 *
 * @categoryDescription Methods
 * Classes extending `Layer` will inherit the following methods:
 *
 * @categoryDescription Popup methods
 * All layers share a set of methods convenient for binding popups to it.
 *
 * ```js
 * const layer = new Polygon(latlngs).bindPopup('Hi There!').addTo(map);
 * layer.openPopup();
 * layer.closePopup();
 * ```
 *
 * Popups will also be automatically opened when the layer is clicked on and closed when the layer is removed from
 * the map or another popup is opened.
 *
 * @categoryDescription Tooltip methods
 * All layers share a set of methods convenient for binding tooltips to it.
 *
 * ```js
 * const layer = new Polygon(latlngs).bindTooltip('Hi There!').addTo(map);
 * layer.openTooltip();
 * layer.closeTooltip();
 * ```
 *
 * @categoryDescription Extension methods
 * Every layer should extend from `Layer` and (re-)implement the following methods.
 *
 * @template {LayerOptions} [O=LayerOptions]
 * @template {LayerEventMap & OverlayTriggerEvents} [E=LayerEventMap]
 * @extends {LayerBase<O, E>}
 */
class Layer extends LayerBase {

	/**
	 * Binds a popup to the layer with the passed `content` and sets up the necessary event listeners. A `String`
	 * argument is rendered as HTML; if it may contain untrusted input, sanitize it or pass an `HTMLElement` with
	 * safe `textContent` instead. If a `Function` is passed it will receive the layer as the first argument and
	 * should return a `String`, `HTMLElement` or `DocumentFragment`.
	 * @category Popup methods
	 * @param {OverlayContent | Popup} content
	 * @param {Partial<PopupOptions>} [options]
	 */
	bindPopup(content, options) {
		const popup = this._initOverlay(Popup, this._popup, content, options);
		if (popup !== this._popup) { this.closePopup(); }
		/** @type {Popup | null | undefined} */
		this._popup = popup;
		this._popup._updateSourceAria(this._popup.isOpen());
		this.on({
			click: this._openPopup,
			remove: this.closePopup,
			move: this._movePopup
		});

		return this;
	}

	/**
	 * Removes the popup previously bound with `bindPopup`.
	 * @category Popup methods
	 */
	unbindPopup() {
		if (this._popup) {
			this.off({
				click: this._openPopup,
				remove: this.closePopup,
				move: this._movePopup
			});
			const el = this.getElement?.();
			el?.removeAttribute('aria-expanded');
			el?.removeAttribute('aria-controls');
			this._popup = null;
		}
		return this;
	}

	/**
	 * Opens the bound popup at the specified `latlng` or at the default popup anchor if no `latlng` is passed.
	 * @category Popup methods
	 * @param {LatLngExpression} [latlng]
	 * @returns {this}
	 */
	openPopup(latlng) {
		if (this._popup) {
			// groups keep the member layer the popup was last opened on
			if (this._getOverlaySource() === this) {
				this._popup._source = this;
			}
			if (this._popup._prepareOpen(latlng)) {
				// open the popup on the map
				this._popup.openOn(this._map);
			}
		}
		return this;
	}

	/**
	 * Closes the popup bound to this layer if it is open.
	 * @category Popup methods
	 */
	closePopup() {
		this._popup?.close();
		return this;
	}

	/**
	 * Opens or closes the popup bound to this layer depending on its current state.
	 * @category Popup methods
	 */
	togglePopup() {
		this._popup?.toggle(this);
		return this;
	}

	/**
	 * Returns `true` if the popup bound to this layer is currently open.
	 * @category Popup methods
	 */
	isPopupOpen() {
		return this._popup?.isOpen() ?? false;
	}

	/**
	 * Sets the content of the popup bound to this layer. String content is rendered as HTML;
	 * sanitize untrusted input or pass an `HTMLElement` with safe `textContent` instead.
	 * @category Popup methods
	 * @param {OverlayContent} content
	 */
	setPopupContent(content) {
		this._popup?.setContent(content);
		return this;
	}

	/**
	 * Returns the popup bound to this layer.
	 * @category Popup methods
	 * @returns {Popup | null | undefined}
	 */
	getPopup() {
		return this._popup;
	}

	/** @param {LeafletPointerEvent} e */
	_openPopup(e) {
		if (!this._popup || !this._map) {
			return;
		}
		// prevent map click
		stopPropagation(e);

		const target = /** @type {Layer} */ (e.propagatedFrom ?? e.target);
		// clicking a marker-like source again toggles its popup closed
		if (this._popup._source === target && target._togglesPopupOnClick() && this._map.hasLayer(this._popup)) {
			this.closePopup();
			return;
		}
		this._popup._source = target;
		this.openPopup(e.latlng);
	}

	/** @param {{latlng: LatLng}} e */
	_movePopup(e) {
		/** @type {Popup} */ (this._popup).setLatLng(e.latlng);
	}

	/**
	 * Binds a tooltip to the layer with the passed `content` and sets up the necessary event listeners. A `String`
	 * argument is rendered as HTML; if it may contain untrusted input, sanitize it or pass an `HTMLElement` with
	 * safe `textContent` instead. If a `Function` is passed it will receive the layer as the first argument and
	 * should return a `String`, `HTMLElement` or `DocumentFragment`.
	 * @category Tooltip methods
	 * @param {OverlayContent | Tooltip} content
	 * @param {Partial<TooltipOptions>} [options]
	 */
	bindTooltip(content, options) {
		// an open tooltip is replaced, a closed one reused
		const old = this.isTooltipOpen() ? null : this._tooltip;

		// the handlers depend on the old options, so they go before the new ones are applied
		if (this._tooltip) {
			this.unbindTooltip();
		}

		/** @type {Tooltip | null | undefined} */
		this._tooltip = this._initOverlay(Tooltip, old, content, options);
		this._initTooltipInteractions();

		if (this._tooltip.options.permanent && this._map?.hasLayer(this)) {
			this.openTooltip();
		}

		return this;
	}

	/**
	 * Removes the tooltip previously bound with `bindTooltip`.
	 * @category Tooltip methods
	 */
	unbindTooltip() {
		if (this._tooltip) {
			this._initTooltipInteractions(true);
			this.closeTooltip();
			this._tooltip = null;
		}
		return this;
	}

	/** @param {boolean} [remove] */
	_initTooltipInteractions(remove) {
		const {permanent, sticky} = /** @type {Tooltip} */ (this._tooltip).options,
		events = /** @type {{[type: string]: (e: any) => void}} */ ({
			remove: this.closeTooltip,
			move: this._moveTooltip
		});
		if (permanent) {
			events.add = this._openTooltip;
		} else {
			events.pointerover = this._openTooltip;
			events.pointerout = this.closeTooltip;
			events.click = this._openTooltip;
			// layer elements can be recreated on every add
			events.add = this._toggleFocusListeners;
			if (this._map) {
				this._toggleFocusListeners(!remove);
			}
		}
		if (sticky) {
			events.pointermove = this._moveTooltip;
		}
		this[remove ? 'off' : 'on'](events);
	}

	/**
	 * Opens the bound tooltip at the specified `latlng` or at the default tooltip anchor if no `latlng` is passed.
	 * @category Tooltip methods
	 * @param {LatLngExpression} [latlng]
	 * @returns {this}
	 */
	openTooltip(latlng) {
		if (this._tooltip) {
			// groups keep the member layer the tooltip was last opened on
			if (this._getOverlaySource() === this) {
				this._tooltip._source = this;
			}
			if (this._tooltip._prepareOpen(latlng)) {
				// open the tooltip on the map
				this._tooltip.openOn(this._map);
			}
		}
		return this;
	}

	/**
	 * Closes the tooltip bound to this layer if it is open.
	 * @category Tooltip methods
	 */
	closeTooltip() {
		this._tooltip?.close();
		return this;
	}

	/**
	 * Opens or closes the tooltip bound to this layer depending on its current state.
	 * @category Tooltip methods
	 */
	toggleTooltip() {
		this._tooltip?.toggle(this);
		return this;
	}

	/**
	 * Returns `true` if the tooltip bound to this layer is currently open.
	 * @category Tooltip methods
	 */
	isTooltipOpen() {
		return this._tooltip?.isOpen() ?? false;
	}

	/**
	 * Sets the content of the tooltip bound to this layer. String content is rendered as HTML;
	 * sanitize untrusted input or pass an `HTMLElement` with safe `textContent` instead.
	 * @category Tooltip methods
	 * @param {OverlayContent} content
	 */
	setTooltipContent(content) {
		this._tooltip?.setContent(content);
		return this;
	}

	/**
	 * Returns the tooltip bound to this layer.
	 * @category Tooltip methods
	 * @returns {Tooltip | null | undefined}
	 */
	getTooltip() {
		return this._tooltip;
	}

	/** @param {unknown} add also the `add` listener, so any truthy argument adds */
	_toggleFocusListeners(add) {
		if (this.getElement) {
			this._addFocusListenersOnLayer(this, !add);
		} else if (this.eachLayer) {
			this.eachLayer(layer => this._addFocusListenersOnLayer(/** @type {Layer} */ (layer), !add));
		}
	}

	/**
	 * @param {Layer} layer
	 * @param {boolean} remove
	 */
	_addFocusListenersOnLayer(layer, remove) {
		const el = layer.getElement?.();
		if (!el) { return; }

		const oldHandler = focusHandlers.get(el);
		if (oldHandler) { off(el, 'focus', oldHandler, this); }

		if (remove) {
			focusHandlers.delete(el);
			off(el, 'blur', this.closeTooltip, this);
			return;
		}

		// open only on keyboard focus: an element clicked with the mouse keeps focus and gets it again whenever the
		// window is refocused or a popup closes, which would open the tooltip without the pointer over the layer
		const handler = () => {
			if (this._tooltip && el.matches(':focus-visible')) {
				this._tooltip._source = layer;
				this.openTooltip();
			}
		};
		focusHandlers.set(el, handler);
		on(el, 'focus', handler, this);
		on(el, 'blur', this.closeTooltip, this);
	}

	/** @param {LeafletEvent & {latlng?: LatLng}} e */
	_openTooltip(e) {
		if (!this._tooltip || !this._map) {
			return;
		}

		// If the map is moving, we will show the tooltip after it's done.
		if (this._map.dragging.moving()) {
			if (e.type === 'add' && !this._moveEndOpensTooltip) {
				this._moveEndOpensTooltip = true;
				this._map.once('moveend', () => {
					this._moveEndOpensTooltip = false;
					this._openTooltip(e);
				});
			}
			return;
		}

		this._tooltip._source = /** @type {Layer} */ (e.propagatedFrom ?? e.target);

		this.openTooltip(this._tooltip.options.sticky ? e.latlng : undefined);
	}

	/** @param {{latlng: LatLng, originalEvent?: PointerEvent | MouseEvent}} e */
	_moveTooltip(e) {
		const tooltip = /** @type {Tooltip} */ (this._tooltip);
		tooltip.setLatLng(tooltip.options.sticky && e.originalEvent ?
			this._map.pointerEventToLatLng(e.originalEvent) : e.latlng);
	}

	/**
	 * @template {Popup | Tooltip} T
	 * @param {new (options?: any, source?: Layer) => T} OverlayClass
	 * @param {T | null | undefined} old
	 * @param {OverlayContent | T} content
	 * @param {object} [options]
	 */
	_initOverlay(OverlayClass, old, content, options) {
		let overlay = content;
		if (overlay instanceof OverlayClass) {
			setOptions(/** @type {{options: object}} */ (overlay), options);
			overlay._source = this;
		} else {
			overlay = (old && !options) ? old : new OverlayClass(options, this);
			overlay.setContent(/** @type {OverlayContent} */ (content));
		}
		return overlay;
	}

	// Returns the layer a bound popup or tooltip opens on, or nothing if there's none on the map.
	// `FeatureGroup` overrides it to pick one of its own layers.
	/** @returns {Layer | undefined} */
	_getOverlaySource() {
		return this;
	}

	// Whether clicking the layer again closes its open popup. `Path` overrides it to
	// move the popup to the new click position instead.
	_togglesPopupOnClick() {
		return true;
	}
}

/** @import {Feature, FeatureCollection, GeoJsonObject, Geometry, Point, Position} from 'geojson' */
/** @import {LatLngExpression, NestedCoords} from '../types.js' */

// Shared by `GeoJSON` and the `toGeoJSON` methods of the layers it creates, which can't import `GeoJSON.js` without a cycle.

/**
 * @param {LatLngExpression} latlng
 * @param {number | false} [precision]
 * @returns {Position}
 */
function latLngToCoords(latlng, precision) {
	latlng = new LatLng(latlng);
	return latlng.alt !== undefined ?
		[formatNum(latlng.lng, precision), formatNum(latlng.lat, precision), formatNum(latlng.alt, precision)] :
		[formatNum(latlng.lng, precision), formatNum(latlng.lat, precision)];
}

/**
 * @param {NestedCoords<LatLngExpression>} latlngs
 * @param {number} [levelsDeep]
 * @param {boolean} [close]
 * @param {number | false} [precision]
 * @returns {NestedCoords<Position>}
 */
function latLngsToCoords(latlngs, levelsDeep, close, precision) {
	if (!isFlat(latlngs)) {
		return /** @type {NestedCoords<Position>} */ (latlngs.map(ring => latLngsToCoords(ring, levelsDeep, close, precision)));
	}
	const coords = latlngs.map(latlng => latLngToCoords(latlng, precision));

	if (close && coords.length > 0) {
		coords.push(coords[0].slice());
	}

	return coords;
}

/**
 * @template {Geometry} G
 * @param {{feature?: Feature}} layer
 * @param {G} newGeometry
 * @returns {Feature<G>}
 */
function getFeature(layer, newGeometry) {
	return layer.feature ?
		{...layer.feature, geometry: newGeometry} :
		asFeature(newGeometry);
}

/**
 * @template {Geometry} G
 * @overload
 * @param {G | Feature<G>} geojson
 * @returns {Feature<G>}
 */
/**
 * @overload
 * @param {GeoJsonObject} geojson
 * @returns {Feature | FeatureCollection}
 */
/** @param {any} geojson */
function asFeature(geojson) {
	if (geojson.type === 'Feature' || geojson.type === 'FeatureCollection') {
		return geojson;
	}

	return {
		type: 'Feature',
		properties: {},
		geometry: geojson
	};
}

/**
 * @param {{feature?: Feature, getLatLng(): LatLng}} layer
 * @param {number | false} [precision]
 * @returns {Feature<Point>}
 */
function pointToGeoJSON(layer, precision) {
	return getFeature(layer, {
		type: 'Point',
		coordinates: latLngToCoords(layer.getLatLng(), precision)
	});
}

/** @import {Feature, FeatureCollection, MultiPoint, Position} from 'geojson' */
/** @import {InteractiveLayerEventMap, InteractiveLayerOptions} from '../types.js' */
/** @import {LatLng} from '../geo/LatLng.js' */
/** @import {LatLngBounds} from '../geo/LatLngBounds.js' */
/** @import {LeafletMap} from '../map/Map.js' */
/** @import {Marker} from './marker/Marker.js' */
/** @import {LayerBase} from './LayerBase.js' */

// a layer with the methods that only some layers have, which groups call when present
/**
 * @template {LayerBase} [L=Layer]
 * @typedef {L & {
 *   setZIndex?(zIndex: number): unknown,
 *   setStyle?(style?: object): unknown,
 *   bringToFront?(): unknown,
 *   bringToBack?(): unknown,
 *   getBounds?(): LatLngBounds,
 *   getLatLng?(): LatLng,
 *   toGeoJSON?(precision?: number | false): Feature | FeatureCollection
 * }} MemberLayer
 */

/**
 * Used to group several layers and handle them as one. If you add it to the map, any layers added
 * or removed from the group will be added/removed on the map as well. Extends `Layer`.
 * @example
 * ```js
 * new LayerGroup([marker1, marker2])
 * 	.addLayer(polyline)
 * 	.addTo(map);
 * ```
 * @template {LayerBase} [L=Layer]
 * @template {InteractiveLayerOptions} [O=InteractiveLayerOptions]
 * @template {InteractiveLayerEventMap} [E=InteractiveLayerEventMap]
 * @extends {Layer<O, E>}
 */
class LayerGroup extends Layer {

	static initHooks = true;

	/**
	 * Create a layer group, optionally given an initial set of layers and an `options` object.
	 * @param {NoInfer<L>[]} [layers]
	 * @param {NoInfer<Partial<O>>} [options]
	 */
	constructor(layers, options) {
		super();

		setOptions(this, options);

		/** @type {{[id: number]: MemberLayer<L>}} */
		this._layers = {};

		for (const layer of layers ?? []) {
			this.addLayer(layer);
		}

		this.callInitHooks();
	}

	/**
	 * Adds the given layer to the group.
	 * @param {L} layer
	 */
	addLayer(layer) {
		const id = this.getLayerId(layer);

		this._layers[id] = layer;

		this._map?.addLayer(layer);

		return this;
	}

	/**
	 * Removes the given layer, or the layer with the given internal ID, from the group.
	 * @param {L | number} layer
	 */
	removeLayer(layer) {
		const id = typeof layer === 'number' ? layer : this.getLayerId(layer);

		if (this._map && this._layers[id]) {
			this._map.removeLayer(this._layers[id]);
		}

		delete this._layers[id];

		return this;
	}

	/**
	 * Returns `true` if the given layer, or the layer with the given internal ID, is currently added to the group.
	 * @param {L | number} layer
	 */
	hasLayer(layer) {
		const layerId = typeof layer === 'number' ? layer : this.getLayerId(layer);
		return layerId in this._layers;
	}

	/** Removes all the layers from the group. */
	clearLayers() {
		return this.eachLayer(this.removeLayer, this);
	}

	/** @param {LeafletMap} map */
	onAdd(map) {
		this.eachLayer(map.addLayer, map);
	}

	/** @param {LeafletMap} map */
	onRemove(map) {
		this.eachLayer(map.removeLayer, map);
	}

	/**
	 * Iterates over the layers of the group, optionally specifying context of the iterator function.
	 * ```js
	 * group.eachLayer(layer => layer.bindPopup('Hello'));
	 * ```
	 * @param {(layer: MemberLayer<L>) => void} method
	 * @param {unknown} [context]
	 */
	eachLayer(method, context) {
		for (const layer of Object.values(this._layers)) {
			method.call(context, layer);
		}
		return this;
	}

	/**
	 * Returns the layer with the given internal ID.
	 * @param {number} id
	 * @returns {L | undefined}
	 */
	getLayer(id) {
		return this._layers[id];
	}

	/**
	 * Returns an array of all the layers added to the group.
	 * @returns {L[]}
	 */
	getLayers() {
		/** @type {L[]} */
		const layers = [];
		this.eachLayer(layer => layers.push(layer));
		return layers;
	}

	/**
	 * Calls `setZIndex` on every layer contained in this group, passing the z-index.
	 * @param {number} zIndex
	 */
	setZIndex(zIndex) {
		for (const layer of Object.values(this._layers)) {
			layer.setZIndex?.(zIndex);
		}
		return this;
	}

	/**
	 * Returns the internal ID for a layer
	 * @param {L} layer
	 */
	getLayerId(layer) {
		return stamp(layer);
	}

	/**
	 * Returns a GeoJSON `MultiPoint` feature with the positions of the group's markers. `precision` is the number of
	 * decimal places for coordinates, as in [`toGeoJSON`](#layergroup-togeojson).
	 * @param {number | false} [precision]
	 * @returns {Feature<MultiPoint>}
	 */
	toMultiPoint(precision) {
		/** @type {Position[]} */
		const coords = [];

		this.eachLayer((layer) => {
			coords.push(/** @type {Marker} */ (/** @type {LayerBase} */ (layer)).toGeoJSON(precision).geometry.coordinates);
		});

		return getFeature(this, {
			type: 'MultiPoint',
			coordinates: coords
		});
	}

	/**
	 * Coordinates values are rounded with [`formatNum`](#util-formatnum) function with given `precision`.
	 * Returns a [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) representation of the layer group
	 * (as a GeoJSON `FeatureCollection`, `GeometryCollection`, or `MultiPoint`).
	 * @param {number | false} [precision]
	 * @returns {Feature | FeatureCollection}
	 */
	toGeoJSON(precision) {

		const type = this.feature?.geometry?.type;

		if (type === 'MultiPoint') {
			return this.toMultiPoint(precision);
		}

		const isGeometryCollection = type === 'GeometryCollection',
		/** @type {any[]} */
		jsons = [];

		this.eachLayer((layer) => {
			if (layer.toGeoJSON) {
				const json = layer.toGeoJSON(precision);
				if (isGeometryCollection) {
					jsons.push(/** @type {Feature} */ (json).geometry);
				} else {
					const feature = asFeature(json);
					// Squash nested feature collections
					if (feature.type === 'FeatureCollection') {
						jsons.push(...feature.features);
					} else {
						jsons.push(feature);
					}
				}
			}
		});

		if (isGeometryCollection) {
			return getFeature(this, {
				geometries: jsons,
				type: 'GeometryCollection'
			});
		}

		return {
			type: 'FeatureCollection',
			features: jsons
		};
	}
}

/** @import {FeatureGroupEventMap, InteractiveLayerOptions, LayerEvent} from '../types.js' */
/** @import {Layer} from './Layer.js' */
/** @import {LayerBase} from './LayerBase.js' */

/**
 * @typedef {Object} FeatureGroupEvents
 * @property {LayerEvent} layeradd Fired when a layer is added to this `FeatureGroup`
 * @property {LayerEvent} layerremove Fired when a layer is removed from this `FeatureGroup`
 */

/**
 * Extended `LayerGroup` that makes it easier to do the same thing to all its member layers:
 *  * [`bindPopup`](#layer-bindpopup) binds a popup to all of the layers at once (likewise with [`bindTooltip`](#layer-bindtooltip))
 *  * Events are propagated to the `FeatureGroup`, so if the group has an event
 * handler, it will handle events from any of the layers. This includes pointer events and custom events.
 *  * Has `layeradd` and `layerremove` events
 * @example
 * ```js
 * new FeatureGroup([marker1, marker2, polyline])
 * 	.bindPopup('Hello world!')
 * 	.on('click', function() { alert('Clicked on a member of the group!'); })
 * 	.addTo(map);
 * ```
 * @template {Layer} [L=Layer]
 * @template {InteractiveLayerOptions} [O=InteractiveLayerOptions]
 * @template {FeatureGroupEventMap} [E=FeatureGroupEventMap]
 * @extends {LayerGroup<L, O, E>}
 */
class FeatureGroup extends LayerGroup {

	/** @param {L} layer */
	addLayer(layer) {
		if (this.hasLayer(layer)) {
			return this;
		}

		layer.addEventParent(this);

		super.addLayer(layer);

		return this.fire('layeradd', {layer});
	}

	/** @param {L | number} layer */
	removeLayer(layer) {
		if (!this.hasLayer(layer)) {
			return this;
		}
		if (typeof layer === 'number') {
			layer = this._layers[layer];
		}

		layer.removeEventParent(this);

		super.removeLayer(layer);

		return this.fire('layerremove', {layer});
	}

	/**
	 * Sets the given path options to each layer of the group that has a `setStyle` method.
	 * @param {object} style
	 */
	setStyle(style) {
		for (const layer of Object.values(this._layers)) {
			layer.setStyle?.(style);
		}
		return this;
	}

	/** Brings the layer group to the top of all other layers */
	bringToFront() {
		for (const layer of Object.values(this._layers)) {
			layer.bringToFront?.();
		}
		return this;
	}

	/** Brings the layer group to the back of all other layers */
	bringToBack() {
		for (const layer of Object.values(this._layers)) {
			layer.bringToBack?.();
		}
		return this;
	}

	/**
	 * Returns the LatLngBounds of the Feature Group (created from bounds and coordinates
	 * of its children, including the layers of nested layer groups).
	 */
	getBounds() {
		const bounds = new LatLngBounds();

		for (const layer of Object.values(this._layers)) {
			if (layer.getBounds) {
				bounds.extend(layer.getBounds());
			} else if (layer.getLatLng) {
				bounds.extend(layer.getLatLng());
			} else if (layer instanceof LayerGroup) {
				bounds.extend(FeatureGroup.prototype.getBounds.call(layer));
			}
		}
		return bounds;
	}

	// bound popups and tooltips open on the first of the group's layers that is on the map
	/** @returns {Layer | undefined} */
	_getOverlaySource() {
		return Object.values(this._layers).find(layer => layer._map);
	}
}

/** @import {Defaults, IconDefaults, IconOptions, PointExpression} from '../../types.js' */

const defaultOptions$7 = {
	/**
	 * **(required)** The URL to the icon image (absolute or relative to your script path).
	 * @type {string | null}
	 */
	iconUrl: null,

	/**
	 * The URL to a retina sized version of the icon image (absolute or relative to your script path). Used for
	 * Retina screen devices.
	 * @type {string | null}
	 */
	iconRetinaUrl: null,

	/**
	 * Size of the icon image in pixels. A number sets both width and height.
	 * @type {PointExpression | number | null}
	 */
	iconSize: null,

	/**
	 * The coordinates of the "tip" of the icon (relative to its top left corner). The icon will be aligned so that
	 * this point is at the marker's geographical location. Centered by default if size is specified, also can be
	 * set in CSS with negative margins.
	 * @type {PointExpression | null}
	 */
	iconAnchor: null,

	/**
	 * The coordinates of the point from which popups will "open", relative to the icon anchor.
	 * @type {PointExpression}
	 */
	popupAnchor: [0, 0],

	/**
	 * Where tooltips opening to the side attach, relative to the icon anchor: `x` is how far to the right (mirrored
	 * for tooltips opening to the left) and `y` how far down. Tooltips opening to the top or bottom attach to the
	 * middle of the icon's top or bottom edge, and `center` ones to the middle of the icon at the `y` height.
	 * @type {PointExpression}
	 */
	tooltipAnchor: [0, 0],

	/**
	 * The URL to the icon shadow image. If not specified, no shadow image will be created.
	 * @type {string | null}
	 */
	shadowUrl: null,

	/**
	 * The URL to a retina sized version of the shadow image. Used for Retina screen devices.
	 * @type {string | null}
	 */
	shadowRetinaUrl: null,

	/**
	 * Size of the shadow image in pixels. A number sets both width and height.
	 * @type {PointExpression | number | null}
	 */
	shadowSize: null,

	/**
	 * The coordinates of the "tip" of the shadow (relative to its top left corner) (the same as iconAnchor if not
	 * specified).
	 * @type {PointExpression | null}
	 */
	shadowAnchor: null,

	/** A custom class name to assign to both icon and shadow images. */
	className: '',

	/**
	 * Whether the crossOrigin attribute will be added to the icon images. If a String is provided, all images will
	 * have their crossOrigin attribute set to the String provided. Refer to [CORS
	 * Settings](https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_settings_attributes) for valid String values.
	 * @type {boolean | string}
	 */
	crossOrigin: false
};

/** @typedef {typeof defaultOptions} IconDefaultsValues */

/**
 * Represents an icon to provide when creating a marker.
 * @example
 * ```js
 * const myIcon = new Icon({
 *     iconUrl: 'my-icon.png',
 *     iconRetinaUrl: 'my-icon@2x.png',
 *     iconSize: [38, 95],
 *     iconAnchor: [22, 94],
 *     popupAnchor: [-3, -76],
 *     shadowUrl: 'my-icon-shadow.png',
 *     shadowRetinaUrl: 'my-icon-shadow@2x.png',
 *     shadowSize: [68, 95],
 *     shadowAnchor: [22, 94]
 * });
 *
 * new Marker([50.505, 30.57], {icon: myIcon}).addTo(map);
 * ```
 *
 * `DefaultIcon` extends `Icon` and is the blue icon Leaflet uses for markers by default.
 * @template {IconOptions} [O=IconOptions]
 * @extends {Class<O & IconDefaults>}
 */
class Icon extends Class {

	static initHooks = true;

	/** @type {Defaults<IconOptions>} */
	static defaultOptions = defaultOptions$7;

	/**
	 * Creates an icon instance with the given options.
	 * @param {NoInfer<Partial<O>>} [options]
	 */
	constructor(options) {
		super();
		setOptions(this, options);
		this.callInitHooks();
	}

	/**
	 * Called internally when the icon has to be shown, returns
	 * a `<img>` HTML element styled according to the options.
	 * @param {HTMLElement | null} [oldIcon]
	 * @returns {HTMLElement}
	 */
	createIcon(oldIcon) {
		return this._createIcon('icon', oldIcon);
	}

	/**
	 * As `createIcon`, but for the shadow beneath it.
	 * @param {HTMLElement | null} [oldIcon]
	 */
	createShadow(oldIcon) {
		return this._createIcon('shadow', oldIcon);
	}

	/**
	 * @overload
	 * @param {'icon'} name
	 * @param {HTMLElement | null} [oldIcon]
	 * @returns {HTMLImageElement}
	 */
	/**
	 * @overload
	 * @param {'icon' | 'shadow'} name
	 * @param {HTMLElement | null} [oldIcon]
	 * @returns {HTMLImageElement | null}
	 */
	/**
	 * @param {'icon' | 'shadow'} name
	 * @param {HTMLElement | null} [oldIcon]
	 */
	_createIcon(name, oldIcon) {
		const src = this._getIconUrl(name);

		if (!src) {
			if (name === 'icon') {
				throw new Error('iconUrl not set in Icon options (see the docs).');
			}
			return null;
		}

		const img = this._createImg(src, oldIcon instanceof HTMLImageElement ? oldIcon : null);
		this._setIconStyles(img, name);

		if (this.options.crossOrigin || this.options.crossOrigin === '') {
			// the DOM types leave out '', which is how the attribute spells 'anonymous'
			img.crossOrigin = /** @type {HTMLImageElement['crossOrigin']} */ (this.options.crossOrigin === true ? '' : this.options.crossOrigin);
		} else {
			img.crossOrigin = null;
		}

		return img;
	}

	/**
	 * The size and anchor of the icon or shadow in pixels; a side that isn't a number, like 'auto' in [100, 'auto'],
	 * is left to CSS and comes out as NaN.
	 * @param {'icon' | 'shadow'} name
	 */
	_getBox(name) {
		const options = this.options;
		const sizeOption = options[`${name}Size`];
		const [width, height] = (typeof sizeOption === 'number' ? [sizeOption, sizeOption] :
			Array.isArray(sizeOption) ? sizeOption : [sizeOption?.x, sizeOption?.y]).map(toNumber);

		const anchorOption = name === 'shadow' && options.shadowAnchor || options.iconAnchor;
		const anchor = Point.validate(anchorOption) ? new Point(anchorOption) : {x: width / 2, y: height / 2};
		return {width, height, anchor};
	}

	/**
	 * Where a tooltip opening in the given direction attaches, relative to the icon anchor.
	 * @param {string} [direction]
	 */
	_getTooltipAnchor(direction) {
		const {x, y} = new Point(this.options.tooltipAnchor);
		if (direction === 'left') { return new Point(-x, y); }
		if (direction === 'center') { return new Point(0, y); }
		if (direction !== 'top' && direction !== 'bottom') { return new Point(x, y); }

		const {height, anchor} = this._getBox('icon');
		return new Point(0, (direction === 'top' ? -anchor.y : height - anchor.y) || 0);
	}

	/**
	 * @param {HTMLElement} img
	 * @param {'icon' | 'shadow'} name
	 */
	_setIconStyles(img, name) {
		const options = this.options;
		const {width, height, anchor} = this._getBox(name);

		img.className = `leaflet-marker-${name} ${options.className || ''}`;

		// a marker reuses the element of its previous icon, which may have set any of these
		const {style} = img;
		style.marginLeft = style.marginTop = style.transformOrigin = style.width = style.height = '';

		if (!isNaN(anchor.x)) { style.marginLeft = `${-anchor.x}px`; }
		if (!isNaN(anchor.y)) { style.marginTop = `${-anchor.y}px`; }
		if (!isNaN(anchor.x) && !isNaN(anchor.y)) { style.transformOrigin = `${anchor.x}px ${anchor.y}px`; }

		if (!isNaN(width)) { style.width = `${width}px`; }
		if (!isNaN(height)) { style.height = `${height}px`; }
	}

	/**
	 * @param {string} src
	 * @param {HTMLImageElement | null} el
	 */
	_createImg(src, el) {
		el ??= document.createElement('img');
		el.src = src;
		return el;
	}

	/** @param {'icon' | 'shadow'} name */
	_getIconUrl(name) {
		return window.devicePixelRatio > 1 && this.options[`${name}RetinaUrl`] || this.options[`${name}Url`];
	}
}

/** @import {DefaultIconDefaults, DefaultIconOptions, Defaults, IconOptions} from '../../types.js' */

// the path itself draws white (the root fill) under the pin, which fades to it at the top, so a single color gets a highlight
// like the default one; the outline keeps light colors visible, but would double the antialiased edges of the default pin
/**
 * @param {string} fill
 * @param {string} fillTop
 * @param {string} stroke
 * @param {string} strokeTop
 */
const pin = (fill, fillTop, stroke, strokeTop, outline = '') => `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25.59 47.09" fill="%23fff" stroke-width="1.1"><radialGradient id="c"><stop stop-opacity=".3"/><stop offset="1" stop-opacity="0"/></radialGradient><ellipse cx="12.8" cy="41.53" rx="10.5" ry="5" fill="url(%23c)"/><linearGradient id="a" x2="0" y1="1"><stop stop-color="${fill}"/><stop offset="1" stop-color="${fillTop}" stop-opacity=".75"/></linearGradient><linearGradient id="b" x2="0" y1=".5"><stop stop-color="${stroke}"/><stop offset="1" stop-color="${strokeTop}"/></linearGradient><circle cx="12.8" cy="13.63" r="4.7"/><path id="p" d="M12.84 1.74c-6.57 0-12.04 5.69-12.04 11.87 0 2.78 1.56 6.31 2.69 8.75l9.31 17.87 9.26-17.87c1.13-2.44 2.74-5.79 2.74-8.75 0-6.18-5.38-11.87-11.96-11.87Zm0 7.16a4.71 4.71 0 0 1 4.68 4.71c0 2.59-2.1 4.66-4.68 4.68-2.58-.02-4.68-2.09-4.68-4.68a4.71 4.71 0 0 1 4.68-4.71Z"/><use href="%23p" fill="url(%23a)" stroke="url(%23b)"/>${outline}</svg>`;

/** @satisfies {Defaults<IconOptions>} */
const defaultOptions$6 = {
	iconUrl: /* @__PURE__ */ pin('%23126FC6', '%23107BC2', '%232E6C97', '%233883B7'),
	iconSize: [25, 46],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	tooltipAnchor: [16, -28],

	/**
	 * Paints the pin in the given CSS color instead of the default blue, overriding `iconUrl`.
	 * @type {string | null}
	 */
	color: null
};

/** @typedef {typeof defaultOptions} DefaultIconDefaultsValues */

/**
 * A subclass of `Icon`, represents the icon to use in `Marker`s when no icon is specified. The marker, with a soft
 * shadow under its tip, is one inlined SVG data URI, so it needs no image files.
 * @example
 * ```js
 * new Marker(latlng, {icon: new DefaultIcon({color: 'crimson'})}).addTo(map);
 * ```
 *
 * In order to customize the default icon, just change the properties of `DefaultIcon.defaultOptions` (which is a
 * set of `Icon options`).
 *
 * If you want to _completely_ replace the default icon, override the `Marker.defaultOptions.icon` with your own
 * icon instead.
 * @template {DefaultIconOptions} [O=DefaultIconOptions]
 * @extends {Icon<O & DefaultIconDefaults>}
 */
class DefaultIcon extends Icon {

	/** @type {Defaults<DefaultIconOptions>} */
	static defaultOptions = defaultOptions$6;

	/** @param {'icon' | 'shadow'} name */
	_getIconUrl(name) {
		const {color} = this.options;
		if (!color || name !== 'icon') { return super._getIconUrl(name); }
		const c = color.replace('#', '%23');
		return pin(c, c, c, c, '<use href="%23p" fill="none" stroke="%23666" stroke-opacity=".4"/>');
	}
}

/** @import {DragEndEvent, DragStartEvent, LeafletEvent, MarkerMoveEvent} from '../../types.js' */
/** @import {LatLng} from '../../geo/LatLng.js' */
/** @import {Marker} from './Marker.js' */

/** @type {Record<string, [number, number]>} */
const arrows = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};

// Used internally by Marker to make the markers draggable.
class MarkerDrag extends Handler {
	static initHooks = true;

	/** @param {Marker} marker */
	constructor(marker) {
		super(marker._map);
		this._marker = marker;
		this.callInitHooks();
	}

	addHooks() {
		const icon = /** @type {HTMLElement} */ (this._marker._icon);

		if (!this._draggable) {
			/** @type {Draggable} */
			this._draggable = new Draggable(icon);
		}

		this._draggable.on({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).enable();

		on(icon, 'keydown keyup blur', this._onKey, this);

		icon.classList.add('leaflet-marker-draggable');
	}

	removeHooks() {
		this._keyDrag = false; // disabling the Draggable below ends a keyboard drag in progress, as it does a pointer drag

		this._draggable.off({
			dragstart: this._onDragStart,
			predrag: this._onPreDrag,
			drag: this._onDrag,
			dragend: this._onDragEnd
		}, this).disable();

		off(this._draggable._element, 'keydown keyup blur', this._onKey, this);

		this._marker._icon?.classList.remove('leaflet-marker-draggable');
	}

	/** Returns `true` if the current or last drag moved the marker, e.g. to ignore the click that ends a drag. */
	moved() {
		return this._draggable?._moved;
	}

	/** @param {LeafletEvent & Partial<MarkerMoveEvent>} e */
	_adjustPan(e) {
		const marker = this._marker,
		map = marker._map,
		speed = this._marker.options.autoPanSpeed,
		padding = new Point(this._marker.options.autoPanPadding),
		icon = /** @type {HTMLElement} */ (marker._icon),
		iconPos = getPosition(icon),
		bounds = map.getPixelBounds(),
		origin = map.getPixelOrigin(),
		min = bounds.min._subtract(origin)._add(padding),
		max = bounds.max._subtract(origin)._subtract(padding),
		// how far the icon is past the padded bounds on each axis (0 if within)
		dx = Math.max(iconPos.x - max.x, 0) + Math.min(iconPos.x - min.x, 0),
		dy = Math.max(iconPos.y - max.y, 0) + Math.min(iconPos.y - min.y, 0);

		if (dx || dy) {
			// pan faster the deeper the icon goes into the padding, but not past maxBounds
			const movement = map._limitOffset(new Point(
				padding.x ? dx / padding.x * speed : Math.sign(dx) * speed,
				padding.y ? dy / padding.y * speed : Math.sign(dy) * speed), map.options.maxBounds)._round();

			if (!movement.x && !movement.y) { return; }

			map.panBy(movement, {animate: false});

			this._draggable._newPos._add(movement);
			this._draggable._startPos._add(movement);

			setPosition(icon, this._draggable._newPos);
			this._onDrag(e);

			/** @type {number} */
			this._panRequest = requestAnimationFrame(this._adjustPan.bind(this, e));
		}
	}

	/** @param {DragStartEvent} e */
	_onDragStart(e) {
		/** @type {LatLng} */
		this._oldLatLng = this._marker.getLatLng();

		// When using ES6 imports it could not be set when `Popup` was not imported as well
		this._marker.closePopup?.();

		const {originalEvent} = e;
		this._marker
			.fire('movestart', {originalEvent})
			.fire('dragstart', {originalEvent});
	}

	/** @param {LeafletEvent} e */
	_onPreDrag(e) {
		if (this._marker.options.autoPan) {
			cancelAnimationFrame(this._panRequest);
			this._panRequest = requestAnimationFrame(this._adjustPan.bind(this, e));
		}
	}

	/** @param {LeafletEvent & Partial<MarkerMoveEvent>} e */
	_onDrag(e) {
		const marker = this._marker,
		iconPos = getPosition(/** @type {HTMLElement} */ (marker._icon)),
		latlng = marker._map.layerPointToLatLng(iconPos),
		{alt} = this._oldLatLng;

		if (alt !== undefined) { latlng.alt = alt; }

		// Draggable only moved the icon and dropped its rotation
		marker._positionElements(iconPos);

		marker._latlng = latlng;
		e.latlng = latlng;
		e.oldLatLng = this._oldLatLng;

		marker
			.fire('move', e)
			.fire('drag', e);
	}

	/** @param {DragEndEvent} e */
	_onDragEnd(e) {
		cancelAnimationFrame(this._panRequest);

		this._marker
			.fire('moveend')
			.fire('dragend', e);
	}

	// Arrow keys move a focused marker. Holding a key down is one drag, driven through the Draggable like a pointer
	// drag (so the two can't overlap), and ends on keyup or blur.
	/** @param {KeyboardEvent | FocusEvent} e */
	_onKey(e) {
		const k = /** @type {KeyboardEvent} */ (e), // all but blur
		dir = arrows[k.key],
		draggable = this._draggable,
		{options, _map: map} = this._marker;

		if (e.type !== 'keydown') {
			if (this._keyDrag) {
				this._keyDrag = false;
				draggable.finishDrag();
			}

		} else if (dir && k.target === draggable._element && !(k.altKey || k.ctrlKey || k.metaKey)) {
			e.preventDefault(); // don't scroll the page

			if (!this._keyDrag) {
				if (Draggable._dragging) { return; }
				Draggable._dragging = draggable;
				draggable._startPos = draggable._newPos = getPosition(draggable._element);
				draggable._moved = draggable._moving = this._keyDrag = true;
				draggable.fire('dragstart', {originalEvent: k});
			}

			// not through _updatePosition, whose predrag would start the pointer autoPan loop
			draggable._newPos = draggable._newPos.add(new Point(...dir).multiplyBy(k.shiftKey ? 30 : 10));
			setPosition(draggable._element, draggable._newPos);
			draggable.fire('drag', {originalEvent: k});

			if (options.autoPan) {
				map.panInside(this._marker._latlng, {padding: options.autoPanPadding, animate: false});
			}
		}
	}
}

/** @import {Feature, Point as GeoJSONPoint} from 'geojson' */
/** @import {Defaults, DragEndEvent, DragStartEvent, LatLngExpression, LeafletEvent, MapListeners, MarkerDefaults,
 *    MarkerEventMap, MarkerMoveEvent, MarkerOptions, PointExpression, ZoomAnimEvent} from '../../types.js' */
/** @import {LeafletMap} from '../../map/Map.js' */
/** @import {Icon} from './Icon.js' */

const defaultOptions$5 = {
	/**
	 * Icon instance to use for rendering the marker. See [Icon documentation](#Icon) for details on how
	 * to customize the marker icon. If not specified, a common instance of `DefaultIcon` is used.
	 * @type {Icon}
	 */
	icon: /* @__PURE__ */ new DefaultIcon(),

	// Option inherited from "Interactive layer" abstract class
	interactive: true,

	/** Whether the marker can be tabbed to with a keyboard and, if interactive, clicked by pressing Enter or Space. */
	keyboard: true,

	/**
	 * Text for the browser tooltip that appear on marker hover (no tooltip by default). [Useful for
	 * accessibility](https://leafletjs.com/examples/accessibility/#markers-must-be-labelled).
	 */
	title: '',

	/**
	 * Text for the `alt` attribute of the icon image. [Useful for
	 * accessibility](https://leafletjs.com/examples/accessibility/#markers-must-be-labelled).
	 * @translatable
	 */
	alt: 'Marker',

	/**
	 * By default, marker images zIndex is set automatically based on its latitude. Use
	 * this option if you want to put the marker on top of all others (or below), specifying
	 * a high value like `1000` (or high negative value, respectively).
	 */
	zIndexOffset: 0,

	/** The opacity of the marker. */
	opacity: 1,

	/**
	 * Rotation of the marker icon in degrees, clockwise, around the icon anchor. A rotated marker, even at 0°, has
	 * no shadow, since the shadow of an upright pin looks wrong under a tilted one. `null` means no rotation.
	 * @type {number | null}
	 */
	rotation: null,

	/** If `true`, the marker will get on top of others while the pointer is over it. It always does while it has focus. */
	riseOnHover: false,

	/** The z-index offset used when the marker gets on top of others on hover or focus. */
	riseOffset: 250,

	/** `Map pane` where the markers icon will be added. */
	pane: 'markerPane',

	/** `Map pane` where the markers shadow will be added. */
	shadowPane: 'shadowPane',

	/**
	 * When `true`, a pointer event on this marker will trigger the same event on the
	 * map (unless [`DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
	 */
	bubblingPointerEvents: false,

	/**
	 * When `true`, the map will pan whenever the marker is focused (via e.g. pressing
	 * `tab` on the keyboard) to ensure the marker is visible within the map's bounds
	 */
	autoPanOnFocus: true,

	/**
	 * Whether the marker is draggable with pointer or not. A focused draggable marker can also be moved with the arrow
	 * keys, by 10 pixels or 30 with Shift.
	 * @category Draggable marker options
	 */
	draggable: false,

	/**
	 * Whether to pan the map when dragging this marker near its edge or not.
	 * @category Draggable marker options
	 */
	autoPan: false,

	/**
	 * Distance (in pixels to the left/right and to the top/bottom) of the map edge to start panning the map.
	 * @category Draggable marker options
	 * @type {PointExpression}
	 */
	autoPanPadding: [50, 50],

	/**
	 * Number of pixels the map should pan by.
	 * @category Draggable marker options
	 */
	autoPanSpeed: 10
};

/** @typedef {typeof defaultOptions} MarkerDefaultsValues */

/**
 * @typedef {Object} MarkerEvents
 * @property {MarkerMoveEvent} move Fired when the marker is moved via [`setLatLng`](#marker-setlatlng) or by
 *   [dragging](#marker-dragging). Old and new coordinates are included in event arguments as `oldLatLng`, `latlng`.
 */

/**
 * @category Dragging events
 * @typedef {Object} MarkerDragEvents
 * @property {DragStartEvent} dragstart Fired when the user starts dragging the marker.
 * @property {DragStartEvent} movestart Fired when the marker starts moving (because of dragging).
 * @property {MarkerMoveEvent} drag Fired repeatedly while the user drags the marker.
 * @property {DragEndEvent} dragend Fired when the user stops dragging the marker.
 * @property {LeafletEvent} moveend Fired when the marker stops moving (because of dragging).
 */

/**
 * @typedef {Object} MarkerMoveEventProps
 * @property {LatLng} oldLatLng The previous position of the marker.
 * @property {LatLng} latlng The new position of the marker.
 */

/**
 * Marker is used to display clickable/draggable icons on the map. Extends `Layer`.
 * @example
 * ```js
 * new Marker([50.5, 30.5]).addTo(map);
 * ```
 * @categoryDescription Methods
 * In addition to [shared layer methods](#Layer) like `addTo()` and `remove()` and [popup
 * methods](#Popup) like bindPopup() you can also use the following methods:
 * @categoryDescription Interaction handlers
 * Interaction handlers are properties of a marker instance that allow you to control interaction behavior in
 * runtime, enabling or disabling certain features such as dragging (see `Handler` methods). Example:
 *
 * ```js
 * marker.dragging.disable();
 * ```
 * @template {MarkerOptions} [O=MarkerOptions]
 * @template {MarkerEventMap} [E=MarkerEventMap]
 * @extends {Layer<O & MarkerDefaults, E>}
 */
class Marker extends Layer {

	static initHooks = true;

	/** @type {Defaults<MarkerOptions>} */
	static defaultOptions = defaultOptions$5;

	/**
	 * Instantiates a Marker object given a geographical point and optionally an options object.
	 * @param {LatLngExpression} latlng
	 * @param {NoInfer<Partial<O>>} [options]
	 */
	constructor(latlng, options) {
		super();

		setOptions(this, options);
		this._latlng = new LatLng(latlng);

		this.callInitHooks();
	}

	/** @param {LeafletMap} map */
	onAdd(map) {
		this._zoomAnimated = this._zoomAnimated && map.options.markerZoomAnimation;

		if (this._zoomAnimated) {
			map.on('zoomanim', this._animateZoom, this);
		}

		this._initIcon();
		this.update();
	}

	/** @param {LeafletMap} map */
	onRemove(map) {
		if (this.dragging) {
			// remember whether dragging is on or off (`dragging.disable()`) for when the marker is added again
			this.options.draggable = this.dragging.enabled();
			if (this.options.draggable) { this.dragging.removeHooks(); }
		}
		delete this.dragging;

		if (this._zoomAnimated) {
			map.off('zoomanim', this._animateZoom, this);
		}

		this._removeIcon();
		this._removeShadow();
	}

	/** @returns {MapListeners} */
	getEvents() {
		return {
			zoom: this.update,
			viewreset: this.update
		};
	}

	/** Returns the current geographical position of the marker. */
	getLatLng() {
		return this._latlng;
	}

	/**
	 * Changes the marker position to the given point.
	 * @param {LatLngExpression} latlng
	 */
	setLatLng(latlng) {
		const oldLatLng = this._latlng;
		this._latlng = new LatLng(latlng);
		this.update();

		return this.fire('move', {oldLatLng, latlng: this._latlng});
	}

	/**
	 * Changes the [zIndex offset](#marker-zindexoffset) of the marker.
	 * @param {number} offset
	 */
	setZIndexOffset(offset) {
		this.options.zIndexOffset = offset;
		return this.update();
	}

	/**
	 * Returns the current icon used by the marker
	 * @returns {Icon}
	 */
	getIcon() {
		return this.options.icon;
	}

	/**
	 * Changes the marker icon.
	 * @param {Icon} icon
	 */
	setIcon(icon) {

		this.options.icon = icon;

		if (this._map) {
			this._initIcon();
			this.update();
		}

		return this;
	}

	/**
	 * Returns the instance of [`HTMLElement`](https://developer.mozilla.org/docs/Web/API/HTMLElement)
	 * used by Marker layer.
	 */
	getElement() {
		return this._icon;
	}

	/** Updates the marker position on the map, e.g. after changing its `zIndexOffset` option directly. */
	update() {

		if (this._icon && this._map) {
			const pos = this._map._snapLayerPoint(this._map.latLngToLayerPoint(this._latlng));
			this._setPos(pos);
		}

		return this;
	}

	_initIcon() {
		const options = this.options,
		classToAdd = `leaflet-zoom-${this._zoomAnimated ? 'animated' : 'hide'}`;

		const icon = options.icon.createIcon(this._icon);
		let addIcon = false;

		// if we're not reusing the icon, remove the old one and init new one
		if (icon !== this._icon) {
			if (this._icon) {
				this._removeIcon();
			}
			addIcon = true;

			if (options.title) {
				icon.title = options.title;
			}

			if (icon instanceof HTMLImageElement) {
				icon.alt = options.alt ? this._map.translate(options.alt) : '';
			}
		}

		icon.classList.add(classToAdd);

		if (options.keyboard) {
			icon.tabIndex = 0;
			if (options.interactive) {
				icon.setAttribute('role', 'button');
				on(icon, 'keydown', this._onKeyDown, this);
			}
		}

		/** @type {HTMLElement | null | undefined} */
		this._icon = icon;

		if (this._popup?._source === this) {
			this._popup._updateSourceAria(this._popup.isOpen());
		}

		on(icon, 'focusin focusout', this._updateRise, this);
		if (options.riseOnHover) {
			on(icon, 'pointerover pointerout', this._updateRise, this);
		}

		if (this.options.autoPanOnFocus) {
			on(icon, 'focus', this._panOnFocus, this);
		}

		const newShadow = options.icon.createShadow?.(this._shadow) ?? null;
		let addShadow = false;

		if (newShadow !== this._shadow) {
			this._removeShadow();
			addShadow = true;
		}

		if (newShadow) {
			newShadow.classList.add(classToAdd);
			newShadow.alt = '';
		}
		/** @type {HTMLImageElement | null | undefined} */
		this._shadow = newShadow;


		if (options.opacity < 1) {
			this._updateOpacity();
		}


		if (addIcon) {
			this.getPane().append(icon);
		}
		this._initInteraction();
		if (newShadow && addShadow) {
			this.getPane(options.shadowPane).append(newShadow);
		}
	}

	_removeIcon() {
		const icon = /** @type {HTMLElement} */ (this._icon);
		off(icon, 'pointerover pointerout focusin focusout', this._updateRise, this);
		off(icon, 'focus', this._panOnFocus, this);
		off(icon, 'keydown', this._onKeyDown, this);
		this._hovered = this._focused = false;

		icon.remove();
		this.removeInteractiveTarget(icon);

		this._icon = null;
	}

	_removeShadow() {
		this._shadow?.remove();
		this._shadow = null;
	}

	/** @param {Point} pos */
	_setPos(pos) {
		this._positionElements(pos);

		/** @type {number} */
		this._zIndex = Math.round(pos.y) + this.options.zIndexOffset;

		this._updateRise();
	}

	/** @param {Point} pos */
	_positionElements(pos) {
		const rotation = this.options.rotation;

		if (this._icon) {
			setPosition(this._icon, pos);
			if (rotation != null) {
				this._icon.style.transform += ` rotate(${rotation}deg)`;
			}
		}

		if (this._shadow) {
			setPosition(this._shadow, pos);
			this._shadow.style.display = rotation == null ? '' : 'none';
		}
	}

	/** @param {number} offset */
	_updateZIndex(offset) {
		if (this._icon) {
			this._icon.style.zIndex = `${this._zIndex + offset}`;
		}
	}

	/** @param {ZoomAnimEvent} opt */
	_animateZoom(opt) {
		const pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center)._round();

		this._setPos(pos);
	}

	_initInteraction() {

		if (!this.options.interactive) { return; }

		const icon = /** @type {HTMLElement} */ (this._icon);
		icon.classList.add('leaflet-interactive');

		this.addInteractiveTarget(icon);

		// When the icon element is reused, the drag handler still refers to it. Keep that handler, because
		// replacing it ends a drag in progress and forgets that the marker has just been dragged.
		if (this.dragging?._draggable?._element === icon) {
			// the icon has reset the class names of the element
			icon.classList.toggle('leaflet-marker-draggable', this.dragging.enabled());
			return;
		}

		let draggable = this.options.draggable;
		if (this.dragging) {
			draggable = this.dragging.enabled();
			this.dragging.disable();
		}

		/**
		 * Marker dragging handler. Only valid when the marker is on the map (Otherwise set
		 * [`marker.options.draggable`](#marker-draggable)).
		 * @category Interaction handlers
		 * @type {MarkerDrag | undefined}
		 */
		this.dragging = new MarkerDrag(this);

		if (draggable) {
			this.dragging.enable();
		}
	}

	/** Returns the current [rotation](#marker-rotation) of the marker in degrees. */
	getRotation() {
		return this.options.rotation;
	}

	/**
	 * Changes the [rotation](#marker-rotation) of the marker; `null` removes it.
	 * @param {number | null} rotation
	 */
	setRotation(rotation) {
		this.options.rotation = rotation;
		// mid-zoom, the icon is transitioning to a position that update() can't compute yet; the zoom end applies it
		if (this._icon && !this._map._animatingZoom) {
			this._positionElements(getPosition(this._icon));
			this._popup?._updatePosition();
			this._tooltip?._updatePosition();
		}
		return this;
	}

	/**
	 * Changes the opacity of the marker.
	 * @param {number} opacity
	 */
	setOpacity(opacity) {
		this.options.opacity = opacity;
		if (this._map) {
			this._updateOpacity();
		}

		return this;
	}

	/**
	 * Coordinates values are rounded with [`formatNum`](#util-formatnum) function
	 * with given `precision`. Returns a [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON)
	 * representation of the marker (as a GeoJSON `Point` Feature).
	 * @category Other methods
	 * @param {number | false} [precision]
	 * @returns {Feature<GeoJSONPoint>}
	 */
	toGeoJSON(precision) {
		return pointToGeoJSON(this, precision);
	}

	_updateOpacity() {
		for (const el of [this._icon, this._shadow]) {
			if (el) {
				el.style.opacity = `${this.options.opacity}`;
			}
		}
	}

	/** @param {Event} [e] */
	_updateRise(e) {
		if (e?.type.startsWith('pointer')) {
			/** @type {boolean} */
			this._hovered = e.type === 'pointerover';
		} else if (e) {
			/** @type {boolean} */
			this._focused = e.type === 'focusin';
		}
		if (this._hovered || this._focused) {
			this._bringToFront();
		} else {
			this._resetZIndex();
		}
	}

	_bringToFront() {
		this._updateZIndex(this.options.riseOffset);
	}

	_resetZIndex() {
		this._updateZIndex(0);
	}

	/** @param {KeyboardEvent} e */
	_onKeyDown(e) {
		// a key pressed on a focusable element inside a DivIcon (e.g. a <button>) already clicks it natively
		if (e.target === this._icon && !e.repeat && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault(); // stop Space from scrolling the page
			this._icon?.click();

			// the popup comes after all markers in the tab order, so move focus into the popup this opened
			const popup = this._map?._popup;
			if (popup?.isOpen() && popup._ariaSource === this._icon) {
				/** @type {HTMLElement | null} */ (popup.getElement()?.querySelector(
					'a[href], button, input, select, textarea, [tabindex="0"]'))?.focus({preventScroll: true});
			}
		}
	}

	_panOnFocus() {
		const map = this._map;
		if (!map) { return; }

		const icon = /** @type {HTMLElement} */ (this._icon),
		style = getComputedStyle(icon),
		anchor = new Point(-parseFloat(style.marginLeft) || 0, -parseFloat(style.marginTop) || 0),
		size = new Point(icon.offsetWidth, icon.offsetHeight);

		map.panInside(this._latlng, {
			paddingTopLeft: anchor,
			paddingBottomRight: size.subtract(anchor)
		});
	}

	_getPopupAnchor() {
		return this._rotateAnchor(this.options.icon.options.popupAnchor);
	}

	/** @param {string} [direction] */
	_getTooltipAnchor(direction) {
		return this._rotateAnchor(this.options.icon._getTooltipAnchor(direction));
	}

	/**
	 * Anchors are offsets from the icon anchor, which is also the rotation origin.
	 * @param {PointExpression} anchor
	 */
	_rotateAnchor(anchor) {
		const angle = (this.options.rotation ?? 0) * Math.PI / 180;
		if (!angle || !anchor) { return anchor; }

		const {x, y} = new Point(anchor),
		cos = Math.cos(angle),
		sin = Math.sin(angle);
		return new Point(x * cos - y * sin, x * sin + y * cos);
	}
}

/** @import {BlanketOverlayDefaults, BlanketOverlayOptions, Defaults, LayerEventMap, LeafletEvent, MapListeners, ZoomAnimEvent} from '../types.js' */
/** @import {LatLng} from '../geo/LatLng.js' */
/** @import {LeafletMap} from '../map/Map.js' */
/** @import {Point} from '../geometry/Point.js' */

const defaultOptions$4 = {
	/**
	 * How much to extend the clip area around the map view (relative to its size), e.g. 0.1 would be 10% of map
	 * view in each direction.
	 */
	padding: 0.1,

	/**
	 * When `false`, the blanket will update its position only when the map state settles (*after* a pan/zoom
	 * animation). When `true`, it will update when the map state changes (*during* pan/zoom animations)
	 */
	continuous: false,
};

/** @typedef {typeof defaultOptions} BlanketOverlayDefaultsValues */

/**
 * Represents an HTML element that covers ("blankets") the entire surface of the map.
 *
 * Do not use this class directly. It's meant for `Renderer`, and for plugins that rely on one single HTML element.
 * @categoryDescription Subclass interface
 * Subclasses must define the following methods:
 * @template {BlanketOverlayOptions} [O=BlanketOverlayOptions]
 * @template {LayerEventMap} [E=LayerEventMap]
 * @extends {Layer<O & BlanketOverlayDefaults, E>}
 */
class BlanketOverlay extends Layer {

	static initHooks = true;

	/** @type {Defaults<BlanketOverlayOptions>} */
	static defaultOptions = defaultOptions$4;

	/**
	 * Creates a blanket overlay with the given options.
	 * @param {NoInfer<Partial<O>>} [options]
	 */
	constructor(options) {
		super();
		setOptions(this, options);
		this.callInitHooks();
	}

	/** @param {LeafletMap} map */
	onAdd(map) {
		if (!this._container) {
			this._initContainer(); // defined by renderer implementations

			// always keep transform-origin as 0 0, #8794
			/** @type {HTMLElement} */ (this._container).classList.add('leaflet-zoom-animated');
		}

		this.getPane().append(this._container);
		this._resizeContainer();
		this._onMoveEnd();
	}

	/** @param {LeafletMap} map */
	onRemove(map) {
		this._destroyContainer();
	}

	getEvents() {
		/** @type {MapListeners} */
		const events = {
			viewreset: this._reset,
			zoom: this._onZoom,
			moveend: this._onMoveEnd,
			resize: this._resizeContainer,
			zoomend: this._onZoomEnd,
			zoomanim: this._onAnimZoom
		};
		if (this.options.continuous) {
			events.move = this._onMoveEnd;
		}
		return events;
	}

	/** @param {ZoomAnimEvent} ev */
	_onAnimZoom(ev) {
		this._updateTransform(ev.center, ev.zoom);
	}

	_onZoom() {
		this._updateTransform(this._map.getCenter(), this._map.getZoom());
	}

	/**
	 * @param {LatLng} center
	 * @param {number} zoom
	 */
	_updateTransform(center, zoom) {
		const scale = this._map.getZoomScale(zoom, this._zoom),
		viewHalf = this._map.getSize().multiplyBy(0.5 + this.options.padding),
		currentCenterPoint = this._map.project(this._center, zoom),
		topLeftOffset = viewHalf.multiplyBy(-scale)._add(currentCenterPoint)
			._subtract(this._map._getNewPixelOrigin(center, zoom));

		// a scaled container is resampled anyway, and rounding where its corner lands would make its content away
		// from the corner jitter against the zoom motion (#3194)
		if (scale === 1) { this._map._snapLayerPoint(topLeftOffset); }

		setTransform(this._container, topLeftOffset, scale);
	}

	/** @param {LeafletEvent} [ev] */
	_onMoveEnd(ev) {
		// Update pixel bounds of renderer container (for positioning/sizing/clipping later)
		const p = this.options.padding,
		size = this._map.getSize(),
		min = this._map.containerPointToLayerPoint(size.multiplyBy(-p)).round();

		/** @type {Bounds} */
		this._bounds = new Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());

		/** @type {LatLng} */
		this._center = this._map.getCenter();
		/** @type {number} */
		this._zoom = this._map.getZoom();
		this._updateTransform(this._center, this._zoom);

		this._onSettled(ev);
	}

	_reset() {
		this._onSettled();
		this._updateTransform(this._center, this._zoom);
		this._onViewReset();
	}

	/**
	 * Must initialize the HTML element to use as blanket, and store it as `this._container`. The base
	 * implementation creates a blank `<div>`.
	 * @category Subclass interface
	 * @uninheritable
	 */
	_initContainer() {
		/** @type {HTMLElement | SVGElement} */
		this._container = create('div');
	}

	/**
	 * Must destroy the HTML element in `this._container` and free any other resources. The base implementation
	 * destroys the element and removes any event handlers attached to it.
	 * @category Subclass interface
	 * @uninheritable
	 */
	_destroyContainer() {
		off(this._container);
		this._container.remove();
		delete /** @type {any} */ (this)._container;
	}

	/**
	 * The base implementation resizes the container (based on the map's size and taking into account the
	 * padding), returning the new size in CSS pixels.
	 *
	 * Subclass implementations shall reset container parameters and data structures as needed.
	 * @category Subclass interface
	 * @uninheritable
	 */
	_resizeContainer() {
		const p = this.options.padding,
		size = this._map.getSize().multiplyBy(1 + p * 2).round();
		this._container.style.width = `${size.x}px`;
		this._container.style.height = `${size.y}px`;
		return size;
	}

	/**
	 * (Optional) Runs on the map's `zoomend` event.
	 * @category Subclass interface
	 * @uninheritable
	 */
	_onZoomEnd() {}

	/**
	 * (Optional) Runs on the map's `viewreset` event.
	 * @category Subclass interface
	 * @uninheritable
	 */
	_onViewReset() {}

	/**
	 * Runs whenever the map state settles after changing (at the end of pan/zoom animations, etc). This should
	 * trigger the bulk of any rendering logic.
	 *
	 * If the `continuous` option is set to `true`, then this also runs on any map state change (including
	 * *during* pan/zoom animations).
	 * @category Subclass interface
	 * @param {LeafletEvent} [ev]
	 * @uninheritable
	 */
	_onSettled(ev) {}
}

/** @import {LatLngExpression, LeafletEvent, RendererEventMap, RendererOptions} from '../../types.js' */
/** @import {Point} from '../../geometry/Point.js' */
/** @import {LeafletMap} from '../../map/Map.js' */

/**
 * @typedef {Object} RendererEvents
 * @property {LeafletEvent} update Fired when the renderer updates its bounds, center and zoom, for example when its
 * map has moved.
 */

/**
 * Base class for vector renderer implementations (`SVG`, `Canvas`). Handles the DOM container of the renderer,
 * its bounds, and its zoom animation.
 *
 * A `Renderer` works as an implicit layer group for all `Path`s - the renderer itself can be added or removed
 * to the map. All paths use a renderer, which can be implicit (the map will decide the type of renderer and
 * use it automatically) or explicit (using the [`renderer`](#path-renderer) option of the path).
 *
 * Do not use this class directly, use `SVG` and `Canvas` instead.
 *
 * The `continuous` option inherited from `BlanketOverlay` cannot be set to `true` (otherwise, renderers get out of
 * place during a pinch-zoom operation).
 * @constructorDescription Creates a renderer with the given options.
 * @template {RendererOptions} [O=RendererOptions]
 * @template {RendererEventMap} [E=RendererEventMap]
 * @extends {BlanketOverlay<O, E>}
 */
class Renderer extends BlanketOverlay {

	static initHooks = true;

	/** @param {NoInfer<Partial<O>>} [options] */
	constructor(options) {
		super(/** @type {Partial<O>} */ ({...options, continuous: false}));
		stamp(this);
		this._layers ??= {};
		this.callInitHooks();
	}

	/** @param {LeafletMap} map */
	onAdd(map) {
		this._setPathView();
		super.onAdd(map);
		this.on('update', this._updatePaths, this);
	}

	/** @param {LeafletMap} map */
	onRemove(map) {
		super.onRemove(map);
		this.off('update', this._updatePaths, this);
	}

	_onZoomEnd() {
		this._setPathView();
		for (const layer of Object.values(this._layers)) {
			layer._project();
		}
	}

	// Paths are projected with the zoom and pixel origin the renderer was last drawn at, which lag behind the map's
	// during zoom animation and pinch, so that paths changed or added meanwhile line up with the rest.
	_setPathView() {
		/** @type {number} */
		this._pathZoom = this._map.getZoom();
		/** @type {Point} */
		this._pathOrigin = this._map.getPixelOrigin();
	}

	/** @param {LatLngExpression} latlng */
	_latLngToLayerPoint(latlng) {
		return this._map.project(latlng, this._pathZoom)._subtract(this._pathOrigin);
	}

	_updatePaths() {
		for (const layer of Object.values(this._layers)) {
			layer._update();
		}
	}

	_onViewReset() {
		this._setPathView();
		for (const layer of Object.values(this._layers)) {
			layer._reset();
		}
	}

	_onSettled() {
		this._update();
	}

	// Subclasses are responsible of implementing `_update()`. It should fire
	// the 'update' event whenever appropriate (before/after rendering).
	_update() {}

}

/** @import {RendererEventMap, RendererOptions} from '../../types.js' */
/** @import {Point} from '../../geometry/Point.js' */
/** @import {CircleMarker} from './CircleMarker.js' */
/** @import {Path} from './Path.js' */
/** @import {Polyline} from './Polyline.js' */

/**
 * Allows vector layers to be displayed with [SVG](https://developer.mozilla.org/docs/Web/SVG). Inherits `Renderer`.
 * @constructorDescription Creates an SVG renderer with the given options.
 * @example
 * Use SVG by default for all paths in the map:
 *
 * ```js
 * const map = new LeafletMap('map', {
 * 	renderer: new SVG()
 * });
 * ```
 *
 * Use a SVG renderer with extra padding for specific vector geometries:
 *
 * ```js
 * const map = new LeafletMap('map');
 * const myRenderer = new SVG({ padding: 0.5 });
 * const line = new Polyline( coordinates, { renderer: myRenderer } );
 * const circle = new Circle( center, { renderer: myRenderer, radius: 100 } );
 * ```
 * @template {RendererOptions} [O=RendererOptions]
 * @template {RendererEventMap} [E=RendererEventMap]
 * @extends {Renderer<O, E>}
 */
class SVG extends Renderer {

	_initContainer() {
		this._container = SVG.create('svg');

		// makes it possible to click through svg root; we'll reset it back in individual paths
		this._container.setAttribute('pointer-events', 'none');

		/** @type {SVGElement} */
		this._rootGroup = SVG.create('g');
		this._container.append(this._rootGroup);
	}

	_destroyContainer() {
		super._destroyContainer();
		delete /** @type {any} */ (this)._rootGroup;
		delete this._svgSize;
	}

	_resizeContainer() {
		const size = super._resizeContainer();

		// set size of svg-container if changed
		if (!this._svgSize?.equals(size)) {
			/** @type {Point | undefined} */
			this._svgSize = size;
			this._container.setAttribute('width', `${size.x}`);
			this._container.setAttribute('height', `${size.y}`);
		}

		// Reset the <SVG>'s viewBox as per _update, but skip redrawing paths.
		// This keeps paths visually aligned when resizing.
		const b = this._bounds;
		if (b) {
			this._container.setAttribute('viewBox', [b.min.x, b.min.y, size.x, size.y].join(' '));
		}
		return size;
	}

	_update() {
		if (this._map._animatingZoom && this._bounds) { return; }

		const b = this._bounds,
		size = b.getSize();

		// movement: update container viewBox so that we don't have to change coordinates of individual layers
		this._container.setAttribute('viewBox', [b.min.x, b.min.y, size.x, size.y].join(' '));

		this.fire('update');
	}

	// methods below are called by vector layers implementations

	/** @param {Path} layer */
	_initPath(layer) {
		const path = layer._path = SVG.create('path');

		if (layer.options.className) {
			path.classList.add(...splitWords(layer.options.className));
		}

		if (layer.options.interactive) {
			path.classList.add('leaflet-interactive');
		}

		this._updateStyle(layer);
		this._layers[stamp(layer)] = layer;
	}

	/** @param {Path} layer */
	_addPath(layer) {
		if (!this._rootGroup) { this._initContainer(); }
		this._rootGroup.append(layer._path);
		layer.addInteractiveTarget(layer._path);
	}

	/** @param {Path} layer */
	_removePath(layer) {
		layer._path.remove();
		layer.removeInteractiveTarget(layer._path);
		delete this._layers[stamp(layer)];
	}

	/** @param {Path} layer */
	_updatePath(layer) {
		layer._project();
		layer._update();
	}

	/** @param {Path} layer */
	_updateStyle(layer) {
		const path = layer._path,
		options = layer.options;

		if (!path) { return; }

		if (options.stroke) {
			path.setAttribute('stroke', options.color);
			path.setAttribute('stroke-opacity', `${options.opacity}`);
			path.setAttribute('stroke-width', `${options.weight}`);
			path.setAttribute('stroke-linecap', options.lineCap);
			path.setAttribute('stroke-linejoin', options.lineJoin);

			if (options.dashArray) {
				path.setAttribute('stroke-dasharray', `${options.dashArray}`);
			} else {
				path.removeAttribute('stroke-dasharray');
			}

			if (options.dashOffset) {
				path.setAttribute('stroke-dashoffset', options.dashOffset);
			} else {
				path.removeAttribute('stroke-dashoffset');
			}
		} else {
			path.setAttribute('stroke', 'none');
		}

		if (options.fill) {
			path.setAttribute('fill', options.fillColor || options.color);
			path.setAttribute('fill-opacity', `${options.fillOpacity}`);
			path.setAttribute('fill-rule', options.fillRule || 'evenodd');
		} else {
			path.setAttribute('fill', 'none');
		}
	}

	/**
	 * @param {Polyline} layer
	 * @param {boolean} [closed]
	 */
	_updatePoly(layer, closed) {
		this._setPath(layer, SVG.pointsToPath(layer._parts, closed));
	}

	/** @param {CircleMarker} layer */
	_updateCircle(layer) {
		const p = layer._point,
		r = Math.max(Math.round(layer._pxRadius), 1),
		r2 = Math.max(Math.round(layer._pxRadiusY ?? r), 1),
		arc = `a${r},${r2} 0 1,0 `;

		// drawing a circle with two half-arcs
		const d = layer._empty() ? 'M0 0' :
			`M${num$2(p.x - r)},${num$2(p.y)
			}${arc}${r * 2},0 ${
				arc}${-r * 2},0 `;

		this._setPath(layer, d);
	}

	/**
	 * @param {Path} layer
	 * @param {string} path
	 */
	_setPath(layer, path) {
		layer._path.setAttribute('d', path);
	}

	// SVG does not have the concept of zIndex so we resort to changing the DOM order of elements
	/** @param {Path} layer */
	_bringToFront(layer) {
		toFront(layer._path);
	}

	/** @param {Path} layer */
	_bringToBack(layer) {
		toBack(layer._path);
	}

	/**
	 * Returns a instance of [SVGElement](https://developer.mozilla.org/docs/Web/API/SVGElement),
	 * corresponding to the class name passed. For example, using 'line' will return an instance
	 * of [SVGLineElement](https://developer.mozilla.org/docs/Web/API/SVGLineElement).
	 * @param {string} name
	 */
	static create(name) {
		return document.createElementNS('http://www.w3.org/2000/svg', name);
	}

	/**
	 * Generates a SVG path string for multiple rings, with each ring turning into "M..L..L.." instructions
	 * @param {Point[][]} rings
	 * @param {boolean} [closed]
	 */
	static pointsToPath(rings, closed) {
		const str = rings.flatMap(points => [
			...points.map((p, j) => `${(j ? 'L' : 'M') + num$2(p.x)} ${num$2(p.y)}`),
			// closes the ring for polygons
			closed ? 'z' : ''
		]).join('');

		// SVG complains about empty path strings
		return str || 'M0 0';
	}

}

// Formats a pixel coordinate with 0.1px precision. Built from integer parts because V8 stringifies small integers
// much faster than fractional numbers, and path strings with many vertices are rebuilt on every redraw.
/** @param {number} v */
function num$2(v) {
	const n = Math.round(v * 10),
	a = n < 0 ? -n : n,
	i = Math.floor(a / 10),
	d = a - i * 10;
	return (n < 0 ? '-' : '') + (d ? `${i}.${d}` : i);
}

/** @import {CanvasOptions, Defaults, InteractiveLayerEventMap, PathDefaults, PathOptions, RendererOptions} from '../../types.js' */
/** @import {LeafletMap} from '../../map/Map.js' */
/** @import {Renderer} from './Renderer.js' */

const defaultOptions$3 = {
	/** Whether to draw stroke along the path. Set it to `false` to disable borders on polygons or circles. */
	stroke: true,

	/** Stroke color */
	color: '#3388ff',

	/** Stroke width in pixels */
	weight: 3,

	/** Stroke opacity */
	opacity: 1,

	/**
	 * A string that defines [shape to be used at the
	 * end](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linecap) of the stroke.
	 * @type {'butt' | 'round' | 'square'}
	 */
	lineCap: 'round',

	/**
	 * A string that defines [shape to be used at the
	 * corners](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-linejoin) of the stroke.
	 * @type {'miter' | 'round' | 'bevel'}
	 */
	lineJoin: 'round',

	/**
	 * A string (or an array of numbers) that defines the stroke [dash
	 * pattern](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dasharray).
	 * @type {string | number[] | null}
	 */
	dashArray: null,

	/**
	 * A string that defines the [distance into the dash pattern to start the
	 * dash](https://developer.mozilla.org/docs/Web/SVG/Attribute/stroke-dashoffset).
	 * @type {string | null}
	 */
	dashOffset: null,

	/** Whether to fill the path with color. Set it to `false` to disable filling on polygons or circles. */
	fill: false,

	/**
	 * Fill color. Defaults to the value of the [`color`](#path-color) option.
	 * @type {string | null}
	 */
	fillColor: null,

	/** Fill opacity. */
	fillOpacity: 0.2,

	/**
	 * A string that defines [how the inside of a
	 * shape](https://developer.mozilla.org/docs/Web/SVG/Attribute/fill-rule) is determined.
	 * @type {'nonzero' | 'evenodd'}
	 */
	fillRule: 'evenodd',

	// Option inherited from "Interactive layer" abstract class
	interactive: true,

	/**
	 * When `true`, a pointer event on this path will trigger the same event on the map
	 * (unless [`DomEvent.stopPropagation`](#domevent-stoppropagation) is used).
	 */
	bubblingPointerEvents: true,

	/**
	 * Use this specific instance of `Renderer` for this path. If not set, the path uses the map's
	 * [renderer](#map-renderer) (`SVG` by default), or in a custom pane, a renderer of the same kind created
	 * for that pane. If set, it overrides the `pane` option.
	 * @type {Renderer | undefined}
	 */
	renderer: undefined
};

/** @typedef {typeof defaultOptions} PathDefaultsValues */

/**
 * An abstract class that contains options and methods shared between vector overlays (`Polyline`, `Polygon`,
 * `Rectangle`, `Circle`, `CircleMarker`). Do not use it directly. Extends `Layer`.
 * @template {PathOptions} [O=PathOptions]
 * @template {InteractiveLayerEventMap} [E=InteractiveLayerEventMap]
 * @extends {Layer<O & PathDefaults, E>}
 */
class Path extends Layer {

	/** @type {Defaults<PathOptions>} */
	static defaultOptions = defaultOptions$3;

	/** @param {LeafletMap} map */
	beforeAdd(map) {
		// Renderer is set here because we need to call renderer.getEvents
		// before this.getEvents.
		/** @type {Renderer} */
		this._renderer = map.getRenderer(this);
	}

	/** @param {LeafletMap} map */
	onAdd(map) {
		this._renderer._initPath(this);
		this._reset();
		this._renderer._addPath(this);
	}

	/** @param {LeafletMap} map */
	onRemove(map) {
		this._renderer._removePath(this);
	}

	/** Redraws the layer. Sometimes useful after you changed the coordinates that the path uses. */
	redraw() {
		if (this._map) {
			this._renderer._updatePath(this);
		}
		return this;
	}

	/**
	 * Changes the appearance of a Path based on the options in the `Path options` object. Note that
	 * [`className`](#path-classname) is an exception: it is applied only when the path element is created,
	 * so passing it here updates the option but leaves the element's class unchanged.
	 * @param {Partial<O>} style
	 */
	setStyle(style) {
		setOptions(this, style);
		if (this._renderer) {
			this._renderer._updateStyle(this);
			if (style && (Object.hasOwn(style, 'weight') || Object.hasOwn(style, 'stroke'))) {
				this._updateBounds();
			}
		}
		return this;
	}

	/** Brings the layer to the top of all path layers. */
	bringToFront() {
		this._renderer?._bringToFront(this);
		return this;
	}

	/** Brings the layer to the bottom of all path layers. */
	bringToBack() {
		this._renderer?._bringToBack(this);
		return this;
	}

	/**
	 * Returns the SVG element of the path, or `undefined` when it's drawn on a `Canvas`.
	 * @returns {SVGElement | undefined}
	 */
	getElement() {
		return this._path;
	}

	/**
	 * @param {Partial<RendererOptions>} [options]
	 * @returns {Renderer}
	 */
	_createRenderer(options) {
		return new SVG(options);
	}

	// popups open where the path was clicked, so another click moves them
	_togglesPopupOnClick() {
		return false;
	}

	_reset() {
		// defined in child classes
		this._project();
		this._update();
	}

	_clickTolerance() {
		// used when doing hit detection for Canvas layers
		return (this.options.stroke ? this.options.weight / 2 || 0 : 0) +
		  (/** @type {Partial<CanvasOptions>} */ (this._renderer.options).tolerance || 0);
	}
}

/** @import {Feature, Geometry, LineString, MultiLineString} from 'geojson' */
/** @import {Defaults, InteractiveLayerEventMap, LatLngExpression, NestedCoords, PolylineDefaults, PolylineOptions} from '../../types.js' */

const defaultOptions$2 = {
	/**
	 * How much to simplify the polyline on each zoom level (Douglas–Peucker epsilon, in pixels). Higher values
	 * mean faster rendering but less accuracy; lower values mean more accuracy but slower rendering.
	 */
	smoothFactor: 0.5,

	/** Disable polyline clipping. */
	noClip: false
};

/** @typedef {typeof defaultOptions} PolylineDefaultsValues */

/**
 * A class for drawing polyline overlays on a map. Extends `Path`.
 * @example
 * ```js
 * // create a red polyline from an array of LatLng points
 * const latlngs = [
 * 	[45.51, -122.68],
 * 	[37.77, -122.43],
 * 	[34.04, -118.2]
 * ];
 *
 * const polyline = new Polyline(latlngs, {color: 'red'}).addTo(map);
 *
 * // zoom the map to the polyline
 * map.fitBounds(polyline.getBounds());
 * ```
 *
 * You can also pass a multi-dimensional array to represent a `MultiPolyline` shape:
 *
 * ```js
 * // create a red polyline from an array of arrays of LatLng points
 * const latlngs = [
 * 	[[45.51, -122.68],
 * 	 [37.77, -122.43],
 * 	 [34.04, -118.2]],
 * 	[[40.78, -73.91],
 * 	 [41.83, -87.62],
 * 	 [32.76, -96.72]]
 * ];
 * ```
 * @template {PolylineOptions} [O=PolylineOptions]
 * @template {InteractiveLayerEventMap} [E=InteractiveLayerEventMap]
 * @template {Geometry} [G=LineString | MultiLineString] the geometry `toGeoJSON` returns
 * @extends {Path<O & PolylineDefaults, E>}
 */
class Polyline extends Path {

	static initHooks = true;

	/** @type {Defaults<PolylineOptions>} */
	static defaultOptions = defaultOptions$2;

	/**
	 * Instantiates a polyline object given an array of geographical points and optionally an options object. You
	 * can create a `Polyline` object with multiple separate lines (`MultiPolyline`) by passing an array of arrays
	 * of geographic points.
	 * @param {NestedCoords<LatLngExpression>} latlngs
	 * @param {NoInfer<Partial<O>>} [options]
	 */
	constructor(latlngs, options) {
		super();

		setOptions(this, options);
		this._setLatLngs(latlngs);

		this.callInitHooks();
	}

	/**
	 * Returns an array of the points in the path, or nested arrays of points in case of multi-polyline.
	 * @returns {NestedCoords<LatLng>}
	 */
	getLatLngs() {
		return this._latlngs;
	}

	/**
	 * Replaces all the points in the polyline with the given array of geographical points.
	 * @param {NestedCoords<LatLngExpression>} latlngs
	 */
	setLatLngs(latlngs) {
		this._setLatLngs(latlngs);
		return this.redraw();
	}

	/** Returns `true` if the Polyline has no LatLngs. */
	isEmpty() {
		return !this._latlngs.length;
	}

	/**
	 * Returns the point closest to `p` on the Polyline, with its `distance` to `p`, or `null` when the polyline
	 * has no points on the screen.
	 * @param {Point} p
	 */
	closestLayerPoint(p) {
		p = new Point(p);
		let minDistance = Infinity,
		/** @type {Point | null} */
		minPoint = null,
		p1, p2;
		const closest = _sqClosestPointOnSegment,
		closed = this._isClosed();

		for (const points of this._parts) {
			for (let i = closed ? 0 : 1, len = points.length; i < len; i++) {
				p1 = points[(i || len) - 1];
				p2 = points[i];

				const sqDist = closest(p, p1, p2, true);

				if (sqDist < minDistance) {
					minDistance = sqDist;
					minPoint = closest(p, p1, p2);
				}
			}
		}
		return minPoint && Object.assign(minPoint, {distance: Math.sqrt(minDistance)});
	}

	/** Returns the center ([centroid](https://en.wikipedia.org/wiki/Centroid)) of the polyline. */
	getCenter() {
		// throws error when not yet added to map as this center calculation requires projected coordinates
		if (!this._map) {
			throw new Error('Must add layer to map before using getCenter()');
		}
		return polylineCenter(this._defaultShape(), this._map.options.crs);
	}

	/** Returns the `LatLngBounds` of the path. */
	getBounds() {
		return this._bounds;
	}

	/**
	 * Adds a given point to the polyline. By default, adds to the first ring of the polyline
	 * in case of a multi-polyline, but can be overridden by passing a specific ring as a LatLng
	 * array (that you can earlier access with [`getLatLngs`](#polyline-getlatlngs)).
	 * @param {LatLngExpression} latlng
	 * @param {LatLng[]} [latlngs]
	 */
	addLatLng(latlng, latlngs) {
		latlngs ??= this._defaultShape();
		latlng = new LatLng(latlng);
		latlngs.push(/** @type {LatLng} */ (latlng));
		this._bounds.extend(latlng);
		return this.redraw();
	}

	/**
	 * Coordinates values are rounded with [`formatNum`](#util-formatnum) function with given
	 * `precision`. Returns a [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) representation
	 * of the polyline (as a GeoJSON `LineString` or `MultiLineString` Feature).
	 * @param {number | false} [precision]
	 * @returns {Feature<G>}
	 */
	toGeoJSON(precision) {
		const multi = !isFlat(this._latlngs);

		const coords = latLngsToCoords(this._latlngs, 0, false, precision);

		return getFeature(this, /** @type {G} */ ({
			type: `${multi ? 'Multi' : ''}LineString`,
			coordinates: coords
		}));
	}

	/** @param {NestedCoords<LatLngExpression>} latlngs */
	_setLatLngs(latlngs) {
		/** @type {LatLngBounds} */
		this._bounds = new LatLngBounds();
		/** @type {NestedCoords<LatLng>} */
		this._latlngs = this._convertLatLngs(latlngs);
	}

	/** @returns {LatLng[]} */

	_defaultShape() {
		return isFlat(this._latlngs) ? this._latlngs : /** @type {LatLng[]} */ (this._latlngs[0]);
	}

	// recursively convert latlngs input into actual LatLng instances; calculate bounds along the way
	/**
	 * @param {NestedCoords<LatLngExpression>} latlngs
	 * @returns {NestedCoords<LatLng>}
	 */
	_convertLatLngs(latlngs) {
		if (!isFlat(latlngs)) {
			return /** @type {NestedCoords<LatLng>} */ (latlngs.map(ring => this._convertLatLngs(ring)));
		}
		const result = [];
		for (let i = 0, len = latlngs.length; i < len; i++) {
			result[i] = new LatLng(latlngs[i]);
			this._bounds.extend(result[i]);
		}
		return result;
	}

	_project() {
		const pxBounds = new Bounds();
		/** @type {Point[][]} */
		this._rings = [];
		this._projectLatlngs(this._latlngs, this._rings, pxBounds);

		if (this._bounds.isValid() && pxBounds.isValid()) {
			/** @type {Bounds | undefined} */
			this._rawPxBounds = pxBounds;
			this._updateBounds();
		}
	}

	_updateBounds() {
		const w = this._clickTolerance(),
		p = new Point(w, w);

		if (!this._rawPxBounds) {
			return;
		}

		this._pxBounds = new Bounds([
			this._rawPxBounds.min.subtract(p),
			this._rawPxBounds.max.add(p)
		]);
	}

	// recursively turns latlngs into a set of rings with projected coordinates
	/**
	 * @param {NestedCoords<LatLng>} latlngs
	 * @param {Point[][]} result
	 * @param {Bounds} projectedBounds
	 */
	_projectLatlngs(latlngs, result, projectedBounds) {
		if (isFlat(latlngs)) {
			const ring = latlngs.map(latlng => this._renderer._latLngToLayerPoint(latlng));
			ring.forEach(r => projectedBounds.extend(r));
			result.push(ring);
		} else {
			latlngs.forEach(latlng => this._projectLatlngs(latlng, result, projectedBounds));
		}
	}

	// clip polyline by renderer bounds so that we have less to render for performance
	_clipPoints() {
		const bounds = this._renderer._bounds;

		/** @type {Point[][]} */
		this._parts = [];
		if (!this._pxBounds?.intersects(bounds)) {
			return;
		}

		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		const parts = this._parts;
		let k = 0;

		for (const points of this._rings) {
			for (let j = 0, len = points.length; j < len - 1; j++) {
				const segment = clipSegment(points[j], points[j + 1], bounds, !!j);

				if (!segment) { continue; }

				parts[k] ??= [];
				parts[k].push(segment[0]);

				// if segment goes out of screen, or it's the last one, it's the end of the line part
				if ((segment[1] !== points[j + 1]) || (j === len - 2)) {
					parts[k].push(segment[1]);
					k++;
				}
			}
		}
	}

	// simplify each clipped part of the polyline for performance
	_simplifyPoints() {
		const parts = this._parts,
		tolerance = this.options.smoothFactor;

		for (let i = 0, len = parts.length; i < len; i++) {
			parts[i] = simplify(parts[i], tolerance);
		}
	}

	_update() {
		if (!this._map) { return; }

		this._clipPoints();
		this._simplifyPoints();
		this._updatePath();
	}

	_updatePath() {
		this._renderer._updatePoly(this);
	}

	// polygon rings also have a segment from the last point back to the first
	_isClosed() {
		return false;
	}

	// Needed by the `Canvas` renderer for interactivity
	/**
	 * @param {Point} p
	 * @param {boolean} [closed]
	 */
	_containsPoint(p, closed) {
		const w = this._clickTolerance();

		if (!this._pxBounds?.contains(p)) { return false; }

		// hit detection for polylines
		for (const part of this._parts) {
			for (let j = closed ? 0 : 1, len = part.length; j < len; j++) {
				if (pointToSegmentDistance(p, part[(j || len) - 1], part[j]) <= w) {
					return true;
				}
			}
		}
		return false;
	}
}

/** @import {Feature, MultiPolygon, Polygon as GeoJSONPolygon} from 'geojson' */
/** @import {LatLng} from '../../geo/LatLng.js' */
/** @import {Defaults, InteractiveLayerEventMap, LatLngExpression, NestedCoords, PolylineOptions} from '../../types.js' */

/** @satisfies {Defaults<PolylineOptions>} */
const defaultOptions$1 = {
	fill: true
};

/**
 * A class for drawing polygon overlays on a map. Extends `Polyline`.
 *
 * Note that points you pass when creating a polygon shouldn't have an additional
 * last point equal to the first one — it's better to filter out such points.
 * @constructorDescription Instantiates a polygon given an array of geographical points (or arrays of rings, as
 * shown below) and optionally an options object.
 * @example
 * ```js
 * // create a red polygon from an array of LatLng points
 * const latlngs = [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]];
 *
 * const polygon = new Polygon(latlngs, {color: 'red'}).addTo(map);
 *
 * // zoom the map to the polygon
 * map.fitBounds(polygon.getBounds());
 * ```
 *
 * You can also pass an array of arrays of latlngs, with the first array representing the outer shape and the other arrays representing holes in the outer shape:
 *
 * ```js
 * const latlngs = [
 *   [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
 *   [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
 * ];
 * ```
 *
 * Additionally, you can pass a multi-dimensional array to represent a MultiPolygon shape.
 *
 * ```js
 * const latlngs = [
 *   [ // first polygon
 *     [[37, -109.05],[41, -109.03],[41, -102.05],[37, -102.04]], // outer ring
 *     [[37.29, -108.58],[40.71, -108.58],[40.71, -102.50],[37.29, -102.50]] // hole
 *   ],
 *   [ // second polygon
 *     [[41, -111.03],[45, -111.04],[45, -104.05],[41, -104.05]]
 *   ]
 * ];
 * ```
 * @template {PolylineOptions} [O=PolylineOptions]
 * @template {InteractiveLayerEventMap} [E=InteractiveLayerEventMap]
 * @extends {Polyline<O, E, GeoJSONPolygon | MultiPolygon>}
 */
class Polygon extends Polyline {

	/** @type {Defaults<PolylineOptions>} */
	static defaultOptions = defaultOptions$1;

	isEmpty() {
		return !this._latlngs.length || !this._latlngs[0].length;
	}

	/** Returns the center ([centroid](http://en.wikipedia.org/wiki/Centroid)) of the Polygon. */
	getCenter() {
		// throws error when not yet added to map as this center calculation requires projected coordinates
		if (!this._map) {
			throw new Error('Must add layer to map before using getCenter()');
		}
		return polygonCenter(this._defaultShape(), this._map.options.crs);
	}

	/**
	 * Coordinates values are rounded with [`formatNum`](#util-formatnum) function with given
	 * `precision`. Returns a [`GeoJSON`](https://en.wikipedia.org/wiki/GeoJSON) representation
	 * of the polygon (as a GeoJSON `Polygon` or `MultiPolygon` Feature).
	 * @param {number | false} [precision]
	 * @returns {Feature<GeoJSONPolygon | MultiPolygon>}
	 */
	toGeoJSON(precision) {
		const holes = !isFlat(this._latlngs),
		multi = holes && !isFlat(this._latlngs[0]),
		coords = latLngsToCoords(this._latlngs, 0, true, precision);

		return getFeature(this, /** @type {GeoJSONPolygon | MultiPolygon} */ ({
			type: `${multi ? 'Multi' : ''}Polygon`,
			coordinates: holes ? coords : [coords]
		}));
	}

	/** @param {NestedCoords<LatLngExpression>} latlngs */
	_convertLatLngs(latlngs) {
		const result = super._convertLatLngs(latlngs),
		len = result.length;

		// remove last point if it equals first one
		if (len >= 2 && isFlat(result) && result[0].equals(result[len - 1])) {
			result.pop();
		}
		return result;
	}

	/** @param {NestedCoords<LatLngExpression>} latlngs */
	_setLatLngs(latlngs) {
		super._setLatLngs(latlngs);
		if (isFlat(this._latlngs)) {
			/** @type {LatLng[][] | LatLng[][][]} */
			this._latlngs = [this._latlngs];
		}
	}

	_defaultShape() {
		return isFlat(this._latlngs[0]) ? this._latlngs[0] : this._latlngs[0][0];
	}

	_clipPoints() {
		// polygons need a different clipping algorithm so we redefine that

		let bounds = this._renderer._bounds;
		const w = +this.options.weight || 0,
		p = new Point(w, w);

		// increase clip padding by stroke width to avoid stroke on clip edges
		bounds = new Bounds(bounds.min.subtract(p), bounds.max.add(p));

		this._parts = [];
		if (!this._pxBounds?.intersects(bounds)) {
			return;
		}

		if (this.options.noClip) {
			this._parts = this._rings;
			return;
		}

		for (const ring of this._rings) {
			const clipped = clipPolygon(ring, bounds);
			if (clipped.length) {
				this._parts.push(clipped);
			}
		}
	}

	_updatePath() {
		this._renderer._updatePoly(this, true);
	}

	_isClosed() {
		return true;
	}

	// Needed by the `Canvas` renderer for interactivity
	/** @param {Point} p */
	_containsPoint(p) {
		let inside = false;

		if (!this._pxBounds?.contains(p)) { return false; }

		// ray casting algorithm for detecting if point is in polygon
		for (const part of this._parts) {
			for (let j = 0, len = part.length, k = len - 1; j < len; k = j++) {
				const p1 = part[j],
				p2 = part[k];

				if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
					inside = !inside;
				}
			}
		}

		// also check if it's on polygon stroke
		return inside || super._containsPoint(p, true);
	}

}

/** @import {Feature, GeoJSON as GeoJSONData, Geometry, Point as GeoJSONPoint, Position} from 'geojson' */
/** @import {FeatureGroupEventMap, GeoJSONOptions, NestedCoords, PathOptions} from '../types.js' */
/** @import {Layer} from './Layer.js' */
/** @import {MemberLayer} from './LayerGroup.js' */

// GeoJSON keeps each created layer's own options there, for `resetStyle`; plugins like leaflet-realtime set it on
// layers they create themselves before calling `resetStyle`, so it stays a plain property
/** @typedef {Layer & {defaultOptions: object}} StyledLayer */

/**
 * A function returning the `Path` options for a GeoJSON feature.
 * @typedef {(feature: Feature<Geometry, any>) => Partial<PathOptions>} StyleFunction
 */

/**
 * @typedef {Object} GeoJSONEventProps
 * @property {Layer} layer The layer for the GeoJSON feature that is being added to the map.
 * @property {{[name: string]: any} | null} properties GeoJSON properties of the feature.
 * @property {string} geometryType GeoJSON geometry type of the feature.
 * @property {string | number} [id] GeoJSON ID of the feature (if present).
 */

/**
 * Represents a GeoJSON object or an array of GeoJSON objects. Allows you to
 * parse GeoJSON data and display it on the map. Extends `FeatureGroup`.
 * @example
 * ```js
 * new GeoJSON(data, {
 * 	style: function (feature) {
 * 		return {color: feature.properties.color};
 * 	}
 * }).bindPopup(function (layer) {
 * 	return layer.feature.properties.description;
 * }).addTo(map);
 * ```
 * @categoryDescription Methods
 * There are several static functions which can be called without instantiating GeoJSON:
 * @template {GeoJSONOptions} [O=GeoJSONOptions]
 * @template {FeatureGroupEventMap} [E=FeatureGroupEventMap]
 * @extends {FeatureGroup<Layer, O, E>}
 */
class GeoJSON extends FeatureGroup {

	static initHooks = true;

	/**
	 * Creates a GeoJSON layer. Optionally accepts an object in [GeoJSON format](https://tools.ietf.org/html/rfc7946)
	 * to display on the map (you can alternatively add it later with `addData` method) and an `options` object.
	 * @param {GeoJSONData | GeoJSONData[] | null} [geojson]
	 * @param {NoInfer<Partial<O>>} [options]
	 */
	constructor(geojson, options) {
		super(undefined, options);

		if (geojson) {
			this.addData(geojson);
		}

		this.callInitHooks();
	}

	/**
	 * Adds a GeoJSON object to the layer.
	 * @param {GeoJSONData | GeoJSONData[]} geojson
	 */
	addData(geojson) {
		if (Array.isArray(geojson) || 'features' in geojson) {
			for (const data of Array.isArray(geojson) ? geojson : geojson.features) {
				this.addData(data);
			}
			return this;
		}

		const options = this.options;
		const feature = GeoJSON.asFeature(geojson);

		if (!feature.geometry || (options.filter && !options.filter(feature))) { return this; }

		const layer = GeoJSON.geometryToLayer(feature, options);
		if (!layer) {
			return this;
		}
		layer.feature = feature;

		/** @type {StyledLayer} */ (layer).defaultOptions = layer.options;
		this.resetStyle(layer);

		if (options.onEachFeature) {
			options.onEachFeature(feature, layer);
		}

		return this.addLayer(layer);
	}

	/**
	 * Adds the given layer to the group.
	 * @param {Layer} layer
	 */
	addLayer(layer) {
		// a layer that wasn't created by `addData` keeps the options it has now, for `resetStyle`
		const styled = /** @type {StyledLayer} */ (layer);
		if (!styled.defaultOptions) {
			styled.defaultOptions = layer.options;
			layer.options = Object.create(layer.options);
		}
		return super.addLayer(layer);
	}

	/**
	 * Resets the given vector layer's style to the original GeoJSON style, useful for resetting style after
	 * hover events. If `layer` is omitted, the style of all features in the current layer is reset.
	 * @param {Layer} [layer]
	 */
	resetStyle(layer) {
		if (layer === undefined) {
			return this.eachLayer(this.resetStyle, this);
		}
		// reset any custom styles
		layer.options = Object.create(/** @type {StyledLayer} */ (layer).defaultOptions);
		this._setLayerStyle(layer, this.options.style);
		return this;
	}

	/**
	 * Changes styles of GeoJSON vector layers with the given style function.
	 * @param {Partial<PathOptions> | StyleFunction} style
	 */
	setStyle(style) {
		return this.eachLayer(layer => this._setLayerStyle(layer, style));
	}

	/**
	 * @param {MemberLayer} layer
	 * @param {Partial<PathOptions> | StyleFunction} [style]
	 */
	_setLayerStyle(layer, style) {
		if (layer.setStyle) {
			if (typeof style === 'function') {
				style = style(/** @type {Feature} */ (layer.feature));
			}
			layer.setStyle(style);
		}
	}

	/**
	 * Creates a `Layer` from a given GeoJSON feature. Can use a custom [`pointToLayer`](#geojson-pointtolayer)
	 * and/or [`coordsToLatLng`](#geojson-coordstolatlng) functions if provided as options. Returns `null` for a
	 * feature without a geometry.
	 * @param {GeoJSONData} geojson
	 * @param {Partial<GeoJSONOptions>} [options]
	 * @returns {Layer | null}
	 */
	static geometryToLayer(geojson, options) {

		const geometry = geojson.type === 'Feature' ? geojson.geometry : geojson,
		coords = /** @type {any} */ (geometry)?.coordinates,
		/** @type {Layer[]} */
		layers = [],
		pointToLayer = options?.pointToLayer,
		_coordsToLatLng = options?.coordsToLatLng ?? GeoJSON.coordsToLatLng;
		let latlng, latlngs;

		if (!geometry) {
			return null;
		}

		switch (geometry.type) {
		case 'Point':
			latlng = _coordsToLatLng(coords);
			return GeoJSON._pointToLayer(pointToLayer, geojson, latlng, options);

		case 'MultiPoint':
			for (const coord of coords) {
				latlng = _coordsToLatLng(coord);
				layers.push(GeoJSON._pointToLayer(pointToLayer, geojson, latlng, options));
			}
			return new FeatureGroup(layers);

		case 'LineString':
		case 'MultiLineString':
			latlngs = GeoJSON.coordsToLatLngs(coords, geometry.type === 'LineString' ? 0 : 1, _coordsToLatLng);
			return new Polyline(latlngs, options);

		case 'Polygon':
		case 'MultiPolygon':
			latlngs = GeoJSON.coordsToLatLngs(coords, geometry.type === 'Polygon' ? 1 : 2, _coordsToLatLng);
			return new Polygon(latlngs, options);

		case 'GeometryCollection':
			for (const g of geometry.geometries) {
				const geoLayer = GeoJSON.geometryToLayer({
					geometry: g,
					type: 'Feature',
					properties: /** @type {Feature} */ (geojson).properties
				}, options);

				if (geoLayer) {
					// so toGeoJSON exports MultiPoint and GeometryCollection members with their own type
					geoLayer.feature = GeoJSON.asFeature(g);
					layers.push(geoLayer);
				}
			}
			return new FeatureGroup(layers);

		case 'FeatureCollection':
			for (const f of geometry.features) {
				const featureLayer = GeoJSON.geometryToLayer(f, options);

				if (featureLayer) {
					layers.push(featureLayer);
				}
			}
			return new FeatureGroup(layers);

		default:
			throw new Error('Invalid GeoJSON object.');
		}
	}

	/**
	 * @param {GeoJSONOptions['pointToLayer']} pointToLayerFn
	 * @param {GeoJSONData} geojson
	 * @param {LatLng} latlng
	 * @param {Partial<GeoJSONOptions>} [options]
	 * @returns {Layer}
	 */
	static _pointToLayer(pointToLayerFn, geojson, latlng, options) {
		return pointToLayerFn ?
			pointToLayerFn(/** @type {Feature<GeoJSONPoint>} */ (geojson), latlng) :
			new Marker(latlng, /** @type {any} */ (options?.markersInheritOptions && options));
	}

	/**
	 * Creates a `LatLng` object from an array of 2 numbers (longitude, latitude)
	 * or 3 numbers (longitude, latitude, altitude) used in GeoJSON for points.
	 * @param {Position} coords
	 */
	static coordsToLatLng(coords) {
		return new LatLng(coords[1], coords[0], coords[2]);
	}

	/**
	 * Creates a multidimensional array of `LatLng`s from a GeoJSON coordinates array. `levelsDeep` specifies
	 * the nesting level (0 is for an array of points, 1 for an array of arrays of points, etc., 0 by
	 * default). Can use a custom [`coordsToLatLng`](#geojson-coordstolatlng) function.
	 * @param {NestedCoords<Position>} coords
	 * @param {number} [levelsDeep]
	 * @param {(coords: Position) => LatLng} [coordsToLatLng]
	 * @returns {NestedCoords<LatLng>}
	 */
	static coordsToLatLngs(coords, levelsDeep, coordsToLatLng) {
		// typed by hand since the depth comes from `levelsDeep`: recursing on `LineUtil.isFlat` like `latLngsToCoords`
		// does types itself but runs 2x slower on large multipolygons, as V8 inlines the split `map`s worse
		return /** @type {NestedCoords<LatLng>} */ (coords.map((/** @type {any} */ coord) => (levelsDeep ?
			GeoJSON.coordsToLatLngs(coord, levelsDeep - 1, coordsToLatLng) :
			(coordsToLatLng || GeoJSON.coordsToLatLng)(coord))));
	}

	/**
	 * Reverse of [`coordsToLatLng`](#geojson-coordstolatlng) Coordinates
	 * values are rounded with [`formatNum`](#util-formatnum) function.
	 */
	static latLngToCoords = latLngToCoords;

	/**
	 * Reverse of [`coordsToLatLngs`](#geojson-coordstolatlngs), with the nesting detected from the array, so
	 * `levelsDeep` is ignored. `close` determines whether the first point should be appended to the end of each
	 * flat array to close the feature. False by default. Coordinates values are rounded with
	 * [`formatNum`](#util-formatnum) function.
	 */
	static latLngsToCoords = latLngsToCoords;

	/** Returns GeoJSON geometries/features of layer with new GeoJSON geometry. */
	static getFeature = getFeature;

	/** Normalize GeoJSON geometries/features into GeoJSON features. */
	static asFeature = asFeature;

}

/** @import {Defaults, DivIconDefaults, DivIconOptions, IconOptions, PointExpression} from '../../types.js' */

/** @satisfies {Defaults<IconOptions>} */
const defaultOptions = {
	iconSize: [12, 12], // also can be set through CSS

	/**
	 * Custom HTML code to put inside the div element, empty by default. Alternatively, an instance of `HTMLElement`.
	 * @type {string | HTMLElement | false}
	 */
	html: false,

	/**
	 * Optional relative position of the background, in pixels.
	 * @type {PointExpression | null}
	 */
	bgPos: null,

	className: 'leaflet-div-icon'
};

/** @typedef {typeof defaultOptions} DivIconDefaultsValues */

/**
 * Represents a lightweight icon for markers that uses a simple `<div>` element instead
 * of an image. Inherits from `Icon` but ignores the `iconUrl` and shadow options.
 * @example
 * ```js
 * const myIcon = new DivIcon({className: 'my-div-icon'});
 * // you can set .my-div-icon styles in CSS
 *
 * new Marker([50.505, 30.57], {icon: myIcon}).addTo(map);
 * ```
 *
 * By default, it has a 'leaflet-div-icon' CSS class and is styled as a little white square with a shadow.
 * @template {DivIconOptions} [O=DivIconOptions]
 * @extends {Icon<O & DivIconDefaults>}
 */
class DivIcon extends Icon {

	/** @type {Defaults<DivIconOptions>} */
	static defaultOptions = defaultOptions;

	/** @param {HTMLElement | null} [oldIcon] */
	createIcon(oldIcon) {
		const div = oldIcon instanceof HTMLDivElement ? oldIcon : document.createElement('div'),
		options = this.options;

		if (options.html instanceof Element) {
			div.replaceChildren(options.html);
		} else {
			div.innerHTML = options.html !== false ? options.html : '';
		}

		const bgPos = options.bgPos && new Point(options.bgPos);
		div.style.backgroundPosition = bgPos ? `${-bgPos.x}px ${-bgPos.y}px` : '';
		this._setIconStyles(div, 'icon');

		return div;
	}

	createShadow() {
		return null;
	}
}

/**
 * The Leaflet version in use.
 * @example
 * ```js
 * import {version} from 'leaflet';
 *
 * console.log(version); // "2.0.0", or whatever version is in use
 * ```
 */
const version$1 = '2.0.0-beta.5';

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


var LeafletisV1 = version$1.startsWith('1.');

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
        color: (LeafletisV1 ? Path.prototype.options.color : Path.defaultOptions.color),
        weight: (LeafletisV1 ? Path.prototype.options.weight : Path.defaultOptions.weight),
        radius: 8
    }
};

class DataClassification extends GeoJSON {
    static defaultOptions = plugin_defaultOptions;

    constructor(data, options) {
        super(data, options);
        setOptions(this, options);
        
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
            color: (value != null ? (options.style.color != null ? options.style.color : (LeafletisV1 ? Path.prototype.options.color : Path.defaultOptions.color)) : options.noDataColor)
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
                    this._hatchclasses.push(undefined([{ color: options.strokeColors[0], width: swMax }, { color: options.strokeColors[1], width: swMin }], null, angle));
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
                    this._hatchclasses.push(undefined([{ color: options.strokeColors[0], width: swMax }, { color: options.strokeColors[1], width: swMin }], null, (altAng != 0 ? angle+altAng*i : angle)));
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
                    this._hatchclasses.push(undefined([{ color: options.strokeColors[0], width: swMax }, { color: options.strokeColors[1], width: swMin }], null, (altAng != 0 ? angle+altAng*i : angle)));
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
            var div = create('div', 'info legend');

            var nodatafound = this._noDataFound;
            var nodatacolor = this._noDataColor;
            var nodataignore = this._noDataIgnore;
            var nodatarow;

            // legend title:
            if (title != null && title != '') {
                var titlediv = create('div', 'legendtitle');
                titlediv.innerHTML += title;
                div.appendChild(titlediv);
            }

            // legenditems container (symbology)
            var container = create('div', 'symbology');
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
                            nodatarow = create('div', 'legendDataRow');
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
                            nodatarow = create('div', 'legendDataRow');
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
                            nodatarow = create('div', 'legendDataRow');
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
                            nodatarow = create('div', 'legendDataRow');
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
                            nodatarow = create('div', 'legendDataRow');
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
                            nodatarow = create('div', 'legendDataRow');
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
                var footerdiv = create('div', 'legendfooter');
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
        var lc = (this._linecolor != null ? this._linecolor : (LeafletisV1 ? Path.prototype.options.color : Path.defaultOptions.color));
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
                        this._lineweight = (LeafletisV1 ? Path.prototype.options.weight : Path.defaultOptions.weight);     // fallback to Leaflet default
                    }
                } else {
                    this._linecolor = (LeafletisV1 ? Path.prototype.options.color : Path.defaultOptions.color);           // fallback to Leaflet default
                    this._lineweight = (LeafletisV1 ? Path.prototype.options.weight : Path.defaultOptions.weight);         // fallback to Leaflet default
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

                        const svgIcon = new DivIcon({
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
                            mpfeatures[property].setIcon(new DivIcon({
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
class LegendControl extends Control {
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
	DataClassification.prototype.options = Object.create(GeoJSON.prototype.options);
}
DataClassification.mergeOptions(plugin_defaultOptions);

export { DataClassification };
