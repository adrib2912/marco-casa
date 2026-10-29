"""Lee los calendarios (enlaces iCal) y deja sus eventos en Supabase, tabla "calendario".

Lo ejecuta la Action de GitHub cada 15 minutos. Necesita tres secretos del repo:
  CALENDARIOS            [{"key": "familia", "url": "https://calendar.google.com/.../basic.ics"}, ...]
  SUPABASE_URL           https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY   la clave secreta (service_role): solo aquí, nunca en la web
Las "key" tienen que coincidir con las de frame/hv/config.js. Un enlace iCal privado es como una contraseña:
por eso va en los secretos y nunca en el repo.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import icalendar
import recurring_ical_events

ZONA = ZoneInfo(os.environ.get("ZONA", "Europe/Madrid"))
ANTES, DESPUES = 2, 60          # días hacia atrás y hacia delante


def bajar(url):
    req = urllib.request.Request(url.replace("webcal://", "https://"), headers={"User-Agent": "marco-casa"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def a_local(v):
    """(fecha y hora en la zona de casa, ¿es de todo el día?)"""
    if isinstance(v, datetime):
        return (v.replace(tzinfo=ZONA) if v.tzinfo is None else v.astimezone(ZONA)), False
    return datetime.combine(v, time.min, ZONA), True


def limpiar(texto, n=300):
    """La descripción del evento, sin HTML (Google la manda a veces con <br>) y recortada."""
    import re
    t = re.sub(r"<br\s*/?>", "\n", texto, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t).replace("&nbsp;", " ").strip()
    return (t[:n].rstrip() + "…") if len(t) > n else (t or None)


# officeholidays.com da los nombres de los festivos en inglés: se traducen los fijos
# (los que se repiten cada año) para que el marco los muestre en castellano.
FESTIVOS_ES = [
    ("New Year's Day", "Año Nuevo"), ("Epiphany", "Epifanía del Señor"),
    ("Maundy Thursday", "Jueves Santo"), ("Good Friday", "Viernes Santo"),
    ("Labour Day", "Día del Trabajo"), ("Labor Day", "Día del Trabajo"),
    ("Assumption of Mary", "Asunción de la Virgen"), ("Assumption Day", "Asunción de la Virgen"),
    ("National Day", "Fiesta Nacional de España"), ("Hispanic Day", "Fiesta Nacional de España"),
    ("All Saints' Day", "Día de Todos los Santos"), ("Constitution Day", "Día de la Constitución"),
    ("Immaculate Conception", "Inmaculada Concepción"), ("Christmas Day", "Navidad"),
    ("(Regional Holiday)", "(festivo regional)"), ("(in lieu)", "(trasladado)"),
]


def traducir_festivo(titulo):
    for en, es in FESTIVOS_ES:
        titulo = titulo.replace(en, es)
    return titulo


def eventos(ics, key, desde, hasta):
    out = []
    for ev in recurring_ical_events.of(icalendar.Calendar.from_ical(ics)).between(desde, hasta):
        if str(ev.get("STATUS", "")).upper() == "CANCELLED":
            continue
        ini, todo = a_local(ev["DTSTART"].dt)
        if ev.get("DTEND") is not None:
            fin, _ = a_local(ev["DTEND"].dt)
        elif ev.get("DURATION") is not None:
            fin = ini + ev["DURATION"].dt
        else:
            fin = ini + (timedelta(days=1) if todo else timedelta(0))
        titulo = str(ev.get("SUMMARY", "")).strip() or "(ocupado)"
        if key == "festivos":
            titulo = traducir_festivo(titulo)
        out.append({"uid": str(ev.get("UID", "")), "title": titulo,
                    "start": ini.isoformat(), "end": fin.isoformat(), "all_day": todo,
                    "location": str(ev.get("LOCATION", "")).strip() or None,
                    "description": limpiar(str(ev.get("DESCRIPTION", ""))), "cal": key})
    return out


def fallo(msg):
    """Termina con el error visible en la página de la Action (anotación) y en el log."""
    print("::error::" + msg.replace("\n", " "), flush=True)
    sys.exit(1)


def secreto(nombre):
    v = os.environ.get(nombre, "").strip()
    if not v:
        fallo(f"Falta el secreto {nombre} en GitHub (Settings → Secrets and variables → Actions)")
    return v


def guardar(url, cuerpo, clave):
    """PATCH a Supabase. Las claves nuevas (sb_secret_...) van solo en la cabecera apikey."""
    req = urllib.request.Request(url, data=cuerpo, method="PATCH", headers={
        "apikey": clave, "Content-Type": "application/json", "Prefer": "return=minimal"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        fallo(f"Supabase ha respondido {e.code}: {e.read().decode(errors='ignore')[:300]}")


def main():
    try:
        cals = json.loads(secreto("CALENDARIOS"))
    except json.JSONDecodeError as e:
        fallo(f"El secreto CALENDARIOS no es un texto válido (revisa comillas y corchetes): {e.msg}")
    hoy = datetime.now(ZONA).date()
    desde, hasta = hoy - timedelta(days=ANTES), hoy + timedelta(days=DESPUES)
    todos, vistos, fallos = [], set(), []
    for c in cals:
        try:
            evs = eventos(bajar(c["url"]), c["key"], desde, hasta)
        except Exception as e:                       # sin el enlace en el error: es secreto
            fallos.append(c["key"]); print(f"::warning::Calendario {c['key']}: no se ha podido leer ({type(e).__name__})", flush=True)
            continue
        for e in evs:                                # el mismo evento en dos calendarios sale una vez
            k = (e["uid"] or e["title"].casefold(), e["start"])
            if k not in vistos:
                vistos.add(k); todos.append(e)
        print(f"{c['key']}: {len(evs)} eventos")
    if fallos and not todos:
        fallo("Ningún calendario se ha podido leer; no toco lo que ya hay en Supabase")
    todos.sort(key=lambda e: e["start"])
    cuerpo = json.dumps({"eventos": todos, "actualizado": datetime.now(ZONA).isoformat()}).encode()
    url = secreto("SUPABASE_URL").rstrip("/") + "/rest/v1/calendario?id=eq.1"
    print("Supabase:", guardar(url, cuerpo, secreto("SUPABASE_SERVICE_KEY")), "·", len(todos), "eventos guardados")


if __name__ == "__main__":
    main()
