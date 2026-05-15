const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...CORS,'Content-Type':'application/json'}});
const err=(msg,s=400)=>json({error:msg},s);
const makeToken=(u)=>btoa(unescape(encodeURIComponent(JSON.stringify({...u,exp:Date.now()+604800000}))));
const parseToken=(t)=>{try{return JSON.parse(decodeURIComponent(escape(atob(t))));}catch{return null;}};
function auth(req){const t=(req.headers.get('Authorization')||'').replace('Bearer ','');if(!t)return null;const p=parseToken(t);return p&&p.exp>Date.now()?p:null;}

export default{async fetch(req,env){try{
  const url=new URL(req.url),p=url.pathname,m=req.method;
  if(m==='OPTIONS')return new Response(null,{headers:CORS});
  if(!p.startsWith('/api/'))return new Response(null,{status:404});
  const db=env.DB;if(!db)return err('DB missing',500);

  // ── Login ──
  if(p==='/api/login'&&m==='POST'){
    const{username,password}=await req.json();
    const u=await db.prepare('SELECT id,username,role,full_name FROM users WHERE username=? AND password=?').bind(username,password).first();
    if(!u)return err('帳號或密碼錯誤',401);
    return json({token:makeToken(u),user:u});
  }

  // ── Checklist by store type ──
  if(p==='/api/checklist'&&m==='GET'){
    const storeType=url.searchParams.get('store_type')||'RC';
    const{results:cats}=await db.prepare("SELECT * FROM categories WHERE store_type=? ORDER BY sort_order").bind(storeType).all();
    const{results:qs}=await db.prepare('SELECT * FROM questions ORDER BY category_id,sort_order').all();
    const{results:opts}=await db.prepare('SELECT * FROM options ORDER BY question_id,sort_order').all();
    return json(cats.map(c=>({...c,questions:qs.filter(q=>q.category_id===c.id).map(q=>({...q,options:opts.filter(o=>o.question_id===q.id).map(o=>({...o,skip_items:o.skip_items?JSON.parse(o.skip_items):[]}))}))  })));
  }

  // ── Photo Upload to R2 ──
  if(p==='/api/upload-photo'&&m==='POST'){
    const user=auth(req);if(!user)return err('未授權',401);
    if(!env.PHOTOS)return err('R2 not configured',500);
    const formData=await req.formData();
    const file=formData.get('file');
    if(!file)return err('No file',400);
    const ext=file.name?.split('.').pop()||'jpg';
    const key=`photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    await env.PHOTOS.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type||'image/jpeg'}});
    // R2 public URL requires custom domain or public bucket
    const bucketUrl=env.R2_PUBLIC_URL||`https://pub-placeholder.r2.dev`;
    return json({url:`${bucketUrl}/${key}`,key});
  }

  const user=auth(req);if(!user)return err('未授權',401);

  // ── Stores ──
  if(p==='/api/stores'&&m==='GET'){const{results}=await db.prepare('SELECT * FROM stores WHERE active=1 ORDER BY code').all();return json(results);}
  if(p==='/api/stores'&&m==='POST'){const{code,name,section}=await req.json();const r=await db.prepare('INSERT OR REPLACE INTO stores(code,name,section,active)VALUES(?,?,?,1)').bind(code,name,section||'').run();return json({id:r.meta.last_row_id,code,name});}
  if(p==='/api/stores'&&m==='PUT'){
    // Batch upsert stores
    const{stores}=await req.json();
    if(stores&&stores.length){
      const stmts=stores.map(s=>db.prepare('INSERT OR REPLACE INTO stores(code,name,section,active)VALUES(?,?,?,1)').bind(s.code,s.name,s.section||''));
      await db.batch(stmts);
    }
    return json({success:true,count:stores?.length||0});
  }

  // ── Assigned Stores ──
  if(p==='/api/assigned-stores'&&m==='GET'){
    const month=url.searchParams.get('month');
    const section=url.searchParams.get('section')||'';
    let q='SELECT * FROM assigned_stores WHERE 1=1';
    const ps=[];
    if(month){q+=' AND month=?';ps.push(parseInt(month));}
    if(section){q+=' AND section=?';ps.push(section);}
    q+=' ORDER BY section,store_code';
    const{results}=await db.prepare(q).bind(...ps).all();
    return json(results);
  }
  if(p==='/api/assigned-stores'&&m==='POST'){
    // Overwrite: delete existing month data first, then insert
    const{month,stores}=await req.json();
    if(!month||!stores)return err('month and stores required');
    await db.prepare('DELETE FROM assigned_stores WHERE month=?').bind(month).run();
    if(stores.length>0){
      const stmts=stores.map(s=>db.prepare('INSERT OR IGNORE INTO assigned_stores(month,store_code,store_name,section,note)VALUES(?,?,?,?,?)').bind(month,s.code||s.store_code,s.name||s.store_name,s.section||'',s.note||''));
      await db.batch(stmts);
    }
    return json({success:true,count:stores.length,month});
  }

  // ── Duplicate check ──
  if(p==='/api/inspections/check'&&m==='POST'){
    const{store_code,audit_date}=await req.json();
    const existing=await db.prepare('SELECT id FROM inspections WHERE store_code=? AND audit_date=?').bind(store_code,audit_date).first();
    return json({exists:!!existing,id:existing?.id||null});
  }

  // ── Create Inspection ──
  if(p==='/api/inspections'&&m==='POST'){
    const b=await req.json();
    const{store_code,store_name,store_type,audit_date,audit_time,inspector_name,section,exec_status,exec_other,has_violation,paper_photo,answers}=b;
    const r=await db.prepare(
      `INSERT INTO inspections(store_code,store_name,store_type,audit_date,audit_time,inspector_name,section,exec_status,exec_other,has_violation,paper_photo,auditor_id)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(store_code,store_name,store_type||'RC',audit_date,audit_time||'',inspector_name,section||'',exec_status,exec_other||'',has_violation||0,paper_photo||'',user.id).run();
    const insId=r.meta.last_row_id;
    if(answers&&answers.length>0){
      const stmts=answers.map(a=>db.prepare('INSERT INTO inspection_answers(inspection_id,question_id,opt_id,param_code,is_vio,skipped,note)VALUES(?,?,?,?,?,?,?)').bind(insId,a.question_id,a.opt_id||null,a.param||null,a.is_vio?1:0,a.skipped?1:0,a.note||null));
      await db.batch(stmts);
    }
    return json({id:insId,has_violation:has_violation||0});
  }

  // ── Query Inspections ──
  if(p==='/api/inspections'&&m==='GET'){
    const start=url.searchParams.get('start_date')||'',end=url.searchParams.get('end_date')||'';
    const section=url.searchParams.get('section')||'';
    const store_type=url.searchParams.get('store_type')||'';
    let w='WHERE audit_date>=? AND audit_date<=?',ps=[start,end];
    if(section){w+=' AND section=?';ps.push(section);}
    if(store_type){w+=' AND store_type=?';ps.push(store_type);}
    const{results}=await db.prepare(`SELECT * FROM inspections ${w} ORDER BY created_at DESC`).bind(...ps).all();
    return json(results);
  }

  // ── Inspection Detail ──
  if(p.match(/^\/api\/inspections\/\d+$/)&&m==='GET'){
    const id=p.split('/').pop();
    const ins=await db.prepare('SELECT * FROM inspections WHERE id=?').bind(id).first();
    if(!ins)return err('找不到',404);
    const{results:answers}=await db.prepare(
      `SELECT ia.*,q.content AS question_content,c.name AS category_name,c.item_no,
       o.label AS option_label,o.is_violation,o.param_code AS option_param
       FROM inspection_answers ia
       JOIN questions q ON q.id=ia.question_id
       JOIN categories c ON c.id=q.category_id
       LEFT JOIN options o ON o.id=ia.opt_id
       WHERE ia.inspection_id=? ORDER BY c.sort_order,q.sort_order`
    ).bind(id).all();
    const{results:logs}=await db.prepare('SELECT * FROM audit_log WHERE inspection_id=? ORDER BY changed_at').bind(id).all().catch(()=>({results:[]}));
    return json({...ins,answers,logs:logs||[]});
  }

  // ── Delete Inspection ──
  if(p.match(/^\/api\/inspections\/\d+$/)&&m==='DELETE'){
    const id=p.split('/').pop();
    const{note,changer}=await req.json().catch(()=>({}));
    await db.batch([
      db.prepare('DELETE FROM inspection_answers WHERE inspection_id=?').bind(id),
      db.prepare('DELETE FROM inspections WHERE id=?').bind(id),
      db.prepare('INSERT INTO audit_log(inspection_id,action,changed_by,note)VALUES(?,?,?,?)').bind(id,'delete',changer||user.username,note||''),
    ]);
    return json({success:true});
  }

  // ── Edit Inspection ──
  if(p.match(/^\/api\/inspections\/\d+$/)&&m==='PUT'){
    const id=p.split('/').pop();
    const{exec_status,exec_other,note,answers,changer}=await req.json();
    await db.prepare('UPDATE inspections SET exec_status=?,exec_other=?,note=? WHERE id=?').bind(exec_status,exec_other||'',note||'',id).run();
    if(answers&&answers.length>0){
      await db.prepare('DELETE FROM inspection_answers WHERE inspection_id=?').bind(id).run();
      const stmts=answers.map(a=>db.prepare('INSERT INTO inspection_answers(inspection_id,question_id,opt_id,param_code,is_vio,skipped,note)VALUES(?,?,?,?,?,?,?)').bind(id,a.question_id,a.opt_id||null,a.param||null,a.is_vio?1:0,a.skipped?1:0,a.note||null));
      await db.batch(stmts);
    }
    await db.prepare('INSERT INTO audit_log(inspection_id,action,changed_by,note)VALUES(?,?,?,?)').bind(id,'edit',changer||user.username,'修改記錄').run();
    return json({success:true});
  }

  // ── Users ──
  if(p==='/api/users'&&m==='GET'){const{results}=await db.prepare('SELECT id,username,full_name,role FROM users').all();return json(results);}
  if(p==='/api/users'&&m==='POST'){const{username,password,full_name,role}=await req.json();const r=await db.prepare('INSERT INTO users(username,password,full_name,role)VALUES(?,?,?,?)').bind(username,password,full_name||'',role||'user').run();return json({id:r.meta.last_row_id});}

  // ── Questions admin ──
  if(p==='/api/questions'&&m==='POST'){
    const{category_id,content}=await req.json();
    const r=await db.prepare('INSERT INTO questions(category_id,content,deduction,sort_order)VALUES(?,?,0,99)').bind(category_id,content).run();
    return json({id:r.meta.last_row_id});
  }
  if(p.match(/^\/api\/questions\/\d+$/)&&m==='PUT'){
    const id=p.split('/').pop();
    const{content}=await req.json();
    await db.prepare('UPDATE questions SET content=? WHERE id=?').bind(content,id).run();
    return json({success:true});
  }
  if(p.match(/^\/api\/questions\/\d+$/)&&m==='DELETE'){
    const id=p.split('/').pop();
    await db.batch([db.prepare('DELETE FROM options WHERE question_id=?').bind(id),db.prepare('DELETE FROM questions WHERE id=?').bind(id)]);
    return json({success:true});
  }
  if(p==='/api/questions/reorder'&&m==='POST'){
    const{id1,order1,id2,order2}=await req.json();
    await db.batch([
      db.prepare('UPDATE questions SET sort_order=? WHERE id=?').bind(order1,id1),
      db.prepare('UPDATE questions SET sort_order=? WHERE id=?').bind(order2,id2),
    ]);
    return json({success:true});
  }

  return err('Not Found',404);
}catch(e){return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...CORS,'Content-Type':'application/json'}});}}};
