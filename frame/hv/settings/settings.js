/* HomeView Settings: Apple-Settings style grouped list for this frame. Idle choices are stored per frame
   in localStorage "hv-idle" (mode off|photos, minutes 1|3|5|10, slide 15|30|60, face 15|30|60|120, shade 0|30|60,
   tall blur|pair|both):
   hv.js reads mode and minutes for the idle jump, Standby reads slide (seconds per photo), face (seconds per
   other face), shade (% black over Standby) and tall (how portrait photos show on a wide frame).
   An older saved mode 'dim' counts as 'photos'.
   Everything else that is per house lives in config.json on the server. */
(function(){
  var KEY='hv-idle';
  var settings={mode:'photos',minutes:3,slide:30,face:30,shade:0,tall:'both'};
  function pick(list,v,d){v=+v;for(var i=0;i<list.length;i++)if(list[i]===v)return v;return d;}
  function valid(s){s=s||{};return {mode:s.mode==='off'?'off':'photos',minutes:pick([1,3,5,10],s.minutes,3),slide:pick([15,30,60],s.slide,30),face:pick([15,30,60,120],s.face,30),shade:pick([0,30,60],s.shade,0),
    tall:['blur','pair','both'].indexOf(s.tall)>=0?s.tall:'both'};}
  try{settings=valid(JSON.parse(localStorage.getItem(KEY)||'null'));}catch(e){}
  var photoCount=null, avail={};

  function chev(){return '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';}
  function seg(id,opts,cur){
    var h='<div class="st-seg" data-id="'+id+'">';
    opts.forEach(function(o){h+='<button data-v="'+o[0]+'"'+(String(o[0])===String(cur)?' class="on"':'')+'>'+o[1]+'</button>';});
    return h+'</div>';
  }
  function row(label,sub,right,cls){return '<div class="st-row'+(cls?' '+cls:'')+'"><div class="l">'+label+(sub?'<small>'+sub+'</small>':'')+'</div>'+right+'</div>';}
  function grp(title,rows){return '<div class="st-grp"><h4>'+title+'</h4><div class="st-card">'+rows+'</div></div>';}

  function frameInfo(){
    var w=innerWidth,h=innerHeight,big=w>1500;
    return {size:big?'15"':'10"',res:w+' × '+h};
  }
  function ua(){
    var m=navigator.userAgent.match(/(Chrome|Firefox|Version)\/([\d.]+)/),a=/Android/.test(navigator.userAgent);
    return (a?'Android ':'')+(m?(m[1]==='Version'?'WebView ':m[1]+' ')+m[2].split('.')[0]:'Navegador');
  }

  function left(){
    var idleOn=settings.mode!=='off';
    /* Photo interval, Face interval and Appearance stay live with Stay on: the Standby button still opens Standby */
    var h=grp('Cuando nadie lo toca',
      row('Pasar a','',seg('mode',[['photos','Reposo'],['off','Seguir igual']],settings.mode))+
      row('Después de','',seg('minutes',[[1,'1 min'],[3,'3 min'],[5,'5 min'],[10,'10 min']],settings.minutes),idleOn?'':'off')+
      row('Cada foto','Tiempo de cada foto en reposo',seg('slide',[[15,'15 s'],[30,'30 s'],[60,'1 min']],settings.slide))+
      row('Fotos en vertical',{blur:'Enteras, con los lados difuminados',pair:'Dos juntas',both:'Por parejas; si sobra una, entera'}[settings.tall],
        seg('tall',[['blur','Entera'],['pair','Dos juntas'],['both','Las dos cosas']],settings.tall))+
      row('Cada pantalla','Tiempo del resto de pantallas en reposo',seg('face',[[15,'15 s'],[30,'30 s'],[60,'1 min'],[120,'2 min']],settings.face))+
      row('Brillo','Del modo reposo',seg('shade',[[0,'Normal'],[30,'Suave'],[60,'Tenue']],settings.shade)));
    return h;
  }
  /* every HomeView screen, named as its own title reads ('' is the Home launcher). Music only when Sonos or Spotify is set up, Camera only when a camera is. */
  var SCREENS=[
    ['Inicio',''],['Calendario','calendar'],['Tiempo','weather'],['Tareas','tasks'],
    ['Compra','shopping'],['Temporizador','timer'],['Fotos','photos'],['Reposo','standby'],['Noche','night'],
    ['Fondo','background'],['Pantallas de reposo','faces']
  ].filter(function(x){return (x[1]!=='music'||HV.cfg.sonos||HV.cfg.spotify)&&(x[1]!=='camera'||HV.cfg.camera)&&(x[1]!=='ha'||HV.cfg.ha);});
  /* Weather screen style, per frame (localStorage 'hv-wx'): 'apple' (sky gradient, glass cards) or 'modern' (light card, 24 h chart) */
  function wxStyle(){var v='apple';try{v=localStorage.getItem('hv-wx')||'apple';}catch(e){}return v==='modern'?'modern':'apple';}
  /* "Weekdays · Evening now · 3 faces", from the Standby schedule (faces/sched.js) */
  function schedNow(){if(!window.HVSched)return 'Por día y hora';
    var t=HV.local(),a=HVSched.at(HVSched.load(HV.facesOn()),t.dow,t.h*60+t.mi),n=a.block.faces.length;
    return HV.esc(HVSched.daysLabel(a.group.days))+' \u00b7 '+'ahora: '+HVSched.blockName(a.block)+' \u00b7 '+n+' pantalla'+(n===1?'':'s');}
  function right(){
    var h='';
    var w=HV.wall(),wl=w.t==='color'?'Color':w.t==='image'?String(w.id).replace(/\.[a-z]+$/i,'').replace(/[-_]/g,' '):'Automático';
    h+=grp('Aspecto',
      '<a class="st-row st-nav" href="/marco-casa/frame/hv/background/"><div class="l">Fondo<small>'+(HV.look==='glass'?'Cristal':'Claro')+' · '+HV.esc(wl)+'</small></div>'+chev()+'</a>'+
      row('Pantalla del tiempo',wxStyle()==='modern'?'Gráfica de 24 h y 7 días':'Colores del cielo, horas y recuadros',seg('wx',[['apple','Clásica'],['modern','Moderna']],wxStyle()))+
      '<a class="st-row st-nav" href="/marco-casa/frame/hv/faces/"><div class="l">Pantallas de reposo<small>'+schedNow()+'</small></div>'+chev()+'</a>');
    return h+rightBody();
  }
  function rightBody(){
    var f=frameInfo(),c=HV.cfg,h='';
    h+=grp('Este marco',
      row('Pantalla',HV.esc(ua()),'<span class="v">'+f.size+' \u00b7 '+f.res+'</span>')+
      row('Casa',HV.esc(c.place||c.home_name||'Casa'),'<span class="v">'+HV.esc(c.timezone||'')+'</span>')+
      row('Fotos','<span id="vph">'+(photoCount==null?'...':photoCount+' fotos')+'</span>',''));
      if(0)h+=(
      row('Music',c.sonos||c.spotify?[c.sonos?'Sonos':'',c.spotify?'Spotify':''].filter(Boolean).join(' and '):'Not set up in config.json','<span class="v">'+(c.sonos||c.spotify?'On':'Off')+'</span>'));
    h+='<p class="st-note">El reposo empieza cuando nadie toca la pantalla. Suave y Tenue oscurecen el reposo, pero no cambian el brillo de la pantalla. El reloj de noche sale solo en las horas que tenga programadas (Pantallas de reposo).</p>';
    return h;
  }
  function links(){
    var s='';
    SCREENS.forEach(function(x){
      var up=avail[x[1]];
      s+='<a class="st-link'+(up===false?' off':'')+'" href="/marco-casa/frame/hv/'+(x[1]?x[1]+'/':'')+'">'+x[0]+'</a>';
    });
    return '<h4>Abrir una pantalla</h4><div class="st-links">'+s+'</div>';
  }
  function draw(){
    var sx=document.getElementById('colL').scrollTop,rx=document.getElementById('colR').scrollTop;
    document.getElementById('colL').innerHTML=left();document.getElementById('colR').innerHTML=right();document.getElementById('links').innerHTML=links();
    document.getElementById('colL').scrollTop=sx;document.getElementById('colR').scrollTop=rx;
    var p=document.getElementById('pvn');if(p)p.textContent=photoCount==null?'':photoCount+' photos';
    tickClock();
  }
  function tickClock(){var e=document.getElementById('vclock');if(e)e.textContent=HV.hm()+' '+HV.ampm();}
  function save(note){
    try{localStorage.setItem(KEY,JSON.stringify(settings));HV.toast(note||'Saved for this screen');}
    catch(e){HV.toast('Aplicado por ahora, pero no se ha podido guardar.');}
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('.st-seg button');
    if(b){
      var id=b.parentNode.getAttribute('data-id'),v=b.getAttribute('data-v');
      if(id==='wx'){try{localStorage.setItem('hv-wx',v);}catch(x){}HV.toast('Weather: '+(v==='modern'?'Modern':'Apple')+' style');draw();return;}
      var o={};o[id]=id==='mode'||id==='tall'?v:+v;settings=valid(Object.assign?Object.assign({},settings,o):merge(settings,o));
      save();draw();return;
    }
    if(e.target.closest('#preview')){location.href='/marco-casa/frame/hv/standby/';return;}
  });
  function merge(a,b){var o={},k;for(k in a)o[k]=a[k];for(k in b)o[k]=b[k];return o;}

  HV.chrome({light:true});HV.back('Inicio');
  draw();
  HVJson('/api/frame/photos').then(function(d){photoCount=(d.media||d.photos||[]).length;},function(){}).then(draw);
  /* which screens exist yet */
  SCREENS.forEach(function(x){
    fetch('/marco-casa/frame/hv/'+(x[1]?x[1]+'/':''),{method:'HEAD',cache:'no-store'}).then(function(r){avail[x[1]]=r.ok;draw();},function(){});
  });
  setInterval(tickClock,5000);
})();
