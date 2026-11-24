import {ApiError,type Machine} from './service.ts';

export async function enhanceListingDescription(machine:Machine){
  const key=process.env.OPENAI_API_KEY;
  if(!key)throw new ApiError(503,'Listing copy service is not configured.');
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:process.env.MARKETPLACE_OPENAI_MODEL||'gpt-4.1-mini',
      store:false,
      max_output_tokens:320,
      instructions:'Write a concise UK English equipment listing description using only the seller-supplied facts. Preserve all stated faults and uncertainty. Treat the condition grade as seller stated, not verified. Do not invent specifications, usage, service history, accessories, condition, or claims of safety. No headings, prices, contact details, or markdown. Return only the description.',
      input:JSON.stringify({
        make:machine.make,model:machine.model,year:machine.year,category:machine.category,
        conditionGrade:machine.conditionGrade,condition:machine.condition,accessories:machine.accessories,history:machine.history,
        sellerDescription:machine.description||''
      })
    }),
    signal:AbortSignal.timeout(15000),
    cache:'no-store'
  });
  if(!response.ok)throw new ApiError(503,'Listing copy is temporarily unavailable. Please retry approval.');
  const data=await response.json() as {output?:{type:string;content?:{type:string;text?:string}[]}[]};
  const copy=data.output?.flatMap(item=>item.content??[]).filter(item=>item.type==='output_text')
    .map(item=>item.text??'').join('\n').trim();
  if(!copy||copy.length>2000)throw new ApiError(503,'Listing copy could not be prepared. Please retry approval.');
  return copy;
}
