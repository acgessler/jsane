// E2: calling NIL expression

var f = function() { return this; };
var b = null;

var o = {};
o.f = f;


"<<[expect=]";
var c0 = f();
">>";

"<<[expect=E2]";
try { // TODO: remove need for that
b();
} catch(e) {}
">>";
