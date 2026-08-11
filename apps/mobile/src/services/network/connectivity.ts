import NetInfo from "@react-native-community/netinfo";

/** `isInternetReachable` pode ficar `null` momentaneamente (ainda
 * verificando) — nesse caso caímos de volta em `isConnected`, para não
 * tratar um estado "ainda não sei" como offline por engano. */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (state.isInternetReachable === null) {
    return Boolean(state.isConnected);
  }
  return Boolean(state.isConnected && state.isInternetReachable);
}

export function subscribeConnectivity(callback: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    const online = state.isInternetReachable === null ? Boolean(state.isConnected) : Boolean(state.isConnected && state.isInternetReachable);
    callback(online);
  });
}
