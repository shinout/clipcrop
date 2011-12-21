#!/usr/bin/env node

var Junjo = require("junjo");
var spawn = require("child_process").spawn;
var exec  = require("child_process").exec;
var fs = require("fs");
var cl = require("termcolor").define();
var AP = require("argparser");
var path = require("path");
var dirs = require('./config').dirs;

const MAPPERS = ['shrimp', 'bwa'];

var optionNames = {
  "bp_filter_parallel"  : 'the number of processes to use to filter breakpoints. default: 8',
  "max_diff"            : 'max difference within breakpoint cluster values. default: 2',
  "min_cluster_size"    : 'minimum cluster size to be a valid breakpoint. default: 10',
  "min_quality"         : 'minimum base quality score to allow, default: 5',
  "bases_around_break"  : 'number of extended bases around breakpoint to be mapped by clipped sequences. default: 1000',
  'sv_max_diff'         : 'max difference within breakpoint cluster values. default: 10',
  'sv_min_cluster_size' : 'minimum cluster size to be a valid SV. default: 10',
  'mapper'              : 'mapper : one of ' + MAPPERS.toString(),
  'mapper_threads'      : 'the number of threads the mapping tool uses. default: 8'
};

/**
 * usage
 **/
function showUsage() {
  console.error ('[usage]');
  console.egreen('\tclipcrop <sam file> <fasta file> [<fasta information json file>]');
  console.error ('[options]');
  console.error ('\t' + '--dir\tdirectory to put result files. default = basename(path)');
  Object.keys(optionNames).forEach(function(opname) {
    console.error('\t--' + opname + '\t' + optionNames[opname]);
  });
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
  .addValueOptions(Object.keys(optionNames))
  .parse();

  var samfile = p.getArgs(0);
  var fastafile = p.getArgs(1);
  var jsonfile = p.getArgs(2) || null;


  if (!samfile || !fastafile) {
    showUsage();
    process.exit();
  }


  var config = {
    SAM             : samfile,
    REFERENCE_FASTA : fastafile,
    REFERENCE_JSON  : jsonfile,
    OUTPUT_DIR      : p.getOptions("dir") || process.cwd()
  };

  Object.keys(optionNames).forEach(function(name) {
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
    BP_FILTER_PARALLEL  : 8,
    MAX_DIFF            : 2,
    MIN_CLUSTER_SIZE    : 10,
    MIN_QUALITY         : 5,
    MIN_SEQ_LENGTH      : 10,

    BASES_AROUND_BREAK  : 1000,

    SV_MAX_DIFF         : 10,
    SV_MIN_CLUSTER_SIZE : 10,

    MAPPER_THREADS      : 8
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
    BREAKPOINT_FASTA : path.normalize(config.OUTPUT_DIR + "/bp.fa"),
    MAPPED_SAM       : path.normalize(config.OUTPUT_DIR + "/mapped.sam")
  };


  var $j = new Junjo({
    destroy   : true,
    noTimeout : true,
    silent    : true
  });

  /**
   * checking file existence
   **/
  $j('check', function() {
    var ret = ["REFERENCE_FASTA","SAM"].every(function(name) {
      return fs.statSync(config[name]).isFile();
    });

    if (!ret || (config.REFERENCE_JSON && !fs.statSync(config.REFERENCE_JSON).isFile())) {
      throw new Error("file not found.");
    }
  });


  /**
   * checking SHRiMP
   **/
  $j('checkSHRiMP', function() {
    var shrimpDir = process.env['SHRIMP_FOLDER'];
    if (!shrimpDir || !fs.statSync(shrimpDir).isDirectory()) {
      return false;
    }

    shrimpDir = path.normalize(shrimpDir);

    // valid shrimp directory ?
    var pyscript = shrimpDir + '/utils/project-db.py';
    if (!fs.statSync(pyscript).isFile()) {
      return false;
    }

    var shrimpBin = shrimpDir + "/bin/gmapper-ls";
    if (!fs.statSync(pyscript).isFile()) {
      return false;
    }
    return true;
  });


  /**
   * checking bwa
   **/
  $j('checkBWA', function() {
    exec('which bwa', this.cb);
  })
  .post(function(e, out, err) {
    return !e && !err;
  });


  /**
   * select mapper
   **/
  $j('mapper', function(shrimp, bwa) {
    if (!shrimp && !bwa) {
      throw new Error('no external mapper available. You must install SHRiMP2 or bwa >=v0.5');
    }
    if (typeof config.MAPPER == 'string') {
      config.MAPPER = config.MAPPER.toLowerCase();
    }
    config.MAPPER = (MAPPERS.indexOf(config.MAPPER) >=0) ? config.MAPPER : (shrimp) ? 'shrimp' : 'bwa';

    if (config.MAPPER == 'shrimp' && !shrimp) {
      throw new Error('you must install SHRiMP2 and export $SHRIMP_FOLDER.');
    }

  })
  .after('checkSHRiMP', 'checkBWA');


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
    console.error('# BP FILTER PROCESSES : ' + cl.green(config.BP_FILTER_PARALLEL));
    console.error('# MAX BREAKPOINT DIFF : ' + cl.green(config.MAX_DIFF));
    console.error('# MIN BP CLUSTER SIZE : ' + cl.green(config.MIN_CLUSTER_SIZE));
    console.error('# MIN MEAN BASE QUAL  : ' + cl.green(config.MIN_QUALITY));
    console.error('# MIN SEQ LENGTH      : ' + cl.green(config.MIN_SEQ_LENGTH));
    console.error('# BASES AROUND BREAK  : ' + cl.green(config.BASES_AROUND_BREAK));
    console.error('# MAX SV DIFF         : ' + cl.green(config.SV_MAX_DIFF));
    console.error('# MIN SV CLUSTER SIZE : ' + cl.green(config.SV_MIN_CLUSTER_SIZE));
    console.error('# MAPPER              : ' + cl.green(config.MAPPER));
    console.error('# MAPPER THREADS      : ' + cl.green(config.MAPPER_THREADS));
    console.error('#############################');
  })
  .after("check", "mapper");

  /**
   * get raw breakpoints
   **/
  $j('rawbreaks', function() {
    var args = [dirs.SUBROUTINES + "rawbreaks.js", filenames.SAM, '--parallel', config.BP_FILTER_PARALLEL];
    var rawbreaks = spawn("node", args);
    console.egreen("node", args.join(' '));

    // show stderr
    to_stderr(rawbreaks.stderr, this);

    return rawbreaks;
  })
  .after("showinfo");


  /**
   * sort raw breakpoints
   **/
  $j('sort_bp', function(rawbreaks) {
    var args = ["-k10,10"];

    var sort = spawn("sort", args);
    rawbreaks.stdout.pipe(sort.stdin);

    // show stderr
    to_stderr(sort.stderr, this);

    sort.stdout.once("data", function() {
      console.egreen("sort", args.join(' '));
    });


    return sort;
  })
  .after("rawbreaks");


  /**
   * get breakpoint BED
   **/
  $j('bpbed', function(sort) {

    var args = [dirs.SUBROUTINES + "cluster_breaks.js",
      "bed", 
      config.MAX_DIFF, 
      config.MIN_CLUSTER_SIZE,
      config.MIN_QUALITY,
      config.MIN_SEQ_LENGTH
    ];

    var bpbed = spawn("node", args);

    sort.stdout.pipe(bpbed.stdin);
    var wstream = fs.createWriteStream(filenames.BREAKPOINT_BED);
    bpbed.stdout.pipe(wstream);

    bpbed.stdout.once("data", function() {
      console.egreen("node", args.join(' '));
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

    var args = [dirs.SUBROUTINES + "cluster_breaks.js",
      "fastq", 
      config.MAX_DIFF, 
      config.MIN_CLUSTER_SIZE,
      config.MIN_QUALITY,
      config.MIN_SEQ_LENGTH
    ];

    var bpfastq = spawn("node", args);

    sort.stdout.pipe(bpfastq.stdin);
    var fastqStream = fs.createWriteStream(filenames.BREAKPOINT_FASTQ);
    bpfastq.stdout.pipe(fastqStream);

    bpfastq.stdout.once("data", function() {
      console.egreen("node", args.join(' '));
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

    var args = [dirs.SUBROUTINES + "bpfastagen.js",
      filenames.BREAKPOINT_BED,
      filenames.REFERENCE_FASTA,
      "-l", config.BASES_AROUND_BREAK,
      "-j", filenames.REFERENCE_JSON
    ];

    var bpfastagen = spawn("node", args);

    console.egreen("node", args.join(' '));

    var wstream = fs.createWriteStream(filenames.BREAKPOINT_FASTA);
    bpfastagen.stdout.pipe(wstream);

    // show stderr
    to_stderr(bpfastagen.stderr, this);

    wstream.on("close", this.cb);
  })
  .after("bpbed");


  /**
   * mapping
   * FASTA + FASTQ -> SAM
   **/
  $j("mapping", function() {
    switch (config.MAPPER) {
      case 'bwa':
        require(dirs.SUBROUTINES + 'mapping_bwa').exec(
          filenames.BREAKPOINT_FASTA, // 1 fasta
          filenames.BREAKPOINT_FASTQ, // 2 fastq
          config.OUTPUT_DIR,          // 3 SAVE_DIR
          filenames.MAPPED_SAM,       // 4 sam (name)
          config.MAPPER_THREADS       // 5 cpus
        , this.cb);
        return;

      case 'shrimp':
        require(dirs.SUBROUTINES + 'mapping_shrimp').exec(
          filenames.BREAKPOINT_FASTA, // 1 fasta
          filenames.BREAKPOINT_FASTQ, // 2 fastq
          config.OUTPUT_DIR,          // 3 SAVE_DIR
          filenames.MAPPED_SAM,       // 4 sam (name)
          config.MAPPER_THREADS       // 5 cpus
        , this.cb);
        return;
    }
  })
  .after('bpfastq', 'bpfastagen');



  /**
   * call SVs
   **/
  $j("sam2sv", function() {
    var args = [dirs.SUBROUTINES + "sam2sv.js", filenames.MAPPED_SAM];
    var sam2sv = spawn("node", args);


    // show stderr
    to_stderr(sam2sv.stderr, this);

    sam2sv.stdout.once("data", function() {
      console.egreen("node", args.join(' '));
    });

    return sam2sv;
  })
  .eshift()
  .after("mapping");


  /**
   * sort called SVs
   **/
  $j('sort_sv', function(sam2sv) {
    /**
     * column number to sort
     **/
    var n = 1;
    var args = ["-k" + n + "," + n];

    var sort = spawn("sort", args);
    sam2sv.stdout.pipe(sort.stdin);

    // show stderr
    to_stderr(sort.stderr, this);

    sort.stdout.once("data", function() {
      console.egreen("sort", args.join(' '));
    });


    return sort;
  })
  .after("sam2sv");




  /**
   * evaluate called SVs
   **/
  $j("cluster_svinfo", function(sort) {
    var args = [dirs.SUBROUTINES + "cluster_svinfo.js",
      filenames.REFERENCE_FASTA,
      filenames.REFERENCE_JSON,
      config.OUTPUT_DIR, // SAVE_DIR
      config.SV_MAX_DIFF,
      config.SV_MIN_CLUSTER_SIZE
    ];

    var clusterSV = spawn("node", args);


    // show stderr
    to_stderr(clusterSV.stderr, this);

    sort.stdout.on("end", function() {
      console.egreen("node", args.join(' '));
    });

    sort.stdout.pipe(clusterSV.stdin);

    clusterSV.stdout.pipe(process.stdout);
    clusterSV.stdout.on('end', this.cb);

  })
  .eshift()
  .after("sort_sv");


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

