
// Module includes
var	chai = require('chai')
,	fs = require('fs')
,	path = require('path')
,	sprintf = require('sprintf-js').sprintf
,	jsane = require('../src/jsane-instrument')
,	_ = require('underscore')._
;

// Shortcuts to common chai functions
var expect = chai.expect;

// Get a JSane printing function that instead of printing
// records the kind of event that occured in |events|.
//
// I.e. Warning 1 pushes 'W1' into events.
function getMockPrintFunc(events) {
	return function(message) {
		events.push(message.substring(0, message.indexOf(':')));
	};
}

// Diff |actual| events against |expected| events
function diffEventArrays(actual, expected)
{
	// Note: chai's eql() is a deep compare
	expect(actual).to.be.eql(expected);
}

// Implement the <<[expect=...] test assertion syntax as
// described in the runTestcase() doctext.
function installTestAssertions(jsane_runtime_name, source)
{
	// Note: [\s\S] is the JS way of saying DOTALL.
	var rex = /"<<\[expect=([\w\d\,]*)\]"([\s\S]*?)">>"/g;

	// p1: expectations
	// p2: CODE
	var replacer = function(match, p1, p2) {
		var expectations = p1.split(',');
		var js_expectations_array = expectations[0] == '' ? '[]' : 
			sprintf('[%s]', _.map(expectations, function(el, i) {
				return '"' + el + '"';
			}).join(','));

		// Wrap CODE (p2) in a try-catch to survive any
		// errors being thrown. Once the entire block
		// has completed, diff all checks recorded in
		// |events| against |expectations|.
		return sprintf(
			"{\n" +
				"global.testsuite_events = [];\n" +
				"%s.setPrintFunc(getMockPrintFunc(global.testsuite_events));\n" +
				"try { %s }\n" +
				"catch(e) {\n" +
				"	if(e.message.indexOf('JSane') !== 0) { throw e; }\n" +
				"}\n" +
				"diffEventArrays(global.testsuite_events, %s);\n" +
			"}\n",
			jsane_runtime_name,
			p2,
			js_expectations_array
		);
	};

	return source.replace(rex, replacer);
}

// Instrument and run ./testcase/test<id>.js and verify that all
//  warnings and errors occur as defined in testcase comments. 
//
//  Syntax for test case specs: 
//
// "<<[expect=W1,E1,...]";
// CODE
// ">>";
//
// Generates the assertion that CODE when instrumented and executes
// triggers W1, then E1, ... (since errors cause an exception to be thrown,
// an error expectation can only come last in the list).
//
// The list can be empty, in which case CODE is exected to trigger
// no checks.
function runTestcase(id, options) {
	var	src_file = path.join(__dirname, 'testcase', 'test' + id + '.js')
	,	source = fs.readFileSync(src_file, {encoding : 'utf-8'})
	;

	options = options || {};
	// Set jsane_node_module to make sure jsane-runtime is found locally
	options.jsane_node_module = options.jsane_node_module || '../';

	source = jsane.instrumentCode(source, 'test.js', options).toString();
	expect(source).to.be.a('string');

	// Install test assertions in the source code
	var jsane_runtime_name = options.runtime_name || jsane.DEFAULT_RUNTIME_NAME;
	source = installTestAssertions(jsane_runtime_name, source);

	eval(source);
}

// Main test case list - most simply invoke runTestcase()
describe('esnull', function() {
   describe('instrumentation', function() {
   		describe('runtime', function() {
   			it('should work with require()', function() {
   				runTestcase(1000, {
   					runtime_linkage : jsane.RUNTIME_REQUIRE
   				});
   				runTestcase(1001, {
   					runtime_linkage : jsane.RUNTIME_REQUIRE,
   					runtime_name : 'magic_runtime_name'
   				});
   			});

   			it('should be embeddable', function() {
   				runTestcase(1000, {
   					runtime_linkage : jsane.RUNTIME_EMBED
   				});
   				runTestcase(1001, {
   					runtime_linkage : jsane.RUNTIME_EMBED,
   					runtime_name : 'magic_runtime_name'
   				});
   			});

   			it('should be able to pre-exist', function() {
   				global.magic_runtime_name = require('../src/jsane-runtime');
   				runTestcase(1001, {
   					runtime_linkage : jsane.RUNTIME_NONE,
   					runtime_name : 'magic_runtime_name'
   				});

   				// The same, minified version of the runtime
   				global.magic_runtime_name2 = require('../compiled/jsane-runtime.min');
   				runTestcase(1001, {
   					runtime_linkage : jsane.RUNTIME_NONE,
   					runtime_name : 'magic_runtime_name2'
   				});
   			});
   		});

		describe('config', function() {
   			
   		});

   		describe('correctness', function() {
   			it('should evaluate each expression exactly once', function() {
   				runTestcase(1002);
   			});
   		});

   		describe('check', function() {
   			it('W0: should warn if JS arithmetic propagates a bad operand', function() {
   				runTestcase(0);
   			});

   			it('W1: should warn if JS arithmetic unexpectedly swallows bad operands', function() {
   				runTestcase(1);
   			});

   			it('E2: should err if a non-callable expression is called', function() {
   				runTestcase(2);
   			});

   			it('W3: should warn if arrays are added using +', function() {
   				runTestcase(3);
   			});

   			it('W4: should warn if objects are converted to strings without having a proper string conversion', function() {
   				runTestcase(4);
   			});

   			it('W5: should warn if strings participating in arithmetic are auto-parsed as numbers', function() {
   				runTestcase(5);
   			});
   		});
	});
});
