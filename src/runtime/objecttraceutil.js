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
	//
	// clearObjectHooks() reverts all such changes but still requires caution.
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

		var hasOwnPropertyProxy = function(name) {
			if (name === trace_id_prop_name) {
				return false;
			}
			return old_hasOwnProperty.call(this, name);
		};

		var getOwnPropertyNamesProxy = function(o) {
			var names = old_getOwnPropertyNames.call(this, o);
			var idx = names.indexOf(trace_id_prop_name);
			if( idx !== -1) {
				names.splice(idx, 1);
			}
			return names;
		};

		Object.prototype.hasOwnProperty = hasOwnPropertyProxy;
		Object.getOwnPropertyNames = getOwnPropertyNamesProxy;

		// Patch up toString() to make them appear as native functions.
		// Note there is still infinite ways to detect the patching,
		// for example toString.toString() now has the same problem and
		// toString() no longer resolves up the prototype chain.
		hasOwnPropertyProxy.toString = function() { return 'function hasOwnProperty() { [native code] }'; };
		getOwnPropertyNamesProxy.toString = function() { return 'function getOwnPropertyNames() { [native code] }'; };

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

	var clearObjectHooks = function() {
		Object.getOwnPropertyNames = old_getOwnPropertyNames;
		Object.prototype.hasOwnProperty = old_hasOwnProperty;
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
		setupObjectHooks : setupObjectHooks,
		clearObjectHooks : clearObjectHooks,
	}
})();