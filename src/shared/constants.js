/** 
JSane - Javascript Sanity Instrumentation Toolkit
See top level LICENSE or github.com/acgessler/jsane

Constants shared by both runtime/ and (offline) instrumentation/

By runtime gets baked into runtime source using grunt-includes
By instrumentation gets loaded using require()
*/

// Static tracing ID used for the global object
exports.GLOBAL_OBJECT_TRACE_ID = 1;

// Magic name used to refer to the return value of the
// last CallExpression during trace assignments.
//
// Contains an intentional whitespace to disambiguate from JS identifiers,
// which can otherwise contain most unicode characters.
exports.RETURN_VALUE_ID = '$ ret';

