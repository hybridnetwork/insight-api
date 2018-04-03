var sqlite3 = require('sqlite3');
var config = require('../config/config');
var path = require('path');
var async = require('async');

var db = new sqlite3.Database(path.join(config.leveldb, 'stats'), function (err) {
  if (err) {
    console.log("error", err);
    return;
  }
  var ts = Math.round(new Date().getTime() / 1000);
  var tsYesterday = ts - (24 * 3600);

  async.waterfall([
    function (cb) {
      db.run('delete from hashperseconds', cb)
    }
  ], function (err, res, cb) {
    if (err) {
      console.log(err);
      return;
    }
  })

})
