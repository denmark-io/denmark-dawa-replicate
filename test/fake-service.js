'use strict';
'use strong';

const fs = require('fs');
const url = require('url');
const util = require('util');
const path = require('path');
const http = require('http');
const async = require('async');
const events = require('events');
const mockney = require('mockney');
const drugged = require('drugged');
const querystring = require('querystring');
const dawaSignature = require('denmark-dawa-signature');

function FakeService() {
  this.server = http.createServer();
  this.router = new drugged.Router();
  this.schema = null;
  this.data = null;
  this.sekvensnummer = 0;

  this.server.on('request', this.router.dispatch.bind(this.router));
}
util.inherits(FakeService, events.EventEmitter);
module.exports = FakeService;

FakeService.prototype.registerRequestHandlers = function () {
  const self = this;

  // Registre replicate schema
  this.router.get('/replikeringdok/schema.json', function () {
    fs.createReadStream(path.resolve(__dirname, 'fake-schema.json')).pipe(this.res);
  });

  // Registre sekvensnummer notifier
  this.router.get('/replikering/senestesekvensnummer', function () {
    this.res.end(JSON.stringify({
      sekvensnummer: self.sekvensnummer,
      tidspunkt: new Date()
    }));
  });

  // Registre resource handleres
  for (const tableName of Object.keys(this.schema)) {
    const table = this.schema[tableName];
    const source = url.parse(table.source).pathname;

    // handle replicate queries
    this.router.get(source, function () {
      const query = querystring.parse(this.url.query);

      for (const item of self.data[tableName]) {
        // TODO: this may result in dublicate enteries
        if (item.sekvensnummer <= parseInt(query.sekvensnummer, 10)) {
          this.res.write(JSON.stringify(item.data) + '\n');
        }
      }

      this.res.end();
    });

    // handle update queries
    this.router.get(path.join(source, 'haendelser'), function () {
      const query = querystring.parse(this.url.query);

      for (const item of self.data[tableName]) {
        if (item.sekvensnummer >= parseInt(query.sekvensnummerfra, 10) &&
            item.sekvensnummer <= parseInt(query.sekvensnummertil, 10)) {
          this.res.write(JSON.stringify(item) + '\n');
        }
      }

      this.res.end();
    });
  }
};

FakeService.prototype.listen = function (callback) {
  const self = this;
  async.parallel({
    listen: (done) => this.server.listen(0, 'localhost', done),
    signature: (done) => dawaSignature(done),
    data: (done) => fs.readFile(path.resolve(__dirname, 'fake-data.json'), done)
  }, function (err, result) {
    if (err) return self.emit('error', err);

    // get the random port, and setup an node internal redirection of dawa.aws.dk
    // to that port.
    self.port = self.server.address().port;
    mockney.redirect('dawa.aws.dk:80', 'localhost:' + self.port);

    // store schema and data for later use in the request handlers
    self.schema = result.signature;
    self.data = JSON.parse(result.data);

    self.registerRequestHandlers();
    callback(null);
  });
};

FakeService.prototype.fail = function (enable) {
  if (enable) {
    mockney.redirect('dawa.aws.dk:80', 'localhost:' + 0xBAD);
  } else {
    mockney.redirect('dawa.aws.dk:80', 'localhost:' + this.port);
  }
};

FakeService.prototype.close = function (callback) {
  this.server.close(function () {
    mockney.restore('dawa.aws.dk:80');
    callback(null);
  });
};
