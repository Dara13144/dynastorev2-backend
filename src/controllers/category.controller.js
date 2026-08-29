import { db } from '../utils/db.js';

export const getAllCategories = async (req, res, next) => {
  try {
    const categories = await db.getCategories();
    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    next(error);
  }
};
