/* Home launcher (/marco-casa/frame/hv/): live widgets, each opens its full screen. Refreshes every 30 s (ETag'd).
   Layout, 4 x 3:
     [ Weather (2 wide)         ] [ Luz (2 wide)       ]
     [ Compra + Tareas (2 wide) ] [ Timer  ] [ Photos  ]   (Photos becomes Music when Sonos or Spotify is set up)
     [ Today/Tomorrow's agenda + the current month, side by side (4 wide) ]
   Standby is the photo chip top right. Timer shows a big timer icon when none is running, else the countdown. ES5. */
(function(){
  var d={frame:null,plan:null,shop:null,music:null,photos:null,ha:null};
  var grid=document.getElementById('grid');
  var MUSIC=!!(HV.cfg.sonos||HV.cfg.spotify);
  var I={
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    cal:'<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    fork:'<path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11M16 3c-1.7 1.2-2.5 3.5-2.5 6.5V13H16v8"/>',
    timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>',
    cart:'<path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7"/><circle cx="9.5" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
    note:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    photo:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 15l3-3 2 2 3-4 3 4"/>',
    air:'<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7"/>',
    house:'<path d="M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    drop:'<path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10z"/>',
    check:'<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M8 12.5l3 3 5-6"/>',
    bolt:'<path d="M13 2.5L4.5 13.5H11L10 21.5L19.5 10H13z"/>',
    sunrise:'<path d="M5 18a7 7 0 0 1 14 0M3 21h18M12 4v4M9.5 6.5L12 4l2.5 2.5M4.6 11.6l1.4 1.4M19.4 11.6L18 13"/>'
  };
  function ic(n){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">'+I[n]+'</svg>';}
  function kind(c){if(c==null)return '';if(c<=1)return 'Despejado';if(c===2)return 'Intervalos nubosos';if(c===3)return 'Nublado';if(c===45||c===48)return 'Niebla';
    if((c>=71&&c<=77)||c===85||c===86)return 'Nieve';if(c>=95)return 'Tormenta';if(c>=51&&c<=57)return 'Llovizna';return 'Lluvia';}
  function key(t){return t.y+'-'+HV.pad(t.mo)+'-'+HV.pad(t.d);}    // a home-time day as 'YYYY-MM-DD'
  function dayKey(iso){return key(HV.local(new Date(iso)));}
  function thumb(u,size){return u?String(u)+'/'+(size||'medium'):'';}   // TheMealDB serves /small, /medium, /large
  function hm24(iso){return (+iso.slice(11,13))+':'+iso.slice(14,16);}
  function hr(iso){return (+iso.slice(11,13))+':00';}
  // a tile; href makes the whole tile a link, otherwise a div whose taps follow data-href (week strip, timer)
  function w(cls,href,label,icon,body,style){
    var a=' class="w '+cls+'"'+(style?' style="'+style+'"':'');
    return (href?'<a'+a+' href="'+href+'">':'<div'+a+' data-href="'+(cls.indexOf('timer')>=0?'/marco-casa/frame/hv/timer/':'/marco-casa/frame/hv/calendar/')+'">')+
      '<div class="lbl">'+ic(icon)+label+'</div>'+body+(href?'</a>':'</div>');
  }

  function weatherTile(wx){
    if(!wx||wx.temp_f==null)return w('wx s2','/marco-casa/frame/hv/weather/','Tiempo','sun','<div class="line">'+(d.frame?'No se ha podido cargar el tiempo':'Cargando el tiempo')+'</div>');
    var wc=!wx.is_day?' night':(wx.code>=3?' cloud':''),t=HV.local(),nk=key(t)+'T'+HV.pad(t.h);
    var hrs=(wx.hours24||wx.hourly||[]).filter(function(x){return x.t.slice(0,13)>nk;}).slice(0,6);
    // rain timing is the Rain chip's job (top right, from the minute-by-minute nowcast)
    var say=kind(wx.code),hl='Máx '+Math.round(Math.max(wx.hi_f,wx.temp_f))+'° Mín '+Math.round(Math.min(wx.lo_f,wx.temp_f))+'°';
    var strip='';hrs.forEach(function(x){strip+='<div>'+hr(x.t)+'<b>'+Math.round(x.temp_f)+'°</b></div>';});
    return w('wx s2'+wc,'/marco-casa/frame/hv/weather/','Tiempo','sun','<div><div class="tl"><div class="big">'+Math.round(wx.temp_f)+'°</div><div class="hl">'+hl+'</div></div><div class="say">'+say+'</div></div>'+(strip?'<div class="hrs">'+strip+'</div>':''));
  }

  // Home Assistant: the indoor temperature and humidity from its sensors; otherwise Outside: air quality and sunrise or sunset
  function homeTile(wx){
    if(HV.cfg.ha){
      var hi=(d.ha&&d.ha.items)||[],tmp=null,hum=null;
      hi.forEach(function(x){if(x.kind!=='sensor')return;
        if(!tmp&&(x.dc==='temperature'||/temp/i.test(x.id)))tmp=x;
        if(!hum&&(x.dc==='humidity'||/humid/i.test(x.id)))hum=x;});
      var num=function(x){var n=x?parseFloat(x.state):NaN;return isNaN(n)?null:n;};
      var tv=num(tmp),hv=num(hum);
      // a soft tint by indoor temperature (in °F; a °C sensor is converted): cold, cool, comfy, warm, hot
      var tf=tv==null?null:(/C/.test(tmp.state)?tv*9/5+32:tv);
      var band=tf==null?'':tf<66?'t-cold':tf<71?'t-cool':tf<76?'t-comfy':tf<80?'t-warm':'t-hot';
      return w('temp '+band,'/marco-casa/frame/hv/ha/',HV.esc(HV.cfg.ha_title||'Smart Home'),'house',!d.ha?'<div class="line">Loading</div>':
        (tv==null&&hv==null)?'<div class="line muted">'+HV.esc(d.ha.error||'No temperature or humidity sensor in the list')+'</div>':
        '<div><div class="big">'+(tv!=null?(Math.round(tv*10)/10)+'°':Math.round(hv)+'%')+'</div><div class="line muted">'+
          (tv!=null&&hv!=null?Math.round(hv)+'% humidity':tv!=null?HV.esc(tmp.name):'Humidity')+(tmp&&hv!=null?' · '+HV.esc(tmp.name):'')+'</div></div>');
    }
    var aq=d.frame&&d.frame.aqi,sun='';
    if(wx&&wx.sunset){var t2=HV.local(),ns=t2.y+'-'+HV.pad(t2.mo)+'-'+HV.pad(t2.d)+'T'+HV.pad(t2.h)+':'+HV.pad(t2.mi);
      sun=ns<wx.sunrise.slice(0,16)?'Amanece '+hm24(wx.sunrise):ns<wx.sunset.slice(0,16)?'Anochece '+hm24(wx.sunset):wx.next_sunrise?'Amanece '+hm24(wx.next_sunrise):'';}
    return w('','/marco-casa/frame/hv/weather/','Fuera','air','<div>'+(aq&&aq.us_aqi!=null?'<div class="big">'+aq.us_aqi+'</div><div class="line muted">Calidad del aire '+HV.esc(aq.band||"")+(sun?' · '+sun:'')+'</div>':
      '<div class="line">'+(sun||'Cargando el tiempo')+'</div>')+'</div>');
  }

  function timerBody(){
    var ts=(HV.state.timers||[]).slice().sort(function(a,b){return a.ends-b.ends;}),now=HV.now().getTime()/1000,dim='style="color:rgba(235,235,245,.6)"';
    if(ts.length){var t=ts[0],left=t.ends-now,f=t.total?Math.max(0,Math.min(1,1-left/t.total)):0;
      return '<div><div class="big">'+(left<=0?'Listo':HV.mmss(left))+'</div><div class="line" '+dim+'>'+HV.esc(t.label)+(ts.length>1?' · +'+(ts.length-1)+' más':'')+'</div></div>'+
        '<div class="bar"><i style="-webkit-transform:scaleX('+f.toFixed(3)+');transform:scaleX('+f.toFixed(3)+')"></i></div>';}
    return '<div class="tico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+I.timer+'</svg></div>';   // idle: just a big timer icon
  }

  // Compra + Tareas en una sola tarjeta (2 columnas): la compra es lo que de verdad van a usar, así que
  // lleva el peso; las tareas se quedan como una etiqueta aparte, con su propio enlace a su pestaña.
  function listsTile(){
    var S=d.shop,T=d.tasks,left=S?S.left:null,tleft=T?T.left:null,body;
    if(S&&left){var open=S.items.filter(function(x){return !x.checked;}),rows='';
      open.slice(0,3).forEach(function(x,i){rows+='<div>'+HV.esc(x.name)+(i===2&&left>3?' <span>+'+(left-3)+' más</span>':'')+'</div>';});
      body='<div class="cnt"><div class="big">'+left+'</div><div class="sub">por comprar</div></div><div class="items">'+rows+'</div>';}
    else body='<div><div class="big">'+(S?left:'—')+'</div><div class="line">'+(!S?'Cargando la lista':S.items.length?'Todo comprado':'Lista vacía')+'</div></div>';
    var chip=tleft?'<span class="tasks-chip" data-href="/marco-casa/frame/hv/tareas/?t=tareas">'+ic('check')+tleft+' tarea'+(tleft===1?'':'s')+'</span>':'';
    return '<div class="w s2'+(left?' on':'')+'" data-href="/marco-casa/frame/hv/tareas/?t=compra"><div class="lbl">'+ic('cart')+'Compra'+chip+'</div>'+body+'</div>';
  }

  // Luz: el precio de ahora (barata, normal o cara respecto al día) y las dos horas seguidas más baratas que quedan
  function eur(p){return (Math.round(p*100)/100).toFixed(2).replace('.',',')+' €';}
  function hh(t){return (+t.slice(11,13))+':00';}
  function luzTile(){
    var L=d.luz,n=L&&L.now,b=L&&L.best2,word={barata:'Barata ahora',normal:'Precio normal',cara:'Cara ahora'};
    if(!n)return w('luz s2','/marco-casa/frame/hv/luz/','Luz','bolt','<div class="line">'+(L?'Sin precios todavía':'Cargando')+'</div>');
    var fin=b?(+b.to.slice(11,13)+1)%24+':00':'';
    return w('luz s2 l-'+n.band,'/marco-casa/frame/hv/luz/','Luz','bolt',
      '<div><div class="big">'+eur(n.p).replace(' €','<small> €/kWh</small>')+'</div><div class="lz-b">'+word[n.band]+'</div></div>'+
      (b?'<div class="line muted">Lo más barato: '+hh(b.from)+'–'+fin+(b.from.slice(0,10)!==L.today[0].t.slice(0,10)?' (mañana)':'')+'</div>':''));
  }

  // Hoy + Mes en un solo widget, a la Adri: a la izquierda la agenda de hoy (o de mañana, una vez
  // terminada la de hoy, con su tiempo en palabras); a la derecha el mes completo con un punto de color
  // por calendario en los días con planes. Cualquier toque abre la agenda de hoy en el Calendario completo.
  function agendaMonthTile(){
    var t=HV.local(),tk=key(t),now=HV.now().getTime(),left;
    if(!(HV.cfg.calendars||[]).length){
      left='<div class="am-daynum">'+t.d+'</div><div class="am-dayname">'+HV.DAYS[t.dow]+'</div><div class="am-events"><div class="am-none">Aún no hay calendario</div></div>';
    }else{
      var up=((d.frame&&d.frame.calendar_events)||[]).filter(function(e){return new Date(e.end||e.start).getTime()>now&&new Date(e.start).getTime()<now+14*864e5;})
        .sort(function(a,b){return new Date(a.start)-new Date(b.start);});
      function isToday(e){var s=dayKey(e.start);if(!e.all_day)return s===tk;var en=e.end?dayKey(e.end):s;return s<=tk&&(tk<en||s===tk);}
      var tod=up.filter(isToday);
      if(tod.length){
        var rows='';
        tod.slice(0,3).forEach(function(e){
          var s=new Date(e.start).getTime(),m=Math.round((s-now)/60000),tt=e.all_day?'Todo el día':HV.hm(new Date(s));
          var em='<em'+(!e.all_day&&m<=60?' class="soon"':'')+'>'+(!e.all_day&&s<=now?'Ahora':tt)+'</em>';
          rows+='<div class="ev"><i style="background:'+HV.calColor(e.cal)+'"></i><div><span>'+HV.esc(e.title)+'</span>'+em+'</div></div>';
        });
        var more=tod.length-3;
        left='<div class="am-daynum">'+t.d+'</div><div class="am-dayname">'+HV.DAYS[t.dow]+(more>0?'<span class="more">+'+more+'</span>':'')+'</div><div class="am-events">'+rows+'</div>';
      }else{
        var tm=HV.local(new Date(now+864e5)),tmk=key(tm),evs=[];
        ((d.frame&&d.frame.calendar_events)||[]).forEach(function(e){var s=dayKey(e.start),en=e.end?dayKey(e.end):s;
          if(e.all_day?(s<=tmk&&(tmk<en||s===tmk)):s===tmk)evs.push(e);});
        evs.sort(function(a,b){return a.all_day!==b.all_day?(a.all_day?-1:1):new Date(a.start)-new Date(b.start);});
        var rows2='';evs.slice(0,3).forEach(function(e){
          rows2+='<div class="ev"><i style="background:'+HV.calColor(e.cal)+'"></i><div><span>'+HV.esc(e.title)+'</span>'+(e.all_day?'':'<em>'+HV.hm(new Date(e.start))+'</em>')+'</div></div>';
        });
        if(!rows2)rows2='<div class="am-none">Nada previsto</div>';
        var more2=evs.length-3;
        left='<div class="am-daynum">'+tm.d+'</div><div class="am-dayname">Mañana'+(more2>0?'<span class="more">+'+more2+'</span>':'')+'</div><div class="am-events">'+rows2+'</div>';
      }
    }
    // el mes: igual que antes, sin la cinta de color (aquí el propio widget ya lleva su etiqueta)
    var y=t.y,mo=t.mo;
    function dnum(yy,mm,dd){return Math.round(Date.UTC(yy,mm-1,dd)/864e5);}
    function fromNum(n){var dt=new Date(n*864e5);return {mo:dt.getUTCMonth()+1,d:dt.getUTCDate(),dow:dt.getUTCDay()};}
    var first=dnum(y,mo,1),f=fromNum(first),off=(f.dow+6)%7,start=first-off;   // semanas de lunes a domingo
    var dim=new Date(Date.UTC(y,mo,0)).getUTCDate(),rows3=Math.ceil((off+dim)/7),today=dnum(y,mo,t.d);
    var evs3=(d.frame&&d.frame.calendar_events)||[],sp=[];
    evs3.forEach(function(e){var s=HV.local(new Date(e.start)),a=dnum(s.y,s.mo,s.d),b;
      if(e.all_day&&e.end){var en=HV.local(new Date(e.end));b=dnum(en.y,en.mo,en.d)-1;}
      else if(e.end){var en2=HV.local(new Date(new Date(e.end).getTime()-1000));b=dnum(en2.y,en2.mo,en2.d);}
      else b=a;
      if(b<a)b=a;sp.push({cal:e.cal,a:a,b:b});});
    var gh='',i,j;
    for(i=0;i<rows3*7;i++){
      var n=start+i,o=fromNum(n),dots='',c=0,seen={};
      for(j=0;j<sp.length&&c<3;j++){var e2=sp[j];if(e2.a<=n&&e2.b>=n&&!seen[e2.cal]){seen[e2.cal]=1;dots+='<i style="background:'+HV.calColor(e2.cal)+'"></i>';c++;}}
      gh+='<div class="mo-c'+(o.mo!==mo?' out':'')+(n===today?' today':'')+(o.dow===0||o.dow===6?' wk':'')+'"><b>'+o.d+'</b><span class="mo-dots">'+dots+'</span></div>';
    }
    var MON=HV.MONTHS[mo-1];MON=MON.charAt(0).toUpperCase()+MON.slice(1);
    return '<div class="w agenda-month s4" data-href="/marco-casa/frame/hv/calendar/?open=0">'+
      '<div class="am-l">'+left+'</div>'+
      '<div class="am-r"><div class="am-mlabel">'+MON+'</div>'+
      '<div class="mo-wl"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>'+
      '<div class="mo-g" style="grid-template-rows:repeat('+rows3+',minmax(0,1fr))">'+gh+'</div></div></div>';
  }

  function render(){
    var t=HV.local(),h=t.h,wx=d.frame&&d.frame.weather,P=d.plan,din=P&&P.tonight;
    HV.rainChip(wx&&wx.nowcast);                    // rain soon, left of the camera button
    document.getElementById('hello').textContent=h<6?'Buenas noches':h<14?'Buenos días':h<21?'Buenas tardes':'Buenas noches';
    drawDate();
    var html=weatherTile(wx)+luzTile();
    html+=listsTile();
    html+=w('timer',null,'Temporizador','timer','<div class="tb">'+timerBody()+'</div>');
    if(MUSIC){
      var rooms=(d.music&&d.music.rooms)||[],pl=null;rooms.forEach(function(r){if(!pl&&r.ok&&r.state==='PLAYING'&&r.title)pl=r;});
      html+=w('music','/marco-casa/frame/hv/music/','Music','note',pl?'<div><div class="line" style="font-size:3.2vh">'+HV.esc(pl.title)+'</div><div class="line" style="color:rgba(255,255,255,.7)">'+HV.esc(pl.artist||pl.name)+'</div></div>':
        '<div><div class="line">Nothing playing</div><div class="line" style="color:rgba(255,255,255,.7)">'+(HV.cfg.sonos?rooms.length+' speaker'+(rooms.length===1?'':'s'):'Spotify')+'</div></div>');
    }else{
      var ps=(d.photos&&d.photos.photos)||[],p0=ps.length?ps[Math.floor((HV.now().getTime()/60000)%ps.length)]:null;
      var p0u=p0?p0.url+(p0.url.indexOf('?')<0?'?':'&')+'w=480':'';
      html+=w('photos','/marco-casa/frame/hv/photos/','Fotos','photo','<div class="line">'+(d.photos?ps.length+' foto'+(ps.length===1?'':'s'):'Cargando fotos')+'</div>',p0?'background-image:url(\''+p0u+'\')':'');
    }
    html+=agendaMonthTile();
    grid.innerHTML=html;
  }
  // taps on div tiles (timer, month grid, the Compra+Tareas card) follow the nearest data-href
  grid.onclick=function(e){
    var el=e.target;while(el&&el!==grid&&!el.getAttribute('data-href'))el=el.parentNode;
    if(el&&el!==grid)location.href=el.getAttribute('data-href');
  };
  // the running timer counts down every second without redrawing the grid
  setInterval(function(){if(!(HV.state.timers||[]).length)return;var tb=grid.querySelector('.w.timer .tb');if(tb)tb.innerHTML=timerBody();},1000);
  function load(){
    var jobs=[
      HVJson('/api/frame').then(function(x){d.frame=x;},function(){}),
      HVJson('/api/tasks').then(function(x){d.tasks=x;},function(){}),
      HVJson('/api/luz').then(function(x){d.luz=x;},function(){}),
      HVJson('/api/meals/shopping').then(function(x){d.shop=x;},function(){}),
      HVJson('/api/frame/photos').then(function(x){d.photos=x;},function(){})
    ];
    if(HV.cfg.ha)jobs.push(HVJson('/api/ha/state').then(function(x){d.ha=x;},function(){}));
    if(HV.cfg.sonos)jobs.push(HVJson('/api/frame/music').then(function(x){d.music=x;},function(){}));
    return Promise.all(jobs).then(render).then(drawSleep).then(drawCool);
  }
  HV.chrome({light:true,standby:false});   // no Standby button here (Yani); the frame still goes to Standby on its own
  (function(){var cam=document.querySelector('.hv-chrome .hv-cam');if(cam)cam.insertAdjacentHTML('beforeend','<span>Camera</span>');})();
  // heads-up chips (alert, cooler outside, rain) wrap onto a second row under the icon buttons, clear of the greeting
  (function(){var c=document.querySelector('.hv-chrome');if(!c)return;c.className+=' two';var br=document.createElement('i');br.className='hv-brk';c.appendChild(br);})();
  // Kids button (cat paw), left of Settings: opens the Kitty faces even when they are not in the schedule.
  // Before 3:00 PM (frame time) Kitty today, from 3:00 PM Kitty tomorrow.
  if(0)(function(){var c=document.querySelector('.hv-chrome');if(!c)return;var b=document.createElement('button');b.className='hv-chip hv-paw';b.setAttribute('aria-label','Kids');
    b.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="5.6" cy="10.4" rx="2" ry="2.6" transform="rotate(-20 5.6 10.4)"/><ellipse cx="9.6" cy="6" rx="2.1" ry="2.7" transform="rotate(-8 9.6 6)"/><ellipse cx="14.4" cy="6" rx="2.1" ry="2.7" transform="rotate(8 14.4 6)"/><ellipse cx="18.4" cy="10.4" rx="2" ry="2.6" transform="rotate(20 18.4 10.4)"/><path d="M12 11.6c-2.9 0-5.8 3.3-5.8 5.9 0 1.7 1.3 2.4 2.7 2.4 1.3 0 2-.6 3.1-.6s1.8.6 3.1.6c1.4 0 2.7-.7 2.7-2.4 0-2.6-2.9-5.9-5.8-5.9z"/></svg>';
    b.onclick=function(){location.href=HV.SCREENS.standby+'?face='+(HV.local().h>=15?'kitty':'kittyam')+'&return=60';};c.appendChild(b);})();
  // Settings chip: a cog, far right of the top-right chips
  (function(){var c=document.querySelector('.hv-chrome');if(!c)return;var a=document.createElement('a');a.className='hv-chip light';a.href='/marco-casa/frame/hv/settings/';a.setAttribute('aria-label','Ajustes');
    a.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';c.appendChild(a);})();
  /* Sleep mode chip (top right, left of the camera), only 9:30 PM - 3:00 AM home time. Toggles a Home Assistant
     input_boolean that puts the house to sleep. The entity must also be in home_assistant.entities in config.json
     (the server only acts on listed entities). Turning it on asks for a second tap. */
  var SLEEP='input_boolean.sleepmode',sleepChip=null,sleepArm=0;
  function sleepItem(){var r=null;((d.ha&&d.ha.items)||[]).forEach(function(x){if(x.id===SLEEP)r=x;});return r;}
  function sleepWindow(){var t=HV.local();return (t.h===21&&t.mi>=30)||t.h>=22||t.h<3;}
  function drawSleep(){
    if(!HV.cfg.ha)return;
    var c=document.querySelector('.hv-chrome');if(!c)return;
    if(!sleepChip){sleepChip=document.createElement('button');sleepChip.className='hv-chip light hv-sleep';sleepChip.setAttribute('aria-label','Sleep mode');
      var al=c.querySelector('.hv-alert');c.insertBefore(sleepChip,al?al.nextSibling:c.firstChild);
      sleepChip.onclick=function(){
        var it=sleepItem();if(!it)return;
        if(!it.on&&Date.now()-sleepArm>4000){sleepArm=Date.now();HV.toast('Tap again to put the house in Sleep mode');return;}
        sleepArm=0;var want=!it.on;it.on=want;drawSleep();
        HV.post('/api/ha/action',{entity:SLEEP,action:want?'on':'off'}).then(function(){HV.toast(want?'Sleep mode on. Good night':'Sleep mode off');
          setTimeout(function(){HVJson('/api/ha/state').then(function(x){d.ha=x;drawSleep();},function(){});},800);},
          function(e){it.on=!want;drawSleep();HV.toast(e.message);});
      };}
    var it=sleepItem();
    sleepChip.style.display=it&&it.avail!==false&&sleepWindow()?'':'none';
    sleepChip.classList.toggle('on',!!(it&&it.on));
    sleepChip.innerHTML='<svg viewBox="0 0 24 24" fill="'+(it&&it.on?'currentColor':'none')+'" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><span>Sleep Mode</span>';
  }
  setInterval(drawSleep,30000);

  /* "Cooler outside" chip (left of the camera): only while it is 3°+ cooler outside than the Home Assistant indoor
     temperature, not raining or about to, and 60°+ out. Same rule as the Weather screen. Tap: Weather. */
  var coolChip=null;
  function coolNow(){
    var w=d.frame&&d.frame.weather,xs=(d.ha&&d.ha.items)||[],it=null,i;
    if(!w||w.temp_f==null)return null;
    for(i=0;i<xs.length;i++)if(xs[i].kind==='sensor'&&(xs[i].dc==='temperature'||/temp/i.test(xs[i].id))){it=xs[i];break;}
    if(!it)return null;var inF=parseFloat(it.state);if(isNaN(inF))return null;if(/C/.test(it.state))inF=inF*9/5+32;
    var n=w.nowcast,wet=(n&&(n.state==='rain'||n.state==='stop'||(n.state==='start'&&n.mins<=120)))||w.code>=51;
    return !wet&&w.temp_f<=inF-3&&w.temp_f>=60?{out:w.temp_f,inF:inF}:null;
  }
  function drawCool(){
    if(!HV.cfg.ha)return;
    var c=document.querySelector('.hv-chrome');if(!c)return;
    if(!coolChip){coolChip=document.createElement('a');coolChip.className='hv-chip hv-cool';coolChip.href='/marco-casa/frame/hv/weather/';
      var after=c.querySelector('.hv-sleep')||c.querySelector('.hv-alert');c.insertBefore(coolChip,after?after.nextSibling:c.firstChild);}
    var x=coolNow();
    coolChip.style.display=x?'':'none';
    if(x)coolChip.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/></svg>'+
      'Cooler outside \u00b7 '+Math.round(x.out)+'\u00b0';
  }
  HV.on(function(){if(d.frame)render();});
  // date line with the time, e.g. "Friday, October 16, 8:17 PM"; ticks on its own like the clock chip
  function drawDate(){var t=HV.local();document.getElementById('date').textContent=HV.DAYS[t.dow]+', '+t.d+' de '+HV.MONTHS[t.mo-1]+' · '+HV.hm();}
  setInterval(drawDate,5000);
  render();load();setInterval(load,30000);
})();
