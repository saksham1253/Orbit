const { moderationQueue } = require('../services/queueService');
const mlService = require('../services/mlService');
const User = require('../models/user');

moderationQueue.process(async (job) => {
  const { audioBuffer, langCode, userId } = job.data;
  
  try {
    const isMalicious = await mlService.analyzeAudioChunkForMalcontent(Buffer.from(audioBuffer), langCode);
    
    if (isMalicious) {
      // Need a way to tell Socket.io to disconnect the user.
      // Usually done via Redis pub/sub if multiple servers, but here we can just update DB and emit via a global app instance if possible.
      // For now, we update the DB. The server.js will check or we can handle it via Pub/Sub.
      
      await User.findByIdAndUpdate(userId, { 
        $inc: { warningCount: 1 }, 
        isFlagged: true,
        flagReason: "AI Audio Moderation: Malicious intent detected"
      });
      return { isMalicious: true, userId };
    }
    return { isMalicious: false, userId };
  } catch (error) {
    console.error("Moderation error:", error);
    throw error;
  }
});

// To communicate back to the socket server
moderationQueue.on('completed', (job, result) => {
  if (result.isMalicious) {
    // Ideally we emit an event that server.js listens to, or we require server.js's io instance.
    // For simplicity, we can emit an event using a global EventEmitter.
    const eventEmitter = require('../utils/events');
    eventEmitter.emit('malicious-detected', result.userId);
  }
});
