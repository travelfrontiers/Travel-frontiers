// A trip UUID maps to one checklist row even when the delivery action is retried.
export function deliveryTaskId(tripId: string) {
  const prefix = (parseInt(tripId.slice(0, 8), 16) ^ 0xb61d9a2c) >>> 0;
  return prefix.toString(16).padStart(8, "0") + tripId.slice(8);
}
