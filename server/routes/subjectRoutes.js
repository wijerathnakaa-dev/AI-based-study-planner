const express = require('express');
const router = express.Router();
const { getSubjects, getSubject, createSubject, updateSubject, deleteSubject, getSubjectAnalytics } = require('../controllers/subjectController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .get(getSubjects)
  .post(createSubject);

router.route('/:id')
  .get(getSubject)
  .put(updateSubject)
  .delete(deleteSubject);

router.get('/:id/analytics', getSubjectAnalytics);

module.exports = router;
