# Pendientes y próximos módulos

Lista viva de lo que quedó por hacer. Ordenado por prioridad sugerida.

## 🔜 Próximos módulos grandes

### 1. Usuarios y roles (base de casi todo)
Login multiusuario con permisos por rol.
- Rol **depósito**: ve solo la sección Depósito (no precios, no clientes).
- El **armador** sale del login (hoy se tipea a mano).
- Base necesaria para el Portal mayorista.

### 2. Portal del cliente mayorista ⭐ (idea tomada de MB Suite)
El comercio mayorista se logea y:
- Ve **sus precios**.
- Ve su **historial de pedidos**.
- **Repite un pedido** anterior en 2 clics.
- Alimenta el circuito Depósito ya armado.
> Requiere Usuarios/Roles primero (el cliente necesita login).

### 3. Dashboard unificado (idea de MB Suite)
Una sola pantalla con lo del día: ventas, pedidos a armar, stock bajo,
prospectos nuevos, conversaciones pendientes. Hoy está disperso
(Finanzas, Captación/métricas, Analytics, Depósito). Módulo chico y visible;
no depende de Usuarios.

### 4. Cierre de pago en el ciclo de compra mayorista ⭐ (en el tintero)
Hoy hay un hueco: entre que el cliente envía el pedido y el depósito lo
despacha, **nadie confirma que el pago entró**. En mayorista el pago es por
fuera (transferencia), así que puede salir mercadería no cobrada.

Operatoria acordada (opción B — armar primero, cobrar después):
1. Cliente envía pedido → estado **Recibido**.
2. Depósito controla stock (arma, tilda, marca faltantes) → cierra.
3. Sistema calcula el **total real** (pedido − faltantes) → pedido pasa a **A cobrar**.
4. Se contacta al comprador con el total final + datos de pago (generar mensaje
   de WhatsApp listo, con total y alias/CBU).
5. Cliente paga → alguien **confirma el pago** → estado **Pagado**.
6. Recién ahí se habilita **etiqueta y despacho** (2º candado, además del de
   "no cerrar sin controlar todo").

Notas de diseño:
- El candado de pago va **después de armar y antes de despachar** (no antes del
  depósito). El depósito no maneja plata, solo controla stock.
- Pendiente de definir: alias/CBU para el mensaje; quién confirma el pago
  (caja/vos vs. depósito); si se contempla **cuenta corriente** (pago a 30 días)
  desde el arranque o en una 2ª etapa.

## 🟡 Para más adelante
- **Planificador de redes / calendario de contenido** (programar posts IG/FB).
  Ojo: la API de Meta para publicar es limitada.
- **Gestor de tareas del equipo** con recurrencia (to-do interno).
- **Abordaje por WhatsApp API (plantilla)**: ya está armado; falta que Meta
  apruebe la plantilla y cargarla en Bot → Mensajes. Tope de gasto ya listo.
- **Catálogo nativo de WhatsApp** (Commerce Manager) — requiere fotos de productos.
- **Enriquecimiento**: buscar Instagram/web de prospectos que tienen teléfono
  pero no web.
- **"Hoja 2" de la lista**: ~18 cuchillos/tablas sin precio, cargar aparte.

## 🎨 Estético / a pulir
- Tienda pública en modo mayorista (revisar detalles).
- Checkout mayorista.
- Módulo Depósito.
- Marca "Pava Negra" (reemplazar "AppVentas" donde quede).

## ❌ Descartado (de MB Suite, no aplica al rubro)
SEO tracking, TikTok/LinkedIn Ads, email marketing masivo (ya hay newsletter),
multi-cliente de agencia.
