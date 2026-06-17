import { Router, type Request, type Response } from "express";
import { db } from "../../db/index";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/courses", async (req: Request, res: Response) => {
  try {
    const { category, featured, published } = req.query;
    
    let conditions = ["1=1"];
    if (category) conditions.push(`category = $1`);
    if (featured === "true") conditions.push("is_featured = true");
    if (published !== "false") conditions.push("is_published = true");
    
    const courses = await db.execute(sql`
      SELECT c.*, 
        (SELECT COUNT(*) FROM lms_modules WHERE course_id = c.id) as module_count,
        (SELECT COUNT(*) FROM lms_lessons l JOIN lms_modules m ON l.module_id = m.id WHERE m.course_id = c.id) as lesson_count
      FROM lms_courses c
      WHERE is_published = true
      ORDER BY c.is_featured DESC, c.created_at DESC
    `);
    
    res.json(courses.rows || courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

router.get("/courses/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    const courseResult = await db.execute(sql`
      SELECT * FROM lms_courses WHERE id = ${id}
    `);
    
    const course = (courseResult.rows || courseResult)[0];
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    
    const modulesResult = await db.execute(sql`
      SELECT m.*, 
        (SELECT json_agg(l ORDER BY l.sort_order) 
         FROM lms_lessons l WHERE l.module_id = m.id) as lessons
      FROM lms_modules m
      WHERE m.course_id = ${id}
      ORDER BY m.sort_order
    `);
    
    res.json({
      ...course,
      modules: modulesResult.rows || modulesResult,
    });
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ error: "Failed to fetch course" });
  }
});

router.post("/courses", async (req: Request, res: Response) => {
  try {
    const { title, description, category, instructor_name, duration_hours, difficulty, price, is_free, thumbnail_url } = req.body;
    
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: "Title is required" });
    }
    
    const code = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
    const safeDescription = description || '';
    const safeCategory = category || '';
    const safeInstructor = instructor_name || '';
    const safeDuration = parseFloat(duration_hours) || 0;
    const safeDifficulty = ['beginner', 'intermediate', 'advanced'].includes(difficulty) ? difficulty : 'beginner';
    const safePrice = parseFloat(price) || 0;
    const safeFree = Boolean(is_free);
    const safeThumbnail = thumbnail_url || '';
    
    const result = await db.execute(sql`
      INSERT INTO lms_courses (code, title, description, category, instructor_name, duration_hours, difficulty, price, is_free, thumbnail_url, is_published)
      VALUES (${code}, ${title}, ${safeDescription}, ${safeCategory}, ${safeInstructor}, ${safeDuration}, ${safeDifficulty}, ${safePrice}, ${safeFree}, ${safeThumbnail}, false)
      RETURNING *
    `);
    
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({ error: "Failed to create course" });
  }
});

router.put("/courses/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    const { title, description, category, instructor_name, duration_hours, difficulty, price, is_free, is_published, is_featured, thumbnail_url } = req.body;
    
    const result = await db.execute(sql`
      UPDATE lms_courses SET 
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        category = COALESCE(${category}, category),
        instructor_name = COALESCE(${instructor_name}, instructor_name),
        duration_hours = COALESCE(${duration_hours ? parseFloat(duration_hours) : null}, duration_hours),
        difficulty = COALESCE(${difficulty}, difficulty),
        price = COALESCE(${price ? parseFloat(price) : null}, price),
        is_free = COALESCE(${is_free}, is_free),
        is_published = COALESCE(${is_published}, is_published),
        is_featured = COALESCE(${is_featured}, is_featured),
        thumbnail_url = COALESCE(${thumbnail_url}, thumbnail_url),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `);
    
    res.json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ error: "Failed to update course" });
  }
});

router.delete("/courses/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    
    await db.execute(sql`DELETE FROM lms_courses WHERE id = ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ error: "Failed to delete course" });
  }
});

router.post("/courses/:courseId/modules", async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(req.params.courseId);
    if (isNaN(courseId)) return res.status(400).json({ error: "Invalid course ID" });
    
    const { title, description, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    
    const result = await db.execute(sql`
      INSERT INTO lms_modules (course_id, title, description, sort_order)
      VALUES (${courseId}, ${title}, ${description || ''}, ${parseInt(sort_order) || 0})
      RETURNING *
    `);
    
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating module:", error);
    res.status(500).json({ error: "Failed to create module" });
  }
});

