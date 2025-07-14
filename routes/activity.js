const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Blog = require('../models/Blog');
const Comment = require('../models/Comment');
const Thread = require('../models/Thread');
const Vote = require('../models/Vote');
const LoginAttempt = require('../models/LoginAttempt');
const auth = require('../middleware/auth');

// Real-time analytics endpoint
router.get('/analytics', auth, async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    const timeRanges = {
      '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      '1y': new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      'total': new Date(0) // All-time: start from epoch
    };
    const startDate = timeRanges[timeRange] || timeRanges['7d'];

    // Parallel data collection for better performance
    const [
      totalUsers,
      activeUsers,
      newUsers,
      onlineUsers,
      totalBlogs,
      recentBlogs,
      totalComments,
      recentComments,
      totalThreads,
      recentThreads,
      totalVotes,
      recentVotes
    ] = await Promise.all([
      // User metrics
      User.countDocuments(),
      User.countDocuments({ lastLogin: { $gte: startDate } }),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      User.countDocuments({ online: true }),
      
      // Content metrics
      Blog.countDocuments(),
      Blog.countDocuments({ createdAt: { $gte: startDate } }),
      Comment.countDocuments(),
      Comment.countDocuments({ createdAt: { $gte: startDate } }),
      Thread.countDocuments(),
      Thread.countDocuments({ createdAt: { $gte: startDate } }),
      Vote.countDocuments(),
      Vote.countDocuments({ createdAt: { $gte: startDate } })
    ]);

    // Get engagement metrics
    const [popularBlogs, activeThreads, userGrowth] = await Promise.all([
      // Most engaged blog posts
      Blog.aggregate([
        {
          $addFields: {
            totalLikes: { $size: { $ifNull: ["$likes", []] } },
            totalDislikes: { $size: { $ifNull: ["$dislikes", []] } },
            totalEngagement: { 
              $add: [
                { $size: { $ifNull: ["$likes", []] } },
                { $size: { $ifNull: ["$dislikes", []] } }
              ]
            }
          }
        },
        { $sort: { totalEngagement: -1 } },
        { $limit: 5 },
        {
          $project: {
            title: 1,
            author: 1,
            totalLikes: 1,
            totalDislikes: 1,
            totalEngagement: 1,
            createdAt: 1
          }
        }
      ]),
      
      // Most active threads
      Thread.aggregate([
        {
          $addFields: {
            replyCount: { $size: { $ifNull: ["$replies", []] } }
          }
        },
        { $sort: { replyCount: -1 } },
        { $limit: 5 },
        {
          $project: {
            title: 1,
            category: 1,
            author: 1,
            replyCount: 1,
            createdAt: 1
          }
        }
      ]),
      
      // User growth over time
      User.aggregate([
        {
          $match: { createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
      ])
    ]);

    // Calculate engagement rates
    const blogEngagementRate = totalBlogs > 0 ? ((popularBlogs.reduce((sum, blog) => sum + blog.totalEngagement, 0) / totalBlogs) * 100).toFixed(1) : 0;
    const commentRate = totalBlogs > 0 ? (totalComments / totalBlogs).toFixed(1) : 0;
    const userRetentionRate = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0;

    // Get recent activity for activity feed
    const recentActivity = await Promise.all([
      Blog.find().sort({ createdAt: -1 }).limit(3).populate('author', 'username displayName'),
      Comment.find().sort({ createdAt: -1 }).limit(3).populate('author', 'username displayName'),
      Thread.find().sort({ createdAt: -1 }).limit(3).populate('author', 'username displayName'),
      User.find().sort({ createdAt: -1 }).limit(3).select('username displayName createdAt')
    ]);

    const analytics = {
      overview: {
        totalUsers,
        activeUsers,
        newUsers,
        onlineUsers,
        totalContent: totalBlogs + totalThreads,
        totalEngagement: totalComments + totalVotes,
        engagementRate: blogEngagementRate,
        userRetentionRate
      },
      content: {
        totalBlogs,
        recentBlogs,
        totalComments,
        recentComments,
        totalThreads,
        recentThreads,
        commentRate
      },
      governance: {
        totalVotes,
        recentVotes,
        participationRate: totalUsers > 0 ? ((totalVotes / totalUsers) * 100).toFixed(1) : 0
      },
      popular: {
        blogs: popularBlogs,
        threads: activeThreads
      },
      growth: {
        userGrowth: userGrowth.map(item => ({
          date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
          users: item.count
        }))
      },
      activity: {
        recentBlogs: recentActivity[0],
        recentComments: recentActivity[1],
        recentThreads: recentActivity[2],
        newUsers: recentActivity[3]
      },
      timeRange,
      generatedAt: new Date().toISOString()
    };

    res.json(analytics);

  } catch (error) {
    console.error('Analytics fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Real-time metrics endpoint
router.get('/metrics/realtime', auth, async (req, res) => {
  try {
    const [onlineUsers, recentActivity] = await Promise.all([
      User.countDocuments({ online: true }),
      // Get activity from last 5 minutes
      Promise.all([
        Comment.countDocuments({ 
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } 
        }),
        Blog.countDocuments({ 
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } 
        }),
        Thread.countDocuments({ 
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } 
        })
      ])
    ]);

    res.json({
      onlineUsers,
      recentActivity: {
        comments: recentActivity[0],
        blogs: recentActivity[1],
        threads: recentActivity[2],
        total: recentActivity[0] + recentActivity[1] + recentActivity[2]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Real-time metrics error:', error.message);
    res.status(500).json({ error: 'Failed to fetch real-time metrics' });
  }
});

// User activity patterns endpoint
router.get('/patterns/users', auth, async (req, res) => {
  try {
    const { timeRange = '7d' } = req.query;
    
    const now = new Date();
    const timeRanges = {
      '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    };
    const startDate = timeRanges[timeRange] || timeRanges['7d'];

    // Get user activity patterns
    const activityPatterns = await User.aggregate([
      {
        $match: { lastLogin: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            hour: { $hour: "$lastLogin" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.hour": 1 } }
    ]);

    // Get user registration patterns
    const registrationPatterns = await User.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);

    res.json({
      hourlyActivity: activityPatterns.map(item => ({
        hour: item._id.hour,
        count: item.count
      })),
      dailyRegistrations: registrationPatterns.map(item => ({
        date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
        count: item.count
      })),
      timeRange
    });

  } catch (error) {
    console.error('User patterns error:', error.message);
    res.status(500).json({ error: 'Failed to fetch user patterns' });
  }
});

// Content performance endpoint
router.get('/performance/content', auth, async (req, res) => {
  try {
    // Get top performing content
    const [topBlogs, topThreads, contentStats] = await Promise.all([
      Blog.aggregate([
        {
          $addFields: {
            engagementScore: {
              $add: [
                { $size: { $ifNull: ["$likes", []] } },
                { $multiply: [{ $size: { $ifNull: ["$dislikes", []] } }, 0.5] }
              ]
            }
          }
        },
        { $sort: { engagementScore: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'authorInfo'
          }
        },
        {
          $project: {
            title: 1,
            author: { $arrayElemAt: ['$authorInfo.username', 0] },
            likes: { $size: { $ifNull: ["$likes", []] } },
            dislikes: { $size: { $ifNull: ["$dislikes", []] } },
            engagementScore: 1,
            createdAt: 1
          }
        }
      ]),
      
      Thread.aggregate([
        {
          $addFields: {
            replyCount: { $size: { $ifNull: ["$replies", []] } }
          }
        },
        { $sort: { replyCount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'authorInfo'
          }
        },
        {
          $project: {
            title: 1,
            category: 1,
            author: { $arrayElemAt: ['$authorInfo.username', 0] },
            replyCount: 1,
            createdAt: 1
          }
        }
      ]),

      // Content creation stats by category/type
      Promise.all([
        Blog.aggregate([
          {
            $group: {
              _id: null,
              avgLikes: { $avg: { $size: { $ifNull: ["$likes", []] } } },
              avgDislikes: { $avg: { $size: { $ifNull: ["$dislikes", []] } } },
              totalPosts: { $sum: 1 }
            }
          }
        ]),
        Thread.aggregate([
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
              avgReplies: { $avg: { $size: { $ifNull: ["$replies", []] } } }
            }
          },
          { $sort: { count: -1 } }
        ])
      ])
    ]);

    res.json({
      topBlogs,
      topThreads,
      blogStats: contentStats[0][0] || { avgLikes: 0, avgDislikes: 0, totalPosts: 0 },
      threadCategories: contentStats[1]
    });

  } catch (error) {
    console.error('Content performance error:', error.message);
    res.status(500).json({ error: 'Failed to fetch content performance data' });
  }
});

// Legacy activity endpoint (for backward compatibility)
router.get('/', async (req, res) => {
  try {
    // Return recent activity for non-authenticated requests
    const recentActivity = await Promise.all([
      Blog.find().sort({ createdAt: -1 }).limit(5).populate('author', 'username').select('title author createdAt'),
      Comment.find().sort({ createdAt: -1 }).limit(5).populate('author', 'username').select('content author createdAt'),
      Thread.find().sort({ createdAt: -1 }).limit(5).populate('author', 'username').select('title author createdAt')
    ]);

    const activities = [
      ...recentActivity[0].map(blog => ({ type: 'blog', title: blog.title, author: blog.author?.username, createdAt: blog.createdAt })),
      ...recentActivity[1].map(comment => ({ type: 'comment', content: comment.content?.substring(0, 100), author: comment.author?.username, createdAt: comment.createdAt })),
      ...recentActivity[2].map(thread => ({ type: 'thread', title: thread.title, author: thread.author?.username, createdAt: thread.createdAt }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

    res.json(activities);
  } catch (error) {
    console.error('Fetch activity error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Platform health metrics endpoint
router.get('/platform-health', auth, async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get failed login attempts in last 24 hours
    const failedLogins = await LoginAttempt.countDocuments({
      success: false,
      timestamp: { $gte: last24h }
    });
    
    // Calculate peak hours from user activity (last 7 days)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const loginData = await LoginAttempt.aggregate([
      {
        $match: {
          success: true,
          timestamp: { $gte: last7d }
        }
      },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 2
      }
    ]);
    
    // Format peak hours
    let peakHours = '8-10pm EST'; // fallback
    if (loginData.length > 0) {
      const topHours = loginData.map(item => {
        const hour = item._id;
        const period = hour >= 12 ? 'pm' : 'am';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}${period}`;
      });
      
      if (topHours.length >= 2) {
        peakHours = `${topHours[0]}-${topHours[1]} EST`;
      } else {
        peakHours = `${topHours[0]} EST`;
      }
    }
    
    res.json({
      failedLogins,
      peakHours
    });
    
  } catch (error) {
    console.error('Platform health error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;