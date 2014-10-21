// Node module index file.
//
// This file is typically require()d in two different scenarios:
//   - During build (i.e. from grunt) to use JSane's API to instrument code.
//   - At runtime by jSane-generated code to load its own runtime library
//

// Make the runtime library available as |runtime|. If this name
// changes, src/instrument.js needs to be updated.
exports.runtime = require('./src/runtime');

// Public API to instrument files
exports.processFile = require('./src/standalone').processFile;