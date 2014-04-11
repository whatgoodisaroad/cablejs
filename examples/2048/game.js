define(function() {
  function rand(a) {
    return a[Math.floor(Math.random() * a.length)];
  }

  var game = {
    clone:function(stage) {
      return {
        rows:stage.rows,
        columns:stage.columns,
        spawns:stage.spawns.slice(0),
        grid:stage.grid.slice(0),
        last:{
          created:stage.last.created,
          moved:stage.last.moved,
          merged:stage.last.merged
        }
      };
    },

    blank:function() {
      var stage = {
        rows:4,
        columns:4,
        spawns:[ 2, 4 ],
        grid:[],
        last:{
          created:[],
          moved:[],
          merged:[]
        }
      };

      for (var row = 0; row < stage.rows; ++row) {
        var cols = [];
        for (var col = 0; col < stage.columns; ++col) {
          cols.push(0);
        }
        stage.grid.push(cols);
      }

      return stage;
    },

    resetLast:function(stage) {
      stage = this.clone(stage);

      stage.last = {
        created:[],
        moved:[],
        merged:[]
      };

      return stage;
    },

    spawn:function(stage, direction) {
      stage = this.clone(stage);
      var row, col;

      if (direction === "north") {
        row = stage.rows - 1;
        do {
          col = Math.floor(Math.random() * stage.columns);
        }
        while(stage.grid[row][col] !== 0);
      }
      else if (direction === "south") {
        row = 0;
        do {
          col = Math.floor(Math.random() * stage.columns);
        }
        while(stage.grid[row][col] !== 0);
      }
      else if (direction === "west") {
        col = stage.columns - 1;
        do {
          row = Math.floor(Math.random() * stage.rows);
        }
        while(stage.grid[row][col] !== 0);
      }
      else if (direction === "east") {
        col = 0;
        do {
          row = Math.floor(Math.random() * stage.rows);
        }
        while(stage.grid[row][col] !== 0);
      }
      else {
        do {
          row = Math.floor(Math.random() * stage.rows);
          col = Math.floor(Math.random() * stage.columns);
        }
        while(stage.grid[row][col] !== 0);
      }

      stage.grid[row][col] = rand(stage.spawns);

      stage.last.created.push({ row:row, column:col });

      return stage;
    },

    initialize:function() {
      return this.spawn(this.spawn(this.blank()));
    },

    move:function(stage, direction) {
      stage = this.resetLast(this.clone(stage));

      var row, col, hasMoved = false;

      function trans(row, col) {
        if (direction === "south") {
          return { row:row, column:col };
        }
        else if (direction === "north") {
          return { row:stage.rows - 1 - row, column:col };
        }
        else if (direction === "east") {
          return { row:col, column:row }; 
        }
        else if (direction === "west") {
          return { row:col, column:stage.columns - 1 - row };
        }
      }
      function get(row, col) {
        var t = trans(row, col);
        return stage.grid[t.row][t.column];
      }
      function set(row, col, val) {
        var t = trans(row, col);
        stage.grid[t.row][t.column] = val;
      }

      var mergeTable = {};

      for (row = stage.rows - 2; row >= 0; --row) {
        for (col = 0; col < stage.columns; ++col) {
          if (get(row, col) === 0) {
            continue;
          }

          var destRow = row;
          while ( destRow < stage.rows - 1 && 
                 (get(destRow + 1, col) === 0 ||
                  get(destRow + 1, col) === get(row, col))) {
            ++destRow;
          }

          if (destRow !== row) {
            hasMoved = true;

            var 
              t1 = trans(row, col),
              t2 = trans(destRow, col);

            if ( get(destRow, col) === get(row, col)) {
              set(destRow, col, 2 * get(destRow, col));
              set(row, col, 0);

              stage.last.merged.push({
                row1:   t1.row,
                column1:t1.column,
                row2:   t2.row,
                column2:t2.column
              });
            }
            else {
              set(destRow, col, get(row, col));
              set(row, col, 0);

              stage.last.moved.push({
                row1:   t1.row,
                column1:t1.column,
                row2:   t2.row,
                column2:t2.column
              })
            }
          }
        }
      }

      if (hasMoved) {
        stage = this.spawn(stage, direction);
      }

      return stage;
    }
  };

  return game;

});