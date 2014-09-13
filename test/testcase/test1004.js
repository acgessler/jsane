// Test to verify that instrumentation leaves
// "use strict" and "asm" annotations intact.

function f_strict(foo, bar, baz) {
	"use strict";
	var f = this;
	return f;
}

// Without semicolon
function f_strict2() {
	'use strict'
	var f = this;
	return f
}

var f0 = f_strict();
var f1 = f_strict2();

// JSane: ignore
expect(f0).to.equal(undefined);
expect(f1).to.equal(undefined);

// TODO: find a way to observe asm.js at runtime
function f_asm() {
	"use asm";
	return {};
}