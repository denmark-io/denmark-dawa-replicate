'use strict';
'use strong';

const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'fake-data.json'))
);

function checkStream(rep, t, expected, callback) {
  // Log events
  let updateStart = false;
  rep.once('update-start', function () { updateStart = true; });

  const updateTable = {};
  function onTableStart(tableName) {
    updateTable[tableName] = ['start'];
  }
  rep.on('update-table-start', onTableStart);

  function onTableEnd(tableName) {
    updateTable[tableName].push('end');
  }
  rep.on('update-table-end', onTableEnd);

  // concat data
  const items = [];
  const ondata = (data) => items.push(data);

  rep.on('data', ondata);
  rep.once('update-end', function () {
    rep.removeListener('data', ondata);
    rep.removeListener('update-table-start', onTableStart);
    rep.removeListener('update-table-end', onTableEnd);

    // Check data
    const expectedItems = [];
    for (const tableName of Object.keys(expected)) {
      for (const itemIndex of expected[tableName]) {
        const item = DATA[tableName][itemIndex];
        expectedItems.push({
          table: tableName,
          operation: DATA[tableName][itemIndex].operation,
          data: DATA[tableName][itemIndex].data
        });
      }
    }
    t.deepEqual(items, expectedItems, 'piped data matches');

    // Check events
    const expectedEvents = {};
    for (const tableName of Object.keys(DATA)) {
      expectedEvents[tableName] = ['start', 'end'];
    }
    t.deepEqual(updateTable, expectedEvents, 'table events are ok');
    t.equal(updateStart, true, 'start event emitted');

    callback(null);
  });
}
module.exports = checkStream;
