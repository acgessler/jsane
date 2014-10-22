// Node module index file.
//
// This file is typically require()d in two different scenarios:
//   - During build (i.e. from grunt) to use JSane's API to instrument code.
//   - At runtime by jSane generated code to load its support runtime library
//     (only if configured to use the regular module system as opposed
//      to directly embed the runtime source)
//

// Make the runtime library available as |runtime|. If this name
// changes, src/instrumentation/instrument.js needs to be updated.
exports.runtime = require('./compiled/runtime.min');

// Public API to instrument files. This is loaded lazily.
exports.processFile = function() {
	return require('./src/instrumentation/standalone').processFile.apply(this, arguments);
}
