const AuditLog = require('../models/auditLogModel');

exports.logAction = async (userId, action, entity, entityId, changes, ipAddress) => {
  try {
    const logEntry = new AuditLog({
      userId,
      action,
      entity,
      entityId,
      changes,
      ipAddress
    });
    await logEntry.save();
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};
