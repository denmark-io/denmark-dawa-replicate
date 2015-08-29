'use strict';
'use strong';

function* itervalues(obj){
  for (const key of Object.keys(obj)) yield obj[key];
}

function QueryBuilder(table) {
  this.insert = this._buildInsertFunction(table);
  this.update = this._buildUpdateFunction(table);
  this.delete = this._buildDeleteFunction(table);
}
module.exports = QueryBuilder;

QueryBuilder.prototype._buildInsertFunction = function (table) {
  // Collect schema info for select query
  const name = [], select = [], placeholder = [];
  let i = 0;
  for (const collum of itervalues(table.schema)) {
    if (collum.deprecated) continue;
    i += 1;

    name.push(collum.name);
    select.push(`data.${collum.name}`);
    placeholder.push('$' + i);
  }

  // Build insert query
  return new Function('data', `
    return {
      name: "DAWA.replicate.insert.${table.name}",
      text: "INSERT INTO ${table.name} (${name.join(',')}) VALUES(${placeholder.join(',')})",
      values: [${select.join(',')}]
    }
  `);
};

QueryBuilder.prototype._buildUpdateFunction = function (table) {
  // Collect schema info for update query
  const setPairs = [], setSelect = [];
  const wherePairs = [], whereSelect = [];
  let i = 0;
  for (const collum of itervalues(table.schema)) {
    if (collum.deprecated) continue;
    i += 1;

    setPairs.push(`${collum.name} = \$${i}`);
    setSelect.push(`data.${collum.name}`);
  }
  for (const collum of itervalues(table.schema)) {
    if (collum.deprecated) continue;
    if (!collum.primary) continue;
    i += 1;

    wherePairs.push(`${collum.name} = \$${i}`);
    whereSelect.push(`data.${collum.name}`);
  }

  // Build update query
  return new Function('data', `
    return {
      name: "DAWA.replicate.update.${table.name}",
      text: "UPDATE ${table.name} SET ${setPairs.join(',')} WHERE ${wherePairs.join(',')}",
      values: [${setSelect.join(',')},${whereSelect.join(',')}]
    }
  `);
};

QueryBuilder.prototype._buildDeleteFunction = function (table) {
  // Collect schema info for delete query
  const wherePairs = [], whereSelect = [];
  let i = 0;
  for (const collum of itervalues(table.schema)) {
    if (collum.deprecated) continue;
    if (!collum.primary) continue;
    i += 1;

    wherePairs.push(`${collum.name} = \$${i}`);
    whereSelect.push(`data.${collum.name}`);
  }

  // Build delete query
  return new Function('data', `
    return {
      name: "DAWA.replicate.delete.${table.name}",
      text: "DELETE FROM ${table.name} WHERE ${wherePairs.join(',')}",
      values: [${whereSelect.join(',')}]
    }
  `);
};
