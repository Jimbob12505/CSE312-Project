import { type RouteConfig } from "@react-router/dev/routes";

export default [
  {
    path: "/",
    file: "routes/home.tsx"
  },
  {
    path: "/login",
    file: "routes/login.tsx"
  },
  {
    path: "/game",
    file: "routes/game.tsx"
  }
] satisfies RouteConfig;