'use strict';
'use strong';

const FakeService = require('../fake-service.js');
const DAWAReplicate = require('../../');
const test = require('tap').test;

const server = new FakeService();

test('server listen', function (t) {
  server.listen(() => t.end());
});

test('getLatestVersion is correct', function (t) {
  const replicate = new DAWAReplicate();

  t.test('version is correct', function (t) {
    server.sekvensnummer = 1;
    replicate.getLatestVersion(function (err, version) {
      t.ifError(err);
      t.strictEqual(version, 1);
      t.end();
    });
  });

  t.test('version bump is read correctly', function (t) {
    server.sekvensnummer = 2;
    replicate.getLatestVersion(function (err, version) {
      t.ifError(err);
      t.strictEqual(version, 2);
      t.end();
    });
  });

  t.end();
});

test('error is given if server is down', function (t) {
  const replicate = new DAWAReplicate();

  server.fail(true);
  replicate.getLatestVersion(function (err, version) {
    server.fail(false);

    t.equal(err.code, 'ECONNREFUSED');
    t.strictEqual(version, null);
    t.end();
  });
});

test('server close', function (t) {
  server.close(() => t.end());
});
