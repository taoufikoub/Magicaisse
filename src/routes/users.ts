import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users } from "../db/schema.ts";
import { AuthRequest, requireAuth, generateToken } from "../middleware/auth.ts";

const router = Router();

// Ensure owner user younes05 exists
const ensureDefaultOwner = async () => {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = 'younes05'`)
      .limit(1);

    if (existing.length === 0) {
      await db.insert(users).values({
        username: "younes05",
        password: "123456",
        uid: "younes05",
        name: "younes05",
        role: "owner",
        email: "younes05@toyshop.local",
      });
      console.log("[Auth Seed] Seeded default owner younes05 successfully!");
    }
  } catch (err) {
    console.error("[Auth Seed] Failed to ensure default owner:", err);
  }
};
ensureDefaultOwner();

// Staff authentication with username and password
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    const dbUsers = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${trimmedUsername})`)
      .limit(1);

    if (dbUsers.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const dbUser = dbUsers[0];
    if (dbUser.password !== trimmedPassword) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = generateToken({
      uid: dbUser.uid || dbUser.username || String(dbUser.id),
      email: dbUser.email || `${dbUser.username}@toyshop.local`,
      name: dbUser.name,
      role: dbUser.role as any,
    });

    res.json({
      token,
      user: {
        id: dbUser.id,
        uid: dbUser.uid,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/users/login:", error);
    res.status(500).json({ error: "Login failed: " + error.message });
  }
});

// Retrieve current logged-in staff profile
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const reqUser = req.user!;
    const dbUsers = await db
      .select()
      .from(users)
      .where(eq(users.uid, reqUser.uid))
      .limit(1);

    if (dbUsers.length > 0) {
      return res.json(dbUsers[0]);
    }

    return res.status(404).json({ error: "Staff profile not found in database" });
  } catch (error: any) {
    console.error("Error in GET /api/me:", error);
    res.status(500).json({ error: "Failed to fetch profile: " + error.message });
  }
});

// Retrieve list of all registered staff
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(users).orderBy(users.name);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch staff list: " + error.message });
  }
});

// Create a new staff account (Owner/Manager only)
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const requesterUid = req.user!.uid;
    const requester = await db
      .select()
      .from(users)
      .where(eq(users.uid, requesterUid))
      .limit(1);

    if (requester.length === 0 || (requester[0].role !== "owner" && requester[0].role !== "manager")) {
      return res.status(403).json({ error: "Only owners or managers can add new staff accounts" });
    }

    const { username, password, name, role, email } = req.body;
    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: "Username, password, name, and role are required" });
    }

    // Check if username already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const newUsers = await db
      .insert(users)
      .values({
        username,
        password,
        uid: username, // Sync uid and username so standard authentication queries match
        name,
        role,
        email: email || `${username}@toyshop.local`,
      })
      .returning();

    res.json(newUsers[0]);
  } catch (error: any) {
    console.error("Error creating staff account:", error);
    res.status(500).json({ error: "Failed to create staff account: " + error.message });
  }
});

// Edit a user's role
router.put("/:id/role", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const requesterUid = req.user!.uid;
    const requester = await db
      .select()
      .from(users)
      .where(eq(users.uid, requesterUid))
      .limit(1);

    if (requester.length === 0 || requester[0].role !== "owner") {
      return res.status(403).json({ error: "Only owners can modify staff roles" });
    }

    const updated = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, parseInt(id)))
      .returning();

    res.json(updated[0]);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update role: " + error.message });
  }
});

// Delete a staff user (Owner only)
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const requesterUid = req.user!.uid;
    const requester = await db
      .select()
      .from(users)
      .where(eq(users.uid, requesterUid))
      .limit(1);

    if (requester.length === 0 || requester[0].role !== "owner") {
      return res.status(403).json({ error: "Only owners can delete staff accounts" });
    }

    // Do not allow deleting oneself
    if (requester[0].id === parseInt(id)) {
      return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte propriétaire" });
    }

    const deleted = await db
      .delete(users)
      .where(eq(users.id, parseInt(id)))
      .returning();

    res.json({ success: true, message: "Utilisateur supprimé", deleted: deleted[0] });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete user: " + error.message });
  }
});

export default router;
