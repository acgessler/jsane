// Test to verify closure behaviour is untampered

var a = 1;

function f() {
	var a_copy = 1;
	var b = 2;

	function f2alias() {
			var c = a_copy + b;
			return c;
	};

	return function() {
			var f2 = function() {
				return f2alias();
			};
			return a * b * f2();
	};
};

expect(f()()).to.equal(6);

a = 2;
expect(f()()).to.equal(12);
