/** 
Jsane - Javascript Sanity Instrumentation Toolkit
See top level LICENSE or github.com/acgessler/jsane

JS scoping / name resolver on top of an esprima AST. Only executes in a node environment.
*/


(function(exports){
"use strict";


// Module imports
var	format = require('util').format;


//// IMPLEMENTATION /////////////////////////////////////////////////////////

function genUniqueName() {
		return format('$%d', Math.floor(Math.random() * 1000000000));
};

var Scope = function() {
	var variables = {};

	// Name of JS runtime variable that will be injected into the
	// scope to contain the current funcion tracing Id.
	var runtime_trace_id_variable_name = 'ft_' + genUniqueName();

	this.getRuntimeTraceIdVariableName = function() {
		return runtime_trace_id_variable_name;
	}

	// Add a variable with a given name to the scope
	this.createVariable = function(name) {
		return variables[name] = variable || new Variable(this);
	};

	// Lookup variable by name. This only retrieves variables
	// declared in the scope directly.
	this.lookupVariable = function(name) {
		return variables[name];
	};

	// Returns true if the scope declares any variables that
	// are currently referenced from nested scopes / closures.
	//
	// A reference is created using |Variable.createReferenceFromScope|
	this.hasEnclosedVariables = function() {
		for (var k in variables) {
			if (!variables[k].isLocal()) {
				return true;
			}
		}
		return false;
	};
};

// Variable, bound to the |Scope| it is declared in.
var Variable = function(scope) {
	var self = this;
	
	var local = true;

	// Create a reference to the variable from |from_scope|
	this.createReferenceFromScope = function(from_scope) {
		if (from_scope !== scope) {
			local = false;
		}
		return new VariableReference(this);
	};

	this.isLocal = function() {
		return local;
	};

	this.getScope = function() {
		return scope;
	};
};

// Reference to a |Variable|
var VariableReference = function(variable) {
	
	this.getVariable = function() {
		return variable;
	};
};

//// EXPORTS //////////////////////////////////////////////////////////////

exports.Scope = Scope;
exports.VariableReference = VariableReference;
exports.Variable = Variable;
exports.genUniqueName = genUniqueName;

})(exports);
