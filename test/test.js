
// Module includes
var	chai = require('chai')
,	fs = require('fs')
,	path = require('path')
,	esnull = require('../src/jsane-instrument')
;

// Shortcuts to common chai functions
var expect = chai.expect;


/** Instrument and run ./testcase/test<id>.js and verify that all
    warnings and errors occur as defined in testcase comments. 

    Syntax for test case specs: TODO

 */
function runTestcase(id) {
	var	src_file = path.join(__dirname, 'testcase', 'test' + id + '.js')
	,	source = fs.readFileSync(src_file, {encoding : 'utf-8'})
	;
	source = esnull.instrumentCode(source).toString();
	expect(source).to.be.a('string');
	expect(function() {
		eval(source);
	}).not.to.throw();
	console.log(source);
}

// Main test case list - most simply invoke runTestcase()
describe('esnull', function() {
   describe('instrumentation', function() {
   		it('should warn if JS arithmetic unexpectedly swallows bad operands (i.e. 2 + null)', function() {
   			runTestcase(0);
   		});
	});
});
