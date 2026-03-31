import { Router, type IRouter } from "express";
import healthRouter from "./health";
import botRouter from "./bot";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/bot", botRouter);
router.use("/stats", statsRouter);

export default router;
