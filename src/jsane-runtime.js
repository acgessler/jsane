(function(exports, undefined){
"use strict";

//// IMPLEMENTATION ///////////////////////////////////////////////////////

var warn = function(idx, where) {
	console.log('WARN!');
};

var error = function(idx, where) {
	console.log('ERROR!');
};

//// EXPORTS //////////////////////////////////////////////////////////////

exports.info = function() {
	return 'jsane-runtime library, v0.1';
};

exports.chkArith = function(value, a, b, op, where) {
	// If either of the operands is not, probe the result of the
	// arithmetic expression.
	//
	// If it is NULL-LIKE, it is likely to cause havoc later. If it
	// is not NULL-LIKE, a potential issue has been silently swallowed.
	if (!isFinite(a) || !isFinite(b)) {
		if (!isFinite(value)) {
			warn(1, where);
		}
		else {
			warn(2, where);
		}
	}

	return value;
}

// Boilerplate to enable use in the browser outside node.js
})(typeof exports === 'undefined' ? this['__rt'] = {} : exports);
