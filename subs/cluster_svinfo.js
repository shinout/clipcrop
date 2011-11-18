var dirs = require('../config').dirs;
var termcolor = require("termcolor").define();
var LineStream = require("linestream");
var dna = require("dna");
var BPInfo = require(dirs.FORMATS + "bpinfo");
var SVClassifyStream = require(dirs.SV_CLASSIFY + 'SVClassifyStream');


/**
 * shows clustered SV (Structural Variation) info
 *
 * @param (string or ReadableStream) input (requires sorted data)
 * @param (object) config
 *
 **/
function cluster_svinfo(input, config) {
  var MAX_DIFF = config.MAX_DIFF || 3;
  var MIN_CLUSTER_SIZE = config.MIN_CLUSTER_SIZE || 10;
  var SAVE_DIR = config.SAVE_DIR || (__dirname + '../');

  var svcStream = new SVClassifyStream(SAVE_DIR, {prefix: ''});

  var lines = new LineStream(input, {
    fieldNum: 7,
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
      rname2 : data[5],
      size   : data[6],
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

      printSVInfo(svcStream, clusters[key],
            MIN_CLUSTER_SIZE // allowable minimum cluster size
      );
      clusters[key] = [];  // reset
    }

    clusters[key].push(current);
    prevs[key] = current;
  });

  lines.on("end", function() {
    svcStream.end();
  });

  svcStream.on("close", function() {
    // finished!
  });
}


/**
 * register sv info and write it as BED format.
 * @param svcStream: instance of SVClassifyStream
 * @param cl : cluster (array)
 * @param minsize: allowable minimum size of cluster
 **/
function printSVInfo(svcStream, cl, minsize) {
  var num = cl.length;
  if (num < minsize) return;

  var rname  = cl[0].rname;
  var rname2 = cl[0].rname2; // TODO in TRA, this may be different in the same cluster.

  /**
   * the nubmer of Ls, Rs
   **/
  var Ls     = cl.filter(function(v) { return v.LR == "R" }).length;
  var Rs     = num - Ls;

  var type   = cl[0].type;
  var pos = getMean(cl, "pos");
  var len = (type == "INS") ? 1: getMean(cl, "len");
  var len_disp = (type == "INS") ? "*": len;
  var size = getMean(cl, "bpsize");

  var score = getReliabilityScore(Ls,Rs,size);

  svcStream.write({
    rname  : rname,
    start  : pos,
    end    : pos + len,
    type   : type,
    len    : len_disp,
    rname2 : rname2,
    score: score,
    others: {
      num: num,
      LR : [Ls,Rs].join('/')
    }
  });
}

/**
 * get an average value
 **/
function getMean(cl, name) {
  var sum = cl.reduce(function(ret, v) {
    return ret + Number(v[name]);
  }, 0);
  return Math.floor(sum/cl.length + 0.5);
}

/**
 * get reliablity score
 **/
function getReliabilityScore(Ls, Rs, size) {
  with (Math) {
    return floor(Ls + Rs - sqrt(pow(Ls, 2) + pow(Rs, 2)) + 0.5);
  }
}




if (__filename == process.argv[1]) {
  process.stdin.resume();

  cluster_svinfo(process.stdin, {
    SAVE_DIR: process.argv[2],
    MAX_DIFF: process.argv[3],
    MIN_CLUSTER_SIZE: process.argv[4]
  });
}

module.exports = cluster_svinfo;
