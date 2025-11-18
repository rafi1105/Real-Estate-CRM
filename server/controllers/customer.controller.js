import { validationResult } from 'express-validator';
import Customer from '../models/Customer.model.js';
import Agent from '../models/Agent.model.js';

// @desc    Create new customer
// @route   POST /api/customers
// @access  Agent/Admin/Super Admin
export const createCustomer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const customer = await Customer.create({
      ...req.body,
      addedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      customer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating customer',
      error: error.message
    });
  }
};

// @desc    Get all customers
// @route   GET /api/customers
// @access  Agent/Admin/Super Admin
export const getAllCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      search,
      sort = '-createdAt'
    } = req.query;

    // Build query
    const query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (search) {
      query.$text = { $search: search };
    }

    // Execute query
    const customers = await Customer.find(query)
      .populate('addedBy', 'name email')
      .populate('assignedAgent', 'name email')
      .populate('interestedProperties', 'name price location')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Customer.countDocuments(query);

    res.json({
      success: true,
      customers,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching customers',
      error: error.message
    });
  }
};

// @desc    Get customer by ID
// @route   GET /api/customers/:id
// @access  Agent/Admin/Super Admin
export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('addedBy', 'name email')
      .populate('assignedAgent', 'name email phone')
      .populate('interestedProperties', 'name price location images')
      .populate('notes.addedBy', 'name');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if agent can access this customer
    if (req.user.role === 'agent' && 
        customer.assignedAgent && 
        customer.assignedAgent._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this customer'
      });
    }

    res.json({
      success: true,
      customer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching customer',
      error: error.message
    });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Agent/Admin/Super Admin
export const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if agent can update this customer
    if (req.user.role === 'agent' && 
        customer.assignedAgent && 
        customer.assignedAgent.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this customer'
      });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Customer updated successfully',
      customer: updatedCustomer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating customer',
      error: error.message
    });
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Admin/Super Admin
export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    await customer.deleteOne();

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting customer',
      error: error.message
    });
  }
};

// @desc    Assign agent to customer
// @route   PATCH /api/customers/:id/assign-agent
// @access  Admin/Super Admin
export const assignAgent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { agentId } = req.body;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const agent = await Agent.findOne({ userId: agentId });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    customer.assignedAgent = agentId;
    await customer.save();

    // Add to agent's assigned customers
    if (!agent.assignedCustomers.includes(customer._id)) {
      agent.assignedCustomers.push(customer._id);
      await agent.save();
    }

    res.json({
      success: true,
      message: 'Agent assigned successfully',
      customer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning agent',
      error: error.message
    });
  }
};

// @desc    Add note to customer
// @route   POST /api/customers/:id/notes
// @access  Agent/Admin/Super Admin
export const addNote = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { note } = req.body;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    customer.notes.push({
      note,
      addedBy: req.user._id
    });

    await customer.save();

    res.json({
      success: true,
      message: 'Note added successfully',
      customer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding note',
      error: error.message
    });
  }
};

// @desc    Get my assigned customers
// @route   GET /api/customers/my/customers
// @access  Agent/Admin/Super Admin
export const getMyCustomers = async (req, res) => {
  try {
    let customers;

    if (req.user.role === 'agent') {
      // Agent sees only assigned customers or customers they added
      customers = await Customer.find({
        $or: [
          { assignedAgent: req.user._id },
          { addedBy: req.user._id }
        ]
      })
        .populate('addedBy', 'name email')
        .populate('assignedAgent', 'name email')
        .populate('interestedProperties', 'name price location')
        .sort('-createdAt');
    } else {
      // Admin/Super Admin see all customers
      customers = await Customer.find()
        .populate('addedBy', 'name email')
        .populate('assignedAgent', 'name email')
        .populate('interestedProperties', 'name price location')
        .sort('-createdAt');
    }

    res.json({
      success: true,
      customers,
      count: customers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching customers',
      error: error.message
    });
  }
};
