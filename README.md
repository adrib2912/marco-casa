# Marco de casa

Pantalla de casa para un marco de fotos Android (Frameo liberado), basada en
[Yani3rt/homeview](https://github.com/Yani3rt/homeview): calendario, tiempo, tareas, lista de la compra,
temporizadores y fotos en reposo. Todo en español y sin servidor propio:

- **GitHub Pages** sirve las pantallas (`frame/hv/`).
- **Supabase** (plan gratis) guarda tareas, compra y fotos, con inicio de sesión.
- **Open-Meteo** da el tiempo directamente al navegador (gratis, sin clave).
- Una **Action** copia el calendario de Google a Supabase cada 15 minutos, y otra el precio de la luz (PVPC, Red Eléctrica) cada hora.

## Puesta en marcha

1. **Supabase → SQL Editor:** pega `supabase/esquema.sql` y ejecútalo.
2. **Supabase → Authentication:**
   - En *Users*, crea la cuenta de la casa (correo + contraseña).
   - En *Sign In / Providers*, **desactiva "Allow new users to sign up"**. Sin esto, cualquiera con la web podría crearse una cuenta.
3. **`frame/hv/config.js`:** pon la Project URL y la anon key, y revisa la ciudad y los nombres.
4. **GitHub → Settings → Secrets and variables → Actions**, crea tres secretos:
   - `SUPABASE_URL`: la Project URL.
   - `SUPABASE_SERVICE_KEY`: la clave **secreta** (service_role). Solo va aquí.
   - `CALENDARIOS`, por ejemplo:
     `[{"key":"familia","url":"https://calendar.google.com/calendar/ical/.../private-.../basic.ics"},{"key":"festivos","url":"https://calendar.google.com/calendar/ical/es.spain%23holiday%40group.v.calendar.google.com/public/basic.ics"}]`
5. **GitHub → Settings → Pages:** publica desde la rama `main`, carpeta `/` (raíz).
6. Abre `https://USUARIO.github.io/marco-casa/` y entra con la cuenta de la casa. El marco lo recuerda.

## Estructura

```
frame/hv/          las pantallas (ES5: el marco tiene una WebView antigua)
frame/hv/config.js lo que se configura a mano
frame/shared/datos.js  responde a las pantallas: Supabase, Open-Meteo y temporizadores
supabase/esquema.sql   tablas, permisos y almacenamiento de fotos
scripts/calendario.py  iCal → Supabase (lo ejecuta .github/workflows/calendario.yml)
scripts/luz.py         PVPC de hoy y mañana → Supabase (.github/workflows/luz.yml)
```

Licencia MIT, como el original.
