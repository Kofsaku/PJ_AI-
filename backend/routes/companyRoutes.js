const express = require('express');
const router = express.Router();
const {
  getAllCompanies,
  getCompanyById,
  getCompanyByCompanyId,
  createCompany,
  updateCompany,
  deleteCompany,
  validateCompanyId
} = require('../controllers/companyController');

router.get('/', getAllCompanies);
router.get('/:id', getCompanyById);
router.get('/validate/:companyId', validateCompanyId);
router.get('/company-id/:companyId', getCompanyByCompanyId);
router.post('/', createCompany);
router.put('/:id', updateCompany);
router.delete('/:id', deleteCompany);

module.exports = router;