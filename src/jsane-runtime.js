(function(exports){
"use strict";

exports.info = function() {
	return 'jsane-runtime library, v0.1';
};

exports.chkArith = function(value, a, b, op) {
	return value;
}

// Boilerplate to enable use in the browser outside node.js
})(typeof exports === 'undefined' ? this['__rt'] = {} : exports);
