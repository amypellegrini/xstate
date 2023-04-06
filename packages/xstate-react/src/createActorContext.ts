import * as React from 'react';
import { useInterpret } from './useInterpret';
import { useActor as useActorUnbound } from './useActor';
import { useSelector as useSelectorUnbound } from './useSelector';
import {
  ActorRefFrom,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  SnapshotFrom,
  InternalMachineImplementations,
  InterpreterOptions,
  Observer,
  StateFrom
} from 'xstate';

export function createActorContext<TMachine extends AnyStateMachine>(
  machine: TMachine,
  interpreterOptions?: InterpreterOptions<TMachine>,
  observerOrListener?:
    | Observer<StateFrom<TMachine>>
    | ((value: StateFrom<TMachine>) => void)
): {
  useActor: () => [StateFrom<TMachine>, ActorRefFrom<TMachine>['send']];
  useSelector: <T>(
    selector: (snapshot: SnapshotFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ) => T;
  useActorRef: () => ActorRefFrom<TMachine>;
  Provider: (
    props: {
      children: React.ReactNode;
      machine?: TMachine | (() => TMachine);
    } & (AreAllImplementationsAssumedToBeProvided<
      TMachine['__TResolvedTypesMeta']
    > extends false
      ? {
          options: InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta'],
            true
          >;
        }
      : {
          options?: InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TMachine['__TResolvedTypesMeta']
          >;
        })
  ) => React.ReactElement<any, any>;
} {
  const ReactContext = React.createContext<ActorRefFrom<TMachine> | null>(null);

  const OriginalProvider = ReactContext.Provider;

  function Provider({
    children,
    machine: providedMachine = machine
  }: {
    children: React.ReactNode;
    machine: TMachine | (() => TMachine);
    options?: any;
  }) {
    const actor = useInterpret(
      providedMachine,
      interpreterOptions,
      observerOrListener
    ) as ActorRefFrom<TMachine>;

    return React.createElement(OriginalProvider, { value: actor, children });
  }

  Provider.displayName = `ActorProvider(${machine.id})`;

  function useContext() {
    const actor = React.useContext(ReactContext);

    if (!actor) {
      throw new Error(
        `You used a hook from "${Provider.displayName}" but it's not inside a <${Provider.displayName}> component.`
      );
    }

    return actor;
  }

  function useActor() {
    const actor = useContext();
    return useActorUnbound(actor);
  }

  function useSelector<T>(
    selector: (snapshot: SnapshotFrom<TMachine>) => T,
    compare?: (a: T, b: T) => boolean
  ): T {
    const actor = useContext();
    return useSelectorUnbound(actor, selector, compare);
  }

  return {
    Provider,
    useActorRef: useContext,
    useActor,
    useSelector
  };
}
