module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.initConfig({
    uglify: {
      options: {
        mangle: true
      },
      runtime: {
        files: {
          'compiled/jsane-runtime.min.js': ['src/jsane-runtime.js']
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
    }
  });

  grunt.registerTask('default', 'uglify', 'mochaTest');
};