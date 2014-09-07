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
};

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

foo().bar.a = foo().bar[baz()] * foo().bar[baz()];

// --------------------
// JSane: off


expect(foo_count).to.equal(5);
expect(baz_count).to.equal(4);
expect(obj.a).to.equal(16);


// JSane: on
// --------------------

foo().bar["a"] = foo().bar.a;

// --------------------
// JSane: off

expect(foo_count).to.equal(7);
expect(baz_count).to.equal(4);
expect(obj.a).to.equal(16);



// JSane: on
// --------------------

obj.c = obj.b = obj.a;

// --------------------
// JSane: off

expect(obj.b).to.equal(16);
expect(obj.c).to.equal(16);