// W3: arrays added using + causes both operands to
// be converted to strings and then be concatenated.

var a = [1, 2];
var b = [2, 3, 4];

"<<[expect=W3]";
var c = a + b;
// JSane: ignore
expect(c).to.equal('1,22,3,4');
">>";

"<<[expect=]";
c = a + ',' + b;
// JSane: ignore
expect(c).to.equal('1,2,2,3,4');
">>";
