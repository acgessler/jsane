
// Module includes
var	chai = require('chai')
,	fs = require('fs')
,	path = require('path')
,	jsane = require('../src/jsane-instrument')
;

// Shortcuts to common chai functions
var expect = chai.expect;

/** Instrument and run ./testcase/test<id>.js and verify that all
    warnings and errors occur as defined in testcase comments. 

    Syntax for test case specs: TODO

 */
function runTestcase(id, options) {
	var	src_file = path.join(__dirname, 'testcase', 'test' + id + '.js')
	,	source = fs.readFileSync(src_file, {encoding : 'utf-8'})
	;

	options = options || {};
	// Set jsane_node_module to make sure jsane-runtime is found locally
	options.jsane_node_module = options.jsane_node_module || '../';

	source = jsane.instrumentCode(source, 'test.js', options).toString();
	expect(source).to.be.a('string');

	console.log(source);

	expect(function() {
		eval(source);
	}).not.to.throw();
}

// Main test case list - most simply invoke runTestcase()
describe('esnull', function() {
   describe('instrumentation', function() {
   		describe('runtime', function() {
   			it('should work with require()', function() {
   				runTestcase(1, {
   					runtime_linkage : jsane.RUNTIME_REQUIRE
   				});
   				runTestcase(2, {
   					runtime_linkage : jsane.RUNTIME_REQUIRE,
   					runtime_name : 'magic_runtime_name'
   				});
   			});

   			it('should be embeddable', function() {
   				runTestcase(1, {
   					runtime_linkage : jsane.RUNTIME_EMBED
   				});
   				runTestcase(2, {
   					runtime_linkage : jsane.RUNTIME_EMBED,
   					runtime_name : 'magic_runtime_name'
   				});
   			});

   			it('should be able to pre-exist', function() {
   				global.magic_runtime_name = require('../src/jsane-runtime');
   				runTestcase(2, {
   					runtime_linkage : jsane.RUNTIME_NONE,
   					runtime_name : 'magic_runtime_name'
   				});

   				// The same, minified version of the runtime
   				global.magic_runtime_name2 = require('../compiled/jsane-runtime.min');
   				runTestcase(2, {
   					runtime_linkage : jsane.RUNTIME_NONE,
   					runtime_name : 'magic_runtime_name2'
   				});
   			});
   		});

   		describe('checks', function() {
   			it('should warn if JS arithmetic unexpectedly swallows bad operands (i.e. 2 + null)', function() {
   				runTestcase(0);
   			});
   		});
	});
});
