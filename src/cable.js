var Cable = { };
(function() {
  var 
    index = { },
    keywords = [ "document", "event" ];

  Cable.get = function(fn) {
    var 
      inputs = _getInputs(fn),
      values = [];

    for (var i = 0; i < inputs.length; ++i) {
      (function(i, k, v) {
        values[i] = function() {
          // Treat like get or set?
          if (arguments.length) {
            if (index[k].type === "data") {
              index[k].value = arguments[0];
              _trigger(k);
            }
            else {
              throw "Error: cannot set node of type \'" + index[k].type + "\'";
            }
          }
          else {
            return v;
          }
        };
      })(i, inputs[i], index[inputs[i]].value);
    }

    fn.apply({ }, values);
  };

  Cable.def = function(obj) {
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) {
        (function(k) {

          if (index.hasOwnProperty(k)) {
            throw "Error: Redefinition of \'" + k + "\'";
          }

          var d = obj[k];

          //  If it's a function, treat it like a functor definition, otherwise
          //  treat it like a normal data definition.
          if (_isFunction(d)) {
            var inputs = _getInputs(d);

            if (inputs.indexOf("event") != -1) {
              // Just setup the event. For now, events cannot accept data:

              index[k] = {
                type:"event",
                value:null
              };

              d(function() {
                index[k].value = new Date();
                _trigger(k);
              });
            }
            else {
              index[k] = {
                type:"functor",
                value:null,
                func:d
              };
            }
          }
          else if (d.type === "data") {
            index[k] = {
              type:"data",
              value:d.value
            };
          }
        })(k);
      }
    }

    _reify();
  };

  Cable.mod = function(obj) {

  };

  Cable._debugGraph = function() {
    for (var k in index) {
      if (index.hasOwnProperty(k)) {
        console.log(k, JSON.stringify(index[k]));
      }
    }
  };

// Internals:
////////////////////////////////////////////////////////////////////////////////

  function _getInputs(fn) {
    return (fn + "")
      .match(/^function(\s+\S*)?\(([^)]+)\)/)[2]
      .split(",")
      .map(function(x) { return x.replace(/(^\s+)|(\s+$)/g, ""); });
  }

  // Via http://stackoverflow.com/a/7356528/26626
  function _isFunction(fn) {
    var getType = {};
    return fn && getType.toString.call(fn) === '[object Function]';
  }

  function _trigger(name) {
    for (var i = 0; i < index[name].out.length; ++i) {
      if (index[index[name].out[i]].type === "functor") {
        Cable.get(index[index[name].out[i]].func);
      }
    }    
  }

  function _reify() {
    for (var k in index) {
      if (index.hasOwnProperty(k)) {
        index[k].out = [];
      }
    }

    for (var k in index) {
      if (index.hasOwnProperty(k)) {
        if (index[k].type === "functor") {
          index[k].in = _getInputs(index[k].func);
          for (var i = 0; i < index[k].in.length; ++i) {
            index[index[k].in[i]].out.push(k);
          }
        }
      }
    }
  };

})();

