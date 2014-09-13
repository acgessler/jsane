/** 
Jsane - Javascript Sanity Instrumentation Toolkit
See top level LICENSE or github.com/acgessler/jsane

Runtime library which is needed to run jsane-instrumented
code. By default, it is prepended to or require()'d by the
instrumented code.

Code in here must work in a browser and should not have
external dependencies unless absolutely necessary.
*/

//

(function(exports, undefined){
"use strict";


//// OUTPUT/LOG ///////////////////////////////////////////////////////////

/////////////////////
// Verbosity/severity level. Each check has a configurable
// severity associated with it.

// Disable a check
var LV_IGN = -1;
// Warn (i.e. print message)
var LV_WRN = 0;
// Error (i.e. print message, then throw Error)
var LV_ERR = 1;

/////////////////////
// Categories of checks. If a check triggers, the category
// should be a broad hint to the user as to what the
// underlying issue (if not a false negative) could be.

// Possible bug that occured earlier 
var CAT_BUG_EARLIER = 0;
// Possible bug right *here*
var CAT_BUG_SOURCE = 1;
// An earlier bug may possibly be hidden here
var CAT_BUG_HIDDEN = 2;

var category_texts = new Array(3);
category_texts[CAT_BUG_EARLIER] = "This hints at a bug caused earlier.";
category_texts[CAT_BUG_SOURCE] = "This may be a bug.";
category_texts[CAT_BUG_HIDDEN] = "This may be inadvertly hiding a bug.";

/////////////////////
// Data for all possible checks_cfg. Each entry is a
// [severity, description_template] tuple.
var checks_cfg = [

	// 0 - Index of the check. Do never change.
	[LV_WRN, 
		// Message head. This is what always appears in the output
		"An arithmetic expression of type '{3}' produced a non-" +
			"numeric or non-finite result",
		// Message details. This may not be shown depending on output settings
		"Expression: '{1} {3} {2} => {0}'",
		// Category, i.e. "What could this hint at?"
		CAT_BUG_EARLIER
	],

	// 1
	[LV_WRN, 
		"An arithmetic expression of type '{3}' on non-numeric " +
			"or non-finite operands produced a finite result.",
		"Expression: '{1} {3} {2} => {0}'",
		CAT_BUG_HIDDEN
	],

	// 2
	[LV_ERR, 
		"Attempted to call a non-callable expression",
		"Function Expression: '{3}  is {0}'",
		CAT_BUG_EARLIER
	],

	// 3
	[LV_WRN, 
		"Adding arrays causes their string representations to be conatenated",
		"Left array: '{1}, right array: {2}'",
		CAT_BUG_SOURCE
	],

	// 4
	[LV_WRN, 
		"String concatenation involes an object operand without a proper string conversion",
		"Expression: '{1} {3} {2} => {0}'",
		CAT_BUG_SOURCE
	],

	// 5
	[LV_WRN, 
		"Operand of arithmetic expression is a string that gets auto-parsed as number",
		"Expression: '{1} {3} {2} => {0}'",
		CAT_BUG_EARLIER
	],

	// 6
	[LV_WRN, 
		"Function called with too many arguments",
		"Expected {0} arguments but received {1}. Function: {2}",
		CAT_BUG_SOURCE
	],
];

// Prefix for all messages produced by JSane
var message_prefix = "Jsane ";


var defaultPrintFunc = function(message) {
	(message[0] == 'E' ? console.error : console.log)(message_prefix + message);
};

var print_func = defaultPrintFunc;


// Trigger runtime check No |idx|. Action taken depends on
// global configuration in |checks_cfg|.
var check = function(idx, format_arguments) {
	var data = checks_cfg[idx]
	,	severity = data[0]
	,	message  = data[1]
	,	detail   = data[2]
	,	category = data[3]
	;

	if (severity === LV_IGN) {
		return;
	}

	var	message_head     = format(message, format_arguments)
	,	message_detail   = format(detail, format_arguments)
	,	message_category = category_texts[category]
	;


	var full_message = format("{0}{1}: {2}\n\t{3}\n\tCategory: {4}\n", [
		severity === LV_ERR ? 'E' : 'W',
		idx,
		message_head,
		message_detail,
		message_category
	]);

	print_func(full_message);

	// TODO: add trace (could be in a group when running in a browser)

	if (severity === LV_ERR) {
		throw new Error("jsane ERROR: " + message);
	}
};

//// TRACING //////////////////////////////////////////////////////////////

var trace_stack = [];
var trace_stack_top = {};

var shouldTrace = function(a) {
	return !isFiniteNumber(a) && !isObject(a);
};

// Get an unique ID that remains associated with an object
// for its entire lifetime.
var getObjectTraceId = (function() {
	var trace_id_source = 0;
	// Objects store their trace ID in this property,
	// which is marked as non-enumerable.
	var trace_id_prop_name = '___jsane_trace_id';

	// Update Object prototype to hide the trace property
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties

	// Changes are required for:
	//  - 'in'. Instrumentation replaces the operator by a
	//     call to |exports.chkIn|, which acts as a proxy.
	//     TODO
	//  - Object.hasOwnProperty()

	var old_hasOwnProperty = Object.prototype.hasOwnProperty;
	Object.prototype.hasOwnProperty = function(name) {
		if (name === trace_id_prop_name) {
			return false;
		}

		return old_hasOwnProperty.call(this, name);
	} ;

	var old_getOwnPropertyNames = Object.prototype.getOwnPropertyNames;
	Object.prototype.getOwnPropertyNames = function() {
		var names = old_getOwnPropertyNames.call(this);
		var idx = names.indexOf(trace_id_prop_name);
		return idx === -1 ? names : names.splice(idx, 1);
	} ;

	// Since the trace property is non-enumerable, no change is
	// required for:
	//
	//  - 'for .. in' loops (which would otherwise require special
	//        patch code to skip the property.)
	//  - Object.keys()
	//  - Object.hasEnumerableProperty()	

	return function(obj) {
		// Do nothing if the input is already a numeric trace ID
		if (isNumber(obj)) {
			return obj;
		}
		var trace_id = obj[trace_id_prop_name];
		// Create and assign a new trace ID to the object if either
		//   i)  The corresponding property does not exist
		//   ii) The property is inherited from the prototype chain.
		//       This happens if users make manual assignments to
		//       prototypes. This causes prototype objects to be
		//       assigned trace IDs. Since Object.hasOwnProperty()
		//       is patched and pretends the property holding the
		//       trace ID does not exist, the original function
		//       is used to detect this case.
		if (typeof trace_id === 'undefined' || !old_hasOwnProperty.call(obj, trace_id_prop_name)) {
			var trace_id = trace_id_source++;
			// 
			Object.defineProperty(obj, trace_id_prop_name, {
				value: trace_id,
				// Make non-enumerable
				enumerable: false,

				// The property is exclusively managed by this code
				// and neither written nor configured again.
				configurable: false,
				writable: false
			});
		}
		return trace_id;
	};
})();

var traceLocal = function(a) {
	// TODO
};

var traceGlobal = function(a) {
	// TODO
};

//// UTIL /////////////////////////////////////////////////////////////////

// Several classes of special types to distinguish
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

//// EXPORTS //////////////////////////////////////////////////////////////

exports.info = function() {
	return 'jsane-runtime library, v0.1';
};

/** Set/reset custom printing function
    of type |function(message)|
 */
exports.setPrintFunc = function(f) {
	print_func = (f === undefined ? defaultPrintFunc : f);
};

/** Checks on |a| |op| |b| having resulted in |value| */
exports.chkArith = function(value, a, b, op, where) {
	if (op === '+') {
		// See ECMA5.1 #11.6.1
		// If one of the operands is a string after applying the
		// ToPrimitive() abstract operation, string concatenation
		// is performed.


		// W4: If an operand is a string after ToPrimitive()
		// occurs, check if the operand was originally an
		// Object that lacks a "proper" toString() (which
		// is decided heuristically).
		//
		// This catches cases such as
		//   {} + 2  => "[object Object]2"
		//   {} + {} => "[object Object][object Object]"
		if ((isObject(a) && hasBadStringConversion(a)) ||
			(isObject(b) && hasBadStringConversion(b))) {
			check(4, arguments);
			return value;
		}

		// W3: If two arrays are added (with the intent to concatenate
		// them), ToPrimitive() makes them strings which are then
		// concatenated.
		if (isArray(a) && isArray(b)) {
			check(3, arguments);
			return value;
		}

		if (isString(value)) {
			return value;
		}
	}
	else {
		// For the other binary ops, the ToNumber() abstract operation
		// is applied first. See for example ECMA5.1 #11.6.2.

		// W5: If one operand is a string, it is parsed into a number
		// as per ECMA5.1 #9.3.1. This is oftentimes unexpected,
		// and asymmetric with addition:
		//    '3' + 2 => '32'
		//    '3' - 2 => 1
		if (isString(a) || isString(b)) {
			check(5, arguments);
			return value;
		}
	}


	// W0, W1: If either of the operands is not a finite number,
	// probe the result of the arithmetic expression.
	//
	// If it is not finite either, it is likely to cause havoc later.
	// If it is ok, a potential issue has been silently swallowed.
	if (!isFiniteNumber(a) || !isFiniteNumber(b)) {
		if (!isFiniteNumber(value)) {
			check(0, arguments);
		}
		else {
			check(1, arguments);
		}
	}

	return value;
};

/** Checks on func(*args) where |func_expr| is the raw source
    expression that evaluated to |func| and |func_this|
    is the value of |this| to use. */
exports.chkCall = function(func, func_this, args, func_expr, where) {
	// E2: Attempt to call non-callable
	if (!func) {
		check(2, arguments);
	}

	// W6: Function called with too many arguments
	if (args.length > func.length) {
		// Check if the JS |arguments| array is potentially used
		// anywhere in the called function's source code, if so
		// do not emit the warning.
		// 
		// This is a hacky heuristic:
		// If found, the arguments array could refer to another,
		// local function's arguments (false negative).
		//
		// Furthermore, eval() is another way of accessing the
		// |arguments| array (false positive).
		//
		var func_source_code = func.toString();
		if (!/\barguments\b/.test(func_source_code) &&
			!/\beval\b/.test(func_source_code)) {

			check(6, [func.length, args.length, func_source_code.length > 200
				? func_source_code.substring(0, 200)
				: func_source_code]);
		}
	}

	var result = func.apply(func_this, args);

	// 
	return result;
};

/**  Trace assignment from RHS to LHS.
     Source and destination are identified by a (scope_id, id)
     tuple which must be one of the following combos:

    i)   Object, String
         Assignment to object property

	ii)  null, String
	     Assignment to/from local variable

	iii) null, Number
	     Assignment to argument #n of a function being called
 
     Assign is tied closely with function call instrumentation to
     handle data traces across function invocations correctly.
 */
exports.assign = function(rhs, lhs_scope_id, lhs_id, rhs_scope_id, rhs_id) {
	// Record trace if either
	//	i)  the value of the RHS qualifies
	//	ii) the LHS is a function argument (needed by the function
	//      begin/end instrumentation to determine which arguments
	//      got omitted and which ones did not)
	//
	// Record trace to
	//  i)  global if LHS is an object
	//  ii) local if LHS is a local variable or a called function's arg
	if (shouldTrace(rhs) || (lhs_scope_id === null && isNumber(lhs_id))) {
		if (rhs_scope_id !== null && !isString(rhs_scope_id)) {
			rhs_scope_id = getObjectTraceId(rhs_scope_id);
		}
		if (lhs_scope_id !== null && !isString(lhs_scope_id)) {
			lhs_scope_id = getObjectTraceId(lhs_scope_id);
		}

		var trace_rhs = [rhs, rhs_scope_id, rhs_id];

		if (lhs_scope_id === null) {
			traceLocal(lhs_id, trace_rhs);
		}
		else {
			traceGlobal(lhs_scope_id, lhs_id, trace_rhs);
		}
	}
	return rhs;
};

/** Enter an instrumented function.
    
    |argument_names| is an array containing the names of all
    named arguments that the function takes.
 */
exports.enterFunc = function(argument_names) {
	// TODO: determine if caller is instrumented first.

	// Steps to ensure correct tracing for arguments:
	//  - Look at trace entries for arguments (in the
	//    local trace of the calling function).
	//  - Identify arguments in the current function
	//    that were omitted or were passed a value
	//    that qualifies for tracing. This requires
	//    that the call site emits trace info for all
	//    (not just the null/undefined etc) arguments.
	//    [The |arguments| array can not be used instead as
	//    it would interfere with W6/chkCall.]
	//  - Generate trace entries for all such arguments,
	//    thus connecting the local argument variable
	//    to the argument value at the call site.
	// TODO
	var scope = {};
	trace_stack.push(scope);
	trace_stack_top = scope;
	return scope;
};

/** Leave an instrumented function */
exports.leaveFunc = function() {
	trace_stack.pop();
	// This may become |undefined| if the stack is empty
	trace_stack_top = trace_stack[trace_stack.length];
};

// Boilerplate to enable use in the browser outside node.js
})(typeof exports === 'undefined' ? this['__rt'] = {} : exports);
