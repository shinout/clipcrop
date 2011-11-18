/**
 * format of SV BED
 *
 *
 **/
module.exports = function svbedline(svinfo) {

  var required_keys = ['rname', 'start', 'end', 'type'];

  /**
   * checking requirements
   **/
  required_keys.forEach(function(key) {
    if (!svinfo[key]) {
      throw new Error(key + ' is required for SV info.');
    }
  });


  var list = [
    /**
     * these four are required
     **/
    svinfo.rname,
    svinfo.start,
    svinfo.end,
    svinfo.type,

    /**
     * these are optional
     **/
    svinfo.len    || '*',
    svinfo.score  || 0,
    svinfo.rname2 || '=',
    svinfo.start2 || '*',
    svinfo.end2   || '*',
  ];

  /**
   * column of other info
   **/
  if (svinfo.others) {
    var others = Object.keys(svinfo.others).map(function(key) {
      return key + ':' + svinfo.others[key];
    }).join(' ');
    list.push(others.split('\t').join(' '));
  }

  return list.join('\t');
};
