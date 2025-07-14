const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Analytics data models
const AnalyticsVisit = mongoose.model('AnalyticsVisit', new mongoose.Schema({
    visitor_id: String,
    session_id: String,
    timestamp: { type: Date, default: Date.now },
    user_agent: String,
    device_type: String,
    browser: String,
    language: String,
    screen_resolution: String,
    timezone_offset: Number,
    ip_address: String,
    country: String,
    city: String
}));

const AnalyticsPageView = mongoose.model('AnalyticsPageView', new mongoose.Schema({
    visitor_id: String,
    session_id: String,
    url: String,
    title: String,
    referrer: String,
    referrer_category: String,
    search_query: String,
    timestamp: { type: Date, default: Date.now },
    user_agent: String,
    device_type: String,
    browser: String,
    ip_address: String
}));

const AnalyticsHit = mongoose.model('AnalyticsHit', new mongoose.Schema({
    visitor_id: String,
    session_id: String,
    resource_url: String,
    resource_type: String,
    page_url: String,
    timestamp: { type: Date, default: Date.now },
    ip_address: String
}));

const AnalyticsEngagement = mongoose.model('AnalyticsEngagement', new mongoose.Schema({
    visitor_id: String,
    session_id: String,
    action: String, // 'blog_post', 'comment', 'vote', 'thread_create', etc.
    target_id: String,
    target_type: String,
    user_id: mongoose.Schema.Types.ObjectId,
    timestamp: { type: Date, default: Date.now },
    additional_data: Object
}));

