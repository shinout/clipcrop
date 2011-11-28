var dirs = require('../config').dirs;
var termcolor = require("termcolor").define();
var LineStream = require("linestream");
var dna = require("dna");
var BPInfo = require(dirs.FORMATS + "bpinfo");
var SVClassifyStream = require(dirs.SV_CLASSIFY + 'SVClassifyStream');
var FASTAReader = require('fastareader');


/**
 * shows clustered SV (Structural Variation) info
 *
 * @param (string or ReadableStream) input (requires sorted data)
 * @param (object) config
 *
 **/
function cluster_svinfo(input, config) {
  var self = this;


  var RF_FASTA = config.RF_FASTA;
  var RF_JSON  = (config.RF_JSON) ? require(config.RF_JSON) : null;

  var MAX_DIFF = config.MAX_DIFF || 3;
  var MIN_CLUSTER_SIZE = config.MIN_CLUSTER_SIZE || 10;
  var SAVE_DIR = config.SAVE_DIR || (__dirname + '../');

  self.freader = new FASTAReader(RF_FASTA, RF_JSON);

  var svcStream = new SVClassifyStream(SAVE_DIR, {prefix: ''});

  svcStream.on('sv', function(svinfo, line) {
    console.log(line.trim());
  });

  var lines = new LineStream(input, {
    fieldNum: 2,
    fieldSep: "\t",
    comment: "#"
  });

  var clusters = {};

  /**
   * set current svinfo to clusters
   **/
  function setCurrent(current, key) {
    if (!clusters[key]) {
      clusters[key] = new Cluster();
    }

    clusters[key].push(current);
  }

  lines.on("data", function(line) {
    /**
     * sv info
     **/
    var current = JSON.parse(line.split('\t')[1]);

    /**
     * get the key of the cluster from current sv info
     **/
    var keys = [current.type, current.rname, current.rname2];

    /**
     * considering translocation type
     **/
    if (current.others.typenum) {
      keys.push(current.others.typenum);
    }

    var key = keys.join('_');



    /**
     * get value
     **/
    var cluster = clusters[key];

    /**
     * if there's no adequate cluster, set current value and return
     **/
    if (!cluster) {
      setCurrent(current, key);
      return;
    }


    /**
     * checking if cluster and current are in different clusters
     **/
    if( ( Math.abs(cluster.get('start') - current.start) > MAX_DIFF)
      ||
      ( current.type != 'INS' && current.type != 'CTX' && Math.abs(cluster.get('end') - current.end) > MAX_DIFF)
      ||
      ( current.type == 'CTX' && Math.abs(cluster.get('start2') - current.start2) > MAX_DIFF)
    ) {

      printSVInfo.call(self, svcStream, clusters[key],
        MIN_CLUSTER_SIZE // allowable minimum cluster size
      );
      clusters[key] = new Cluster();  // reset
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
  var self = this;

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
  var start = cl.get("start");
  var start2 = cl.get("start2");
  var len = (type == "INS") ? 1: cl.get("len");
  if (isNaN(len)) {
    len = 1;
  }
  var len_disp = (type == "INS") ? "*": len;
  // var size = cl.get("bpsize");
  // var score = getReliabilityScore(Ls,Rs,size);
  var score = getReliabilityScore(Ls,Rs);

  var svinfo = {
    rname  : rname,
    start  : start,        // 0-based coordinate system
    end    : start + len,  // 0-based coordinate system
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
  };

  var SVIsValid = isValidSV.call(self, svinfo);
  if (SVIsValid) {
    svcStream.write(svinfo);
  }
  else {
    // console.error('INVALID', svinfo);
  }
}

/**
 * Cluster Object
 **/

function Cluster() {
}

Cluster.prototype = new Array();

/**
 * get mean value
 **/
Cluster.prototype.get = function(key) {
  try {
    var total = this.reduce(function(t, v) {
      var num = Number(v[key]);
      if (isNaN(num)) {
        throw new Error();
      }
      return t + num;
    }, 0);
    return Math.floor(total / this.length + 0.5);
  }
  catch (e) {
    return '*';
  }
};


/**
 * get reliablity score
 **/
function getReliabilityScore(Ls, Rs, size) {
  with (Math) {
    return floor(Ls + Rs - sqrt(pow(Ls, 2) + pow(Rs, 2)) + 0.5);
  }
}



/**
 * check if SV is valid
 **/
function isValidSV(svinfo) {
  var self = this;
  var checks = [];
  
  if ( ['DUP', 'DEL', 'INV'].indexOf(svinfo.type) >= 0) {
    checks.push(svinfo.len > 1);
  }

  /*
  dna.getChromList(svinfo.rname).some(function(rname) {
    try {
      checks.push(!self.freader.hasN(rname, svinfo.start, svinfo.end - svinfo.start));
      return true;
    }
    catch (e) {
      return false;
    }
  });
  */

  return checks.every(function(v) {return v });
}





if (__filename == process.argv[1]) {
  process.stdin.resume();

  cluster_svinfo(process.stdin, {
    RF_FASTA: process.argv[2],
    RF_JSON : process.argv[3],
    SAVE_DIR: process.argv[4],
    MAX_DIFF: process.argv[5],
    MIN_CLUSTER_SIZE: process.argv[6]
  });
}

module.exports = cluster_svinfo;
