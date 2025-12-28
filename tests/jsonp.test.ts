import { describe, it, expect, beforeEach } from '@jest/globals';
import { sendResponse } from '../src/utils.js';

// Mock Fastify reply object
class MockReply {
    private statusCode = 200;
    private headers: Record<string, string> = {};
    private body: any = null;

    status(code: number) {
        this.statusCode = code;
        return this;
    }

    header(name: string, value: string) {
        this.headers[name] = value;
        return this;
    }

    type(contentType: string) {
        this.headers['content-type'] = contentType;
        return this;
    }

    send(data: any) {
        this.body = data;
        return this;
    }

    getStatus() {
        return this.statusCode;
    }

    getHeaders() {
        return this.headers;
    }

    getBody() {
        return this.body;
    }
}

describe('JSONP Security', () => {
    let reply: MockReply;

    beforeEach(() => {
        reply = new MockReply();
    });

    describe('sendResponse', () => {
        it('should send JSON response when no callback is provided', () => {
            const data = { value: 42 };
            sendResponse(reply as any, data);

            expect(reply.getBody()).toEqual(data);
        });

        it('should send JSONP response with valid callback', () => {
            const data = { value: 42 };
            const callback = 'myCallback';

            sendResponse(reply as any, data, callback);

            expect(reply.getHeaders()['content-type']).toBe('application/javascript');
            expect(reply.getBody()).toBe('myCallback({"value":42})');
        });

        it('should accept valid callback names', () => {
            const data = { value: 42 };

            // Valid callback names
            expect(() => sendResponse(reply as any, data, 'callback')).not.toThrow();
            expect(() => sendResponse(reply as any, data, '_callback')).not.toThrow();
            expect(() => sendResponse(reply as any, data, '$callback')).not.toThrow();
            expect(() => sendResponse(reply as any, data, 'my_callback')).not.toThrow();
            expect(() => sendResponse(reply as any, data, 'callback123')).not.toThrow();
            expect(() => sendResponse(reply as any, data, 'jQuery.ajax.callback')).not.toThrow();
        });

        it('should reject invalid callback names to prevent XSS', () => {
            const data = { value: 42 };

            // Invalid callback names that could be XSS vectors
            expect(() => sendResponse(reply as any, data, 'alert(1)')).toThrow('Invalid callback name');
            expect(() => sendResponse(reply as any, data, '<script>')).toThrow('Invalid callback name');
            expect(() => sendResponse(reply as any, data, 'callback;alert(1)')).toThrow('Invalid callback name');
            expect(() => sendResponse(reply as any, data, 'callback()')).toThrow('Invalid callback name');
            expect(() => sendResponse(reply as any, data, '123callback')).toThrow('Invalid callback name');
        });

        it('should handle complex data structures', () => {
            const data = {
                value: 42,
                nested: {
                    array: [1, 2, 3],
                    string: 'test',
                },
            };

            sendResponse(reply as any, data, 'callback');

            expect(reply.getBody()).toBe('callback({"value":42,"nested":{"array":[1,2,3],"string":"test"}})');
        });
    });
});
