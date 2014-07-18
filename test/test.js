
var chai = require('chai');

/** Instrument and run ./testcase/test<id>.js and verify that all
    warnings and errors occur as defined in testcase comments. 

    Syntax for test case specs: TODO

 */
function runTestcase(id) {
}

// Main test case list - most simply invoke runTestcase()
describe('esnull', function() {
   describe('instrumentation', function() {
   		it('should warn if JS arithmetic unexpectedly swallows bad operands (i.e. 2 + null)', function() {
   			runTestcase(0);
   		});
	});
});
