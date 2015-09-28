'use strict';
'use strong';

const stream = require('stream');
const async = require('async');
const pg = require('pg');

function* itervalues(obj){
  for (const key of Object.keys(obj)) yield obj[key];
}

function ResetDB(schema, settings) {
  stream.Writable.call(this, { objectMode: true });
  this._schema = schema;
  this.db = new pg.Client(settings);
  this.db.connect();
}
module.exports = ResetDB;

ResetDB.prototype.close = function (callback) {
  this.db.end();
  callback(null);
};

ResetDB.prototype.drop = function (callback) {
  const self = this;
  async.each(Object.keys(this._schema), function (tableName, done) {
    self._dropTable(self._schema[tableName], done);
  }, callback);
};

ResetDB.prototype._dropTable = function (table, callback) {
  const self = this;

  // Find all type and table name
  const typeNames = [];
  for (const collum of itervalues(table.schema)) {
    if (!collum.deprecated && collum.postgresql.slice(0, 4) === 'ENUM') {
      typeNames.push(`${table.name}_${collum.name}`);
    }
  }

  // Drop tables and types
  async.series([
    function dropTables(done) {
      self.db.query(`DROP TABLE IF EXISTS ${table.name} CASCADE`, done);
    },
    function dropTypes(done) {
      self.db.query(`DROP TYPE IF EXISTS ${typeNames.join(',')} CASCADE`, done);
    }
  ], callback);
};

ResetDB.prototype.create = function (callback) {
  const self = this;
  async.each(Object.keys(this._schema), function (tableName, done) {
    self._createTable(self._schema[tableName], done);
  }, callback);
};

ResetDB.prototype._createTable = function (table, callback) {
  const primaries = [];
  const customTypes = [];

  let statement = `CREATE TABLE IF NOT EXISTS ${table.name}(\n`;

  for (const collum of itervalues(table.schema)) {
    if (collum.deprecated) continue;

    // This is a primery collum, remeber that
    if (collum.primary) primaries.push(collum.name);

    // Get the postgresql type
    let postgresqlType = collum.postgresql;

    // This is an ENUM type, create a custom type
    if (collum.postgresql.slice(0, 4) === 'ENUM') {
      postgresqlType = `${table.name}_${collum.name}`;
      customTypes.push(`CREATE TYPE ${postgresqlType} AS ${collum.postgresql};`);
    }

    // Required types are newer null
    if (collum.require) postgresqlType += ' NOT NULL';

    // build collum statement
    statement += `\t${collum.name}\t${postgresqlType},\n`;
  }

  // Specify all primary keys
  statement += `\tPRIMARY KEY(${primaries.join(',')})\n`;
  statement += ');\n';

  // Create types, then create table
  this.db.query(customTypes.join('\n') + '\n' + statement, callback);
};
