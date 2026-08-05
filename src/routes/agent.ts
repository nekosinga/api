import { Router } from 'express';
import { z } from 'zod';
import { elfa } from '../lib/elfa';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All agent routes require auth
router.use(requireAuth);

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
});

const streamSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
  speed: z.enum(['fast', 'expert']).default('fast'),
});

// POST /api/agent/chat
router.post('/chat', async (req, res, next) => {
  try {
    const { message, sessionId } = chatSchema.parse(req.body);

    const reply = await elfa.chat({ message, sessionId });

    res.json({
      message: reply.data.message,
      sessionId: reply.data.sessionId,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/agent/chat/stream
// Accepts query params: message, sessionId (optional), speed (optional)
router.get('/chat/stream', async (req, res, next) => {
  try {
    const { message, sessionId, speed } = streamSchema.parse(req.query);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = elfa.chatStream({ message, sessionId, speed });

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      if (event.type === 'complete' || event.type === 'error') {
        break;
      }
    }

    res.end();
  } catch (err) {
    next(err);
  }
});

export default router;
