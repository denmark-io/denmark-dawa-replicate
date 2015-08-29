
'use strict';
'use strong';

const util = require('util');
const stream = require('stream');

function TransformEvents(tableName) {
  stream.Transform.call(this, { objectMode: true });
  this._table = tableName;
}
util.inherits(TransformEvents, stream.Transform);
module.exports = TransformEvents;

TransformEvents.prototype._transform = function (chunk, encoding, done) {
  this.push({
    operation: chunk.operation,
    table: this._table,
    data: chunk.data
  });
  done(null);
};
