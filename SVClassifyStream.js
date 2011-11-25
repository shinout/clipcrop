/**
 * SVClassifyStream
 *
 * @description WritableStream of SV.
 *              writes bed files for each SV types.
 * @author SHIN Suzuki
 * #@implements WritableStream (not completely implemented...)
 *
 * <sample code>
 *
 * var wstream = new SVClassifyStream();
 * 
 * wstream.on("close", function() {
 *   // finished...
 * });
 *
 * wstream.write({
 *  rname: "chr1",
 *  start: 15760982,
 *  end  : 15767021,
 *  type : "DEL"
 * });
 *
 * wstream.end();
 *
 **/


var EventEmitter = require('events').EventEmitter;
var SortedList   = require('sortedlist');
var ArrayStream  = require('arraystream');

var fs = require('fs');
var Path = require('path');

/**
 * required keys for svinfo
 **/
var required_keys = ['rname', 'start', 'end', 'type'];

/**
 * bed columns
 **/
var bed_columns = ['rname', 'start', 'end', 'type', 'len', 'score', 'rname2', 'start2', 'caller', 'other'];

/**
 * default values for optional columns
 **/
var bed_defaults = {
  len    : '*',
  score  : -1,
  rname2 : '=',
  start2 : '*',
  caller : '*',
  other  : '*'
};


/**
 * constructor
 **/
function SVClassifyStream(dir, options) {
  _check_and_prepare_dir(dir);

  this._dir = dir;
  options = (options || {});

  ['prefix'].forEach(function(name) {
    if (options[name] !== undefined) {
      this[name] = options[name];
    }
  }, this);

  this._list = new SortedList({
    compare: function(sv1, sv2) {
      var score1 = Number(sv1.score);
      var score2 = Number(sv2.score);
      return (score1 > score2) ? -1: 1; // order by score desc
    }
  });

  this._svtypes_hash = {};
}

/**
 * extends EventEmitter
 **/
SVClassifyStream.prototype = new EventEmitter();


/**
 * write sv info
 * 
 * @param svinfo (object. see SVClassifyStream.stringifyInfo)
 *
 **/
SVClassifyStream.prototype.write = function(svinfo) {
  if (!svinfo) {
    return;
  }
  var self = this;
  process.nextTick(function() {
    try {
      /**
       * checking requirements
       **/
      required_keys.forEach(function(key) {
        if (!svinfo[key]) {
          throw new Error(key + ' is required for SV info.');
        }
      });

      var svtype = svinfo.type.toLowerCase();
      self._svtypes_hash[svtype] = true;
      self._list.insert(svinfo);
    }
    catch (e) {
      self.emit('error', e);
    }
  });
};



/**
 * end writing.
 * start writing files.
 **/
SVClassifyStream.prototype.end = function() {
  var self = this;

  process.nextTick(function() {
    try {
      // list of the existent sv types.
      var svtypes = Object.keys(self._svtypes_hash);

      // file prefix
      var prefix = Path.normalize(self._dir + (self.prefix || ''));

      // comment line of column name
      var commentLine = '#' + bed_columns.join('\t');

      // the number of finished wstreams
      var finished = 0;

      /**
       * called when each wstream emits close event 
       **/
      var onClose = function() {
        if (++finished < svtypes.length + 1) { // + 1 means, svtypes + all.bed
          return;
        }
        self.emit('close');
      };


      /**
       * writable streams writing all sv type
       **/
      var alltypeStream = fs.createWriteStream(prefix + '/all.bed');
      alltypeStream.on('close', onClose);
      alltypeStream.write(commentLine + '\n');


      /**
       * writable streams for each sv type
       **/
      var wstreams = {};

      svtypes.forEach(function(svtype) {
        wstreams[svtype] = fs.createWriteStream(prefix + '/' + svtype + '.bed');
        wstreams[svtype].on('close', onClose);
        wstreams[svtype].write(commentLine + '\n');
      });


      /**
       * for each svinfo, write the stringified data to all.bed and {svname}.bed
       **/
      var astream = new ArrayStream(self._list.toArray());

      astream.on("data", function(svinfo) {
        var line = SVClassifyStream.stringifyInfo(svinfo) + '\n';
        self.emit('sv', svinfo, line);
        alltypeStream.write(line);
        wstreams[svinfo.type.toLowerCase()].write(line);
      });


      astream.on("end", function() {
        alltypeStream.end();
        Object.keys(wstreams).forEach(function(svtype) {
          wstreams[svtype].end();
        });
      });
    }
    catch (e) {
      self.emit('error', e);
    }
  });
};



/**
 * stringify sv information
 * @param (object) svinfo 
 **/
SVClassifyStream.stringifyInfo = function(svinfo) {
  if (svinfo.others) {
    svinfo.other = Object.keys(svinfo.others).map(function(key) {
      return key + ':' + svinfo.others[key];
    }).join(' ').split('\t').join(' ');
  }

  var list = bed_columns.map(function(col) {
    var ret = svinfo[col];
    if (svinfo[col] == null && bed_defaults[col]) {
      ret = bed_defaults[col];
    }
    return ret;
  });

  return list.join('\t');
};


/**
 * check existence of the given dir,
 * if not exists, trying to create new one
 **/
function _check_and_prepare_dir(dir) {
  if (typeof dir != "string" || !dir.trim()) {
    throw new Error('the given directory is invalid.');
  }
  
  try {
    var isdir = fs.statSync(dir).isDirectory();
  }
  catch (e) {
    fs.mkdirSync(dir);
    var isdir = true;
  }

  if (!isdir) {
    throw new Error(dir + ' is not a directory.');
  }
}

module.exports = SVClassifyStream;
