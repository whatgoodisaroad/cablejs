var Cable = {};

var keywords = "result define type".split(" ");

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
  return (fn + "")
    .match(/^function(\s+\S*)?\(([^)]+)\)/)[2]
    .split(",")
    .map(function(x) { return x.replace(/(^\s+)|(\s+$)/g, ""); });
}

function getFanIn(fn, context) {
  var result = getArgNames(fn)
    .filter(function(arg) {
      return keywords.indexOf(arg) == -1;
    })
    .map(function(arg) {
      return arg.replace(/^_/, "");
    });

  if (context) {
    result = result.map(function(arg) {
      if (arg === "main") {
        return context;
      }
      else {
        return context + "_" + arg;
      }
    });
  }

  return result;
}

function getDependencies(fn, context) {
  var result = getArgNames(fn)
    .filter(function(arg) {
      return keywords.indexOf(arg) == -1 && arg[0] != '_';
    });

  if (context) {
    result = result.map(function(arg) {
      if (arg === "main") {
        return context;
      }
      else {
        return context + "_" + arg;
      }
    });
  }

  return result;
}

// Via http://stackoverflow.com/a/7356528/26626
function isFunction(fn) {
  var getType = {};
  return fn && getType.toString.call(fn) === '[object Function]';
}

//  The test for whether a function represents a synthetic cable is whether it 
//  requests a result handler.
function isSynthetic(fn) {
  return getArgNames(fn).indexOf("result") != -1;
}

Cable.define = function(object, noReify) {
  each(object, function(cable, name) {
    if (/^_/.test(name)) {
      throw "Illegal definition: names cannot begin with an underscore.";
    }

    if (keywords.indexOf(name) != -1) {
      throw "Illegal definition: " + name + " is a reserved word.";
    }

    if (graph.hasOwnProperty(name)) {
      throw "Illegal definition: " + name + " is already defined.";
    }

    var type = null;

    if (cable.hasOwnProperty("type")) {
      type = cable.type;
    }
    else if (isFunction(cable)) {
      type = isSynthetic(cable) ? "synthetic" : "effect";
    }
    else {
      type = "sub";
      var newObj = { };
      each(cable, function(subobj, subname) {
        var newName = subname === "main" ? name : name + "_" + subname;
        newObj[newName] = subobj;
        newObj[newName].context = name;
      });
      Cable.define(newObj, true);
    }

    if (install.hasOwnProperty(type)) {
      install[type](name, cable);
    }
    else if (type !== "sub") {
      throw "Illegal definiton: could not determine meaning of " + name;
    }
  });

  reify();
};

var install = {
  data:function(name, obj) {
    graph[name] = {
      type:"data",
      value:obj.value,

      in:[],
      out:[],

      helpers:obj.helpers ? obj.helpers : { },

      context:obj.context
    };
  },

  synthetic:function(name, fn) {
    graph[name] = {
      type:"synthetic",
      fn:fn,

      value:null,
      invoked:false,

      in:getFanIn(fn, fn.context),
      out:[],

      resultIndex:getFanIn(fn).indexOf("result"),

      context:fn.context
    };
  },

  effect:function(name, fn) {
    graph[name] = {
      type:"effect",
      fn:fn,

      in:getFanIn(fn, fn.context),
      out:[]
      ,

      context:fn.context
    };
  },

  event:function(name, obj) {
    graph[name] = {
      type:"event",
      value:null,

      in:[],
      out:[],

      context:obj.context
    };

    obj.wireup(function(value) {
      yield(name, function(setter) {
        setter(value);
      });
    });
  },

  library:function(name, obj) {
    graph[name] = {
      type:"library",
      path:obj.path,
      shim:obj.shim,

      handle:null,
      loaded:false
    };
  }
};

function reify() {
  //  Pass 1: Clean all objects
  each(graph, function(node) {
    node.out = [];
  });

  //  Pass 2: Append dependencies
  each(graph, function(node, nodeName) {
    if (node.fn) {
      getDependencies(node.fn, node.context).forEach(function(depName) {
        if (graph.hasOwnProperty(depName)) {
          graph[depName].out.push(nodeName);
        }
        else if ( node.hasOwnProperty("context") &&
                  graph.hasOwnProperty(node.context + "_" + depName)) {
          graph[node.context + "_" + depName].out.push(nodeName);
        }
        else if ( node.hasOwnProperty("context") &&
                  depName === "main" &&
                  graph.hasOwnProperty(node.context)) {
          graph[node.context].out.push(nodeName);
        }
        else {
          throw "Reference to undefined node '" +
            depName +
            "' as dependency of '" +
            nodeName +
            "'" + 
            (node.hasOwnProperty("context") ?
              " in context '" + node.context + "'" :
              "");
        }
      });
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
        access(
          helper.apply(
            graph[name].value, 
            arguments
          )
        );
      };
    });

    fn(access);
  },

  synthetic:function(name, fn) {
    if (graph[name].invoked) {
      fn(graph[name].value);
    }
    else {
      throw "TODO: invoke synthetic";
    }
  },

  effect:function() { /* Do anything here? */ },

  event:function(name, fn) {
    fn(function() {
      if (!arguments.length) {
        return graph[name].value;
      }
      else if (arguments[0] != graph[name].value) {
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
  yields[graph[name].type](name, fn);
}

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

function evaluate(name, fn) {
  evaluators[graph[name].type](name, fn);
}

var evaluators = {
  data:yield.data,
  event:yield.event,

  synthetic:function(name, fn) {
    yieldAll(graph[name].in, function(deps) {
      deps.splice(graph[name].resultIndex, 0, function(result) {
        graph[name].value = result;
        fn();
      });

       graph[name].fn.apply({ }, deps);
    });
  },

  effect:function(name, fn) {
    yieldAll(graph[name].in, function(deps) {
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




// Helpers
////////////////////////////////////////////////////////////////////////////////

Cable.data = function(value, helpers) {
  var obj = { type:"data", value:value };
  if (helpers) {
    obj.helpers = helpers;
  }
  return obj;
};

Cable.event = function(selector, events, property) {
  return { 
    type:"event",
    wireup:function(fn) {
      yield("$", function($) {
        $(selector).on(events, function() {
          var val = null;

          if (property === "value") {
            val = $(selector).val();
          }
          else if (property === "time") {
            val = new Date();
          }

          fn(val);
        });
      });
    }
  };
};

Cable.list = function(array) {
  return {
    array:Cable.data(array),
    main:Cable.data(null, {
      splice:function(i, h, r) {
        return { index:i, howMany:h, replacement:r };
      }
    }),
    updater:function(main, _array) {
      var s = main();

      var a = _array().slice(0);
      a.splice(s.index, s.howMany, s.replacement);
      _array(a);
    }
  };
};

Cable.interval = function(ms) {
  return {
    type:"event",
    wireup:function(fn) {
      setInterval(fn, ms);
    }
  };
};

Cable.library = function(path, shim) {
  return {
    type:"library",
    path:path,
    shim:shim
  }
};
