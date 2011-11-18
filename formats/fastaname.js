var toCode = require("dna").getChromCode;

/**
 * FASTAName
 * 
 * columns
 *   rname
 *   start
 *   end
 **/

var FASTAName = {
  columns: ["rname", "start", "end"],
  separator: "::",
  numbers: ["start", "end"],

  /**
   * parse string
   **/
  parse : function(str) {
    var arr = str.split(this.separator);
    var ret = this.columns.reduce(function(ret, col, i) {
      ret[col] = arr[i];
      return ret;
    }, {});

    this.numbers.forEach(function(col) {
      ret[col] = Number(ret[col]);
    });
    ret.code = toCode(ret.rname);

    return ret;
  },

  /**
   * stringify info
   **/
  stringify : function(info) {
    return this.columns.map(function(col) {
      return info[col];
    }).join(this.separator);
  }
};

module.exports = FASTAName;
