/*..............................................................................
.  Independent helpers. A set of tools for constructing the graph which do not .
.  depend on any libraries.                                                    .
..............................................................................*/

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
  
  return Cable.withArgs(aliases, fn);
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

Cable.repeat = function(interval, values) {
  return {
    interval:Cable.interval(interval),
    index:Cable.data(-1),
    increment:function(interval, _index) {
      _index((_index() + 1) % values.length);
    },
    main:function(index, result) {
      result(values[index()]);
    }
  };
};

//  View controller actions based on some router. The router argument should be
//  the name of a node which produces a stream of objects where each object has
//  two properties: controller and action. These are used to determine the 
//  action to invoke. A suitable router can be generated with Cable.router().
Cable.view = function(router, controllers) {

  //  The controllers object is a 2-layer nested object of controllers and 
  //  actions where each action is an effect function. We need to translate 
  //  these actions into defineable nodes. Each action depends on a "request"
  //  node. These nodes need to befined in the appropriate scope so that they
  //  trigger the correct action.

  var obj = { };

  //  For each controller:
  for (var controller in controllers) {
    if (controllers.hasOwnProperty(controller)) {
      obj[controller] = { };

      //  For each action in the controller.
      for (var action in controllers[controller]) {
        (function(controller, action) {

          obj[controller][action] = {

            //  Create a synthetic node which produces a result only when this
            //  action should be run.
            request:Cable.withArgs(
              [router, "respond"],
              function(route, respond) {
                if (
                  route().controller === controller && 
                  route().action === action
                ) {
                  respond(route());
                }
              }
            ),

            //  Define the action as an effect.
            main:controllers[controller][action]
          };

        })(controller, action);
      }
    }
  }

  return obj;
};
