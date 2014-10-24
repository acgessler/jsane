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
		console.log('global trace: [' + lhs_scope_id + ',' + lhs_id + '] = ' + rhs + ' [ ' + rhs_scope_id + ',' + rhs_id +']');

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
						var global_scope_id = history[i][1].rhs_scope_id;

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

	var traceLocal = function(lhs_id, rhs, rhs_scope_id, rhs_id) {
		console.log('local trace: ' + lhs_id + ' = ' + rhs + ' [' + rhs_scope_id + ',' + rhs_id +']');
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