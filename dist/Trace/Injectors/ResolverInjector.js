"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolverInjector = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const graphql_constants_1 = require("@nestjs/graphql/dist/graphql.constants");
const BaseTraceInjector_1 = require("./BaseTraceInjector");
let ResolverInjector = class ResolverInjector extends BaseTraceInjector_1.BaseTraceInjector {
    modulesContainer;
    loggerService = new common_1.Logger();
    constructor(modulesContainer) {
        super(modulesContainer);
        this.modulesContainer = modulesContainer;
    }
    *getResolvers() {
        for (const module of this.modulesContainer.values()) {
            for (const provider of module.providers.values()) {
                if (provider &&
                    provider.metatype?.prototype &&
                    Reflect.hasMetadata(graphql_constants_1.RESOLVER_TYPE_METADATA, provider.metatype)) {
                    yield provider;
                }
            }
        }
    }
    inject() {
        const resolvers = this.getResolvers();
        for (const resolver of resolvers) {
            const keys = this.metadataScanner.getAllFilteredMethodNames(resolver.metatype.prototype);
            for (const key of keys) {
                if (!this.isDecorated(resolver.metatype.prototype[key]) &&
                    !this.isAffected(resolver.metatype.prototype[key])) {
                    const traceName = `Resolver->${resolver.name}.${resolver.metatype.prototype[key].name}`;
                    const method = this.wrap(resolver.metatype.prototype[key], traceName, {
                        resolver: resolver.name,
                        method: resolver.metatype.prototype[key].name,
                    }, {
                        preCall: (span, args) => span.setAttribute(`method.args`, JSON.stringify(args)),
                        postCall: (span, _, result) => span.setAttribute(`method.result`, JSON.stringify(result)),
                    });
                    this.reDecorate(resolver.metatype.prototype[key], method);
                    resolver.metatype.prototype[key] = method;
                    this.loggerService.log(`Mapped ${resolver.name}.${key}`, this.constructor.name);
                }
            }
        }
    }
};
ResolverInjector = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ModulesContainer])
], ResolverInjector);
exports.ResolverInjector = ResolverInjector;
//# sourceMappingURL=ResolverInjector.js.map