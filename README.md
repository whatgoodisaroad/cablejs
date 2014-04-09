# cable.js

An effect system and FRP runtime for JavaScript

![](https://raw.githubusercontent.com/whatgoodisaroad/cablejs/master/assets/cablejs-400x192.png)

## What is cable.js?

cable.js is an Functional Reactive Programming (FRP) runtime, an event system,
and module loader all unified under a common syntax.

Every piece of code depends on something, whether it's data, an event being 
triggered or a library. cable.js is a way of making these dependencies explicit 
and structuring your code around them. The result is a cleaner code structure 
that can easily handle constantly changing information and interaction.

## Example

A simple example would be a markdown previewer. We'd like a page where one can 
write markdown code and have a live-updating preview of the resulting HTML. So,
we write some elements for the input and the output:

    <textarea id="input"></textarea>
    <div id="output"></div>

What remains is to use cable.js to connect the input to the output via a
markdown compiler.

    Cable.define({
      $:Cable.library("jquery.min.js"),
      marked:Cable.library("marked.js"),

      source:Cable.textbox("#input"),
      dest:function($, marked, source) {
        $("#output").html(marked(source()));
      }
    });

That's it! This is all the code needed to have a live updating preview. It's 
vanilla JavaScript running in strict mode: no fake pseudo-JS syntax that needs 
to be pre-processed. No magic markup tags.

A working example of this previewer can be found in `examples/markdown.htm` in 
the repository. Consult the *Building* section of the readme for help running 
the example.

Cable can do much more. There are a number of different kinds of nodes which can
be added to the graph, including different kinds of events, data-sources, 
synthetic-data-sources, effects, libraries and cable-modules. Consult the 
examples and API document for more. A tutorial is coming soon.

## API

The API is documented [in the wiki](https://github.com/whatgoodisaroad/cablejs/wiki/API-Documentation).

## Building

To download and build, you'll need npm and git.

    # download:

    git clone git@github.com:whatgoodisaroad/cablejs.git
    cd cablejs

    # install dependencies and build:

    npm install
    grunt build

    # download example dependencies:

    cd examples
    bower install

## Roadmap

* ☑ Functioning core system.
* ☑ Builds and runs in strict mode.
* ☑ Functioning examples.
* ☑ Functioning cyclic dependency graphs.
* ☑ Module loader is AMD compliant.
* ☑ Write API docs.
* ☑ Streamline event definition syntax.
* ☑ Enable subdefinition syntax for library-dependnat nodes
* ☑ Alias support.
* ☑ Write unit tests.
* ☐ Write *more* unit tests.
* ☐ Write tutorial.
* ☐ Implement tools for debugging the dependency graph (via `Cable._debug()`).
* ☐ Make the dependency graph more plastic (i.e. reconfigurable).
* ☐ Add history sensitivity decorations.
