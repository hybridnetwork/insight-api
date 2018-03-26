#!/usr/bin/env node

'use strict';
var sqlite3 = require('sqlite3');
var util = require('util');
var async = require('async');
var path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var config = require('../config/config');
var endDate = new Date();
var startDate = new Date();
startDate.setFullYear(endDate.getFullYear() - 2);
var interval = 5 * 288 * 60; //mpb * blocks * 60 seconds/minute

function monthsSinceStart(timeInSeconds) {
    var d1 = startDate;
    var d2 = new Date(timeInSeconds * 1000);
    var months;
    months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth() + 1;
    months += d2.getMonth();
    return months <= 0 ? 0 : months;

}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

function getRandomHps(time) {
  var base = 100000;
  var months = monthsSinceStart(time);
  var upper = (.07 * months * months) + 2; //.1x^2 + 2
  var lower = (.06 * months * months) + 2; //.06x^2 +1
  var rando = getRandomArbitrary(lower, upper);
  return Math.round(rando * base);
}

function generateData() {
  var startTime = Math.round(startDate.getTime() / 1000);
  var endTime = Math.round(endDate.getTime() / 1000);
  var data = [];
  for (var i = startTime; i < endTime; i = i + interval) {
    var entry = {
      timestamp: i,
      hashperseconds: getRandomHps(i)
    }
    data.push(entry);
  }
  return data;
}

var db;

async.waterfall([
  function (cb) {
    db = new sqlite3.Database(path.join(config.leveldb, 'stats'), cb);
  },
  function (cb) {
    var data = generateData()
    async.each(data, function (entry, eCb) {
      db.run('insert into hashperseconds (timestamp, hashperseconds) values ($time, $hps)', {
        $time: entry.timestamp,
        $hps: entry.hashperseconds
      }, eCb);
    }, cb);
  }
], function () {
  console.log('done');
});
