// E2: calling NIL expression

var f = function() { return this; };
var f_strict = function() { "use strict"; return this; };
var get_f_strict_name = function() { return "f_strict"; };
var b = null;

var o = {};
o.f = f;
o.f_strict = f_strict;

o.o = {};
o.o.f = f;
o.o.f_strict = f_strict;

// Verify that functions are invoked with the correct |this|
"<<[expect=]";
var c0 = f();
// JSane: ignore
expect(c0).to.equal(global);

var c1 = f_strict();
// JSane: ignore
expect(c1).to.equal(undefined);

var c2 = o.f();
// JSane: ignore
expect(c2).to.equal(o);

var c3 = o.f_strict();
// JSane: ignore
expect(c3).to.equal(o);

var c4 = o.o.f();
// JSane: ignore
expect(c4).to.equal(o.o);

var c5 = o.o.f_strict();
// JSane: ignore
expect(c5).to.equal(o.o);

var c6 = o.o["f"]();
// JSane: ignore
expect(c6).to.equal(o.o);

var c7 = o.o[get_f_strict_name()]();
// JSane: ignore
expect(c7).to.equal(o.o);
">>";

"<<[expect=E2]";
try { // TODO: remove need for that
b();
} catch(e) {}
">>";
