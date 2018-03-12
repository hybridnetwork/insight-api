var sqlite3 = require('sqlite3');
var fs = require('fs');
var config = require('../config/config');
var path = require('path');
const async = require('async');
var imports = require('soop').imports();

var Rpc = imports.rpc || require('./Rpc');
var db;
var txDb = require('./TransactionDb').default();
var CONCURRENT_LIMIT = 5;
var getStatsStatement;


function init(initDone) {
  db = new sqlite3.Database(
    path.join(config.leveldb, 'stats'),
    function (err) {
      if (err) {
        throw err;
      }
      async.parallel([
        function (pCb) {
          db.run('create table if not exists blocks (height integer primary key, hash text, minedAt integer)', pCb);
        },
        function (pCb) {
          db.run('create table if not exists transactions (id text primary key, block text, time integer, blocktime integer)', pCb);
        },
        function (pCb) {
          db.run('create table if not exists vin (id text primary key, tx text, from_tx text, vout_index integer)', pCb);
        },
        function (pCb) {
          db.run('create table if not exists vout (id text primary key, tx text, address text, amount real, nindex integer)', pCb);
        }
      ], initDone);
    });
}

function saveBlock(block, cb) {
  db.run('insert or replace into blocks (height, hash, minedAt) values ($height, $hash, $minedAt)', {
    $height: block.height,
    $hash: block.hash,
    $minedAt: block.time
  }, cb);
}

function saveVin(tx, vin, cb) {
  async.mapLimit(
    vin,
    CONCURRENT_LIMIT,
    function (i, mCb) {
      if (i.txid) {
        var id = tx + '-' + i.txid + '-' + i.vout;
        db.run(
          'insert or replace into vin (id, tx, from_tx, vout_index) values ($id, $tx, $fromTx, $voutIndex)', {
            $id: id,
            $tx: tx,
            $fromTx: i.txid,
            $voutIndex: i.vout
          },
          mCb
        );
      } else {
        mCb();
      }
    },
    cb
  );
}

function saveVout(tx, vout, cb) {
  async.mapLimit(
    vout,
    CONCURRENT_LIMIT,
    function (o, mCb) {
      if (!(o.scriptPubKey.addresses && o.scriptPubKey.addresses[0])) {
        mCb();
        return;
      }
      toSave = {
        $id: tx + '-' + o.scriptPubKey.addresses[0] + '-' + o.value + '-' + o.n,
        $tx: tx,
        $amount: o.value,
        $nindex: o.n,
        $address: o.scriptPubKey.addresses[0]
      };
      db.run(
        'insert or replace into vout (id, tx, address, amount, nindex) values ($id, $tx, $address, $amount, $nindex)',
        toSave,
        mCb
      );
    },
    cb
  )
}

function saveTx(tx, cb) {
  async.waterfall([
    function (wCb) {
      Rpc.getTxInfo(tx, wCb);
    },
    function (txInfo, wCb) {
      var vout = txInfo.vout;
      var vin = txInfo.vin;
      async.parallel(
        [
          function (pCb) {
            db.run(
              'insert or replace into transactions (id, block, time, blocktime) values ($id, $block, $time, $blocktime)', 
              {
                $id: txInfo.txid,
                $block: txInfo.blockhash,
                $time: txInfo.time,
                $blocktime: txInfo.blocktime
              },
              pCb
            )
          },  
          function (pCb) {
            saveVout(tx, vout, pCb);
          },
          function (pCb) {
            saveVin(tx, vin, pCb);
          }
        ],
        wCb
      )
    }
  ], cb);
}

function processTxs(txs, cb) {
  async.mapLimit(txs, CONCURRENT_LIMIT, saveTx, cb);
}

module.exports.init = init;

module.exports.processBlock = function (block, cb) {
  if (block.height === 0) { //the transaction here doesn't really exist? 
    process.nextTick(cb);
    return;
  }
  async.parallel([
    function (sCb) {
      saveBlock(block, sCb);
    },
    function (sCb) {
      processTxs(block.tx, sCb)
    }
  ], function (error) {
    if (error) {
      cb(error);
      return;
    }
    //cleanup
    cb();
  });
}

module.exports.getPqStats = function (cb) {
  async.waterfall(
    [
      function (wCb) {
        fs.readFile(path.join(__dirname, 'get-pq-stats.sql'), {
          encoding: 'utf8'
        }, wCb);
      },
      function (fileContents, wCb) {
        var ts = Math.round(new Date().getTime() / 1000);
        var tsYesterday = ts - (24 * 3600);
        async.parallel([
          function (pCb) {
            db.all("select count(distinct t.id) as totalPqTx from transactions t inner join vout o on t.id = o.tx where (o.address like 'Tb%' or o.address like 'Ta%' or o.address like 'Hb%') and t.blocktime >= " + tsYesterday, pCb)
          },
          function (pCb) {
            db.all("select count(distinct id) as totalTx from transactions where blocktime >= " + tsYesterday, pCb);
          },
          function (pCb) {
            db.all("select sum(o.amount) as totalPqHx from vout o outer left join vin i on o.tx = i.from_tx and o.nindex = i.vout_index where i.id is null and (o.address like 'Tb%' or o.address like 'Ta%' or o.address like 'Hb%')", pCb);
          },
          function (pCb) {
            db.all("select sum(o.amount) as totalHx from vout o outer left join vin i on o.tx = i.from_tx and o.nindex = i.vout_index where i.id is null", pCb);
          }
        ], wCb)
      }
    ],
    function (err, rows) {
      if (err) {
        cb(err);
        return;
      }
      var stats = {
        pqTxCount24h: rows[0][0].totalPqTx,
        totalTxCount24h: rows[1][0].totalTx,
        pqHx: rows[2][0].totalPqHx,
        totalHx: rows[3][0].totalHx
      }
      cb(null, stats);
    }
  );
}
