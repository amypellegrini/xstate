import { ActorRef, assign, createMachine, Interpreter, SCXML } from 'xstate';
import { XStateDevInterface } from 'xstate/dev';
import { stringifyMachine, stringifyState } from './serialize';

import { ReceiverEvent, Replacer } from './types';

export type InspectMachineEvent =
  | ReceiverEvent
  | { type: 'unload' }
  | { type: 'disconnect' }
  | { type: 'xstate.event'; event: string; service: string }
  | { type: 'xstate.inspecting'; client: Pick<ActorRef<any>, 'send'> };

export function createInspectMachine(
  devTools: XStateDevInterface = globalThis.__xstate__,
  options?: { serialize?: Replacer | undefined }
) {
  const serviceMap = new Map<string, Interpreter<any, any>>();

  // Listen for actors being registered and index them
  // by their sessionId for quicker lookup
  const sub = devTools.onRegister((service) => {
    serviceMap.set(service.sessionId, service);
  });

  return createMachine<
    {
      client?: Pick<ActorRef<any>, 'send'>;
    },
    InspectMachineEvent
  >({
    initial: 'pendingConnection',
    context: {
      client: undefined
    },
    states: {
      pendingConnection: {},
      connected: {
        on: {
          'service.state': {
            actions: (ctx, e) => ctx.client!.send(e)
          },
          'service.event': {
            actions: (ctx, e) => ctx.client!.send(e)
          },
          'service.register': {
            actions: (ctx, e) => ctx.client!.send(e)
          },
          'service.stop': {
            actions: (ctx, e) => ctx.client!.send(e)
          },
          'xstate.event': {
            actions: (_, e) => {
              const { event } = e;
              const scxmlEventObject = JSON.parse(event) as SCXML.Event<any>;
              const service = serviceMap.get(scxmlEventObject.origin?.id!);
              service?.send(scxmlEventObject);
            }
          },
          unload: {
            actions: (ctx) => {
              ctx.client!.send({ type: 'xstate.disconnect' });
            }
          },
          disconnect: 'disconnected'
        }
      },
      disconnected: {
        entry: () => {
          sub.unsubscribe();
        },
        type: 'final'
      }
    },
    on: {
      'xstate.inspecting': {
        target: '.connected',
        actions: [
          assign({
            client: (
              _,
              e: InspectMachineEvent & { type: 'xstate.inspecting' }
            ) => e.client
          }),
          (ctx) => {
            devTools.actors.forEach((service) => {
              ctx.client?.send({
                type: 'service.register',
                machine: stringifyMachine(service.behavior, options?.serialize),
                state: stringifyState(
                  service.getSnapshot(),
                  options?.serialize
                ),
                sessionId: service.sessionId
              });
            });
          }
        ]
      }
    }
  });
}
