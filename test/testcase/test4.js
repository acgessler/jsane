// W4: String concatenation with an object operand that
// has a "bad" string conversion

function a() {}

function b() {}
b.prototype = new a();
b2.prototype.constructor = b;

function c() {}
c.prototype = new b();
c.prototype.constructor = c;


function b2() {}
b2.prototype = new a();
b2.prototype.constructor = b2;

b2.prototype.toString = function() {
	return 'banan';
};

function c2() {}
c2.prototype = new b2();
c2.prototype.constructor = c2;

"<<[expect=W4,W4]";
var cc = new a() + {};
var dd = new c() + "a";
">>";

"<<[expect=]";
var dd = new c2() + "a";
// JSane: ignore
expect(dd).to.equal("banana");
">>";
