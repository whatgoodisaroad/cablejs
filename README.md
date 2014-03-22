# cable.js

An effect system and FRP runtime for JavaScript

## What is cable.js?

cable.js is an Functional Reactive Programming (FRP) runtime, an event system,
an effect system, a module loader and dependency injector all unified under a 
common syntax.

One way to think of cable.js is in terms of require.js. Require allows you to 
write scripts that depends on other scripts. This is generally only used at 
module-level granularity, but the internals of require.js handle all the 
dependencies for you. But what if you wanted code that depended on *data*, or 
an *event*, or a live-updating JSON feed? Cable.js works like a fancy require.js
that lets you depend on any of these things, and it handles the internals for 
you.

Another way of thinking about cable.js is in FRP terms. FRP is a style of 
writing code that depends on live-updating information. Instead of writing code
that uses *data*, you write code that uses a *stream of data*. You write code
that builds up a graph of such dependencies, and changes in the data ripples 
outward towards it's dependents via a graph traversal.

## Example

A simple example would be a markdown previewer. We'd like a page where one can 
write markdown code and have a live-updating preview of the resulting HTML. So,
we write some elements for the input and the output:

    <textarea id="input"></textarea>
    <div id="output"></div>

What remains is to use cable.js to connect the input to the output via a
markdown compiler. We can create elements in the cable system using the 
`Cable.define({ })` function.

First, we should load some libraries. We'll use **jQuery** for DOM manipulation 
and **marked** for markdown parsing. They can be defined in the Cable system in
a similar manner to how Require.js works.

    Cable.define({
      $:Cable.library("jquery.min.js"),
      marked:Cable.library("marked.js")
    });

As you can see, the two libraries are declared by providing an object where the 
libraries are given a name (in this case `$` and `marked`) and are declared 
using `Cable.library("")` with a path to the JavaScript file.

Next, we need access to the `<textarea>` where the user types markdown code. We 
can add the `<textarea>` to the cable system **in the same way that we added
libraries.** In this case, we call it `source` and use the `Cable.textbox("")` 
function, which accepts a CSS selector for the input element.

    Cable.define({
      source:Cable.textbox("#input")
    });

The remaining piece of the puzzle is to connect these elements together in the 
preview. We want to write code that depends on jQuery, the marked parser and the
live-updating source code that's entered into the `<textarea>`. We can do this
by writing a regular JS function, but in this case **the argument names are 
significant**.

    Cable.define({
      dest:function($, marked, source) {
        $("#output").html(marked(source()));
      }
    });

When the cable.js system defines this function, it looks at the argument names,
and figures out what parts of the cable system this function depends on. Not 
only can it provide those dependencies, but it executes the function whenever 
the `source` is updated.

Putting it all together in one definition:

    Cable.define({
      $:Cable.library("jquery.min.js"),
      marked:Cable.library("marked.js"),

      source:Cable.textbox("#input"),
      dest:function($, marked, source) {
        $("#output").html(marked(source()));
      }
    });

That's it! This is all the code needed to have a live upading preview. A working
example of this tool can be found in `examples/markdown.htm` in the repository.
Consult the *Building* section of the readme for help running the example.

Cable can do much more. There are a number of different kinds of nodes which can
be added to the graph, including different kinds of events, data-sources, 
synthetic-data-sources, effects, libraries and cable-modules. Some of this can 
be seen in the examples, but a tutorial and API documentation is coming soon.

## Building

All the build dependncies are managed through NPM, so you'll need to install 
that first. One you've cloned the repository. You can install dependencies 
locally using:

    npm install

At this point, you can now build cable.js using:

    grunt build

To run the examples, you should also run `bower install` in the `examples` 
directory to get front-end dependencies used by some of the examples.
