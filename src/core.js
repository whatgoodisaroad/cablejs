var Cable = {};

var reserved = "result respond define type event".split(" ");

var graph = { };

function each(obj, fn) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      fn(obj[key], key);
    }
  }
};

//  Find the argument names of a function.
function getArgNames(fn) {
  if (fn.argAliases) {
    return fn.argAliases;
  }
  else {
    return (fn + "")
      .match(/^function(\s+\S*)?\(([^)]+)\)/)[2]
      .split(",")
      .map(function(x) { return x.replace(/(^\s+)|(\s+$)/g, ""); });
  }
}

//  Gets the list of properties which should be fed into the function as 
//  arguments. Essentially, this is the list of argument names excluding 
//  reserved words and with leading underscores removed. Each one should refer to 
//  a  extant node (contextualized).
function getFanIn(fn, context) {
  return getArgNames(fn)
    .filter(function(arg) {
      return reserved.indexOf(arg) == -1;
    })
    .map(function(arg) {
      return arg.replace(/^_/, "");
    });
}

//  Gets the list of nodes which are dependencies and which can trigger this 
//  node. In other words, it is the arguments excluding reserved words and arguments
//  with leading underscores.
function getDependencies(fn, context) {
  return getArgNames(fn)
    .filter(function(arg) {
      return reserved.indexOf(arg) == -1 && arg[0] != '_';
    });
}

// Via http://stackoverflow.com/a/7356528/26626
function isFunction(fn) {
  var getType = {};
  return fn && getType.toString.call(fn) === '[object Function]';
}

//  The test for whether a function represents a synthetic cable is whether it 
//  requests a result handler.
function isSynthetic(fn) {
  return (
    getArgNames(fn).indexOf("result") != -1 || 
    getArgNames(fn).indexOf("respond") != -1
  );
}

//  Return the first argument with overriden properties from the second 
//  argument. For example extend({ x:1, y:2 }, { y:3 }) === { x:1, y:3 } OR
//  extend({ x:1, y:2 }, { z:1000 }) === { x:1, y:2 }
function extend(defaults, override) {
  if (override) {
    var o = { };
    each(defaults, function(prop, name) {
      o[name] = override.hasOwnProperty(name) ? override[name] : prop;
    });
    return o;
  }
  else {
    return defaults;
  }
}

//  Definition function. Essentially this is the interface for cable.
Cable.define = function(object, options) {

  //  Get a complete options set.
  var options = extend(
    { reify:true, wireup:true, scope:{ chain:[] } },
    options
  );

  //  For each definition in the object, examine it's meaning/validity and defer 
  //  to the installation procedures as appropriate.
  each(object, function(cable, name) {

    //  Check wehether the name is valid:
    if (/^_/.test(name)) {
      throw "Illegal definition: names cannot begin with an underscore.";
    }
    if (reserved.indexOf(name) != -1) {
      throw "Illegal definition: " + name + " is a reserved word.";
    }
    if (graph.hasOwnProperty(name)) {
      throw "Illegal definition: " + name + " is already defined.";
    }

    //  Next: determine the type:
    var type = null;

    //  If it has an explicitly declared type, use it.
    if (cable.hasOwnProperty("type")) {
      type = cable.type;
    }

    //  Otherwise, it's a function and we must determine whether it's a 
    //  synthetic function (produces synthetic data) or an effect function 
    //  (causes a side effect externally to cable e.g. the DOM).
    else if (isFunction(cable)) {
      type = isSynthetic(cable) ? "synthetic" : "effect";
    }

    //  Otherwise, assume it's a subdefinition.
    else {
      type = "sub";
    }

    //  If a type was determined, and an installer exists for that type, install 
    //  it:
    if (install.hasOwnProperty(type)) {
      install[type](name, cable, options.scope);
    }
    else if (type !== "sub" && type !== "reference") {
      throw "Illegal definiton: could not determine meaning of " + name;
    }
  });

  if (options.reify) {
    reify();
  }

  if (options.wireup) {
    wireup();
  }
};

