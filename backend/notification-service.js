/**
 * Notification Service
 * Manages notifications for AI sessions
 */

export class NotificationService {
  constructor() {
    this.notificationQueue = [];
    this.notificationHandlers = new Map(); // type -> handler function
  }

  /**
   * Send a notification
   */
  async sendNotification(sessionId, notification) {
    const enrichedNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sessionId,
      read: false,
      ...notification
    };

    // Add to queue
    this.notificationQueue.push(enrichedNotification);
    
    // Keep only last 100 notifications
    if (this.notificationQueue.length > 100) {
      this.notificationQueue.shift();
    }

    console.log('Notification queued:', enrichedNotification.type, 'for session:', sessionId);

    // Execute any registered handlers
    const handler = this.notificationHandlers.get(notification.priority || 'default');
    if (handler) {
      handler(enrichedNotification);
    }

    return enrichedNotification;
  }

  /**
   * Get recent notifications
   */
  getRecentNotifications(limit = 10, unreadOnly = false) {
    let notifications = [...this.notificationQueue];
    
    if (unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }
    
    return notifications
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get notifications for a specific session
   */
  getSessionNotifications(sessionId, limit = 10) {
    return this.notificationQueue
      .filter(n => n.sessionId === sessionId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId) {
    const notification = this.notificationQueue.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      
      console.log('Notification marked as read:', notificationId);
      
      return true;
    }
    return false;
  }

  /**
   * Mark all notifications for a session as read
   */
  markSessionAsRead(sessionId) {
    let count = 0;
    this.notificationQueue.forEach(notification => {
      if (notification.sessionId === sessionId && !notification.read) {
        notification.read = true;
        count++;
      }
    });

    if (count > 0) {
      console.log(`Marked ${count} notifications as read for session:`, sessionId);
    }

    return count;
  }

  /**
   * Clear old notifications
   */
  clearOldNotifications(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const cutoff = Date.now() - maxAge;
    const before = this.notificationQueue.length;
    
    this.notificationQueue = this.notificationQueue.filter(n => {
      const timestamp = new Date(n.timestamp).getTime();
      return timestamp > cutoff;
    });
    
    return before - this.notificationQueue.length;
  }

  /**
   * Register a handler for specific priority notifications
   */
  registerHandler(priority, handler) {
    this.notificationHandlers.set(priority, handler);
  }

  /**
   * Get notification statistics
   */
  getStats() {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    
    const stats = {
      total: this.notificationQueue.length,
      unread: this.notificationQueue.filter(n => !n.read).length,
      lastHour: this.notificationQueue.filter(n => 
        new Date(n.timestamp).getTime() > now - hour
      ).length,
      byPriority: {},
      bySessions: {}
    };

    // Count by priority
    this.notificationQueue.forEach(n => {
      const priority = n.priority || 'normal';
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
      stats.bySessions[n.sessionId] = (stats.bySessions[n.sessionId] || 0) + 1;
    });

    return stats;
  }
}