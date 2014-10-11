// W1: arithmetic expression result is ok, but at least
// one of the operands is not. Possible bug hidden.

var a = 2;
var b1 = null;
var b2 = true;


// 2 + null === 2
"<<[expect=W1,W1]";
var c1 = a + b1;
// JSane: ignore
expect(c1).to.equal(2);
c1 = a;
c1 += b1;
// JSane: ignore
expect(c1).to.equal(2);
">>";

// 2 + true === 3
"<<[expect=W1,W1]";
var c2 = 2 + b2;
// JSane: ignore
expect(c2).to.equal(3);
c2 = b2;
c2 += 2;

// JSane: ignore
expect(c2).to.equal(3);
">>";

// 2 + false === 2
"<<[expect=W1,W1]";
var c3 = a + false;
// JSane: ignore
expect(c3).to.equal(2);
c3 = a;
c3 += false;
// JSane: ignore
expect(c3).to.equal(2);
">>";

// 1.3|2 === 3 (No check)
"<<[expect=]";
var c4 = 1.2 | a;
// JSane: ignore
expect(c4).to.equal(3);
c4 = a;
c4 |= 1.2;
// JSane: ignore
expect(c4).to.equal(3);
">>";

// null|2 === 2
"<<[expect=W1]";
var c5 = b1 | a;
">>";

// Sneaking in a meta-test for whether the assertion syntax
// can handle multiple conditions.
"<<[expect=W1,W0]";
var c6 = null + b1;
c6 = undefined * 2;
">>";