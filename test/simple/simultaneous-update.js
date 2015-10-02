'use strict';
'use strong';

const FakeService = require('../fake-service.js');
const DAWAReplicate = require('../../');
const async = require('async');
const test = require('tap').test;

const server = new FakeService();

test('server listen', function (t) {
  server.listen(() => t.end());
});

test('getLatestVersion is correct', function (t) {
  const replicate = new DAWAReplicate();

  async.parallel({
    first: (done) => replicate.update(done),
    second: (done) => replicate.update((err, newVersion) => done(null, err))
  }, function (err, result) {
    t.ifError(err);
    t.equal(result.first, 0, 'version number is correct ');
    t.equal(result.second.message, `can't update while another update is running`, 'got error on second update call');
    t.end();
  });
});

test('server close', function (t) {
  server.close(() => t.end());
});
