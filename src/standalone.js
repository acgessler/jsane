/** 
Jsane - Javascript Sanity Instrumentation Toolkit
See top level LICENSE or github.com/acgessler/jsane

Standalone binary.
*/

var fs = require('fs');
var path = require('path');
var instrumentator = require('./instrument');

//
// Annotate |src_file| and save the result to |dest_file|,
// which can be the same as |src_file|.
exports.processFile = function(src_file, dest_file) {
	var filePath = path.join(__dirname + '/start.html');

	fs.readFile(src_file, {encoding : 'utf-8'}, function(err, data) {
		if (err) {
			throw new Error("jsane: Failed to read input file " + src_file);
		}

	   	fs.writeFile(dest_file, data + " /* !jsane!:y */ ", function(err) {
	   		if (err) {
	   			throw new Error("jsane: Failed to write to output file " + dest_file);
	   		}
	   	})
	});
}


function main(argv) {
	for (var i = 0; i < argv._.length; ++i) {
		exports.processFile(argv._[i]);
	}
}

(function() {
	main(require('minimist')(process.argv.slice(2)));
})();
