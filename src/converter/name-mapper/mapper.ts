import { getNameMapper } from "./factory";
import {
  NameMapperConfig,
  NameType,
  NameMapperFunction,
  CasedString,
  CasingConvention,
} from "./types";

type MapperMap = {
  [K in NameType]: NameMapperFunction;
};

export class NameMapper {
  private mappers: MapperMap;
  constructor(config: NameMapperConfig) {
    this.mappers = Object.keys(NameType)
      .filter((v) => !isNaN(Number(v)))
      .reduce((acc, curr) => {
        const asNameType = Number.parseInt(curr) as NameType;
        const transform = config.transforms[asNameType];
        const { input, output } = transform;
        acc[asNameType] = getNameMapper(input, output);
        return acc;
      }, {} as MapperMap);
  }
  transform(name: string, nameType: NameType): string {
    const mapperFn = this.mappers[nameType];
    const mapped = mapperFn(name as unknown as CasedString<CasingConvention>);
    return mapped.toString();
  }
}
