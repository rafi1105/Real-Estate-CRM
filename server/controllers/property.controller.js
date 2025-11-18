import { validationResult } from 'express-validator';
import Property from '../models/Property.model.js';
import Agent from '../models/Agent.model.js';

// @desc    Create new property
// @route   POST /api/properties
// @access  Admin/Super Admin
export const createProperty = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const property = await Property.create({
      ...req.body,
      uploadedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      property
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating property',
      error: error.message
    });
  }
};

// @desc    Get all properties
// @route   GET /api/properties
// @access  Public
export const getAllProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      state,
      status,
      minPrice,
      maxPrice,
      location,
      search,
      sort = '-createdAt'
    } = req.query;

    // Build query
    const query = { publishedToFrontend: true };

    if (type) query.type = type;
    if (state) query.state = state;
    if (status) query.status = status;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (location) query.location = new RegExp(location, 'i');
    if (search) {
      query.$text = { $search: search };
    }

    // Execute query
    const properties = await Property.find(query)
      .populate('uploadedBy', 'name email')
      .populate('assignedAgent', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Property.countDocuments(query);

    res.json({
      success: true,
      properties,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    console.error('❌ Error in getAllProperties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching properties',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get property by ID
// @route   GET /api/properties/:id
// @access  Public
export const getPropertyById = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('uploadedBy', 'name email')
      .populate('assignedAgent', 'name email phone');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Increment view count
    property.viewCount += 1;
    await property.save();

    res.json({
      success: true,
      property
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching property',
      error: error.message
    });
  }
};

// @desc    Update property
// @route   PUT /api/properties/:id
// @access  Admin/Super Admin
export const updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Property updated successfully',
      property: updatedProperty
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating property',
      error: error.message
    });
  }
};

// @desc    Delete property
// @route   DELETE /api/properties/:id
// @access  Super Admin
export const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    await property.deleteOne();

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting property',
      error: error.message
    });
  }
};

// @desc    Publish property to frontend
// @route   PATCH /api/properties/:id/publish
// @access  Super Admin
export const publishProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    property.publishedToFrontend = !property.publishedToFrontend;
    property.isPublished = property.publishedToFrontend;
    await property.save();

    res.json({
      success: true,
      message: `Property ${property.publishedToFrontend ? 'published' : 'unpublished'} successfully`,
      property
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error publishing property',
      error: error.message
    });
  }
};

// @desc    Assign agent to property
// @route   PATCH /api/properties/:id/assign-agent
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

    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const agent = await Agent.findOne({ userId: agentId });
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    property.assignedAgent = agentId;
    await property.save();

    // Add to agent's assigned properties
    if (!agent.assignedProperties.includes(property._id)) {
      agent.assignedProperties.push(property._id);
      await agent.save();
    }

    res.json({
      success: true,
      message: 'Agent assigned successfully',
      property
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning agent',
      error: error.message
    });
  }
};

// @desc    Get my assigned properties
// @route   GET /api/properties/my/properties
// @access  Agent/Admin/Super Admin
export const getMyProperties = async (req, res) => {
  try {
    let properties;

    if (req.user.role === 'agent') {
      // Agent sees only assigned properties
      properties = await Property.find({ assignedAgent: req.user._id })
        .populate('uploadedBy', 'name email')
        .sort('-createdAt');
    } else {
      // Admin/Super Admin see all properties
      properties = await Property.find()
        .populate('uploadedBy', 'name email')
        .populate('assignedAgent', 'name email')
        .sort('-createdAt');
    }

    res.json({
      success: true,
      properties,
      count: properties.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching properties',
      error: error.message
    });
  }
};
