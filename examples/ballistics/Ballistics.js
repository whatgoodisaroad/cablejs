define(function() {
  return {
    // http://en.wikipedia.org/wiki/Trajectory_of_a_projectile
    
    d:function(g, theta, v, y_0) {
      return (
        (v * Math.cos(theta) / g) * (
          (v * Math.sin(theta)) +
          Math.sqrt(
            Math.pow(v * Math.sin(theta), 2) + 
            (2 * g * y_0)
          )
        )
      );
    },
    t:function(g, theta, v, y_0) {
      return (
        (
          (v * Math.sin(theta)) +
          Math.sqrt(
            Math.pow(v * Math.sin(theta), 2) + 
            (2 * g * y_0)
          )
        ) /
        g
      );
    },
    phi:function(g, d, v) {
      return (
        0.5 *
        Math.asin(
          (g * d) / 
          (v * v)
        )
      );
    },
    h:function(g, theta, v, y_0, x) {
      return (
        y_0 + (x * Math.tan(theta)) - 
        (
          (g * x * x) /
          (2 * Math.pow(v * Math.cos(theta), 2))
        )
      );
    },
    v:function(g, theta, v, y_0, x) {
      return Math.sqrt(
        (v * v) -
        (2 * g * x * Math.tan(theta)) +
        Math.pow(
          (g * x) / 
          (v * Math.cos(theta)),
          2
        )
      );
    },

    trajectory:function(g, theta, v, y_0, n) {
      var 
        dx = this.d(g, theta, v, y_0) / n,
        result = [];

      for (var idx = 0; idx <= n; ++idx) {
        result.push({
          x:dx * idx,
          h:this.h(g, theta, v, y_0, dx * idx),
          v:this.v(g, theta, v, y_0, dx * idx),
        });
      }

      return result;
    }
  };
});
