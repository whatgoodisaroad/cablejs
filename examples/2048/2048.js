define(function() {
  function rand(a) {
    return a[Math.floor(Math.random() * a.length)];
  }

  var game = {
    clone:function(stage) {
      return {
        score:stage.score,
        step:stage.step,
        rows:stage.rows,
        columns:stage.columns,
        spawns:stage.spawns.slice(0),
        winningTile:stage.winningTile,
        grid:stage.grid.map(function(r) { return r.slice(0); }),
        last:{
          created:stage.last.created.map(function(c) {
            return { row:c.row, column:c.column, value:c.value, step:c.step };
          }),
          moved:stage.last.moved.map(function(c) {
            return {
              row1:c.row1,
              column1:c.column1,
              row2:c.row2,
              column2:c.column2,
              value:c.value,
              step:c.step 
            };
          }),
          merged:stage.last.merged.map(function(c) {
            return {
              row1:c.row1,
              column1:c.column1,
              row2:c.row2,
              column2:c.column2,
              value:c.value,
              step:c.step 
            };
          }),
          hasMoved:stage.last.hasMoved
        }
      };
    },

    blank:function() {
      var stage = {
        score:0,
        step:0,
        rows:4,
        columns:4,
        spawns:[ 2, 4 ],
        winningTile:2048,
        grid:[],
        last:{
          created:[],
          moved:[],
          merged:[],
          hasMoved:false
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
        merged:[],
        hasMoved:false
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

      stage.last.created.push({
        row:row,
        column:col,
        value:stage.grid[row][col],
        step:stage.step
      });

      return stage;
    },

    initialize:function() {
      return this.spawn(this.spawn(this.blank()));
    },

    move:function(stage, direction) {
      stage = this.resetLast(this.clone(stage));

      ++stage.step;

      var row, col;

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
          while (
            // Reached bottom:
            destRow < stage.rows - 1 && 

            // Either a movement or a merge:
            (
              // Blank below ==> move:
              (get(destRow + 1, col) === 0) 

              ||

              // Same number below, and not merged in this turn ==> merge:
              (
                get(destRow + 1, col) === get(row, col) &&
                !mergeTable[(destRow + 1) + "x" + col]
              )
            )
          ) {
            ++destRow;

            if (get(destRow, col) === get(row, col)) {
              break;
            }
          }

          if (destRow !== row) {
            stage.last.hasMoved = true;

            var 
              t1 = trans(row, col),
              t2 = trans(destRow, col);

            if (get(destRow, col) === get(row, col) &&
                !mergeTable[destRow + "x" + col]) {
              set(destRow, col, 2 * get(destRow, col));
              set(row, col, 0);

              stage.score += get(destRow, col);

              mergeTable[destRow + "x" + col] = true;

              stage.last.merged.push({
                row1:   t1.row,
                column1:t1.column,
                row2:   t2.row,
                column2:t2.column,
                value:get(destRow, col),
                step:stage.step
              });
            }
            else {
              set(destRow, col, get(row, col));
              set(row, col, 0);

              stage.last.moved.push({
                row1:   t1.row,
                column1:t1.column,
                row2:   t2.row,
                column2:t2.column,
                value:get(destRow, col),
                step:stage.step
              });
            }
          }
        }
      }

      if (stage.last.hasMoved) {
        stage = this.spawn(stage, direction);
      }

      return stage;
    },

    isGameOver:function(state) {
      return (
        !this.move(state, "north").last.hasMoved &&
        !this.move(state, "south").last.hasMoved &&
        !this.move(state, "east").last.hasMoved &&
        !this.move(state, "west").last.hasMoved
      );
    },

    isGameWon:function(stage) {
      for (var row = 0; row < stage.rows; ++row) {
        for (var col = 0; col < stage.columns; ++col) {
          if (stage.grid[row][col] === stage.winningTile) {
            return true;
          }
        }
      }
      return false;
    }
  };

  return game;

});