/** Cache mémoire simple pour éviter un second écran « Chargement… » au retour sur une page. */
export function createPageCache<T>() {
  const store = new Map<string, T>();
  return {
    get: (key: string) => store.get(key),
    set: (key: string, value: T) => {
      store.set(key, value);
    },
  };
}
