/* Configuración de la casa. Esto es lo único que hay que tocar a mano.
   SUPABASE_URL y SUPABASE_KEY (la "anon / publishable") son públicas: pueden estar aquí sin problema.
   La clave secreta (service_role) NUNCA va aquí: solo en los secretos de GitHub. */
window.MC_CONFIG={
  SUPABASE_URL:'https://TU-PROYECTO.supabase.co',
  SUPABASE_KEY:'TU-ANON-KEY',
  BASE:'/marco-casa/'                     // la ruta de GitHub Pages: https://usuario.github.io/marco-casa/
};
window.HV_CONFIG={
  home_name:'Casa',
  timezone:'Europe/Madrid',
  place:'Madrid',
  latitude:40.4168, longitude:-3.7038,
  temp_unit:'C', wind_unit:'kmh',
  people:['Mamá','Papá'],                // quién puede hacer las tareas
  timers:[{label:'Pasta',seconds:600},{label:'Huevos',seconds:600},{label:'Arroz',seconds:1200},{label:'Horno',seconds:1800}],
  // las claves deben coincidir con las de .github/workflows/calendario.yml
  calendars:[{key:'familia',name:'Familia',color:'#ff9f0a',holidays:false},
             {key:'festivos',name:'Festivos',color:'#34c759',holidays:true}],
  backpack:[],
  sonos:false, spotify:false, camera:false, ha:false, ha_alerts:false
};
