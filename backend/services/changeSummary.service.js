const generateChangeSummary = (diff) => {
  const sections = Object.keys(diff);

  if (sections.length === 0) {
    return "No functional changes detected.";
  }

  return `Updated sections: ${sections.join(", ")}`;
};

module.exports = { generateChangeSummary };
