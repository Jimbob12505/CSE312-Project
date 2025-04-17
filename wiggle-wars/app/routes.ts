import { type RouteConfig, index } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    index("login","routes/login.tsx")
] satisfies RouteConfig;
