import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {guides} from '../lib/guides.ts';
import {editorialArticles,editorialSources} from '../lib/editorial-articles.ts';

test('the article batch has unique routes, keywords, sources and image assets',()=>{
  assert.equal(editorialArticles.length,20);
  assert.equal(guides.length,24);
  assert.equal(new Set(guides.map(article=>article.slug)).size,guides.length);
  for(const article of guides){
    assert.match(article.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(article.title.trim().length>15);
    assert.ok(article.keyword.trim().length>5);
    assert.ok(article.sections.length>=4);
    assert.ok(article.sections.every(([heading,body])=>heading.trim()&&body.trim().length>40));
    assert.ok(existsSync(join(process.cwd(),'public','images',`${article.image}.webp`)),`Missing image: ${article.image}`);
    for(const id of article.sources)assert.ok(editorialSources[id],`Unknown source ${id} on ${article.slug}`);
  }
});
