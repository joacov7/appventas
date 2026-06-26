"""
Scraper de inteligencia de precios.
Busca tiendas en Tiendanube y Empretienda, extrae productos y detecta cambios de precio.
"""

import time
import random
import requests
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    "Accept-Language": "es-AR,es;q=0.9",
}


# ── Búsqueda de tiendas (sin Google) ─────────────────────────────────────────

def buscar_tiendas_tiendanube(termino: str, max_tiendas: int = 8) -> list[dict]:
    """Busca tiendas en el directorio público de Tiendanube via su API."""
    tiendas = []
    try:
        # API pública de búsqueda de tiendas de Tiendanube Argentina
        resp = requests.get(
            "https://www.tiendanube.com/ar/tiendas",
            params={"q": termino, "per_page": max_tiendas},
            headers=HEADERS,
            timeout=15,
        )
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            for card in soup.select("a[href*='mitiendanube.com'], a[href*='mitienda.com']")[:max_tiendas]:
                href = card.get("href", "")
                parsed = urlparse(href)
                base_url = f"{parsed.scheme}://{parsed.netloc}"
                nombre = parsed.netloc.split(".")[0].replace("-", " ").title()
                tiendas.append({"nombre": nombre, "url": base_url, "plataforma": "tiendanube"})
    except Exception as e:
        print(f"  [WARN] Tiendanube directory: {e}")

    # Fallback: buscar directamente URLs conocidas via DuckDuckGo HTML (no bloquea tanto)
    if not tiendas:
        tiendas = buscar_duckduckgo(termino, "mitiendanube.com OR mitienda.com", "tiendanube", max_tiendas)

    print(f"  [BÚSQUEDA TN] '{termino}' → {len(tiendas)} tiendas")
    return tiendas


def buscar_tiendas_empretienda(termino: str, max_tiendas: int = 8) -> list[dict]:
    """Busca tiendas en Empretienda."""
    tiendas = buscar_duckduckgo(termino, "empretienda.com.ar", "empretienda", max_tiendas)
    print(f"  [BÚSQUEDA ET] '{termino}' → {len(tiendas)} tiendas")
    return tiendas


def buscar_duckduckgo(termino: str, site: str, plataforma: str, max_tiendas: int) -> list[dict]:
    """Busca en DuckDuckGo HTML (menos restrictivo que Google en servidores)."""
    tiendas = []
    vistos = set()
    query = f"{termino} site:{site}"
    try:
        resp = requests.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
            headers={**HEADERS, "Accept": "text/html"},
            timeout=15,
        )
        if resp.status_code != 200:
            return tiendas

        soup = BeautifulSoup(resp.text, "html.parser")
        for a in soup.select("a.result__url, a[href*='uddg=']")[:max_tiendas * 3]:
            href = a.get("href", "")
            # DuckDuckGo redirige via uddg= param
            if "uddg=" in href:
                from urllib.parse import unquote, parse_qs
                qs = parse_qs(urlparse(href).query)
                href = unquote(qs.get("uddg", [""])[0])

            parsed = urlparse(href)
            dominio = parsed.netloc.lower()
            if not dominio:
                dominio = a.get_text(strip=True).lower()

            if site.split(".")[0] not in dominio and "mitienda" not in dominio:
                continue

            base_url = f"https://{dominio}" if dominio else ""
            if not base_url or base_url in vistos:
                continue
            vistos.add(base_url)

            nombre = dominio.split(".")[0].replace("-", " ").title()
            tiendas.append({"nombre": nombre, "url": base_url, "plataforma": plataforma})

            if len(tiendas) >= max_tiendas:
                break

    except Exception as e:
        print(f"  [WARN] DuckDuckGo '{termino}': {e}")

    return tiendas


