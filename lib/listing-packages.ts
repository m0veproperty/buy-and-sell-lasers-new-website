/** One source for presentation and future server-side fee calculation. Amounts are pence. */
export const listingPackages = [
  {id:'basic', name:'Basic', feePence:7500, maxAskingPence:300000, durationDays:30, photoLimit:5, range:'Machines up to £3,000', features:['Standard search placement','Email support']},
  {id:'standard', name:'Standard', feePence:12000, maxAskingPence:1500000, durationDays:60, photoLimit:10, range:'Machines £3,000.01–£15,000', features:['Enhanced search visibility','Email and phone support']},
  {id:'premium', name:'Premium', feePence:15000, maxAskingPence:null, durationDays:90, photoLimit:null, range:'Machines above £15,000', features:['Featured placement','One-week homepage feature','Priority support']},
] as const;

export type PackageId = typeof listingPackages[number]['id'];

export function packageForPrice(askingPence:number) {
  if (!Number.isSafeInteger(askingPence) || askingPence <= 0) throw new Error('Asking price must be a positive integer in pence.');
  return listingPackages.find(p => p.maxAskingPence === null || askingPence <= p.maxAskingPence)!;
}

/** Ignore client-provided fees. The server derives the amount from stored machine data. */
export function quoteListingFee(askingPence:number, requestedPackage:PackageId) {
  const pack = packageForPrice(askingPence);
  if (pack.id !== requestedPackage) throw new Error('Package does not match the machine asking price.');
  return {packageId:pack.id, amountPence:pack.feePence, currency:'gbp' as const, durationDays:pack.durationDays};
}
