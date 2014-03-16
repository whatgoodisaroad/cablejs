define(function() {
  return {
    slices:20,

    setup:function(d3) {
      var
        margin = {
          top: 20, 
          right: 30, 
          bottom: 30, 
          left: 140
        },
        width = 578 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom,

        x = d3.scale.linear().range([0, width]),
        y = d3.scale.linear().range([height, 0]),
        v = d3.scale.linear().range([0,255])

        xAxis = d3.svg.axis()
          .scale(x)
          .orient("bottom"),
        yAxis = d3.svg.axis()
          .scale(y)
          .orient("left"),
        svg = d3.select(".main")
          .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr(
              "transform", 
              "translate(" + margin.left + "," + margin.top + ")"
            );

      x.domain([0,10000]);
      y.domain([0,100]);

      var
        gx = svg.append("g")
          .attr("class", "x axis")
          .attr("transform", "translate(0," + height + ")")
          .call(xAxis),
        gy = svg.append("g")
          .attr("class", "y axis")
          .call(yAxis);

      var markers = svg.append("g")
        .attr("class", "markers");

      svg.append("defs").append("marker")
        .attr({
          id:"arrowhead",
          refX:5,
          refY:2.5,
          markerWidth:10,
          markerHeight:20,
          orient:"auto",
          style:"fill:none;stroke-width:1;stroke:#666;"
        })
        .append("path")
        .attr("d", "M 0,0 L 5,2.5 L0,6");

      return {
        scale:{ x:x, y:y, v:v },
        axis:{ x:xAxis, gx:gx, y:yAxis, gy:gy },
        svg:svg,
        markers:markers
      };
    },

    updateScale:function(d3, plot, region, traj) {
      var 
        x_ext = d3.extent(traj, function(d) { return d.x; }),
        y_ext = d3.extent(traj, function(d) { return d.h; }),
        scale = Math.max(x_ext[1], y_ext[1]);

      if (scale > region) {
        region = 1.5 * scale;
      }
      else if (1.5 * scale < region) {
        region = scale;
      }

      plot.scale.x.domain([0, region]);
      plot.scale.y.domain([0, region]);
      plot.scale.v.domain(d3.extent(traj, function(d) { return d.v; }));

      plot.axis.x.scale(plot.scale.x);
      plot.axis.y.scale(plot.scale.y);

      plot.axis.gx.transition().call(plot.axis.x);
      plot.axis.gy.transition().call(plot.axis.y);

      return region;
    },

    updateTrajectory:function(d3, plot, markers) {
      var lines = plot.svg.select(".markers").selectAll(".marker")
        .data(markers);

      lines.enter()
        .append("line")
        .attr("class", "marker");

      lines
        .transition()
        .attr({
          x1:function(d) { return plot.scale.x(d.x1); },
          y1:function(d) { return plot.scale.y(d.y1); },
          x2:function(d) { return plot.scale.x(d.x2); },
          y2:function(d) { return plot.scale.y(d.y2); }
        });

      lines
        .attr({
          style:function(d) { 
            return (
              "stroke:rgb(" + 
                Math.floor(plot.scale.v(d.v)) + 
                ",0," + 
                Math.floor(255 - plot.scale.v(d.v)) + 
              ");"
            );
          }
        });

      lines.exit().remove();
    },

    update:function(d3, Ballistics, plot, region, g, theta, v, y_0) {
      var
        traj = Ballistics.trajectory(g, theta, v, y_0, this.slices),
        markers = [];

      for (var idx = 0; idx < traj.length - 1; ++idx) {
        markers.push({ 
          x1:traj[idx].x,
          y1:traj[idx].h,
          x2:traj[idx + 1].x,
          y2:traj[idx + 1].h,
          v:traj[idx].v
        });
      }

      var newRegion = this.updateScale(d3, plot, region, traj);
      this.updateTrajectory(d3, plot, markers);

      return newRegion
    }
  };
});
