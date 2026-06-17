import type { Express, Request, Response } from "express";
import { db } from "../../db/index";
import { 
  finBankAccounts, 
  finPaymentMethods, 
  finPaymentPlans, 
  finCashFlowCategories,
  finAccountsPayable,
  finAccountsReceivable,
  finTransactions
} from "@shared/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

export function registerFinanceiroRoutes(app: Express): void {
  
  // ========== BANK ACCOUNTS ==========
  app.get("/api/financeiro/bank-accounts", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const result = await db.select().from(finBankAccounts)
        .where(eq(finBankAccounts.tenantId, tenantId))
        .orderBy(desc(finBankAccounts.id));
      res.json(result);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      res.status(500).json({ error: "Failed to fetch bank accounts" });
    }
  });

  app.post("/api/financeiro/bank-accounts", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...data } = req.body;
      const [account] = await db.insert(finBankAccounts).values({
        tenantId,
        ...data,
        currentBalance: data.initialBalance || "0"
      }).returning();
      res.status(201).json(account);
    } catch (error) {
      console.error("Error creating bank account:", error);
      res.status(500).json({ error: "Failed to create bank account" });
    }
  });

  app.put("/api/financeiro/bank-accounts/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...updateData } = req.body;
      const [updated] = await db.update(finBankAccounts)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(finBankAccounts.id, id), eq(finBankAccounts.tenantId, tenantId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Bank account not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating bank account:", error);
      res.status(500).json({ error: "Failed to update bank account" });
    }
  });

  app.delete("/api/financeiro/bank-accounts/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      await db.delete(finBankAccounts).where(and(eq(finBankAccounts.id, id), eq(finBankAccounts.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bank account:", error);
      res.status(500).json({ error: "Failed to delete bank account" });
    }
  });

  // ========== PAYMENT METHODS ==========
  app.get("/api/financeiro/payment-methods", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const result = await db.select().from(finPaymentMethods)
        .where(eq(finPaymentMethods.tenantId, tenantId))
        .orderBy(desc(finPaymentMethods.id));
      res.json(result);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  app.post("/api/financeiro/payment-methods", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...data } = req.body;
      const [method] = await db.insert(finPaymentMethods).values({ tenantId, ...data }).returning();
      res.status(201).json(method);
    } catch (error) {
      console.error("Error creating payment method:", error);
      res.status(500).json({ error: "Failed to create payment method" });
    }
  });

  app.put("/api/financeiro/payment-methods/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...updateData } = req.body;
      const [updated] = await db.update(finPaymentMethods)
        .set(updateData)
        .where(and(eq(finPaymentMethods.id, id), eq(finPaymentMethods.tenantId, tenantId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Payment method not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating payment method:", error);
      res.status(500).json({ error: "Failed to update payment method" });
    }
  });

  app.delete("/api/financeiro/payment-methods/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      await db.delete(finPaymentMethods).where(and(eq(finPaymentMethods.id, id), eq(finPaymentMethods.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payment method:", error);
      res.status(500).json({ error: "Failed to delete payment method" });
    }
  });

  // ========== PAYMENT PLANS ==========
  app.get("/api/financeiro/payment-plans", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const result = await db.select().from(finPaymentPlans)
        .where(eq(finPaymentPlans.tenantId, tenantId))
        .orderBy(desc(finPaymentPlans.id));
      res.json(result);
    } catch (error) {
      console.error("Error fetching payment plans:", error);
      res.status(500).json({ error: "Failed to fetch payment plans" });
    }
  });

  app.post("/api/financeiro/payment-plans", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...data } = req.body;
      const [plan] = await db.insert(finPaymentPlans).values({ tenantId, ...data }).returning();
      res.status(201).json(plan);
    } catch (error) {
      console.error("Error creating payment plan:", error);
      res.status(500).json({ error: "Failed to create payment plan" });
    }
  });

  app.put("/api/financeiro/payment-plans/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...updateData } = req.body;
      const [updated] = await db.update(finPaymentPlans)
        .set(updateData)
        .where(and(eq(finPaymentPlans.id, id), eq(finPaymentPlans.tenantId, tenantId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Payment plan not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating payment plan:", error);
      res.status(500).json({ error: "Failed to update payment plan" });
    }
  });

  app.delete("/api/financeiro/payment-plans/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      await db.delete(finPaymentPlans).where(and(eq(finPaymentPlans.id, id), eq(finPaymentPlans.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payment plan:", error);
      res.status(500).json({ error: "Failed to delete payment plan" });
    }
  });

  // ========== CASH FLOW CATEGORIES ==========
  app.get("/api/financeiro/categories", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const result = await db.select().from(finCashFlowCategories)
        .where(eq(finCashFlowCategories.tenantId, tenantId))
        .orderBy(finCashFlowCategories.code);
      res.json(result);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/financeiro/categories", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...data } = req.body;
      const [category] = await db.insert(finCashFlowCategories).values({ tenantId, ...data }).returning();
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/financeiro/categories/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...updateData } = req.body;
      const [updated] = await db.update(finCashFlowCategories)
        .set(updateData)
        .where(and(eq(finCashFlowCategories.id, id), eq(finCashFlowCategories.tenantId, tenantId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/financeiro/categories/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      await db.delete(finCashFlowCategories).where(and(eq(finCashFlowCategories.id, id), eq(finCashFlowCategories.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // ========== ACCOUNTS PAYABLE ==========
  app.get("/api/financeiro/payables", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { status, startDate, endDate } = req.query;
      
      let query = db.select().from(finAccountsPayable)
        .where(eq(finAccountsPayable.tenantId, tenantId))
        .orderBy(desc(finAccountsPayable.dueDate));
      
      const result = await query;
      res.json(result);
    } catch (error) {
      console.error("Error fetching payables:", error);
      res.status(500).json({ error: "Failed to fetch payables" });
    }
  });

  app.post("/api/financeiro/payables", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...data } = req.body;
      const [payable] = await db.insert(finAccountsPayable).values({
        tenantId,
        ...data,
        remainingAmount: data.originalAmount
      }).returning();
      res.status(201).json(payable);
    } catch (error) {
      console.error("Error creating payable:", error);
      res.status(500).json({ error: "Failed to create payable" });
    }
  });

  app.put("/api/financeiro/payables/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...updateData } = req.body;
      const [updated] = await db.update(finAccountsPayable)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(finAccountsPayable.id, id), eq(finAccountsPayable.tenantId, tenantId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Payable not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating payable:", error);
      res.status(500).json({ error: "Failed to update payable" });
    }
  });

  app.delete("/api/financeiro/payables/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      await db.delete(finAccountsPayable).where(and(eq(finAccountsPayable.id, id), eq(finAccountsPayable.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payable:", error);
      res.status(500).json({ error: "Failed to delete payable" });
    }
  });

  // Pay a payable
  app.post("/api/financeiro/payables/:id/pay", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { amount, bankAccountId, paymentMethodId, paymentDate } = req.body;

      const [payable] = await db.select().from(finAccountsPayable)
        .where(and(eq(finAccountsPayable.id, id), eq(finAccountsPayable.tenantId, tenantId)));

      if (!payable) {
        return res.status(404).json({ error: "Payable not found" });
      }

      const paidAmount = parseFloat(payable.paidAmount || "0") + parseFloat(amount);
      const remaining = parseFloat(payable.originalAmount) - paidAmount + parseFloat(payable.interestAmount || "0") + parseFloat(payable.fineAmount || "0") - parseFloat(payable.discountAmount || "0");
      const newStatus = remaining <= 0 ? "paid" : "partial";

      const [updated] = await db.update(finAccountsPayable)
        .set({
          paidAmount: paidAmount.toString(),
          remainingAmount: Math.max(0, remaining).toString(),
          status: newStatus,
          paidAt: newStatus === "paid" ? new Date() : null,
          bankAccountId,
          paymentMethodId,
          updatedAt: new Date()
        })
        .where(and(eq(finAccountsPayable.id, id), eq(finAccountsPayable.tenantId, tenantId)))
        .returning();

      if (bankAccountId) {
        const [bankAccount] = await db.select().from(finBankAccounts)
          .where(eq(finBankAccounts.id, bankAccountId));
        
        if (bankAccount) {
          const newBalance = parseFloat(bankAccount.currentBalance || "0") - parseFloat(amount);
          
          await db.insert(finTransactions).values({
            tenantId,
            bankAccountId,
            type: "debit",
            amount: amount,
            balanceAfter: newBalance.toString(),
            transactionDate: paymentDate || new Date().toISOString().split('T')[0],
            description: `Pagamento: ${payable.description || payable.documentNumber}`,
            payableId: id
          });

          await db.update(finBankAccounts)
            .set({ currentBalance: newBalance.toString(), updatedAt: new Date() })
            .where(eq(finBankAccounts.id, bankAccountId));
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Error paying payable:", error);
      res.status(500).json({ error: "Failed to process payment" });
    }
  });

  // ========== ACCOUNTS RECEIVABLE ==========
  app.get("/api/financeiro/receivables", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const result = await db.select().from(finAccountsReceivable)
        .where(eq(finAccountsReceivable.tenantId, tenantId))
        .orderBy(desc(finAccountsReceivable.dueDate));
      res.json(result);
    } catch (error) {
      console.error("Error fetching receivables:", error);
      res.status(500).json({ error: "Failed to fetch receivables" });
    }
  });

  app.post("/api/financeiro/receivables", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...data } = req.body;
      const [receivable] = await db.insert(finAccountsReceivable).values({
        tenantId,
        ...data,
        remainingAmount: data.originalAmount
      }).returning();
      res.status(201).json(receivable);
    } catch (error) {
      console.error("Error creating receivable:", error);
      res.status(500).json({ error: "Failed to create receivable" });
    }
  });

  app.put("/api/financeiro/receivables/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...updateData } = req.body;
      const [updated] = await db.update(finAccountsReceivable)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(finAccountsReceivable.id, id), eq(finAccountsReceivable.tenantId, tenantId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Receivable not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating receivable:", error);
      res.status(500).json({ error: "Failed to update receivable" });
    }
  });

  app.delete("/api/financeiro/receivables/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      await db.delete(finAccountsReceivable).where(and(eq(finAccountsReceivable.id, id), eq(finAccountsReceivable.tenantId, tenantId)));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting receivable:", error);
      res.status(500).json({ error: "Failed to delete receivable" });
    }
  });

  // Receive payment
  app.post("/api/financeiro/receivables/:id/receive", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const id = parseInt(req.params.id);
      const tenantId = req.user?.tenantId || 1;
      const { amount, bankAccountId, paymentMethodId, receiveDate } = req.body;

      const [receivable] = await db.select().from(finAccountsReceivable)
        .where(and(eq(finAccountsReceivable.id, id), eq(finAccountsReceivable.tenantId, tenantId)));

      if (!receivable) {
        return res.status(404).json({ error: "Receivable not found" });
      }

      const receivedAmount = parseFloat(receivable.receivedAmount || "0") + parseFloat(amount);
      const remaining = parseFloat(receivable.originalAmount) - receivedAmount + parseFloat(receivable.interestAmount || "0") + parseFloat(receivable.fineAmount || "0") - parseFloat(receivable.discountAmount || "0");
      const newStatus = remaining <= 0 ? "received" : "partial";

      const [updated] = await db.update(finAccountsReceivable)
        .set({
          receivedAmount: receivedAmount.toString(),
          remainingAmount: Math.max(0, remaining).toString(),
          status: newStatus,
          receivedAt: newStatus === "received" ? new Date() : null,
          bankAccountId,
          paymentMethodId,
          updatedAt: new Date()
        })
        .where(and(eq(finAccountsReceivable.id, id), eq(finAccountsReceivable.tenantId, tenantId)))
        .returning();

      if (bankAccountId) {
        const [bankAccount] = await db.select().from(finBankAccounts)
          .where(eq(finBankAccounts.id, bankAccountId));
        
        if (bankAccount) {
          const newBalance = parseFloat(bankAccount.currentBalance || "0") + parseFloat(amount);
          
          await db.insert(finTransactions).values({
            tenantId,
            bankAccountId,
            type: "credit",
            amount: amount,
            balanceAfter: newBalance.toString(),
            transactionDate: receiveDate || new Date().toISOString().split('T')[0],
            description: `Recebimento: ${receivable.description || receivable.documentNumber}`,
            receivableId: id
          });

          await db.update(finBankAccounts)
            .set({ currentBalance: newBalance.toString(), updatedAt: new Date() })
            .where(eq(finBankAccounts.id, bankAccountId));
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Error receiving payment:", error);
      res.status(500).json({ error: "Failed to process receipt" });
    }
  });

  // ========== TRANSACTIONS ==========
  app.get("/api/financeiro/transactions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { bankAccountId } = req.query;
      
      let conditions = [eq(finTransactions.tenantId, tenantId)];
      if (bankAccountId) {
        conditions.push(eq(finTransactions.bankAccountId, parseInt(bankAccountId as string)));
      }
      
      const result = await db.select().from(finTransactions)
        .where(and(...conditions))
        .orderBy(desc(finTransactions.transactionDate), desc(finTransactions.id));
      res.json(result);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/financeiro/transactions", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { tenantId: _, ...data } = req.body;

      const [bankAccount] = await db.select().from(finBankAccounts)
        .where(eq(finBankAccounts.id, data.bankAccountId));

      if (!bankAccount) {
        return res.status(404).json({ error: "Bank account not found" });
      }

      const currentBalance = parseFloat(bankAccount.currentBalance || "0");
      const amount = parseFloat(data.amount);
      const newBalance = data.type === "credit" ? currentBalance + amount : currentBalance - amount;

      const [transaction] = await db.insert(finTransactions).values({
        tenantId,
        ...data,
        balanceAfter: newBalance.toString()
      }).returning();

      await db.update(finBankAccounts)
        .set({ currentBalance: newBalance.toString(), updatedAt: new Date() })
        .where(eq(finBankAccounts.id, data.bankAccountId));

      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  // ========== DASHBOARD / SUMMARY ==========
  app.get("/api/financeiro/dashboard", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;

      const bankAccounts = await db.select().from(finBankAccounts)
        .where(and(eq(finBankAccounts.tenantId, tenantId), eq(finBankAccounts.isActive, true)));

      const totalBalance = bankAccounts.reduce((sum, acc) => sum + parseFloat(acc.currentBalance || "0"), 0);

      const payables = await db.select().from(finAccountsPayable)
        .where(and(eq(finAccountsPayable.tenantId, tenantId), eq(finAccountsPayable.status, "pending")));

      const totalPayables = payables.reduce((sum, p) => sum + parseFloat(p.remainingAmount || "0"), 0);
      const overduePayables = payables.filter(p => new Date(p.dueDate) < new Date()).length;

      const receivables = await db.select().from(finAccountsReceivable)
        .where(and(eq(finAccountsReceivable.tenantId, tenantId), eq(finAccountsReceivable.status, "pending")));

      const totalReceivables = receivables.reduce((sum, r) => sum + parseFloat(r.remainingAmount || "0"), 0);
      const overdueReceivables = receivables.filter(r => new Date(r.dueDate) < new Date()).length;

      res.json({
        totalBalance,
        bankAccounts: bankAccounts.length,
        totalPayables,
        payablesCount: payables.length,
        overduePayables,
        totalReceivables,
        receivablesCount: receivables.length,
        overdueReceivables,
        projectedBalance: totalBalance - totalPayables + totalReceivables
      });
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // Transfer between accounts
  app.post("/api/financeiro/transfers", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const tenantId = req.user?.tenantId || 1;
      const { fromAccountId, toAccountId, amount, description, transferDate } = req.body;

      if (fromAccountId === toAccountId) {
        return res.status(400).json({ error: "Cannot transfer to same account" });
      }

      const [fromAccount] = await db.select().from(finBankAccounts)
        .where(and(eq(finBankAccounts.id, fromAccountId), eq(finBankAccounts.tenantId, tenantId)));
      const [toAccount] = await db.select().from(finBankAccounts)
        .where(and(eq(finBankAccounts.id, toAccountId), eq(finBankAccounts.tenantId, tenantId)));

      if (!fromAccount || !toAccount) {
        return res.status(404).json({ error: "Account not found" });
      }

      const fromBalance = parseFloat(fromAccount.currentBalance || "0") - parseFloat(amount);
      const toBalance = parseFloat(toAccount.currentBalance || "0") + parseFloat(amount);

      await db.insert(finTransactions).values({
        tenantId,
        bankAccountId: fromAccountId,
        type: "debit",
        amount: amount,
        balanceAfter: fromBalance.toString(),
        transactionDate: transferDate || new Date().toISOString().split('T')[0],
        description: `Transferência para ${toAccount.name}: ${description || ''}`,
        transferToId: toAccountId
      });

      await db.insert(finTransactions).values({
        tenantId,
        bankAccountId: toAccountId,
        type: "credit",
        amount: amount,
        balanceAfter: toBalance.toString(),
        transactionDate: transferDate || new Date().toISOString().split('T')[0],
        description: `Transferência de ${fromAccount.name}: ${description || ''}`,
        transferFromId: fromAccountId
      });

      await db.update(finBankAccounts)
        .set({ currentBalance: fromBalance.toString(), updatedAt: new Date() })
        .where(eq(finBankAccounts.id, fromAccountId));

      await db.update(finBankAccounts)
        .set({ currentBalance: toBalance.toString(), updatedAt: new Date() })
        .where(eq(finBankAccounts.id, toAccountId));

      res.json({ success: true, fromBalance, toBalance });
    } catch (error) {
      console.error("Error processing transfer:", error);
      res.status(500).json({ error: "Failed to process transfer" });
    }
  });
}
