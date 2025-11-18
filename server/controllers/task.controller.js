import { validationResult } from 'express-validator';
import Task from '../models/Task.model.js';

// @desc    Create new task
// @route   POST /api/tasks
// @access  Agent/Admin/Super Admin
export const createTask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const task = await Task.create({
      ...req.body,
      createdBy: req.user._id,
      assignedTo: req.body.assignedTo || req.user._id // Self-assign if no assignee
    });

    await task.populate('createdBy assignedTo', 'name email');

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating task',
      error: error.message
    });
  }
};

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Agent/Admin/Super Admin
export const getAllTasks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      assignedTo,
      sort = '-createdAt'
    } = req.query;

    // Build query based on role
    let query = {};

    if (req.user.role === 'agent') {
      // Agents see tasks created by them or assigned to them
      query = {
        $or: [
          { createdBy: req.user._id },
          { assignedTo: req.user._id }
        ]
      };
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;

    // Execute query
    const tasks = await Task.find(query)
      .populate('createdBy assignedTo', 'name email')
      .populate('relatedProperty', 'name location')
      .populate('relatedCustomer', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Task.countDocuments(query);

    res.json({
      success: true,
      tasks,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks',
      error: error.message
    });
  }
};

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Agent/Admin/Super Admin
export const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('createdBy assignedTo', 'name email')
      .populate('relatedProperty', 'name location price')
      .populate('relatedCustomer', 'name email phone')
      .populate('comments.addedBy', 'name');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if agent can access this task
    if (req.user.role === 'agent' && 
        task.createdBy._id.toString() !== req.user._id.toString() &&
        task.assignedTo._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this task'
      });
    }

    res.json({
      success: true,
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching task',
      error: error.message
    });
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Agent/Admin/Super Admin
export const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if agent can update this task
    if (req.user.role === 'agent' && 
        task.createdBy.toString() !== req.user._id.toString() &&
        task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task'
      });
    }

    // Agents can only update status, not reassign tasks
    if (req.user.role === 'agent' && req.body.assignedTo) {
      delete req.body.assignedTo;
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy assignedTo', 'name email');

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: updatedTask
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating task',
      error: error.message
    });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Agent/Admin/Super Admin
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Only creator or admin can delete
    if (req.user.role === 'agent' && 
        task.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this task'
      });
    }

    await task.deleteOne();

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting task',
      error: error.message
    });
  }
};

// @desc    Mark task as complete
// @route   PATCH /api/tasks/:id/complete
// @access  Agent/Admin/Super Admin
export const markTaskComplete = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Toggle completion status
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    task.status = newStatus;
    
    if (newStatus === 'completed') {
      task.completedDate = new Date();
    } else {
      task.completedDate = null;
    }

    await task.save();

    res.json({
      success: true,
      message: `Task marked as ${newStatus}`,
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating task status',
      error: error.message
    });
  }
};

// @desc    Add subtask
// @route   POST /api/tasks/:id/subtasks
// @access  Agent/Admin/Super Admin
export const addSubtask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { title } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    task.subtasks.push({ title });
    await task.save();

    res.json({
      success: true,
      message: 'Subtask added successfully',
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding subtask',
      error: error.message
    });
  }
};

// @desc    Toggle subtask completion
// @route   PATCH /api/tasks/:id/subtasks/:subtaskId/toggle
// @access  Agent/Admin/Super Admin
export const toggleSubtask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) {
      return res.status(404).json({
        success: false,
        message: 'Subtask not found'
      });
    }

    subtask.completed = !subtask.completed;
    subtask.completedAt = subtask.completed ? new Date() : null;
    await task.save();

    res.json({
      success: true,
      message: 'Subtask updated successfully',
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating subtask',
      error: error.message
    });
  }
};

// @desc    Add comment to task
// @route   POST /api/tasks/:id/comments
// @access  Agent/Admin/Super Admin
export const addComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { text } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    task.comments.push({
      text,
      addedBy: req.user._id
    });

    await task.save();

    res.json({
      success: true,
      message: 'Comment added successfully',
      task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding comment',
      error: error.message
    });
  }
};

// @desc    Get my tasks
// @route   GET /api/tasks/my/tasks
// @access  Agent/Admin/Super Admin
export const getMyTasks = async (req, res) => {
  try {
    const { status } = req.query;

    const query = {
      $or: [
        { createdBy: req.user._id },
        { assignedTo: req.user._id }
      ]
    };

    if (status) query.status = status;

    const tasks = await Task.find(query)
      .populate('createdBy assignedTo', 'name email')
      .populate('relatedProperty', 'name location')
      .populate('relatedCustomer', 'name email')
      .sort('-createdAt');

    res.json({
      success: true,
      tasks,
      count: tasks.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks',
      error: error.message
    });
  }
};
