import type {MetadataRoute} from 'next';
import {guides} from '@/lib/guides';
import {categories,listings} from '@/lib/listings';

const base=process.env.SITE_URL||'https://buy-and-sell-lasers-new-website.vercel.app';
const url=(path:string)=>new URL(path,base).toString();

export default function sitemap():MetadataRoute.Sitemap{
  const pages=['/','/shop/','/sell-your-laser/','/about/','/choose-us/','/contact/','/blog/'];
  return [
    ...pages.map(path=>({url:url(path)})),
    ...categories.map(category=>({url:url(category.path)})),
    ...listings.map(listing=>({url:url(listing.path)})),
    ...guides.map(guide=>({url:url(`/${guide.slug}/`),lastModified:guide.publishedAt?new Date(`${guide.publishedAt}T00:00:00Z`):undefined}))
  ];
}
