/* HomeView Photos: gallery of /api/frame/photos (every image in the server's photos folder, config.json
   photos_dir), full-screen viewer (swipe or arrows), Play slideshow = /marco-casa/frame/hv/standby/. Read-only: to add or
   remove photos, change the files in that folder. */
(function(){
  var $=function(id){return document.getElementById(id);};
  var media=[], cur=-1, shown=[], touchX=null, folder='';

  function thumb(p){return p.thumb||p.url;}
  function big(p){var u=p.url;return p.kind!=='video'&&u.indexOf('?')<0?u+'?w=1600':u;}

  function counts(){
    var n=0,v=0,newest=0;
    media.forEach(function(p){if(p.kind==='video')v++;else n++;if(p.t>newest)newest=p.t;});
    return {n:n,v:v,newest:newest};
  }
  function sub(){
    var c=counts(),s=[];
    if(!media.length){$('sub').textContent='Aún no hay fotos';return;}
    s.push(c.n+' foto'+(c.n===1?'':'s')+(c.v?' y '+c.v+' vídeo'+(c.v===1?'':'s'):''));
    if(c.newest){var t=HV.local(new Date(c.newest*1000));s.push('la última del '+t.d+' de '+HV.MONTHS[t.mo-1]);}
    $('sub').textContent=s.join(' · ');
  }
  function addCard(){
    return '<div class="ph-add"><div class="ph-side"><div><h3>Añadir fotos</h3><p>Se suben desde el móvil y aparecen aquí y en el modo reposo en un minuto.</p></div></div></div>';
  }
  function draw(){
    shown=media.slice();
    var h=addCard();
    shown.forEach(function(p,i){
      h+='<button class="ph-t" data-i="'+i+'" aria-label="Abrir foto '+(i+1)+'"><img src="'+HV.esc(thumb(p))+'" alt="" loading="lazy">'+
        (p.kind==='video'?'<span class="ph-badge">Vídeo</span>':'')+'</button>';
    });
    if(!shown.length)h+='<div class="hv-empty ph-empty">Aún no hay fotos.</div>';
    $('grid').innerHTML=h;
    sub();
    $('play').style.opacity=media.length?'1':'.4';
  }
  function load(){
    return HVJson('/api/frame/photos').then(function(d){media=d.media||d.photos||[];folder=d.folder||'';},function(){HV.toast('No se pueden cargar las fotos');}).then(draw);
  }
  $('grid').onclick=function(e){var b=e.target.closest('.ph-t');if(b)open(+b.getAttribute('data-i'));};

  /* viewer */
  function show(i,dir){
    if(!shown.length){close();return;}
    cur=(i+shown.length)%shown.length;
    var p=shown[cur],st=$('vstage');
    st.style.opacity='0';st.style.transform='translateX('+(dir?dir*40:0)+'px)';
    setTimeout(function(){
      st.innerHTML=p.kind==='video'?'<video src="'+HV.esc(p.url)+'" poster="'+HV.esc(p.poster||'')+'" controls playsinline></video>':'<img src="'+HV.esc(big(p))+'" alt="">';
      st.style.transform='translateX('+(dir?-dir*40:0)+'px)';
      setTimeout(function(){st.style.opacity='1';st.style.transform='none';},30);
    },dir?160:0);
    $('vcount').textContent=(cur+1)+' of '+shown.length;
    $('vinfo').innerHTML='';
    $('vstandby').style.display=p.kind==='video'?'none':'';
    /* warm the neighbours */
    [1,-1].forEach(function(d){var q=shown[(cur+d+shown.length)%shown.length];if(q&&q.kind!=='video'){var im=new Image();im.src=big(q);}});
  }
  function open(i){$('view').hidden=false;show(i,0);}
  function close(){var v=$('vstage').querySelector('video');if(v)v.pause();$('view').hidden=true;$('vstage').innerHTML='';}
  $('vclose').onclick=close;
  $('vprev').onclick=function(){show(cur-1,-1);};
  $('vnext').onclick=function(){show(cur+1,1);};
  $('vstage').addEventListener('touchstart',function(e){touchX=e.touches[0].clientX;},{passive:true});
  $('vstage').addEventListener('touchend',function(e){if(touchX==null)return;var dx=e.changedTouches[0].clientX-touchX;touchX=null;
    if(dx>70)show(cur-1,-1);else if(dx<-70)show(cur+1,1);},{passive:true});
  document.addEventListener('keydown',function(e){if($('view').hidden)return;
    if(e.key==='Escape')close();if(e.key==='ArrowRight')show(cur+1,1);if(e.key==='ArrowLeft')show(cur-1,-1);});
  $('vstandby').onclick=function(){location.href='/marco-casa/frame/hv/standby/?photo='+shown[cur].id;};
  HV.chrome({light:true});HV.back('Inicio');
  /* ?open=N opens the viewer on photo N (tests, screenshots) */
  var Q=location.search.match(/open=(\d+)/);
  load().then(function(){if(Q&&shown.length)open(+Q[1]);});setInterval(function(){if($('view').hidden)load();},60000);
})();
