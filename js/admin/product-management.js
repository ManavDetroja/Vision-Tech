import { categories } from '../data/categories.js';
import { productImageMarkup, bindProductImageFallbacks } from '../components/product-image.js';

const option=(esc,value,label)=>'<option value="'+esc(value)+'">'+esc(label)+'</option>';
function select(esc,name,label,items,first='All'){
  return '<label>'+label+'<select name="'+name+'">'+option(esc,'',first)+items.map(([v,l])=>option(esc,v,l)).join('')+'</select></label>';
}
function input(name,label,max){return '<label>'+label+'<input name="'+name+'" maxlength="'+max+'"></label>';}
function area(name,label,rows=3){return '<label>'+label+'<textarea name="'+name+'" rows="'+rows+'"></textarea></label>';}
function dialog(view,title,content){
  const el=document.createElement('dialog');
  el.className='admin-dialog catalogue-editor';
  el.setAttribute('aria-label',title);
  el.innerHTML='<form><h2></h2>'+content+'<p role="alert"></p><div class="admin-actions"><button type="button" data-cancel class="button button-outline">Close</button><button class="button button-primary" type="submit">Save</button></div></form>';
  el.querySelector('h2').textContent=title;
  el.querySelector('[data-cancel]').onclick=()=>el.close();
  el.addEventListener('close',()=>el.remove(),{once:true});
  view.append(el);el.showModal();return el;
}
const pairs=values=>values.map(v=>[v,v]);
const categoryPairs=categories.map(c=>[c.id,c.name]);
function lines(value){return value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);}
export async function renderProductManager({view,api,heading,esc,toast}){
  const {products,assets,reviewer,actorId}=await api('/api/admin/products');
  view.innerHTML=heading('Product catalogue',products.length+' records','<button class="button button-primary" data-add>Add product</button>')+
    '<form class="catalogue-filterbar">'+input('search','Search model or name',120)+select(esc,'category','Category',categoryPairs)+select(esc,'sub','Subcategory',[])+
    select(esc,'mp','Resolution',pairs([...new Set(products.map(p=>p.record.resolutionMp).filter(Number.isFinite))].sort((a,b)=>a-b)).map(([v])=>[v,v+' MP']))+
    select(esc,'visible','Visibility',[['yes','Published'],['no','Archived']])+select(esc,'sort','Sort by',[['name','Name'],['category','Category'],['created','Newest first']],'Model')+'</form>'+
    '<p role="status" data-stats></p><div class="admin-table-wrap"><table><thead><tr><th>Model</th><th>Product</th><th>Category</th><th>Visibility</th><th>Actions</th></tr></thead><tbody></tbody></table></div><nav class="admin-actions" aria-label="Product pages"><button class="button button-outline" data-prev>Previous</button><button class="button button-outline" data-next>Next</button></nav>';
  const form=view.querySelector('form'), controls=form.elements;
  let page=0;
  function subChoices(){
    const cats=categories.filter(c=>!controls.category.value||c.id===controls.category.value);
    controls.sub.innerHTML=option(esc,'','All')+[...new Set(cats.flatMap(c=>c.subcategories))].map(v=>option(esc,v,v)).join('');
  }
  function draw(){
    const query=controls.search.value.trim().toLowerCase();
    const rows=products.filter(p=>(p.model+' '+(p.record.name||'')).toLowerCase().includes(query) &&
      (!controls.category.value||p.category_id===controls.category.value)&&(!controls.sub.value||p.record.subcategory===controls.sub.value)&&
      (!controls.mp.value||Number(controls.mp.value)===p.record.resolutionMp)&&(!controls.visible.value||p.is_visible===(controls.visible.value==='yes')));
    const key=p=>controls.sort.value==='name'?p.record.name||p.model:controls.sort.value==='category'?p.category_id:p.model;
    rows.sort((a,b)=>controls.sort.value==='created'?b.created_at.localeCompare(a.created_at)||a.model.localeCompare(b.model):key(a).localeCompare(key(b))||a.model.localeCompare(b.model));
    const pages=Math.max(1,Math.ceil(rows.length/10)); page=Math.min(page,pages-1);
    view.querySelector('[data-stats]').textContent=rows.length+' matches · Page '+(page+1)+' of '+pages;
    view.querySelector('tbody').innerHTML=rows.slice(page*10,page*10+10).map(p=>'<tr><th scope="row">'+esc(p.model)+'</th><td>'+esc(p.record.name||'—')+'</td><td>'+esc(categories.find(c=>c.id===p.category_id)?.name||p.category_id)+'</td><td>'+(p.is_visible?'Published':'Archived')+'</td><td><button type="button" data-preview="'+esc(p.id)+'">Preview</button> <button type="button" data-edit="'+esc(p.id)+'">Edit</button></td></tr>').join('')||'<tr><td colspan="5">No matching products.</td></tr>';
    view.querySelector('[data-prev]').disabled=!page;view.querySelector('[data-next]').disabled=page+1>=pages;
  }
  const open=p=>editProduct(p,{view,api,esc,assets,reviewer,actorId,onSaved:saved=>{
    const index=products.findIndex(x=>x.id===saved.id);
    if(index<0)products.push(saved);else products[index]=saved;
    toast('Product saved.');draw();
  }});
  view.querySelector('tbody').onclick=e=>{
    const b=e.target.closest('button');if(!b)return;
    const row=products.find(x=>x.id===(b.dataset.edit||b.dataset.preview));
    if(b.dataset.edit){open(row);return;}
    const r=row.record,el=dialog(view,row.model,productImageMarkup(r,{assetPrefix:'../'})+'<h3>'+esc(r.name||r.model)+'</h3><p>'+esc(r.description||'')+'</p><ul>'+(r.features||[]).map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul><dl>'+Object.entries(r.specifications||{}).map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v??'—')+'</dd>').join('')+'</dl>');
    const primary = assets.find(asset => asset.id === r.mediaIds?.[0] && asset.model === row.model);
    if (primary) {
      const image = document.createElement('img');
      image.src = '/api/admin/products/images/' + encodeURIComponent(primary.id);
      image.alt = 'Private preview of ' + row.model;
      image.dataset.productImage = '';
      el.querySelector('[data-product-image-frame]').replaceChildren(image);
    }
    el.querySelector('[type=submit]').remove();bindProductImageFallbacks(el);
  };
  form.onsubmit=e=>e.preventDefault();
  form.oninput=e=>{if(e.target===controls.category)subChoices();page=0;draw();};
  view.querySelector('[data-prev]').onclick=()=>{page--;draw();};view.querySelector('[data-next]').onclick=()=>{page++;draw();};
  view.querySelector('[data-add]').onclick=()=>open(null);subChoices();draw();
}
function editProduct(row,{view,api,esc,assets,reviewer,actorId,onSaved}){
  const r=row?.record||{}, el=dialog(view,row?'Edit '+row.model:'Add product',
    input('model','Exact model',100)+input('name','Product name',240)+input('brand','Brand',100)+select(esc,'categoryId','Category',categoryPairs,'Select category')+
    select(esc,'subcategory','Subcategory',[],'None')+'<label>Resolution (MP)<input type="number" step="any" min="0.01" max="1000" name="resolutionMp"></label>'+
    area('description','Product description')+area('features','Features · one per line')+area('specs','Specifications · one key and value per line, separated by =',6)+input('source','Official exact-model source for changed features or specifications',1200)+
    input('seoTitle','SEO title',180)+area('seoDescription','SEO description')+
    '<fieldset><legend>Product photographs</legend><div data-photos></div><label>Upload JPEG, PNG or WebP (up to 4 MiB)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label><label><input type="checkbox" name="rights"> I checked the model and am submitting this file for private review.</label><button type="button" data-upload>Upload photograph</button><p data-upload-status role="status"></p></fieldset>'+
    '<label><input type="checkbox" name="featured"> Feature first in the catalogue</label><label><input type="checkbox" name="visible"> Published (clear to archive)</label>');
  const form=el.querySelector('form'), f=form.elements, error=el.querySelector('[role=alert]');
  for(const k of ['model','name','description','brand','seoTitle','seoDescription','categoryId','resolutionMp'])f.namedItem(k).value=r[k]??'';
  f.source.value=r.pendingSource||'';
  f.model.required=true;f.model.readOnly=!!row;f.categoryId.required=true;
  function subs(){f.subcategory.innerHTML=option(esc,'','None')+(categories.find(c=>c.id===f.categoryId.value)?.subcategories||[]).map(v=>option(esc,v,v)).join('');}
  subs();f.subcategory.value=r.subcategory||'';f.categoryId.onchange=subs;
  f.features.value=(r.features||[]).join('\n');
  const originals=r.specifications||{};
  const display=v=>typeof v==='string'?v:JSON.stringify(v);
  f.specs.value=Object.entries(originals).map(([k,v])=>k+' = '+display(v)).join('\n');
  f.visible.checked=row?.is_visible===true;f.featured.checked=r.featured===true;
  let photos=[...(r.mediaIds||[])];
  function gallery(){
    const box=el.querySelector('[data-photos]');
    const library=assets.filter(a=>a.model===f.model.value);
    box.innerHTML=library.map(a=>{
      const i=photos.indexOf(a.id);
      return '<div><img src="/api/admin/products/images/'+esc(a.id)+'" width="64" height="64" alt="Private model photograph"> '+(a.approved?'Approved':'Awaiting rights review')+
        (i===0?' · Primary':'')+' <button type="button" data-toggle="'+esc(a.id)+'">'+(i<0?'Attach':'Detach')+'</button>'+
        (i>0?' <button type="button" data-primary="'+esc(a.id)+'">Make primary</button>':'')+
        (reviewer && (a.approved || a.uploaded_by!==actorId)?' <button type="button" data-review="'+esc(a.id)+'">'+(a.approved?'Withdraw rights approval':'Approve exact model and commercial rights')+'</button>':'')+'</div>';
    }).join('')||'No private photographs for this model.';
    box.onclick=async event=>{
      const b=event.target.closest('button');if(!b)return;
      if(b.dataset.toggle){const id=b.dataset.toggle;photos=photos.includes(id)?photos.filter(p=>p!==id):[...photos,id];}
      if(b.dataset.primary)photos=[b.dataset.primary,...photos.filter(p=>p!==b.dataset.primary)];
      if(b.dataset.review){
        const asset=library.find(a=>a.id===b.dataset.review);
        const evidence=prompt('Enter the rights document reference or withdrawal reason.');
        if(!evidence?.trim())return;
        b.disabled=true;
        try{const result=await api('/api/admin/products/images/'+asset.id+'/review',{method:'POST',body:JSON.stringify({approved:!asset.approved,evidence})});asset.approved=result.approved;}
        catch(err){error.textContent=err.message;}finally{b.disabled=false;}
      }
      gallery();
    };
  }
  f.model.oninput=()=>{photos=[];gallery();};
  gallery();
  const upload=el.querySelector('[data-upload]'), save=el.querySelector('[type=submit]');
  upload.onclick=async()=>{
    error.textContent='';const file=f.photo.files[0];
    if(!file || !f.rights.checked || !file.size || file.size>4194304 || !['image/jpeg','image/png','image/webp'].includes(file.type)){error.textContent='Select an eligible file and confirm the model.';return;}
    upload.disabled=save.disabled=true;
    el.querySelector('[data-upload-status]').textContent='Uploading for private review…';
    try{const bytes=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('The file could not be read.'));reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(file);});
      const result=await api('/api/admin/products/images',{method:'POST',signal:AbortSignal.timeout(90000),body:JSON.stringify({model:f.model.value,pendingReview:true,type:file.type,bytes})});
      if(!assets.some(a=>a.id===result.asset.id))assets.push({...result.asset,model:f.model.value}); photos=[...new Set([...photos,result.asset.id])];gallery();el.querySelector('[data-upload-status]').textContent='Uploaded. Save to attach the photograph.';
    }catch(err){el.querySelector('[data-upload-status]').textContent='';error.textContent=err.message;}finally{upload.disabled=save.disabled=false;}
  };
  form.onsubmit=async e=>{
    e.preventDefault();error.textContent='';
    if(row?.is_visible!==f.visible.checked && (row||f.visible.checked) && !confirm(f.visible.checked?'Publish this product?':'Archive this product?'))return;
    try{
      const specifications=Object.create(null);
      for(const line of lines(f.specs.value)){const i=line.indexOf('=');if(i<1)throw Error('Each specification requires a name = value.');const k=line.slice(0,i).trim(),v=line.slice(i+1).trim();
        if(Object.hasOwn(specifications,k))throw Error('Duplicate specification: '+k); specifications[k]=Object.hasOwn(originals,k)&&display(originals[k])===v?originals[k]:v;}
      const record=Object.fromEntries(['name','brand','description','seoTitle','seoDescription','categoryId','subcategory','source'].map(k=>[k,f.namedItem(k).value]));
      Object.assign(record,{features:lines(f.features.value),specifications,resolutionMp:f.resolutionMp.value?Number(f.resolutionMp.value):null,featured:f.featured.checked,mediaIds:photos});
      save.disabled=upload.disabled=true;
      const result=await api('/api/admin/products'+(row?'/'+encodeURIComponent(row.id):''),{method:row?'PATCH':'POST',body:JSON.stringify({model:f.model.value,record,isVisible:f.visible.checked,expected:row?.updated_at})});
      el.close();onSaved(result.product);
    }catch(err){error.textContent=err.message;}finally{save.disabled=upload.disabled=false;}
  };
}
export async function renderServiceManager(ctx){
  const {view,api,heading,esc,toast}=ctx;
  const {services}=await api('/api/admin/services');
  view.innerHTML=heading('Service content','Edit published service descriptions and topics.')+'<div class="admin-record-list">'+services.map((s,i)=>'<article class="admin-card"><h2>'+esc(s.record.title)+'</h2><p>'+esc(s.record.summary)+'</p><button data-service="'+i+'">Edit '+(s.is_visible?'published':'hidden')+' service</button></article>').join('')+'</div>';
  if(!services.length)view.insertAdjacentHTML('beforeend','<p>No service records have been initialized.</p>');
  for(const btn of view.querySelectorAll('[data-service]'))btn.onclick=()=>{
    const s=services[Number(btn.dataset.service)],r=s.record,el=dialog(view,'Edit service',input('title','Title',240)+area('summary','Summary')+area('description','Description')+area('capabilities','Topics · one per line')+'<label><input type="checkbox" name="visible"> Published</label>');
    const form=el.querySelector('form'),f=form.elements;
    for(const k of ['title','summary','description'])f[k].value=r[k]||'';
    f.capabilities.value=(r.capabilities||[]).join('\n');f.visible.checked=s.is_visible;
    form.onsubmit=async e=>{e.preventDefault();if(s.is_visible!==f.visible.checked&&!confirm('Change public service visibility?'))return;
      const button=el.querySelector('[type=submit]');button.disabled=true;
      try{await api('/api/admin/services/'+s.id,{method:'PATCH',body:JSON.stringify({record:{id:s.id,title:f.title.value,summary:f.summary.value,description:f.description.value,capabilities:lines(f.capabilities.value)},isVisible:f.visible.checked})});
        el.close();toast('Service saved.');await renderServiceManager(ctx);
      }catch(err){el.querySelector('[role=alert]').textContent=err.message;}finally{button.disabled=false;}};
  };
}
