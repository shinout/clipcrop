ClipCrop
=========

description
------------
This is a tool for detecting structural variations using soft-clipping information
From [SAM](http://samtools.sourceforge.net/SAM1.pdf) files.


installation
-------------

### dependencies ###

ClipCrop uses [bwa](http://bio-bwa.sourceforge.net/) internally.

First *you have to install bwa* and add the binary to PATH env.


### install ClipCrop ###
ClipCrop is implemented in [Node.js](http://nodejs.org/).

For users who are used to Node.js, just

    $ npm install clipcrop


Of course, in the field of bioinformatics, Node.js is still not a major scripting language, 

You should install Node.js by its version manager called [nvm](https://github.com/creationix/nvm).

*Do not install Node.js from apt-get or other OS package managers!*

    $ git clone git://github.com/creationix/nvm.git ~/.nvm

    $ source ~/.nvm/nvm.sh

    $ nvm install v0.6.1

    $ nvm use v0.6.1

    $ npm install clipcrop


The installation of Node.js may take a long time, but be patient.

For later use, it is better to write the following lines to your .bashrc (or alternatives).

    source ~/.nvm/nvm.sh
    nvm use v0.6.1


usage
------
    $ clipcrop <sam file> <reference fasta file> [<fasta information json file>]

### args ###
<table>
<tr><th>sam file</th>
<td>SAM file with soft-clipping information. The recommended mapping tool is [bwa](http://bio-bwa.sourceforge.net/). </td></tr>

<tr><th>reference fasta file</th>
<td>reference genome used for mapping</td></tr>

<tr><th>fasta information json file (optional)</th>
<td>
JSON file for [FASTAReader](https://github.com/shinout/FASTAReader).

This file optional, and is used for faster reading of reference genomes.

See [README of FASTAReader](https://github.com/shinout/FASTAReader/blob/master/README.md) for more detail.
</td></tr>
</table>


### options ###

<table>
<tr><th>dir</th>
<td>directory to put result files. default = basename(path)</td></tr>

<tr><th>bp_filter_parallel</th>
<td>the number of processes to use to filter breakpoints. default: 8</td></tr>

<tr><th>max_diff</th>
<td>max difference within breakpoint cluster values. default: 2</td>
</tr>
<tr><th>min_cluster_size</th>
<td>minimum cluster size to be a valid breakpoint. default: 10</td> </tr>

<tr><th>min_quality</th>
<td>minimum base quality score to allow, default: 5</td> </tr>

<tr><th>bases_around_break</th>
<td>number of extended bases around breakpoint to be mapped by clipped sequences. default: 1000</td> </tr>

<tr><th>sv_max_diff</th>
<td>max difference within breakpoint cluster values. default: 10</td> </tr>

<tr><th>sv_min_cluster_size</th>
<td>minimum cluster size to be a valid SV. default: 10</td> </tr>

<tr><th>bwa_threads</th>
<td>the number of threads bwa uses. default: 8</td> </tr>

</table>


results
------

results are formatted as BED format.

    #rname  start end type  subtype len score rname2  start2  caller  other
    chr1  224199455 224199456 INS * * 38  = * clipcrop  num:158 LR:49/109

<table>
<tr><th>rname</th>
<td>the name of the chromosome</td></tr>

<tr><th>start</th>
<td>start position of the SV events</td></tr>

<tr><th>end</th>
<td>end position of the SV events</td></tr>

<tr><th>type</th>
<td>SV types (one of DEL, INS, INV, CTX, DUP) CTX : translocation</td></tr>

<tr><th>subtype</th>
<td>subtypes of each SV types.</td></tr>

<tr><th>len</th>
<td>length of the event</td></tr>

<tr><th>score</th>
<td>reliability score of the event. If 0, it cannot be reliable.</td></tr>

<tr><th>rname2</th>
<td>(for translocation) the chromosome of the second breakpoint.</td></tr>

<tr><th>start2</th>
<td>(for translocation) the start position of the second breakpoint.</td></tr>

<tr><th>caller</th>
<td>always "clipcrop"</td></tr>

<tr><th>other.num</th>
<td>the number of supported sequences of the breakpoint</td></tr>

<tr><th>other.LR</th>
<td>the number of L/R clips</td></tr>

</table>
