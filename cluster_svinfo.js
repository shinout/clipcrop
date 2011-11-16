var termcolor = require("termcolor").define();
var LineStream = require("linestream");
var dna = require("dna");
var BPInfo = require("./bpinfo");


/**
 * shows clustered SV (Structural Variation) info
 *
 * @param (string or ReadableStream) input
 * @param (object) config
 *
 **/
function clusterSVInfo(input, config) {
  var MAX_DIFF = config.MAX_DIFF || 3;
  var MIN_CLUSTER_SIZE = config.MIN_CLUSTER_SIZE || 10;

  var lines = new LineStream(input, {
    fieldNum: 6,
    fieldSep: "\t",
    comment: "#"
  });

  /**
   * prepare initial values of clusters, prevs
   **/
  var clusters = {};
  var prevs = {};

  ["INS", "DEL", "DUP", "ITX", "INV"].forEach(function(type) {
    var key = type;
    clusters[key] = [];
    prevs[key] = null;
  });


  lines.on("data", function(line) {
    /**
     * sv info
     **/
    var data = line.split("\t");

    var current = {
      LR     : data[0],
      type   : data[1],
      pos    : Number(data[2]),
      len    : data[3],
      rname  : data[4],
      rname2 : data[5]
    };
    
    var key = current.type;


    /**
     * get previous value
     **/
    var prev = prevs[key];

    /**
     * checking if prev and current are in different clusters
     **/

    if (prev && ( Math.abs(prev.pos - current.pos) > MAX_DIFF)) {

      printSVInfo(clusters[key],
            MIN_CLUSTER_SIZE // allowable minimum cluster size
      );
      clusters[key] = [];  // reset
    }

    clusters[key].push(current);
    prevs[key] = current;
  });

}


/**
 * shows sv info as BED format.
 **/
function printSVInfo(cl, minsize) {
  var num = cl.length;
  if (num < minsize) return;

  var rname  = cl[0].rname;

  /**
   * the nubmer of Ls, Rs
   **/
  var Ls     = cl.filter(function(v) { return v.LR == "R" }).length;
  var Rs     = num - Ls;

  var type   = cl[0].type;
  var pos = getMean(cl, "pos");
  var len = (type == "INS") ? 1: getMean(cl, "len");
  var len_disp = (type == "INS") ? "*": len;

  console.log([rname, pos, pos+len, type, Ls, Rs, len_disp, num].join("\t"));
}

function getMean(cl, name) {
  var sum = cl.reduce(function(ret, v) {
    return ret + Number(v[name]);
  }, 0);
  return Math.floor(sum/cl.length + 0.5);
}




if (__filename == process.argv[1]) {
  process.stdin.resume();

  clusterSVInfo(process.stdin, {
    type: process.argv[2],
    MAX_DIFF: process.argv[3],
    MIN_CLUSTER_SIZE: process.argv[4],
    MIN_QUALITY     : process.argv[5],
    MIN_SEQ_LENGTH  : process.argv[6]
  });
}
