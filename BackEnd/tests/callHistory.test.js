const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const CallHistory = require('../models/callHistory');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) await collections[key].deleteMany();
});

describe('CallHistory — creation, update, deletion', () => {
    const caller = new mongoose.Types.ObjectId();
    const receiver = new mongoose.Types.ObjectId();

    // Reproduces the original bug: the WebRTC call socket is unauthenticated, so
    // socket.userId was undefined → caller missing → create failed silently.
    it('FAILS to create when caller is missing (the original bug)', async () => {
        let err;
        try {
            await CallHistory.create({ caller: undefined, receiver, roomName: 'room1', status: 'ringing' });
        } catch (e) { err = e; }
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(err.errors.caller).toBeDefined();
    });

    // The fix: resolving caller from the payload callerId lets the row be written,
    // and the status then progresses ringing → accepted → ended as the call moves.
    it('creates and updates a call history row when caller is resolved', async () => {
        const row = await CallHistory.create({ caller, receiver, roomName: 'room2', status: 'ringing', startedAt: new Date() });
        expect(row._id).toBeDefined();
        expect(row.status).toBe('ringing');

        await CallHistory.findOneAndUpdate({ roomName: 'room2', status: 'ringing' }, { status: 'accepted' });
        const accepted = await CallHistory.findById(row._id);
        expect(accepted.status).toBe('accepted');

        await CallHistory.findOneAndUpdate({ roomName: 'room2' }, { status: 'ended', duration: 42, endedAt: new Date() });
        const ended = await CallHistory.findById(row._id);
        expect(ended.status).toBe('ended');
        expect(ended.duration).toBe(42);
    });

    it('is visible to both participants and hideable per-user (delete)', async () => {
        const row = await CallHistory.create({ caller, receiver, roomName: 'room3', status: 'ended' });
        // Either participant sees it (mirrors GET /video/history).
        const visibleToReceiver = await CallHistory.find({
            $or: [{ caller: receiver }, { receiver }], hiddenFor: { $ne: receiver },
        });
        expect(visibleToReceiver).toHaveLength(1);

        // "Delete for me" hides it for that user only (mirrors DELETE /history/:id).
        await CallHistory.updateOne({ _id: row._id }, { $addToSet: { hiddenFor: caller } });
        const visibleToCallerAfter = await CallHistory.find({
            $or: [{ caller }, { receiver: caller }], hiddenFor: { $ne: caller },
        });
        expect(visibleToCallerAfter).toHaveLength(0);
        // Still visible to the other participant.
        const stillForReceiver = await CallHistory.find({
            $or: [{ caller: receiver }, { receiver }], hiddenFor: { $ne: receiver },
        });
        expect(stillForReceiver).toHaveLength(1);
    });
});
