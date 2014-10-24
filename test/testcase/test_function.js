// Test to verify Function class (i.e. toString) behaviour is unchanged

function foo(a) {console.log(1); }

var foo_string = "function foo(a) {console.log(1); }";

"<<[expect=]";

expect(foo.toString()).to.equal(foo_string);
expect(foo.length).to.equal(1);

">>"



