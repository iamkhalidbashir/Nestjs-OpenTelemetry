import { Injectable, Logger, Provider } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { RESOLVER_TYPE_METADATA } from '@nestjs/graphql/dist/graphql.constants';
import { BaseTraceInjector } from './BaseTraceInjector';
import { Injector } from './Injector';

@Injectable()
export class ResolverInjector extends BaseTraceInjector implements Injector {
  private readonly loggerService = new Logger();

  constructor(protected readonly modulesContainer: ModulesContainer) {
    super(modulesContainer);
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

  public inject() {
    const resolvers = this.getResolvers();
    for (const resolver of resolvers) {
      const keys = this.metadataScanner.getAllFilteredMethodNames(
        resolver.metatype.prototype,
      );
      for (const key of keys) {
        if (
          !this.isDecorated(resolver.metatype.prototype[key]) &&
          !this.isAffected(resolver.metatype.prototype[key])
        ) {
          const traceName = `Resolver->${resolver.name}.${resolver.metatype.prototype[key].name}`;
          const method = this.wrap(
            resolver.metatype.prototype[key],
            traceName,
            {
              resolver: resolver.name,
              method: resolver.metatype.prototype[key].name,
            },
          );
          this.reDecorate(resolver.metatype.prototype[key], method);
          resolver.metatype.prototype[key] = method;
          this.loggerService.log(
            `Mapped ${resolver.name}.${key}`,
            this.constructor.name,
          );
        }
      }
    }
  }
}
