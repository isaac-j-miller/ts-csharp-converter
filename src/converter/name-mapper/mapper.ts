import { getNameMapper } from "./factory";
import { formatForEnum } from "./mappers";
import { NameMapperConfig, NameType, NameMapperFunction, INameMapper } from "./types";

type MapperMap = {
  [K in NameType]: NameMapperFunction;
};

export class NameMapper implements INameMapper {
  private mappers: MapperMap;
  constructor(private config: NameMapperConfig) {
    this.mappers = Object.keys(NameType)
      .filter(v => !Number.isNaN(Number(v)))
      .reduce((acc, curr) => {
        const asNameType = Number.parseInt(curr, 10) as NameType;
        const transform = config.transforms[asNameType];
        const { output } = transform;
        acc[asNameType] = getNameMapper(output);
        return acc;
      }, {} as MapperMap);
  }
  transform(name: string, nameType: NameType): string {
    const mapperFn = this.mappers[nameType];
    const mapped = mapperFn(name, nameType);
    const asStr = mapped.toString();
    if (nameType === NameType.EnumMember) {
      return formatForEnum(asStr, this.config.transforms[nameType].output);
    }
    return asStr;
  }
}
