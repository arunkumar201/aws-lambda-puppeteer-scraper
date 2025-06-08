import { Router, type IRouter } from 'express';
import { scrapeWikipediaPage } from '../controllers/wiki.controller';
import validate from '../middlewares/validate';
import { scrapeValidation } from '../validations';

const router: IRouter = Router();

router.post('/scrape', validate(scrapeValidation.scrape), scrapeWikipediaPage);

export default router;
