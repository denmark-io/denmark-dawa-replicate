#denmark-dawa-replicate

>  **Work In Progress** Replicate the DAWA database.

## Installation

```sheel
npm install denmark-dawa-replicate
```

## Example

This module just provided the necessary logic for fetching the data.
The actual `insert`, `update` and `delete` logic is a bit more complicated,
a full postgresql example exists inside the `example/` directory.

## Documentation

```javascript
const replicate = require('denmark-dawa-replicate')
```

[DAWA (Danmarks Adressers Web API)](http://dawa.aws.dk/) is a service provided
by the danish government, which exposes multiply APIs for getting address
related information. The service supports replication of its tables,
this module helps getting that data and keeping it up to date.

First create a new `DAWAReplicate` object.

```javascript
const replicator = new DAWAReplicate(version);
```

If there is no data in the database, set `version` to `0` or just don't
specify it. The `replicator` object is a `Readable` object stream,
where each item has the following structure.

```javascript
replicator.on('data', function (item) {
	item = {
		table: String // A tableName, e.g. postnumre,
		operation: String // Can be [insert, update, delete],
		data: Object // Object containing all properties for each table row
	}
});
```

To get all possible table names and associated information, see the
[denmark-dawa-signature](https://github.com/AndreasMadsen/denmark-dawa-signature) module.

###### Using a parallel writeable stream

Since there is a lot of data, it is recommended to implement a `Writeable` stream
that supports parallel writes. This can be done by implementing the
`Writeable._writev` method, that takes a chunk of items.

```javascript
function InsertStream() {
  stream.Writable.call(this, {
		objectMode: true,
		highWaterMark: 16 // Controls the max amount of parallel writes
	});
  this.db = new DBAbstraction();
}
util.inherits(InsertStream, stream.Writable);

InsertStream.prototype._write = function (item, encoding, callback) {
  this.db[item.operation](item.table, item.data, callback);
};

InsertStream.prototype._writev = function (chunks, callback) {
  const self = this;
  async.each(chunks, function (item, done) {
    self._write(item.chunk, item.encoding, done);
  }, callback);
};
```

You then just pipe the `replicator` as usual.

```javascript
replicator.pipe(new InsertStream());
```

#### replicator.update([version], callback)

Updates the current version to `version`. If no `version` is specified
the module will fetch the latest version for you. After the new version
has been determined, all new data (events) from `DAWA` will be piped to
the `replicator` object.

If a newer version exists a `new-version` event will be emitted with
the new version number.  As each table starts being fetched the `update-table`
will emit, with the corresponding table name.

The callback is called when all data has been fetched. Before this
you are not allowed to execute `.update` again.

```javascript
// Standard synchronization pattern
(function recursive() {
	replicate.update(function (err, newVersion) {
		if (err) throw err;
		console.log('updated to version ' + newVersion);
		setTimeout(recursive, 1000 * 60 * 60 * 24);
	});
})();
```

#### replicator.getLatestVersion(callback)

In case you want to be more in control, this method just fetches the
latest version number, without any side effects.

```javascript
replicator.getLatestVersion(function (err, remoteVersion) {
	if (err) throw err;

	console.log('remote now has version ' + remoteVersion);
});
```


#### events = replicator.replicate(tableName)

In case you want to be more in control, this method just fetches
the latest events from `this.currVersion` to `this.nextVersion`
without any side effects.

The method returns an object stream. Each item have the same
structure as those on on the main `replicator` stream.

## Source

DAWA documents the replication protocol at http://dawa.aws.dk/replikeringdok.

##License

**The software is license under "MIT"**

> Copyright (c) 2015 Andreas Madsen
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.
