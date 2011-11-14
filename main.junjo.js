var Junjo = require("junjo");
var spawn = require("child_process").spawn;
var exec  = require("child_process").exec;
var fs = require("fs");
var termcolor = require("termcolor").define();

var config = {
  MAX_DIFF           : 2,
  MIN_CLUSTER_SIZE   : 10,
  MIN_QUALITY        : 5,
  MIN_SEQ_LENGTH     : 10,
  BASES_AROUND_BREAK : 1000,
  BWA_THREADS        : 8
};


var filenames = {
  REFERENCE_FASTA  : "/home/shinout/data/hg19.clean.fasta",
  REFERENCE_JSON   : "/home/shinout/data/hg19.clean.fasta.json",
  SAM              : __dirname + "/data/sample.sam",
  BREAKPOINT_BED   : __dirname + "/data/bp.bed",
  BREAKPOINT_FASTQ : __dirname + "/data/bp.fastq",
  BREAKPOINT_FASTA : __dirname + "/data/bp.fasta",
  MAPPED_SAI       : __dirname + "/data/mapped.sai",
  MAPPED_SAM       : __dirname + "/data/mapped.sam",
};



var $j = new Junjo({
  destroy: true,
  noTimeout: true
});

/**
 * get raw breakpoints
 **/
$j('rawbreaks', function() {
  return spawn("node", [__dirname + "/rawbreaks.js", filenames.SAM]);
});


/**
 * sort raw breakpoints
 **/
$j('sort', function(rawbreaks) {

  var sort = spawn("sort", ["-k10,10"]);
  rawbreaks.stdout.pipe(sort.stdin);
  return sort;
})
.after("rawbreaks");


/**
 * get breakpoint BED
 **/
$j('bpbed', function(sort) {

  var bpbed = spawn("node", [__dirname + "/cluster_breaks.js",
    "bed", 
    config.MAX_DIFF, 
    config.MIN_CLUSTER_SIZE,
    config.MIN_QUALITY,
    config.MIN_SEQ_LENGTH
  ]);

  sort.stdout.pipe(bpbed.stdin);
  var wstream = fs.createWriteStream(filenames.BREAKPOINT_BED);
  bpbed.stdout.pipe(wstream);
  wstream.on("close", this.cb);
})
.after("sort");


/**
 * get breakpoint FASTQs
 **/
$j('bpfastq', function(sort) {

  var bpfastq = spawn("node", [__dirname + "/cluster_breaks.js",
    "fastq", 
    config.MAX_DIFF, 
    config.MIN_CLUSTER_SIZE,
    config.MIN_QUALITY,
    config.MIN_SEQ_LENGTH
  ]);

  sort.stdout.pipe(bpfastq.stdin);
  var fastqStream = fs.createWriteStream(filenames.BREAKPOINT_FASTQ);
  bpfastq.stdout.pipe(fastqStream);
  fastqStream.on("close", this.cb);
})
.after("sort");


/**
 * get FASTAs around breakpoints
 **/
$j("bpfastagen", function() {

  var bpfastagen = spawn("node", [__dirname + "/bpfastagen.js",
    filenames.BREAKPOINT_BED,
    filenames.REFERENCE_FASTA,
    "-l", config.BASES_AROUND_BREAK,
    "-j", filenames.REFERENCE_JSON
  ]);

  var wstream = fs.createWriteStream(filenames.BREAKPOINT_FASTA);
  bpfastagen.stdout.pipe(wstream);
  wstream.on("close", this.cb);
})
.after("bpbed");


/**
 * bwa index
 **/
$j("bwa_index", function() {
  var cmd = ["bwa index",
    filenames.BREAKPOINT_FASTA
  ].join(" ");

  console.egreen(cmd);
  exec(cmd, this.cb);
})
.eshift()
.after("bpfastagen");


/**
 * bwa aln
 **/
$j("bwa_aln", function() {
  var cmd = ["bwa aln", 
    "-t", config.BWA_THREADS,
    filenames.BREAKPOINT_FASTA,
    filenames.BREAKPOINT_FASTQ,
    ">" + filenames.MAPPED_SAI
  ].join(" ");

  console.egreen(cmd);
  exec(cmd, this.cb);
})
.eshift()
.after("bwa_index");


/**
 * bwa samse
 **/
$j("bwa_samse", function() {
  var cmd = ["bwa samse",
    "-f", filenames.MAPPED_SAM,
    filenames.BREAKPOINT_FASTA,
    filenames.MAPPED_SAI,
    filenames.BREAKPOINT_FASTQ
  ].join(" ");

  console.egreen(cmd);
  exec(cmd, this.cb);
})
.eshift()
.after("bwa_aln");



$j.run();
