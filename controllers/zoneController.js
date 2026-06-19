import { Zone } from "../models/zoneModel.js";

export const getZones = async (req, res) => {
  const zones = await Zone.find();
  res.json({ success: true, zones });
};

export const createZone = async (req, res) => {
  const zone = await Zone.create(req.body);
  res.json({ success: true, zone });
};