var 
  assert = require("assert"),
  should = require("should"),
  Cable = require("../dist/cable.min.js");

describe("Define", function() {
  describe("Event", function() {
    it("creates event nodes with function syntax", function() {
      Cable.define({
        event1:function(event) { }
      });

      Cable._debug().event1.type.should.eql("event");
    });

    it("creates event nodes with object syntax", function() {
      Cable.define({
        event2:{ type:"event", defaultValue:123, wireup:function(event) { } }
      });

      Cable._debug().event2.type.should.eql("event");
      Cable._debug().event2.value.should.be.exactly(123);
    });

    it("allows setting default value without triggering", function() {
      Cable.define({
        event3:function(event) { event.setDefault(200); }
      });

      Cable._debug().event3.value.should.be.exactly(200);
      Cable._debug().event3.invoked.should.eql(false);
    });
  });

  describe("Synthetic", function() {
    it("creates synthetic node with result syntax", function() {
      Cable.define({
        synthetic1:function(event1, _event2, result) { }
      });

      Cable._debug().synthetic1.type.should.eql("synthetic");
      Cable._debug().synthetic1["in"].should.eql(["event1", "event2"]);
      Cable._debug().synthetic1.resultIndex.should.be.exactly(2);
      Cable._debug().synthetic1.coalesce.should.eql(true);
    });

    it("creates synthetic node with respond syntax", function() {
      Cable.define({
        synthetic2:function(synthetic1, respond) { }
      });

      Cable._debug().synthetic2.type.should.eql("synthetic");
      Cable._debug().synthetic2["in"].should.eql(["synthetic1"]);
      Cable._debug().synthetic2.resultIndex.should.be.exactly(1);
      Cable._debug().synthetic2.coalesce.should.eql(false);
    });
  });

  describe("Effect", function() {
    it("creates effect nodes", function() {
      Cable.define({
        effect1:function(event1, _event2) { }
      });

      Cable._debug().effect1.type.should.eql("effect");
      Cable._debug().effect1["in"].should.eql(["event1", "event2"]);
    });
  });

  describe("Data", function() {
    it("creates data nodes", function() {
      Cable.define({
        data1:{ type:"data", value:100 }
      });

      Cable._debug().data1.type.should.eql("data");
      Cable._debug().data1.value.should.be.exactly(100);
    });
  });

  describe("Library", function() {
    it("creates library node for AMD module", function() {
      Cable.define({
        underscore:{
          type:"library",
          path:"underscore.js"
        }
      });

      Cable._debug().underscore.type.should.eql("library");
    });

    it("creates library node for shimmed module", function() {
      Cable.define({
        cableLib:{
          type:"library",
          path:"../dist/cable.min.js",
          shim:"Cable"
        }
      });

      Cable._debug().cableLib.type.should.eql("library");
      Cable._debug().cableLib.shim.should.eql("Cable");
    });
  });

  describe("Scoped", function() {
    it("creates scoped nodes", function() {
      Cable.define({
        scope1:{
          x:function(event) { },
          y:function(x, result) { }
        },
        z:function(scope1_y) { }
      });

      Cable._debug().scope1_x.type.should.eql("event");
      Cable._debug().scope1_x.out.should.eql(["scope1_y"]);

      Cable._debug().scope1_y.type.should.eql("synthetic");
      Cable._debug().scope1_y["in"].should.eql(["x"]);

      Cable._debug().z.type.should.eql("effect");
      Cable._debug().z["in"].should.eql(["scope1_y"]);
    });
  });

  describe("Aliases", function() {
    it("creates alias nodes", function() {
      Cable.define({
        color:{ type:"data", value:"#ff0" },
        colour:{ type:"alias", reference:"color" }
      });

      Cable._debug().colour.type.should.eql("alias");
      Cable._debug().colour.reference.should.eql("color");
    });

    it("follows alias names", function() {
      Cable.define({
        testColour:function(forceColourTest, colour) {
          colour().should.eql("#ff0");
        },
        forceColourTest:function(event) { event(new Date()); }
      });
    });
  });
});

