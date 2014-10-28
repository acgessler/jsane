// Test to verify Function class (i.e. toString) behaviour is unchanged

function foo(a) {console.log(1); }
var bar = function(a, b) {console.log(2); }
var baz = function baz() {console.log(3); }

var foo_string = "function foo(a) {console.log(1); }";
var bar_string = "function(a) {console.log(2); }";
var baz_string = "function baz(a) {console.log(3); }";

"<<[expect=]";

expect(foo.toString()).to.equal(foo_string);
expect(foo.length).to.equal(1);

expect(bar.toString()).to.equal(bar_string);
expect(bar.length).to.equal(2);

expect(baz.toString()).to.equal(baz_string);
expect(baz.length).to.equal(0);

">>"



