
'use strict';
'use strong';

const util = require('util');
const stream = require('stream');

function TransformSnapshot(tableName) {
  stream.Transform.call(this, { objectMode: true });
  this._table = tableName;
}
util.inherits(TransformSnapshot, stream.Transform);
module.exports = TransformSnapshot;

TransformSnapshot.prototype._transform = function (chunk, encoding, done) {
  this.push({
    operation: 'insert',
    table: this._table,
    data: chunk
  });
  done(null);
};
