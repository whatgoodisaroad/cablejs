var Cable = {};

var keywords = "result define type event".split(" ");

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
        return context.name;
      }
      else if (context.references.hasOwnProperty(arg)) {
        return context.references[arg];
      }
      else {
        return context.name + "_" + arg;
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
        return context.name;
      }
      else if (context.references.hasOwnProperty(arg)) {
        return context.references[arg];
      }
      else {
        return context.name + "_" + arg;
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

      // Find references:
      var references = { };
      each(cable, function(subobj, subname) {
        if (subobj.type === "reference") {
          references[subname] = subobj.referenceName;
        }
      });

      each(cable, function(subobj, subname) {
        var newName = subname === "main" ? name : name + "_" + subname;
        newObj[newName] = subobj;
        newObj[newName].context = { name:name, references:references };
      });
      Cable.define(newObj, true);
    }

    if (install.hasOwnProperty(type)) {
      install[type](name, cable);
    }
    else if (type !== "sub" && type !== "reference") {
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

      resultIndex:getArgNames(fn).indexOf("result"),

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
      value:obj.defaultValue,

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
        //  If it's a regular reference to an extant property:
        if (graph.hasOwnProperty(depName)) {
          graph[depName].out.push(nodeName);
        }

        //  If it's a contextualized 'main' reference:
        else if ( node.hasOwnProperty("context") &&
                  depName === "main" &&
                  graph.hasOwnProperty(node.context.name)) {
          graph[node.context.name].out.push(nodeName);
        }

        //  If it's a simple contextualized reference:
        else if ( node.hasOwnProperty("context") &&
                  graph.hasOwnProperty(node.context.name + "_" + depName)) {
          graph[node.context.name + "_" + depName].out.push(nodeName);
        }
        
        //  If it's a contextualized reference in a reference map:
        else if ( node.hasOwnProperty("context") &&
                  node.context.hasOwnProperty(depName) &&
                  graph.hasOwnProperty(node.contex.references[depName])) {
          graph[depName].out.push(node.contex.references[depName]);
        }

        //  Otherwise, it looks like the reference is bad:
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

        if (graph[name].value != result) {
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

Cable.event = function(selector, events, property, triggerOnLoad) {
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

        if (triggerOnLoad) {
          if (property === "value") {
            fn($(selector).val());
          }
          else if (property === "time") {
            fn(new Date());
          }
        }
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
      },
      prepend:function(e) {
        return { index:0, howMany:0, replacement:e };
      },
      append:function(e) {
        return { index:-1, howMany:0, replacement:e };
      },
      updateAt:function(index, replacement) {
        return { index:index, howMany:1, replacement:replacement };
      }
    }),
    updater:function(main, _array) {
      var 
        s = main(),
        a = _array().slice(0);

      if (s.index >= 0) {
        a.splice(s.index, s.howMany, s.replacement);
      }
      else {
        a.splice(a.length - s.index, s.howMany, s.replacement);
      }
      _array(a);
    }
  };
};

Cable.interval = function(period) {
  if (period.substring) {
    return {
      ref:Cable.reference(period),
      pid:Cable.data(-1),
      main:function(ref, _pid, result) {
        clearInterval(_pid());
        var newPid = setInterval(
          function() { result(new Date()); },
          ref()
        );

        _pid(newPid);
      }
    };
  }
  else {
    return {
      type:"event",
      wireup:function(fn) {
        setInterval(fn, period);
      }
    };
  }
};

Cable.reference = function(name) {
  return { type:"reference", referenceName:name };
};

Cable.library = function(path, shim) {
  return {
    type:"library",
    path:path,
    shim:shim
  }
};
