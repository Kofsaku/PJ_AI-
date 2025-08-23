const Company = require('../models/Company');
const asyncHandler = require('../middlewares/asyncHandler');

exports.getAllCompanies = asyncHandler(async (req, res) => {
  const companies = await Company.find().sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    data: companies
  });
});

exports.getCompanyById = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    return res.status(404).json({
      success: false,
      error: 'Company not found'
    });
  }
  res.status(200).json({
    success: true,
    data: company
  });
});

exports.getCompanyByCompanyId = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ companyId: req.params.companyId });
  if (!company) {
    return res.status(404).json({
      success: false,
      error: 'Company not found'
    });
  }
  res.status(200).json({
    success: true,
    data: company
  });
});

exports.createCompany = asyncHandler(async (req, res) => {
  const { name, address, url, phone, email } = req.body;
  
  const existingCompany = await Company.findOne({ 
    $or: [
      { name: name },
      { phone: phone }
    ]
  });

  if (existingCompany) {
    return res.status(400).json({
      success: false,
      error: 'Company with this name or phone already exists'
    });
  }

  const company = await Company.create({
    name,
    address,
    url: url || '',
    phone,
    email: email || '',
    createdBy: req.user?.id || 'admin'
  });

  res.status(201).json({
    success: true,
    data: company
  });
});

exports.updateCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!company) {
    return res.status(404).json({
      success: false,
      error: 'Company not found'
    });
  }

  res.status(200).json({
    success: true,
    data: company
  });
});

exports.deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByIdAndDelete(req.params.id);

  if (!company) {
    return res.status(404).json({
      success: false,
      error: 'Company not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Company deleted successfully'
  });
});

exports.validateCompanyId = asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  const company = await Company.findOne({ companyId: companyId, status: 'active' });
  
  if (!company) {
    return res.status(404).json({
      success: false,
      error: 'Invalid company ID'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      companyId: company.companyId,
      name: company.name
    }
  });
});