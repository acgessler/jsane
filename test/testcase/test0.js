// W0: arithmetic expression result is non-numeric or
// non-finite and so is one or two of the operands.

var a = 2;
var b1 = undefined;
var b2 = Infinity;


// undefined * 2 === NaN
"<<[expect=W0,W0]";
var c1 = b1 * 2;
c1 = b1;
c1 *= 2;
">>";

// NaN * 2 === NaN
"<<[expect=W0]";
var c2 = 2 + NaN;
">>";

// Inf - Inf === NaN
"<<[expect=W0,W0]";
var c2 = Infinity - b2;
c2 = Infinity;
c2 -= b2;
">>";
