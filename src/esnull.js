
var fs = require('fs');
var path = require('path');
var instrumentator = require('./esnull-instrument');

/**
 *  Annotate |src_file| and save the result to |dest_file|,
 *  which can be the same as |src_file|.
 */
function processFileAsync(src_file, dest_file) {
	var filePath = path.join(__dirname + '/start.html');

	fs.readFile(src_file, {encoding : 'utf-8'}, function(err, data) {
		if (err) {
			throw new Error("esnull: Failed to read input file " + src_file);
		}

	   	fs.writeFile(dest_file, data + " /* !esnull!:y */ ", function(err) {
	   		if (err) {
	   			throw new Error("esnull: Failed to write to output file " + dest_file);
	   		}
	   	})
	});
}


function main(argv) {

	for (var i = 0; i < argv._.length; ++i) {
		processFileAsync(argv._[i]);
	}
}

(function() {
	main(require('minimist')(process.argv.slice(2)));
})();
