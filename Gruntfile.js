module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-includes');

  grunt.initConfig({

    // includes: Flatten the runtime source code into one big file.
    // This way, runtime does not depend on any module system and
    // src/runtime/main.js controls the public API and all changes
    // to global state.
    includes: {
      build: {
        src: [ 'src/runtime/main.js'],
        dest: 'compiled/runtime.js'
      }
    },

    // browserify: used to derive a version of the instrumentation
    // node app that can run in browser demos. Here we do not care
    // about dependencies or changes to global state.
    browserify: {
      dist: {
        files: {
          'compiled/web_standalone.js': ['src/instrumentation/instrument.js'],
        },
      }
    },

    uglify: {
      options: {
        mangle: true
      },
      runtime: {
        files: {
          'compiled/runtime.min.js': ['compiled/runtime.js'],
          'compiled/web_standalone.min.js': ['compiled/web_standalone.js'],
        }
      }
    },

    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['test/*.js']
      }
    },
  });

  // [web_standalone]
  // Build a browser version of the standalone instrumentation
  // binary. This is used for samples and not normally needed
  // when using JSane.
  grunt.registerTask('web_standalone', ['browserify', 'includes', 'uglify']);

  // [default]
  // Build runtime and instrumentation, run node tests
  grunt.registerTask('default', ['includes', 'uglify', 'mochaTest']);
};