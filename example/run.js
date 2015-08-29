/* eslint quotes:0 */

'use strict';
'use strong';

const async = require('async');

const Replicate = require('../replicate.js');
const ResetDB = require('./reset-db.js');
const InsertStream = require('./insert-stream.js');

const settings = {
  user: 'postgres',
  database: 'dawa',
  host: 'localhost'
};

// Setup replicator
const replicate = new Replicate()
  .on('new-version', function (version) {
    console.log('\nupdateing to version: ' + version);
  })
  .on('update-table', function (tableName) {
    console.log('\nupdateing table: ' + tableName);
  });

const insert = new InsertStream(settings)
  .once('finish', function () {
    process.stdout.write('f');
  })
  .on('progress', function () {
    process.stdout.write('.');
  })
  .on('insert-error', function (err) {
    process.stdout.write('e');
    console.error(err.message);
  });

replicate.pipe(insert);

// Setup database
const reset = new ResetDB(settings);
async.series([
  reset.drop.bind(reset),
  reset.create.bind(reset),
  reset.close.bind(reset)
], function (err) {
  if (err) throw err;

  // Update database
  replicate.update(function (err, version) {
    if (err) throw err;
    console.log('new version: ' + version);

    // DAWA has been replicated.
    // One could wait a day and run replicate.update() again, to syncronize.
    insert.end();
  });
});
