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
        out.append({"uid": str(ev.get("UID", "")), "title": str(ev.get("SUMMARY", "")).strip() or "(ocupado)",
                    "start": ini.isoformat(), "end": fin.isoformat(), "all_day": todo,
                    "location": str(ev.get("LOCATION", "")).strip() or None, "cal": key})
    return out


def main():
    cals = json.loads(os.environ["CALENDARIOS"])
    hoy = datetime.now(ZONA).date()
    desde, hasta = hoy - timedelta(days=ANTES), hoy + timedelta(days=DESPUES)
    todos, vistos, fallos = [], set(), []
    for c in cals:
        try:
            evs = eventos(bajar(c["url"]), c["key"], desde, hasta)
        except Exception as e:                       # sin el enlace en el error: es secreto
            fallos.append(c["key"]); print(f"{c['key']}: no se ha podido leer ({type(e).__name__})", file=sys.stderr)
            continue
        for e in evs:                                # el mismo evento en dos calendarios sale una vez
            k = (e["uid"] or e["title"].casefold(), e["start"])
            if k not in vistos:
                vistos.add(k); todos.append(e)
        print(f"{c['key']}: {len(evs)} eventos")
    if fallos and not todos:
        sys.exit("Ningún calendario se ha podido leer; no toco lo que ya hay en Supabase")
    todos.sort(key=lambda e: e["start"])
    cuerpo = json.dumps({"eventos": todos, "actualizado": datetime.now(ZONA).isoformat()}).encode()
    url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/calendario?id=eq.1"
    clave = os.environ["SUPABASE_SERVICE_KEY"]
    req = urllib.request.Request(url, data=cuerpo, method="PATCH", headers={
        "apikey": clave, "Authorization": "Bearer " + clave, "Content-Type": "application/json", "Prefer": "return=minimal"})
    with urllib.request.urlopen(req, timeout=30) as r:
        print("Supabase:", r.status, "·", len(todos), "eventos guardados")


if __name__ == "__main__":
    main()
