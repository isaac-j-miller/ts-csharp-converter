export const capitalize = (str: string): string => {
  const [first, ...rest] = str;
  return [first.toLocaleUpperCase(), ...rest].join();
};
