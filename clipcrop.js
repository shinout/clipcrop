#!/usr/bin/env node

var Junjo = require("junjo");
var spawn = require("child_process").spawn;
var exec  = require("child_process").exec;
var fs = require("fs");
var cl = require("termcolor").define();
var AP = require("argparser");
var path = require("path");
var dirs = require('./config').dirs;


/**
 * usage
 **/
function showUsage() {
  console.error ('[usage]');
  console.egreen('\tclipcrop <sam file> <fasta file> [<fasta information json file>]');
  console.error ('[options]');
  console.error ('\t' + '--dir\tdirectory to put result files. default = basename(path)');
}

/**
 * entry function
 **/
function main() {

  var p = new AP()
  .addOptions([
  ])
  .addValueOptions([
    'dir',
  ])
  .parse();

  var samfile = p.getArgs(0);
  var fastafile = p.getArgs(1);
  var jsonfile = p.getArgs(2) || null;


  if (!samfile || !fastafile) {
    showUsage();
    process.exit();
  }


  var config = {
    SAM              : samfile,
    REFERENCE_FASTA  : fastafile,
    REFERENCE_JSON   : jsonfile,
    OUTPUT_DIR       : p.getOptions("dir") || process.cwd()
  };

  ["max_diff", "min_cluster_size", "min_quality"].forEach(function(name) {
    var val = p.getOptions(name);
    if (val !== false && val !== undefined) config[name.toUpperCase()] = val;
  });

  clipcrop(config);
}



/**
 * execute clipcrop
 *
 * @param config
 * @param callback
 **/
