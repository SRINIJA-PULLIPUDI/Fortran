/**
 * Lightweight plagiarism checker.
 *
 * Real plagiarism detectors (MOSS, JPlag) build tokenized fingerprint indexes
 * (winnowing / k-gram hashing) so they're robust to renamed variables and
 * reordered code. This is a simplified but genuinely-working version of the
 * same idea: it strips whitespace/comments, tokenizes into overlapping
 * n-grams, and computes Jaccard similarity between submissions for the same
 * problem. It flags any pair above a similarity threshold.
 *
 * Swap-in point: replace `similarity()` with a call to a hosted MOSS-like API
 * if/when you have access to one -- callers only care about getting back a
 * 0-100 score plus the list of submissions it was compared against.
 */

const N_GRAM_SIZE = 5;
const FLAG_THRESHOLD = 70; // percent

function normalize(code) {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/#.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenize(code) {
  return normalize(code).split(/[^a-z0-9_]+/).filter(Boolean);
}

function nGrams(tokens, n) {
  const grams = new Set();
  for (let i = 0; i + n <= tokens.length; i++) {
    grams.add(tokens.slice(i, i + n).join(' '));
  }
  return grams;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const gram of setA) {
    if (setB.has(gram)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

/**
 * candidate: { code }
 * others: [{ _id, code }] - other submissions for the same problem/contest
 * Returns { maxSimilarity, flaggedAgainst: [submissionId, ...] }
 */
function checkPlagiarism(candidate, others) {
  const candidateGrams = nGrams(tokenize(candidate.code), N_GRAM_SIZE);
  let maxSimilarity = 0;
  const flaggedAgainst = [];

  for (const other of others) {
    const otherGrams = nGrams(tokenize(other.code), N_GRAM_SIZE);
    const score = jaccardSimilarity(candidateGrams, otherGrams);
    if (score > maxSimilarity) maxSimilarity = score;
    if (score >= FLAG_THRESHOLD) flaggedAgainst.push(other._id);
  }

  return { maxSimilarity, flaggedAgainst, threshold: FLAG_THRESHOLD };
}

module.exports = { checkPlagiarism };
