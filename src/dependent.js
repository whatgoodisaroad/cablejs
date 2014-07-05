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
