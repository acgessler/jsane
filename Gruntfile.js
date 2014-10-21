module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-browserify');

  grunt.initConfig({
    uglify: {
      options: {
        mangle: true
      },
      runtime: {
        files: {
          'compiled/runtime.min.js': ['src/runtime.js'],
          'compiled/web_standalone.min.js': ['compiled/web_standalone.js'],
        }
      }
    },

    // Configure a mochaTest task
    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['test/*.js']
      }
    },

    browserify: {
      dist: {
        files: {
          'compiled/web_standalone.js': ['src/instrument.js'],
        },
      }
    }
  });

  // Build a browser version of the standalone instrumentation
  // binary. This is used for samples and not normally needed
  // when using JSane.
  grunt.registerTask('web_standalone', ['browserify', 'uglify']);

  // Build minified version of runtime, run node tests
  grunt.registerTask('default', ['uglify', 'mochaTest']);
};