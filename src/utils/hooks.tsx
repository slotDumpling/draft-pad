import {
  useRef,
  Dispatch,
  SetStateAction,
  useMemo,
  useCallback,
  useDebugValue,
} from "react";

export type Setter<T> = Dispatch<SetStateAction<T>>;

export function useEvent<A extends any[], R>(fn: (...args: A) => R) {
  const fnRef = useRef(fn);
  fnRef.current = useMemo(() => fn, [fn]);
  useDebugValue(fn);
  return useCallback((...args: A) => {
    return fnRef.current(...args);
  }, []);
}
