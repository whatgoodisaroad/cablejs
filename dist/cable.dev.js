/*.......................................
. cablejs: By Wyatt Allen, MIT Licenced .
. 2014-04-08T21:28:44.505Z              .
.......................................*/
"use strict";

var Cable = {};

if (typeof module === "object" && typeof module.exports === "object") {
  Cable._private = {};
  module.exports = Cable;
}

(function() {

var reserved = "result respond type event define".split(" ");

var graph = { };

Cable._debug = function() { return graph; };

//  Safely loop over an object's properties.
function each(obj, fn) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      fn(obj[key], key);
    }
  }
};
Cable.each = each;

//  Find the argument names of a function.
function getArgNames(fn) {
  if (fn.argAliases) {
    return fn.argAliases;
  }
  else {
    return (fn + "")
      .match(/^function(\s*)?\(([^)]*)\)/m)[2]
      .split(",")
      .map(function(x) { return x.replace(/(^\s+)|(\s+$)/g, ""); });
  }
}

//  Gets the list of properties which should be fed into the function as 
//  arguments. Essentially, this is the list of argument names excluding 
//  reserved words and with leading underscores removed. Each one should refer 
//  to an existing node
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
//  node. In other words, it is the arguments excluding reserved words and 
//  arguments with leading underscores.
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

function isSubDefinition(fn) {
  return getArgNames(fn).indexOf("define") !== -1;
}

function isEvent(fn) {
  var args = getArgNames(fn);
  return args.length === 1 && args[0] === "event";
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
      if (isSynthetic(cable)) {
        type = "synthetic";
      }
      else if (isSubDefinition(cable)) {
        type = "subdefinition";
      }
      else if (isEvent(cable)) {
        type = "event";
        cable = { type:"event", wireup:cable };
      }
      else {
        type = "effect";
      }
    }

    //  Otherwise, assume it's a scoped definition.
    else {
      type = "scope";
    }

    //  If a type was determined, and an installer exists for that type, install 
    //  it:
    if (install.hasOwnProperty(type)) {
      install[type](name, cable, options.scope);
    }
    else {
      throw "Illegal definiton: could not determine meaning of " + name;
    }
  });

  //  If we are reifying, the modules have to be evaluated first.
  if (options.reify || options.wireup) {
    loadModules(function() {
      if (options.reify) {
        reify();

        executeSubdefinitions();

        reify();
      }
      if (options.wireup) {
        wireup();
      }
    });
  }
};

//  Evaluate the modules, and invoke a callback when they are done.
function loadModules(fn) {

  //  Find the names of the modules in the graph.
  var modules = [];
  for (var name in graph) {
    if (graph.hasOwnProperty(name) && graph[name].type === "module") {
      modules.push(name);
    }
  }

  //  Given a list of names, recursively, asynchronously load them all in 
  //  sequence.
  function loadAll(names) {
    if (names.length) {
      var name = names[0];

      var req = new XMLHttpRequest();

      req.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
          var text = "(" + this.responseText + ")";

          //  We now have the sourcecode for the module. The module in the 
          //  graph acts as a placeholder. We need to substitute it with the 
          //  source code. This means deleting the placeholder and then defining
          //  the source under the same name.

          //  Remove:
          delete graph[name];

          //  Define:
          var obj = { };
          try {
            obj[name] = eval(text);
          }
          catch (exc) {
            throw "Failed to load module '" + name + "': " + exc;
          }
          Cable.define(obj, { reify:false, wireup:false });

          //  Recurse:
          loadAll(names.slice(1));
        }
      }

      req.open("get", graph[name].url, true);
      req.send();
    }
    else {
      fn();
    }
  }

  loadAll(modules);
}

//  A collection of installer functions for each type of node. The type can be 
//  determined up-front, but a apecialized installer creates the actual node for
//  the graph.
var install = {
  data:function(name, obj, scope) {
    graph[name] = {
      type:"data",
      value:obj.value,

      "in":[],
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

        "in":getFanIn(fn, fn.context),
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

        "in":getFanIn(fn, fn.context),
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

      "in":getFanIn(fn, fn.context),
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
      invoked:false,

      "in":[],
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

  scope:function(name, obj, scope) {

    var newObj = { };

    each(obj, function(subobj, subname) {
      var newName = subname === "main" ? name : name + "_" + subname;
      newObj[newName] = subobj;
    });

    var namespace = scope.chain.map(function(n) { return n + "_"; }).join("_");

    var newChain = scope.chain.concat([ name.slice(namespace.length) ]);

    Cable.define(
      newObj, { 
        reify:false, 
        wireup:false,
        scope:{
          chain:newChain
        }
      }
    );
  },

  subdefinition:function(name, fn, scope) {
    graph[name] = {
      type:"subdefinition",
      in:getFanIn(fn),
      fn:fn,
      scope:scope,
      defineIndex:getArgNames(fn).indexOf("define")
    };
  },

  module:function(name, obj, scope) {
    graph[name] = {
      type:"module",
      url:obj.url,
      scope:scope
    };
  },

  alias:function(name, obj, scope) {
    graph[name] = {
      type:"alias",
      reference:obj.reference,
      scope:scope
    };
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
      if (graph[names[idx]].type === "alias") {
        var alias = graph[names[idx]];
        return resolve(alias.reference, alias.scope);
      }
      else {
        return names[idx];
      }
    }
  }
  return null;
}

//  Reify the graph. This basically takes the form of updating the out-links for
//  each node. Since the in-links can be determined at definition, they are left
//  as they are. The out links are constructed by erasing all out links, and
//  progressively reinstating them for each node's in-links.
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
          throw "Reference to undefined node '" +
            depName +
            "' as dependency of '" +
            nodeName +
            "'";
        }
      });
    }

  });
}

