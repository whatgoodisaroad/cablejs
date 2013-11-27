NOTE: This document is old, and probably completely innacurate. These are a lot
of ideas that fed into this many months ago. Probably gotta completely rewrite 
it.

# Introduction

This is meant to serve as a design document for Cable.js, a JavaScript framework 
intended to unify the roles of an effect system, event engine dependency 
injector under an intuitive EDSL. As such, the design effort can be subdivided 
into the issues of semantics and syntax, which we will explore in that order.

# Semantics

The core semantic model is that of the dependency graph. This stems from the
observation that dependency injectors and event engines are both ways of making 
code dependencies explicit, and differ only in granularity (coarse and fine 
respectively). Additionally, a sufficiently encompassing method of making 
dependency explicit could extend itself to the relatively unexplored land of 
JavaScript effect systems.

To this end, the directed graph of dependency relations becomes the central 
semantic unit under consideration. With the advantage of this perspective, we 
can code the operations generically to each role of the system, and, in keeping 
with the semantics-first philosophy of DSL design, will ultimately result in a 
more-consistent and sensible syntax.

## The Dependency Graph

Necessarily, the graph will have to have different types of vertices in order to 
address the different core roles. One way to think about this design direction
is to consider that the differences between the disparate roles of the system
is pushed down to the vertex-type-level, allowing graph traversals to be 
maximally generic.

### Vertex Base

Properties:
* `name`: A unique string identifier for the vertex. User-defined vertex names 
  are not allowed to match a set of reserved names.
* `type`: A type annotation for the vertex, meaning that it should refer to some
  subtype of the base vertex.
* `in`: A list of *in*-edges to the vertex.
* `out`: A list of *out*-edges to the vertex.
* `dirty`: Represents whether `value` is based on outdated dependencies.

These properties are common to all vertices. In this sense, all vertices are
subtypes of this base, although OOP-style inheritance may not be made explicit.
Graph operations can assume these types to be present on all vertices, but must
inspect the type before using any others to ensure that they exist. 

### Module Vertex

Properties:
* `path`: The URL path for requesting the source of the module.
* `isLoaded`: A boolean property indicating whether the module has been loaded 
  and cached.

Represents a module, following much the same pattern as Common/Require. In this
case, `path` refers to the location of the module resource, and `isLoaded` 
refers to whether it has been loaded and cached. As is common in dependency 
injection, caching the module and loading it at-most-once is part of the 
semantics.

In this case, elements of the `in` list refer to dependencies of the module, and 
elements of the the `out` list refer to vertices which depend on this module.

TODO: Features like a base URL system, cache system, shim system and support for
modules defined in code rather than in separate scripts. Consider feature parity
with Common/Require.

### Event Vertex

Properties:
* `setup`: Function to wireup the event handler. Must be passed a callback which
  it can wire and, when invoked with event data, propagates it through the 
  graph.
* `invoked`: Represents the time of the most recent invocation of the event. 
  Carries the value of `null` if never invoked.
* `value`: Stores the event data resulting from the most recent invocation.
  Carries the value of `null` if never invoked.
* `default`: An optional value to use when the vertex has not been evaluated but 
  a dependent vertex needs its data. If this vertex is not evaluated AND does 
  not have a default, no dependent vertex can execute.

Represents an event. This should somewhat resemble the event system existing in 
vanilla JavaScript or in jQuery, although it is more general, and has explicit
dependencies. Multiple bindings are supported as fan out in the graph, rather
than a binding list.

In this case, elements of the `out` list refer to vertices which depend on this 
event. This is analogous to event bindings in other frameworks, but here we take
a rather different perspective. Instead of an function bound to an event, we 
can think of vertices of computation which depend on volatile data. Whenever the
event data changes, that computation is invalidated and must be redone. This is 
the case even when there is no event data --- dependent vertices simply depend
on a volatile unit value, such as `null`. This is a more-general perspective 
than vanilla JavaScript events because it allows us to reuse the same model when
we depend on synthetic data.

An important thing to note about the semantics of this vertex type is that when
a vertex depends on an event which has not evaluated, and which does not have a 
default, it cannot be run. This facility may be used to prevent certain vertices 
from executing.

Elements of the `in` list refer to dependencies of this event. This does not 
have an obvious analogue in the context of vanilla JavaScript events because an
event does not generally depend on data to execute.

### Synthetic Vertex

Properties:
* `func`: A function which accepts as arguments the values of its dependencies
  and yields an arbitrary synthesis of those values. The function may also 
  accept a callback argument which can be used to yield asynchronous results
  (e.g. when a return statement is impossible).
* `async`: A boolean representing whether the function is evaluated 
  asynchronously (i.e. uses a callback rather than a return statement).
* `callbackIndex`: An index used internally to indicate which argument position
  the callback function should be passed through.
* `invoked`: Represents the time of the most recent execution of the vertex. 
  Carries the value of `null` if never invoked.
* `updated`: Represents the time of the most recent change of the value.
* `value`: Stores the resulting synthetic data from the most recent invocation.
  Carries the value of `null` if never invoked.
* `default`: An optional value to use when the vertex has not been evaluated but 
  a dependent vertex needs its data. If this vertex is not evaluated AND does 
  not have a default, no dependent vertex can execute.

Represents a function which is able to synthesize any number of dependencies 
into a new value.

### Effect Vertex

Properties:
* `invoked`: Represents the time of the most recent execution of the vertex.
  Carries the value of null if never invoked.

An effect vertex represents a change made against the state of the document. As 
such, it does not yield data. Other vertices may depend on it being invoked.

An effect vertex can be identified by depending on state hooks, for example, it
may depend on the `document` object in order to commit effects on the DOM.

## Traversals

The computational semantics of cable can be described by two graph traversal 
algorithms. We refer to them as "down" and "up".

### Traverse Down

The down traversal is triggered on a vertex `v` (normally an event vertex), and 
expands along `out` edges, invalidating every vertex which depends on `v` 
(directly or indirectly).

  def DOWN(vertex):
    effects := []
    if CAN_GET_VALUE():
      value := GET_VALUE(vertex)
      if vertex.value != value:
        if vertex.type == 'effect':
          effects.add(vertex)
        endif
        for each v in vertex.out:
          effects.concat(DOWN(v))
        endfor
      else
      return effects
    else
      return []
    endif
  end

### Traverse Up

Up traversal is essentially a way of strictly evaluating vertices (i.e. forcing
execution).

The up traversal begins on a vertex (normally an effect vertex) and iterates over  
`in` edges to collect the data dependencies. When any of these dependencies is 
dirty, the traversal recurses on that vertex in order to fulfill the need for 
its data.

  def UP(vertex):
    stack := []
    stack.push(vertex)
    while stack is not empty:
      v := stack.peek()
      for each u in v.in:
        if IS_EVALUATED(u):
          stack.pop()
        else
          stack.push(u)
        endif
      endfor
    endwhile

    data := []
    for each u in vertex.in:
      data.add(GET_VALUE(u))
    endfor
    return data
  end

  def IS_EVALUATED(vertex):
    if vertex.type == module:
      return vertex.isLoaded
    elseif vertex.type == event:
      return vertex.invoked not null or vertex.default not null
    elseif vertext.type == synthetic:
      return vertex.invoked not null or vertex.default not null
    elseif vertex.type == effect:
      return vertex.invoked not null
    endif
  end

### Getting Values

  def GET_VALUE(vertex):
    if vertext.type == 'module':
      if module is loaded and cached:
        return cached module
      else
        load and cache module
        return loaded module
      endif
    else if vertex.type == 'event':
      if 
  end

