// Mock chalk for Jest (chalk v5 is ESM-only)
const identity = (s) => s;
const fn = (s) => s;
fn.green = identity;
fn.red = identity;
fn.yellow = identity;
fn.cyan = identity;
fn.bold = identity;
fn.blue = identity;
fn.magenta = identity;

module.exports = fn;
module.exports.default = fn;
