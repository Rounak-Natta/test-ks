// controllers/analyticsController.js
import Billing from "../models/BillingModel.js";

export const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, orderType } = req.query;

    // -------------------------------
    // Date range filter
    // -------------------------------
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const match = {
      orderStatus: "paid",
      createdAt: { $gte: start, $lte: end },
    };

    if (orderType && orderType !== "all") {
      match.orderType = orderType;
    }

    // -------------------------------
    // Total sales summary
    // -------------------------------
    const totalSalesAgg = await Billing.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: "$total" },
          totalTax: { $sum: "$taxAmount" },
          totalDiscount: { $sum: "$discountAmount" },
          totalServiceCharge: { $sum: "$serviceCharge" },
        },
      },
    ]);

    // -------------------------------
    // Sales by day
    // -------------------------------
    const salesByDay = await Billing.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // -------------------------------
    // Sales by hour
    // -------------------------------
    const salesByHour = await Billing.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $hour: "$createdAt" },
          total: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // -------------------------------
    // Order type split
    // -------------------------------
    const orderTypeSplit = await Billing.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$orderType",
          total: { $sum: 1 },
        },
      },
    ]);

    // -------------------------------
    // Payment mode split
    // -------------------------------
    const paymentModeSplit = await Billing.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: 1 },
        },
      },
    ]);

    // -------------------------------
    // Top 10 items by revenue
    // -------------------------------
    const topItemsAgg = await Billing.aggregate([
      { $match: match },
      { $unwind: "$cart" },
      {
        $group: {
          _id: "$cart.itemName",
          revenue: { $sum: "$cart.total" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    return res.json({
      success: true,
      data: {
        totalSales: totalSalesAgg,
        salesByDay,
        salesByHour,
        orderTypeSplit,
        paymentModeSplit,
        topItems: topItemsAgg,
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
