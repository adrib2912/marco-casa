"""Precio de la luz (PVPC) de hoy y mañana → Supabase, tabla "luz" (una fila).

Fuente: la API pública de Red Eléctrica (apidatos.ree.es), sin clave. Los precios de mañana se publican
hacia las 20:15. Lo ejecuta .github/workflows/luz.yml cada hora. Secretos: SUPABASE_URL, SUPABASE_SERVICE_KEY.
Guarda [{"t": "2026-10-27T13:00", "p": 0.1234}, ...] con p en €/kWh y la hora en la zona de casa.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

ZONA = ZoneInfo(os.environ.get("ZONA", "Europe/Madrid"))
API = "https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real"


def bajar(url):
    req = urllib.request.Request(url, headers={"User-Agent": "marco-casa", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def precios(doc):
    """Del JSON de REE, la serie PVPC por horas (media si viene cada 15 minutos), en €/kWh."""
    serie = None
    for x in doc.get("included") or []:
        nombre = (x.get("type") or "") + " " + ((x.get("attributes") or {}).get("title") or "")
        if "PVPC" in nombre.upper():
            serie = x["attributes"]["values"]
            break
    if serie is None:
        raise ValueError("REE no ha devuelto la serie PVPC")
    horas = defaultdict(list)
    for v in serie:
        if v.get("value") is None:
            continue
        t = datetime.fromisoformat(v["datetime"]).astimezone(ZONA)
        horas[t.strftime("%Y-%m-%dT%H:00")].append(float(v["value"]))
    return [{"t": k, "p": round(sum(vs) / len(vs) / 1000, 4)} for k, vs in sorted(horas.items())]


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
    hoy = datetime.now(ZONA).date()
    url = f"{API}?start_date={hoy}T00:00&end_date={hoy + timedelta(days=1)}T23:59&time_trunc=hour"
    try:
        doc = bajar(url)
    except Exception as e:
        fallo(f"Red Eléctrica no responde ({type(e).__name__}: {e})")
    try:
        horas = precios(doc)
    except (ValueError, KeyError, TypeError) as e:
        fallo(f"Red Eléctrica ha cambiado el formato: {e}")
    if not horas:
        fallo("Sin precios; no toco lo que hay en Supabase")
    cuerpo = json.dumps({"horas": horas, "actualizado": datetime.now(ZONA).isoformat()}).encode()
    url = secreto("SUPABASE_URL").rstrip("/") + "/rest/v1/luz?id=eq.1"
    print("Supabase:", guardar(url, cuerpo, secreto("SUPABASE_SERVICE_KEY")), "·", len(horas), "horas,", horas[0]["t"], "a", horas[-1]["t"])


if __name__ == "__main__":
    main()
