import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {categories,listings} from '@/lib/listings';
import {guides} from '@/lib/guides';
import SiteShell from '@/components/SiteShell';
import Catalogue from '@/components/Catalogue';
import ProductPage from '@/components/ProductPage';
import {getCategoryContent} from '@/lib/category-content';
import {CategoryHeader,CategoryGuide} from '@/components/CategoryContent';
import {ContactPage,DraftPage,GuideIndex,PolicyPage,SellingPage,packages} from '@/components/SupportingPages';
import AboutExperience from '@/components/AboutExperience';
import GuideExperience from '@/components/GuideExperience';
const support=['shop','sell-your-laser','about','choose-us','contact','blog','privacy-policy','terms-and-conditions'];
export const dynamicParams=false;
export function generateStaticParams(){return [...support,...categories.map(c=>c.path.slice(1,-1)),...listings.map(l=>l.path.slice(1,-1)),...guides.map(g=>g.slug),...packages.map(p=>'sell-my-laser/'+p.id)].map(p=>({slug:p.split('/')}));}
export async function generateMetadata({params}:{params:Promise<{slug:string[]}>}):Promise<Metadata>{
  const {slug}=await params;
  const path='/'+slug.join('/')+'/';
  const product=listings.find(item=>item.path===path);
  const guide=guides.find(item=>item.slug===slug.join('/'));
  const category=categories.find(item=>item.path===path);
  const info=category?getCategoryContent(category.name):undefined;
  const url=new URL(path,process.env.SITE_URL||'https://buy-and-sell-lasers-new-website.vercel.app').toString();
  if(info){
    const title=info.title+' | Buy & Sell Lasers';
    return {title,description:info.meta,alternates:{canonical:url},openGraph:{title,description:info.meta,url,type:'website'},twitter:{card:'summary',title,description:info.meta}};
  }
  if(guide){
    const title=`${guide.title} | Buy & Sell Lasers`;
    return {title,description:guide.subtitle,keywords:[guide.keyword],alternates:{canonical:url},openGraph:{title,description:guide.subtitle,url,type:'article',images:[{url:`/images/${guide.image}.webp`,alt:guide.title}]},twitter:{card:'summary_large_image',title,description:guide.subtitle,images:[`/images/${guide.image}.webp`]}};
  }
  const title=product?`${product.brand} ${product.name} (${product.year})`:category?.name??(slug[0]==='sell-my-laser'?`${slug[1][0].toUpperCase()+slug[1].slice(1)} listing draft`:slug[0].split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '));
  return {title:`${title} | Buy & Sell Lasers`,description:product?.description??'Explore pre-owned laser and aesthetic equipment, buying guides and seller listing packages.',robots:product?.id==='vcombo'?{index:false,follow:false}:undefined};
}
export default async function Page({params}:{params:Promise<{slug:string[]}>}){const {slug}=await params;const key=slug.join('/'),path='/'+key+'/';const product=listings.find(l=>l.path===path);const category=categories.find(c=>c.path===path);let body;if(product)body=<ProductPage listing={product}/>;else if(category){const info=getCategoryContent(category.name)!;body=<><CategoryHeader content={info}/><Catalogue category={category.name} hideIntro/><CategoryGuide content={info}/></>;}else if(key==='shop')body=<Catalogue/>;else if(key==='sell-your-laser')body=<SellingPage/>;else if(key==='about'||key==='choose-us')body=<AboutExperience how={key==='choose-us'}/>;else if(key==='contact')body=<ContactPage/>;else if(key==='blog')body=<GuideIndex/>;else if(key==='privacy-policy'||key==='terms-and-conditions')body=<PolicyPage terms={key==='terms-and-conditions'}/>;else if(guides.some(g=>g.slug===key))body=<GuideExperience slug={key}/>;else if(slug[0]==='sell-my-laser'&&packages.some(p=>p.id===slug[1]))body=<DraftPage tier={slug[1]}/>;else notFound();return <SiteShell>{body}</SiteShell>}
