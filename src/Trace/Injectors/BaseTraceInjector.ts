import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { context, Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { Constants } from '../../Constants';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { Controller, Injectable, Provider } from '@nestjs/common/interfaces';
import { PATH_METADATA } from '@nestjs/common/constants';
import { RESOLVER_TYPE_METADATA } from '@nestjs/graphql';

export class BaseTraceInjector {
  protected readonly metadataScanner: MetadataScanner = new MetadataScanner();

  constructor(protected readonly modulesContainer: ModulesContainer) {}

  protected *getControllers(): Generator<InstanceWrapper<Controller>> {
    for (const module of this.modulesContainer.values()) {
      for (const controller of module.controllers.values()) {
        if (
          controller &&
          controller.metatype?.prototype &&
          controller.name !== 'HealthController'
        ) {
          yield controller as InstanceWrapper<Controller>;
        }
      }
    }
  }

  protected *getResolvers(): Generator<InstanceWrapper<Provider>> {
    for (const module of this.modulesContainer.values()) {
      for (const provider of module.providers.values()) {
        if (
          provider &&
          provider.metatype?.prototype &&
          Reflect.hasMetadata(RESOLVER_TYPE_METADATA, provider.metatype)
        ) {
          yield provider as InstanceWrapper<Provider>;
        }
      }
    }
  }

  protected *getProviders(): Generator<InstanceWrapper<Injectable>> {
    for (const module of this.modulesContainer.values()) {
      for (const provider of module.providers.values()) {
        if (provider && provider.metatype?.prototype) {
          yield provider as InstanceWrapper<Injectable>;
        }
      }
    }
  }

  protected isPath(prototype): boolean {
    return Reflect.hasMetadata(PATH_METADATA, prototype);
  }

  protected isAffected(prototype): boolean {
    return Reflect.hasMetadata(Constants.TRACE_METADATA_ACTIVE, prototype);
  }

  protected getTraceName(prototype): string {
    return Reflect.getMetadata(Constants.TRACE_METADATA, prototype);
  }

  protected isDecorated(prototype): boolean {
    return Reflect.hasMetadata(Constants.TRACE_METADATA, prototype);
  }

  protected reDecorate(source, destination) {
    const keys = Reflect.getMetadataKeys(source);

    for (const key of keys) {
      const meta = Reflect.getMetadata(key, source);
      Reflect.defineMetadata(key, meta, destination);
    }
  }

  protected methodWrappers() {
    const safeForStringify = (value: any, safeDepth = 1) => {
      if (Array.isArray(value) && safeDepth > 0)
        return value.map((v) => safeForStringify(v, safeDepth - 1));
      if (typeof value === 'object' && safeDepth > 0)
        return Object.entries(value).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: safeForStringify(value, safeDepth - 1),
          }),
          {},
        );

      try {
        JSON.stringify(value);
        return value;
      } catch (error) {
        return `Otel Parse Error: ${error.message}`;
      }
    };

    return {
      preCall: (span, args) =>
        span.setAttribute(
          `method.args`,
          JSON.stringify(safeForStringify(args)),
        ),
      postCall: (span, _, result) =>
        span.setAttribute(
          `method.result`,
          JSON.stringify(safeForStringify(result)),
        ),
    };
  }

  protected wrap(
    prototype: Record<any, any>,
    traceName: string,
    attributes = {},
    methods?: {
      preCall?: (span: Span, args: any[]) => void;
      postCall?: (span: Span, args: any[], result: any) => void;
    },
  ) {
    const method = {
      [prototype.name]: function (...args: any[]) {
        const tracer = trace.getTracer(`default`);
        const currentSpan = tracer.startSpan(traceName);

        return context.with(
          trace.setSpan(context.active(), currentSpan),
          () => {
            if (methods?.preCall) methods.preCall(currentSpan, args);
            currentSpan.setAttributes(attributes);
            if (prototype.constructor.name === `AsyncFunction`) {
              return prototype
                .apply(this, args)
                .then((result: any) => {
                  if (methods?.postCall)
                    methods.postCall(currentSpan, args, result);
                  return result;
                })
                .catch((error: any) =>
                  BaseTraceInjector.recordException(error, currentSpan),
                )
                .finally(() => {
                  currentSpan.end();
                });
            } else {
              try {
                const result = prototype.apply(this, args);
                if (methods?.postCall)
                  methods.postCall(currentSpan, args, result);
                currentSpan.end();
                return result;
              } catch (error) {
                BaseTraceInjector.recordException(error, currentSpan);
              } finally {
                currentSpan.end();
              }
            }
          },
        );
      },
    }[prototype.name];

    Reflect.defineMetadata(Constants.TRACE_METADATA, traceName, method);
    this.affect(method);
    this.reDecorate(prototype, method);

    return method;
  }

  protected static recordException(error, span: Span) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  }

  protected affect(prototype) {
    Reflect.defineMetadata(Constants.TRACE_METADATA_ACTIVE, 1, prototype);
  }
}
