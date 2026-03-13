const diffBA = (oldBA, newBA) => {
  const diff = {};

  const keysToTrack = [
    "functional_requirements",
    "non_functional_requirements",
    "user_stories",
    "assumptions",
    "constraints"
  ];

  keysToTrack.forEach(key => {
    if (JSON.stringify(oldBA[key]) !== JSON.stringify(newBA[key])) {
      diff[key] = {
        before: oldBA[key] || null,
        after: newBA[key] || null
      };
    }
  });

  return diff;
};

module.exports = { diffBA };
