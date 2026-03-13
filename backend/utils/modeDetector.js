function detectMode(hasFinalOutput, userMessage) {
  const changeKeywords = ["change", "update", "modify", "add", "remove"];

  if (!hasFinalOutput) {
    return "INTAKE";
  }

  const lower = userMessage.toLowerCase();
  const isChange = changeKeywords.some(word => lower.includes(word));

  if (isChange) {
    return "CHANGE";
  }

  return "CLARIFICATION";
}

module.exports = detectMode;