function executeSubdefinitions() {
  each(graph, function(node, nodeName) {
    if (node.type === "subdefinition") {
      if (allDependenciesAreLibraries(nodeName)) {
        generateIn(nodeName, function(deps) {
          deps.splice(node.defineIndex, 0, function(obj) {
            var def = {};
            def[nodeName] = obj;
            Cable.define(def, { scope:node.scope });
          });

          delete graph[nodeName];
          
          node.fn.apply(window, deps);
        });
      }

      else {
        throw "Illegal subdefinition: " + 
          nodeName + 
          ". Subdefs must depend only on libraries";
      }
    }
  });
}

//  For each event node on the graph which is not wired up, wire it.
function wireup() {
  each(graph, function(node, nodeName) {
    if (node.type === "event" && !node.isWiredUp) {
      var eventFn = function(value) {
        generate(nodeName, function(setter) {
          setter(value);
        });
      };

      eventFn.setDefault = function(value) {
        node.value = value;
      };

      node.wireup(eventFn);
      node.isWiredUp = true;
    }
  });
}

//  A collection of generator functions for each type of node. The generateed 
//  value of a node is the value which shold be provided to dependent functions. 
//  For example, for libraries, it's a the library itself. For events, it's a 
//  getter/setter. For synthetics, it's a getter. Etc.
var generators = {
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
    if (!graph[name].invoked) {
      evaluate(name, function() { });
    }
    else {
      fn(function() {
        return graph[name].value;
      });
    }
  },

  effect:function() { /* Do anything here? */ },

  event:function(name, fn) {
    fn(function() {
      if (!arguments.length) {
        return graph[name].value;
      }
      else if (arguments[0] != graph[name].value || !graph[name].coalesce) {
        graph[name].invoked = true;
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
        generate(name, fn);
      });
    }
  }
};

//  Generic generate function. Determines the type of the node and dispatches 
//  accordingly.
function generate(name, fn) {
  if (graph.hasOwnProperty(name)) {
    generators[graph[name].type](name, fn);
  }
  else {
    throw "Cannot generate: '" + name + "' is not defined";
  }
}

function generateAll(names, fn, prefix, overrides) {
  if (prefix === undefined) { prefix = []; }

  if (!names.length) {
    fn(prefix);
  }
  else if (overrides && overrides.hasOwnProperty(names[0])) {
    generateAll(
      names.slice(1), 
      fn, 
      prefix.concat([ overrides[names[0]] ]),
      overrides
    );
  }
  else {
    generate(names[0], function(value) {
      generateAll(
        names.slice(1), 
        fn, 
        prefix.concat([ value ]),
        overrides
      );
    });
  }
}

function generateIn(name, fn) {
  var resolved = graph[name]["in"].map(function(dep) {
    return resolve(dep, graph[name].scope);
  });

  generateAll(resolved, fn);
}

function evaluate(name, fn) {
  evaluators[graph[name].type](name, fn);
}

