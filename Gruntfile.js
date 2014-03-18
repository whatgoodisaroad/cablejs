
function generateBanner() {
  var d = new Date().toISOString();
  d += new Array(38 - d.length).join(" ");
  return [
    "/*.......................................",
    ". cablejs: By Wyatt Allen, MIT Licenced .",
    ". " + d + " .",
    ".......................................*/"
  ].join("\n");
}

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
          "cable.min.js": ["src/core.js", "src/helpers.js", "src/dependent.js"]
        },
        options: {
          // Any options supported by Closure Compiler, for example:
          // "compilation_level": "WHITESPACE_ONLY",
          "compilation_level": "SIMPLE_OPTIMIZATIONS",

          // Plus a simultaneous processes limit
          "max_processes": 5,

          // And an option to add a banner, license or similar on top
          "banner":generateBanner(),
        }
      }
    }
  });

  grunt.registerTask('build', ['closurecompiler:minify']); 

  grunt.registerTask('default', ['build']); 
};
