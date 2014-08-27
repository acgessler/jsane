// E2: calling NIL expression

var f = function() { return this; };
var f_strict = function() { "use strict"; return this; };
var b = null;

var o = {};
o.f = f;
o.f_strict = f_strict;

o.o = {};
o.o.f = f;
o.o.f_strict = f_strict;


"<<[expect=]";
var c0 = f();
// JSane: off
//expect(c0).to.be(global);

var c1 = f_strict();
// JSane: off
//expect(c1).to.be(undefined);

var c2 = o.f();
// JSane: off
//expect(c2).to.be(o);

var c3 = f_strict();
// JSane: off
//expect(c3).to.be(o);
">>";

"<<[expect=E2]";
try { // TODO: remove need for that
b();
} catch(e) {}
">>";
