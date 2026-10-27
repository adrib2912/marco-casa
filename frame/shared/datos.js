/* Datos del marco sin servidor propio. ES5 (la WebView del marco es antigua).

   Las pantallas siguen pidiendo /api/... como cuando había servidor en Python. Este archivo intercepta esas
   peticiones (window.fetch) y las resuelve aquí mismo:
     - tiempo y calidad del aire: Open-Meteo, directamente desde el navegador (gratis, sin clave)
     - calendario: una fila de Supabase que rellena la Action de GitHub (scripts/calendario.py)
     - tareas, compra, habituales y fotos: tablas y almacenamiento de Supabase, con sesión iniciada
     - temporizadores: en este marco (localStorage)
   Sin sesión, cualquier pantalla manda a /frame/hv/entrar/. Va antes que cond.js y hv.js en cada página. */
(function(){
  var C=window.MC_CONFIG||{},H=window.HV_CONFIG||{};
  var SB=String(C.SUPABASE_URL||'').replace(/\/+$/,''),KEY=C.SUPABASE_KEY||'',BASE=C.BASE||'/';
  var realFetch=window.fetch.bind(window);
  var MC=window.MC={base:BASE};

  /* ---------- pequeñas utilidades ---------- */
  function get(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch(e){return null;}}
  function put(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function nowS(){return Date.now()/1000;}
  function pad(n){return n<10?'0'+n:''+n;}
  var fmt=null;
  try{fmt=new Intl.DateTimeFormat('en-US',{timeZone:H.timezone||'Europe/Madrid',hour12:false,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric'});}catch(e){}
  function local(d){   // la hora de casa como 'YYYY-MM-DDTHH:MM', sea cual sea la zona del aparato
    d=d||new Date();var o={};
    if(fmt)fmt.formatToParts(d).forEach(function(p){o[p.type]=p.value;});
    else o={year:d.getFullYear(),month:d.getMonth()+1,day:d.getDate(),hour:d.getHours(),minute:d.getMinutes()};
    return o.year+'-'+pad(+o.month)+'-'+pad(+o.day)+'T'+pad((+o.hour)%24)+':'+pad(+o.minute);
  }
  function mins(s){return Math.round(Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10),+s.slice(11,13),+s.slice(14,16))/60000);}
  function fail(msg,status){var e=new Error(msg);e.status=status||503;return e;}
  function norm(s){return String(s||'').replace(/^\s+|\s+$/g,'').toLowerCase();}

  /* ---------- sesión (una cuenta para toda la casa) ---------- */
  var SK='mc-sesion',pending=null;
  function save(d){put(SK,{a:d.access_token,r:d.refresh_token,e:nowS()+(d.expires_in||3600)});}
  function toLogin(){
    if(/\/entrar\//.test(location.pathname))return;
    location.href=BASE+'frame/hv/entrar/?next='+encodeURIComponent(location.pathname+location.search);
  }
  function auth(path,body){
    return realFetch(SB+'/auth/v1/token?grant_type='+path,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json().catch(function(){return {};}).then(function(d){
        if(!r.ok)throw fail(d.error_description||d.msg||d.message||'No se ha podido entrar',r.status);return d;});});
  }
  MC.login=function(email,pass){return auth('password',{email:email,password:pass}).then(save);};
  MC.logout=function(){try{localStorage.removeItem(SK);}catch(e){}toLogin();};
  MC.hasSession=function(){return !!get(SK);};
  function token(){
    var s=get(SK);
    if(!s){toLogin();return Promise.reject(fail('Falta iniciar sesión',401));}
    if(s.e-120>nowS())return Promise.resolve(s.a);
    if(!pending)pending=auth('refresh_token',{refresh_token:s.r}).then(function(d){save(d);pending=null;return d.access_token;},
      function(e){pending=null;if(e.status>=400&&e.status<500){try{localStorage.removeItem(SK);}catch(x){}toLogin();}throw e;});
    return pending;
  }
  /* una llamada a Supabase con la sesión: REST (tablas) o almacenamiento */
  function sb(method,path,body,prefer){
    return token().then(function(t){
      var h={apikey:KEY,Authorization:'Bearer '+t};
      if(body!==undefined)h['Content-Type']='application/json';
      if(prefer)h.Prefer=prefer;
      return realFetch(SB+path,{method:method,headers:h,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
    }).then(function(r){
      if(r.status===401){try{localStorage.removeItem(SK);}catch(e){}toLogin();throw fail('Falta iniciar sesión',401);}
      return r.text().then(function(t){var d=null;try{d=t?JSON.parse(t):null;}catch(e){}
        if(!r.ok)throw fail((d&&(d.message||d.error))||('Error '+r.status),r.status);return d;});
    });
  }
  function rest(method,q,body,prefer){return sb(method,'/rest/v1/'+q,body,prefer);}

  /* ---------- tiempo (Open-Meteo) ---------- */
  var W_TTL=600,A_TTL=1800;
  function weatherUrl(){
    var q={latitude:H.latitude,longitude:H.longitude,timezone:H.timezone,
      temperature_unit:H.temp_unit==='F'?'fahrenheit':'celsius',wind_speed_unit:H.wind_unit||'kmh',
      current:'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m',
      hourly:'temperature_2m,weather_code,precipitation_probability,is_day,uv_index,wind_speed_10m',
      daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max',
      minutely_15:'precipitation',forecast_minutely_15:16,forecast_days:7},s=[];
    for(var k in q)s.push(k+'='+encodeURIComponent(q[k]));
    return 'https://api.open-meteo.com/v1/forecast?'+s.join('&');
  }
  function cached(key,ttl,url){   // compartido entre pantallas: navegar no gasta llamadas
    var c=get(key);
    if(c&&nowS()-c.t<ttl)return Promise.resolve(c);
    return realFetch(url,{cache:'no-store'}).then(function(r){if(!r.ok)throw fail('Open-Meteo '+r.status);return r.json();})
      .then(function(d){var v={t:nowS(),d:d};put(key,v);return v;},function(e){if(c)return c;throw e;});   // sin red: lo último guardado
  }
  function uvDoc(hr,day,today){
    var hours=[],i,peak=0,high=[];
    for(i=0;i<hr.time.length;i++){var v=(hr.uv_index||[])[i];if(hr.time[i].indexOf(today)===0&&v!=null)hours.push({t:hr.time[i],uv:Math.round(v*10)/10});}
    if(!hours.length)return null;
    hours.forEach(function(x){if(x.uv>peak)peak=x.uv;if(x.uv>=6)high.push(x.t);});
    var mx=(day.uv_index_max||[])[0];
    return {max:Math.round((mx!=null?mx:peak)*10)/10,high_from:high[0]||null,
      high_until:high.length?high[high.length-1].slice(0,11)+pad(+high[high.length-1].slice(11,13)+1)+':00':null,hours:hours};
  }
  function nowcast(m15,now){
    if(!m15||!m15.length)return null;
    var nk=now.slice(0,16),from=mins(nk)-15,cur=[],ahead=[];
    m15.forEach(function(s){var m=mins(s.t);if(m<from)return;if(s.t<=nk)cur.push(s);else if(ahead.length<8)ahead.push(s);});
    function inM(t){return Math.max(0,mins(t)-mins(nk));}
    var raining=cur.length&&(cur[cur.length-1].mm||0)>=0.1,i;
    if(raining){for(i=0;i<ahead.length;i++)if((ahead[i].mm||0)<0.1)return {state:'stop',at:ahead[i].t,mins:inM(ahead[i].t)};return {state:'rain'};}
    for(i=0;i<ahead.length;i++)if((ahead[i].mm||0)>=0.1){
      var heavy=false;ahead.forEach(function(s){if((s.mm||0)>=2.5)heavy=true;});
      return {state:'start',at:ahead[i].t,mins:inM(ahead[i].t),heavy:heavy};}
    return null;
  }
  function shapeWeather(d){
    var cur=d.current,hr=d.hourly,day=d.daily,now=local(),hk=now.slice(0,13)+':00',start=hr.time.indexOf(hk),i,j;
    if(start<0)start=0;
    function hour(i){var ws=hr.wind_speed_10m||[];return {t:hr.time[i],temp_f:hr.temperature_2m[i],code:hr.weather_code[i],is_day:hr.is_day[i],
      precip_pct:hr.precipitation_probability[i]||0,wind:i<ws.length?ws[i]:null};}
    function range(a,b){var o=[];for(var k=a;k<Math.min(b,hr.time.length);k++)o.push(hour(k));return o;}
    var days=[];
    for(i=0;i<day.time.length;i++){var hs=[];for(j=0;j<hr.time.length;j++)if(hr.time[j].indexOf(day.time[i])===0)hs.push(hour(j));
      days.push({date:day.time[i],code:day.weather_code[i],hi_f:day.temperature_2m_max[i],lo_f:day.temperature_2m_min[i],
        precip_pct:day.precipitation_probability_max[i]||0,hours:hs});}
    var m=d.minutely_15||{},min15=[];(m.time||[]).forEach(function(t,k){min15.push({t:t,mm:(m.precipitation||[])[k]});});
    return {temp_f:cur.temperature_2m,temp_source:'open-meteo',feels_f:cur.apparent_temperature,code:cur.weather_code,is_day:cur.is_day,
      wind_mph:cur.wind_speed_10m,hi_f:day.temperature_2m_max[0],lo_f:day.temperature_2m_min[0],precip_pct:day.precipitation_probability_max[0]||0,
      sunrise:day.sunrise[0],sunset:day.sunset[0],next_sunrise:day.sunrise.length>1?day.sunrise[1]:null,
      hourly:range(start,start+7),hours24:range(start,start+24),uv:uvDoc(hr,day,now.slice(0,10)),min15:min15,days:days,
      nowcast:nowcast(min15,now)};
  }
  function aqiBand(v){var b=[[50,'buena'],[100,'moderada'],[150,'mala para grupos sensibles'],[200,'mala'],[300,'muy mala']];
    for(var i=0;i<b.length;i++)if(v<=b[i][0])return b[i][1];return 'peligrosa';}

  /* ---------- calendario: lo deja la Action en la tabla "calendario" (una fila) ---------- */
  function calendar(){
    var c=get('mc-cal');
    if(c&&nowS()-c.t<300)return Promise.resolve(c.d);
    return rest('GET','calendario?select=eventos,actualizado&id=eq.1').then(function(rows){
      var d=(rows&&rows[0])||{eventos:[],actualizado:null};if(d.actualizado)put('mc-cal',{t:nowS(),d:d});return d;},
      function(e){if(c)return c.d;throw e;});
  }

  function frameDoc(){
    var out={ok:true,date:local().slice(0,10),collected_at:new Date().toISOString(),calendars:[],calendar_events:[]};
    var jobs=[
      cached('mc-tiempo',W_TTL,weatherUrl()).then(function(v){out.weather=shapeWeather(v.d);out.weather_at=v.t;out.stale=nowS()-v.t>3*3600;},
        function(){out.weather=null;out.stale=true;out.warnings=['No hay datos del tiempo'];}),
      cached('mc-aire',A_TTL,'https://air-quality-api.open-meteo.com/v1/air-quality?latitude='+H.latitude+'&longitude='+H.longitude+'&current=us_aqi&timezone='+encodeURIComponent(H.timezone))
        .then(function(v){var a=v.d.current&&v.d.current.us_aqi;out.aqi=a!=null?{us_aqi:a,band:aqiBand(a)}:null;},function(){out.aqi=null;}),
      calendar().then(function(c){
        var evs=c.eventos||[],now=Date.now();
        out.calendar_events=evs.filter(function(e){return new Date(e.end||e.start).getTime()>now-864e5;});
        out.calendars=(H.calendars||[]).map(function(x){return {key:x.key,name:x.name,color:x.color,status:c.actualizado?'ok':'unavailable'};});
      },function(){out.calendars=(H.calendars||[]).map(function(x){return {key:x.key,name:x.name,color:x.color,status:'unavailable'};});})
    ];
    out.sources={};
    return Promise.all(jobs).then(function(){out.calendars.forEach(function(m){out.sources[m.key]=m.status;});return out;});
  }

  /* ---------- precio de la luz (PVPC): lo deja la Action en la tabla "luz" ---------- */
  function band(p,sorted){   // tercios del día: barata, normal, cara
    var a=sorted[Math.floor(sorted.length/3)],b=sorted[Math.floor(sorted.length*2/3)];
    return p<=a?'barata':p<b?'normal':'cara';
  }
  function bestWindow(hours,n){   // las n horas seguidas más baratas
    var best=null,i,j,s;
    for(i=0;i+n<=hours.length;i++){
      for(s=0,j=i;j<i+n;j++){if(j>i&&mins(hours[j].t)-mins(hours[j-1].t)!==60){s=null;break;}s+=hours[j].p;}
      if(s!=null&&(!best||s<best.sum))best={from:hours[i].t,to:hours[i+n-1].t,sum:s,avg:s/n};
    }
    return best;
  }
  function luzDoc(){
    var c=get('mc-luz');
    var load=c&&nowS()-c.t<900?Promise.resolve(c.d):rest('GET','luz?select=horas,actualizado&id=eq.1').then(function(rows){
      var d=(rows&&rows[0])||{horas:[],actualizado:null};if(d.horas&&d.horas.length)put('mc-luz',{t:nowS(),d:d});return d;},function(e){if(c)return c.d;throw e;});
    return load.then(function(d){
      var now=local(),hk=now.slice(0,13)+':00',today=now.slice(0,10),all=d.horas||[];
      var todays=all.filter(function(h){return h.t.slice(0,10)===today;}),sorted=todays.map(function(h){return h.p;}).sort(function(a,b){return a-b;});
      var cur=null,ahead=all.filter(function(h){return h.t>=hk;});
      all.forEach(function(h){h.band=sorted.length?band(h.p,sorted):'normal';if(h.t===hk)cur=h;});
      return {ok:true,updated:d.actualizado,now:cur,hours:all,today:todays,
        min:sorted.length?sorted[0]:null,max:sorted.length?sorted[sorted.length-1]:null,
        avg:sorted.length?sorted.reduce(function(a,b){return a+b;},0)/sorted.length:null,
        best2:bestWindow(ahead,2),best3:bestWindow(ahead,3),
        tomorrow:all.some(function(h){return h.t.slice(0,10)>today;})};
    });
  }

  /* ---------- tareas ---------- */
  function tasksDoc(){
    return rest('GET','tareas?select=id,titulo,quien,hecha,creada&order=creada.asc').then(function(rows){
      var items=(rows||[]).map(function(r){return {id:r.id,title:r.titulo,who:r.quien||'',done:!!r.hecha,at:new Date(r.creada).getTime()/1000};});
      items.sort(function(a,b){return (a.done?1:0)-(b.done?1:0)||a.at-b.at;});
      return {ok:true,items:items,left:items.filter(function(x){return !x.done;}).length};
    });
  }
  function tasksChange(p){
    var job;
    if('add' in p){var t=String(p.add||'').replace(/^\s+|\s+$/g,'').slice(0,80);if(!t)return Promise.reject(fail('Escribe la tarea',400));
      job=rest('POST','tareas',{titulo:t,quien:String(p.who||'').slice(0,24)},'return=minimal');}
    else if('toggle' in p)job=rest('GET','tareas?select=hecha&id=eq.'+encodeURIComponent(p.toggle)).then(function(r){
        var done=!(r&&r[0]&&r[0].hecha);return rest('PATCH','tareas?id=eq.'+encodeURIComponent(p.toggle),{hecha:done,hecha_en:done?new Date().toISOString():null},'return=minimal');});
    else if('remove' in p)job=rest('DELETE','tareas?id=eq.'+encodeURIComponent(p.remove));
    else if(p.clear_done)job=rest('DELETE','tareas?hecha=eq.true');
    else return Promise.reject(fail('Acción desconocida',400));
    return job.then(tasksDoc);
  }

  /* ---------- compra ---------- */
  function shopDoc(){
    return rest('GET','compra?select=clave,nombre,cantidad,comprado,creado').then(function(rows){
      var items=(rows||[]).map(function(r){return {key:r.clave,name:r.nombre,amount:'',meals:[],added:true,qty:r.cantidad||1,
        at:new Date(r.creado).getTime()/1000,checked:!!r.comprado};});
      items.sort(function(a,b){return (a.checked?1:0)-(b.checked?1:0)||b.at-a.at||(a.name<b.name?-1:1);});
      var d=local().slice(0,10);
      return {ok:true,from_meals:false,start:d,end:d,meals:[],missing:[],items:items,left:items.filter(function(x){return !x.checked;}).length};
    });
  }
  function shopChange(p){
    var q=function(k){return 'compra?clave=eq.'+encodeURIComponent(k);},job;
    if('add' in p){
      var name=String(p.add||'').replace(/^\s+|\s+$/g,'').slice(0,60),k=norm(name);
      if(!name)return Promise.reject(fail('Escribe qué hay que comprar',400));
      name=name.charAt(0).toUpperCase()+name.slice(1);
      job=rest('GET',q(k)+'&select=cantidad,comprado').then(function(r){
        var x=r&&r[0],now=new Date().toISOString();
        if(!x)return rest('POST','compra',{clave:k,nombre:name,cantidad:1,comprado:false,creado:now},'return=minimal');
        return rest('PATCH',q(k),x.comprado?{comprado:false,cantidad:1,creado:now}:{cantidad:Math.min(99,(x.cantidad||1)+1)},'return=minimal');});
    }
    else if('qty' in p&&p.key){var n=Math.max(0,Math.min(99,+p.qty||0));
      job=n?rest('PATCH',q(p.key),{cantidad:n},'return=minimal'):rest('DELETE',q(p.key));}
    else if('checked' in p&&p.key)job=rest('PATCH',q(p.key),{comprado:!!p.checked},'return=minimal');
    else if('remove' in p)job=rest('DELETE',q(p.remove));
    else if(p.clear_checked)job=rest('DELETE','compra?comprado=eq.true');
    else if(p.clear_all)job=rest('DELETE','compra?clave=not.is.null');
    else return Promise.reject(fail('Cambio no válido',400));
    return job.then(shopDoc);
  }
  function staplesDoc(){
    return rest('GET','habituales?select=nombre&order=orden.asc,nombre.asc').then(function(rows){
      return {ok:true,items:(rows||[]).map(function(r){return {name:r.nombre,key:norm(r.nombre)};})};});
  }
  function staplesChange(p){
    var job;
    if('add' in p){var n=String(p.add||'').replace(/^\s+|\s+$/g,'').slice(0,40);if(!n)return Promise.reject(fail('Escribe qué guardar',400));
      job=staplesDoc().then(function(d){
        if(d.items.some(function(x){return x.key===norm(n);}))throw fail(n+' ya está en Comprar otra vez',400);
        return rest('POST','habituales',{nombre:n.charAt(0).toUpperCase()+n.slice(1),orden:d.items.length},'return=minimal');});}
    else if('remove' in p)job=rest('DELETE','habituales?nombre=eq.'+encodeURIComponent(p.remove));
    else return Promise.reject(fail('Cambio no válido',400));
    return job.then(staplesDoc);
  }

  /* ---------- fotos: tabla "fotos" + almacenamiento privado "fotos" (enlaces firmados de un día) ---------- */
  var SIGN_S=86400;
  function signAll(paths){
    var memo=get('mc-firmas')||{},need=[],now=nowS();
    for(var k in memo)if(memo[k].e<now+3600)delete memo[k];
    paths.forEach(function(p){if(p&&!memo[p])need.push(p);});
    if(!need.length)return Promise.resolve(memo);
    return sb('POST','/storage/v1/object/sign/fotos',{expiresIn:SIGN_S,paths:need}).then(function(list){
      (list||[]).forEach(function(x){if(x&&x.signedURL&&!x.error)memo[x.path]={u:SB+'/storage/v1'+x.signedURL,e:now+SIGN_S};});
      put('mc-firmas',memo);return memo;});
  }
  function photosDoc(){
    return rest('GET','fotos?select=id,ruta,miniatura,ancho,alto,creada&order=creada.desc&limit=500').then(function(rows){
      rows=rows||[];var paths=[];rows.forEach(function(r){paths.push(r.ruta);if(r.miniatura)paths.push(r.miniatura);});
      return signAll(paths).then(function(m){
        var items=[];rows.forEach(function(r){var u=m[r.ruta];if(!u)return;
          items.push({id:r.id,kind:'photo',url:u.u,thumb:(m[r.miniatura]||u).u,w:r.ancho||0,h:r.alto||0,t:new Date(r.creada).getTime()/1000});});
        return {ok:true,photos:items,media:items,folder:''};
      });
    });
  }

  /* subir una foto desde el móvil: se reduce aquí (1920 px y una miniatura de 480 px) y se guarda en Supabase */
  function shrink(file,max,q){
    return new Promise(function(ok,ko){
      var url=URL.createObjectURL(file),im=new Image();
      im.onload=function(){
        var s=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.round(im.naturalWidth*s),h=Math.round(im.naturalHeight*s);
        var c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);URL.revokeObjectURL(url);
        c.toBlob(function(b){b?ok({blob:b,w:w,h:h}):ko(fail('No se ha podido preparar la foto',400));},'image/jpeg',q);
      };
      im.onerror=function(){URL.revokeObjectURL(url);ko(fail('Ese archivo no es una foto que se pueda abrir',400));};
      im.src=url;
    });
  }
  function putObject(path,blob){
    return token().then(function(t){
      return realFetch(SB+'/storage/v1/object/fotos/'+path,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+t,'Content-Type':'image/jpeg','x-upsert':'false'},body:blob});
    }).then(function(r){if(!r.ok)return r.json().catch(function(){return {};}).then(function(d){throw fail(d.message||d.error||'No se ha podido subir',r.status);});});
  }
  MC.uploadPhoto=function(file){
    var d=new Date(),id=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2);
    var base=d.getFullYear()+'/'+pad(d.getMonth()+1)+'/'+id;
    return Promise.all([shrink(file,1920,.86),shrink(file,480,.8)]).then(function(r){
      return putObject(base+'.jpg',r[0].blob).then(function(){return putObject(base+'-m.jpg',r[1].blob);})
        .then(function(){return rest('POST','fotos',{ruta:base+'.jpg',miniatura:base+'-m.jpg',ancho:r[0].w,alto:r[0].h},'return=minimal');});
    });
  };
  MC.deletePhoto=function(id){
    return rest('GET','fotos?select=ruta,miniatura&id=eq.'+encodeURIComponent(id)).then(function(rows){
      var x=rows&&rows[0];if(!x)return;
      return sb('DELETE','/storage/v1/object/fotos',{prefixes:[x.ruta,x.miniatura].filter(Boolean)})
        .then(function(){return rest('DELETE','fotos?id=eq.'+encodeURIComponent(id));});
    });
  };

  /* ---------- temporizadores: en este marco ---------- */
  var TK='mc-temporizadores';
  function timers(){var t=get(TK);return t&&t.length?t:[];}
  function stateDoc(){return {ok:true,now:Math.round(nowS()*10)/10,timers:timers(),command:null};}
  function timerChange(p){
    var t=timers();
    if(p.action==='start'){var s=parseInt(p.seconds,10);
      if(!(s>=5&&s<=21600))throw fail('El temporizador va de 5 segundos a 6 horas',400);
      if(t.length>=6)throw fail('Ya hay seis temporizadores en marcha',400);
      var x={id:Math.random().toString(16).slice(2,10),label:String(p.label||'Temporizador').slice(0,24),total:s,ends:Math.round((nowS()+s)*10)/10};
      t.push(x);put(TK,t);return {ok:true,timer:x};}
    if(p.action==='cancel'){var n=t.length;t=t.filter(function(x){return x.id!==String(p.id)&&!(p.label&&x.label===p.label);});put(TK,t);return {ok:true,removed:n-t.length};}
    throw fail('Acción desconocida',400);
  }

  /* ---------- el enrutador: /api/... → lo de arriba ---------- */
  function route(path,method,body){
    var p=body||{};
    if(path==='/api/frame')return frameDoc();
    if(path==='/api/luz')return luzDoc();
    if(path==='/api/tasks')return method==='POST'?tasksChange(p):tasksDoc();
    if(path==='/api/meals/shopping')return method==='POST'?shopChange(p):shopDoc();
    if(path==='/api/meals/staples')return method==='POST'?staplesChange(p):staplesDoc();
    if(path==='/api/frame/photos')return photosDoc();
    if(path==='/api/hv/state')return Promise.resolve(stateDoc());
    if(path==='/api/hv/timer')return Promise.resolve().then(function(){return timerChange(p);});
    if(path==='/api/hv/command')return Promise.resolve({ok:true});
    if(path==='/api/hv/wallpapers')return Promise.resolve({ok:true,wallpapers:[]});
    return Promise.reject(fail('No disponible',404));   // música, cámaras, domótica, mareas...: no hay
  }
  function reply(obj,status){return new Response(JSON.stringify(obj),{status:status||200,headers:{'Content-Type':'application/json'}});}
  window.fetch=function(input,init){
    var url=typeof input==='string'?input:(input&&input.url)||'';
    if(url.indexOf('/api/')!==0)return realFetch(input,init);
    init=init||{};var method=(init.method||'GET').toUpperCase(),body=null;
    if(init.body){try{body=JSON.parse(init.body);}catch(e){body={};}}
    return route(url.split('?')[0],method,body).then(function(d){return reply(d);},
      function(e){return reply({ok:false,error:e.message||'Sin conexión'},e.status||503);});
  };
  MC.local=local;
})();
