import { Router } from "express";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { db } from "../db";

const router = Router();

router.get("/api/users", async (req, res) => {
  const users = await db.select().from("users");
  res.status(200).json(users);
});

router.post("/api/users", async (req, res) => {
  const parsed = insertUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.format());
  }
  const newUser = parsed.data;
  await db.insert().into("users").values(newUser);
  res.status(201).json({ message: "User created" });
});

router.patch("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  await db.update("users").set({ name, email }).where({ id });
  res.status(200).json({ message: "User updated" });
});

router.delete("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  await db.delete().from("users").where({ id });
  res.status(204).send();
});

router.post("/api/users/:userId/roles", async (req, res) => {
  const { userId } = req.params;
  const { roleId } = req.body;
  await db.insert().into("userRoles").values({ userId, roleId });
  res.status(204).send();
});

router.delete("/api/users/:userId/roles/:roleId", async (req, res) => {
  const { userId, roleId } = req.params;
  await db.delete().from("userRoles").where({ userId, roleId });
  res.status(204).send();
});

export default router;