var evaluators = {
  data:generate.data,
  event:generate.event,

  synthetic:function(name, fn) {
    generateIn(name, function(deps) {

      deps.splice(graph[name].resultIndex, 0, function(result) {

        graph[name].invoked = true;

        if (graph[name].value != result || !graph[name].coalesce) {
          graph[name].value = result;
          triggerDownstream(name);
        }

        fn();
      });

      graph[name].fn.apply({ }, deps);
    });
  },

  effect:function(name, fn) {
    generateIn(name, function(deps) {
      graph[name].fn.apply({ }, deps);
      fn();
    });
  },

  library:function(name, fn) {
    if (graph[name].loaded) {
      fn();
      return;
    }

    //  Create a define function according to the AMD spec:
    var define = function() {

      //  Because the id and dependencies arguments are optional, and because
      //  the factory can be either a function or an object, we need to 
      //  normalize the arguments.
      var 
        id,
        dependencies,
        factory,
        exports = { },
        argpos = 0;

      //  If there is a module id.
      if (arguments[argpos].substring) {
        id = arguments[argpos++];
      }
      else { 
        id = name;
      }
      
      //  If there is a dependency list.
      if (arguments[argpos].splice) {
        dependencies = arguments[argpos++];
      }
      else {
        dependencies = [ "require", "exports", "module" ];
      }

      //  If there is a factory function/object:

      //  If it's a function:
      if (isFunction(arguments[argpos])) {
        var factoryFunction = arguments[argpos];

        if (dependencies.indexOf("exports") !== -1) {
          factory = function() {
            var ret = factoryFunction.apply(window, arguments);
            return ret !== undefined ? ret : exports;
          };
        }
        else {
          factory = factoryFunction;
        }
      }

      //  It's an object.
      else {
        var factoryObject = arguments[argpos]
        factory = function() { 
          return factoryObject; 
        };
      }

      //  The arguments and factory are normalzed, we can invoke the factory.
      generateAll(
        dependencies, 
        function(values) {
          graph[name].handle = factory.apply(window, values);
          graph[name].loaded = true;
          fn();
        },
        [],
        { 
          require:function() { 
            throw "Cable.js AMD loader does not support CommonJS style require.";
          },
          exports:exports,
          module:null
        }
      );
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
        try {
          eval(source);
        }
        catch(exc) {
          throw "Failed evaluating library " + name + ": " + exc;
        }
        delete window.define;

        if (name === "$" && $ && $.noConflict) { 
          $.noConflict();
        }
      }
    }

    req.open("get", graph[name].path, true);
    req.send();
  }
};

function trigger(name) {
  evaluate(name, function() { });
}

function allDependenciesEvaluated(name) {
  var deps = graph[name]["in"].map(function(dep) {
    return resolve(dep, graph[name].scope);
  });

  for (var idx = 0; idx < deps.length; ++idx) {
    if (graph[deps[idx]].type === "event" && !graph[deps[idx]].invoked) {
      return false;
    }
  }

  return true;
}

function allDependenciesAreLibraries(name) {
  return graph[name]["in"]
    .map(function(dep) {
      return graph[resolve(dep, graph[name].scope)].type === "library";
    })
    .reduce(function(a, b) { return a && b; });
}

function triggerDownstream(name) {
  graph[name].out.forEach(trigger);
}

Cable.initialize = function(name, value) {
  if (graph[name].type === "synthetic") {
    graph[name].value = value;
    graph[name].invoked = true;
  }
};

if (Cable._private) {
  Cable._private = {
    getArgNames:getArgNames
  };
}

})();

//  Declare argument names for a function. This is useful for when the 
//  dependencies of a cable are generated dynamically, or when the code is run 
//  through a minifier which does renaming.
Cable.withArgs = function(args, fn) {
  fn.argAliases = args;
  return fn;
};

//  Declare an element of state to be managed in the graph. Pass it an initial
//  value and an optional set of data helpers.
Cable.data = function(value, helpers) {
  var obj = { type:"data", value:value };
  if (helpers) {
    obj.helpers = helpers;
  }
  return obj;
};

//  Declare the init event. This is an event which fires as soon as it is wired.
//  Can be used as a dependency for functions which should be run when the page 
//  loads.
Cable.define(
  { init:Cable.withArgs(["event"], function(event) { event(new Date()); }) }, 
  { reify:false, wireup:false }
);

//  Experimental list modeling tool. A list is stored as state, but is 
//  interfaced by deltas.
Cable.list = function(array) {
  return {
    array:Cable.data(array),
    main:Cable.data(
      { type:"initialize", array:array }, 
      {
        insertAt:function(index, e) {
          this({ type:"insert", index:index, element:e });
        },
        prepend:function(e) {
          this({ type:"insert", index:0, element:e });
        },
        append:function(e) {
          this({ type:"insert", index:-1, element:e });
        },
        updateAt:function(index, updates) {
          this({ type:"update", index:index, updates:updates });
        },
        deleteAt:function(index) {
          this({ type:"delete", index:index });
        }
      }
    ),
    updater:Cable.withArgs(["main", "_array"], function(main, _array) {
      var 
        m = main(),
        a = _array().slice(0);

      if (m.type === "insert") {
        a.splice(m.index >= 0 ? m.index : a.length, 0, m.element);
      }
      else if (m.type === "update") {
        for (var k in m.updates) {
          if (m.updates.hasOwnProperty(k)) {
            a[m.index][k] = m.updates[k];
          }
        }
      }
      else if (m.type === "delete") {
        a.splice(m.index, 1);
      }
      
      _array(a);
    })
  }
};

