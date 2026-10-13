import next from "eslint-config-next/core-web-vitals";
export default [
  ...next,
  {
    // React compiler is not enabled in this Next 15 project. Keep standard hook rules.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
];
