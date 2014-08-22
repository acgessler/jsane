// W2: arithmetic expression result is non-numeric or
// non-finite and so is one or two of the operands.

var a = 2;
var b1 = undefined;
var b2 = Infinity;


// undefined * 2 === NaN
"<<[expect=W2]";
var c1 = b1 * 2;
">>";

// NaN * 2 === NaN
"<<[expect=W1]";
var c2 = 2 + NaN;
">>";

// Inf - Inf === NaN
"<<[expect=W1]";
var c2 = Infinity - b2;
">>";
