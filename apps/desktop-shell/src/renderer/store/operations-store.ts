import type { GatewayEvent } from "../services/gateway-events.js";
import { applyGatewayEvent, createInitialOperationsState, type OperationsProjectionState } from "./projections.js";

type Subscriber = (state: OperationsProjectionState) => void;

export type OperationsStore = {
  getState: () => OperationsProjectionState;
  dispatch: (event: GatewayEvent, at?: number) => void;
  subscribe: (subscriber: Subscriber) => () => void;
};

export function createOperationsStore(): OperationsStore {
  let state = createInitialOperationsState();
  const subscribers = new Set<Subscriber>();

  const notify = (): void => {
    for (const subscriber of subscribers) {
      subscriber(state);
    }
  };

  return {
    getState: () => state,
    dispatch: (event, at = Date.now()) => {
      state = applyGatewayEvent(state, event, at);
      notify();
    },
    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      subscriber(state);
      return () => {
        subscribers.delete(subscriber);
      };
    },
  };
}
