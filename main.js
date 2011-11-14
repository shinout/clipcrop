var spawn = require("child_process").spawn;
var fs = require("fs");

var config = {
  MAX_DIFF: 2,
  MIN_CLUSTER_SIZE: 10,
  MIN_QUALITY: 5,
  MIN_SEQ_LENGTH: 10
};

var filenames = {
  BREAKPOINT_BED : __dirname + "/bp.bed",
  BREAKPOINT_FASTQ : __dirname + "/bp.fastq",
};

/**
 * get raw breakpoints
 **/
var rawbreaks = spawn("node", [__dirname + "/rawbreaks.js"]);

/**
 * sort raw breakpoints
 **/
var sort = spawn("sort", ["-k10,10"]);
rawbreaks.stdout.pipe(sort.stdin);

/**
 * get breakpoint BED
 **/
var bpbed = spawn("node", [__dirname + "/cluster_breaks.js",
  "bed", 
  config.MAX_DIFF, 
  config.MIN_CLUSTER_SIZE,
  config.MIN_QUALITY,
  config.MIN_SEQ_LENGTH
]);
sort.stdout.pipe(bpbed.stdin);
bpbed.stdout.pipe(fs.createWriteStream(filenames.BREAKPOINT_BED));


/**
 * get breakpoint FASTQs
 **/
var bpfastq = spawn("node", [__dirname + "/cluster_breaks.js",
  "fastq", 
  config.MAX_DIFF, 
  config.MIN_CLUSTER_SIZE,
  config.MIN_QUALITY,
  config.MIN_SEQ_LENGTH
]);
sort.stdout.pipe(bpfastq.stdin);
bpfastq.stdout.pipe(fs.createWriteStream(filenames.BREAKPOINT_FASTQ));

