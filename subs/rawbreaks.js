/**
 * SAM/BAM format -> clip
 * @author  SHIN Suzuki
 * @version 0.0.1
 **/

var fs = require('fs');
var termcolor = require("termcolor").define();
var MasterWorker = require("master-worker");
var SamAlignment = require("samreader").SamAlignment;
var AP = require('argparser');
var dna = require('dna');

/**
 * print raw breakpoint information bed
 *
 * @param input  : stream or filename
 **/
function rawbreaks(input, options) {
  options || (options = {});

  if (!isReadableStream(input)) {

    /**
     * if sam format, then use master-worker
     **/
    if (options.format == "sam") {
      if (options.parallel) {
        options.parallel = Number(options.parallel);
      }

      var parallel = (isNaN(options.parallel) || !options.parallel) ? 8 : options.parallel;

      var mw = new MasterWorker.processLines({
        parallel: parallel,
        file: input,
        each: callRawBreaksImpl,
        requires: {
          SamAlignment: ["samreader", "SamAlignment"],
          dna: "dna"
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
    var startend = dna.getStartEnd(bp, 1);
    var start = startend[0];
    var end   = startend[1];


    sortkey = rname + "_" + d.pad(start, 10);
    console.log([rname, start, end, type, cigar, seq, qual, strand, name, sortkey].join("\t"));
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


if (process.argv[1] == __filename) {
  var p = new AP().addValueOptions(['parallel']).parse();

  var filename = p.getArgs(0);
  if (!filename) {
    console.error("require sam file");
    process.exit();
  }
  format = filename.slice(filename.lastIndexOf(".") + 1);

  rawbreaks(filename, {
    format: format,
    parallel: p.getOptions('parallel')
  });
}

module.exports = rawbreaks;
