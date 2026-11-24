import type {MetadataRoute} from 'next';

export default function robots():MetadataRoute.Robots{
  const base=process.env.SITE_URL||'https://buy-and-sell-lasers-new-website.vercel.app';
  return {
    rules:{userAgent:'*',allow:'/',disallow:['/account','/portal','/operator','/api/','/homepage-split-preview']},
    sitemap:new URL('/sitemap.xml',base).toString()
  };
}