//  Create an interval event. The period can be supplied by either a number of 
//  milliseconds, or as the name of a cable which adjusts the period 
//  dynamically.
Cable.interval = function(period, triggerOnInit) {
  if (period.substring) {
    var args = [period, "_pid"];
    if (triggerOnInit) { 
      args = args.concat("init");
    }
    return {
      pid:Cable.data(-1),
      main:Cable.withArgs(args, function(ref, _pid, result) {
        clearInterval(_pid());
        var newPid = setInterval(
          function() { result(new Date()); },
          ref()
        );
        _pid(newPid);
      })
    };
  }
  else {
    return {
      type:"event",
      defaultValue:new Date(),
      wireup:function(fn) {
        setInterval(function() { fn(new Date()); }, period);

        if (triggerOnInit) {
          fn(new Date());
        }
      }
    };
  }
};

//  Declare a library to import.
Cable.library = function(path, shim) {
  return {
    type:"library",
    path:path,
    shim:shim
  }
};

Cable.module = function(url) {
  return {
    type:"module",
    url:url
  }
};

//  Unify a set of cables into one.
Cable.pack = function(args) {
  var fn = function (result) {
    var obj = { };
    for (var idx = 1; idx < fn.argAliases.length; ++idx) {
      obj[fn.argAliases[idx]] = arguments[idx]();
    }
    result(obj);
  };

  var aliases = args.slice(0);
  aliases.splice(0, 0, "result");
  fn.argAliases = aliases

  return fn;
};

//  Declare a stateful integer counter, Useful for creating unique ids on the 
//  fly.
Cable.counter = function() {
  return Cable.data(-1, {
    next:function() {
      var n = this() + 1;
      this(n);
      return n;
    }
  });
};

Cable.alias = function(ref) {
  return {
    type:"alias",
    reference:ref
  };
};

//  Lift a textbox into the graph.
Cable.textbox = function(selector) {
  return Cable.withArgs(["$", "define"], function($, define) {
    define(Cable.withArgs(["event"], function(event) {
      var obj = $(selector);

      var getter = function() {
        if (obj.is("[type='number']")) {
          return parseFloat(obj.val());
        }
        else {
          return obj.val();
        }
      };

      obj.on("change keyup", function() {
        event(getter());
      });
      event(getter());
    }));
  });
};

Cable.checkbox = function(selector) {
  return Cable.withArgs(["$", "define"], function($, define) {
    var box = $(selector);
    define(Cable.withArgs(["event"], function(event) {
      box.on("change", function() {
        event(box.is(":checked"));
      });
      event(box.is(":checked"));
    }));
  });
};

Cable.button = function(selector) {
  return Cable.withArgs(["$", "define"], function($, define) {
    define(Cable.withArgs(["event"], function(event) {
      $(selector).on("click", function() {
        event(new Date());
      });
    }));
  });
};

Cable.returnKey = function(selector) {
  return Cable.withArgs(["$", "define"], function($, define) {
    define({
      type:"event",
      wireup:function(fn) {
        $(selector).on("keyup", function(evt) {
          if (evt.keyCode === 13) {
            fn(new Date());
          }
        });
      }
    });
  });
};

Cable.template = function(selector, template) {
  var
    reg = /\{\{[_a-zA-Z0-9]+\}\}/g,
    match = template.match(reg) || [],
    deps = match.map(function(m) { return m.replace(/\{|\}/g, ""); });

  var obj =  {
    properties:Cable.pack(deps),
    main:Cable.withArgs(["properties", "$"], function(properties, $) {

      function disp(v) {
        if (typeof(v) === "number") {
          return v.toFixed(2);
        }
        else {
          return v;
        }
      }

      var rend = template;
      for (var idx = 0; idx < deps.length; ++idx) {
        rend = rend.replace(
          "{{" + deps[idx] + "}}", 
          disp(properties()[deps[idx]])
        );
      }

      $(selector).html(rend);
    })
  };

  return obj;
};

Cable.json = function(fn) {
  return {
    url:fn,
    main:Cable.withArgs(["$", "url", "result"], function($, url, result) {
      var cdr = /^http/.test(url()) && !/callback=/.test(url());

      $.ajax({
        dataType: "json",
        url: url(),
        crossDomain:!!cdr,
        success: function(data) {
          result(data);
        }
      });
    })
  };
};

Cable.text = function(url) {
  return Cable.withArgs(["$", "result"], function($, result) {
    $.ajax({ 
      url:url,
      dataType:"text",
      success:function(text) { 
        result(text); 
      }
    });
  });
};

Cable.decorators = function() {
  return Cable.withArgs(["$", "define"], function($, define) {
    var def = {};

    $("[cable]").each(function(i, e) {
      if ($(e).is(":text")) {
        def[e.id] = Cable.textbox("#" + e.id);
      }
      else {
        def[e.id] = Cable.template("#" + e.id, e.innerText);
      }
    });

    define(def);
  });
};