def buscar_tiendas(termino: str, plataforma: str, max_tiendas: int = 8) -> list[dict]:
    if plataforma == "empretienda":
        return buscar_tiendas_empretienda(termino, max_tiendas)
    elif plataforma == "tiendanube":
        return buscar_tiendas_tiendanube(termino, max_tiendas)
    else:
        tn = buscar_tiendas_tiendanube(termino, max_tiendas // 2 + 1)
        et = buscar_tiendas_empretienda(termino, max_tiendas // 2 + 1)
        return tn + et


# ── Scraping de productos ─────────────────────────────────────────────────────

def scrape_tiendanube(store_url: str) -> list[dict]:
    """Usa la API JSON pública de Tiendanube para extraer productos."""
    productos = []
    page_num = 1

    while True:
        try:
            resp = requests.get(
                f"{store_url}/productos.json",
                params={"per_page": 200, "page": page_num},
                headers=HEADERS,
                timeout=15,
            )
            if resp.status_code != 200:
                break

            data = resp.json()
            items = data if isinstance(data, list) else data.get("products", data.get("items", []))

            if not items:
                break

            for item in items:
                try:
                    nombre = item.get("name") or item.get("nombre") or ""
                    precio_raw = item.get("price") or item.get("precio") or item.get("variants", [{}])[0].get("price", 0)
                    precio = float(str(precio_raw).replace(",", ".")) if precio_raw else None

                    cats = item.get("categories") or item.get("categorias") or []
                    categoria = cats[0].get("name") if cats and isinstance(cats[0], dict) else (cats[0] if cats else None)

                    item_url = item.get("url") or item.get("permalink") or ""
                    if item_url and not item_url.startswith("http"):
                        item_url = urljoin(store_url, item_url)

                    imagenes = item.get("images") or item.get("imagenes") or []
                    imagen = imagenes[0].get("src") if imagenes and isinstance(imagenes[0], dict) else None

                    if nombre and item_url:
                        productos.append({
                            "nombre": nombre,
                            "precio": precio,
                            "categoria": categoria,
                            "url": item_url,
                            "imagen": imagen,
                        })
                except Exception:
                    continue

            if len(items) < 200:
                break
            page_num += 1
            time.sleep(0.5)

        except Exception as e:
            print(f"    [WARN] Tiendanube JSON error {store_url}: {e}")
            break

    return productos


def scrape_empretienda(page, store_url: str) -> list[dict]:
    """Scrapea productos de Empretienda via HTML."""
    productos = []
    try:
        page.goto(f"{store_url}/productos", timeout=20000, wait_until="domcontentloaded")
        time.sleep(2)

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")

        for item in soup.select(".product-item, .item, article.product, .productos-item")[:100]:
            try:
                nombre_el = item.select_one(".product-name, .item-name, h2, h3, .nombre")
                nombre = nombre_el.get_text(strip=True) if nombre_el else ""

                precio_el = item.select_one(".price, .precio, .product-price, [class*='price']")
                precio_txt = precio_el.get_text(strip=True) if precio_el else ""
                precio = None
                if precio_txt:
                    nums = "".join(c for c in precio_txt if c.isdigit() or c in ".,")
                    nums = nums.replace(".", "").replace(",", ".")
                    try:
                        precio = float(nums)
                    except Exception:
                        pass

                link_el = item.select_one("a[href]")
                item_url = ""
                if link_el:
                    href = link_el.get("href", "")
                    item_url = href if href.startswith("http") else urljoin(store_url, href)

                img_el = item.select_one("img[src]")
                imagen = img_el.get("src") if img_el else None

                if nombre and item_url:
                    productos.append({
                        "nombre": nombre,
                        "precio": precio,
                        "categoria": None,
                        "url": item_url,
                        "imagen": imagen,
                    })
            except Exception:
                continue

    except Exception as e:
        print(f"    [WARN] Empretienda scrape {store_url}: {e}")

    return productos


def scrape_tienda(page, tienda: dict) -> list[dict]:
    url = tienda["url"]
    plat = tienda["plataforma"]
    print(f"    Scrapeando {url} ({plat})...")

    if plat == "tiendanube":
        productos = scrape_tiendanube(url)
    else:
        productos = scrape_empretienda(page, url)

    print(f"    → {len(productos)} productos")
    return productos


# ── Pipeline principal ────────────────────────────────────────────────────────

def cargar_tiendas_db() -> list[dict]:
    """Carga tiendas ya conocidas de la DB para scrapearlas siempre."""
    from database import get_connection
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, nombre, url, plataforma FROM tiendas_competidoras WHERE activa = TRUE")
                rows = cur.fetchall()
        return [{"id": r[0], "nombre": r[1], "url": r[2], "plataforma": r[3]} for r in rows]
    except Exception as e:
        print(f"  [WARN] cargar_tiendas_db: {e}")
        return []


def run_inteligencia(conn_factory, busquedas: list[dict], alertas_callback=None) -> dict:
    """
    Ejecuta el pipeline completo de inteligencia de precios.
    - conn_factory: función que retorna una conexión DB (para upserts)
    - busquedas: lista de {termino, plataforma, umbral_alerta}
    - alertas_callback(cambio, producto, tienda): llamado cuando hay baja de precio significativa
    Retorna resumen {tiendas, productos, alertas}
    """
    from database import upsert_tienda, upsert_producto

    resumen = {"tiendas": 0, "productos": 0, "alertas": 0}
    umbral_default = min((b.get("umbral_alerta", 10) for b in busquedas), default=10)

    # Tiendas ya conocidas en DB (cargadas antes de abrir el browser)
    tiendas_conocidas = cargar_tiendas_db()
    tiendas_a_scrapear = {t["url"]: t for t in tiendas_conocidas}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=HEADERS["User-Agent"], locale="es-AR")
        page = context.new_page()

        # Intentar descubrir tiendas nuevas via búsqueda
        for busqueda in busquedas:
            termino = busqueda["termino"]
            plataforma = busqueda["plataforma"]
            print(f"\n[INTELIGENCIA] Búsqueda: '{termino}' ({plataforma})")
            nuevas = buscar_tiendas(termino, plataforma)
            for t in nuevas:
                if t["url"] not in tiendas_a_scrapear:
                    tiendas_a_scrapear[t["url"]] = t
            time.sleep(random.uniform(1, 2))

        print(f"\n[INTELIGENCIA] Total tiendas a scrapear: {len(tiendas_a_scrapear)}")

        # Scrapear todas las tiendas (conocidas + recién descubiertas)
        for url, tienda in tiendas_a_scrapear.items():
            tienda_id = tienda.get("id") or upsert_tienda(tienda["nombre"], tienda["url"], tienda["plataforma"])
            if not tienda.get("id"):
                resumen["tiendas"] += 1

            productos = scrape_tienda(page, tienda)
            time.sleep(random.uniform(1, 2))

            for prod in productos:
                cambio = upsert_producto(tienda_id, prod)
                resumen["productos"] += 1
                if cambio and cambio["pct"] <= -umbral_default and alertas_callback:
                    alertas_callback(cambio, prod, tienda)
                    resumen["alertas"] += 1

        browser.close()

    return resumen


if __name__ == "__main__":
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from database import get_connection, crear_tablas_inteligencia, seed_busquedas_default, cargar_busquedas_activas

    crear_tablas_inteligencia()
    seed_busquedas_default()
    busquedas = cargar_busquedas_activas()
    print(f"[INFO] {len(busquedas)} búsquedas activas")
    resumen = run_inteligencia(get_connection, busquedas)
    print(f"\n[OK] Tiendas: {resumen['tiendas']} | Productos: {resumen['productos']} | Alertas: {resumen['alertas']}")
