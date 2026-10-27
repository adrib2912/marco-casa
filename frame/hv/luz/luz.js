/* Precio de la luz (PVPC): barras por horas de hoy o mañana, el precio de ahora y las horas más baratas
   para poner la lavadora o el lavavajillas. ES5. Lee GET /api/luz (frame/shared/datos.js). */
(function(){
  var root=document.getElementById('root'),esc=HV.esc,L=null,day='hoy';
  var WORD={barata:'Barata',normal:'Normal',cara:'Cara'};
  function eur(p){return (Math.round(p*1000)/1000).toFixed(3).replace('.',',');}
  function h(t){return +t.slice(11,13);}
  function span(b){return b?h(b.from)+':00 – '+((h(b.to)+1)%24)+':00':'';}
  function dayOf(b){return b&&L.today.length&&b.from.slice(0,10)!==L.today[0].t.slice(0,10)?' (mañana)':'';}
  function chart(list){
    if(!list.length)return '<div class="hv-empty lz-none">'+(day==='hoy'?'Aún no hay precios de hoy':'Los precios de mañana salen hacia las 20:15')+'</div>';
    var mx=0,i,s='',nowK=HV.local(),hk=nowK.y+'-'+HV.pad(nowK.mo)+'-'+HV.pad(nowK.d)+'T'+HV.pad(nowK.h)+':00';
    list.forEach(function(x){if(x.p>mx)mx=x.p;});
    for(i=0;i<list.length;i++){var x=list[i],pct=Math.max(4,x.p/mx*100),now=x.t===hk,past=x.t<hk;
      s+='<div class="lz-c'+(now?' now':'')+(past?' past':'')+'"><em>'+(now||i%3===0?eur(x.p):'')+'</em>'+
        '<i class="b-'+x.band+'" style="height:'+pct.toFixed(1)+'%"></i><small>'+(i%3===0||now?h(x.t):'')+'</small></div>';}
    return '<div class="lz-chart">'+s+'</div>';
  }
  function draw(){
    var head='<header class="sh"><h1 class="hv-title">Precio de la luz</h1><div class="hv-sub">PVPC en €/kWh'+
      (L&&L.updated?' · actualizado a las '+HV.hm(new Date(L.updated)):'')+'</div></header>';
    if(!L){root.innerHTML=head+'<div class="hv-empty">Cargando</div>';return;}
    var todayK=L.today.length?L.today[0].t.slice(0,10):'',list=L.hours.filter(function(x){return day==='hoy'?x.t.slice(0,10)===todayK:x.t.slice(0,10)>todayK;});
    var tabs='<div class="lz-tabs"><button data-d="hoy"'+(day==='hoy'?' class="on"':'')+'>Hoy</button><button data-d="manana"'+(day==='manana'?' class="on"':'')+(L.tomorrow?'':' disabled')+'>Mañana</button></div>';
    var n=L.now,rail='';
    if(n)rail+='<section class="hv-card lz-now n-'+n.band+'"><h3>Ahora</h3><div class="v">'+eur(n.p)+'<small> €/kWh</small></div><span class="tag">'+WORD[n.band]+'</span></section>';
    rail+='<section class="hv-card lz-tip"><h3>Lo más barato que queda</h3>'+
      (L.best2?'<div class="r"><b>Lavavajillas · 2 h</b><span>'+span(L.best2)+dayOf(L.best2)+'</span></div>':'')+
      (L.best3?'<div class="r"><b>Lavadora · 3 h</b><span>'+span(L.best3)+dayOf(L.best3)+'</span></div>':'')+
      (!L.best2?'<div class="hv-empty">Sin datos</div>':'')+'</section>';
    if(L.min!=null)rail+='<section class="hv-card lz-sum"><h3>Hoy</h3><div class="g"><div><span>Mínimo</span><b>'+eur(L.min)+'</b></div><div><span>Media</span><b>'+eur(L.avg)+'</b></div><div><span>Máximo</span><b>'+eur(L.max)+'</b></div></div></section>';
    root.innerHTML=head+'<div class="body"><section class="hv-card lz-main">'+tabs+chart(list)+
      '<div class="lz-key"><span><i class="b-barata"></i>Barata</span><span><i class="b-normal"></i>Normal</span><span><i class="b-cara"></i>Cara</span><span class="src">Datos: Red Eléctrica</span></div></section><div class="rail">'+rail+'</div></div>';
  }
  function load(){return HVJson('/api/luz').then(function(d){L=d;draw();},function(e){root.innerHTML='<div class="hv-empty" style="padding-top:30vh;text-align:center">'+esc((e&&e.message)||'No se han podido cargar los precios')+'</div>';});}
  root.onclick=function(e){var b=e.target.closest('[data-d]');if(b&&!b.disabled){day=b.getAttribute('data-d');draw();}};
  HV.chrome({light:true});HV.back('Inicio');
  draw();load();setInterval(load,300000);
})();
