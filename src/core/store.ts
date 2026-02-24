import { Store } from "./global-store.ts";
import { initialState } from "./app-state.ts";
import type { AppState } from "./app-state.ts";

export const appStore = new Store<AppState>(initialState);
