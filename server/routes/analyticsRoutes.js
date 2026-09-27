const express = require('express');
const router = express.Router();
const { getOverview, getStudyTrends, getSubjectPerformance, createSession } = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/overview', getOverview);
router.get('/study-trends', getStudyTrends);
router.get('/subject-performance', getSubjectPerformance);
router.post('/sessions', createSession);

module.exports = router;
