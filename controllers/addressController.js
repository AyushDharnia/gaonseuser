import { Address } from "../models/addressModel.js";

export const addAddress = async (req, res) => {
  const address = await Address.create({
    ...req.body,
    user: req.user._id,
  });

  res.json({ success: true, address });
};

export const getMyAddresses = async (req, res) => {
  const addresses = await Address.find({ user: req.user._id });

  res.json({ success: true, addresses });
};