// Helper function to get IP and location
async function getLocationFromIP(ip) {
    try {
        // Use a free IP geolocation service
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,status`);
        const data = await response.json();
        
        if (data.status === 'success') {
            return {
                country: data.country,
                city: data.city
            };
        }
    } catch (error) {
        console.error('Error getting location from IP:', error);
    }
    
    return {
        country: 'Unknown',
        city: 'Unknown'
    };
}

// Helper function to get client IP
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
}

// Track new visit/session
router.post('/visit', async (req, res) => {
    try {
        const ip = getClientIP(req);
        const location = await getLocationFromIP(ip);
        
        const visitData = new AnalyticsVisit({
            ...req.body.visitor_details,
            ip_address: ip,
            country: location.country,
            city: location.city,
            timestamp: new Date(req.body.timestamp)
        });
        
        await visitData.save();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error saving visit data:', error);
        res.status(500).json({ error: 'Failed to save visit data' });
    }
});

// Track page view
router.post('/page', async (req, res) => {
    try {
        const ip = getClientIP(req);
        
        const pageData = new AnalyticsPageView({
            visitor_id: req.body.visitor_details.visitor_id,
            session_id: req.body.visitor_details.session_id,
            url: req.body.url,
            title: req.body.title,
            referrer: req.body.referrer,
            referrer_category: req.body.referrer_category,
            search_query: req.body.search_query,
            user_agent: req.body.visitor_details.user_agent,
            device_type: req.body.visitor_details.device_type,
            browser: req.body.visitor_details.browser,
            ip_address: ip,
            timestamp: new Date(req.body.timestamp)
        });
        
        await pageData.save();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error saving page view:', error);
        res.status(500).json({ error: 'Failed to save page view' });
    }
});

// Track resource hit
router.post('/hit', async (req, res) => {
    try {
        const ip = getClientIP(req);
        
        const hitData = new AnalyticsHit({
            visitor_id: req.body.visitor_details.visitor_id,
            session_id: req.body.visitor_details.session_id,
            resource_url: req.body.resource_url,
            resource_type: req.body.resource_type,
            page_url: req.body.page_url,
            ip_address: ip,
            timestamp: new Date(req.body.timestamp)
        });
        
        await hitData.save();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error saving hit data:', error);
        res.status(500).json({ error: 'Failed to save hit data' });
    }
});

// Track engagement
router.post('/engagement', async (req, res) => {
    try {
        const engagementData = new AnalyticsEngagement({
            visitor_id: req.body.visitor_details.visitor_id,
            session_id: req.body.visitor_details.session_id,
            action: req.body.action,
            target_id: req.body.target_id,
            target_type: req.body.target_type,
            user_id: req.body.user_id,
            additional_data: req.body.additional_data,
            timestamp: new Date(req.body.timestamp)
        });
        
        await engagementData.save();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error saving engagement data:', error);
        res.status(500).json({ error: 'Failed to save engagement data' });
    }
});

// Get analytics summary data
router.get('/summary', async (req, res) => {
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

        // Parallel queries for performance
        const [
            uniqueVisitors,
            totalVisits,
            totalPages,
            totalHits,
            popularPages,
            topReferrers,
            deviceStats,
            browserStats,
            geoStats,
            searchQueries
        ] = await Promise.all([
            // Unique visitors
            AnalyticsPageView.distinct('visitor_id', { timestamp: { $gte: startDate } }),
            
            // Total visits
            AnalyticsVisit.countDocuments({ timestamp: { $gte: startDate } }),
            
            // Total pages
            AnalyticsPageView.countDocuments({ timestamp: { $gte: startDate } }),
            
            // Total hits
            AnalyticsHit.countDocuments({ timestamp: { $gte: startDate } }),
            
            // Popular pages
            AnalyticsPageView.aggregate([
                { $match: { timestamp: { $gte: startDate } } },
                { $group: { _id: '$url', count: { $sum: 1 }, title: { $first: '$title' } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            
            // Top referrers
            AnalyticsPageView.aggregate([
                { $match: { timestamp: { $gte: startDate }, referrer_category: { $ne: 'Direct' } } },
                { $group: { _id: '$referrer_category', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            
            // Device statistics
            AnalyticsPageView.aggregate([
                { $match: { timestamp: { $gte: startDate } } },
                { $group: { _id: '$device_type', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            
            // Browser statistics
            AnalyticsPageView.aggregate([
                { $match: { timestamp: { $gte: startDate } } },
                { $group: { _id: '$browser', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            
            // Geographic statistics
            AnalyticsVisit.aggregate([
                { $match: { timestamp: { $gte: startDate } } },
                { $group: { _id: '$country', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            
            // Search queries
            AnalyticsPageView.aggregate([
                { $match: { timestamp: { $gte: startDate }, search_query: { $ne: null, $ne: '' } } },
                { $group: { _id: '$search_query', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ])
        ]);

        // Calculate percentages for device and browser stats
        const totalPageViews = await AnalyticsPageView.countDocuments({ timestamp: { $gte: startDate } });
        
        const deviceStatsWithPercent = deviceStats.map(stat => ({
            type: stat._id,
            count: stat.count,
            percentage: totalPageViews > 0 ? Math.round((stat.count / totalPageViews) * 100) : 0
        }));
        
        const browserStatsWithPercent = browserStats.map(stat => ({
            browser: stat._id,
            count: stat.count,
            percentage: totalPageViews > 0 ? Math.round((stat.count / totalPageViews) * 100) : 0
        }));

        const analytics = {
            overview: {
                uniqueVisitors: uniqueVisitors.length,
                totalVisits,
                totalPages,
                totalHits
            },
            popularPages: popularPages.map(page => ({
                url: page._id,
                title: page.title || page._id,
                views: page.count
            })),
            topReferrers: topReferrers.map(ref => ({
                source: ref._id,
                visits: ref.count
            })),
            deviceStats: deviceStatsWithPercent,
            browserStats: browserStatsWithPercent,
            geoStats: geoStats.map(geo => ({
                country: geo._id,
                visitors: geo.count
            })),
            searchQueries: searchQueries.map(query => ({
                query: query._id,
                count: query.count
            })),
            timeRange,
            generatedAt: new Date().toISOString()
        };

        res.json(analytics);

    } catch (error) {
        console.error('Analytics summary error:', error.message);
        res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
});

// Get most active users (engagement leaderboard)
router.get('/most-active', async (req, res) => {
    try {
        const { timeRange = '7d' } = req.query;
        
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

        const activeUsers = await AnalyticsEngagement.aggregate([
            { $match: { timestamp: { $gte: startDate }, user_id: { $ne: null } } },
            { $group: { _id: '$user_id', actions: { $sum: 1 } } },
            { $sort: { actions: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $project: {
                    username: { $arrayElemAt: ['$user.username', 0] },
                    displayName: { $arrayElemAt: ['$user.displayName', 0] },
                    actions: 1
                }
            }
        ]);

        res.json(activeUsers);
    } catch (error) {
        console.error('Most active users error:', error.message);
        res.status(500).json({ error: 'Failed to fetch most active users' });
    }
});

module.exports = router;