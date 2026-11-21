import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePostHog } from "@posthog/react";
import { currentPerson, initialState, transition, type Action, type State } from "./model";
import { parseState, readState, saveState, type StoragePort } from "./storage";
import { SingleWriter } from "./single-writer";
function browserStorage(): StoragePort | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function useStore() {
  const [loaded] = useState(() => readState(browserStorage()));
  const [state, setState] = useState(loaded.state);
  const [issue, setIssue] = useState(loaded.issue);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(loaded.blocked);
  const latest = useRef(state);
  function commit(next: State, replace = false) {
    latest.current = next;
    setState(next);
    setError("");
    if (blocked && !replace) return;
    try {
      saveState(browserStorage(), next);
      setIssue("");
      if (replace) setBlocked(false);
    } catch (e) {
      setIssue((e as Error).message);
    }
  }
  function run(action: Action) {
    try {
      commit(transition(latest.current, action));
      return true;
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Sprawdź poprawność i długość wprowadzonych danych.",
      );
      return false;
    }
  }
  function importState(raw: string) {
    try {
      const next = parseState(raw);
      commit(next, true);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
  return {
    state,
    issue,
    error,
    blocked,
    original: loaded.original,
    run,
    importState,
    clearError: () => setError(""),
    reset: () => commit(initialState(), true),
  };
}
type Store = ReturnType<typeof useStore>;
const Context = createContext<Store | null>(null);
function PostHogIdentity() {
  const { state } = usePrototype();
  const posthog = usePostHog();
  const previousPersonId = useRef<string | null>(null);
  const person = currentPerson(state);
  const personId = person?.id ?? null;
  const role = person?.role;

  useEffect(() => {
    if (
      !posthog ||
      !import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN ||
      !import.meta.env.VITE_PUBLIC_POSTHOG_HOST
    )
      return;
    if (!personId || !role) {
      if (previousPersonId.current !== null) posthog.reset();
      previousPersonId.current = null;
      return;
    }
    if (previousPersonId.current && previousPersonId.current !== personId) posthog.reset();
    posthog.identify(personId, { role });
    previousPersonId.current = personId;
  }, [personId, posthog, role]);
  return null;
}
function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  return (
    <Context.Provider value={store}>
      <PostHogIdentity />
      {children}
    </Context.Provider>
  );
}
export function PrototypeProvider({ children }: { children: ReactNode }) {
  return (
    <SingleWriter>
      <StoreProvider>{children}</StoreProvider>
    </SingleWriter>
  );
}
export function usePrototype() {
  const store = useContext(Context);
  if (!store) throw new Error("PrototypeProvider is required");
  return store;
}
