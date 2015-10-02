
'use strict';
'use strong';

const url = require('url');
const path = require('path');
const util = require('util');
const async = require('async');
const stream = require('stream');
const endpoint = require('endpoint');

const DAWARequest = require('denmark-dawa');
const dawaSignature = require('denmark-dawa-signature');

const TransformEvents = require('./lib/transform-events.js');
const TransformSnapshot = require('./lib/transform-snapshot.js');

function DAWAReplicate(fromSequence) {
  stream.PassThrough.call(this, { objectMode: true });
  this.currVersion = fromSequence || 0;
  this.nextVersion = this.currVersion;

  this._updateing = false;
}
util.inherits(DAWAReplicate, stream.PassThrough);
module.exports = DAWAReplicate;

DAWAReplicate.prototype.getLatestVersion = function (callback) {
  new DAWARequest('/replikering/senestesekvensnummer')
    .pipe(endpoint({ objectMode: true}, function (err, items) {
      if (err) return callback(err, null);
      callback(null, items[0].sekvensnummer);
    }));
};

DAWAReplicate.prototype.update = function () {
  const self = this;
  const callback = arguments[arguments.length - 1];

  // Prevent simultaniuse .update calls
  if (this._updateing) {
    return callback(new Error(`can't update while another update is running`));
  }
  this._updateing = true;

  // Allow nextVersion to be specified manually or fetch automatically
  if (arguments.length === 2) {
    process.nextTick(() => cb(null, arguments[0]));
  } else {
    this.getLatestVersion(cb);
  }

  // The next version is now known, so fetch the new events
  function cb(err, version) {
    if (err) {
      self._updateing = false;
      return callback(err);
    }
    self._update(version, function (err) {
      self._updateing = false;
      if (err) return callback(err);
      callback(null, version);
    });
  }
};

DAWAReplicate.prototype._update = function (nextVersion, callback) {
  const self = this;
  this.nextVersion = nextVersion;

  // Nothing new has happend, just short circuit it
  if (this.currVersion >= this.nextVersion) {
    return callback(null, nextVersion);
  }
  this.emit('new-version', nextVersion);

  // fetch the latest replication schema
  dawaSignature(function (err, schema) {
    if (err) return callback(err);
    self.emit('update-start');

    // New data exists, update all tables
    async.eachSeries(
      Object.keys(schema),
      function (tableName, done) {

        self.emit('update-table-start', tableName);
        function doneAndEmit(err) {
          self.emit('update-table-end', tableName);
          done(err);
        }

        // Get the source
        const table = schema[tableName];
        const source = url.parse(table.source).pathname;

        // Pipe events to the main stream
        self._replicate(tableName, source)
          .once('error', doneAndEmit)
          .once('end', doneAndEmit)
          .pipe(self, { end: false });
      },
      function (err) {
        if (err) return callback(err);
        // When done update the current version attribute
        self.currVersion = self.nextVersion;
        self.emit('update-end');
        callback(null, nextVersion);
      }
    );
  });
};

DAWAReplicate.prototype._replicate = function (tableName, source) {
  if (this.currVersion >= this.nextVersion) {
    throw new RangeError(`next version ${this.nextVersion} must be greater` +
                         ` than the current version ${this.currVersion}`);
  }

  // If the current version is zero, no data exists in the
  // database. So skip all the update events and just use the
  // snapshot.
  if (this.currVersion === 0) {
    return new DAWARequest(source, {
      sekvensnummer: this.nextVersion
    }).pipe(new TransformSnapshot(tableName));
  }
  // Data exists in the database, fetch the update events
  else {
    return new DAWARequest(path.join(source, 'haendelser'), {
      sekvensnummerfra: this.currVersion + 1,
      sekvensnummertil: this.nextVersion
    }).pipe(new TransformEvents(tableName));
  }
};
