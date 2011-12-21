var Junjo = require('junjo');
var exec  = require("child_process").exec;
require('termcolor').define;

var $j = new Junjo({
  noTimeout: true,
  destroy  : true
});

$j.inputs(['fasta', 'fastq', 'sam', 'cpus']);


/**
 * procject-db
 **/
$j("project_db", function(fasta) {
  var shrimpDir = process.env['SHRIMP_FOLDER'];
  var pyscript = shrimpDir + '/utils/project-db.py';
  var cmd = ["python", pyscript, '--shrimp-mode', 'ls', fasta].join(" ");

  console.egreen(cmd);
  exec(cmd, this.cb);
})
.using('fasta')
.eshift();


/**
 * mapping
 **/
$j("mapping", function(fastq, sam, cpus) {
  var shrimpDir = process.env['SHRIMP_FOLDER'];
  var shrimpBin = shrimpDir + "/bin/gmapper-ls";
  var cmd = [shrimpBin,
    fastq,
    '-L bp-ls',
    '--qv-offset 33',
    '-Q',
    '-E',
    '-N', cpus,
    '>', sam
  ].join(" ");

  console.egreen(cmd);
  exec(cmd, this.cb);
})
.using('fastq', 'sam', 'cpus', 'project_db')
.eshift();


module.exports = $j;
