export type Route =
  | { name: 'dashboard' }
  | { name: 'clients' }
  | { name: 'items' }
  | { name: 'usage' }
  | { name: 'invoices' }
  | { name: 'invoiceDetail'; invoiceId: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const [path, param] = h.split('/');
  switch (path) {
    case 'clients':
      return { name: 'clients' };
    case 'items':
      return { name: 'items' };
    case 'usage':
      return { name: 'usage' };
    case 'invoices':
      if (param) return { name: 'invoiceDetail', invoiceId: param };
      return { name: 'invoices' };
    case '':
    case 'dashboard':
    default:
      return { name: 'dashboard' };
  }
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function onRouteChange(fn: (route: Route) => void) {
  const handler = () => fn(parseHash(window.location.hash));
  window.addEventListener('hashchange', handler);
  handler();
}
