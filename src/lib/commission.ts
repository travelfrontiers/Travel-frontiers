export type CommissionInputs = {
  commission: number;
  travelerCount: number;
  travelerPrice: number;
  selfTravels: boolean;
  shareSaving: boolean;
  cedeCommission: boolean;
  requestedCession: number;
};

export const commissionRulesVersion = "tf-commission-v2";
export const roundEuro = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const toCents = (value: number) => Math.round(roundEuro(Math.max(0, value)) * 100);

export function calculateCommission(input: CommissionInputs) {
  const people = Math.max(1, Math.floor(input.travelerCount) || 1);
  const others = input.selfTravels ? people - 1 : people;
  const commission = toCents(input.commission);
  const price = toCents(input.travelerPrice);

  // Excel uses the unrounded commission per passenger in both formulas.
  const ownBaseUnrounded = input.selfTravels ? Math.max(0, (price * people - commission) * 99 / (100 * people)) : 0;
  const ownBasePrice = Math.round(ownBaseUnrounded);
  const gross = Math.round(commission * others * 4 / (people * 5));
  const fullPrice = input.selfTravels ? ownBasePrice + price * others : price * people;
  const potentialSaving = input.selfTravels ? price - ownBaseUnrounded : 0;
  const sharing = input.selfTravels && input.shareSaving && people > 1;
  const ownPrice = sharing ? Math.round(fullPrice / people) : ownBasePrice;

  const cessionActive = others > 0 && (!input.selfTravels || input.cedeCommission);
  const maxCession = cessionActive ? Math.min(gross, fullPrice - ownPrice) : 0;
  const ceded = Math.min(toCents(input.requestedCession), maxCession);
  const totalCollected = fullPrice - ceded;

  const otherPriceGroups: { count: number; price: number }[] = [];
  if (others) {
    const otherTotal = totalCollected - ownPrice;
    const base = Math.floor(otherTotal / others);
    const extra = otherTotal % others;
    if (extra) otherPriceGroups.push({ count: extra, price: (base + 1) / 100 });
    otherPriceGroups.push({ count: others - extra, price: base / 100 });
  }

  return {
    people, others, gross: gross / 100,
    commissionPerTraveler: commission / people / 100,
    ownBasePrice: input.selfTravels ? ownBasePrice / 100 : null,
    ownPrice: input.selfTravels ? ownPrice / 100 : null,
    potentialSaving: Math.round(potentialSaving) / 100,
    savingEach: sharing ? potentialSaving / people / 100 : 0,
    sharing,
    sharedPrice: (price - (sharing ? potentialSaving / people : 0)) / 100,
    ceded: ceded / 100, netCommission: (gross - ceded) / 100,
    cessionEach: others ? ceded / others / 100 : 0,
    otherPriceGroups, totalCollected: totalCollected / 100,
    maxCession: maxCession / 100, cessionActive,
  };
}
