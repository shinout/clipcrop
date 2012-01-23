var dirs = require('../config').dirs;
var termcolor = require("termcolor").define();
var LineStream = require("linestream");
var dna = require("dna");
var BPInfo = require(dirs.FORMATS + "bpinfo");

/**
 *
 * shows breakpoint cluster BED info
 *  or
 * shows breakpoint FASTQs
 *
 * @param (string or Stream) input
 *  input stream or filename
 *
 * @param (object) config
 *    
 *    type: one of ["fastq", "bed"]
 *      fastq: shows breakpoint FASTQs
 *      bed  : shows breakpoint cluster BED info
 *
 *    MAX_DIFF: number 
 *      allowable maximum difference in the same cluster. default 3.
 *
 *    MIN_CLUSTER_SIZE: number 
 *      allowable minimum cluster size. default 3.
 *
 *    MIN_QUALITY: number 
 *      allowable minimum mean quality of the sequence. default 5.
 *
 *    MIN_SEQ_LENGTH: hoge
 *      allowable minimum mean quality of the sequence. default 10.
 *
 **/
function cluster_breaks(input, config) {
  var MAX_DIFF         = config.MAX_DIFF         || 3;
  var MIN_CLUSTER_SIZE = config.MIN_CLUSTER_SIZE || 3;
  var MIN_QUALITY      = config.MIN_QUALITY      || 5;
  var MIN_SEQ_LENGTH   = config.MIN_SEQ_LENGTH   || 10;
  //var output = isWritableStream(config.output) ? config.output : process.stdout;
  var output = process.stdout;

  /**
   * set print function according to type.
   **/
  var print = (function() {
    switch (config.type) {
      case "fastq" :
        return printFASTQ.bind(output);
      default :
      case "bed" :
        return printBED.bind(output);
    }
  })();

  /**
   * process each BED line of breakpoints
   **/

  var lines = new LineStream(input);

  var result = {
    /**
     * prev breakpoint data
     **/
    prev: {
      L: null,
      R: null
    },

    /**
     * current cluster data
     **/
    cluster: {
      L: [],
      R: [] 
    }
  };

  lines.on("data", function(line) {

    var ar = line.split("\t");
    if (ar.length < 8) return;

    /**
     * current breakpoint data
     **/
    var current = {
      rname  : ar[0],
      code   : dna.getChromCode(ar[0], true),
      start  : ar[1],
      LR     : ar[3],
      cigar  : ar[4],
      seq    : ar[5],
      qual   : ar[6],
      strand : ar[7],
      name   : ar[8]
    };

    // quality filter
    if (getmeanq(current.qual) < MIN_QUALITY) return;

    var LR = current.LR;

    /**
     * get prev of the same LR as current
     **/
    var prev = result.prev[LR];

    /**
     * checking if prev and current are in different clusters
     **/
    if (prev && ( prev.code != current.code
        || Math.abs(prev.start - current.start) > MAX_DIFF)) {

      print(result.cluster[LR],
            MIN_CLUSTER_SIZE, // allowable minimum cluster size
            MIN_SEQ_LENGTH    // allowable minimum sequence length (fastq only)
      );
      result.cluster[LR] = [];  // reset
    }

    result.cluster[LR].push(current);
    result.prev[LR] = current;
  });

  lines.on("end", function() {
    // output.end(); // for applying Node >=v0.6.1
  });

  // this never be called... Node >=v0.6.1
  output.on("close", function() {
    if (typeof process.send == "function") {
      process.send("finished");
    }
  });
}


/**
 * shows cluster info as BED format.
 *
 **/
function printBED(cl, minsize) {
  var num = cl.length;
  if (num < minsize) return;

  var rname  = cl[0].rname;
  var LR     = cl[0].LR;
  var start_sum = cl.reduce(function(ret, v) {
    return ret + Number(v.start);
  }, 0);

  var start = Math.floor(start_sum/num + 0.5);

  /**
   * calculating seq, but seq may differ in the same cluster,
   * so currently, not implemented.
   *
  var min_key = cl.reduce(function(ret, v, i) {
    var min = (ret.min) ? Math.min(ret.min, v.start) : v.start;
    return {
      min: min,
      i  : (min == v.start) ? i : ret.i
    };
  }, {min: null, i: null}).i;

  var delta = start - cl[min_key].start;
  if (LR == "L") var seq = cl[min_key].slice();
  else var seq = "";
  */

  this.write([rname, start, start+1, LR, num].join("\t") + "\n");
}

/**
 * shows sequence in fastq format.
 * this function is passed to the workers,
 * so this function must be independent from any outer variables.
 *
 **/
function printFASTQ(cl, minsize, minlen) {
  var num = cl.length;
  if (num < minsize) return;

  cl.forEach(function(bp) {
    bp.size = num;
    var slen = bp.seq.length;
    if (slen < minlen) return;

    var id = BPInfo.stringify(bp);

    this.write(['@' + id, bp.seq, "+", bp.qual].join("\n") + "\n");
  }, this);
}

/**
 * calculate mean quality score from qual string
 **/
function getmeanq(qual) {
  return Array.prototype.reduce.call(qual, function(ret, ch) {
    return  ret + ch.charCodeAt(0) - 32;
  }, 0) / qual.length;
}


/**
 *
 * check if val is a writableStream or not
 *
 * (currently, unused)
 * 
 **/
function isWritableStream(val) {
  return val && (typeof val.write == "function")
             && (typeof val.on == "function");
}




module.exports = cluster_breaks;

if (__filename == process.argv[1]) {
  process.stdin.resume();
  cluster_breaks(process.stdin, {
    type: process.argv[2],
    MAX_DIFF: process.argv[3],
    MIN_CLUSTER_SIZE: process.argv[4],
    MIN_QUALITY     : process.argv[5],
    MIN_SEQ_LENGTH  : process.argv[6]
  });
}
