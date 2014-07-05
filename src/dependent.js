/*..............................................................................
.  Dependent helpers. A set of tools for constructing the graph which depend   .
.  on. at least one library (e.g. jQuery).                                     .
..............................................................................*/

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

Cable.chain = function(source) {
  var
    links = [],
    methods = "take drop map filter reduce reduceRight contains max min sortBy groupBy size flatten uniq".split(" "),
    compute = function(data, _) {
      var chain = _.chain(data());

      for (var idx = 0; idx < links.length; ++idx) {
        chain = chain[links[idx].type].apply(
          chain, 
          links[idx].args
        );
      }

      return chain.value();
    },
    obj = {
      value:function() {
        return Cable.withArgs(
          [source, "underscore", "result"], 
          function(data, _, result) {
            result(compute(data, _));
          }
        );
      },
      each:function() {
        return Cable.withArgs(
          [source, "underscore", "result"], 
          function(data, _, result) {
            compute(data, _).forEach(result);
          }
        );
      }
    };

  for (var idx = 0; idx < methods.length; ++idx) {
    (function(idx) {
      obj[methods[idx]] = function() {
        links.push({ type:methods[idx], args:arguments });
        return obj;
      };
    })(idx);
  }

  return obj;
};

Cable.hash = function() {
  return Cable.withArgs(["$", "define"], function($, define) {
    define(Cable.withArgs(["event"], function(event) {
      event(location.hash.replace(/^#/, ""));
      $(window).on("hashchange", function(e) {
        event(location.hash.replace(/^#/, ""));
      });
    }));
  });
};

Cable.router = function(routes) {
  if (routes.substring) {
    routes = [routes];
  }

  var terms = [];

  for (var ridx = 0; ridx < routes.length; ++ridx) {
    var components = routes[ridx]
      .split("/");

    for (var cidx = 0; cidx < components.length; ++cidx) {
      if (/^:/.test(components[cidx]) &&
          terms.indexOf(components[cidx].substring(1)) == -1
      ) {
        terms.push(components[cidx].substring(1));
      }
    }
  }

  var obj = {
    routeIndex:Cable.data(null),
    hash:Cable.hash(),
    main:Cable.data(null),
    route:Cable.withArgs(
      ["hash", "_main", "_routeIndex"],
      function(hash, _main, _routeIndex) {

        // Try to match each route.
        for (var ridx = 0; ridx < routes.length; ++ridx) {
          var
            routeTerms = routes[ridx]
              .split("/"),
            hashTerms = hash()
              .split("/"),
            hashValues = {},
            fail = false;

          if (routeTerms.length != hashTerms.length) {
            break;
          }

          for (var tidx = 0; tidx < routeTerms.length; ++tidx) {
            if (/^:/.test(routeTerms[tidx])) {
              hashValues[routeTerms[tidx].substring(1)] = hashTerms[tidx];
            }
            else {
              if (routeTerms[tidx] != hashTerms[tidx]) {
                fail = true;
                break;
              }
            }
          }

          if (!fail) {
            _main(hashValues);
            _routeIndex(ridx);
            return;
          }
        }

        // No match
        _main(false);
        _routeIndex(-1);
      }
    ),
    terms:Cable.withArgs(
      ["main"].concat(terms.map(function(t) { return "_" + t; })),
      function(route) {
        var
          updated = terms.slice(0),
          obj = route();

        for (var term in obj) {
          if (obj.hasOwnProperty(term)) {
            arguments[terms.indexOf(term) + 1](obj[term]);
            updated[terms.indexOf(term)] = false;
          }
        }

        for (var uidx = 0; uidx < updated.length; ++uidx) {
          if (updated[uidx]) {
            arguments[uidx + 1](null);
          }
        }
      }
    )
  };

  for (var tidx = 0; tidx < terms.length; ++tidx) {
    obj[terms[tidx]] = Cable.data(null);
  }

  return obj;
};
