const oldPalette = {
  brand: {
    100: "#FFEDEB",
    200: "#FFC5BF",
    300: "#FF8B7B",
    400: "#F34900", // Acre Orange
    500: "#B53400",
    600: "#7A2000",
    700: "#450E00",
  },
  gold: {
    100: "#FBF7EC",
    200: "#F8EFDA",
    300: "#F3E5C1", // Acre Dust
    400: "#EDD8A2",
    500: "#EACF88",
    600: "#E2B950",
    700: "#D69B04", // Acre Wheat
  },
  green: {
    100: "#D6F2CE",
    200: "#AFE7A1",
    300: "#79CA52",
    400: "#43AD02", // Acre Grass
    500: "#318401",
    600: "#205C01",
    700: "#103800",
  },
  blue: {
    100: "#EEF0FF",
    200: "#CDD4FE",
    300: "#9AAAFD",
    400: "#5E80FC",
    500: "#1059E6", // Acre Aqua
    600: "#073B9E",
    700: "#021F5C",
  },
  red: {
    100: "#FDDADA",
    200: "#FAA3A4",
    300: "#F86165",
    400: "#DA1E28",
    500: "#9A1219",
    600: "#5F070B",
    700: "#2B0102",
  },
  grey: {
    100: "#F1F0F1",
    200: "#D3D0D1",
    300: "#AFA8A9",
    400: "#8D8184",
    500: "#675E60",
    600: "#443D3F",
    700: "#231F20", // Acre Dirt
  },
  opacity: {
    white: {
      1: "rgba(255, 255, 255, 0.10)",
      5: "rgba(255, 255, 255, 0.50)",
      6: "rgba(255, 255, 255, 0.60)",
    },
    grey: {
      700: {
        "05": "rgba(35, 31, 32, 0.05)",
      },
    },
    gold: {
      300: {
        "75": "rgba(243, 229, 193, 0.75)",
      },
    },
    black: {
      "05": "rgba(0, 0, 0, 0.05)",
      15: "rgba(0, 0, 0, 0.15)",
    },
    green: {
      50: {
        15: "rgba(51, 163, 33, 0.15)",
      },
    },
    orange: {
      50: {
        15: "rgba(255, 122, 0, 0.15)",
      },
    },
    blue: {
      "01": "rgba(14, 97, 254, 0.1)",
    },
  },
}

const primary = {
  acre: {
    50: "#F34900",
    60: "#D54000",
    70: "#B73700",
    80: "#7A2500",
  },
  ink: {
    50: "#4E01F3",
    60: "#4601D9",
    70: "#3B01B7",
    80: "#27007A",
  },
  flower: {
    30: "#C9A0FF",
  },
  ocean: {
    30: "#D7E9F1",
  },
  grass: {
    30: "#C3E8C3",
  },
}

const secondary = {
  ivoire: {
    "05": "#FFFDF9",
    10: "#FBF7EC",
    20: "#F8EFDA",
    30: "#F3E4BE",
    40: "#EDD8A2",
    50: "#E8CD87",
  },
  orange: {
    10: "#FCE4C9",
    30: "#FFBC80",
    50: "#FF7A00",
  },
  neutral: { 50: "#A0957F", 60: "#8E8169" },
  brown: {
    "05": "rgba(125, 106, 75, 0.05)",
    10: "rgba(125, 106, 75, 0.10)",
    20: "rgba(125, 106, 75, 0.15)",
    30: "rgba(125, 106, 75, 0.25)",
    40: "#B5AC9B",
    80: "#554C3F",
    90: "#38332A",
    100: "#1D1A15",
  },
}

const functional = {
  green: {
    10: "#D9F6D5",
    30: "#A1EA95",
    50: "#33A321",
  },
  yellow: {
    10: "#F6F1D2",
    30: "#FFDC80",
    50: "#FFBA07",
  },
  red: {
    10: "#FFDCDC",
    30: "#FF8085",
    50: "#FF1822",
  },
  blue: {
    10: "#CFE0FF",
    30: "#80ACFE",
    50: "#0E61FE",
  },
}

export default {
  oldPalette,
  ...primary,
  ...secondary,
  ...functional,
  text: {
    primary: secondary.brown["100"],
    secondary: secondary.brown["80"],
    tertiary: secondary.neutral["60"],
  },
  surface: {
    1: secondary.ivoire["05"],
    2: secondary.ivoire["10"],
    3: secondary.ivoire["20"],
    4: secondary.ivoire["30"],
    5: secondary.ivoire["40"],
    6: secondary.ivoire["50"],
  },
}
