/* eslint quotes:0 */

'use strict';
'use strong';

const async = require('async');
const dawaSchema = require('denmark-dawa-schema');

const Replicate = require('../replicate.js');
const ResetDB = require('./reset-db.js');
const InsertStream = require('./insert-stream.js');

const settings = {
  user: 'postgres',
  database: 'dawa',
  host: 'localhost'
};

dawaSchema(function (err, schema) {
  if (err) throw err;

  let lastTime = null;

  // Setup replicator
  const replicate = new Replicate()
    .on('new-version', function (version) {
      console.error('updateing to version: ' + version);
      console.log('\nupdateing to version: ' + version);
    })
    .on('update-table-start', function (tableName) {
      lastTime = process.hrtime();
      console.error('updateing table: ' + tableName);
      console.log('\nupdateing table: ' + tableName);
    })
    .on('update-table-end', function (tableName) {
      const took = process.hrtime(lastTime);
      console.error('  took: ' + (took[0] * 1e3 + took[1] * 1e-6) + ' ms');
    });

  const insert = new InsertStream(schema, settings)
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
  const reset = new ResetDB(schema, settings);
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
});
