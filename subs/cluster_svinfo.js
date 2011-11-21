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
    fieldNum: 2,
    fieldSep: "\t",
    comment: "#"
  });

  /**
   * prepare initial values of clusters, prevs
   **/
  var clusters = {};
  var prevs = {};

  /**
   * set current svinfo to clusters
   **/
  function setCurrent(current, key) {
    if (!clusters[key]) {
      clusters[key] = [];
    }

    clusters[key].push(current);
    prevs[key] = current;
  }

  lines.on("data", function(line) {
    /**
     * sv info
     **/
    var current = JSON.parse(line.split('\t')[1]);

    var key = [current.type, current.rname, current.rname2].join('_');

    /**
     * get previous value
     **/
    var prev = prevs[key];

    /**
     * if there's no previous value, set current value and return
     **/
    if (!prev) {
      setCurrent(current, key);
      return;
    }


    /**
     * checking if prev and current are in different clusters
     **/
    if( ( Math.abs(prev.start - current.start) > MAX_DIFF)
      ||
      ( current.type != 'INS' && current.type != 'CTX' && Math.abs(prev.end - current.end) > MAX_DIFF)
      ||
      ( current.type == 'CTX' && Math.abs(prev.start2 - current.start2) > MAX_DIFF)
    ) {

      printSVInfo(svcStream, clusters[key],
        MIN_CLUSTER_SIZE // allowable minimum cluster size
      );
      clusters[key] = [];  // reset
    }

    setCurrent(current, key);
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
  var rname2 = cl[0].rname2;


  /**
   * the nubmer of Ls, Rs
   **/
  var Ls    = cl.filter(function(v) { return v.others.LR == "R" }).length;
  var Rs    = num - Ls;

  var type  = cl[0].type;
  var start = getMean(cl, "start");
  var start2 = getMean(cl, "start2");
  var len = (type == "INS") ? 1: getMean(cl, "len");
  if (isNaN(len)) {
    len = 1;
  }
  var len_disp = (type == "INS") ? "*": len;
  // var size = getMean(cl, "bpsize");
  // var score = getReliabilityScore(Ls,Rs,size);
  var score = getReliabilityScore(Ls,Rs);

  svcStream.write({
    rname  : rname,
    start  : start,
    // end    : start + len -1,
    end    : start + len,
    type   : type,
    len    : len_disp,
    rname2 : rname2,
    start2 : start2,
    score  : score,
    caller : 'clipcrop',
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
  try {
    var sum = cl.reduce(function(ret, v) {
      var num = Number(v[name]);
      if (isNaN(num)) {
        throw new Error();
      }
      return ret + num;
    }, 0);
    return Math.floor(sum/cl.length + 0.5);
  }
  catch (e) {
    return '*';
  }
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
