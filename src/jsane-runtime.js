(function(exports, undefined){
"use strict";

//// IMPLEMENTATION ///////////////////////////////////////////////////////

var LV_IGN = -1;
var LV_WRN = 0;
var LV_ERR = 1;

// Data for all possible checks_cfg. Each entry is a
// [severity, description_template] tuple
var checks_cfg = [
	// 0
	[LV_WRN, "AAAA"],

	// 1
	[LV_WRN, "BBBB"],
];


// Trigger runtime check No |idx|. Action taken depends on
// global configuration in |checks_cfg|.
var check = function(idx, where) {
	var data = checks_cfg[idx]
	,	severity = data[0]
	,	message = data[1]
	;

	if (severity === LV_IGN) {
		return;
	}

	(severity === LV_ERR ? console.error : console.log)(message);

	// TODO: add trace (could be in a group when running in a browser)

	if (severity === LV_ERR) {
		throw new Error("jsane ERROR: " + message);
	}
};

// Classes of special types that need to be distinguished
var isNil = function(a) {
	return a === null ||
		typeof a == 'undefined';
};

var isBoolean = function(a) {
	return typeof a == 'boolean';
};

var isNumber = function(a) {
	return typeof a  == 'number';
};

var isFiniteNumber = function(a) {
	return isNumber(a) && isFinite(a);
};


//// EXPORTS //////////////////////////////////////////////////////////////

exports.info = function() {
	return 'jsane-runtime library, v0.1';
};

exports.chkArith = function(value, a, b, op, where) {
	// If either of the operands is not, probe the result of the
	// arithmetic expression.
	//
	// If it is f, it is likely to cause havoc later. If it
	// is not finite, a potential issue has been silently swallowed.
	if (!isFiniteNumber(a) || !isFiniteNumber(b)) {
		if (!isFiniteNumber(value)) {
			check(0, where);
		}
		else {
			check(1, where);
		}
	}

	return value;
}

// Boilerplate to enable use in the browser outside node.js
})(typeof exports === 'undefined' ? this['__rt'] = {} : exports);
