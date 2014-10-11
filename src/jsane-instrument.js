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
,	ast_util = require('./ast_util')
,	scoping_util = require('./scoping_util')
;

// Mixed constants
var	DEFAULT_RUNTIME_NAME = '__rt'
,	INDEX_NODE_MODULE = 'jsane'
,	RUNTIME_NODE_MODULE = 'compiled/jsane-runtime.min'
,	GLOBAL_OBJECT_TRACE_ID = 1
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
		var ignored_lines = this.findIgnoredLines(text);

		// First parse the text into an AST and do some initial
		// passes to tag all scopes and their variables, and to
		// resolve all variable references. This allows us to
		// generate instrumentation that handles closures properly.
		//
		// All results are stored directly in AST nodes.
		var ast = falafel(text, falafel_opts, function(node) {}).ast;
		this.collectVariablesPerFunctionScope(ast);
		this.resolveIdentifiers(ast);

		// Then pass the augmented AST to falafel and have it perform
		// a pre-traversal on it, applying instrumentation code
		// in-place, children before their parents.
		//
		// We use a patched version of falfel to enable re-use of ASTs.
		// This can change when https://github.com/substack/node-falafel/pull/27 is merged.
		var instrumented_text = falafel(ast, falafel_opts, function(node) {
			// Add explicit semicolon after statements - implicit breaks can
			// change behaviour with the current anonymous function-based
			// style of instrumenting the code.
			//
			//    var f = function() {}
			//    a = 2;
			//
			// potentially becomes
			//
			//    var f = function() {}
			//    (function() { .. a = 2 .. }())
			//
			// which accidentally invokes the first function.
			//
			// This *must* be done even for blocks that turn off
			// instrumentation.
			if (node.type === 'VariableDeclaration' || node.type === 'ExpressionStatement') {
				var source = node.source();
				if (!/;\s*$/.test(source)) {
					node.update(node.source() + ';');
				}
			}

			// Skip all nodes that touch ignored lines
			// AST line numbers are one-based
			var start = node.loc.start.line;
			var end = node.loc.end.line;

			for (var i = start - 1; i <= end; ++i) {
				if (ignored_lines[i]) {
					return;
				}
			}

			if (node.type === 'BinaryExpression') {
				self.instrumentBinaryExpression(node, file_name, text);
			}
			else if (node.type === 'CallExpression') {
				self.instrumentFunctionCall(node, file_name, text);
			}
			else if (node.type === 'AssignmentExpression') {
				self.instrumentAssignmentExpression(node, file_name, text);
			}
			else if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
				self.instrumentFunction(node, file_name, text);
			}
		}).toString();

		console.log(instrumented_text);

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
			)) + ';'; 
			return runtime_embedding + instrumented_text;
		}
		self.error("|options.runtime_linkage| must be one of the RUNTIME_XXX constants");
	};


	/////////////////////////////
	this.instrumentFunction = function(node, file_name) {
		// Each function expression/declaration must have a |scope|
		// member that has been populated in a previous pass through
		// the AST.
		var scope = node.scope;
		if (typeof scope === 'undefined') {
			this.error("Function lacks scope tagging");
			return;
		}

		// node.body.source() includes the curly braces,
		// node.body.body is the raw list of statement
		// nodes in the body of the function.
		//
		// Strict mode/asm.js directives must be preserved
		// as first statement in the function body.
		var prefix_string = '';
		var body_without_braces = _.map(node.body.body, 
			function(stmt, index) {
				if (index === 0) {
					if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'Literal') {
						var value = stmt.expression.value; 
						if (value === 'use strict' || value === 'use asm') {
							prefix_string = '\'' + value + '\';';
							return '';
						}
					}
				}
				return stmt.source();
			}
		).join(';');

		var arg_names_js = '[' + _.map(node.params,
			function(param) {
				return '\'' + param.name + '\'';
			}
		).join(',') + ']';

		var subs = {
			runtime_name : runtime_name,
			body : body_without_braces,
			arg_names_js : arg_names_js, 
			prefix_string : prefix_string,
			runtime_trace_id_variable_name : scope.runtime_trace_id_variable_name
		};

		node.body.update(sprintf(
			'{' +
				'%(prefix_string)s ' +
				'%(runtime_name)s.enterFunc(%(arg_names_js)s); ' +
				'%(body)s;' +
				'%(runtime_name)s.leaveFunc();' +
			'}',
			subs));
	};


	/////////////////////////////
	this.instrumentAssignmentExpression = function(node, file_name) {
		var op = node.operator;

		var subs = {
			lhs : node.left.source(),
			rhs : node.right.source(),
			runtime_name : runtime_name,
			loc : file_name + ':' + node.loc.start.line,
			prefix : '',
		};

		this.populateExpressionTraceStubs(node.left, subs, 'lhs_');
		this.populateExpressionTraceStubs(node.right, subs, 'rhs_');

		if (op != '=') {
			// Compound assignment operations |a @= b| are evaluated
			// as |a` = (a` @ b)| where a` is the reference obtained
			// by the evaluation of a.
			//
			// See ECMA5.1 #11.3.2
			subs.tmp0 = scoping_util.genUniqueName();
			subs.tmp1 = scoping_util.genUniqueName();
			subs.tmp2 = scoping_util.genUniqueName();
			subs.tmp3 = scoping_util.genUniqueName();
			subs.op = op[0];
			node.update(this.wrap(sprintf(
				'%(preamble)s' + 
				'var %(tmp0)s = %(lhs_val)s, ' +
				'%(tmp1)s = %(rhs_val)s, ' +
				'%(tmp2)s = %(tmp0)s %(op)s %(tmp1)s; ' +
				'%(tmp3)s = %(runtime_name)s.chkArith(%(tmp2)s, %(tmp0)s, %(tmp1)s, ' +
					'\'%(op)s\', \'%(loc)s\');' +
				'return %(lhs_val)s = %(runtime_name)s.assign(%(tmp3)s, ' +
					'%(lhs_scope_id)s, %(lhs_id)s, %(rhs_scope_id)s, %(rhs_id)s, \'%(loc)s\');',
				subs)));
			return;
		}

		node.update(this.wrap(sprintf(
			'%(preamble)s' + 
			'return %(lhs_val)s = %(runtime_name)s.assign(%(rhs_val)s, ' +
				'%(lhs_scope_id)s, %(lhs_id)s, %(rhs_scope_id)s, %(rhs_id)s, \'%(loc)s\');',
			subs)));
	};


	/////////////////////////////
	this.instrumentBinaryExpression = function(node, file_name) {
		var op = node.operator;
		if (op[1] == '=') { // Support compound assignment
			op = op[0];
		}
		if (op == '+' || op == '-' || op == '*' || op == '/' || op == '|' || op == '&') {
			var subs = {
				tmp0 : scoping_util.genUniqueName(),
				tmp1 : scoping_util.genUniqueName(),
				tmp2 : scoping_util.genUniqueName(),
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
	this.instrumentFunctionCall = function(node, file_name, original_text) {
		// Callee.type can be at least: "Identifier", "MemberExpression", ?
		var	callee = node.callee,
			self = this;

		// For each argument, generate asignment trace
		var js_args_array = '[' + _.map(node.arguments, function(arg, index) {
			var arg_subs = {
				index : index,
				runtime_name : runtime_name,
				loc : file_name + ':' + arg.loc.start.line
			};
			self.populateExpressionTraceStubs(arg, arg_subs, 'arg_');
			return self.wrap(sprintf(
				'%(preamble)s' + 
				'return %(runtime_name)s.assign(%(arg_val)s, ' +
					'null, %(index)s, %(arg_scope_id)s, %(arg_id)s, \'%(loc)s\');',
					arg_subs));
		}).join(',') + ']';

		var subs = {
				tmp0 : scoping_util.genUniqueName(),
				tmp1 : scoping_util.genUniqueName(),
				tmp2 : scoping_util.genUniqueName(),
				callee : callee.source(),
				original_callee : JSON.stringify(this.getOriginalSource(callee, original_text)),
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
		//     |this| is |undefined| or the global object depending on
		//     whether strict mode is set for |func| or not.
		//     Luckily, when using apply() to invoke,
		//     passing |undefined| yields the correct result
		//     (substituting global as needed).
		//     
		//   - If function is called with a MemberExpression
		//         ....c.f()    
		//         ....c["f"]()
		//     it is |c| which determines |this|. Since in the second
		//     example the expression is computed (and "f" could be
		//     an arbitrary function), it can have side-effects and
		//     should be evaluated exactly once, which complicates
		//     things.
		if (callee.type == 'Identifier' || callee.type == 'FunctionExpression') {
			node.update(self.wrap(sprintf(
				'var %(tmp0)s = %(callee)s, ' +
				'%(tmp1)s = %(original_callee)s; ' +
				'return %(runtime_name)s.chkCall(%(tmp0)s, undefined, %(args)s, %(tmp1)s, \'%(loc)s\');',
			subs)));
		}
		else if (callee.type == 'MemberExpression') {		
			subs.split_func = this.splitMemberExpression(callee);			

			node.update(self.wrap(sprintf(
				'var %(tmp0)s = %(split_func)s, ' +
				'    %(tmp2)s = %(original_callee)s; ' +
				'return %(runtime_name)s.chkCall(%(tmp0)s[0][%(tmp0)s[1]], %(tmp0)s[0], %(args)s, %(tmp2)s, \'%(loc)s\');',
			subs)));
		}
		else {
			console.error('Callee.type not supported: ' + callee.type + '; skipping');
		}
	};


	/////////////////////////////
	// Populate |subs| with code stubs to compute parameters necessary
	// for using runtime.assign() to trace data moves from or to
	// |node|. All keys produced are prefixed by |prefix|:
	//
	//   KEY            VALUE
	//   scope_id       Scope/object identifier
	//   id             Property/slot identifier
	//                  (scope_id, id) together forms the unique key
	//                   that JSane uses to generate data traces)
	//
	//   val            |node| evaluated
	//   preamble       (Appended to) Preamble code to put before any
	//                  use of the previous snippets.
	//
	this.populateExpressionTraceStubs = function(node, subs, prefix) {
		if (typeof subs.preamble === 'undefined') {
			subs.preamble = '';
		}
		if (node.type === 'MemberExpression') {
			var subs_private = {
				split_func : this.splitMemberExpression(node),
				tmp0 : scoping_util.genUniqueName()
			};
			
			subs.preamble += sprintf('var %(tmp0)s = %(split_func)s;', subs_private);
			subs[prefix + 'scope_id'] = sprintf('%(tmp0)s[0]', subs_private);
			subs[prefix + 'id'] = sprintf('%(tmp0)s[1]', subs_private);
			subs[prefix + 'val'] = sprintf('%(tmp0)s[0][%(tmp0)s[1]]', subs_private);
		}
		else if (node.type === 'Identifier') {
			// Resolve the identifier upwards in the AST.
			var scope_id_js = this.resolveIdentifierScope(node);
			if (scope_id_js === null) {
				// Not found. This means it is in fact a property
				// lookup (or setting of a property) on the
				// global object.
				scope_id_js = GLOBAL_OBJECT_TRACE_ID;
			}

			subs[prefix + 'scope_id']= scope_id_js;
			subs[prefix + 'id'] = '"' + node.name + '"';
			subs[prefix + 'val'] = node.name;
		}
		else {
			// Computed expression - need more to trace it.
			subs[prefix + 'scope_id'] = 'null';
			subs[prefix + 'id'] = 'null';
			subs[prefix + 'val'] = node.source();
		}
	};

	// JS scope
	var outer = this;
	



	/////////////////////////////
	// Traverse the given |ast| and assign each function node
	// a |Scope| instance stored in |node.scope|. The scope
	// instance collects all variables declared in that scope.
	this.collectVariablesPerFunctionScope = function(ast) {
		// Downwards search for all function scopes
		ast_util.postTraverse(ast, function(node) {
			if (node.type !== 'FunctionDeclaration' && node.type !== 'FunctionExpression') {
				return true;
			}

			// Search downward within the function. Looking for
			// top-level variable declarations only does not work,
			// for example "for (var i = 0;  ..)" will not be
			// top-level in the function AST node, but creates
			// a function-level variable (hoisting).
			var scope = new scoping_util.Scope();
			ast_util.postTraverse(node, function(subnode) {
				// TODO: function declarations
				if (subnode.type === 'VariableDeclarator') {
					scope.createVariable(subnode.id.name);
				}

				// Do *not* recurse into nested functions
				if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') {
					return false;
				}
			});

			node.scope = scope;
			return true;
		});
	};

	
	/////////////////////////////
	// Traverse the given |ast| and resolve all identifiers upwards.
	//
	// Each identifier node in the tree is assigned a |VariableReference|
	// instance which is stored in the |resolved| property of the node.
	//
	// If an identifier cannot be resolved, the |resolved| property
	// of the node is set to null.
	this.resolveIdentifiers = function(ast) {
		// We do not strictly need post-traversal here
		ast_util.postTraverse(ast, function(node) {
			if (node.type !== 'Identifier') {
				return true;
			}

			node.resolved = null;

			var name = node.name;
			var identifier_scope = null;
			ast_util.walkParentsUp(node, function(parent_node) {
				// Check if the parent node has a |scope| field.
				var scope = parent_node.scope;
				if (!scope) {
					return true;
				}

				// If this is the first scope we encounter going upwards,
				// then it is the scope in which the identifier occurs.
				if (!identifier_scope) {
					identifier_scope = scope;
				}

				var variable = scope.lookupVariable(name);
				if (variable) {
					node.resolved = variable.createReferenceFromScope(identifier_scope);
					return false;
				}

				return true;
			});
		});
	};


	/////////////////////////////
	// Resolve |node.name| upwards using JS' scoping rules.
	//
	// The return value is either
	//     |false| if the identifier is resolved to be globally scoped
	//  OR
	//     The name of a JS variable that (at runtime) evaluates to
	//     contain the function tracing ID associated
	//     with the identifier (this variable will be declared in
	//     the scope in which the identifier is declared, thus it
	//     is accessible from anyone who could see the node itself).
	//  OR
	//     
	//      
	this.resolveIdentifierScope = function(node) {
		var resolved = node.resolved;
		if (typeof resolved === 'undefined') {
			this.error("Identifier not resolved: " + node.name);
			return;
		}

		if (resolved === null) {
			return null;
		}

		var identifier = node.identifier;

		while (node = node.parent) {
			if (node.type !== 'FunctionDeclaration' && node.type !== 'FunctionExpression') {
				continue;
			}

			var scope = this.cacheExecutionScopeVariables(node);
			if (typeof scope[identifier] === 'undefined') {
				continue;
			}

			if (node.function_scope_id_var_name === 'undefined') {
				node.function_scope_id_var_name = scoping_util.genUniqueName() + '_scope';
			}

			return node.function_scope_id_var_name;
		}

		return null;
	};


	/////////////////////////////
	this.splitMemberExpression = function(node) {
		var property = node.property.source();
		var subs = {};

		// Evaluate every MemberExpression using [""] notation.
		if (node.computed) {
			subs.property_access = property;
		}
		else {
			subs.property_access = '"' + property + '"';
		}

		subs.func_this = node.object.source();
		return sprintf('[%(func_this)s, %(property_access)s]',subs);
	};

	
	/////////////////////////////
	this.error = function(text) {
		throw new Error(text);
	};

	this.warn = function(text) {
		console.warn(text);
	};

	this.info = function(text) {
		console.info(text);
	};


	/////////////////////////////
	this.wrap = function(text) {
		return '(function() { ' + text + '})()';
	};

	/////////////////////////////
	this.getOriginalSource = function(falafel_node, original_text) {
		return original_text.substring(
			falafel_node.range[0],
			falafel_node.range[1]
		);
	};

	/////////////////////////////
	// Return an array which tells for each line if it should be ignored
	// for instrumentation.
	this.findIgnoredLines = function(text) {
		var lines = text.split('\n');
		var lines_ignored = new Array(lines.length);
		if (lines.length === 0) {
			return lines_ignored;
		}

		var is_off = lines_ignored[0] = false;

		for (var i = 0; i < lines.length - 1; ++i) {
			var line = lines[i];
			var match = line.match(/\s*\/\/\s*JSane:\s*(\w+)\s*$/m);
			if (match === null) {
				lines_ignored[i + 1] = is_off;
				continue;
			}
			var verb = match[1];
			if (verb == 'on' || verb == 'off') {
				var want_off = verb == 'off';
				if (want_off === is_off) {
					this.warn('Duplicate "JSane: ' + verb + '" instruction');
				}
				else {
					is_off = want_off;
				}
			}
			else if (verb == 'ignore') {
				if (is_off) {
					this.warn('Duplicate "JSane: ignore" instruction');
				}
				lines_ignored[i + 1] = true;
			}
			else {
				this.error('Verb in "Jsane: <verb>" comment syntax not recognized: ' + verb);
			}
		}
		return lines_ignored;
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

})(exports);
