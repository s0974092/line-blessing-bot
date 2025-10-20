import request from 'supertest';
import app from '../src/app';

describe('GET /', () => {
  it('should respond with a 404 not found', (done) => {
    request(app)
      .get('/')
      .expect(404, done);
  });
});
