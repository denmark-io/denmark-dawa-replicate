'use strict';
'use strong';

const FakeService = require('./fake-service.js');

const server = new FakeService();
server.listen(function () {
  console.log('listening on: http://localhost:' + server.port);
});