var install = {
  data:function(name, obj, scope) {
    graph[name] = {
      type:"data",
      value:obj.value,

      in:[],
      out:[],

      helpers:obj.helpers ? obj.helpers : { },

      scope:scope
    };
  },

  synthetic:function(name, fn, scope) {
    if (getArgNames(fn).indexOf("respond") != -1) {
      graph[name] = {
        type:"synthetic",
        fn:fn,

        value:null,
        invoked:false,

        in:getFanIn(fn, fn.context),
        out:[],

        resultIndex:getArgNames(fn).indexOf("respond"),

        scope:scope,
        coalesce:false
      };
    }
    else {
      graph[name] = {
        type:"synthetic",
        fn:fn,

        value:null,
        invoked:false,

        in:getFanIn(fn, fn.context),
        out:[],

        resultIndex:getArgNames(fn).indexOf("result"),

        scope:scope,
        coalesce:true
      };
    }
  },

  effect:function(name, fn, scope) {
    graph[name] = {
      type:"effect",
      fn:fn,

      in:getFanIn(fn, fn.context),
      out:[],

      scope:scope
    };
  },

  event:function(name, obj, scope) {
    graph[name] = {
      type:"event",
      value:obj.defaultValue,
      wireup:obj.wireup,
      isWiredUp:false,

      in:[],
      out:[],

      scope:scope
    };
  },

  library:function(name, obj, scope) {
    graph[name] = {
      type:"library",
      path:obj.path,
      shim:obj.shim,

      handle:null,
      loaded:false,

      scope:scope
    };
  },

  sub:function(name, obj, scope) {
    var newObj = { };

    // Find references:
    var references = { };
    each(obj, function(subobj, subname) {
      if (subobj.type === "reference") {
        references[subname] = subobj.referenceName;
      }
    });

    each(obj, function(subobj, subname) {
      var newName = subname === "main" ? name : name + "_" + subname;
      newObj[newName] = subobj;
    });

    Cable.define(
      newObj, { 
        reify:false, 
        wireup:false,
        scope:{
          chain:scope.chain.concat([ name ])
        }
      }
    );
  }
};

//  Take a scope chain and a name, and enumerate each possible namespace 
//  prefixed version of that name starting with the deepest. For example 
//  enumerateScopes(['x','y','z'], "w") === ["x_y_z_w", "x_y_w", "x_w"] OR
//  enumerateScopes(['x','y'], "main") === ["x_y", "x"]
function enumerateScopes(chain, name) {
  var 
    suffix = name === "main" ? "" : "_" + name,
    scopes = [];
  for (var idx = 0; idx < chain.length; ++idx) {
    scopes.push(chain.slice(0, chain.length - idx).join("_") + suffix);
  }
  scopes.push(name);
  return scopes;
}

//  Resolve the reference, If there is no apparent resolution, return null.
function resolve(name, scope) {
  var names = enumerateScopes(scope.chain, name);
  for (var idx = 0; idx < names.length; ++idx) {
    if (graph.hasOwnProperty(names[idx])) {
      return names[idx];
    }
  }
  return null;
}

//  Reify the graph. The graph is an object of cable definitions. This expresses
//  a graph in two subtly different ways. If we let each definition be a vertex
//  they each have fan-in and fan-out defined in their in and out properties 
//  respectively, however these do not necessarily express the same graph, 
//  because whereas in enumerates how to construct arguments for the node, out
//  enumerates which nodes can be subsequently triggered by that node and not
//  necessarily all of the nodes which it fans into.
// 
//  Because of this asymmetry, we only need to reify the out-graph. This can be
//  done by wiping every out list and reconstructing it by looping over every 
//  node and allowing them to append their name to any other node's out list.
//
//  If there is no internal consistency (e.g. a node refers to a node that does
//  not (or does not *yet*) exist), an exception will be thrown. If one is 
//  defining intermediate graphs, one should hold of on reifying it until 
//  consistency is expected. This is the reason that sub-definitions are 
//  installed with reification disabled in Cable.define.
function reify() {

  //  Pass 1: Clean all objects
  each(graph, function(node) {
    node.out = [];
  });

  //  Pass 2: Append dependencies
  each(graph, function(node, nodeName) {

    //  Dependencies can only be needed when a function is present.
    if (node.fn) {

      //  For each dependency
      getDependencies(node.fn, node.context).forEach(function(depName) {

        //  Here we need to determine the fully qualified namespaced name of the
        //  dependency in order to add our name to its list.

        var qname = resolve(depName, node.scope);

        //  If it resolved:
        if (qname) {
          graph[qname].out.push(nodeName);
        }

        //  Otherwise it's a bad reference:
        else {
          function showContext(context) {
            var refs = [];
            each(context.references, function(ref, name) {
              refs.push("'" + name + "' ==> '" + ref + "'");
            })
            return (
              "named '" + context.name + "'" + 
              " and references {" + 
              refs.join(", ") +
              "}"
            );
          }

          throw "Reference to undefined node '" +
            depName +
            "' as dependency of '" +
            nodeName +
            "'" + 
            (node.hasOwnProperty("context") ?
              " in context " + showContext(node.context) :
              "");
        }
      });
    }

  });
}

