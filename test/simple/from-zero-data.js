'use strict';
'use strong';

const fs = require('fs');
const path = require('path');
const async = require('async');
const test = require('tap').test;

const FakeService = require('../fake-service.js');
const DAWAReplicate = require('../../');

const server = new FakeService();
const replicate = new DAWAReplicate();

test('server listen', function (t) {
  server.listen(() => t.end());
});

test('get intial data', function (t) {
  server.sekvensnummer = 2;

  async.parallel({
    update: (done) => replicate.update(done),
    event: (done) => replicate.once('new-version', (version) => done(null, version)),
    check: (done) => checkStream(replicate, t, { postnumre: [0, 1], vejstykker: [0] }, done)
  }, function (err, results) {
    t.ifError(err);
    t.equal(results.event, 2, 'got correct event version');
    t.equal(results.update, 2, 'got correct callback version');
    t.end();
  });
});

test('no new data', function (t) {
  // Set flag if new data arives
  let newData = false;
  function ondata() { newData = true; }
  replicate.on('data', ondata);

  replicate.update(function (err, newVersion) {
    replicate.removeListener('data', ondata);

    t.ifError(err);
    t.equal(newData, false, 'no new data');
    t.equal(newVersion, 2, 'got correct version');
    t.end();
  });
});

test('first update', function (t) {
  server.sekvensnummer = 3;

  async.parallel({
    update: (done) => replicate.update(done),
    event: (done) => replicate.once('new-version', (version) => done(null, version)),
    check: (done) => checkStream(replicate, t, { postnumre: [2] }, done)
  }, function (err, results) {
    t.ifError(err);
    t.equal(results.event, 3, 'got correct event version');
    t.equal(results.update, 3, 'got correct callback version');
    t.end();
  });
});

test('second update', function (t) {
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

const DATA = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../fake-data.json'))
);
function checkStream(rep, t, expected, callback) {
  // Log events
  let updateStart = false;
  rep.once('update-start', function () { updateStart = true; });

  const updateTable = {};
  function onTableStart(tableName) {
    updateTable[tableName] = ['start'];
  }
  rep.on('update-table-start', onTableStart);

  function onTableEnd(tableName) {
    updateTable[tableName].push('end');
  }
  rep.on('update-table-end', onTableEnd);

  // concat data
  const items = [];
  const ondata = (data) => items.push(data);

  rep.on('data', ondata);
  rep.once('update-end', function () {
    rep.removeListener('data', ondata);
    rep.removeListener('update-table-start', onTableStart);
    rep.removeListener('update-table-end', onTableEnd);

    // Check data
    const expectedItems = [];
    for (const tableName of Object.keys(expected)) {
      for (const itemIndex of expected[tableName]) {
        const item = DATA[tableName][itemIndex];
        expectedItems.push({
          table: tableName,
          operation: DATA[tableName][itemIndex].operation,
          data: DATA[tableName][itemIndex].data
        });
      }
    }
    t.deepEqual(items, expectedItems, 'piped data matches');

    // Check events
    const expectedEvents = {};
    for (const tableName of Object.keys(DATA)) {
      expectedEvents[tableName] = ['start', 'end'];
    }
    t.deepEqual(updateTable, expectedEvents, 'table events are ok');
    t.equal(updateStart, true, 'start event emitted');

    callback(null);
  });
}
