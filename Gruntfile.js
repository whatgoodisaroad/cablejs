module.exports = function(grunt) {
  
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json')
  });

  grunt.loadNpmTasks('grunt-closurecompiler');

   grunt.initConfig({
    closurecompiler: {
      minify: {
        files: {
          // Destination: Sources...
          "cable.min.js": ["src/core.js", "src/helpers.js"]
        },
        options: {
          // Any options supported by Closure Compiler, for example:
          "compilation_level": "SIMPLE_OPTIMIZATIONS",

          // Plus a simultaneous processes limit
          "max_processes": 5,

          // And an option to add a banner, license or similar on top
          "banner": "/* cablejs: By Wyatt Allen, MIT Licenced */"
        }
      }
    }
  });

  grunt.registerTask('minify', ['closurecompiler:minify']); 

  grunt.registerTask('default', ['minify']); 
};
