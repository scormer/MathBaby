// Offline stand-in for Jev so the demo runs without API access.
// Crude keyword matching only — it exists to exercise the UI and belief updates, NOT to judge the ontology.
'use strict';

const KEYWORDS = {
  'NQ-01': ['same number', 'spread out', 'still the same', 'how many without counting', 'at a glance', 'subitiz'],
  'NQ-02': ['count', 'counted', 'how many', 'one by one', 'counting'],
  'NQ-03': ['numeral', 'written number', 'wrote the number', 'read the number', 'digit'],
  'NQ-04': ['bigger number', 'more than', 'less than', 'number line', 'which is bigger', 'compare', 'order'],
  'NQ-05': ['make 5', 'make 10', 'split into', 'parts', 'broke it into', 'part-whole', 'ways to make'],
  'AB-01': ['story problem', 'word problem', 'gave away', 'how many left', 'got more', 'join'],
  'AB-02': ['plus', 'minus', 'add', 'subtract', '+', '-', 'make 10', 'made 10', 'take away'],
  'AB-03': ['tens', 'ones', 'place value', 'bundle', 'groups of ten'],
  'AB-04': ['two-digit', '2-digit', 'regroup', 'carry', 'borrow', 'hundred'],
  'MR-01': ['groups of', 'times', 'multiply', 'array', 'rows of', 'skip count'],
  'MR-02': ['share', 'divide', 'split equally', 'each gets', 'fair share'],
  'MR-03': ['twice as', 'double', 'half as', 'times as many', 'scale'],
  'RD-01': ['half', 'halves', 'quarter', 'equal parts', 'equal pieces', 'third'],
  'RD-02': ['fraction', 'bigger fraction', '1/2', '1/3', '1/4'],
  'RD-03': ['equivalent', 'same as half', '2/4', 'equal fraction'],
  'RD-04': ['decimal', '0.', 'point five', 'tenths'],
  'PA-01': ['pattern', 'repeat', 'abab', 'red blue red', 'what comes next'],
  'PA-02': ['growing', 'each time', 'goes up by', 'keeps adding', 'rule'],
  'PA-03': ['equal sign', 'equals', 'same as', 'balance', '='],
  'PA-04': ['missing number', 'mystery number', 'unknown', '? =', '+ ? =', 'what number'],
  'GS-01': ['triangle', 'square', 'circle', 'rectangle', 'sides', 'corners', 'shape'],
  'GS-02': ['tangram', 'put shapes together', 'made a shape', 'puzzle pieces', 'two triangles'],
  'GS-03': ['left', 'right', 'behind', 'next to', 'above', 'below', 'map', 'directions'],
  'GS-04': ['rotate', 'turn it', 'flip', 'mirror', 'imagine', 'folded'],
  'ME-01': ['longer', 'shorter', 'taller', 'length', 'measure', 'ruler', 'inches', 'cm'],
  'ME-02': ['area', 'cover', 'tiles', 'squares to cover'],
  'ME-03': ['holds more', 'cup', 'fill', 'volume', 'capacity', 'pour'],
  'ME-04': ['heavier', 'lighter', 'weigh', 'scale', 'mass'],
  'ME-05': ['clock', 'time', 'minutes', 'hours', 'o\'clock', 'yesterday', 'tomorrow', 'days'],
  'ME-06': ['angle', 'quarter turn', 'half turn', 'right angle', 'corner turn'],
  'DC-01': ['sort', 'sorted', 'group by', 'category', 'by color', 'by size', 'classify'],
  'DC-02': ['chart', 'graph', 'tally', 'table', 'pictograph'],
  'DC-03': ['most', 'fewest', 'the graph shows', 'compare the chart'],
  'DC-04': ['chance', 'likely', 'unlikely', 'probably', 'dice', 'spinner', 'lucky'],
  'MT-01': ['drew a picture', 'used blocks', 'used fingers', 'acted it out', 'model', 'showed with'],
  'MT-02': ['strategy', 'plan', 'tried another way', 'different way', 'figured out how'],
  'MT-03': ['noticed', 'always', 'every time', 'pattern', 'rule', 'because'],
  'MT-04': ['because', 'explained why', 'proved', 'that\'s wrong', 'mistake', 'convinced'],
  'MT-05': ['like when', 'same as the', 'reminded', 'in real life', 'used it at the store'],
  'MC-01': ['not sure', 'i don\'t know', 'confused', 'checked', 'asked for help', 'realized'],
  'MC-02': ['how she did it', 'how he did it', 'said she used', 'said he used', 'knows which', 'explained how'],
  'MC-03': ['switched', 'gave up', 'tried again', 'kept trying', 'changed strategy', 'frustrated'],
  'MC-04': ['remembered', 'yesterday we learned', 'told me what she learned', 'told me what he learned', 'looked back'],
};

function classifyMock(text, caps) {
  const t = ' ' + text.toLowerCase() + ' ';
  const scores = {};
  for (const c of caps) {
    const hits = (KEYWORDS[c.id] || []).filter(k => t.includes(k)).length;
    const base = hits ? Math.min(0.95, 0.45 + 0.2 * hits) : 0.01 + Math.random() * 0.03;
    scores[c.id] = Math.round(base * 100) / 100;
  }
  return scores;
}

module.exports = { classifyMock };
