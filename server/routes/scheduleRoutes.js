const express = require('express');
const router = express.Router();
const { generateSchedule, getTodaySchedule } = require('../controllers/scheduleController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/generate', generateSchedule);
router.get('/today', getTodaySchedule);

module.exports = router;
