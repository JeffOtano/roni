/**
 * Console reporting + pass/fail decisions for smoke evals.
 */
import type { Capability } from "../../../../convex/ai/evalScenarios";
import { CAPABILITY_PASS_RATE, OVERALL_PASS_RATE } from "./thresholds";

export interface ScenarioResult {
  name: string;
  capability: Capability;
  passed: boolean;
  notes: string[];
}

export interface Report {
  total: number;
  passed: number;
  results: ScenarioResult[];
}

function rate(report: Report): number {
  return report.total === 0 ? 0 : report.passed / report.total;
}

function rateByCapability(report: Report): Map<Capability, { total: number; passed: number }> {
  const buckets = new Map<Capability, { total: number; passed: number }>();
  for (const r of report.results) {
    const bucket = buckets.get(r.capability) ?? { total: 0, passed: 0 };
    bucket.total += 1;
    if (r.passed) bucket.passed += 1;
    buckets.set(r.capability, bucket);
  }
  return buckets;
}

export function printReport(report: Report): void {
  console.log("\n=== AI coach prompt smoke eval ===");
  console.log(`Total: ${report.passed}/${report.total} (${(rate(report) * 100).toFixed(1)}%)\n`);

  const byCap = rateByCapability(report);
  for (const [cap, bucket] of byCap) {
    const pct = bucket.total === 0 ? 0 : (bucket.passed / bucket.total) * 100;
    console.log(`  ${cap}: ${bucket.passed}/${bucket.total} (${pct.toFixed(1)}%)`);
  }

  const failures = report.results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - [${f.capability}] ${f.name}`);
      for (const note of f.notes) console.log(`      ${note}`);
    }
  }
}

interface ThresholdDecision {
  passed: boolean;
  reasons: string[];
}

export function decide(report: Report): ThresholdDecision {
  const reasons: string[] = [];
  const overall = rate(report);
  if (overall < OVERALL_PASS_RATE) {
    reasons.push(
      `overall pass rate ${overall.toFixed(2)} below threshold ${OVERALL_PASS_RATE.toFixed(2)}`,
    );
  }
  for (const [cap, bucket] of rateByCapability(report)) {
    const r = bucket.total === 0 ? 1 : bucket.passed / bucket.total;
    const floor = CAPABILITY_PASS_RATE[cap];
    if (r < floor)
      reasons.push(`${cap} pass rate ${r.toFixed(2)} below threshold ${floor.toFixed(2)}`);
  }
  return { passed: reasons.length === 0, reasons };
}
