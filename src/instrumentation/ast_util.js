/** 
Jsane - Javascript Sanity Instrumentation Toolkit
See top level LICENSE or github.com/acgessler/jsane

Utilities to process an esprima AST. Only executes in a node environment.
*/


(function(exports){
"use strict";

// Module imports
var _ = require('underscore')._;


//// IMPLEMENTATION /////////////////////////////////////////////////////////

// Post-traversal. If a visit returns false, the subtree of that node
// is not traversed.
function postTraverse(node, visitor) {
	if (!visitor(node)) {
		return;
	}
	
	for (var key in node) {
		if (key === 'parent') {
			continue;
		}
		var child = node[key];

		if (!child) {
			continue;
		}
		
		if (_.isArray(child)) {
			for (var i = 0; i < child.length; ++i) {
				if (typeof child[i].type !== 'string') {
					continue;
				}
				postTraverse(child[i], visitor);
			}
			continue;
		}
		else if (typeof child.type === 'string') {
			postTraverse(child, visitor);
		}		
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