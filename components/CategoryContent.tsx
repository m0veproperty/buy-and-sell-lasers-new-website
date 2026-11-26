import {ArrowDown,ArrowUpRight,Check} from 'lucide-react';
import CategoryAtmosphere from './CategoryAtmosphere';
import {categoryVisuals} from '@/lib/category-visuals';
import {categories} from '@/lib/listings';
import type {CategoryContent} from '@/lib/category-content';

export function CategoryHeader({content:c}:{content:CategoryContent}) {
  const visual = categoryVisuals[c.name];
  return <section className="category-header category-studio" data-pattern={c.pattern}>
    <CategoryAtmosphere variant={visual.variant}/>
    <div className="page-width">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/shop/">Equipment</a><span>/</span><span>{c.name}</span></nav>
      <div className="category-studio-grid">
        <div className="category-studio-copy">
          <p className="eyebrow"><span/>{c.label}</p>
          <h1>{c.title}<span>.</span></h1>
          <div className="category-introduction"><p>{c.intro[0]}</p></div>
          <div className="category-header-links"><a className="action" href="#category-equipment">Browse equipment <ArrowDown size={16}/></a><a className="text-link" href="#category-guide">Buying advice <ArrowDown size={16}/></a></div>
        </div>
        <figure className={`category-studio-art category-studio-art-${visual.key}`}>
          <div className="category-studio-halo" aria-hidden="true"/>
          <img src={`/images/categories/${visual.key}.webp`} alt={visual.alt} width="960" height="1200" fetchPriority="high"/>
          <figcaption>Equipment illustration</figcaption>
        </figure>
      </div>
    </div>
  </section>;
}

export function CategoryGuide({content:c}:{content:CategoryContent}){return <section id="category-guide" className="category-guide page-width"><div className="category-guide-heading"><div><p className="eyebrow">A CLOSER LOOK · {c.label}</p><h2>{c.guideTitle}</h2></div><p>{c.guideIntro}</p></div><div className="category-checks">{c.checks.map(([title,body],i)=><article key={title}><span className="category-check-number">0{i+1}<Check size={17}/></span><h3>{title}</h3><p>{body}</p></article>)}</div><div className="category-faq-layout"><div><p className="eyebrow">BEFORE YOU BUY</p><h2>A few good questions.</h2><a className="text-link" href="/how-to-buy-a-pre-owned-cosmetic-laser-safely/">Read the buying guide <ArrowUpRight size={17}/></a></div><div className="category-faqs">{c.faqs.map(([q,a])=><article key={q}><h3>{q}</h3><p>{a}</p></article>)}</div></div><nav className="category-related" aria-label="Related equipment categories"><p className="eyebrow">EXPLORE RELATED EQUIPMENT</p><div>{c.related.map(name=>{const category=categories.find(x=>x.name===name)!;return <a href={category.path} key={name}>{name}<ArrowUpRight size={19}/></a>;})}</div></nav></section>}
