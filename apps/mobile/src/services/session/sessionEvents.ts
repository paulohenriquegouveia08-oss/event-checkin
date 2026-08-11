/**
 * Canal simples de evento pra avisar a UI (App.tsx) que a credencial do
 * terminal deixou de ser válida — o admin pode excluir um terminal no
 * painel a qualquer momento, e o app precisa se desconectar sozinho na
 * próxima vez que tentar falar com o servidor (sync ou check-in), sem
 * esperar o operador perceber que parou de funcionar.
 *
 * Não é uma lib de state management de verdade — é só um pub-sub mínimo
 * porque quem detecta o problema (api/client.ts, bem no fundo da pilha de
 * chamadas) não tem acesso direto ao estado do App. Um EventEmitter real
 * (Node's "events") funcionaria igual mas puxaria um polyfill no bundle
 * React Native só pra isso.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onTerminalUnauthorized(callback: Listener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function emitTerminalUnauthorized(): void {
  for (const listener of listeners) listener();
}
