// W1: arithmetic expression result is ok, but at least
// one of the operands is not. Possible bug hidden.

var a = 2;
var b1 = null;
var b2 = true;


// 2 + null === 2
"<<[expect=W1]";
var c1 = a + b1;
">>";

// 2 + true === 3
"<<[expect=W1]";
var c2 = 2 + b2;
">>";

// 2 + false === 2
"<<[expect=W1]";
var c3 = a + false;
">>";

// 1.3|2 === 3 (No check)
"<<[expect=]";
var c4 = 1.2 | a;
">>";

// null|2 === 2
"<<[expect=W1]";
var c5 = b1 | a;
">>";

// null + null === 0
"<<[expect=W1]";
var c6 = null + b1;
">>";