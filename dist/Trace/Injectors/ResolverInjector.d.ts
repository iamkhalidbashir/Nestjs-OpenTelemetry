import { Provider } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { BaseTraceInjector } from './BaseTraceInjector';
import { Injector } from './Injector';
export declare class ResolverInjector extends BaseTraceInjector implements Injector {
    protected readonly modulesContainer: ModulesContainer;
    private readonly loggerService;
    constructor(modulesContainer: ModulesContainer);
    protected getResolvers(): Generator<InstanceWrapper<Provider>>;
    inject(): void;
}
