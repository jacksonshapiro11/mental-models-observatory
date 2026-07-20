/**
 * Mechanical check: zoom-out Sunday Weekly wins over a same-day daily.
 * Run: npx tsx scripts/weekly-window-regression.ts
 *
 * Worked failure (2026-07-19 / W29): daily 2026-07-19 shipped morning, Weekly
 * landed evening; `latestDaily >= weeklySunday` kept /daily-update on the daily.
 */
import assert from 'node:assert/strict';
import { weeklyIsCurrent } from '../lib/weekly-window';

function main() {
  const today = '2026-07-19';
  const w29Sunday = '2026-07-19';

  // Failure case that hid W29 on the front page
  assert.equal(
    weeklyIsCurrent(w29Sunday, '2026-07-19', today),
    true,
    'same-day daily must NOT suppress The Weekly',
  );

  // Healthy: Monday daily ends the zoom-out window
  assert.equal(
    weeklyIsCurrent(w29Sunday, '2026-07-20', '2026-07-20'),
    false,
    'newer daily must end weekly front-page window',
  );

  // Healthy: no daily yet → weekly wins once Sunday arrives
  assert.equal(weeklyIsCurrent(w29Sunday, null, today), true);

  // Healthy: future weekly not current
  assert.equal(weeklyIsCurrent('2026-07-26', '2026-07-19', today), false);

  // Fail-safe: prior week suppressed when a later daily exists and that week's
  // Sunday is older (W28 with Jul 19 daily → not current)
  assert.equal(
    weeklyIsCurrent('2026-07-12', '2026-07-19', today),
    false,
    'stale prior weekly must yield once a later daily exists',
  );

  console.log('weekly-window-regression: PASS');
}

main();
