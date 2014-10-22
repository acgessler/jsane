/** 
JSane - Javascript Sanity Instrumentation Toolkit
See top level LICENSE or github.com/acgessler/jsane

Part of the runtime library which is needed to run instrumented
code. By default, it is prepended to or require()'d by the
instrumented code.

Code in here must work in both node and browser environments and
should not have external dependencies unless absolutely necessary.

Hence, all modularized parts of the runtime are flattened
using the `includes` grunt task during build (and not loaded via
AMD / node modules etc.|) The |main.js| file contains the skeleton
that includes all modules and exposes the public API to support
instrumentation.
*/

// Several classes of special types to distinguish
var isNil = function(a) {
	return a === null ||
		typeof a == 'undefined';
};

var isUndefined = function(a) {
	return typeof a == 'undefined';
};

var isBoolean = function(a) {
	return typeof a == 'boolean';
};

var isNumber = function(a) {
	return typeof a  == 'number';
};

var isArray = Array.isArray || function(arg) {
	return Object.prototype.toString.call(arg) === "[object Array]";
};

var isString = function(s) {
	return (typeof s == 'string' || s instanceof String);
};

var isObject = function(s) {
	return s !== null && typeof s === 'object';
}

var isFiniteNumber = function(a) {
	return isNumber(a) && isFinite(a);
};

var hasBadStringConversion = function(a) {
	// Check if toString() resolves to |Object.prototype|
	return a.toString === Object.prototype.toString;
};

// Poor-man's format. Substitutes {i} with args[i]
var format = function(spec, args) {
	for (var i = 0; i < args.length; ++i) {
		spec = spec.replace('{' + i + '}', args[i]);
	}
	return spec;
};

var isNativeFunction = (function() {
	// Source: https://gist.github.com/jdalton/5e34d890105aca44399f
	// Embedded to avoid dependency. May move this out and collate during build.
 
	// Used to resolve the internal `[[Class]]` of values.
	var toString = Object.prototype.toString;

	// Used to resolve the decompiled source of functions.
	var fnToString = Function.prototype.toString;

	// Used to detect host constructors (Safari > 4; really typed array specific).
	var reHostCtor = /^\[object .+?Constructor\]$/;

	// Compile a regexp using a common native method as a template.
	// We chose `Object#toString` because there's a good chance it is not being mucked with.
	var reNative = RegExp('^' +
		// Coerce `Object#toString` to a string.
		String(toString)
		// Escape any special regexp characters.
		.replace(/[.*+?^${}()|[\]\/\\]/g, '\\$&')
		// Replace mentions of `toString` with `.*?` to keep the template generic.
		// Replace thing like `for ...` to support environments, like Rhino, which add extra
		// info such as method arity.
		.replace(/toString|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
	);

	return function(value) {
		var type = typeof value;
		return type == 'function'
		// Use `Function#toString` to bypass the value's own `toString` method
		// and avoid being faked out.
		? reNative.test(fnToString.call(value))
		// Fallback to a host object check because some environments will represent
		// things like typed arrays as DOM methods which may not conform to the
		// normal native pattern.
		: (value && type == 'object' && reHostCtor.test(toString.call(value))) || false;
	};
})();