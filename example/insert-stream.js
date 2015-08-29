'use strict';
'use strong';

const stream = require('stream');
const async = require('async');
const util = require('util');
const pg = require('pg');

const SCHEMA = require('denmark-dawa-signature');
const QueryBuilder = require('./query-builder.js');

function InsertStream(settings) {
  stream.Writable.call(this, { objectMode: true });

  this.tables = new Map((function* () {
    for (const tableName of Object.keys(SCHEMA)) {
      yield [tableName, new QueryBuilder(SCHEMA[tableName])];
    }
  })());

  this.db = new pg.Client(settings);
  this.db.connect();
  this.once('finish', this.db.end.bind(this.db));
}
util.inherits(InsertStream, stream.Writable);
module.exports = InsertStream;

InsertStream.prototype._write = function (item, encoding, callback) {
  const self = this;

  this.emit('progress', item);
  this.db.query(this.tables.get(item.table)[item.operation](item.data), function (err) {
    if (err) self.emit('insert-error', err);
    callback(null);
  });
};

InsertStream.prototype._writev = function (chunks, callback) {
  const self = this;
  async.each(chunks, function (item, done) {
    self._write(item.chunk, item.encoding, done);
  }, callback);
};