describe("Private", function() {
  describe(".getArgNames", function() {
    it("finds the argument names of a function without aliases", function() {
      Cable._private.getArgNames(function() { })
        .should.eql([]);

      Cable._private.getArgNames(function(x,y,z) { })
        .should.eql(["x", "y", "z"]);
    });

    it("finds use aliases if they are present", function() {
      var fn = function(a, b) {};
      fn.argAliases = ["c", "d"];

      Cable._private.getArgNames(fn)
        .should.eql(fn.argAliases);
    });
  });

  describe(".getFanIn", function() {
    it("finds the argument names of a function without aliases", function() {
      Cable._private.getFanIn(function() { })
        .should.eql([]);

      Cable._private.getFanIn(function(x,y,z) { })
        .should.eql(["x", "y", "z"]);
    });

    it("uses aliases if they are present", function() {
      var fn = function(a, b) {};
      fn.argAliases = ["c", "d"];

      Cable._private.getFanIn(fn)
        .should.eql(fn.argAliases);
    });

    it("trims leading underscores", function() {
      Cable._private.getFanIn(function(a, _b, c, _d) { })
        .should.eql(["a", "b", "c", "d"]);
    });

    it("ignores reserved words", function() {
      Cable._private.getFanIn(function(a, result, c, event) { })
        .should.eql(["a", "c"]);

      Cable._private.getFanIn(function(respond) { })
        .should.eql([]);
    });
  });

  describe(".getDependencies", function() {
    it("finds the argument names of a function without aliases", function() {
      Cable._private.getDependencies(function() { })
        .should.eql([]);

      Cable._private.getDependencies(function(x,y,z) { })
        .should.eql(["x", "y", "z"]);
    });

    it("uses aliases if they are present", function() {
      var fn = function(a, b) {};
      fn.argAliases = ["c", "d"];

      Cable._private.getDependencies(fn)
        .should.eql(fn.argAliases);
    });

    it("ignores args with leading underscores", function() {
      Cable._private.getDependencies(function(a, _b, c, _d) { })
        .should.eql(["a", "c" ]);
    });

    it("ignores reserved words", function() {
      Cable._private.getDependencies(function(a, result, c, event) { })
        .should.eql(["a", "c"]);

      Cable._private.getDependencies(function(respond) { })
        .should.eql([]);
    });
  });

  describe(".isSynthetic", function() {
    it("identifies functions as result-style synthetic", function() {
      Cable._private.isSynthetic(function(a, b, result, c, d) { })
        .should.eql(true);
    });

    it("identifies functions as respond-style synthetic", function() {
      Cable._private.isSynthetic(function(a, b, respond, c, d) { })
        .should.eql(true);
    });

    it("rejects functions with neither respond nor result args", function() {
      Cable._private.isSynthetic(function(a, b, c, d) { })
        .should.eql(false);

      Cable._private.isSynthetic(function() { })
        .should.eql(false);
    });
  });

  describe(".isSubDefinition", function() {
    it("identifies subdefinitions with define args", function() {
      Cable._private.isSubDefinition(function(define, x, y) { })
        .should.eql(true);
    });

    it("rejects functions without define arg", function() {
      Cable._private.isSubDefinition(function(a, b, c, d) { })
        .should.eql(false);

      Cable._private.isSubDefinition(function() { })
        .should.eql(false);
    });
  });

  describe(".isEvent", function() {
    it("identifies events with event arg", function() {
      Cable._private.isEvent(function(event) { })
        .should.eql(true);
    });

    it("rejects functions without event arg", function() {
      Cable._private.isEvent(function(a, b, c, d) { })
        .should.eql(false);

      Cable._private.isEvent(function() { })
        .should.eql(false);
    });

    it("rejects functions without event arg plus others", function() {
      Cable._private.isEvent(function(event, b, c, d) { })
        .should.eql(false);
    });
  });

  describe(".extend", function() {
    it("overrides nothing when {} is passed as 2nd arg", function() {
      Cable._private.extend({ x:1, y:2 }, { })
        .should.eql({ x:1, y:2 });
    });

    it("overrides only props from 1st arg", function() {
      Cable._private.extend({ x:1, y:2 }, { y:3, z:4 })
        .should.eql({ x:1, y:3 });
    });

    it("overrides nothing if 2nd argument is absent", function() {
      Cable._private.extend({ x:1, y:2 })
        .should.eql({ x:1, y:2 });
    });
  });

  describe(".enumerateScopes", function() {
    it("combines scope chains from deep-to-shallow", function() {
      Cable._private.enumerateScopes(['x','y','z'], "w")
        .should.eql(["x_y_z_w", "x_y_w", "x_w", "w"]);
    });

    it("does not include main in scope enumerations", function() {
      Cable._private.enumerateScopes(['x','y'], "main")
        .should.eql(["x_y", "x"]);
    });

    
  });

});

describe("Helpers", function() {
  describe(".withArgs", function() {
    it("produces a fuction with an argAliases property", function() {
      Cable.withArgs([], function() { })
        .should.have.property("argAliases");
    });

    it("should have argAliases equal to the list names", function() {
      var aliases = ["a","b","c"]
      Cable.withArgs(aliases, function(x,y,z) { })
        .should.have.property("argAliases", aliases);
    });
  });
});
