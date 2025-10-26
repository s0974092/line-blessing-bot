import request from 'supertest';
import app from '../api/index';

describe('GET /', () => {
  it('should respond with a 404 not found', (done) => {
    request(app)
      .get('/')
      .expect(404, done);
  });
});
