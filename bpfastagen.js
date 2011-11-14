var AP  = require('argparser');
var fs  = require('fs');
var dna = require('dna');
var FASTAReader = require('fastareader');
var FASTAName = require("./fastaname");

var FASTA_LINELEN = 50;

function main() {

  function showUsage() {
    console.error("[synopsis]");
    console.error("node " + require('path').basename(process.argv[1]) + 
    " [-j|--json <jsonfile>] [-l|--length=1000] <breakpoint bed file> <fasta file>");
    console.error('breakpoint bed file columns:\n rname\tstart\tend\tLR\tother info');
  }


  var p = new AP().addValueOptions(['length', 'l', 'json', 'j']).parse();

  var bp = p.getArgs(0);
  if (!bp) {
    showUsage();
    process.exit();
  }

  if (! require('path').existsSync(bp)) {
    console.error(bp + ': No such file.');
    process.exit();
  }

  var fastafile = p.getArgs(1);
  if (!fastafile) {
    showUsage();
    process.exit();
  }

  if (! require('path').existsSync(fastafile)) {
    console.error(fastafile+ ': No such file.');
    process.exit();
  }

  var jsonfile = p.getOptions('j', 'json');

  try {
    var json = require(jsonfile);
  }
  catch (e) {
    var json = undefined;
  }


  var len = parseInt(p.getOptions('l', 'length') || 1000);
  len = isNaN(len) ? 1000 : len;

  // execute

  fs.readFileSync(bp, 'utf-8')
  .split('\n')

  // filter comment and empty lines
  .filter(function(line) {
    return (line && line.charAt(0) != '#' && line.split('\t').length >= 3);
  })
  
  // create object
  .map(function(line) {
    var bpinfo = line.split('\t');
    return {
      LR    : bpinfo[3],
      pos   : Number(bpinfo[1]),
      rname : bpinfo[0]
    };
  })

  // sort (asc)
  .sort(function(v1, v2) {
    var v1code = dna.getChromCode(v1.rname);
    var v2code = dna.getChromCode(v2.rname);
    if (v1code == v2code) {
      return (v1.pos > v2.pos) ? 1 : -1;
    }
    else {
      return (v1code > v2code) ? 1 : -1;
    }
  })

  //unique
  .filter((function() {
    var prev;
    return function(v) {
      var bool = (!prev || prev != v.pos);
      prev = v.pos;
      return bool;
    }
  })())

  // make start, end
  .map(function(v) {
    v.start = v.pos - len;
    v.end   = v.pos + len;
    return v;
  })
  .filter(function(v) {
    return v.start > 0;
  })

  // get ranges
  .filter((function() {
    var prev;
    return function(v) {
      var bool = (!prev || prev.end <= v.start || prev.rname != v.rname);
      if (!bool) {
        prev.end = v.end;
      }
      else {
        prev = v;
      }
      return bool;
    }
  })())

  // get fasta
  .forEach( (function() {
    // return function(v) { console.log(v); }

    var fastas = new FASTAReader(fastafile, json);
    return function(v) {
      try {
        var bases = fastas.fetch(v.rname, v.start, v.end - v.start + 1);
      }
      catch (e) {
        //console.error(e);
        return false;
      }
      var fastaName = FASTAName.stringify(v);
      console.log(">" + fastaName);

      while (bases) {
        console.log(bases.slice(0, FASTA_LINELEN));
        bases = bases.slice(FASTA_LINELEN);
      }
      console.log("");
    }
  })());
}


if (__filename == process.argv[1]) {
  main();
}
