export type RecurringFrequency = "weekly" | "biweekly" | "every_3_weeks" | "monthly" | "bimonthly";

export const RECURRING_FREQUENCIES: { value: RecurringFrequency; days: number; label: string }[] = [
  { value: "weekly", days: 7, label: "Weekly" },
  { value: "biweekly", days: 14, label: "Every 2 weeks" },
  { value: "every_3_weeks", days: 21, label: "Every 3 weeks" },
  { value: "monthly", days: 30, label: "Monthly" },
  { value: "bimonthly", days: 60, label: "Bi-monthly" },
];

// The subset customers pick from for Mowing/Bin Cleaning cadence — skips
// "every 3 weeks" since that's specific to admin-managed recurring plans.
export const SERVICE_FREQUENCY_VALUES: RecurringFrequency[] = ["weekly", "biweekly", "monthly", "bimonthly"];

export function daysForFrequency(frequency: string): number {
  return RECURRING_FREQUENCIES.find((f) => f.value === frequency)?.days ?? 14;
}

export function frequencyLabel(frequency: string): string {
  return RECURRING_FREQUENCIES.find((f) => f.value === frequency)?.label ?? frequency;
}
