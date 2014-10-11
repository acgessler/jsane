/** 
Jsane - Javascript Sanity Instrumentation Toolkit
See top level LICENSE or github.com/acgessler/jsane

Utilities to process an esprima AST. Only executes in a node environment.
*/


(function(exports){
"use strict";

//// IMPLEMENTATION /////////////////////////////////////////////////////////

// Post-traversal. If a visit returns false, the subtree of that node
// is not traversed.
function postTraverse(ast, visitor) {
	for (var k in ast) {
		var node = ast[k];

		if (!node) {
			continue;
		}
		
		if (node instanceof Array) {
			for (var i = 0; i < node.length; ++i) {
				postTraverse(node[i], visitor);
			}
		}

		if (typeof node.type === 'undefined') {
			continue;
		}

		if (!visitor(node)) {
			continue;
		}
		postTraverse(node, visitor);
	}
};

// Traverse the parents of |ast| upwards. If a visit returns
// false, the traversal ends.
function walkParentsUp(ast, visitor) {
	while ((ast = ast.parent) && visitor(ast));
};

//// EXPORTS //////////////////////////////////////////////////////////////

exports.walkParentsUp = walkParentsUp;
exports.postTraverse = postTraverse;

})(exports);