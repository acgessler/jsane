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

//

(function(exports, undefined){
"use strict";

// Embed constants without leaking to outside
var constants = (function(exports) {
	// (evaluated by grunt-includes during build)
	include "../shared/constants.js"
	return exports
})({});


//// OUTPUT/LOG ///////////////////////////////////////////////////////////

// (evaluated by grunt-includes during build)
include "output.js"


//// TRACING //////////////////////////////////////////////////////////////

// shouldTrace()
// Check if the value |a| qualifies for tracing.
// Changing this to always return true would enable full data tracing
var shouldTrace = function(a) {
	return !isFiniteNumber(a) && !isObject(a);
};

// allocateTraceId()
// Allocate a a new tracing ID. Tracing IDs are unique and
// stay alive forever. Tracing IDs are used in JSane to
// uniquely identify assignments to or from
//   - Objects (the global object uses the predefined
//              GLOBAL_OBJECT_TRACE_ID tracing ID)
//   - Function invocations. Every function call is assigned
//     a tracing ID, but assignments within a function
//     scope are only permanently retained if the value
//     "escapes" the function invocation.
var allocateTraceId = function() {
	var trace_id_source = constants.GLOBAL_OBJECT_TRACE_ID + 1;

	return function() {
		return trace_id_source++;
	};
};

// (evaluated by grunt-includes during build)
include "objecttraceutil.js"
include "tracer.js"


//// UTIL /////////////////////////////////////////////////////////////////

// (evaluated by grunt-includes during build)
include "classify.js"


//// EXPORTS //////////////////////////////////////////////////////////////

exports.info = function() {
	return 'JSane runtime library, v0.1';
};


// Set/reset custom printing function
exports.setPrintFunc = function(f) {
	print_func = (f === undefined ? defaultPrintFunc : f);
};


// Checks on |a| |op| |b| having resulted in |value|.
// Parameter tail is used to supply both sides' tracing context.
exports.chkArith = function(value, a, b, op, where, a_scope_id, a_id, b_scope_id, b_id) {
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
		var scope_id = a_scope_id;
		var id = a_id;
		if (!isFiniteNumber(b)) {
			scope_id = b_scope_id;
			id = b_id;
		}

		if (!isFiniteNumber(value)) {
			check(0, arguments, scope_id, id);
		}
		else {
			check(1, arguments, scope_id, id);
		}
	}

	return value;
};


// Checks on func(*args) where |func_expr| is the raw source
//  expression that evaluated to |func| and |func_this|
//  is the value of |this| to use.
exports.chkCall = (function() {
	var fnToString = Function.prototype.toString;

	return function(func, func_this, args, func_expr, where) {
		// E2: Attempt to call non-callable
		if (!func) {
			check(2, arguments);
		}

		// W6: Function called with too many arguments
		if (args.length > func.length) {
			for (var i = func.length; i < args.length; ++i) {
				if (!isUndefined(args[i])) {
					break;
				}
			}
			if (i < args.length) {
				// Check if the JS |arguments| array is potentially used
				// anywhere in the called function's source code, if so
				// do not emit the warning.
				// 
				// This is a hacky heuristic:
				// If found, the arguments array could refer to another,
				// nested function's |arguments| (false negative).
				//
				// Furthermore, eval() is another way of accessing the
				// |arguments| array (false positive).
				//
				//
				// Special handling also for native functions, such as
				// |console.log|: these do not provide decompiled source
				// code using |toString|.
				var func_source_code = fnToString.call(func);
				if (!/\barguments\b/.test(func_source_code) &&
					!/\beval\b/.test(func_source_code) &&
					!isNativeFunction(func)) {

					check(6, [func.length, args.length, func_source_code.length > 200
						? func_source_code.substring(0, 200)
						: func_source_code]);
				}
			}
		}

		var result = func.apply(func_this, args);
		return result;
	};
})();


//  Trace assignment from RHS to LHS.
//   Source and destination are identified by a (scope_id, id)
//   tuple which must be one of the following combos:
//
//  i)   Object, String (Any)
//       Assignment to object property
//
//	ii)  null, String (Valid JS Identifier)
//	     Assignment to/from local variable
//
//	iii) null, Number
//	     Assignment to argument #n of a function being called
//
//  iv)  null, null
//       Assignment of a literal value. This begins a new
//       trace path for this value.
// 
//  Assign is tied closely with function call instrumentation to
//  handle data traces across function invocations correctly.
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
			rhs_scope_id = objectTraceUtil.getObjectTraceId(rhs_scope_id);
		}
		if (lhs_scope_id !== null && !isString(lhs_scope_id)) {
			lhs_scope_id = objectTraceUtil.getObjectTraceId(lhs_scope_id);
		}

		if (lhs_scope_id === null) {
			tracer.traceLocal(lhs_id, rhs, rhs_scope_id, rhs_id);
		}
		else {
			tracer.traceGlobal(lhs_scope_id, lhs_id, rhs, rhs_scope_id, rhs_id);
		}
	}
	return rhs;
};


// Enter an instrumented function.
//  
//  |argument_names| is an array containing the names of all
//  named arguments that the function takes.
exports.enterFunc = function(argument_names) {
	// If the caller is not instrumented, no local trace info is available.
	// TODO

	// Setup a new stack frame on the local trace stack
	var old_scope = tracer.getLocalTraceScope();
	if (old_scope) {
		var scope = tracer.pushLocalTraceScope();

		// This ensures proper tracing of values passed as argument
		// by connecting the caller with the callee trace records.
		tracer.connectArgumentTraces(scope, old_scope, argument_names);

		// Return the tracing ID to the function being instrumented,
		// where it is made available as a local variable for
		// nested scopes to access.
		return scope.function_call_id;
	}
};


// Leave an instrumented function
exports.leaveFunc = function() {
	tracer.popLocalTraceScope();
};


// Export proxy for |a in b| operator.
exports.proxyInOperator	= objectTraceUtil.proxyInOperator;


// Undo all changes made to global state, including any references to
// the runtime as direct fields of the global object. This renders
// the runtime unusable even if references to it are retained elsewhere.
//
// A new instance of the runtime can now be initialized safely.
//
// Note when using require() to load the runtime, it caches and only
// evaluates the runtime once. Thus calling require() again will not
// undo the effects of undo.
exports.undo = function() {
	objectTraceUtil.clearObjectHooks();

	// Global object independent of host environment
	// See http://stackoverflow.com/questions/9642491/
	var glob = (1,eval)('this');
	if (glob !== this) {
		for (var k in glob) {
			if (glob[k] === this) {
				delete glob[k];
			}
		}
	}
}


//// INITIALIZATION ////////////////////////////////////////////////////////

objectTraceUtil.setupObjectHooks();

// Boilerplate to enable direct use in the browser outside node.js, i.e.
// via a <script> tag (which also makes it easy to guarantee that
// the code only executes once and thus all tracing state is shared.)
// This is useful if instrumentation is configured to assume the
// runtime available and neither require()s nor embeds it.
//
// If the runtime text is instead embedded into the instrumented source
// code, it is provided a fake |export| and surrounded by guards that
// prevent double-initialization.
})(typeof exports === 'undefined' ? this['__rt'] = {} : exports);
