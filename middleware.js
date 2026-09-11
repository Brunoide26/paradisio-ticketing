// Modo "coming soon" temporal. Para revertir: borrar este archivo. Nada más
// cambia -- ninguna página se movió ni se borró, sólo dejan de ser alcanzables
// mientras este middleware exista.
//
// Tiene que ser middleware y no un rewrite de vercel.json: en Vercel el
// filesystem tiene precedencia sobre los rewrites, así que un catch-all por
// rewrite sólo atraparía rutas que NO existen como archivo -- /, /entrada,
// /admin y demás seguirían sirviéndose igual, que es exactamente lo contrario
// de lo que se busca. El Routing Middleware corre antes del filesystem, así
// que alcanza a todas.

const HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Paradisio</title>
<meta name="theme-color" content="#000000">
<meta property="og:title" content="Paradisio">
<meta property="og:description" content="Coming soon">
<meta property="og:type" content="website">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@300&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #000000; overflow: hidden; }
  body {
    min-height: 100vh;
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(26px, 5vh, 52px);
    padding: 24px;
    /* Jost sólo viste el "coming soon"; el fallback mantiene el tracking
       legible si Google Fonts tarda o está bloqueado. */
    font-family: 'Jost', system-ui, -apple-system, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .logo {
    width: min(72vw, 620px);
    height: auto;
    display: block;
    animation: enter 1.5s cubic-bezier(.16,.84,.3,1) .15s both;
  }
  .tagline {
    margin: 0;
    font-weight: 300;
    font-size: clamp(10px, 1.5vw, 12.5px);
    letter-spacing: .52em;
    /* El letter-spacing deja un hueco después de la última letra que corre la
       línea visualmente a la izquierda; el indent del mismo valor la recentra. */
    text-indent: .52em;
    text-transform: uppercase;
    color: rgba(255,255,255,.34);
    /* La entrada termina en .85s + 1.5s = 2.35s y el loop arranca en 2.4s.
       Va segundo en la lista, así que gana la opacidad una vez que corre. */
    animation:
      enter 1.5s cubic-bezier(.16,.84,.3,1) .85s both,
      breathe 5.5s ease-in-out 2.4s infinite;
  }
  @keyframes enter {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes breathe {
    0%, 100% { opacity: 1; }
    50%      { opacity: .45; }
  }
  @media (prefers-reduced-motion: reduce) {
    .logo, .tagline { animation: none; opacity: 1; transform: none; }
  }
</style>
</head>
<body>
  <img class="logo" src="/paradisio-logo.png" alt="Paradisio" width="1200" height="388">
  <p class="tagline">Coming soon</p>
</body>
</html>
`;

// Todo menos: las funciones de /api (ver nota abajo), el logo que esta misma
// pantalla necesita, y los iconos/manifest que pide el navegador solo. Sin
// excluir el logo, la pantalla se pediría a sí misma en lugar del PNG.
//
// /api queda en pie a propósito: mandarle HTML a un endpoint JSON rompería el
// webhook de Culqi y dejaría sin salida a los datos del panel (admin.html sí
// queda tapado, como el resto de las páginas). Para apagar las APIs también,
// sacar `api/|` del matcher.
export const config = {
  matcher: ['/((?!api/|paradisio-logo\\.png|favicon|apple-touch-icon|android-chrome|site\\.webmanifest).*)'],
};

export default function middleware() {
  return new Response(HTML, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Sin cache: el día que se borre este archivo, el sitio real vuelve al
      // instante en vez de quedar pegado en navegadores y CDN.
      'cache-control': 'no-store, must-revalidate',
    },
  });
}

export { HTML };
