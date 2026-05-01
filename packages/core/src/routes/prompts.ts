import { getSiteConfig } from '../siteConfig';
import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { internalError } from '../lib/errors';

const router: ReturnType<typeof Router> = Router();

// GET /prompts - Main prompts page
router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    
    // Get top 20 prompts (unused first, then used)
    const { data: unusedData, error: unusedError } = await supabase
      .from(getSiteConfig().tables.prompts)
      .select('id, text, votes, created_at')
      .is('used_at', null)
      .order('votes', { ascending: false })
      .limit(20);
    
    if (unusedError) throw internalError(`Failed to fetch unused prompts: ${unusedError.message}`);
    
    let prompts = unusedData || [];
    
    // If we have less than 20 unused prompts, get additional used prompts
    if (prompts.length < 20) {
      const remaining = 20 - prompts.length;
      const { data: usedData, error: usedError } = await supabase
        .from(getSiteConfig().tables.prompts)
        .select('id, text, votes, created_at')
        .not('used_at', 'is', null)
        .order('votes', { ascending: false })
        .limit(remaining);
      
      if (usedError) throw internalError(`Failed to fetch used prompts: ${usedError.message}`);
      
      prompts = [...prompts, ...(usedData || [])];
    }
    
    res.render('prompts', { prompts });
  } catch (error) {
    console.error('Error loading prompts page:', error);
    res.status(500).render('prompts', { prompts: [] });
  }
});

export default router;