function clipcrop(config, callback) {
  config || (config = {});


  var defaultConfig = {
    /**
     * parameters
     **/
    MAX_DIFF            : 2,
    MIN_CLUSTER_SIZE    : 10,
    MIN_QUALITY         : 5,
    MIN_SEQ_LENGTH      : 10,

    BASES_AROUND_BREAK  : 1000,

    SV_MAX_DIFF         : 3,
    SV_MIN_CLUSTER_SIZE : 10,

    BWA_THREADS         : 8
  };

  config.__proto__ = defaultConfig;


  var filenames = {
    /**
     * input files (from config)
     **/
    REFERENCE_FASTA  : config.REFERENCE_FASTA,
    REFERENCE_JSON   : config.REFERENCE_JSON,
    SAM              : config.SAM,

    /**
     * output files
     **/
    BREAKPOINT_BED   : path.normalize(config.OUTPUT_DIR + "/bp.bed"),
    BREAKPOINT_FASTQ : path.normalize(config.OUTPUT_DIR + "/bp.fastq"),
    BREAKPOINT_FASTA : path.normalize(config.OUTPUT_DIR + "/bp.fasta"),
    MAPPED_SAI       : path.normalize(config.OUTPUT_DIR + "/mapped.sai"),
    MAPPED_SAM       : path.normalize(config.OUTPUT_DIR + "/mapped.sam"),
    SV_BED           : path.normalize(config.OUTPUT_DIR + "/sv.bed")
  };


  var $j = new Junjo({
    destroy: true,
    noTimeout: true,
    silent: true
  });

  /**
   * check input files, environments
   *
   * file existence
   * bwa
   * sort
   *
   **/
  $j('check', function() {
    var ret = ["REFERENCE_FASTA","SAM"].every(function(name) {
      return fs.statSync(config[name]).isFile();
    });
    if (!ret || (config.REFERENCE_JSON && !fs.statSync(config.REFERENCE_JSON).isFile())) {
      throw new Error("file not found.");
    }

    exec('which bwa', this.callbacks());
    // exec('which sort', this.callbacks());
  })
  .post(function(e, out, err) {
    if (e || err) {
      throw new Error("bwa is required.");
    }
  });


  /**
   * show config information
   **/
  $j('showinfo', function() {
    console.error('#############################');
    console.error('# INPUT INFORMATION');
    console.error('# SAM FILE            : ' + cl.green(config.SAM));
    console.error('# FASTA FILE          : ' + cl.green(config.REFERENCE_FASTA));
    console.error('# JSON FILE           : ' + cl.green(config.REFERENCE_JSON));
    console.error('# OUTPUT DIR          : ' + cl.green(config.OUTPUT_DIR));
    console.error('# MAX BREAKPOINT DIFF : ' + cl.green(config.MAX_DIFF));
    console.error('# MIN BP CLUSTER SIZE : ' + cl.green(config.MIN_CLUSTER_SIZE));
    console.error('# MIN MEAN BASE QUAL  : ' + cl.green(config.MIN_QUALITY));
    console.error('# MIN SEQ LENGTH      : ' + cl.green(config.MIN_SEQ_LENGTH));
    console.error('# BASES AROUND BREAK  : ' + cl.green(config.BASES_AROUND_BREAK));
    console.error('# BWA THREADS         : ' + cl.green(config.BWA_THREADS));
    console.error('#############################');
  })
  .after("check");


  /**
   * get raw breakpoints
   **/
  $j('rawbreaks', function() {
    var rawbreaks = spawn("node", [dirs.SUBROUTINES + "rawbreaks.js", filenames.SAM]);
    console.egreen("breakpoint caller is running");

    // show stderr
    to_stderr(rawbreaks.stderr, this);

    return rawbreaks;
  })
  .after("check");


  /**
   * sort raw breakpoints
   **/
  $j('sort_bp', function(rawbreaks) {

    var sort = spawn("sort", ["-k10,10"]);
    rawbreaks.stdout.pipe(sort.stdin);

    // show stderr
    to_stderr(sort.stderr, this);

    sort.stdout.once("data", function() {
      console.egreen("sort_bp is running.");
    });


    return sort;
  })
  .after("rawbreaks");


  /**
   * get breakpoint BED
   **/
  $j('bpbed', function(sort) {

    var bpbed = spawn("node", [dirs.SUBROUTINES + "cluster_breaks.js",
      "bed", 
      config.MAX_DIFF, 
      config.MIN_CLUSTER_SIZE,
      config.MIN_QUALITY,
      config.MIN_SEQ_LENGTH
    ]);

    sort.stdout.pipe(bpbed.stdin);
    var wstream = fs.createWriteStream(filenames.BREAKPOINT_BED);
    bpbed.stdout.pipe(wstream);

    bpbed.stdout.once("data", function() {
      console.egreen("cluster_breaks (bed) is running.");
    });


    // show stderr
    to_stderr(bpbed.stderr, this);



    wstream.on("close", this.cb);
  })
  .after("sort_bp");


  /**
   * get breakpoint FASTQs
   **/
  $j('bpfastq', function(sort) {

    var bpfastq = spawn("node", [dirs.SUBROUTINES + "cluster_breaks.js",
      "fastq", 
      config.MAX_DIFF, 
      config.MIN_CLUSTER_SIZE,
      config.MIN_QUALITY,
      config.MIN_SEQ_LENGTH
    ]);

    sort.stdout.pipe(bpfastq.stdin);
    var fastqStream = fs.createWriteStream(filenames.BREAKPOINT_FASTQ);
    bpfastq.stdout.pipe(fastqStream);

    bpfastq.stdout.once("data", function() {
      console.egreen("cluster_breaks (fastq) is running.");
    });

    // show stderr
    to_stderr(bpfastq.stderr, this);


    fastqStream.on("close", this.cb);
  })
  .after("sort_bp");


  /**
   * get FASTAs around breakpoints
   **/
  $j("bpfastagen", function() {
    console.egreen("bpfastagen.js is running");

    var bpfastagen = spawn("node", [dirs.SUBROUTINES + "bpfastagen.js",
      filenames.BREAKPOINT_BED,
      filenames.REFERENCE_FASTA,
      "-l", config.BASES_AROUND_BREAK,
      "-j", filenames.REFERENCE_JSON
    ]);

    var wstream = fs.createWriteStream(filenames.BREAKPOINT_FASTA);
    bpfastagen.stdout.pipe(wstream);

    // show stderr
    to_stderr(bpfastagen.stderr, this);

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


  /**
   * call SVs
   **/
  $j("sam2sv", function() {
    var sam2sv = spawn("node", [dirs.SUBROUTINES + "sam2sv.js", filenames.MAPPED_SAM]);


    // show stderr
    to_stderr(sam2sv.stderr, this);

    sam2sv.stdout.once("data", function() {
      console.egreen("sam2sv is running.");
    });

    return sam2sv;
  })
  .eshift()
  .after("bwa_samse");


  /**
   * sort called SVs
   **/
  $j('sort_sv', function(sam2sv) {
    /**
     * column number to sort
     **/
    var n = 8;

    var sort = spawn("sort", ["-k" + n + "," + n]);
    sam2sv.stdout.pipe(sort.stdin);

    // show stderr
    to_stderr(sort.stderr, this);

    sort.stdout.once("data", function() {
      console.egreen("sort_sv is running.");
    });


    return sort;
  })
  .after("sam2sv");




  /**
   * evaluate called SVs
   **/
  $j("cluster_svinfo", function(sort) {
    var clusterSV = spawn("node", [dirs.SUBROUTINES + "cluster_svinfo.js",
      config.OUTPUT_DIR, // SAVE_DIR
      config.SV_MAX_DIFF,
      config.SV_MIN_CLUSTER_SIZE
    ]);

    sort.stdout.pipe(clusterSV.stdin);

    // show stderr
    to_stderr(clusterSV.stderr, this);

    clusterSV.stdout.once("data", function() {
      console.egreen("cluster_svinfo is running.");
    });

    return clusterSV;

  })
  .eshift()
  .after("sort_sv");


  /**
   * sort clustered SVs by reliability
   **/
  $j('sort_sv_cluster', function(clusterSV) {
    /**
     * sort by reliablity score
     **/
    var n = 6;

    var sort = spawn("sort", ["-nrk" + n + "," + n]); // numsort, descend
    clusterSV.stdout.pipe(sort.stdin);

    // show stderr
    to_stderr(sort.stderr, this);

    sort.stdout.once("data", function() {
      console.egreen("sort_sv_cluster is running.");
    });

    var wstream = fs.createWriteStream(filenames.SV_BED);

    sort.stdout.pipe(wstream);
    wstream.on("close", this.cb);

  })
  .after("cluster_svinfo");




  /**
   * on end
   **/
  $j.on("end", function(err) {
    var stderrs = this.$.errlogs;

    if (err || (stderrs && this.$.errlogs.join('').trim())) {
      console.ered("FAILED.");
      if (err) console.ered(err.stack);
    }
    else {
      console.egreen("SUCCEEDED!");
    }
    process.exit();
  });

  if (typeof callback == "function") {
    $j.on("end", callback);
  }


  /**
   * execute
   **/
  $j.run();
}


/**
 * reports error of child process's stderr streams to process.stderr
 * 
 * @param rStream: ReadableStream
 * @param $jn    : instance of Junjo
 **/
function to_stderr(rStream, $jn) {
  rStream.setEncoding('utf8');
  rStream.on('data', function(d) {
    var str = d.trim();
    if (str) {
      console.ered(str);
      if (!$jn.$.errlogs) {
        $jn.$.errlogs = [];
      }
      $jn.$.errlogs.push(str);
    }
  });
}



/**
 * exporting subroutines
 **/
fs.readdirSync(dirs.SUBROUTINES).forEach(function(file) {
  clipcrop[file.slice(0, -3)] = require(dirs.SUBROUTINES + file);
});


/**
 * exporting format info
 **/
fs.readdirSync(dirs.FORMATS).forEach(function(file) {
  clipcrop[file.slice(0, -3)] = require(dirs.FORMATS + file);
});

/**
 * exporting SVClassifyStream
 **/
clipcrop.SVClassifyStream = require(dirs.SV_CLASSIFY + 'SVClassifyStream');

module.exports = clipcrop;

/**
 * if called from command (not required by other js files)
 **/
if (process.argv[1].match('/([^/]+?)(\.js)?$')[1] == __filename.match('/([^/]+?)(\.js)?$')[1]) { 
  main();
}