function wireup() {
  each(graph, function(node, nodeName) {
    if (node.type === "event" && !node.isWiredUp) {
      node.wireup(function(value) {
        yield(nodeName, function(setter) {
          setter(value);
        });
      });
      node.isWiredUp = true;
    }
  });
}

var yields = {
  data:function(name, fn) {
    var access = function() {
      if (!arguments.length) {
        return graph[name].value;
      }
      else if (arguments[0] != graph[name].value) {
        graph[name].value = arguments[0];
        triggerDownstream(name);
      }
    };

    each(graph[name].helpers, function(helper, helpName) {
      access[helpName] = function() {
        return helper.apply(
          access, 
          arguments
        );
      };
    });

    fn(access);
  },

  synthetic:function(name, fn) {
    fn(function() {
      return graph[name].value;
    });
  },

  effect:function() { /* Do anything here? */ },

  event:function(name, fn) {
    fn(function() {
      if (!arguments.length) {
        return graph[name].value;
      }
      else if (arguments[0] != graph[name].value || !graph[name].coalesce) {
        graph[name].value = arguments[0];
        triggerDownstream(name);
      }
    });
  },

  library:function(name, fn) {
    if (graph[name].loaded) {
      fn(graph[name].handle);
    }
    else {
      evaluate(name, function() {
        yield(name, fn);
      });
    }
  }
};

function yield(name, fn) {
  if (graph.hasOwnProperty(name)) {
    yields[graph[name].type](name, fn);
  }
  else {
    throw "Cannot yield: '" + name + "' is not defined";
  }
}

Cable.yield = yield;

function yieldAll(names, fn, prefix) {
  if (prefix === undefined) { prefix = []; }

  if (!names.length) {
    fn(prefix);
  }
  else {
    yield(names[0], function(value) {
      yieldAll(names.slice(1), fn, prefix.concat([ value ]));
    });
  }
}

function yieldIn(name, fn) {
  var resolved = graph[name].in.map(function(dep) {
    return resolve(dep, graph[name].scope);
  });

  yieldAll(resolved, fn);
}

function evaluate(name, fn) {
  evaluators[graph[name].type](name, fn);
}

var evaluators = {
  data:yield.data,
  event:yield.event,

  synthetic:function(name, fn) {
    yieldIn(name, function(deps) {

      deps.splice(graph[name].resultIndex, 0, function(result) {

        if (graph[name].value != result || !graph[name].coalesce) {
          graph[name].value = result;
          graph[name].invoked = true;
          triggerDownstream(name);
        }

        fn();
      });

      graph[name].fn.apply({ }, deps);
    });
  },

  effect:function(name, fn) {
    yieldIn(name, function(deps) {
      graph[name].fn.apply({ }, deps);
      fn();
    });
  },

  library:function(name, fn) {
    if (graph[name].loaded) {
      fn();
      return;
    }

    var define = function() {
      var idx = arguments.length - 1;

      if (isFunction(arguments[idx])) {
        graph[name].handle = arguments[idx]();
      }
      else {
        graph[name].handle = arguments[idx];
      }

      graph[name].loaded = true;
    };

    define.amd = {};

    var req = new XMLHttpRequest();

    req.onreadystatechange = function() {
      if (this.readyState === 4 && this.status === 200) {
        var source = this.responseText;

        if (graph[name].shim) {
          source = [
            "define(function() {", source, "\nreturn ", graph[name].shim, "; });"
          ].join("");
        }

        window.define = define;
        eval(source);
        delete window.define;

        if (name === "$" && $ && $.noConflict) { $.noConflict(); }

        fn();
      }
    }

    req.open("get", graph[name].path, true);
    req.send();
  }
};

function trigger(name) {
  evaluate(name, function() { });
}

function triggerDownstream(name) {
  graph[name].out.forEach(trigger);
}
