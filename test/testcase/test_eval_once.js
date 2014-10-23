// Test to verify that expressions in instrumented code
// are evaluated exactly once.

var obj = {};
obj.bar = obj;
obj.bar.a = 2;

// JSane: off
var foo_count = 0;
var foo = function(a, b, c) {
	++foo_count;
	return obj;
};

var baz_count = 0;
var baz = function(a) {
	++baz_count;
	return "a";
};

"<<[expect=]";

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


// JSane: on
// --------------------

foo(foo(), foo(), baz( baz( 2 + baz() ) ));

// --------------------
// JSane: off

expect(foo_count).to.equal(10);
expect(baz_count).to.equal(7);

// JSane: on
// --------------------

// Use a property with counting setters and getters to determine
// how often property expressions get evaluated.
var backing = 0;
var count_set = 0;
var count_get = 0;
var o2 = {};
Object.defineProperty(o2, 'foo', {
  get: function() { 
  	++count_get;
  	return backing;
  },
  set: function(new_val) {
  	++count_set;
  	backing = new_val;
  },
  enumerable: true,
  configurable: true
});

// Assign undefined to ensure tracing kicks in
o2.foo = undefined;

// --------------------
// JSane: off

expect(count_set).to.equal(1);
expect(count_get).to.equal(0);

// JSane: on
// --------------------

var temp = o2.foo;

// --------------------
// JSane: off

expect(count_set).to.equal(1);
expect(count_get).to.equal(1);

// JSane: on
// --------------------

o2.foo = 0;
o2.foo += 2;

// --------------------
// JSane: off

expect(count_set).to.equal(3);
expect(count_get).to.equal(2);

// JSane: on
// --------------------

">>";