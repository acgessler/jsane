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
// Configuration for all supported runtime checks. Each entry is a
// [severity, description_template, details_template, category] tuple,
// see the first entry for an example.
var checks_cfg = [

	// 0 - Index of the check. Do never change.
	[LV_WRN, 
		// Message head. This is what always appears in the output
		"An arithmetic expression of type '{3}' produced a non-" +
			"numeric or non-finite result",
		// Message details. This may not be shown depending on output settings
		"Expression: '{1} {3} {2} => {0}'",
		// Category, i.e. "What could this hint at?"
		CAT_BUG_EARLIER,
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
var check = function(idx, format_arguments, cause_scope_id, cause_id) {
	var data = checks_cfg[idx]
	,	severity = data[0]
	,	message  = data[1]
	,	detail   = data[2]
	,	category = data[3]
	;

	// Return immediately if the check is set to be ignored.
	// It is important that no heavy format / trace work
	// happens before this check.
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

	if (!isUndefined(cause_scope_id) && !isUndefined(cause_id)) {
		full_message += '\nTrace+\n\t' + tracer.getTraceLines(cause_scope_id, cause_id).join('\n\t');
	}

	print_func(full_message);

	// TODO: add trace (could be in a group when running in a browser)

	if (severity === LV_ERR) {
		throw new Error("jsane ERROR: " + message);
	}
};

//// TRACING //////////////////////////////////////////////////////////////

// Static tracing ID used for the global object
// sync with src/instrument.js/GLOBAL_OBJECT_TRACE_ID
var GLOBAL_OBJECT_TRACE_ID = 1;

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
	var trace_id_source = GLOBAL_OBJECT_TRACE_ID + 1;

	return function() {
		return trace_id_source++;
	};
};


// objectTraceUtil.setupObjectHooks()
//   Patch Object.prototype to hide all necessary extra fields
//   due to tracing from the application logic. This must be
//   called once before any application logic executes.
//
// objectTraceUtil.getObjectTraceId(obj)
//   Create an unique tracing ID that remains associated with
//   the object |obj| for its entire lifetime. If the object
//   has already a tracing ID assigned, the existing ID is returned.
//
// objectTraceUtil.proxyInOperator(prop, obj)
//   Proxy to call instead of |prop in obj| statements.
var objectTraceUtil = (function() {
	// Objects store their trace ID in this property,
	// which is marked as non-enumerable.
	//
	// This needs to be kept in sync with test/testcase/test_property_iteration.js
	var trace_id_prop_name = '___jsane_trace_id';

	// Global object independent of host environment
	// See http://stackoverflow.com/questions/9642491/
	var glob = (1,eval)('this');

	// Since setupObjectHooks() modifies them, save the original
	// versions of Object methods that we need.
	//
	// Gotcha: this causes observable changes in behaviour
	// if application logic overrides these as well. Luckily,
	// JS style guides typically discourage patching Object,
	// Array etc.
	var old_hasOwnProperty = Object.prototype.hasOwnProperty;
	var old_getOwnPropertyNames = Object.getOwnPropertyNames;
	
	var setupObjectHooks = function() {
		// Update Object prototype to hide the trace property
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties

		// Changes are required for:
		//  - 'in'. Instrumentation replaces the operator by a
		//     call to |proxyInOperator|
		//     TODO
		//  - Object.hasOwnProperty()

		Object.prototype.hasOwnProperty = function(name) {
			if (name === trace_id_prop_name) {
				return false;
			}

			return old_hasOwnProperty.call(this, name);
		};

		Object.getOwnPropertyNames = function(o) {
			var names = old_getOwnPropertyNames.call(this, o);
			var idx = names.indexOf(trace_id_prop_name);
			if( idx !== -1) {
				names.splice(idx, 1);
			}
			return names;
		};

		// Since the trace property is non-enumerable, no change is
		// required for:
		//
		//  - 'for .. in' loops (which would otherwise require special
		//        patch code to be inserted into each loop to skip
		//        the property.)
		//  - Object.keys()
		//  - Object.hasEnumerableProperty()
		//  - Object.propertyIsEnumerable()
	};

	var proxyInOperator = function(name, obj) {
		if (name === trace_id_prop_name) {
			return false;
		}
		return name in obj;
	};

	var getObjectTraceId =  function(obj) {
		// Do nothing if the input is already a numeric trace ID
		if (isNumber(obj)) {
			return obj;
		}

		// Statically assign an ID for the global object
		if (obj === glob) {
			return GLOBAL_OBJECT_TRACE_ID;
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
			var trace_id = allocateTraceId();
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

	return {
		getObjectTraceId : getObjectTraceId,
		proxyInOperator : proxyInOperator,
		setupObjectHooks : setupObjectHooks
	}
})();


// tracer.traceGlobal(lhs_scope_id, lhs_id, rhs, rhs_scope_id, rhs_id)
//   Record a trace entry that is permanently retained.
//   |lhs_scope_id| must specify a valid tracing ID.
//
//   When tracing an assignment of a local value (i.e.
//   |rhs_scope_id| is null), the trace history of said local
//   value is retrieved from the local tracing stack and promoted
//   to global tracing to make sure it is retained.
//
// tracer.traceLocal(lhs_id, rhs, rhs_scope_id, rhs_id)
//   Record a trace entry that is local to the current function.
//   If no global trace entry makes use of the local value,
//   the tracing value will be discarded as the function
//   returns. Local tracing can not be used for variables
//   that leak into other scopes (i.e. closures).
var tracer = (function() {
	var traces = {};

	var local_trace_stack = [];
	var local_trace_stack_top = null;

	// Value side of a trace key-value pair in both local and global trace state
	var TraceItem = function(rhs, rhs_scope_id, rhs_id) {
		// TODO: use a more space-efficient representation,
		// possibly truncate/sanitize |rhs| if it is an object
		// and not a numeric/undefined/null/boolean value.
		// Note that this would only happen if |shouldTrace|
		// is changed accoringly.
		this.rhs = rhs;
		this.rhs_scope_id = rhs_scope_id;
		this.rhs_id = rhs_id;
	};

	// One frame on the |local_trace_stack|
	var LocalTraceStackFrame = function(function_call_id) {
		// local variable name OR argument index as string -> TraceItem
		this.entries = {}; 
		this.function_call_id = function_call_id;
	};

	var traceGlobal = function(lhs_scope_id, lhs_id, rhs, rhs_scope_id, rhs_id) {
		var trace_item = rhs instanceof TraceItem 
			? rhs
			: new TraceItem(rhs, rhs_scope_id, rhs_id);

		traces[lhs_scope_id + "." + lhs_id] = trace_item;

		if (rhs_scope_id === null) {
			// The RHS of the assignment is a local value. To preserve trace
			// history, this value and all the local values it was derived
			// from are now promoted to the global trace state.
			if (local_trace_stack_top) {
				var local_id = rhs_id;
				var history = [];
				var stack_frame_cursor = local_trace_stack.length - 1;
				while (stack_frame_cursor >= 0) {
					var source = lookupLocalTrace(local_id, stack_frame_cursor);
					if (isUndefined(source)) {
						// No further trace info available.
						break;
					}

					history.push([local_id, source]);

					// RHS of assignment is a global object? Great,
					// trace history is complete then.
					if (source.rhs_scope_id !== null) {
						break;
					}

					// If the RHS of the assignment is numeric, it is
					// an assignment to a function argument. This means
					// search continues in the stack frame below.
					if (isNumber(source.rhs_id)) {
						--stack_frame_cursor;
					}

					local_id = source.rhs_id;
				}

				if (history.length > 0) {
					var last_global_source = history[history.length - 1][1];
					for (var i = history.length - 1; i >= 0; --i) {
						var local_id = history[i][0];
						var rhs = history[i][1].rhs;

						// Generate a (func_scope_id, local_id) -> last_global_source trace entry
						var global_id = local_id;
						var global_scope_id = source.rhs_scope_id;

						trace_item = new TraceItem(rhs,
							last_global_source.rhs_scope_id,
							last_global_source.rhs_id);

						traceGlobal(global_scope_id, global_id, trace_item);
						last_global_source = trace_item;
					}
				}
			}
		}
	};

	var lookupLocalTrace = function(id, cursor) {
		cursor = isUndefined(cursor) ? local_trace_stack.length - 1 : cursor;
		return local_trace_stack[cursor].entries[id];
	};

	var traceLocal = function(lhs_id, trace_rhs, rhs, rhs_scope_id, rhs_id) {
		//local_trace_stack_top.entries[lhs_id] = new TraceItem(rhs, rhs_scope_id, rhs_id);
	};

	var getLocalTraceScope = function() {
		return local_trace_stack_top;
	};

	var pushLocalTraceScope = function() {
		local_trace_stack_top = new LocalTraceStackFrame(allocateTraceId());
		local_trace_stack.push(local_trace_stack_top);
		return local_trace_stack_top;
	};

	var popLocalTraceScope = function() {
		local_trace_stack.pop();
		// This may become |undefined| if the stack is empty
		local_trace_stack_top = local_trace_stack[local_trace_stack.length - 1];
	};

	var connectArgumentTraces = function(callee_trace_stack_frame, caller_trace_stack_frame, argument_names) {
		// Steps to ensure correct tracing for arguments.
		//
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
		var caller_locals = caller_trace_stack_frame.entries;
		var callee_locals = callee_trace_stack_frame.entries;
		var i = 0, e = argument_names.length;
		for (; i < e; ++i) {
			var arg_trace_entry = caller_locals[i];

			// No tracing entry for this argument index found. This
			// means there is no more arguments.
			if (!arg_trace_entry) {
				break;
			}

			if (shouldTrace(arg_trace_entry.rhs)) {
				callee_locals[argument_names[i]] = arg_trace_entry;
			}
		}

		for (; i < e; ++i) {
			callee_locals[argument_names[i]] = new TraceItem(undefined, null, null);
		}
	};

	var getTraceLines = function(scope_id, id) {
		return ['haha'];
	};

	return {
		traceGlobal : traceGlobal,
		traceLocal : traceLocal,
		pushLocalTraceScope : pushLocalTraceScope,
		popLocalTraceScope : popLocalTraceScope,
		getLocalTraceScope : getLocalTraceScope,
		connectArgumentTraces : connectArgumentTraces,
		getTraceLines : getTraceLines
	};
})();

//// UTIL /////////////////////////////////////////////////////////////////

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


//// INITIALIZATION ////////////////////////////////////////////////////////

objectTraceUtil.setupObjectHooks();

// Boilerplate to enable use in the browser outside node.js
})(typeof exports === 'undefined' ? this['__rt'] = {} : exports);
