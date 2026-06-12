const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/user');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany();
    }
});

describe('User Model Test', () => {
    it('should create & save user successfully', async () => {
        const validUser = new User({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
            provider: 'local'
        });
        const savedUser = await validUser.save();
        
        // Assertions
        expect(savedUser._id).toBeDefined();
        expect(savedUser.name).toBe('Test User');
        expect(savedUser.email).toBe('test@example.com');
        expect(savedUser.trustScore).toBe(50); // Default value
    });

    it('should fail validation if required fields are missing', async () => {
        const userWithoutRequiredField = new User({ name: 'Test' });
        let err;
        try {
            await userWithoutRequiredField.save();
        } catch (error) {
            err = error;
        }
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(err.errors.email).toBeDefined();
    });

    it('should calculate level based on trustScore', async () => {
        const user = new User({
            name: 'Pro User',
            email: 'pro@example.com',
            password: 'password123',
            trustScore: 85
        });
        await user.save();
        expect(user.level).toBe('Expert');
    });
});
