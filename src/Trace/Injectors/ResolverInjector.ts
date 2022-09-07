import { Injectable, Logger } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { BaseTraceInjector } from './BaseTraceInjector';
import { Injector } from './Injector';

@Injectable()
export class ResolverInjector extends BaseTraceInjector implements Injector {
  private readonly loggerService = new Logger();

  constructor(protected readonly modulesContainer: ModulesContainer) {
    super(modulesContainer);
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
            this.methodWrappers(),
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
