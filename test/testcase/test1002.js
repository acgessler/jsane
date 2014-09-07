// Test to verify that expressions in instrumented code
// are evaluated exactly once.

var obj = {};
obj.bar = obj;
obj.bar.a = 2;

// JSane: off
var foo_count = 0;
var foo = function() {
	++foo_count;
	return obj;
}

var baz_count = 0;
var baz = function() {
	++baz_count;
	return "a";
};



// JSane: on
// --------------------

foo().bar[baz()] += foo().bar[baz()];



// --------------------
// JSane: off

expect(foo_count).to.equal(2);
expect(baz_count).to.equal(2);
expect(obj.a).to.equal(4);



// JSane: on
// --------------------

foo().bar.a = foo().bar[baz()] * 2;

// --------------------
// JSane: off


expect(foo_count).to.equal(4);
expect(baz_count).to.equal(3);
expect(obj.a).to.equal(8);


// JSane: on
// --------------------

foo().bar["a"] = foo().bar.a;

// --------------------
// JSane: off

expect(foo_count).to.equal(6);
expect(baz_count).to.equal(3);
expect(obj.a).to.equal(8);