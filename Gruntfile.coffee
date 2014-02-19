module.exports = (grunt) ->
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks)

  grunt.initConfig {
    coffee:
      compile:
        expand: true
        cwd: 'src'
        src: [ '*.coffee' ]
        dest: 'dist'
        ext: '.js'
    watch:
      coffee:
        files: [ 'src/*.coffee' ]
        tasks: [ 'coffee:compile' ]
  }

  grunt.registerTask 'default', 'watch:coffee'
