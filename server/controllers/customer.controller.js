import { validationResult } from 'express-validator';
import Customer from '../models/Customer.model.js';
import Agent from '../models/Agent.model.js';
import {
  notifyHighValueLead,
  notifyCustomerAssigned,
  notifyDealClosed
} from '../utils/notificationService.js';

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

    // Notify about high-value leads (budget >= $500,000)
    try {
      if (customer.budget && customer.budget >= 500000) {
        await notifyHighValueLead(customer, customer.assignedAgent);
      } else if (customer.assignedAgent) {
        // Notify agent about regular customer assignment
        await notifyCustomerAssigned(customer, customer.assignedAgent);
      }
    } catch (notifError) {
      console.error('Notification error:', notifError);
    }

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

    // Track if lead status changed to closed/won
    const oldStatus = customer.leadStatus;
    const newStatus = req.body.leadStatus;

    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('assignedAgent', 'name email');

    // Notify about deal closure
    if (oldStatus !== 'closed_won' && newStatus === 'closed_won') {
      try {
        const dealAmount = req.body.dealAmount || customer.budget || 0;
        await notifyDealClosed(updatedCustomer, customer.assignedAgent, dealAmount);
      } catch (notifError) {
        console.error('Notification error:', notifError);
      }
    }

    // Notify about new customer assignment
    if (req.body.assignedAgent && req.body.assignedAgent !== customer.assignedAgent?.toString()) {
      try {
        await notifyCustomerAssigned(updatedCustomer, req.body.assignedAgent);
      } catch (notifError) {
        console.error('Notification error:', notifError);
      }
    }

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

    // Notify agent about new customer assignment
    try {
      await notifyCustomerAssigned(customer, agentId);
      
      // Also notify if it's a high-value lead
      if (customer.budget && customer.budget >= 500000) {
        await notifyHighValueLead(customer, agentId);
      }
    } catch (notifError) {
      console.error('Notification error:', notifError);
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
