import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packageForPrice,quoteListingFee} from '../lib/listing-packages.ts';

test('price band boundaries include every penny without gaps',()=>{
  assert.equal(packageForPrice(1).id,'basic');
  assert.equal(packageForPrice(300000).id,'basic');
  assert.equal(packageForPrice(300001).id,'standard');
  assert.equal(packageForPrice(1500000).id,'standard');
  assert.equal(packageForPrice(1500001).id,'premium');
});
test('invalid prices cannot produce a fee',()=>{
  for(const value of [0,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>packageForPrice(value));
});
test('a seller cannot select a cheaper package for expensive equipment',()=>{
  assert.throws(()=>quoteListingFee(2000000,'basic'));
  assert.throws(()=>quoteListingFee(500000,'premium'));
});
test('listing fee is independent of the machine sale amount',()=>{
  assert.deepEqual(quoteListingFee(950000,'standard'),{packageId:'standard',amountPence:12000,currency:'gbp',durationDays:60});
});
