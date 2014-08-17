(function(exports){
"use strict";

var	falafel = require('falafel')
,	format = require('util').format
,	DEFAULT_SAFE_NAME = '__rt';


var wrapBinaryExpression = function(node) {
	var op = node.operator;
	if (op == '+' || op == '-' || op == '*' || op == '/' || op == '|' || op == '&') {
		// If either of the operands is NULL-LIKE, probe the result of the
		// arithmetic expression.
		//
		// If it is NULL-LIKE, it is likely to cause havoc later. If it
		// is not NULL-LIKE, a potential issue has been silently swallowed.
		node.update(format('%s.chkArith((%s), "%s")', node.source(), op));
	}
};


//// EXPORTS //////////////////////////////////////////////////////////////

/** 
  
  Instrument ES5 source code.

  The source code is augmented with esnull's runtime checks and traces
  as configured in |options|. By default a small runtime library to hold
  esnull's state is embedded into the source code. Note that esnull
  state is global: if multiple node modules / individual JS scripts
  are instrumented separately, this runtime library is only initialized
  once.

  Available |options|:
     safe_name: Safe global name to use for storing esnull state.
                Defaults to __esnull
     no_runtime: If truthy, no copy of the runtime is embedded
                into the instrumented code. Use this to save space
                if the runtime is already embedded by another module
                that loads earlier.
*/
exports.instrumentCode = function(text, options) {
	safe_name = safe_name || DEFAULT_SAFE_NAME;
	return falafel(text, function(node) {

		if (node.type == 'BinaryExpression') {
			wrapBinaryExpression(node);
		}
	});
};


// Boilerplate to enable use in the browser outside node.js
})(typeof exports === 'undefined' ? this['esnull'] = {} : exports);
