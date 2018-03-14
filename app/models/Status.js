'use strict';
//var imports       = require('soop').imports();

var async = require('async');
var bitcore = require('bitcore');
var RpcClient = bitcore.RpcClient;
var config = require('../../config/config');
var rpc = new RpcClient(config.bitcoind);
var bDb = require('../../lib/BlockDb').default();

function Status() {}

Status.prototype.getInfo = function (next) {
  var that = this;
  async.series([
    function (cb) {
      rpc.getInfo(function (err, info) {
        if (err) return cb(err);

        that.info = info.result;
        return cb();
      });
    },
  ], function (err) {
    return next(err);
  });
};

Status.prototype.getTicketInfo = function (next) {
  var that = this;
  async.parallel([
    function (cb) {
      rpc.getStakeInfo(function (err, stakeInfo) {
        if (err) {
          cb(err);
          return;
        }
        cb(null, stakeInfo.result);
      })
    },
    function (cb) {
      rpc.getTicketPoolValue(function (err, ticketPoolValue) {
        if (err) {
          cb(err);
          return;
        }
        cb(null, ticketPoolValue.result);
      });
    }
  ], function (err, results) {
    if (err) {
      return next(err);
    }
    var stakeInfo = results[0];
    var totalTicketValue = results[1];
    that.ticketInfo = {
      allMempoolTix: stakeInfo.allmempooltix,
      poolSize: stakeInfo.poolsize,
      difficulty: stakeInfo.difficulty,
      totalTicketValue: totalTicketValue
    };
    next();
  });
}

Status.prototype.getMiningInfo = function (next) {
  var that = this;
  async.series([
    function (cb) {
      rpc.getMiningInfo(function (err, miningInfo) {
        if (err) {
          return cb(err);
        }
        that.miningInfo = miningInfo.result;
        return cb();
      })
    }
  ], function (err) {
    return next(err);
  });
}

Status.prototype.getCoinSupply = function (next) {
  var that = this;
  async.series([
    function (cb) {
      rpc.getCoinSupply(function (err, cs) {
        if (err) return cb(err);

        that.coinsupply = cs.result;
        return cb();
      });
    }
  ], function (err) {
    return next(err);
  });
};

Status.prototype.getDifficulty = function (next) {
  var that = this;
  async.series([
    function (cb) {
      rpc.getDifficulty(function (err, df) {
        if (err) return cb(err);

        that.difficulty = df.result;
        return cb();
      });
    }
  ], function (err) {
    return next(err);
  });
};

Status.prototype.getTxOutSetInfo = function (next) {
  var that = this;
  async.series([
    function (cb) {
      rpc.getTxOutSetInfo(function (err, txout) {
        if (err) return cb(err);

        that.txoutsetinfo = txout.result;
        return cb();
      });
    }
  ], function (err) {
    return next(err);
  });
};

Status.prototype.getBestBlockHash = function (next) {
  var that = this;
  async.series([
    function (cb) {
      rpc.getBestBlockHash(function (err, bbh) {
        if (err) return cb(err);

        that.bestblockhash = bbh.result;
        return cb();
      });
    },

  ], function (err) {
    return next(err);
  });
};

Status.prototype.getLastBlockHash = function (next) {
  var that = this;
  bDb.getTip(function (err, tip) {
    that.syncTipHash = tip;
    async.waterfall(
      [
        function (callback) {
          rpc.getBlockCount(function (err, bc) {
            if (err) return callback(err);
            callback(null, bc.result);
          });
        },
        function (bc, callback) {
          rpc.getBlockHash(bc, function (err, bh) {
            if (err) return callback(err);
            callback(null, bh.result);
          });
        }
      ],
      function (err, result) {
        that.lastblockhash = result;
        return next();
      }
    );
  });
};

module.exports = require('soop')(Status);
