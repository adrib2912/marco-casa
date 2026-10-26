/* Tareas: lo que hay que hacer en casa, compartido con los móviles. ES5 (WebView antigua).
   Lee   : GET  /api/tasks  {items:[{id, title, who, done}], left}
   Escribe: POST /api/tasks {add, who} | {toggle:id} | {remove:id} | {clear_done:true}
   A la derecha, una tarjeta por persona (config.json "people") que filtra la lista al tocarla. */
(function(){
  var root=document.getElementById('root'),esc=HV.esc,D=null,busy=false,who='',filter=null;
  var PEOPLE=HV.cfg.people||[];
  var CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var RM='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var COLORS=['#ff9f0a','#0a84ff','#bf5af2','#ff375f','#30b0c7','#ac8e68'];
  function color(name){var i=PEOPLE.indexOf(name);return i<0?'#8e8e93':COLORS[i%COLORS.length];}

  function row(x){
    return '<div class="tr'+(x.done?' done':'')+'"><button class="ti" data-t="'+esc(x.id)+'"><span class="bx">'+(x.done?CHECK:'')+'</span>'+
      '<span class="tt"><b>'+esc(x.title)+'</b>'+(x.who?'<em style="background:'+color(x.who)+'">'+esc(x.who)+'</em>':'')+'</span></button>'+
      (x.done?'<button class="rm" data-rm="'+esc(x.id)+'" aria-label="Borrar">'+RM+'</button>':'')+'</div>';
  }
  function chips(){
    var h='<div class="wc"><span>¿Quién?</span><button data-w=""'+(who===''?' class="on"':'')+'>Cualquiera</button>';
    PEOPLE.forEach(function(p){h+='<button data-w="'+esc(p)+'"'+(who===p?' class="on"':'')+'>'+esc(p)+'</button>';});
    return h+'</div>';
  }
  function people(){
    if(!D)return '';
    var h='',groups=PEOPLE.concat(['']);
    groups.forEach(function(p){
      var mine=D.items.filter(function(x){return (x.who||'')===p&&!x.done;}),on=filter===p;
      h+='<button class="pc'+(on?' on':'')+'" data-f="'+esc(p)+'"><i style="background:'+(p?color(p):'#8e8e93')+'">'+esc(p?p.charAt(0):'·')+'</i>'+
        '<div><b>'+esc(p||'Sin asignar')+'</b><span>'+(mine.length?mine.length+' pendiente'+(mine.length===1?'':'s'):'Nada pendiente')+'</span></div></button>';
    });
    return '<section class="hv-card rc"><h3>Por persona</h3>'+h+(filter!==null?'<button class="hv-pill all" data-f="*">Ver todas</button>':'')+'</section>';
  }
  function draw(){
    var h='<header class="sh"><h1 class="hv-title">Tareas</h1><div class="hv-sub">'+
      (!D?'Cargando':D.left?D.left+' por hacer':D.items.length?'Todo hecho':'Nada pendiente')+'</div></header>';
    if(!D){root.innerHTML=h;return;}
    var list=D.items.filter(function(x){return filter===null||(x.who||'')===filter;});
    var todo=list.filter(function(x){return !x.done;}),done=list.filter(function(x){return x.done;}),rows='';
    todo.concat(done).forEach(function(x){rows+=row(x);});
    var add='<form class="af" id="af" autocomplete="off"><input id="ai" maxlength="80" placeholder="Nueva tarea" enterkeyhint="done">'+
      '<button class="hv-pill primary" type="submit">Añadir</button></form>'+(PEOPLE.length?chips():'');
    var foot=D.items.some(function(x){return x.done;})?'<div class="lf"><button class="hv-pill" id="clr">Borrar las hechas</button></div>':'';
    var empty=!list.length?'<div class="hv-empty em">'+(filter===null?'No hay tareas. Escribid una arriba o desde el móvil.':'Nada para '+esc(filter||'sin asignar')+'.')+'</div>':'';
    root.innerHTML=h+'<div class="body"><div class="lst"><div class="hv-card ac">'+add+rows+empty+foot+'</div></div><div class="rail">'+people()+'</div></div>';
  }
  function load(){return HVJson('/api/tasks').then(function(d){D=d;draw();},function(e){root.innerHTML='<div class="hv-empty" style="padding-top:30vh;text-align:center">'+esc((e&&e.message)||'No se han podido cargar las tareas')+'</div>';});}
  function send(obj,ok){busy=true;return HV.post('/api/tasks',obj).then(function(r){D=r;if(ok)HV.toast(ok);},function(err){HV.toast(err.message);}).then(function(){busy=false;draw();});}

  root.onsubmit=function(e){
    e.preventDefault();var i=document.getElementById('ai'),v=i?i.value.replace(/^\s+|\s+$/g,''):'';if(!v||busy)return;
    send({add:v,who:who},'Añadida: '+v);
  };
  root.onclick=function(e){
    var b;
    if((b=e.target.closest('[data-w]'))){who=b.getAttribute('data-w');var v=(document.getElementById('ai')||{}).value||'';draw();var i=document.getElementById('ai');if(i)i.value=v;return;}
    if((b=e.target.closest('[data-f]'))){var f=b.getAttribute('data-f');filter=f==='*'||filter===f?null:f;draw();return;}
    if(busy)return;
    if((b=e.target.closest('[data-rm]'))){send({remove:b.getAttribute('data-rm')});return;}
    if((b=e.target.closest('[data-t]'))){var id=b.getAttribute('data-t');
      D.items.forEach(function(x){if(x.id===id){x.done=!x.done;D.left+=x.done?-1:1;}});draw();send({toggle:id});return;}
    if(e.target.closest('#clr'))send({clear_done:true},'Borradas las hechas');
  };
  HV.chrome({light:true});HV.back('Inicio');
  draw();load();setInterval(function(){var a=document.activeElement;if(!busy&&!(a&&a.id==='ai'))load();},20000);
})();
