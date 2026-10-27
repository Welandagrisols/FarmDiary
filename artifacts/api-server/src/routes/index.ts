import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { registerFarmWorkflowRoutes } from "./farm-workflows";
import { registerSoilRoutes } from "./soil-report";
import { supabaseAdmin } from "../lib/supabase-admin";

const router: IRouter = Router();

router.use(healthRouter);
registerFarmWorkflowRoutes(router);
registerSoilRoutes(router, supabaseAdmin);

export default router;
