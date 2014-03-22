/*..............................................................................
.  Dependent helpers. A set of tools for constructing the graph which depend on
.  at least one library. For example, jQuery for event bindings and DOM manip.
..............................................................................*/

//  Super-generic event function.
// 
//  NOTE: This is getting to big. Probably gonna break this down into 
//  specialized helpers like textbox and checkbox.
Cable.event = function(selector, events, property, triggerOnLoad) {
  return { 
    type:"event",
    coalesce:false,
    wireup:function(fn) {
      Cable.generate("$", function($) {
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

                if (obj.is("[type='number']")) {
                  val = parseFloat(val);
                }
              }
              else if (property === "time") {
                val = new Date();
              }
              else if (/^data-[-_a-zA-Z0-9]+/.test(property)) {
                val = obj.attr(property);
              }
              else if (property === ":checked") {
                val = obj.is(":checked");
              }

              fn(val);
            },

            handler;

          if (events === "key-return") {
            events = "keyup";
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

//  Lift a textbox into the graph.
Cable.textbox = function(selector) {
  return {
    type:"event",
    wireup:function(fn) {
      Cable.generate("$", function($) {
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
          fn(getter());
        });
        fn(getter());
      })
    }
  };
};

Cable.checkbox = function(selector) {
  return Cable.event(selector, "change", ":checked", true);
};

Cable.button = function(selector) {
  return {
    type:"event",
    wireup:function(fn) {
      Cable.generate("$", function($) {
        $(selector).on("click", function() {
          fn(new Date());
        });
      })
    }
  };
};

Cable.returnKey = function(selector) {
  return {
    type:"event",
    wireup:function(fn) {
      Cable.generate("$", function($) {
        $(selector).on("keyup", function(evt) {
          if (evt.keyCode === 13) {
            fn(new Date());
          }
        });
      });
    }
  };
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
