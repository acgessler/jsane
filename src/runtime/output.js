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
