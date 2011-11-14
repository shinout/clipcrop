/**
 * SAM/BAM format -> clip
 * @author  SHIN Suzuki
 * @version 0.0.1
 **/

var fs = require('fs');
var termcolor = require("termcolor").define();
var MasterWorker = require("master-worker");
var SamAlignment = require("samreader").SamAlignment;

/**
 * print raw breakpoint information bed
 *
 * @param input  : stream or filename
 **/
function callRawBreaks(input, options) {
  options || (options = {});

  if (!isReadableStream(input)) {

    /**
     * if sam format, then use master-worker
     **/
    if (options.format == "sam") {

      var parallel = 8;

      console.egreen("start reading SAM file with %s CPUs using master-worker", parallel);

      var mw = new MasterWorker.processLines({
        parallel: parallel,
        file: input,
        each: callRawBreaksImpl,
        requires: {
          SamAlignment: ["samreader", "SamAlignment"],
        },
        master: function(i) {
          return {
            noN: false,
            pad: pad
          };
        }

      }, function(results) {
        var total = results.reduce(function(total, v, k) {
          return total + v.total;
        },0);
        console.egreen("total lines", total);
      });
    }
  }
}


/**
 * if a given line contains breakpoint CIGAR, calculate breakpoint and print it.
 **/
function callRawBreaksImpl(line, result, d) {
  if (!result.total) result.total = 0;

  var data = line.split("\t");
  if (data.length < 6) return;

  var matched = data[5].match("S");
  if (!matched) return;

  var ali = new SamAlignment(line);
  if (!ali.valid || ali.flags.unmapped) return;

  var breaks = {
    L: ali.cigar.matchL(),
    R: ali.cigar.matchR()
  };

  Object.keys(breaks).forEach(function(type) {
    var len = breaks[type];
    if (!len) return;

    var strand = (ali.flags.reversed) ? '-' : '+';
    var cigar = ali.cigar.str;
    var rname = ali.rname;
    var name  = ali.name;
 
    if (type == 'L') {
      var bp = ali.cigar.getLBreak(ali.pos);
      var seq = ali.seq.slice(0, len);
      if (data.noN && seq.match(/^[N]+$/)) return; // filter NNNNN....
      var qual = ali.qual.slice(0, len);
    }
    else {
      var bp  = ali.cigar.getRBreak(ali.pos);
      var seq = ali.seq.substr(-len);
      if (data.noN && seq.match(/^[N]+$/)) return; // filter NNNNN....
      var qual = ali.qual.substr(-len);
    }

    result.total++;
    sortkey = rname + "_" + d.pad(bp, 10);
    console.log([rname, bp, bp+1, type, cigar, seq, qual, strand, name, sortkey].join("\t"));
  });
}


function pad(n, order) {
  n = n.toString();
  var ret = [n];
  for (var i=n.length; i<=order;i++) {
    ret.unshift("0");
  }
  return ret.join("");
}





/**
 * check if val is a readableStream or not
 **/
function isReadableStream(val) {
  return val && (typeof val.pipe == "function")
             && (typeof val.on== "function");
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
             && (typeof val.on== "function");
}


callRawBreaks(__dirname + "/sample.sam", {format: "sam"});
