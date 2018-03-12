var common = require('./common');
var StatsDb = require('../../lib/StatsDb');

var checkSync = function(req, res) {
  if (req.historicSync) {
    var i = req.historicSync.info()
    if (i.status !== 'finished') {
      common.notReady(req, res, i.syncPercentage);
      return false;
    }
  }
  return true;
};

module.exports.getPqStats = function (req, res, next) {
  if (!checkSync(req, res)){ 
    return;
  };
  StatsDb.getPqStats(function (error, stats) {
    console.log("STATS", stats);
    if (error) {
      console.log("err", error);
      return common.handleErrors(error, res);
    } else {
      return res.jsonp(stats);
    }
  });
}