router.post("/modules/:moduleId/lessons", async (req: Request, res: Response) => {
  try {
    const moduleId = parseInt(req.params.moduleId);
    if (isNaN(moduleId)) return res.status(400).json({ error: "Invalid module ID" });
    
    const { title, description, content_type, content_url, content_text, duration_minutes, sort_order, is_free_preview } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    
    const safeContentType = ['video', 'text', 'pdf', 'quiz'].includes(content_type) ? content_type : 'video';
    
    const result = await db.execute(sql`
      INSERT INTO lms_lessons (module_id, title, description, content_type, content_url, content_text, duration_minutes, sort_order, is_free_preview)
      VALUES (${moduleId}, ${title}, ${description || ''}, ${safeContentType}, ${content_url || ''}, ${content_text || ''}, ${parseInt(duration_minutes) || 0}, ${parseInt(sort_order) || 0}, ${Boolean(is_free_preview)})
      RETURNING *
    `);
    
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error creating lesson:", error);
    res.status(500).json({ error: "Failed to create lesson" });
  }
});

router.get("/enrollments", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    const enrollments = await db.execute(sql`
      SELECT e.*, c.title as course_title, c.thumbnail_url, c.instructor_name
      FROM lms_enrollments e
      JOIN lms_courses c ON e.course_id = c.id
      ORDER BY e.created_at DESC
    `);
    
    res.json(enrollments.rows || enrollments);
  } catch (error) {
    console.error("Error fetching enrollments:", error);
    res.status(500).json({ error: "Failed to fetch enrollments" });
  }
});

router.post("/courses/:courseId/enroll", async (req: Request, res: Response) => {
  try {
    const courseId = parseInt(req.params.courseId);
    if (isNaN(courseId)) return res.status(400).json({ error: "Invalid course ID" });
    
    const userId = (req as any).user?.id || req.body.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: "User ID required" });
    }
    
    const existingResult = await db.execute(sql`
      SELECT id FROM lms_enrollments WHERE course_id = ${courseId} AND user_id = ${userId}
    `);
    
    if ((existingResult.rows || existingResult).length > 0) {
      return res.status(400).json({ error: "Already enrolled" });
    }
    
    const lessonsResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM lms_lessons l 
      JOIN lms_modules m ON l.module_id = m.id 
      WHERE m.course_id = ${courseId}
    `);
    const totalLessons = parseInt((lessonsResult.rows || lessonsResult)[0]?.count) || 0;
    
    const result = await db.execute(sql`
      INSERT INTO lms_enrollments (course_id, user_id, total_lessons)
      VALUES (${courseId}, ${userId}, ${totalLessons})
      RETURNING *
    `);
    
    await db.execute(sql`
      UPDATE lms_courses SET enrollment_count = enrollment_count + 1 WHERE id = ${courseId}
    `);
    
    res.status(201).json((result.rows || result)[0]);
  } catch (error) {
    console.error("Error enrolling:", error);
    res.status(500).json({ error: "Failed to enroll" });
  }
});

router.post("/lessons/:lessonId/complete", async (req: Request, res: Response) => {
  try {
    const lessonId = parseInt(req.params.lessonId);
    if (isNaN(lessonId)) return res.status(400).json({ error: "Invalid lesson ID" });
    
    const enrollmentId = parseInt(req.body.enrollmentId);
    if (isNaN(enrollmentId)) return res.status(400).json({ error: "Invalid enrollment ID" });
    
    await db.execute(sql`
      INSERT INTO lms_lesson_progress (enrollment_id, lesson_id, status, completed_at)
      VALUES (${enrollmentId}, ${lessonId}, 'completed', CURRENT_TIMESTAMP)
      ON CONFLICT (enrollment_id, lesson_id) 
      DO UPDATE SET status = 'completed', completed_at = CURRENT_TIMESTAMP
    `);
    
    const progressResult = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM lms_lesson_progress WHERE enrollment_id = ${enrollmentId} AND status = 'completed') as completed,
        (SELECT total_lessons FROM lms_enrollments WHERE id = ${enrollmentId}) as total
    `);
    
    const row = (progressResult.rows || progressResult)[0];
    const completed = parseInt(row?.completed) || 0;
    const total = parseInt(row?.total) || 1;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    await db.execute(sql`
      UPDATE lms_enrollments 
      SET progress_percent = ${progressPercent}, 
          completed_lessons = ${completed},
          completed_at = ${progressPercent >= 100 ? sql`CURRENT_TIMESTAMP` : sql`NULL`}
      WHERE id = ${enrollmentId}
    `);
    
    res.json({ progress_percent: progressPercent, completed_lessons: completed });
  } catch (error) {
    console.error("Error completing lesson:", error);
    res.status(500).json({ error: "Failed to complete lesson" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM lms_courses WHERE is_published = true) as total_courses,
        (SELECT COUNT(*) FROM lms_enrollments) as total_enrollments,
        (SELECT COUNT(*) FROM lms_enrollments WHERE progress_percent = 100) as completions,
        (SELECT COUNT(*) FROM lms_lessons) as total_lessons
    `);
    
    res.json((stats.rows || stats)[0]);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
