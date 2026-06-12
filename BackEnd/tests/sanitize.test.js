const mongoSanitize = require('../middleware/sanitize');

describe('mongoSanitize middleware', () => {
    it('should strip out keys starting with $ in the request body', () => {
        const req = {
            body: {
                username: 'admin',
                $gt: ''
            }
        };
        const res = {};
        const next = jest.fn();

        mongoSanitize(req, res, next);

        expect(req.body).toEqual({ username: 'admin' });
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('should recursively strip out keys starting with $ in nested objects', () => {
        const req = {
            query: {
                password: {
                    $ne: 'null'
                },
                normalKey: 'value'
            }
        };
        const res = {};
        const next = jest.fn();

        mongoSanitize(req, res, next);

        expect(req.query).toEqual({ password: {}, normalKey: 'value' });
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle missing keys gracefully', () => {
        const req = {};
        const res = {};
        const next = jest.fn();

        mongoSanitize(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });
});
