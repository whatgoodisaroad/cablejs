/*..............................................................................
.  Independent helpers. A set of tools for constructing the graph which do not
.  depend on any libraries.
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
  { init:{ type:"event", wireup:function(f) { f(new Date()); } } }, 
  { reify:false, wireup:false }
);

//  Experimental list modeling tool. A list is stored as state, but is 
//  interfaced via slicing as with regular JS arrays.
Cable.list = function(array) {
  return {
    array:Cable.data(array),
    main:Cable.data(
      { index:0, howMany:0, replacement:array }, 
      {
        splice:function(i, h, r) {
          this({ index:i, howMany:h, replacement:r });
        },
        prepend:function(e) {
          this({ index:0, howMany:0, replacement:[e] });
        },
        append:function(e) {
          this({ index:-1, howMany:0, replacement:[e] });
        },
        updateAt:function(index, replacement) {
          this({ index:index, howMany:1, replacement:[replacement] });
        }
      }
    ),
    updater:Cable.withArgs(["main", "_array"], function(main, _array) {
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
    })
  }
};

//  Create an interval event. The period can be supplied by either a number of 
//  milliseconds, or as the name of a cable which adjusts the period 
//  dynamically.
Cable.interval = function(period, triggerOnInit) {
  if (period.substring) {
    var args = ["ref", "_pid"];
    if (triggerOnInit) { 
      args = args.concat("init");
    }
    return {
      ref:Cable.reference(period),
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
