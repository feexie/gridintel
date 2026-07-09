export interface Partner {
  id: string;
  name: string;
  logo: string;
  website?: string;
}

export const partners: Partner[] = [
  {
    id: "greenmaple",
    name: "GreenMaple Energy",
    logo: "/images/partners/greenmaple.png",
  },

  {
    id: "yedc",
    name: "Yola Electricity Distribution Company",
    logo: "/images/partners/yedc.png",
  },

  {
    id: "rea",
    name: "Rural Electrification Agency",
    logo: "/images/partners/rea.png",
  },

  {
    id: "gve",
    name: "GVE Projects",
    logo: "/images/partners/gve.png",
  },

  {
    id: "nsia",
    name: "NSIA",
    logo: "/images/partners/nsia.png",
  },

  {
    id: "jica",
    name: "JICA",
    logo: "/images/partners/jica.png",
  },
];
