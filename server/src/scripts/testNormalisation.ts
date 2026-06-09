/**
 * Test harness for normaliseIngredientForCN — 14 cases covering all 5 paths.
 * Run with: npx ts-node src/scripts/testNormalisation.ts
 */

import { normaliseIngredientForCN, simplifyFoodName, isBreadItem } from '../services/macroValidation';

const tests: Array<{ input: string; expected: string; label: string }> = [
  // Path 1 — already has grams, simplify name
  { label: 'P1-a grams + whole wheat roti',   input: '80g whole wheat roti',    expected: '80g roti'      },
  { label: 'P1-b grams + homemade paneer',    input: '100g homemade paneer',    expected: '100g paneer'   },
  { label: 'P1-c grams + multigrain roti',    input: '120g multigrain roti',    expected: '120g roti'     },
  { label: 'P1-d grams + plain name (oats)',  input: '30g rolled oats',         expected: '30g rolled oats' },

  // Path 2 — already has ml, simplify name
  { label: 'P2-a ml + full-fat milk',         input: '300ml full-fat milk',     expected: '300ml milk'    },
  { label: 'P2-b ml + toned milk',            input: '200ml toned milk',        expected: '200ml milk'    },
  { label: 'P2-c ml + low-fat milk',          input: '250ml low-fat milk',      expected: '250ml skim milk' },

  // Path 3 — count + bracket gram hint
  { label: 'P3-a count + hint (rotis)',       input: '2 whole wheat rotis (80g)', expected: '160g roti'   },
  { label: 'P3-b count + hint (naan)',        input: '1 naan (90g)',             expected: '90g naan'     },
  { label: 'P3-c count + hint (idli)',        input: '3 idlis (40g)',            expected: '120g idli'    },

  // Path 4 — count + known item, no hint
  { label: 'P4-a count roti',                input: '2 rotis',                  expected: '80g roti'     },
  { label: 'P4-b count whole wheat rotis',   input: '3 whole wheat rotis',      expected: '120g roti'    },
  { label: 'P4-c count paratha',             input: '1 paratha',                expected: '60g paratha'  },

  // Path 5 — fallback, non-bread count
  { label: 'P5   non-bread count (eggs)',    input: '2 eggs',                   expected: '2 eggs'       },
];

let passed = 0;
let failed = 0;

for (const { label, input, expected } of tests) {
  const result = normaliseIngredientForCN(input);
  const ok = result === expected;
  if (ok) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(`         input:    ${input}`);
    console.log(`         expected: ${expected}`);
    console.log(`         got:      ${result}`);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} tests passed${failed > 0 ? ` — ${failed} FAILED` : ''}`);
process.exit(failed > 0 ? 1 : 0);
