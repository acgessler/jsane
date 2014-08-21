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

//// IMPLEMENTATION ///////////////////////////////////////////////////////

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
		"An arithmetic expression of type '{3}' produced a non-numeric or non-finite result",
		// Message details. This may not be shown depending on output settings
		"Expression: '{1} {3} {2} => {0}'",
		// Category, i.e. "What could this hint at?"
		CAT_BUG_EARLIER
	],

	// 1
	[LV_WRN, 
		"An arithmetic expression of type '{3}' on non-numeric or non-finite operands produced a finite result.",
		"Expression: '{1} {3} {2} => {0}'",
		CAT_BUG_HIDDEN
	],
];

// Poor-man's format. Substitute {i} with args[i]
var format = function(spec, args) {
	for (var i = 0; i < args.length; ++i) {
		spec = spec.replace('{' + i + '}', args[i]);
	}
	return spec;
};


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

	var message_head     = format(message, format_arguments)
	,	message_detail   = format(detail, format_arguments)
	,	message_category = category_texts[category]
	;


	var full_message = format("Jsane {0}{1}: {2}\n\t{3}\n\tCategory: {4}\n", [
		severity === LV_ERR ? 'E' : 'W',
		idx,
		message_head,
		message_detail,
		message_category
	]);

	(severity === LV_ERR ? console.error : console.log)(full_message);

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
			check(0, arguments);
		}
		else {
			check(1, arguments);
		}
	}

	return value;
}

// Boilerplate to enable use in the browser outside node.js
})(typeof exports === 'undefined' ? this['__rt'] = {} : exports);
