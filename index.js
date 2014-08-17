// Node module index file.
//
// This file is typically require()d in two different scenarios:
//   - During build (i.e. from grunt) to use jsane's API to instrument code.
//   - At runtime by jsane-generated code to load its own runtime library
//

// Make the runtime library available as |runtime|. If this name
// changes, jsane-instrument needs to be updated.
exports.runtime = require('./src/jsane-runtime');

// Public API to instrument files
exports.processFile = require('./src/jsane').processFile;