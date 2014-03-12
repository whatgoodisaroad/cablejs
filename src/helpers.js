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
    coalesce:false,
    wireup:function(fn) {
      Cable.yield("$", function($) {
        if (selector === "document" && events === "ready") {
          $(document).ready(fn);
        }
        else {
          var 
            getter = function() {
              var 
                val = null,
                obj = $(selector);

              if (!property) {
                property = "time";
              }

              if (property === "value") {
                val = obj.val();
              }
              else if (property === "time") {
                val = new Date();
              }
              else if (/^data-[-_a-zA-Z0-9]+/.test(property)) {
                val = obj.attr(property);
              }

              fn(val);
            },

            handler;

          if (events === "key-return") {
            events === "keyup";
            handler = function(evt) {
              if (evt.keyCode === 13) {
                getter();
              }
            };
          }
          else {
            handler = getter;
          }

          $(document).on(events, selector, handler);

          if (triggerOnLoad) {
            getter();
          }
        }
      });
    }
  };
};

Cable.returnKey = function(selector) {
  return {
    type:"event",
    wireup:function(fn) {
      Cable.yield("$", function($) {
        $(selector).on("keyup", function(evt) {
          if (evt.keyCode === 13) {
            fn(new Date());
          }
        });
      });
    }
  };
};

Cable.define(
  { init:{ type:"event", wireup:function(f) { f(new Date()); } } }, 
  { reify:false, wireup:false }
);

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

Cable.template = function(selector, template) {
  var
    reg = /\{\{[_a-zA-Z0-9]+\}\}/g,
    match = template.match(reg) || [],
    deps = match.map(function(m) { return m.replace(/\{|\}/g, ""); });

  var obj =  {
    properties:Cable.pack(deps),
    main:function(properties, $) {

      var rend = template;
      for (var idx = 0; idx < deps.length; ++idx) {
        rend = rend.replace("{{" + deps[idx] + "}}", properties()[deps[idx]]);
      }

      $(selector).html(rend);
    }
  };

  return obj;
};

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

Cable.counter = function() {
  return Cable.data(-1, {
    next:function() {
      var n = this() + 1;
      this(n);
      return n;
    }
  });
};
