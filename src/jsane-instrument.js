/** 
Jsane - Javascript Sanity Instrumentation Toolkit
See top level LICENSE or github.com/acgessler/jsane

Main instrumentation library. Only executes in a node environment.
*/


(function(exports){
"use strict";

// Module imports
var	falafel = require('falafel')
,	format = require('util').format
,	sprintf = require('sprintf-js').sprintf
,	fs = require('fs')
,	_ = require('underscore')._
;

// Mixed constants
var	DEFAULT_RUNTIME_NAME = '__rt'
,	INDEX_NODE_MODULE = 'jsane'
,	RUNTIME_NODE_MODULE = 'compiled/jsane-runtime.min'
;



//// IMPLEMENTATION /////////////////////////////////////////////////////////

// Get the source code of the runtime library
var getRuntimeText = (function() {
	var cached_text = null;
	return function() {
		if (cached_text === null) {
			var file_name = './' + RUNTIME_NODE_MODULE + '.js';
			cached_text = fs.readFileSync(file_name, 
				{encoding : 'utf-8'});

			if (!cached_text) {
				throw new Error('Failed to read runtime library source from ' + file_name);
			}
		}
		return cached_text;
	};
})();

// Instrumentation logic
// Encapsulates instrumentation options and falafel usage.
var Context = function(options) {
	if (!(this instanceof Context)) {
		return new Context(options);
	}

	var self = this
	,	runtime_name = options.runtime_name || DEFAULT_RUNTIME_NAME
	,	runtime_linkage = options.runtime_linkage || exports.RUNTIME_REQUIRE
	;

	var falafel_opts = {
		// Want |raw| property on AST nodes containing verbatim source code
		raw : true,

		// Want location info in AST nodes
		loc : true,
	};

	/////////////////////////////
	this.instrument = function(text, file_name) {	
		var instrumented_text = falafel(text, falafel_opts, function(node) {

			if (node.type == 'BinaryExpression') {
				self.instrumentBinaryExpression(node, file_name);
			}
			else if (node.type == 'ExpressionStatement') {
				if (node.expression.type == 'CallExpression') {
					self.instrumentFunctionCall(node.expression, file_name);
				}
			}
		});

		// Link in runtime library
		if (runtime_linkage === exports.RUNTIME_NONE) {
			return instrumented_text;
		}
		else if (runtime_linkage === exports.RUNTIME_REQUIRE) {
			var runtime_name_binding = format('var %s = require(\'%s\').runtime;',
				runtime_name,
				(options.jsane_node_module || INDEX_NODE_MODULE) 
			);
			return runtime_name_binding + instrumented_text;
		}
		else if (runtime_linkage === exports.RUNTIME_EMBED) {
			// The runtime module populates |exports| because
			// it thinks that it runs as node module.
			var runtime_embedding = self.wrap(format('%s = {}; var exports = %s; %s',
				runtime_name,
				runtime_name,
				getRuntimeText()
			)); 
			return runtime_embedding + instrumented_text;
		}
		self.error("|options.runtime_linkage| must be one of the RUNTIME_XXX constants");
	};

	/////////////////////////////
	this.instrumentBinaryExpression = function(node, file_name) {
		var op = node.operator;
		if (op == '+' || op == '-' || op == '*' || op == '/' || op == '|' || op == '&') {
			var subs = {
				tmp0 : this.genUniqueName(),
				tmp1 : this.genUniqueName(),
				tmp2 : this.genUniqueName(),
				lhs : node.left.source(),
				rhs : node.right.source(),
				op : op,
				runtime_name : runtime_name,
				loc : file_name + ':' + node.loc.start.line
			};

			node.update(self.wrap(sprintf(
				'var %(tmp0)s = %(lhs)s, ' +
				'%(tmp1)s = %(rhs)s, ' +
				'%(tmp2)s = %(tmp0)s %(op)s %(tmp1)s; ' +
				'return %(runtime_name)s.chkArith(%(tmp2)s, %(tmp0)s, %(tmp1)s, ' +
					'\'%(op)s\', \'%(loc)s\');',
				subs)));
		}
	};


	/////////////////////////////
	this.instrumentFunctionCall = function(node, file_name) {
		// Callee.type can be at least: "Identifier", "MemberExpression", ?
		var callee = node.callee;

		var js_args_array = '[' + _.map(node.arguments, function(arg) {
			return arg.source();
		}).join(',') + ']';

		var subs = {
				tmp0 : this.genUniqueName(),
				tmp1 : this.genUniqueName(),
				callee : callee.source(),
				args : js_args_array,
				runtime_name : runtime_name,
				loc : file_name + ':' + node.loc.start.line
		};

		// Function calls are instrumented as
		//   jsane.chkCall(func, this, [args..], func_expr, where)
		//
		// To determine |this| we need to look at |func_expr|:
		//   - If function is called with a plain identifier
		//          a() 
		//     |this| is |undefined| or |window| depending on
		//     whether strict mode is set for |func| or not.
		//     
		//   - If function is called with a MemberExpression
		//         ....c.f()    
		//         ....c["f"]()
		//     it is |c| which determines |this|. Since in the second
		//     example the expression is computed (and "f" could be
		//     an arbitrary function), it can have side-effects and
		//     should be evaluated exactly once, which complicates
		//     things.
		if (callee.type == 'Identifier') {
			node.update(self.wrap(sprintf(
				'var %(tmp0)s = %(callee)s, ' +
				'%(tmp1)s = "%(callee)s"; ' +
				'return %(runtime_name)s.chkCall(%(tmp0)s, %(args)s, %(tmp1)s, \'%(loc)s\');',
			subs)));
		}
		else if (callee.type == 'MemberExpression') {
			// TODO
		}
		else {
			console.error('Callee.type not supported: ' + callee.type + '; skipping');
		}
	};

	
	/////////////////////////////
	this.error = function(text) {
		throw new Error(text);
	};


	/////////////////////////////
	this.genUniqueName = function() {
		// Get a real, unique name w.r.t to the current scope.
		// For now, a random id.
		return format('tmp_%d', Math.floor(Math.random() * 1000000000));
	};

	/////////////////////////////
	this.wrap = function(text) {
		return '(function() { ' + text + '})()';
	};
}


//// EXPORTS //////////////////////////////////////////////////////////////


/** The runtime library (jsane-runtime) is embedded into the
 *  instrumented source code.
 */
exports.RUNTIME_EMBED = 'embed';

/** require('jsane-runtime') is used to load the runtime library.
 */
exports.RUNTIME_REQUIRE = 'require';

/** The runtime library is not embedded, it must be available
 *  under the global name given by the |runtime_name|
 *  option. This can be used to cut space if other instrumented
 *  modules that embed the runtime library (|RUNTIME_EMBED|)
 *  load earlier.
 */
exports.RUNTIME_NONE = 'none';

/** 
  
  Instrument ES5 source code.

  The source code is augmented with jsane's runtime checks and traces
  as configured in |options|.

  Note that jsane state is global: if multiple node modules / individual
  JS scripts are instrumented separately, only one instance of the
  runtime library is used at runtime and tracing information spans
  all modules.

  |file_name| appears in error/warn messages.

  Available |options|.
     runtime_name: Safe global name to use for storing jsane state.
                Defaults to '__rt'
     runtime_linkage: Specifies how the runtime library (jsane-runtime)
        is linked to. Possible values are the RUNTIME_XXX constants
        |RUNTIME_EMBED|
        |RUNTIME_REQUIRE| (default)
        |RUNTIME_NONE|
	 jsane_node_module: Only if |runtime_linkage === RUNTIME_REQUIRE|;
	    specifies the name or path of the jsane module. The default
	    is 'jsane', this option is useful to use a local version.
*/
exports.instrumentCode = function(text, file_name, options) {
	var context = new Context(options || {});
	return context.instrument(text, file_name);
};

exports.DEFAULT_RUNTIME_NAME = DEFAULT_RUNTIME_NAME;


// Boilerplate to enable use in the browser outside node.js
})(typeof exports === 'undefined' ? this['jsane'] = {} : exports);
