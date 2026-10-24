export const fields = {
  cvr: "CVR",
  name: "Virksomhedsnavn",
  website: "Hjemmeside",
  city: "By",
  industry: "Branche",
  employees: "Ansatte",
  revenue: "Omsætning (DKK)",
  country: "Land",
};
export type Field = keyof typeof fields;
export type Mapping = Partial<Record<Field, string>>;
