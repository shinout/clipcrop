var Junjo = require('junjo');
var exec  = require("child_process").exec;

require('termcolor').define;

var $j = new Junjo({
  noTimeout: true,
  destroy  : true
});

$j.inputs(['fasta', 'fastq', 'sai', 'sam', 'cpus']);


/**
 * bwa index
 **/
$j("bwa_index", function(fasta) {
  var cmd = ["bwa index", fasta].join(" ");

  console.egreen(cmd);
  exec(cmd, this.cb);
})
.using('fasta')
.eshift();


/**
 * bwa aln
 **/
$j("bwa_aln", function(fasta, fastq, sai, cpus) {
  var cmd = ["bwa aln", "-t", cpus, fasta, fastq, ">" + sai ].join(" ");

  console.egreen(cmd);
  exec(cmd, this.cb);
})
.using('fasta','fastq', 'sai', 'cpus', 'bwa_index')
.eshift();


/**
 * bwa samse
 **/
$j("bwa_samse", function(fasta, fastq, sai, sam) {
  var cmd = ["bwa samse", "-f", sam, fasta, sai, fastq ].join(" ");

  console.egreen(cmd);
  exec(cmd, this.cb);
})
.eshift()
.using('fasta', 'fastq', 'sai', 'sam', "bwa_aln");

module.exports = $j;
