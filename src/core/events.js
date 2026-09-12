const bus = new EventTarget();

export const Events = {
  on(type, listener) {
    bus.addEventListener(type, listener);
    return () => bus.removeEventListener(type, listener);
  },
  emit(type, detail = {}) {
    bus.dispatchEvent(new CustomEvent(type, { detail }));
  },
};
