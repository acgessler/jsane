// W5: Arithmetic operation with a string operand causes
// said operand to be parsed as number.

"<<[expect=]";
var cc = "32" + "4";
// JSane: ignore
expect(cc).to.equal("324");

cc = "32" + 4;
// JSane: ignore
expect(cc).to.equal("324");
">>";

"<<[expect=W5]";
var cc = "32" - "4";
// JSane: ignore
expect(cc).to.equal(28);
">>";

"<<[expect=W5]";
var cc = "32" - 4;
// JSane: ignore
expect(cc).to.equal(28);
">>";

"<<[expect=W5]";
var cc = "32," - 4;
// JSane: ignore
expect(cc).not.to.equal(cc); // NaN check
">>";

