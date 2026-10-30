const express = require('express');
const router = express.Router();
const { generateSchedule, getTodaySchedule, getRecommendations } = require('../controllers/scheduleController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/generate', generateSchedule);
router.get('/today', getTodaySchedule);
router.get('/recommendations', getRecommendations);

module.exports = router;
