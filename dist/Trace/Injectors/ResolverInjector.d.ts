import { ModulesContainer } from '@nestjs/core';
import { BaseTraceInjector } from './BaseTraceInjector';
import { Injector } from './Injector';
export declare class ResolverInjector extends BaseTraceInjector implements Injector {
    protected readonly modulesContainer: ModulesContainer;
    private readonly loggerService;
    constructor(modulesContainer: ModulesContainer);
    inject(): void;
}
