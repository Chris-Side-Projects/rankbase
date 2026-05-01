import { getSiteConfig } from '../../siteConfig';
import { Router, Request, Response } from 'express';
import { getSupabase } from '../../services/supabase';
import { internalError } from '../../lib/errors';
import { createHash } from 'crypto';

const router: ReturnType<typeof Router> = Router();

// Helper to hash IP for privacy
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

// GET /api/prompts/top — top 20 by votes (unused first)
router.get('/top', async (req: Request, res: Response) => {
  const supabase = getSupabase();
  
  // First get unused prompts (used_at IS NULL) ordered by votes
  const { data: unusedData, error: unusedError } = await supabase
    .from(getSiteConfig().tables.prompts)
    .select('id, text, votes, created_at')
    .is('used_at', null)
    .order('votes', { ascending: false })
    .limit(20);
  
  if (unusedError) throw internalError(`Failed to fetch unused prompts: ${unusedError.message}`);
  
  // If we have less than 20 unused prompts, get additional used prompts
  let allPrompts = unusedData || [];
  if (allPrompts.length < 20) {
    const remaining = 20 - allPrompts.length;
    const { data: usedData, error: usedError } = await supabase
      .from(getSiteConfig().tables.prompts)
      .select('id, text, votes, created_at')
      .not('used_at', 'is', null)
      .order('votes', { ascending: false })
      .limit(remaining);
    
    if (usedError) throw internalError(`Failed to fetch used prompts: ${usedError.message}`);
    
    allPrompts = [...allPrompts, ...(usedData || [])];
  }
  
  res.json({ prompts: allPrompts });
});

// GET /api/prompts/random — 10 random prompts
router.get('/random', async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(getSiteConfig().tables.prompts)
    .select('id, text, votes, created_at')
    .limit(10);
  
  if (error) throw internalError(`Failed to fetch random prompts: ${error.message}`);
  
  // Shuffle the results
  const shuffled = data ? [...data].sort(() => 0.5 - Math.random()) : [];
  
  res.json({ prompts: shuffled });
});

// POST /api/prompts/:id/vote — rate limited 1/IP/prompt/hour via aega_vote_on_prompt RPC
router.post('/:id/vote', async (req: Request, res: Response) => {
  const promptId = req.params.id;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const ipHash = hashIp(ip);
  
  const supabase = getSupabase();
  const { data, error } = await supabase
    .rpc('aega_vote_on_prompt', {
      p_prompt_id: promptId,
      p_ip_hash: ipHash
    });
  
  if (error) {
    if (error.message === 'rate_limited') {
      return res.status(429).json({ error: 'Rate limited: You can only vote once per prompt per hour' });
    }
    if (error.message === 'prompt_not_found') {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    throw internalError(`Failed to vote: ${error.message}`);
  }
  
  const newVotes = data?.[0]?.new_votes || 0;
  res.json({ votes: newVotes });
});

// POST /api/prompts/suggest — store user prompt (source='user')
router.post('/suggest', async (req: Request, res: Response) => {
  const { text } = req.body;
  
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Prompt text is required' });
  }
  
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(getSiteConfig().tables.prompts)
    .insert({
      text: text.trim(),
      source: 'user'
    })
    .select('id, text, votes, created_at')
    .single();
  
  if (error) {
    // Handle duplicate prompt
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This prompt already exists' });
    }
    throw internalError(`Failed to suggest prompt: ${error.message}`);
  }
  
  res.status(201).json({ prompt: data });
});

export default router;