// Test to verify that instrumentation works in absence
// of implicit semicolons to separate.

// JSane: off

var foo = 0, bar = 0;
var baz = function() {
	return 2;
} // Intentionally no semicolon here !!

// With instrumentation
//
//    var f = function() {}
//    a = 2;
//
// potentially becomes
//
//    var f = function() {}
//    (function() { .. a = 2 .. }())
//
// which accidentally executes the first function.
// This needs to work even if said function is in a
// JSane-disabled block.

// JSane: on
// --------------------

foo += baz();;; bar = foo
foo += baz(); foo = bar = bar = foo = bar ;
foo += baz(); foo += baz()

// --------------------
// JSane: off

expect(foo).to.equal(6);


// JSane: on
// --------------------

foo = ( function(foo) {
	return bar + foo
} ) ( foo = bar = baz() );

// --------------------
// JSane: off

expect(foo).to.equal(4);
