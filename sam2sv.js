var SR = require('samreader');
var fs = require("fs");
var BPInfo = require("./bpinfo");
var FASTAName = require("./fastaname");
// require("termcolor").define;

/**
 * sam2sv
 * call SVs from a sam file of clipping sequences
 **/
function sam2sv(samfile) {
  var sam = new SR(fs.createReadStream(samfile));

  sam.on('alignment', function(aln) {
    /**
     * get the original breakpoint which generated this clipped sequence
     **/
    var bp = BPInfo.parse(aln.name);

    var rev      = aln.flags.reversed;
    var unmapped = aln.flags.unmapped;

    /**
     * if unmapped, assumes INSERTION
     **/
    if (unmapped) {
      printSVInfo(bp.LR, 'INS', bp.pos, '*', bp.rname, '=', bp.size, bp.code);
      return;
    }

    /**
     * get mapped reference info from rname
     **/
    var f = FASTAName.parse(aln.rname);


    /**
     * if rname is different, assumes InterChromosomal Translocation
     **/
    if (f.code != bp.code) {
      // this flagment belongs to rname (not bp.rname)
      printSVInfo(bp.LR, 'ITX', bp.pos, f.start, f.rname, bp.rname, bp.size, bp.code);
      return;
    }

    /**
     * get the position of another breakpoint
     *
     * if original LR equals L, and not reversed,
     * or original LR equals R, and reversed,
     * then 
     **/
    var prebp = Number( (bp.LR == 'L' ^ rev)? (Number(aln.pos) + aln.cigar.len()) : aln.pos) + f.start -1;


    var pos   = (prebp >= bp.pos) ? bp.pos : prebp;

    var isDup = (bp.LR == 'L' ^ bp.pos > prebp);


    /**
     * if rev: INV
     *
     * if isDup: DUP
     * else DEL
     **/
    var type = (rev)? 'INV' : (isDup)? 'DUP' : 'DEL';

    printSVInfo(bp.LR, type, pos, Math.abs(prebp - bp.pos), f.rname, '=', bp.size, bp.code);
  });
}

/**
 * print SV information
 **/
function printSVInfo(LR, type, pos, len, rname, rname2, size, code) {
  var sortkey = [pad(code, 2), pad(pos, 10), pad(len, 9), LR, type].join("");
  console.log([LR, type, pos, len, rname, rname2, size, sortkey].join("\t"));
}


/**
 * padding zeros
 **/
function pad(n, order) {
  n = n.toString();
  var ret = [n];
  for (var i=n.length; i<=order;i++) {
    ret.unshift("0");
  }
  return ret.join("");
}



if (__filename == process.argv[1]) {
  sam2sv(process.argv[2]);
}

