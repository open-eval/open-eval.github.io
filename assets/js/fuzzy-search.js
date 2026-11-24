(function () {
  function matchesWithTypos(term, word) {
    const limit = term.length >= 8 ? 2 : 1;
    if (term.length < 4 || Math.abs(term.length - word.length) > limit) return false;

    let previous = Array.from({ length: word.length + 1 }, (_, i) => i);
    let twoBack;
    for (let i = 1; i <= term.length; i++) {
      const current = [i];
      for (let j = 1; j <= word.length; j++) {
        const substitution = term[i - 1] === word[j - 1] ? 0 : 1;
        current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + substitution);
        if (i > 1 && j > 1 && term[i - 1] === word[j - 2] && term[i - 2] === word[j - 1]) {
          current[j] = Math.min(current[j], twoBack[j - 2] + 1);
        }
      }
      twoBack = previous;
      previous = current;
    }
    return previous[word.length] <= limit;
  }

  window.OEC_createFuzzyMatcher = function (query) {
    const needle = query.trim().toLowerCase();
    if (!needle) return () => true;
    const terms = needle.match(/[\p{L}\p{N}]+/gu) || [];
    return value => {
      const text = value.toLowerCase();
      if (text.includes(needle)) return true;
      if (!terms.length) return false;
      const words = text.match(/[\p{L}\p{N}]+/gu) || [];
      return terms.every(term => words.some(word => word.includes(term) || matchesWithTypos(term, word)));
    };
  };
})();
