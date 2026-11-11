export type CommissionInputs={commission:number;travelerCount:number;travelerPrice:number;selfTravels:boolean;costPerTraveler:number;shareSaving:boolean;cedeCommission:boolean;requestedCession:number};
export const commissionRulesVersion="tf-commission-v1";
export const roundEuro=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
export function calculateCommission(input:CommissionInputs){
 const commissionTotal=Math.max(0,input.commission),people=Math.max(1,Math.floor(input.travelerCount)||1);
 const price=Math.max(0,input.travelerPrice),cost=Math.max(0,input.costPerTraveler),requested=Math.max(0,input.requestedCession);
 const others=input.selfTravels?Math.max(0,people-1):people;
 const gross=roundEuro(commissionTotal*0.8);
 const ownCostPlusOne=input.selfTravels?roundEuro(cost*1.01):0;
 const potentialSaving=input.selfTravels?Math.max(0,roundEuro(price-ownCostPlusOne)):0;
 const sharing=input.selfTravels&&input.shareSaving&&people>1;
 const savingEach=sharing?potentialSaving/people:0,sharedPrice=sharing?price-savingEach:price;
 const ownPrice=input.selfTravels?(sharing?sharedPrice:ownCostPlusOne):null;
 const cessionActive=!input.selfTravels||(input.cedeCommission&&others>0);
 const maxCession=cessionActive?Math.min(gross,roundEuro(sharedPrice*others)):0;
 const ceded=roundEuro(Math.min(requested,maxCession)),netCommission=roundEuro(gross-ceded),cessionEach=others>0?ceded/others:0;
 const otherFinalPrice=others>0?Math.max(0,roundEuro(sharedPrice-cessionEach)):null;
 const totalCollected=input.selfTravels?roundEuro((ownPrice??0)+sharedPrice*others-ceded):roundEuro(sharedPrice*others-ceded);
 const totalCents = Math.round(totalCollected * 100);
 const ownCents = ownPrice === null ? 0 : Math.min(totalCents, Math.round(ownPrice * 100));
 const otherPriceGroups: { count: number; price: number }[] = [];
 if (others) {
  const passengerCents = totalCents - ownCents;
  const baseCents = Math.floor(passengerCents / others);
  const extraCents = passengerCents % others;
  if (extraCents) otherPriceGroups.push({ count: extraCents, price: (baseCents + 1) / 100 });
  otherPriceGroups.push({ count: others - extraCents, price: baseCents / 100 });
 }
 return { people, others, gross, ownCostPlusOne, ownPrice: ownPrice === null ? null : ownCents / 100,
  potentialSaving, savingEach, sharing, sharedPrice, ceded, netCommission, cessionEach,
  otherFinalPrice, otherPriceGroups, totalCollected, maxCession, cessionActive };
}
