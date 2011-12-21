var Junjo = require('junjo');
var exec  = require("child_process").exec;
require('termcolor').define;

var $j = new Junjo({
  noTimeout: true,
  destroy  : true
});

$j.inputs(['fasta', 'fastq', 'dir', 'sam', 'cpus']);


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
 * mv
 **/
$j("mv", function(fasta, dir) {
  var name = require('path').basename(fasta, '.fa');
  var cmd = ["mv", name + '-ls.*', dir].join(' ');

  console.egreen(cmd);
  exec(cmd, this.cb);
})
.using('fasta', 'dir', 'project_db')
.eshift();


/**
 * mapping
 **/
$j("mapping", function(fasta, fastq, dir, sam, cpus) {
  var name = require('path').basename(fasta, '.fa');

  var shrimpDir = process.env['SHRIMP_FOLDER'];
  var shrimpBin = shrimpDir + "/bin/gmapper-ls";
  var cmd = [shrimpBin,
    fastq,
    '-L', dir + '/' + name + '-ls',
    '--qv-offset 33',
    '-Q',
    '-E',
    '-o', 5,
    '-N', cpus,
    '>', sam
  ].join(" ");

  console.egreen(cmd);
  exec(cmd, this.cb);
})
.using('fasta', 'fastq', 'dir', 'sam', 'cpus', 'mv')
.eshift();


module.exports = $j;
