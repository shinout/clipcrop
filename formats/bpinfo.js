var toCode = require("dna").getChromCode;

/**
 * BPInfo
 * 
 * columns
 *   name
 *   LR
 *   cigar
 *   rname
 *   strand
 **/

var BPInfo = {
  columns: ["name", "LR", "start", "cigar", "rname", "strand", "size"],
  separator: "::",
  numbers: ["start", "size"],

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
    ret.code = toCode(ret.rname, true);

    return ret;
  },

  /**
   * stringify bp object
   **/
  stringify : function(bp) {
    return this.columns.map(function(col) {
      return bp[col];
    }).join(this.separator);
  }
};

module.exports = BPInfo;
