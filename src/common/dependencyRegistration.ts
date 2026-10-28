import "reflect-metadata";
import tsyringe from "tsyringe";
import type {
  DependencyContainer,
  FactoryProvider,
  InjectionToken,
  ValueProvider,
} from "tsyringe";

export interface InjectionObject<T> {
  token: InjectionToken<T>;
  provider: ValueProvider<T> | FactoryProvider<T>;
}

export function registerDependencies(
  dependencies: InjectionObject<unknown>[],
  overrides: InjectionObject<unknown>[] = [],
): DependencyContainer {
  const container = tsyringe.container.createChildContainer();

  for (const dependency of [...dependencies, ...overrides]) {
    if ("useValue" in dependency.provider) {
      container.registerInstance(
        dependency.token,
        dependency.provider.useValue,
      );
    } else {
      container.register(dependency.token, dependency.provider);
    }
  }

  return container;
}

export const cachedFactory = tsyringe.instancePerContainerCachingFactory;
