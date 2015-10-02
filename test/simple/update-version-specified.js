'use strict';
'use strong';

const async = require('async');
const test = require('tap').test;

const checkStream = require('../check-stream.js');
const FakeService = require('../fake-service.js');
const DAWAReplicate = require('../../');

const server = new FakeService();
const replicate = new DAWAReplicate();

test('server listen', function (t) {
  server.listen(() => t.end());
});

test('get intial data by specifying version', function (t) {
  server.sekvensnummer = 5;

  async.parallel({
    update: (done) => replicate.update(1, done),
    event: (done) => replicate.once('new-version', (version) => done(null, version)),
    check: (done) => checkStream(replicate, t, { postnumre: [0], vejstykker: [0] }, done)
  }, function (err, results) {
    t.ifError(err);
    t.equal(results.event, 1, 'got correct event version');
    t.equal(results.update, 1, 'got correct callback version');
    t.end();
  });
});

test('no new data by specifying version', function (t) {
  // Set flag if new data arives
  let newData = false;
  function ondata() { newData = true; }
  replicate.on('data', ondata);

  replicate.update(1, function (err, newVersion) {
    replicate.removeListener('data', ondata);

    t.ifError(err);
    t.equal(newData, false, 'no new data');
    t.equal(newVersion, 1, 'got correct version');
    t.end();
  });
});

test('first update by specifying version', function (t) {
  server.sekvensnummer = 5;

  async.parallel({
    update: (done) => replicate.update(3, done),
    event: (done) => replicate.once('new-version', (version) => done(null, version)),
    check: (done) => checkStream(replicate, t, { postnumre: [1, 2] }, done)
  }, function (err, results) {
    t.ifError(err);
    t.equal(results.event, 3, 'got correct event version');
    t.equal(results.update, 3, 'got correct callback version');
    t.end();
  });
});

test('second update by fetch latest version', function (t) {
  server.sekvensnummer = 5;

  async.parallel({
    update: (done) => replicate.update(done),
    event: (done) => replicate.once('new-version', (version) => done(null, version)),
    check: (done) => checkStream(replicate, t, { postnumre: [3, 4] }, done)
  }, function (err, results) {
    t.ifError(err);
    t.equal(results.event, 5, 'got correct event version');
    t.equal(results.update, 5, 'got correct callback version');
    t.end();
  });
});

test('server close', function (t) {
  server.close(() => t.end());
});
