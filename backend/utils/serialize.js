function serialize(input) {
  if (!input) return "";
  if (typeof input === "string") return input;
  return JSON.stringify(input, null, 2);
}

module.exports = serialize;
